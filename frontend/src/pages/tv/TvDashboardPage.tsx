import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { productionService, type ProductionDailyDashboard, type ProductionWeeklyDashboard } from '@/lib/gontijo-api'
import {
  PrimaryView,
  SecondaryView,
  REFRESH_DAILY,
  REFRESH_WEEKLY,
  getCurrentDateString,
  getCurrentWeekStart,
} from './TvDashboardCards'

function useClock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return now
}

// ─── Header ──────────────────────────────────────────────────────────────────

function TvHeader({ isPrimary, now, refreshIn }: { isPrimary: boolean; now: Date; refreshIn: number }) {
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const ss = String(now.getSeconds()).padStart(2, '0')
  const date = now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 28px', borderBottom: '1px solid rgba(255,255,255,0.06)',
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <img
          src="/gontijo-logo-transparente.png"
          alt="Gontijo"
          style={{ height: 30, filter: 'invert(1) hue-rotate(180deg)', opacity: 0.85 }}
        />
        <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.1)' }} />
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          {isPrimary ? 'Produção do Dia' : 'Acumulado Semanal'}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>{date}</span>
        <span style={{ color: '#fff', fontSize: 26, fontWeight: 700, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.04em' }}>
          {hh}:{mm}<span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 18 }}>:{ss}</span>
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{
            width: 7, height: 7, borderRadius: '50%',
            background: refreshIn <= 10 ? '#f59e0b' : '#22c55e',
            boxShadow: `0 0 6px ${refreshIn <= 10 ? '#f59e0b' : '#22c55e'}`,
          }} />
          <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11 }}>{refreshIn}s</span>
        </div>
      </div>
    </div>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function TvDashboardPage() {
  const { screen } = useParams<{ screen: string }>()
  // Aceita variantes (ex.: secondary1) para forçar URL nova e furar cache da TV.
  const isPrimary = !(screen || '').toLowerCase().startsWith('secondary')

  const [daily, setDaily] = useState<ProductionDailyDashboard | null>(null)
  const [weekly, setWeekly] = useState<ProductionWeeklyDashboard | null>(null)
  const [error, setError] = useState('')
  const [refreshIn, setRefreshIn] = useState(isPrimary ? REFRESH_DAILY : REFRESH_WEEKLY)
  const clock = useClock()

  async function fetchData() {
    setError('')
    try {
      if (isPrimary) {
        const data = await productionService.daily({ date: getCurrentDateString(), clientLogin: 'cgontijo' })
        setDaily(data)
      } else {
        const data = await productionService.weekly({ weekStart: getCurrentWeekStart(), clientLogin: 'cgontijo' })
        setWeekly(data)
      }
      setRefreshIn(isPrimary ? REFRESH_DAILY : REFRESH_WEEKLY)
    } catch {
      setError('Falha ao carregar dados.')
    }
  }

  useEffect(() => { void fetchData() }, [screen]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = setInterval(() => {
      setRefreshIn((prev) => {
        if (prev <= 1) { void fetchData(); return isPrimary ? REFRESH_DAILY : REFRESH_WEEKLY }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [screen]) // eslint-disable-line react-hooks/exhaustive-deps

  const hasData = isPrimary ? Boolean(daily) : Boolean(weekly)

  return (
    <div style={{
      height: '100dvh', background: '#0a0d13', color: '#fff',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative',
    }}>
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -200, left: -200, width: 600, height: 600, borderRadius: '50%', background: 'rgba(198,9,38,0.07)', filter: 'blur(100px)' }} />
        <div style={{ position: 'absolute', bottom: -200, right: -200, width: 500, height: 500, borderRadius: '50%', background: 'rgba(198,9,38,0.05)', filter: 'blur(80px)' }} />
      </div>

      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <TvHeader isPrimary={isPrimary} now={clock} refreshIn={refreshIn} />

        {!hasData && !error && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 16 }}>Carregando...</div>
          </div>
        )}

        {error && !hasData && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
            <div style={{ color: '#f87171', fontSize: 16 }}>{error}</div>
          </div>
        )}

        {isPrimary && daily && <PrimaryView data={daily} />}
        {!isPrimary && weekly && <SecondaryView data={weekly} />}
      </div>
    </div>
  )
}
