'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import type { Session, Trade } from '@/types'
import { computeStats, fmtMoney } from '@/lib/utils'
import { Spinner } from '@/components/ui'
import { EquityCurveChart } from '@/components/analytics/EquityCurveChart'
import { DayPerformanceChart } from '@/components/analytics/DayPerformanceChart'

const PAGE_SIZE_OPTIONS = [5, 10, 20]

export default function AnalyticsPage() {
  const { user } = useAuth()
  const router   = useRouter()
  const [sessions,  setSessions]  = useState<Session[]>([])
  const [activeId,  setActiveId]  = useState<string | null>(null)
  const [trades,    setTrades]    = useState<Trade[]>([])
  const [loading,   setLoading]   = useState(false)
  const [sessLoad,  setSessLoad]  = useState(true)
  const [page,      setPage]      = useState(1)
  const [pageSize,  setPageSize]  = useState(5)

  useEffect(() => { if (user) fetchSessions() }, [user])

  async function fetchSessions() {
    const { data } = await createClient().from('sessions').select('*').order('created_at', { ascending: false })
    const list = (data as Session[]) ?? []
    setSessions(list)
    setSessLoad(false)
    if (list.length > 0) loadSession(list[0].id)
  }

  async function loadSession(id: string) {
    setActiveId(id); setLoading(true); setPage(1)
    const { data } = await createClient().from('trades').select('*').eq('session_id', id).order('created_at', { ascending: false })
    setTrades((data as Trade[]) ?? [])
    setLoading(false)
  }

  const activeSess  = sessions.find(s => s.id === activeId)
  const closedTrades = trades.filter(t => t.status === 'closed')
  const stats        = activeSess ? computeStats(trades, activeSess.start_capital) : null

  // Monthly PnL grouped by month
  const monthlyPnl = closedTrades.reduce<Record<string, number>>((acc, tr) => {
    const d   = new Date(tr.created_at)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    acc[key]  = (acc[key] ?? 0) + (tr.pnl ?? 0)
    return acc
  }, {})

  // Days remaining
  const daysRemaining = activeSess
    ? Math.max(0, Math.ceil((new Date(activeSess.end_date).getTime() - Date.now()) / 86400000))
    : 0

  // Gain/Loss filters
  const now        = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const startOfWk  = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).getTime()
  const startOfMo  = new Date(now.getFullYear(), now.getMonth(), 1).getTime()

  const pnlSince = (since: number) =>
    closedTrades.filter(t => new Date(t.created_at).getTime() >= since)
      .reduce((a, t) => a + (t.pnl ?? 0), 0)

  const dailyPnl   = pnlSince(startOfDay)
  const weeklyPnl  = pnlSince(startOfWk)
  const monthlyPnlSum = pnlSince(startOfMo)

  // Pagination
  const totalPages  = Math.max(1, Math.ceil(closedTrades.length / pageSize))
  const pagedTrades = closedTrades.slice((page - 1) * pageSize, page * pageSize)

  if (sessLoad) {
    return <div className="flex items-center justify-center h-full"><Spinner size="lg" /></div>
  }

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="text-4xl">📊</div>
        <p style={{ color: 'var(--text-muted)' }}>No sessions yet. Create one to see analytics.</p>
        <button onClick={() => router.push('/dashboard/sessions')} style={{
          padding: '8px 20px', borderRadius: 8, background: 'var(--accent)', color: '#fff',
          border: 'none', cursor: 'pointer', fontWeight: 600,
        }}>Go to Sessions</button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--bg-primary)' }}>

      {/* Session tabs */}
      <div className="flex gap-2 px-6 pt-4 pb-0 overflow-x-auto shrink-0 flex-wrap">
        {sessions.map(s => (
          <button key={s.id} onClick={() => loadSession(s.id)} style={{
            padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500,
            cursor: 'pointer', transition: 'all 0.15s', border: 'none',
            background: activeId === s.id ? 'var(--accent)' : 'var(--bg-secondary)',
            color: activeId === s.id ? '#fff' : 'var(--text-muted)',
          }}>{s.name}</button>
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-4">

        {loading && <div className="flex items-center justify-center h-48"><Spinner /></div>}

        {!loading && activeSess && (
          <div className="flex flex-col gap-4 animate-fade-in">

            {/* ── Top row: session info + description ── */}
            <div className="grid grid-cols-1 gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>

              {/* Session card */}
              <div className="rounded-2xl p-6" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                <h2 className="font-black text-2xl mb-1" style={{ color: 'var(--text-primary)' }}>{activeSess.name}</h2>
                <p className="text-sm mb-1" style={{ color: 'var(--text-muted)' }}>
                  No strategy · {activeSess.symbol}
                </p>
                <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
                  {new Date(activeSess.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} &nbsp;–&nbsp;
                  {new Date(activeSess.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  &nbsp;
                  <span style={{
                    background: 'rgba(245,158,11,0.15)', color: '#f59e0b',
                    borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 600,
                  }}>● {daysRemaining} days remaining</span>
                </p>
                <div className="flex items-end justify-between mt-4">
                  <div>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Account balance</p>
                    <p className="font-black text-3xl" style={{ color: 'var(--text-primary)' }}>
                      {fmtMoney(activeSess.end_capital)}
                    </p>
                  </div>
                  <button
                    onClick={() => router.push(`/workspace/${activeSess.id}`)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '10px 20px', borderRadius: 10,
                      background: 'var(--accent)', color: '#fff',
                      border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14,
                    }}>
                    Go to chart ▶
                  </button>
                </div>
              </div>

              {/* Description card */}
              <div className="rounded-2xl p-6 flex flex-col" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                <div className="flex justify-between items-start">
                  <h3 className="font-bold text-xl" style={{ color: 'var(--text-primary)' }}>Description</h3>
                  <button style={{
                    width: 36, height: 36, borderRadius: '50%', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    background: 'var(--bg-tertiary)', border: 'none', cursor: 'pointer',
                    color: 'var(--text-muted)', fontSize: 16,
                  }}>✏</button>
                </div>
                <p className="text-sm mt-3" style={{ color: 'var(--text-muted)' }}>
                  {stats
                    ? `${stats.totalTrades} trades closed · ${stats.wins} wins · ${stats.losses} losses`
                    : 'No closed trades yet.'}
                </p>
              </div>
            </div>

            {/* ── Charts row ── */}
            <div className="grid grid-cols-3 gap-4">
              {/* Equity Curve */}
              <div className="rounded-2xl p-5" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                <h3 className="font-semibold text-sm mb-3" style={{ color: 'var(--text-primary)' }}>Equity Curve</h3>
                {stats ? (
                  <EquityCurveChart equity={stats.equity} startCapital={activeSess.start_capital} />
                ) : (
                  <NoData />
                )}
              </div>

              {/* Monthly Performance */}
              <div className="rounded-2xl p-5" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                <h3 className="font-semibold text-sm mb-3" style={{ color: 'var(--text-primary)' }}>Monthly Performance</h3>
                {Object.keys(monthlyPnl).length > 0 ? (
                  <MonthlyBarChart data={monthlyPnl} />
                ) : (
                  <NoData />
                )}
              </div>

              {/* Daily Performance */}
              <div className="rounded-2xl p-5" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                <h3 className="font-semibold text-sm mb-3" style={{ color: 'var(--text-primary)' }}>Daily Performance</h3>
                {stats ? (
                  <DayPerformanceChart byDay={stats.byDay} />
                ) : (
                  <NoData />
                )}
              </div>
            </div>

            {/* ── Stat cards ── */}
            <div className="grid grid-cols-6 gap-3">
              {[
                { label: 'Total PnL',       value: stats ? fmtMoney(stats.totalPnl)          : '—', color: stats && stats.totalPnl >= 0 ? 'var(--green)' : 'var(--red)' },
                { label: 'Win Rate',         value: stats ? `${stats.winRate}%`               : '—', color: stats && stats.winRate >= 50 ? 'var(--green)' : 'var(--red)' },
                { label: 'Risk/Reward',      value: stats ? stats.avgRR.toFixed(2)            : '0', color: 'var(--text-primary)' },
                { label: 'Month Gain/Loss',  value: fmtMoney(monthlyPnlSum),                         color: monthlyPnlSum >= 0 ? 'var(--green)' : 'var(--red)' },
                { label: 'Week Gain/Loss',   value: fmtMoney(weeklyPnl),                             color: weeklyPnl >= 0 ? 'var(--green)' : 'var(--red)' },
                { label: 'Daily Gain/Loss',  value: fmtMoney(dailyPnl),                              color: dailyPnl >= 0 ? 'var(--green)' : 'var(--red)' },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-2xl p-5"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                  <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>{label}</p>
                  <p className="font-black text-xl" style={{ color }}>{value}</p>
                </div>
              ))}
            </div>

            {/* ── Recent Trades ── */}
            <div className="rounded-2xl" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center justify-between px-6 pt-5 pb-3">
                <h3 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>Recent Trades</h3>
                <button style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 500,
                  background: 'var(--bg-tertiary)', border: '1px solid var(--border-default)',
                  color: 'var(--text-muted)', cursor: 'pointer',
                }}>📋 Journal</button>
              </div>

              {closedTrades.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-sm" style={{ color: 'var(--text-muted)' }}>
                  No closed trades yet
                </div>
              ) : (
                <>
                  <table className="w-full">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        {['Name', 'Side', 'Date', 'Symbol', 'Entry', 'Exit', 'ROI'].map(h => (
                          <th key={h} className="text-left px-6 py-3 text-xs font-normal uppercase tracking-widest"
                            style={{ color: 'var(--text-muted)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pagedTrades.map((tr, i) => (
                        <tr key={tr.id} style={{ borderBottom: i < pagedTrades.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                          <td className="px-6 py-4 text-sm" style={{ color: 'var(--text-primary)' }}>{activeSess.name}</td>
                          <td className="px-6 py-4">
                            <span style={{
                              fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                              background: tr.side === 'buy' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                              color: tr.side === 'buy' ? 'var(--green)' : 'var(--red)',
                            }}>{tr.side.toUpperCase()}</span>
                          </td>
                          <td className="px-6 py-4 text-sm" style={{ color: 'var(--text-muted)' }}>
                            {new Date(tr.created_at).toLocaleString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit', hour: 'numeric', minute: '2-digit' })}
                          </td>
                          <td className="px-6 py-4 text-sm font-mono" style={{ color: 'var(--text-primary)' }}>{activeSess.symbol}</td>
                          <td className="px-6 py-4 text-sm font-mono" style={{ color: 'var(--text-muted)' }}>{tr.entry_price.toFixed(2)}</td>
                          <td className="px-6 py-4 text-sm font-mono" style={{ color: 'var(--text-muted)' }}>{tr.exit_price?.toFixed(2) ?? '—'}</td>
                          <td className="px-6 py-4 text-sm font-semibold font-mono" style={{ color: (tr.pnl ?? 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                            {(tr.pnl ?? 0) >= 0 ? '+' : ''}{fmtMoney(tr.pnl ?? 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Pagination */}
                  <div className="flex items-center justify-between px-6 py-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                      Rows per page
                      <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}
                        style={{ padding: '4px 8px', borderRadius: 20, fontSize: 13, background: 'var(--bg-tertiary)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', cursor: 'pointer' }}>
                        {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                    <div className="flex items-center gap-3 text-sm" style={{ color: 'var(--text-muted)' }}>
                      <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                        style={{ background: 'none', border: 'none', cursor: page === 1 ? 'default' : 'pointer', opacity: page === 1 ? 0.3 : 1, fontSize: 18, color: 'var(--text-primary)' }}>‹</button>
                      <span style={{ padding: '4px 12px', borderRadius: 20, background: 'var(--bg-tertiary)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', minWidth: 40, textAlign: 'center' }}>
                        {page}
                      </span>
                      <span>of {totalPages}</span>
                      <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                        style={{ background: 'none', border: 'none', cursor: page === totalPages ? 'default' : 'pointer', opacity: page === totalPages ? 0.3 : 1, fontSize: 18, color: 'var(--text-primary)' }}>›</button>
                    </div>
                  </div>
                </>
              )}
            </div>

          </div>
        )}

        {!loading && !activeSess && (
          <div className="flex items-center justify-center h-48 text-sm" style={{ color: 'var(--text-muted)' }}>
            Select a session above
          </div>
        )}
      </div>
    </div>
  )
}

// ── Monthly bar chart ─────────────────────────────────────────────
function MonthlyBarChart({ data }: { data: Record<string, number> }) {
  const entries  = Object.entries(data).sort(([a], [b]) => a.localeCompare(b))
  const maxAbs   = Math.max(...entries.map(([, v]) => Math.abs(v)), 1)
  const labels   = entries.map(([k]) => {
    const [y, m] = k.split('-')
    return new Date(+y, +m - 1).toLocaleDateString('en-US', { month: 'short' })
  })

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 160, paddingBottom: 20, position: 'relative' }}>
      {/* Zero line */}
      <div style={{ position: 'absolute', bottom: 20, left: 0, right: 0, height: 1, background: 'var(--border-subtle)' }} />
      {entries.map(([key, val], i) => {
        const isPos   = val >= 0
        const pct     = Math.abs(val) / maxAbs
        const barH    = Math.max(4, pct * 100)
        return (
          <div key={key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, justifyContent: 'flex-end', height: '100%', paddingBottom: 20 }}>
            <div style={{
              width: '80%', height: barH,
              background: isPos ? 'var(--green)' : 'var(--red)',
              borderRadius: 3, opacity: 0.85,
              alignSelf: 'flex-end',
            }} title={`${labels[i]}: ${fmtMoney(val)}`} />
            <span style={{ fontSize: 9, color: 'var(--text-muted)', position: 'absolute', bottom: 4 }}>{labels[i]}</span>
          </div>
        )
      })}
    </div>
  )
}

function NoData() {
  return (
    <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
      No data yet
    </div>
  )
}
