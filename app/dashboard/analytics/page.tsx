'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useLang } from '@/contexts/LangContext'
import type { Session, Trade } from '@/types'
import { StatCard, Spinner } from '@/components/ui'
import { EquityCurveChart } from '@/components/analytics/EquityCurveChart'
import { DayPerformanceChart } from '@/components/analytics/DayPerformanceChart'
import { computeStats, cn } from '@/lib/utils'

export default function AnalyticsPage() {
  const { t }    = useLang()
  const { user } = useAuth()
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeId, setActiveId] = useState<string|null>(null)
  const [trades,   setTrades]   = useState<Trade[]>([])
  const [loading,  setLoading]  = useState(false)
  const [sessLoad, setSessLoad] = useState(true)

  useEffect(() => { if (user) fetchSessions() }, [user])

  async function fetchSessions() {
    const { data } = await createClient().from('sessions').select('*').order('created_at',{ascending:false})
    setSessions((data as Session[]) ?? [])
    setSessLoad(false)
  }

  async function loadSession(id: string) {
    setActiveId(id); setLoading(true)
    const { data } = await createClient().from('trades').select('*').eq('session_id',id).order('created_at',{ascending:true})
    setTrades((data as Trade[]) ?? [])
    setLoading(false)
  }

  const activeSess = sessions.find(s => s.id === activeId)
  const stats      = activeSess ? computeStats(trades, activeSess.start_capital) : null

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-7 py-5 shrink-0" style={{borderBottom:'1px solid var(--border-subtle)'}}>
        <h1 className="font-black text-2xl tracking-tight" style={{color:'var(--text-primary)'}}>{t('analytics')}</h1>
      </div>

      {/* Session pills */}
      <div className="px-7 py-3 overflow-x-auto shrink-0" style={{borderBottom:'1px solid var(--border-subtle)'}}>
        {sessLoad ? <Spinner size="sm"/> : sessions.length === 0
          ? <p className="text-sm" style={{color:'var(--text-muted)'}}>{t('noSessions')}</p>
          : (
            <div className="flex gap-2 whitespace-nowrap">
              {sessions.map(s => (
                <button key={s.id} onClick={()=>loadSession(s.id)}
                  className="px-3.5 py-1.5 rounded-full text-sm font-medium transition-all"
                  style={{
                    background:  activeId===s.id ? 'var(--accent-muted)'  : 'transparent',
                    color:       activeId===s.id ? 'var(--accent)'        : 'var(--text-secondary)',
                    border:      `1px solid ${activeId===s.id ? 'var(--accent-border)' : 'var(--border-default)'}`,
                  }}>
                  {s.name}
                </button>
              ))}
            </div>
          )
        }
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-7 py-6">
        {!activeId && (
          <div className="flex items-center justify-center h-48 text-sm" style={{color:'var(--text-muted)'}}>{t('selectSession')}</div>
        )}
        {activeId && loading && <div className="flex items-center justify-center h-48"><Spinner/></div>}
        {activeId && !loading && !stats && (
          <div className="flex items-center justify-center h-48 text-sm" style={{color:'var(--text-muted)'}}>{t('noTradesYet')}</div>
        )}
        {activeId && !loading && stats && (
          <div className="animate-fade-in">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
              <StatCard label={t('totalPnl')}
                value={(stats.totalPnl>=0?'+$':'-$')+Math.abs(stats.totalPnl).toFixed(2)}
                color={stats.totalPnl>=0?'var(--green)':'var(--red)'}/>
              <StatCard label={t('winRateStat')} value={stats.winRate+'%'}
                color={stats.winRate>=50?'var(--green)':'var(--red)'}/>
              <StatCard label={t('profitFactor')} value={stats.profitFactor.toFixed(2)+'×'}
                color={stats.profitFactor>=1?'var(--green)':'var(--red)'}/>
              <StatCard label={t('avgRR')} value={stats.avgRR.toFixed(2)}
                color={stats.avgRR>=1?'var(--green)':'var(--text-primary)'}/>
              <StatCard label={t('totalTrades')} value={String(stats.totalTrades)}/>
            </div>
            <div className="rounded-xl p-5 mb-4" style={{background:'var(--bg-secondary)', border:'1px solid var(--border-subtle)'}}>
              <h3 className="text-sm font-semibold mb-4" style={{color:'var(--text-secondary)'}}>{t('equityCurve')}</h3>
              <EquityCurveChart equity={stats.equity} startCapital={activeSess!.start_capital}/>
            </div>
            <div className="rounded-xl p-5" style={{background:'var(--bg-secondary)', border:'1px solid var(--border-subtle)'}}>
              <h3 className="text-sm font-semibold mb-4" style={{color:'var(--text-secondary)'}}>{t('dayPerformance')}</h3>
              <DayPerformanceChart byDay={stats.byDay}/>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
