'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Profile, SubscriptionTransaction } from '@/types'
import { Alert, Badge, Button, Input } from '@/components/ui'

export type PaymentMethod = 'humo' | 'uzcard'

const PAYMENT_METHODS: Array<{ id: PaymentMethod; label: string; note: string }> = [
  { id: 'humo', label: 'Humo', note: 'Bind a HUMO card through Click' },
  { id: 'uzcard', label: 'Uzcard', note: 'Bind an Uzcard through Click' },
]

const STORAGE_KEY = 'subscription_pending_authorization'

function persistPendingAuthorization(reference: string, paymentMethod: PaymentMethod) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ reference, paymentMethod }))
}

function loadPendingAuthorization(): { reference: string; paymentMethod: PaymentMethod } | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as { reference: string; paymentMethod: PaymentMethod }
  } catch {
    return null
  }
}

function clearPendingAuthorization() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(STORAGE_KEY)
}

export function SubscriptionManager({
  profile,
  transactions = [],
  compact = false,
  onActivated,
}: {
  profile: Profile | null
  userId: string
  transactions?: SubscriptionTransaction[]
  compact?: boolean
  onActivated?: () => void | Promise<void>
}) {
  const initialMethod = profile?.payment_method === 'humo' || profile?.payment_method === 'uzcard' ? profile.payment_method : 'uzcard'
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(initialMethod)
  const [cardNumber, setCardNumber] = useState('')
  const [cardExpiry, setCardExpiry] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [pendingReference, setPendingReference] = useState('')
  const [pendingMethod, setPendingMethod] = useState<PaymentMethod | null>(null)
  const [saving, setSaving] = useState(false)
  const [checkingStatus, setCheckingStatus] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const isActive = profile?.subscription_status === 'active'
  const price = Number(profile?.subscription_price ?? 0)
  const expiresAt = profile?.subscription_expires_at ? new Date(profile.subscription_expires_at) : null
  const lastAuthorized = useMemo(
    () => transactions.find(t => t.status === 'authorized'),
    [transactions]
  )
  const isAwaitingConfirmation = Boolean(pendingReference && pendingMethod)

  useEffect(() => {
    const pending = loadPendingAuthorization()
    if (!pending) return

    setPendingReference(pending.reference)
    setPendingMethod(pending.paymentMethod)
  }, [])

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

  async function activateSubscription() {
    setSaving(true)
    setError('')
    setMessage('')

    const response = await fetch('/api/subscription/authorize/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentMethod, cardNumber, cardExpire: cardExpiry }),
    })

    const payload = await response.json()
    if (!response.ok) {
      setError(payload.error || 'Failed to start Click verification')
      setSaving(false)
      return
    }

    setPendingReference(payload.reference)
    setPendingMethod(paymentMethod)
    setVerificationCode('')
    persistPendingAuthorization(payload.reference, paymentMethod)
    setMessage(`Click sent a verification code${payload.verificationPhone ? ` to ${payload.verificationPhone}` : ''}. Enter it below to finish binding your card.`)
    setSaving(false)
  }

  async function checkAuthorizationStatus(reference = pendingReference, silent = false) {
    if (!reference) return

    setCheckingStatus(true)
    if (!silent) {
      setError('')
      setMessage('')
    }

    const response = await fetch(`/api/subscription/authorize/status?reference=${encodeURIComponent(reference)}`, {
      cache: 'no-store',
    })
    const payload = await response.json()

    if (!response.ok) {
      if (!silent) setError(payload.error || 'Failed to check authorization status')
      setCheckingStatus(false)
      return
    }

    const status = payload.transaction?.status as SubscriptionTransaction['status']
    if (status === 'authorized') {
      clearPendingAuthorization()
      setPendingReference('')
      setPendingMethod(null)
      setVerificationCode('')
      setCardNumber('')
      setCardExpiry('')
      setMessage('Subscription activated and card bound successfully through Click.')
      await onActivated?.()
    } else if (status === 'failed' || status === 'canceled') {
      clearPendingAuthorization()
      setPendingReference('')
      setPendingMethod(null)
      setVerificationCode('')
      if (!silent) setError('Card binding was not completed. Please try again.')
    } else if (!silent) {
      setMessage('Binding is still pending in Click. Enter the SMS code or check the status again.')
    }

    setCheckingStatus(false)
  }

  async function verifyPendingCard() {
    if (!pendingReference) return

    setVerifying(true)
    setError('')
    setMessage('')

    const response = await fetch('/api/subscription/authorize/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference: pendingReference, code: verificationCode }),
    })

    const payload = await response.json()
    if (!response.ok) {
      setError(payload.error || 'Failed to verify Click code')
      setVerifying(false)
      return
    }

    setVerifying(false)
    await checkAuthorizationStatus(pendingReference, true)
  }

  async function cancelSubscription() {
    setSaving(true)
    setError('')
    setMessage('')

    const response = await fetch('/api/subscription/cancel', {
      method: 'POST',
    })
    const payload = await response.json()

    if (!response.ok) {
      setError(payload.error || 'Failed to cancel subscription')
      setSaving(false)
      return
    }

    clearPendingAuthorization()
    setPendingReference('')
    setPendingMethod(null)
    setMessage('Subscription canceled.')
    setSaving(false)
    await onActivated?.()
  }

  return (
    <div className="flex flex-col gap-5">
      {error && <Alert type="error" message={error} />}
      {message && <Alert type="success" message={message} />}

      <div className="rounded-xl p-4" style={{ background: 'linear-gradient(135deg, rgba(37,99,235,0.18), rgba(14,165,233,0.08))', border: '1px solid var(--accent-border)' }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em]" style={{ color: 'var(--text-muted)' }}>Starter Access</p>
            <h3 className="text-xl font-black mt-1" style={{ color: 'var(--text-primary)' }}>
              {price > 0 ? `${price.toLocaleString()} UZS` : 'Free trial'}
            </h3>
            <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
              Cards are linked through Click Merchant API. Session creation stays locked until card verification finishes successfully.
            </p>
            <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
              {expiresAt ? `Renews on ${expiresAt.toLocaleDateString()}` : 'No renewal date set'}
            </p>
          </div>
          <Badge variant={isActive ? 'green' : 'red'}>
            {isActive ? 'Active' : 'Inactive'}
          </Badge>
        </div>
      </div>

      <div>
        <p className="text-[11px] tracking-wider uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Preferred Card Type</p>
        <div className="grid gap-3">
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
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{method.label}</p>
                    <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{method.note}</p>
                  </div>
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 999,
                      border: active ? '5px solid var(--accent)' : '1px solid var(--border-default)',
                      background: active ? 'rgba(59,130,246,0.18)' : 'transparent',
                      flexShrink: 0,
                    }}
                  />
                </div>
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
          disabled={saving || verifying}
        />
        <Input
          label="Expiry"
          placeholder="MM/YY"
          inputMode="numeric"
          autoComplete="cc-exp"
          value={cardExpiry}
          onChange={e => setCardExpiry(formatCardExpiry(e.target.value))}
          disabled={saving || verifying}
        />
      </div>

      {isAwaitingConfirmation && (
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--accent-border)' }}>
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Pending Click Verification</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                Enter the SMS verification code from Click to finish binding this card.
              </p>
            </div>
            <Input
              label="SMS Code"
              placeholder="123456"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={verificationCode}
              onChange={e => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              disabled={checkingStatus || verifying}
            />
            <div className="flex justify-end gap-3">
              <Button variant="primary" loading={verifying} onClick={verifyPendingCard}>
                Verify Code
              </Button>
              <Button variant="ghost" loading={checkingStatus} onClick={() => checkAuthorizationStatus()}>
                Check Status
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl px-4 py-3" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Your card is tokenized and verified through Click. Use a card that matches the selected network prefix and complete the SMS confirmation step to activate access.
        </p>
      </div>

      {!compact && (
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center justify-between gap-3 mb-3">
            <h4 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Payment History</h4>
            {lastAuthorized && <Badge variant="blue">{lastAuthorized.reference}</Badge>}
          </div>
          {transactions.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No payment attempts yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {transactions.slice(0, 5).map(tx => (
                <div key={tx.id} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: 'var(--bg-tertiary)' }}>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {tx.payment_method.toUpperCase()} {tx.card_last4 !== 'pending' ? `•••• ${tx.card_last4}` : 'binding'}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {Number(tx.amount || 0).toLocaleString()} {tx.currency} · {new Date(tx.created_at).toLocaleString()}
                    </p>
                  </div>
                  <Badge variant={tx.status === 'authorized' ? 'green' : tx.status === 'pending' ? 'blue' : 'red'}>
                    {tx.status === 'authorized' ? 'Authorized' : tx.status === 'pending' ? 'Pending' : tx.status === 'canceled' ? 'Canceled' : 'Failed'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        {isActive && (
          <Button variant="ghost" loading={saving} onClick={cancelSubscription}>
            Cancel Subscription
          </Button>
        )}
        <Button variant="primary" loading={saving} onClick={activateSubscription}>
          {isActive ? 'Rebind Card with Click' : 'Bind Card with Click'}
        </Button>
      </div>
    </div>
  )
}
