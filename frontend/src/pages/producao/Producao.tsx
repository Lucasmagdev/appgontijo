import { useEffect, useState } from 'react'
import { CalendarDays, TrendingUp } from 'lucide-react'
import QueryFeedback from '@/components/ui/QueryFeedback'
import {
  extractApiErrorMessage,
  productionService,
  type ProductionDailyDashboard,
  type ProductionWeeklyDashboard,
} from '@/lib/gontijo-api'
import {
  PrimaryView,
  SecondaryView,
  REFRESH_DAILY,
  REFRESH_WEEKLY,
  getCurrentDateString,
  getCurrentWeekStart,
} from '@/pages/tv/TvDashboardCards'

type ProductionView = 'daily' | 'weekly'

const CLIENT_LOGIN = 'cgontijo'

export default function ProducaoPage() {
  const [view, setView] = useState<ProductionView>('daily')
  const [daily, setDaily] = useState<ProductionDailyDashboard | null>(null)
  const [weekly, setWeekly] = useState<ProductionWeeklyDashboard | null>(null)
  const [error, setError] = useState('')
  const [refreshIn, setRefreshIn] = useState(REFRESH_DAILY)

  async function fetchData(currentView: ProductionView) {
    try {
      if (currentView === 'daily') {
        const data = await productionService.daily({ date: getCurrentDateString(), clientLogin: CLIENT_LOGIN })
        setDaily(data)
      } else {
        const data = await productionService.weekly({ weekStart: getCurrentWeekStart(), clientLogin: CLIENT_LOGIN })
        setWeekly(data)
      }
      setError('')
      setRefreshIn(currentView === 'daily' ? REFRESH_DAILY : REFRESH_WEEKLY)
    } catch (err) {
      setError(extractApiErrorMessage(err))
    }
  }

  useEffect(() => {
    setRefreshIn(view === 'daily' ? REFRESH_DAILY : REFRESH_WEEKLY)
    void fetchData(view)
  }, [view])

  useEffect(() => {
    const t = setInterval(() => {
      setRefreshIn((prev) => {
        if (prev <= 1) {
          void fetchData(view)
          return view === 'daily' ? REFRESH_DAILY : REFRESH_WEEKLY
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [view])

  const hasData = view === 'daily' ? Boolean(daily) : Boolean(weekly)

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-heading">Producao Operacional</h1>
          <p className="page-subtitle">Acompanhamento diario e acumulado semanal das maquinas em operacao.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 13 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: refreshIn <= 10 ? '#f59e0b' : '#22c55e',
          }} />
          Atualiza em {refreshIn}s
        </div>
      </div>

      <nav className="main-nav production-nav">
        <button type="button" className={`nav-pill ${view === 'daily' ? 'is-active' : ''}`} onClick={() => setView('daily')}>
          <CalendarDays size={16} />
          Acompanhamento Diario
        </button>
        <button type="button" className={`nav-pill ${view === 'weekly' ? 'is-active' : ''}`} onClick={() => setView('weekly')}>
          <TrendingUp size={16} />
          Acumulado Semanal
        </button>
      </nav>

      {!hasData && !error ? (
        <QueryFeedback
          type="loading"
          title={`Carregando producao ${view === 'daily' ? 'diaria' : 'semanal'}`}
          description="Buscando as leituras das maquinas e consolidando o painel."
        />
      ) : null}

      {error && !hasData ? (
        <QueryFeedback
          type="error"
          title="Nao foi possivel carregar a producao"
          description={error}
        />
      ) : null}

      {hasData ? (
        <div style={{
          background: '#0a0d13', borderRadius: 16, overflow: 'hidden', position: 'relative',
          height: 'calc(100vh - 260px)', minHeight: 640,
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -200, left: -200, width: 600, height: 600, borderRadius: '50%', background: 'rgba(198,9,38,0.07)', filter: 'blur(100px)' }} />
            <div style={{ position: 'absolute', bottom: -200, right: -200, width: 500, height: 500, borderRadius: '50%', background: 'rgba(198,9,38,0.05)', filter: 'blur(80px)' }} />
          </div>
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            {view === 'daily' && daily ? <PrimaryView data={daily} /> : null}
            {view === 'weekly' && weekly ? <SecondaryView data={weekly} /> : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
