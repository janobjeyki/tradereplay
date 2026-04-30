'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useLang } from '@/contexts/LangContext'
import type { Session, Strategy } from '@/types'
import { Button, Badge, Spinner, Modal, Input, Alert } from '@/components/ui'

export default function SessionsPage() {
  const PAGE_SIZE = 8
  const { t }    = useLang()
  const { user, profile, loading: authLoading } = useAuth()
  const router   = useRouter()
  const [sessions,  setSessions]  = useState<Session[]>([])
  const [loading,   setLoading]   = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [accessError, setAccessError] = useState('')
  const [page, setPage] = useState(1)
  const hasActiveSubscription = profile?.subscription_status === 'active'

  const totalPages = Math.max(1, Math.ceil(sessions.length / PAGE_SIZE))
  const pagedSessions = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return sessions.slice(start, start + PAGE_SIZE)
  }, [page, sessions])

  useEffect(() => {
    if (user) {
      fetchSessions()
    }
  }, [user])

  useEffect(() => {
    setPage(prev => Math.min(prev, totalPages))
  }, [totalPages])

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

  function openCreateFlow() {
    if (authLoading) return
    if (!hasActiveSubscription) {
      setAccessError('Subscription required to create replay sessions. Activate billing or ask an admin to gift access.')
      return
    }
    setAccessError('')
    setShowModal(true)
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
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {sessions.length} session{sessions.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button variant="primary" size="lg" disabled={authLoading} onClick={openCreateFlow}>
          <span className="text-lg leading-none mr-0.5">+</span>{t('newSession')}
        </Button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-7 py-5">
        {accessError && (
          <div className="mb-5 rounded-2xl p-4" style={{ background: 'var(--red-muted)', border: '1px solid rgba(255,107,149,0.2)' }}>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <p className="text-sm font-medium" style={{ color: 'var(--red)' }}>{accessError}</p>
              <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/subscription')}>
                Open Subscription
              </Button>
            </div>
          </div>
        )}
        {loading ? (
          <div className="flex items-center justify-center h-40"><Spinner /></div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-20 animate-fade-in">
            <div className="text-5xl mb-4">📊</div>
            <h3 className="font-bold text-lg mb-2" style={{ color: 'var(--text-primary)' }}>{t('noSessions')}</h3>
            <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>{t('noSessionsBody')}</p>
            <Button variant="primary" onClick={openCreateFlow}>+ {t('newSession')}</Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 animate-fade-in">
            {/* Column headers */}
            <div className="grid px-4 pb-1 gap-2"
              style={{ gridTemplateColumns: '2fr 112px 172px 96px 112px 70px 100px 84px' }}>
              {['Session', t('symbol'), t('period'), t('startCap'), t('endCap'), t('winRate'), '', ''].map((h, i) => (
                <span key={i} className="text-[10px] uppercase tracking-widest"
                  style={{ color: 'var(--text-muted)' }}>{h}</span>
              ))}
            </div>

            {pagedSessions.map(s => {
              const isProfit = s.end_capital >= s.start_capital
              const winRate  = (s as any).win_rate ?? 0
              return (
                <div key={s.id}
                  onClick={() => router.push(`/workspace/${s.id}`)}
                  className="rounded-2xl px-4 py-4 cursor-pointer transition-all duration-150"
                  style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-subtle)',
                    display: 'grid',
                    gridTemplateColumns: '2fr 112px 172px 96px 112px 70px 100px 84px',
                    gap: '8px',
                    alignItems: 'center',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-border)'
                    ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)'
                    ;(e.currentTarget as HTMLElement).style.transform = 'translateY(0)'
                  }}
                >
                  <div>
                    <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{s.name}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {s.is_completed ? '✓ Completed' : s.candle_index > 0 ? `Candle ${s.candle_index}` : 'Not started'}
                    </p>
                  </div>
                  <div className="flex justify-center">
                    <Badge variant="blue" className="justify-center text-center whitespace-nowrap w-full max-w-[110px]">{s.symbol}</Badge>
                  </div>
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
                  <Button size="sm" variant="ghost" className="font-semibold"
                    onClick={e => { e.stopPropagation(); router.push(`/workspace/${s.id}`) }}>
                    {t('openSession')}
                  </Button>
                  <Button size="sm" variant="ghost" className="font-semibold"
                    onClick={e => { e.stopPropagation(); deleteSession(s.id) }}
                    style={{color: 'var(--red)', border: '1px solid var(--red-muted)'}}>
                    Delete
                  </Button>
                </div>
              )
            })}

            {sessions.length > PAGE_SIZE && (
              <div className="flex items-center justify-between pt-3">
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Showing {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, sessions.length)} of {sessions.length}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={page === 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                  >
                    Prev
                  </Button>
                  <span className="text-xs font-medium min-w-[72px] text-center" style={{ color: 'var(--text-secondary)' }}>
                    {page} / {totalPages}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={page === totalPages}
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
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
  const [symbol,     setSymbol]     = useState('XAUUSD')
  const [sd,         setSd]         = useState('2010-01-01')
  const [ed,         setEd]         = useState(new Date().toISOString().slice(0, 10))
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

  function createSessionError(message: string) {
    if (message.toLowerCase().includes('row-level security')) {
      return 'Subscription required to create replay sessions. Activate billing or ask an admin to gift access.'
    }
    return message
  }

  async function handleCreate() {
    if (!name.trim())         { setError(t('fillAllFields')); return }
    if (parseFloat(cap) <= 0) { setError(t('capitalPositive')); return }
    if (sd >= ed)             { setError(t('dateRangeInvalid')); return }
    setSaving(true); setError('')
    const { data, error: err } = await createClient().from('sessions').insert({
      user_id:       user!.id,
      name:          name.trim(),
      symbol,
      start_date:    sd,
      end_date:      ed,
      start_capital: parseFloat(cap),
      end_capital:   parseFloat(cap),
      candle_index:  0,
      strategy_id:   strategyId || null,
    }).select()
    if (err) { setError(createSessionError(err.message)); setSaving(false); return }
    const sessionId = (data?.[0] as any)?.id
    if (sessionId) onCreate(sessionId)
    else setSaving(false)
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
              <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Market Pair</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Dukascopy H1 data saved locally from 2010-01-01 to present</p>
            </div>
            <Badge variant="blue">{symbol}</Badge>
          </div>
        </div>

        <div>
          <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Pair</p>
          <select value={symbol} onChange={e => setSymbol(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}>
            {['XAUUSD','EURUSD','GBPUSD','USDJPY','USDCHF','AUDUSD','USDCAD','NZDUSD','EURGBP','EURJPY','GBPJPY','EURAUD','EURCAD','GBPAUD','GBPCAD'].map(sym => (
              <option key={sym} value={sym}>{sym}</option>
            ))}
          </select>
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
            min="2010-01-01"
            max={ed}
            onChange={e => { setSd(e.target.value); setError('') }}
          />
          <Input
            label={t('endDate')}
            type="date"
            value={ed}
            min={sd}
            max={new Date().toISOString().slice(0, 10)}
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
