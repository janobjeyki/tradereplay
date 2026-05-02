'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Badge, Button, Input, Spinner } from '@/components/ui'
import type { Profile, SubscriptionTransaction } from '@/types'

const SYNC_SYMBOLS = [
  'AUDUSD','EURAUD','EURCAD','EURGBP','EURJPY','EURUSD',
  'GBPAUD','GBPCAD','GBPJPY','GBPUSD','NZDUSD','USDCAD',
  'USDCHF','USDJPY','XAUUSD',
]

const START_YEAR  = 2010
const CURRENT_YEAR = new Date().getUTCFullYear()
const ALL_YEARS   = Array.from({ length: CURRENT_YEAR - START_YEAR + 1 }, (_, i) => START_YEAR + i)

interface AdminUser {
  id: string
  email: string | null
  created_at: string
  last_sign_in_at: string | null
  profile: Profile | null
  sessions_count: number
  transactions: SubscriptionTransaction[]
}

type YearStatus = 'pending' | 'syncing' | 'done' | 'error'

interface SymbolProgress {
  symbol: string
  status: 'pending' | 'syncing' | 'done' | 'error'
  currentYear?: number
  doneYears: number
  totalYears: number
  totalCandles: number
  error?: string
}

function formatDate(value?: string | null) {
  if (!value) return 'none'
  return new Date(value).toLocaleDateString()
}

export function AdminPanel() {
  const [query, setQuery]           = useState('')
  const [users, setUsers]           = useState<AdminUser[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState('')
  const [message, setMessage]       = useState('')
  const [error, setError]           = useState('')
  const [syncProgress, setSyncProgress] = useState<SymbolProgress[]>([])
  const [syncingData, setSyncingData]   = useState(false)
  const abortRef = useRef(false)

  const selected = useMemo(
    () => users.find(item => item.id === selectedId) || users[0] || null,
    [selectedId, users]
  )

  const fetchUsers = useCallback(async (search: string) => {
    setLoading(true); setError('')
    const res = await fetch(`/api/admin/users?query=${encodeURIComponent(search)}`, { cache: 'no-store' })
    const payload = await res.json()
    if (!res.ok) { setError(payload.error || 'Failed to load users'); setUsers([]); setLoading(false); return }
    setUsers(payload.users || [])
    setSelectedId((payload.users || [])[0]?.id || '')
    setLoading(false)
  }, [])

  useEffect(() => { void fetchUsers('') }, [fetchUsers])

  function savingKey(action: 'gift' | 'extend' | 'cancel', months?: number, lifetime = false) {
    return `${action}-${months ?? (lifetime ? 'lifetime' : 'default')}`
  }

  async function syncAllMarketData() {
    setSyncingData(true)
    setError('')
    setMessage('')
    abortRef.current = false

    setSyncProgress(SYNC_SYMBOLS.map(s => ({
      symbol: s, status: 'pending', doneYears: 0,
      totalYears: ALL_YEARS.length, totalCandles: 0,
    })))

    for (const symbol of SYNC_SYMBOLS) {
      if (abortRef.current) break

      setSyncProgress(prev => prev.map(p =>
        p.symbol === symbol ? { ...p, status: 'syncing' } : p
      ))

      let symbolError: string | undefined
      let totalCandles = 0

      for (const year of ALL_YEARS) {
        if (abortRef.current) break

        setSyncProgress(prev => prev.map(p =>
          p.symbol === symbol ? { ...p, currentYear: year } : p
        ))

        try {
          const res  = await fetch(`/api/admin/data/sync?symbol=${symbol}&year=${year}`, { method: 'POST' })
          const data = await res.json().catch(() => ({} as any))

          if (!res.ok) {
            symbolError = data.error || `HTTP ${res.status}`
            break
          }

          totalCandles = data.total ?? totalCandles

          setSyncProgress(prev => prev.map(p =>
            p.symbol === symbol
              ? { ...p, doneYears: p.doneYears + 1, totalCandles }
              : p
          ))
        } catch (err) {
          symbolError = String(err)
          break
        }
      }

      setSyncProgress(prev => prev.map(p =>
        p.symbol === symbol
          ? { ...p, status: symbolError ? 'error' : 'done', error: symbolError, currentYear: undefined }
          : p
      ))
    }

    setMessage(abortRef.current ? 'Sync cancelled.' : 'Sync complete.')
    setSyncingData(false)
  }

  function cancelSync() {
    abortRef.current = true
  }

  async function updateSubscription(action: 'gift' | 'extend' | 'cancel', months?: number, lifetime = false) {
    if (!selected) return
    setSaving(savingKey(action, months, lifetime)); setError(''); setMessage('')
    const res = await fetch('/api/admin/subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: selected.id, action, months, lifetime }),
    })
    const payload = await res.json()
    if (!res.ok) { setError(payload.error || 'Failed to update subscription'); setSaving(''); return }
    setMessage(`Subscription ${action} applied for ${selected.email || selected.id}.`)
    await fetchUsers(query)
    setSelectedId(selected.id)
    setSaving('')
  }

  const syncDone    = syncProgress.filter(p => p.status === 'done').length
  const syncErrors  = syncProgress.filter(p => p.status === 'error').length
  const syncTotal   = syncProgress.length

  return (
    <div className="page-content">
      <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">

        {/* User list */}
        <section className="rounded-2xl p-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
          <div className="flex gap-2">
            <Input aria-label="Search users" placeholder="Search email or user id"
              value={query} onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void fetchUsers(query) }} />
            <Button variant="primary" loading={loading} onClick={() => fetchUsers(query)}>Search</Button>
          </div>
          <div className="mt-4 max-h-[62vh] overflow-y-auto pr-1">
            {loading ? (
              <div className="flex h-32 items-center justify-center"><Spinner /></div>
            ) : users.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No users found.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {users.map(item => {
                  const active = item.id === selected?.id
                  return (
                    <button key={item.id} type="button" onClick={() => setSelectedId(item.id)}
                      className="rounded-xl px-3 py-3 text-left transition-all"
                      style={{
                        background: active ? 'var(--bg-elevated)' : 'var(--bg-tertiary)',
                        border: active ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                      }}>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{item.email || 'No email'}</p>
                      <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>{item.id}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <Badge variant={item.profile?.subscription_status === 'active' ? 'green' : 'red'}>
                          {item.profile?.subscription_status || 'no profile'}
                        </Badge>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.sessions_count} sessions</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </section>

        {/* Detail panel */}
        <section className="rounded-2xl p-5" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
          {error   && <Alert type="error"   message={error} />}
          {message && <div className="mb-4"><Alert type="success" message={message} /></div>}

          {!selected ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Select a user to manage access.</p>
          ) : (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-2xl font-black">{selected.email || selected.id}</h2>
                  <p className="mt-1 text-xs break-all" style={{ color: 'var(--text-muted)' }}>{selected.id}</p>
                </div>
                <Badge variant={selected.profile?.subscription_status === 'active' ? 'green' : 'red'}>
                  {selected.profile?.subscription_status || 'no profile'}
                </Badge>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <Info label="Plan"     value={selected.profile?.subscription_plan || 'none'} />
                <Info label="Price"    value={`${Number(selected.profile?.subscription_price || 0).toLocaleString()} UZS`} />
                <Info label="Expires"  value={formatDate(selected.profile?.subscription_expires_at)} />
                <Info label="Payment"  value={selected.profile?.payment_method?.toUpperCase() ?? 'none'} />
                <Info label="Card"     value={selected.profile?.card_last4 ? `•••• ${selected.profile.card_last4}` : 'none'} />
                <Info label="Sessions" value={String(selected.sessions_count)} />
              </div>

              {/* Market Data Sync */}
              <div className="rounded-xl p-4" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}>
                <h3 className="font-bold">Market Data Sync</h3>
                <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                  Downloads M1 candles (2010–today) year-by-year per symbol and stores them in Supabase Storage.
                  Each year takes ~5–15 s. Total: ~{SYNC_SYMBOLS.length * ALL_YEARS.length} requests.
                </p>

                <div className="mt-3 flex gap-2">
                  <Button variant="primary" loading={syncingData} onClick={syncAllMarketData}>
                    {syncingData ? `Syncing… (${syncDone}/${syncTotal})` : 'Sync All Market Data'}
                  </Button>
                  {syncingData && (
                    <Button variant="danger" onClick={cancelSync}>Cancel</Button>
                  )}
                </div>

                {syncProgress.length > 0 && (
                  <div className="mt-4 grid gap-1" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
                    {syncProgress.map(p => (
                      <div key={p.symbol} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
                        style={{ background: 'var(--bg-secondary)' }}>
                        <span className="font-mono font-bold w-16" style={{ color: 'var(--text-primary)' }}>{p.symbol}</span>
                        {p.status === 'pending' && (
                          <span style={{ color: 'var(--text-muted)' }}>waiting…</span>
                        )}
                        {p.status === 'syncing' && (
                          <span style={{ color: 'var(--accent)' }}>
                            ⟳ {p.currentYear} ({p.doneYears}/{p.totalYears} yrs)
                          </span>
                        )}
                        {p.status === 'done' && (
                          <span style={{ color: 'var(--green)' }}>
                            ✓ {p.totalCandles.toLocaleString()} candles
                          </span>
                        )}
                        {p.status === 'error' && (
                          <span style={{ color: 'var(--red)' }} title={p.error}>✗ {p.error}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {syncProgress.length > 0 && !syncingData && syncErrors > 0 && (
                  <p className="mt-3 text-sm" style={{ color: 'var(--red)' }}>
                    {syncErrors} symbol(s) failed. Click Sync again to retry.
                  </p>
                )}
              </div>

              {/* Gift Subscription */}
              <div className="rounded-xl p-4" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}>
                <h3 className="font-bold">Gift Subscription</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button loading={saving === 'gift-1'}        onClick={() => updateSubscription('gift', 1)}>Gift 1 Month</Button>
                  <Button loading={saving === 'gift-3'}        onClick={() => updateSubscription('gift', 3)}>Gift 3 Months</Button>
                  <Button loading={saving === 'gift-6'}        onClick={() => updateSubscription('gift', 6)}>Gift 6 Months</Button>
                  <Button loading={saving === 'gift-lifetime'} onClick={() => updateSubscription('gift', undefined, true)}>Gift Lifetime</Button>
                </div>
              </div>

              {/* Manage Access */}
              <div className="rounded-xl p-4" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}>
                <h3 className="font-bold">Manage Access</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button loading={saving === 'extend-1'}        onClick={() => updateSubscription('extend', 1)}>Extend 1 Month</Button>
                  <Button loading={saving === 'extend-3'}        onClick={() => updateSubscription('extend', 3)}>Extend 3 Months</Button>
                  <Button loading={saving === 'extend-12'}       onClick={() => updateSubscription('extend', 12)}>Extend 1 Year</Button>
                  <Button variant="danger" loading={saving === 'cancel-default'} onClick={() => updateSubscription('cancel')}>Cancel Access</Button>
                </div>
              </div>

              {/* Payments */}
              <div className="rounded-xl p-4" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}>
                <h3 className="font-bold">Payments</h3>
                {selected.transactions.length === 0 ? (
                  <p className="mt-3 text-sm" style={{ color: 'var(--text-muted)' }}>No transactions yet.</p>
                ) : (
                  <div className="mt-3 flex flex-col gap-2">
                    {selected.transactions.slice(0, 8).map(tx => (
                      <div key={tx.id} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2"
                        style={{ background: 'var(--bg-secondary)' }}>
                        <div>
                          <p className="text-sm font-semibold">{Number(tx.amount || 0).toLocaleString()} {tx.currency}</p>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {new Date(tx.created_at).toLocaleString()} · {tx.payment_method?.toUpperCase()} {tx.card_last4}
                          </p>
                        </div>
                        <Badge variant={tx.status === 'authorized' ? 'green' : tx.status === 'pending' ? 'blue' : 'red'}>
                          {tx.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl px-4 py-3" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}>
      <p className="text-[11px] uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="mt-2 text-sm font-semibold break-words">{value}</p>
    </div>
  )
}
