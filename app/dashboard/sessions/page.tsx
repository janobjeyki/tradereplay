'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useLang } from '@/contexts/LangContext'
import type { Session, Strategy } from '@/types'
import { Button, Badge, Spinner, Modal, Input, Alert } from '@/components/ui'

export default function SessionsPage() {
  const { t }    = useLang()
  const { user } = useAuth()
  const router   = useRouter()
  const [sessions,  setSessions]  = useState<Session[]>([])
  const [loading,   setLoading]   = useState(true)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => { if (user) fetchSessions() }, [user])

  async function fetchSessions() {
    const { data } = await createClient()
      .from('sessions').select('*').order('created_at', { ascending: false })
    setSessions((data as Session[]) ?? [])
    setLoading(false)
  }

  async function deleteSession(sessionId: string) {
    if (!confirm('Are you sure you want to delete this session? This cannot be undone.')) return
    
    await createClient().from('sessions').delete().eq('id', sessionId)
    await createClient().from('trades').delete().eq('session_id', sessionId)
    fetchSessions()
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-center px-7 py-5 shrink-0"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <div>
          <h1 className="font-black text-2xl tracking-tight" style={{ color: 'var(--text-primary)' }}>
            {t('sessions')}
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {sessions.length} session{sessions.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowModal(true)}>
          <span className="text-lg leading-none mr-0.5">+</span>{t('newSession')}
        </Button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-7 py-5">
        {loading ? (
          <div className="flex items-center justify-center h-40"><Spinner /></div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-20 animate-fade-in">
            <div className="text-5xl mb-4">📊</div>
            <h3 className="font-bold text-lg mb-2" style={{ color: 'var(--text-primary)' }}>{t('noSessions')}</h3>
            <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>{t('noSessionsBody')}</p>
            <Button variant="primary" onClick={() => setShowModal(true)}>+ {t('newSession')}</Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 animate-fade-in">
            {/* Column headers */}
            <div className="grid px-4 pb-1 gap-2"
              style={{ gridTemplateColumns: '2fr 90px 160px 90px 100px 70px 100px 80px' }}>
              {['Session', t('symbol'), t('period'), t('startCap'), t('endCap'), t('winRate'), '', ''].map((h, i) => (
                <span key={i} className="text-[10px] uppercase tracking-widest"
                  style={{ color: 'var(--text-muted)' }}>{h}</span>
              ))}
            </div>

            {sessions.map(s => {
              const isProfit = s.end_capital >= s.start_capital
              const winRate  = (s as any).win_rate ?? 0
              return (
                <div key={s.id}
                  onClick={() => router.push(`/workspace/${s.id}`)}
                  className="rounded-xl px-4 py-3.5 cursor-pointer transition-all duration-150"
                  style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-subtle)',
                    display: 'grid',
                    gridTemplateColumns: '2fr 90px 160px 90px 100px 70px 100px 80px',
                    gap: '8px',
                    alignItems: 'center',
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-border)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)'}
                >
                  <div>
                    <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{s.name}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {s.is_completed ? '✓ Completed' : s.candle_index > 0 ? `Candle ${s.candle_index}` : 'Not started'}
                    </p>
                  </div>
                  <Badge variant="blue">{s.symbol}</Badge>
                  <span className="font-mono text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                    {s.start_date}<br />{s.end_date}
                  </span>
                  <span className="font-mono text-sm" style={{ color: 'var(--text-primary)' }}>
                    ${s.start_capital.toLocaleString()}
                  </span>
                  <Badge variant={isProfit ? 'green' : 'red'}>
                    ${s.end_capital.toLocaleString()}
                  </Badge>
                  <span className="font-mono text-sm" style={{
                    color: winRate >= 50 ? 'var(--green)' : winRate > 0 ? 'var(--red)' : 'var(--text-muted)',
                  }}>
                    {winRate > 0 ? winRate + '%' : '—'}
                  </span>
                  <Button size="sm" variant="ghost"
                    onClick={e => { e.stopPropagation(); router.push(`/workspace/${s.id}`) }}>
                    {t('openSession')}
                  </Button>
                  <Button size="sm" variant="ghost"
                    onClick={e => { e.stopPropagation(); deleteSession(s.id) }}
                    style={{color: 'var(--red)', border: '1px solid var(--red-muted)'}}>
                    Delete
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showModal && (
        <CreateSessionModal
          onClose={() => setShowModal(false)}
          onCreate={(sessionId) => { setShowModal(false); router.push(`/workspace/${sessionId}`) }}
        />
      )}
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────────
function CreateSessionModal({ onClose, onCreate }: { onClose: () => void; onCreate: (sessionId: string) => void }) {
  const { t }    = useLang()
  const { user } = useAuth()
  const [name,       setName]       = useState('')
  const [cap,        setCap]        = useState('10000')
  const [sd,         setSd]         = useState('2025-01-01')
  const [ed,         setEd]         = useState('2025-12-31')
  const [error,      setError]      = useState('')
  const [saving,     setSaving]     = useState(false)
  const [strategies, setStrategies] = useState<Strategy[]>([])
  const [strategyId, setStrategyId] = useState<string>('')

  useEffect(() => {
    if (user) {
      createClient().from('strategies').select('*').order('created_at', { ascending: false })
        .then(({ data }) => setStrategies((data as Strategy[]) ?? []))
    }
  }, [user])

  const totalDays   = Math.max(1, (new Date(ed).getTime() - new Date(sd).getTime()) / 86400000)
  const tradingDays = Math.round(totalDays * 5 / 7)
  const estCandles  = Math.round(tradingDays * 390)

  async function handleCreate() {
    if (!name.trim())         { setError(t('fillAllFields')); return }
    if (parseFloat(cap) <= 0) { setError(t('capitalPositive')); return }
    if (sd >= ed)             { setError(t('dateRangeInvalid')); return }
    setSaving(true); setError('')
    const { data, error: err } = await createClient().from('sessions').insert({
      user_id:       user!.id,
      name:          name.trim(),
      symbol:        'XAUUSD',
      start_date:    sd,
      end_date:      ed,
      start_capital: parseFloat(cap),
      end_capital:   parseFloat(cap),
      candle_index:  0,
      strategy_id:   strategyId || null,
    }).select()
    if (err) { setError(err.message); setSaving(false); return }
    const sessionId = (data?.[0] as any)?.id
    if (sessionId) onCreate(sessionId)
  }

  return (
    <Modal open title={t('createTitle')} onClose={onClose} width="max-w-md">
      <div className="flex flex-col gap-4">
        {error && <Alert type="error" message={error} />}

        <Input
          label={t('sessionName')}
          placeholder="e.g. XAUUSD Jan-2025 Strategy"
          value={name}
          onChange={e => { setName(e.target.value); setError('') }}
        />

        {/* Symbol card */}
        <div className="rounded-xl p-3.5" style={{
          background: 'var(--bg-tertiary)',
          border: '1px solid var(--border-subtle)',
        }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>XAU/USD (Gold)</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Dukascopy M1 bid · 354,387 candles available</p>
            </div>
            <Badge variant="blue">XAUUSD</Badge>
          </div>
        </div>

        {/* Strategy picker */}
        <div>
          <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Strategy (optional)</p>
          <select value={strategyId} onChange={e => setStrategyId(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}>
            <option value="">No strategy</option>
            {strategies.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        {/* Date range pickers */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label={t('startDate')}
            type="date"
            value={sd}
            min="2025-01-01"
            max={ed}
            onChange={e => { setSd(e.target.value); setError('') }}
          />
          <Input
            label={t('endDate')}
            type="date"
            value={ed}
            min={sd}
            max="2025-12-31"
            onChange={e => { setEd(e.target.value); setError('') }}
          />
        </div>

        {/* Estimated candles */}
        <p className="text-xs" style={{ color: 'var(--text-muted)', marginTop: '-4px' }}>
          <span style={{ color: 'var(--accent)' }}>~{estCandles.toLocaleString()}</span> estimated candles for selected range
        </p>

        <Input
          label={t('capitalLabel')}
          type="number" min="100" value={cap}
          onChange={e => { setCap(e.target.value); setError('') }}
        />

        <div className="flex gap-3 pt-1">
          <Button variant="ghost" className="flex-1" onClick={onClose}>{t('cancelBtn')}</Button>
          <Button variant="primary" className="flex-[2]" loading={saving} onClick={handleCreate}>
            {t('createBtn')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
