'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Profile, SubscriptionTransaction } from '@/types'
import { Alert, Badge, Button } from '@/components/ui'

export type PaymentMethod = 'humo' | 'uzcard' | 'visa'

const PAYMENT_METHODS: Array<{ id: PaymentMethod; label: string; note: string }> = [
  { id: 'humo', label: 'Humo', note: 'Bind a HUMO card through Uzum Checkout' },
  { id: 'uzcard', label: 'Uzcard', note: 'Bind an Uzcard through Uzum Checkout' },
  { id: 'visa', label: 'Visa', note: 'Bind a Visa card through Uzum Checkout' },
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
  userId,
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
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>((profile?.payment_method as PaymentMethod | null) ?? 'humo')
  const [pendingReference, setPendingReference] = useState('')
  const [pendingMethod, setPendingMethod] = useState<PaymentMethod | null>(null)
  const [saving, setSaving] = useState(false)
  const [checkingStatus, setCheckingStatus] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const isActive = profile?.subscription_status === 'active'
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

    const params = new URLSearchParams(window.location.search)
    const authorizationState = params.get('authorization')
    if (authorizationState === 'return') {
      void checkAuthorizationStatus(pending.reference, true)
    }
    if (authorizationState === 'failed') {
      setError('Uzum Checkout did not complete the card binding. Please try again.')
    }
  }, [])

  async function activateSubscription() {
    setSaving(true)
    setError('')
    setMessage('')

    const response = await fetch('/api/subscription/authorize/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentMethod }),
    })

    const payload = await response.json()
    if (!response.ok) {
      setError(payload.error || 'Failed to start Uzum Checkout')
      setSaving(false)
      return
    }

    setPendingReference(payload.reference)
    setPendingMethod(paymentMethod)
    persistPendingAuthorization(payload.reference, paymentMethod)
    setMessage(`Redirecting to Uzum Checkout. A temporary verification charge of ${Number(payload.verificationAmount) / 100} ${payload.verificationCurrency} may be used by the provider to bind your card.`)
    window.location.assign(payload.redirectUrl)
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
      setMessage('Subscription activated and card bound successfully through Uzum Checkout.')
      await onActivated?.()
    } else if (status === 'failed' || status === 'canceled') {
      clearPendingAuthorization()
      setPendingReference('')
      setPendingMethod(null)
      if (!silent) setError('Card binding was not completed. Please try again.')
    } else if (!silent) {
      setMessage('Binding is still pending in Uzum Checkout. Complete the provider page and check again.')
    }

    setCheckingStatus(false)
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
            <h3 className="text-xl font-black mt-1" style={{ color: 'var(--text-primary)' }}>$0 for now</h3>
            <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
              Cards are now linked through Uzum Checkout&apos;s hosted page. Session creation stays locked until the card binding finishes successfully.
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

      {isAwaitingConfirmation && (
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--accent-border)' }}>
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Pending Uzum Binding</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                Finish the Uzum Checkout flow, then come back here and confirm the binding status.
              </p>
            </div>
            <div className="flex justify-end">
              <Button variant="ghost" loading={checkingStatus} onClick={() => checkAuthorizationStatus()}>
                Check Status
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl px-4 py-3" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Card details are collected on Uzum Checkout&apos;s hosted payment page, not inside this app. For card binding, Uzum may place a small temporary verification amount instead of a true zero-value authorization.
        </p>
      </div>

      {!compact && (
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center justify-between gap-3 mb-3">
            <h4 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Authorization History</h4>
            {lastAuthorized && <Badge variant="blue">{lastAuthorized.reference}</Badge>}
          </div>
          {transactions.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No authorization attempts yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {transactions.slice(0, 5).map(tx => (
                <div key={tx.id} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: 'var(--bg-tertiary)' }}>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {tx.payment_method.toUpperCase()} {tx.card_last4 !== 'pending' ? `•••• ${tx.card_last4}` : 'binding'}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{new Date(tx.created_at).toLocaleString()}</p>
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
          {isActive ? 'Rebind Card in Uzum' : 'Bind Card with Uzum'}
        </Button>
      </div>
    </div>
  )
}
