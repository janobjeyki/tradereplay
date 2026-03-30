'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { createClient } from '@/lib/supabase/client'
import type { SubscriptionTransaction } from '@/types'
import { Spinner } from '@/components/ui'
import { SubscriptionManager } from '@/components/subscription/SubscriptionManager'

export default function SubscriptionPage() {
  const { user, profile, refreshProfile } = useAuth()
  const [transactions, setTransactions] = useState<SubscriptionTransaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) fetchTransactions()
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

  if (!user) return null

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-7 py-5 shrink-0" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <h1 className="font-black text-2xl tracking-tight" style={{ color: 'var(--text-primary)' }}>Subscription</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Manage your plan, card authorization, and subscription access.
        </p>
      </div>
      <div className="flex-1 overflow-y-auto px-7 py-6 max-w-3xl">
        {loading ? (
          <div className="flex items-center justify-center h-40"><Spinner /></div>
        ) : (
          <SubscriptionManager
            profile={profile}
            userId={user.id}
            transactions={transactions}
            onActivated={async () => {
              await refreshProfile()
              await fetchTransactions()
            }}
          />
        )}
      </div>
    </div>
  )
}
