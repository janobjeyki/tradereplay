'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import type { Strategy, Session, Trade } from '@/types'
import { computeStats, fmtMoney } from '@/lib/utils'
import { Spinner, Button, Modal, Input, Alert } from '@/components/ui'

const STRATEGY_COLORS = [
  '#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444','#06b6d4','#f97316','#ec4899',
]

export default function StrategyPage() {
  const { user } = useAuth()
  const [strategies, setStrategies] = useState<Strategy[]>([])
  const [loading,    setLoading]    = useState(true)
  const [showModal,  setShowModal]  = useState(false)
  const [selected,   setSelected]   = useState<Strategy | null>(null)
  const [sessions,   setSessions]   = useState<Session[]>([])
  const [trades,     setTrades]     = useState<Trade[]>([])
  const [statsLoad,  setStatsLoad]  = useState(false)

  useEffect(() => { if (user) load() }, [user])

  async function load() {
    const db = createClient()
    const { data } = await db.from('strategies').select('*').order('created_at', { ascending: false })
    setStrategies((data as Strategy[]) ?? [])
    setLoading(false)
  }

  async function selectStrategy(s: Strategy) {
    setSelected(s)
    setStatsLoad(true)
    const db = createClient()
    const { data: sess } = await db.from('sessions').select('*').eq('strategy_id', s.id)
    const sessData = (sess as Session[]) ?? []
    setSessions(sessData)
    if (sessData.length > 0) {
      const ids = sessData.map(s => s.id)
      const { data: tr } = await db.from('trades').select('*').in('session_id', ids)
      setTrades((tr as Trade[]) ?? [])
    } else {
      setTrades([])
    }
    setStatsLoad(false)
  }

  async function deleteStrategy(id: string) {
    if (!confirm('Delete this strategy? Sessions will be unlinked but not deleted.')) return
    await createClient().from('strategies').delete().eq('id', id)
    if (selected?.id === id) { setSelected(null); setSessions([]); setTrades([]) }
    load()
  }

  const stats = selected && sessions.length > 0
    ? computeStats(trades, sessions.reduce((a, s) => a + s.start_capital, 0) / sessions.length)
    : null

  const totalPnl    = trades.filter(t => t.status === 'closed').reduce((a, t) => a + (t.pnl ?? 0), 0)
  const closedCount = trades.filter(t => t.status === 'closed').length

  if (loading) return <div className="flex items-center justify-center h-full"><Spinner size="lg" /></div>

  return (
    <div className="flex h-full overflow-hidden">

      {/* Left: Strategy list */}
      <div className="w-72 shrink-0 flex flex-col border-r" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <h2 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>Strategies</h2>
          <button onClick={() => setShowModal(true)} style={{
            width: 28, height: 28, borderRadius: 8, border: 'none',
            background: 'var(--accent)', color: '#fff', cursor: 'pointer',
            fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
          }}>+</button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {strategies.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-3xl mb-3">🎯</div>
              <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>No strategies yet</p>
              <button onClick={() => setShowModal(true)} style={{
                padding: '6px 14px', borderRadius: 8, background: 'var(--accent)',
                color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              }}>Create Strategy</button>
            </div>
          ) : strategies.map(s => (
            <button key={s.id} onClick={() => selectStrategy(s)}
              className="w-full text-left rounded-xl px-4 py-3 mb-1.5 transition-all"
              style={{
                background: selected?.id === s.id ? 'var(--accent-muted)' : 'var(--bg-tertiary)',
                border: `1px solid ${selected?.id === s.id ? 'var(--accent-border)' : 'transparent'}`,
              }}>
              <div className="flex items-center gap-3">
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                <span className="font-semibold text-sm flex-1 truncate" style={{ color: 'var(--text-primary)' }}>{s.name}</span>
              </div>
              {s.description && (
                <p className="text-xs mt-1 ml-[22px] truncate" style={{ color: 'var(--text-muted)' }}>{s.description}</p>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Right: Strategy detail */}
      <div className="flex-1 overflow-y-auto p-6">
        {!selected && (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="text-5xl">🎯</div>
            <p className="font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>Select a strategy</p>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Pick a strategy from the left to see its performance</p>
          </div>
        )}

        {selected && (
          <div className="flex flex-col gap-5 animate-fade-in max-w-5xl">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div style={{ width: 14, height: 14, borderRadius: '50%', background: selected.color }} />
                <div>
                  <h1 className="font-black text-2xl" style={{ color: 'var(--text-primary)' }}>{selected.name}</h1>
                  {selected.description && (
                    <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{selected.description}</p>
                  )}
                </div>
              </div>
              <button onClick={() => deleteStrategy(selected.id)} style={{
                padding: '6px 14px', borderRadius: 8, fontSize: 13,
                background: 'none', border: '1px solid var(--red-muted)', color: 'var(--red)', cursor: 'pointer',
              }}>Delete</button>
            </div>

            {statsLoad && <div className="flex items-center justify-center h-32"><Spinner /></div>}

            {!statsLoad && (
              <>
                {/* Stat cards */}
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: 'Total PnL',    value: fmtMoney(totalPnl),        color: totalPnl >= 0 ? 'var(--green)' : 'var(--red)' },
                    { label: 'Sessions',     value: String(sessions.length),    color: 'var(--text-primary)' },
                    { label: 'Total Trades', value: String(closedCount),        color: 'var(--text-primary)' },
                    { label: 'Win Rate',     value: stats ? `${stats.winRate}%` : '—', color: stats && stats.winRate >= 50 ? 'var(--green)' : 'var(--red)' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="rounded-xl p-5" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                      <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>{label}</p>
                      <p className="font-black text-2xl" style={{ color }}>{value}</p>
                    </div>
                  ))}
                </div>

                {/* Sessions using this strategy */}
                <div className="rounded-xl" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                  <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                    <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                      Sessions using this strategy ({sessions.length})
                    </h3>
                  </div>
                  {sessions.length === 0 ? (
                    <div className="flex items-center justify-center py-10 text-sm" style={{ color: 'var(--text-muted)' }}>
                      No sessions linked to this strategy yet.<br/>
                      <span style={{ color: 'var(--accent)', marginLeft: 4 }}>Create a session and select this strategy.</span>
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          {['Name', 'Period', 'Start $', 'End $', 'Trades', 'PnL'].map(h => (
                            <th key={h} className="text-left px-5 py-3 text-xs font-normal uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sessions.map((sess, i) => {
                          const sessTrades = trades.filter(t => t.session_id === sess.id && t.status === 'closed')
                          const sessPnl    = sessTrades.reduce((a, t) => a + (t.pnl ?? 0), 0)
                          return (
                            <tr key={sess.id} style={{ borderBottom: i < sessions.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                              <td className="px-5 py-3.5 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{sess.name}</td>
                              <td className="px-5 py-3.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                                {new Date(sess.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {new Date(sess.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                              </td>
                              <td className="px-5 py-3.5 text-sm font-mono" style={{ color: 'var(--text-muted)' }}>{fmtMoney(sess.start_capital)}</td>
                              <td className="px-5 py-3.5 text-sm font-mono" style={{ color: sess.end_capital >= sess.start_capital ? 'var(--green)' : 'var(--red)' }}>{fmtMoney(sess.end_capital)}</td>
                              <td className="px-5 py-3.5 text-sm" style={{ color: 'var(--text-muted)' }}>{sessTrades.length}</td>
                              <td className="px-5 py-3.5 text-sm font-semibold font-mono" style={{ color: sessPnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                                {sessPnl >= 0 ? '+' : ''}{fmtMoney(sessPnl)}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {showModal && (
        <CreateStrategyModal
          onClose={() => setShowModal(false)}
          onCreate={() => { setShowModal(false); load() }}
        />
      )}
    </div>
  )
}

function CreateStrategyModal({ onClose, onCreate }: { onClose: () => void; onCreate: () => void }) {
  const { user }    = useAuth()
  const [name,  setName]   = useState('')
  const [desc,  setDesc]   = useState('')
  const [color, setColor]  = useState(STRATEGY_COLORS[0])
  const [error, setError]  = useState('')
  const [saving,setSaving] = useState(false)

  async function handleCreate() {
    if (!name.trim()) { setError('Strategy name is required'); return }
    setSaving(true)
    const { error: err } = await createClient().from('strategies').insert({
      user_id: user!.id, name: name.trim(), description: desc.trim() || null, color,
    })
    if (err) { setError(err.message); setSaving(false); return }
    onCreate()
  }

  return (
    <Modal open title="Create Strategy" onClose={onClose} width="max-w-md">
      <div className="flex flex-col gap-4">
        {error && <Alert type="error" message={error} />}
        <Input label="Strategy Name" placeholder="e.g. Breakout scalping" value={name} onChange={e => { setName(e.target.value); setError('') }} />
        <div>
          <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Description (optional)</p>
          <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2}
            placeholder="What is this strategy about?"
            className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none"
            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />
        </div>
        <div>
          <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Color</p>
          <div className="flex gap-2 flex-wrap">
            {STRATEGY_COLORS.map(c => (
              <button key={c} onClick={() => setColor(c)} style={{
                width: 24, height: 24, borderRadius: '50%', background: c, border: 'none', cursor: 'pointer',
                outline: color === c ? `3px solid ${c}` : 'none', outlineOffset: 2,
              }} />
            ))}
          </div>
        </div>
        <div className="flex gap-3 pt-1">
          <Button variant="ghost" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button variant="primary" className="flex-[2]" loading={saving} onClick={handleCreate}>Create Strategy</Button>
        </div>
      </div>
    </Modal>
  )
}
