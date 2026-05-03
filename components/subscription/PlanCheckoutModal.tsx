'use client'

import { useEffect, useState } from 'react'
import { Alert, Badge, Button, Input, Modal } from '@/components/ui'
import type { SubscriptionTransaction } from '@/types'

export type PaymentMethod = 'humo' | 'uzcard'

const PAYMENT_METHODS: Array<{ id: PaymentMethod; label: string; note: string }> = [
  { id: 'humo', label: 'Humo', note: 'HUMO cards starting with 9860' },
  { id: 'uzcard', label: 'Uzcard', note: 'Uzcard cards starting with 8600' },
]

const STORAGE_KEY = 'subscription_pending_authorization'

type Step = 'payment' | 'verify' | 'success' | 'failure'

interface PromoQuote {
  code: string
  discountPercent: number
  baseAmount: number
  discountedAmount: number
}

interface PendingAuth {
  reference: string
  paymentMethod: PaymentMethod
}

function persistPending(value: PendingAuth) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
}

function loadPending(): PendingAuth | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as PendingAuth
  } catch {
    return null
  }
}

function clearPending() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(STORAGE_KEY)
}

function formatCardNumber(value: string) {
  return value
    .replace(/\D/g, '')
    .slice(0, 16)
    .replace(/(\d{4})(?=\d)/g, '$1 ')
    .trim()
}

function formatCardExpiry(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 4)
  if (digits.length <= 2) return digits
  return `${digits.slice(0, 2)}/${digits.slice(2)}`
}

export function PlanCheckoutModal({
  open,
  onClose,
  planLabel,
  planProduct,
  basePrice,
  onActivated,
}: {
  open: boolean
  onClose: () => void
  planLabel: string
  planProduct: string
  basePrice: number
  onActivated?: () => void | Promise<void>
}) {
  const [step, setStep] = useState<Step>('payment')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('uzcard')
  const [cardNumber, setCardNumber] = useState('')
  const [cardExpiry, setCardExpiry] = useState('')
  const [promoCode, setPromoCode] = useState('')
  const [promoQuote, setPromoQuote] = useState<PromoQuote | null>(null)
  const [validatingPromo, setValidatingPromo] = useState(false)
  const [paying, setPaying] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [pending, setPending] = useState<PendingAuth | null>(null)
  const [verificationCode, setVerificationCode] = useState('')
  const [chargedAmount, setChargedAmount] = useState<number>(basePrice)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    setInfo('')
    const existing = loadPending()
    if (existing) {
      setPending(existing)
      setPaymentMethod(existing.paymentMethod)
      setStep('verify')
      setInfo('We found a verification in progress. Enter the SMS code from Click to finish.')
    } else {
      setStep('payment')
      setPending(null)
      setVerificationCode('')
    }
  }, [open])

  function resetForm() {
    setCardNumber('')
    setCardExpiry('')
    setPromoCode('')
    setPromoQuote(null)
    setVerificationCode('')
  }

  async function applyPromoCode() {
    setError('')
    setInfo('')
    const trimmed = promoCode.trim()
    if (!trimmed) {
      setPromoQuote(null)
      return
    }
    setValidatingPromo(true)
    const res = await fetch('/api/subscription/promo/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: trimmed, product: planProduct }),
    })
    const payload = await res.json()
    if (!res.ok) {
      setPromoQuote(null)
      setError(payload.error || 'Promo code is not valid.')
    } else {
      setPromoQuote({
        code: payload.code,
        discountPercent: payload.discountPercent,
        baseAmount: payload.baseAmount,
        discountedAmount: payload.discountedAmount,
      })
      setInfo(`Promo applied — ${payload.discountPercent}% off.`)
    }
    setValidatingPromo(false)
  }

  async function startPayment() {
    setError('')
    setInfo('')
    setPaying(true)

    const res = await fetch('/api/subscription/authorize/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentMethod,
        cardNumber,
        cardExpire: cardExpiry,
        promoCode: promoQuote ? promoQuote.code : undefined,
        product: planProduct,
      }),
    })
    const payload = await res.json()
    setPaying(false)

    if (!res.ok) {
      setError(payload.error || 'Click could not start the payment.')
      return
    }

    const next: PendingAuth = { reference: payload.reference, paymentMethod }
    persistPending(next)
    setPending(next)
    setChargedAmount(Number(payload.verificationAmount ?? basePrice))
    setStep('verify')
    setInfo(
      `Click sent a verification code${payload.verificationPhone ? ` to ${payload.verificationPhone}` : ''}. Enter it below to authorize the charge.`,
    )
  }

  async function verifyAndCharge() {
    if (!pending) return
    setError('')
    setInfo('')
    setVerifying(true)

    const res = await fetch('/api/subscription/authorize/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference: pending.reference, code: verificationCode }),
    })
    const payload = await res.json()
    setVerifying(false)

    if (!res.ok) {
      setError(payload.error || 'Verification failed.')
      return
    }

    const status = payload.transaction?.status as SubscriptionTransaction['status'] | undefined
    if (status === 'authorized') {
      clearPending()
      setPending(null)
      setStep('success')
      resetForm()
      await onActivated?.()
    } else {
      clearPending()
      setPending(null)
      setStep('failure')
      setError('Payment did not complete. Please try again.')
    }
  }

  function handleClose() {
    if (paying || verifying || validatingPromo) return
    onClose()
  }

  function startOver() {
    clearPending()
    setPending(null)
    setStep('payment')
    setError('')
    setInfo('')
    setVerificationCode('')
  }

  const finalAmount = promoQuote ? promoQuote.discountedAmount : basePrice

  return (
    <Modal open={open} onClose={handleClose} title={`Subscribe — ${planLabel}`} width="max-w-lg">
      <div className="flex flex-col gap-5">
        {error && <Alert type="error" message={error} />}
        {info  && <Alert type="success" message={info} />}

        {step === 'payment' && (
          <>
            <div className="rounded-xl p-4" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[11px] uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>You pay today</p>
                {promoQuote && <Badge variant="green">-{promoQuote.discountPercent}%</Badge>}
              </div>
              <div className="mt-1 flex items-baseline gap-3">
                <h3 className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>
                  {finalAmount.toLocaleString()} UZS
                </h3>
                {promoQuote && (
                  <span className="text-sm line-through" style={{ color: 'var(--text-muted)' }}>
                    {basePrice.toLocaleString()} UZS
                  </span>
                )}
              </div>
              <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                Charged through Click. SMS verification is required to authorize the payment.
              </p>
            </div>

            <div>
              <p className="text-[11px] tracking-wider uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Card Network</p>
              <div className="grid grid-cols-2 gap-3">
                {PAYMENT_METHODS.map(method => {
                  const active = paymentMethod === method.id
                  return (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => setPaymentMethod(method.id)}
                      className="rounded-xl px-4 py-3 text-left transition-all"
                      style={{
                        background: active ? 'var(--bg-elevated)' : 'var(--bg-tertiary)',
                        border: active ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                      }}
                    >
                      <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{method.label}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{method.note}</p>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Input
                label="Card Number"
                placeholder={paymentMethod === 'humo' ? '9860 1234 5678 9012' : '8600 1234 5678 9012'}
                inputMode="numeric"
                autoComplete="cc-number"
                value={cardNumber}
                onChange={e => setCardNumber(formatCardNumber(e.target.value))}
                disabled={paying}
              />
              <Input
                label="Expiry"
                placeholder="MM/YY"
                inputMode="numeric"
                autoComplete="cc-exp"
                value={cardExpiry}
                onChange={e => setCardExpiry(formatCardExpiry(e.target.value))}
                disabled={paying}
              />
            </div>

            <div>
              <p className="text-[11px] tracking-wider uppercase mb-1.5" style={{ color: 'var(--text-muted)' }}>Promo Code (optional)</p>
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-xl px-3.5 py-2.5 text-sm outline-none"
                  style={{
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-default)',
                    color: 'var(--text-primary)',
                    textTransform: 'uppercase',
                  }}
                  placeholder="ABC123"
                  value={promoCode}
                  onChange={e => {
                    setPromoCode(e.target.value.toUpperCase())
                    if (promoQuote) setPromoQuote(null)
                  }}
                  disabled={paying || validatingPromo}
                />
                <Button
                  variant="ghost"
                  loading={validatingPromo}
                  onClick={applyPromoCode}
                  disabled={!promoCode.trim()}
                >
                  {promoQuote ? 'Re-check' : 'Apply'}
                </Button>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={handleClose} disabled={paying}>Cancel</Button>
              <Button
                variant="primary"
                loading={paying}
                disabled={!cardNumber.trim() || !cardExpiry.trim()}
                onClick={startPayment}
              >
                Pay {finalAmount.toLocaleString()} UZS
              </Button>
            </div>
          </>
        )}

        {step === 'verify' && (
          <>
            <div className="rounded-xl p-4" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Click sent an SMS verification code. Enter it to authorize the charge of{' '}
                <strong>{chargedAmount.toLocaleString()} UZS</strong>.
              </p>
            </div>
            <Input
              label="SMS Code"
              placeholder="123456"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={verificationCode}
              onChange={e => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              disabled={verifying}
            />
            <div className="flex justify-between gap-3">
              <Button variant="ghost" onClick={startOver} disabled={verifying}>Use a different card</Button>
              <Button
                variant="primary"
                loading={verifying}
                disabled={verificationCode.length < 4}
                onClick={verifyAndCharge}
              >
                Verify & Pay
              </Button>
            </div>
          </>
        )}

        {step === 'success' && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl"
              style={{ background: 'var(--green-muted)', color: 'var(--green)' }}>✓</div>
            <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Payment successful</h3>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Your {planLabel} plan is now active. You can start creating sessions immediately.
            </p>
            <Button variant="primary" onClick={onClose}>Done</Button>
          </div>
        )}

        {step === 'failure' && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl"
              style={{ background: 'var(--red-muted)', color: 'var(--red)' }}>✕</div>
            <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Payment failed</h3>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              The payment did not go through. Please verify your card details and try again.
            </p>
            <div className="flex gap-3">
              <Button variant="ghost" onClick={onClose}>Close</Button>
              <Button variant="primary" onClick={startOver}>Try Again</Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
