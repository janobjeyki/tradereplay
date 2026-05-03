'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { createClient } from '@/lib/supabase/client'
import type { SubscriptionTransaction } from '@/types'
import { Alert, Badge, Button, Spinner } from '@/components/ui'
import { PLANS, START_PLAN_KEY, START_PLAN_LABEL, START_PLAN_PRICE_UZS } from '@/lib/payments/plans'
import { PlanCheckoutModal } from '@/components/subscription/PlanCheckoutModal'

export default function SubscriptionPage() {
  const { user, profile, refreshProfile } = useAuth()
  const [transactions, setTransactions] = useState<SubscriptionTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [checkoutPlan, setCheckoutPlan] = useState<typeof PLANS[number] | null>(null)
  const [canceling, setCanceling] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const isActive = profile?.subscription_status === 'active'
  const currentPlanKey = isActive ? (profile?.subscription_plan || START_PLAN_KEY) : 'free'
  const currentPlanLabel = isActive
    ? (profile?.subscription_plan === START_PLAN_KEY ? START_PLAN_LABEL : (profile?.subscription_plan || START_PLAN_LABEL))
    : 'Free'
  const expiresAt = profile?.subscription_expires_at ? new Date(profile.subscription_expires_at) : null
  const lastAuthorized = useMemo(() => transactions.find(t => t.status === 'authorized'), [transactions])

  useEffect(() => {
    if (user) void fetchTransactions()
  }, [user])

  async function fetchTransactions() {
    setLoading(true)
    const { data } = await createClient()
      .from('subscription_transactions')
      .select('*')
      .order('created_at', { ascending: false })
    setTransactions((data as SubscriptionTransaction[]) ?? [])
    setLoading(false)
  }

  async function cancelSubscription() {
    if (!confirm('Cancel your subscription? Session creation will be locked once it lapses.')) return
    setCanceling(true); setError(''); setMessage('')
    const res = await fetch('/api/subscription/cancel', { method: 'POST' })
    const payload = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(payload.error || 'Failed to cancel subscription')
    } else {
      setMessage('Subscription canceled.')
      await refreshProfile()
      await fetchTransactions()
    }
    setCanceling(false)
  }

  if (!user) return null

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-7 py-5 shrink-0" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <h1 className="font-black text-2xl tracking-tight" style={{ color: 'var(--text-primary)' }}>Subscription</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Manage your plan, promo codes, and payments via Click.
        </p>
      </div>
      <div className="flex-1 overflow-y-auto px-7 py-6 max-w-3xl">
        {loading ? (
          <div className="flex items-center justify-center h-40"><Spinner /></div>
        ) : (
          <div className="flex flex-col gap-5">
            {error   && <Alert type="error"   message={error} />}
            {message && <Alert type="success" message={message} />}

            <div className="rounded-2xl p-5" style={{
              background: 'linear-gradient(135deg, rgba(37,99,235,0.18), rgba(14,165,233,0.08))',
              border: '1px solid var(--accent-border)',
            }}>
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em]" style={{ color: 'var(--text-muted)' }}>Current Plan</p>
                  <h2 className="text-2xl font-black mt-1" style={{ color: 'var(--text-primary)' }}>{currentPlanLabel}</h2>
                  <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                    {isActive
                      ? `Active${expiresAt ? ` until ${expiresAt.toLocaleDateString()}` : ''}`
                      : 'No active subscription. Choose a plan below to unlock session creation.'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={isActive ? 'green' : 'red'}>{isActive ? 'Active' : 'Inactive'}</Badge>
                  {isActive && (
                    <Button variant="ghost" loading={canceling} onClick={cancelSubscription}>
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>Available Plans</h3>
              <div className="grid gap-3 md:grid-cols-2">
                {PLANS.map(plan => {
                  const isCurrent = isActive && plan.key === currentPlanKey
                  return (
                    <div
                      key={plan.key}
                      className="rounded-2xl p-5 flex flex-col gap-4"
                      style={{
                        background: 'var(--bg-secondary)',
                        border: isCurrent ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em]" style={{ color: 'var(--text-muted)' }}>Plan</p>
                          <h4 className="text-lg font-bold mt-1" style={{ color: 'var(--text-primary)' }}>{plan.label}</h4>
                        </div>
                        {isCurrent && <Badge variant="blue">Current</Badge>}
                      </div>
                      <div>
                        <p className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>
                          {plan.price.toLocaleString()} UZS
                        </p>
                        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>per month</p>
                      </div>
                      <ul className="text-sm flex flex-col gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                        <li>• Unlimited replay sessions</li>
                        <li>• Saved trade journal & analytics</li>
                        <li>• Strategy checklists</li>
                      </ul>
                      <Button
                        variant="primary"
                        disabled={isCurrent}
                        onClick={() => setCheckoutPlan(plan)}
                      >
                        {isCurrent ? 'Current Plan' : `Choose ${plan.label}`}
                      </Button>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="rounded-2xl p-5" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
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
                        {tx.status === 'authorized' ? 'Authorized'
                          : tx.status === 'pending' ? 'Pending'
                          : tx.status === 'canceled' ? 'Canceled' : 'Failed'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {checkoutPlan && (
        <PlanCheckoutModal
          open
          planLabel={checkoutPlan.label}
          planProduct={checkoutPlan.key}
          basePrice={checkoutPlan.price || START_PLAN_PRICE_UZS}
          onClose={() => setCheckoutPlan(null)}
          onActivated={async () => {
            await refreshProfile()
            await fetchTransactions()
          }}
        />
      )}
    </div>
  )
}
