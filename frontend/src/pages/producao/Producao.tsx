import { useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { CalendarDays, RefreshCcw, TrendingUp } from 'lucide-react'
import QueryFeedback from '@/components/ui/QueryFeedback'
import {
  extractApiErrorMessage,
  productionService,
  type ProductionDailyDashboard,
  type ProductionMachineRow,
  type ProductionMetric,
  type ProductionTimelineItem,
  type ProductionWeeklyDashboard,
  type ProductionWorkRankingItem,
} from '@/lib/gontijo-api'
import { formatCurrency, formatDate } from '@/lib/utils'

type ProductionView = 'daily' | 'weekly'

type MetricConfig = {
  label: string
  shortLabel: string
  getDailyTotal: (data: ProductionDailyDashboard) => number
  getWeeklyTotal: (data: ProductionWeeklyDashboard) => number
  getMachineValue: (item: ProductionMachineRow) => number
  getWorkValue: (item: ProductionWorkRankingItem) => number
  getTimelineValue: (item: ProductionTimelineItem) => number
  getAccumulatedValue: (data: ProductionWeeklyDashboard) => number[]
  format: (value: number) => string
}

const metricConfigs: Record<ProductionMetric, MetricConfig> = {
  estacas: {
    label: 'Estacas',
    shortLabel: 'Estacas',
    getDailyTotal: (data) => data.totalRealizedEstacas,
    getWeeklyTotal: (data) => data.totalRealizedEstacas,
    getMachineValue: (item) => item.realizedEstacas,
    getWorkValue: (item) => item.realizedEstacas,
    getTimelineValue: () => 0,
    getAccumulatedValue: (data) => data.accumulatedByDay.map((item) => item.accumulatedEstacas),
    format: (value) => value.toLocaleString('pt-BR'),
  },
  meq: {
    label: 'MEQ',
    shortLabel: 'MEQ',
    getDailyTotal: (data) => data.totalRealizedMeq,
    getWeeklyTotal: (data) => data.totalRealizedMeq,
    getMachineValue: (item) => item.realizedMeq,
    getWorkValue: (item) => item.realizedMeq,
    getTimelineValue: (item) => item.realizedMeq,
    getAccumulatedValue: (data) => data.accumulatedByDay.map((item) => item.accumulatedMeq),
    format: (value) =>
      value.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
  },
  faturamento: {
    label: 'Faturamento',
    shortLabel: 'R$',
    getDailyTotal: (data) => data.totalApproxRevenueRealized,
    getWeeklyTotal: (data) => data.totalApproxRevenueRealized,
    getMachineValue: (item) => item.approxRevenueRealized,
    getWorkValue: (item) => item.approxRevenueRealized,
    getTimelineValue: (item) => item.approxRevenueRealized,
    getAccumulatedValue: (data) => data.accumulatedByDay.map((item) => item.accumulatedApproxRevenueRealized),
    format: (value) => formatCurrency(value),
  },
}

function getCurrentDateString() {
  return new Date().toISOString().slice(0, 10)
}

function getCurrentWeekStart() {
  const today = new Date()
  const day = today.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() + diff)
  return weekStart.toISOString().slice(0, 10)
}

function progressClass(progressPercent: number | null) {
  if (progressPercent == null) return 'neutral'
  if (progressPercent >= 100) return 'green'
  if (progressPercent >= 70) return 'orange'
  return 'red'
}

function machineSourceLabel(machine: ProductionMachineRow) {
  if (machine.workSource === 'admin') return 'Obra definida no admin'
  if (machine.workSource === 'api') return 'Obra puxada da operacao'
  return 'Sem obra definida'
}

function formatWeekRange(weekStart: string, weekDates: string[]) {
  if (!weekStart || !weekDates.length) return '-'
  const end = weekDates[weekDates.length - 1]
  return `${formatDate(weekStart)} a ${formatDate(end)}`
}

function ProductionFigureCard(props: {
  eyebrow: string
  title: string
  primary: string
  description: string
  progressPercent: number | null
  progressLabel: string
  metrics: Array<{ label: string; value: string }>
  accent?: boolean
}) {
  const fillPercent = props.progressPercent == null ? 0 : Math.max(0, Math.min(props.progressPercent, 100))

  return (
    <article className={`production-hero-card ${props.accent ? 'production-hero-card--accent' : ''}`}>
      <div className="panel-head production-panel-head">
        <div>
          <p className="eyebrow">{props.eyebrow}</p>
          <h3>{props.title}</h3>
        </div>
        <span className={`status-tag ${progressClass(props.progressPercent)}`}>{props.progressLabel}</span>
      </div>

      <div className="building-chart">
        <div className="building-figure">
          <div className="building-fill" style={{ height: `${fillPercent}%` }} />
          <div className="building-grid">
            {Array.from({ length: 30 }).map((_, index) => (
              <span key={index} />
            ))}
          </div>
        </div>

        <div className="building-label">
          <strong>{props.primary}</strong>
          <p>{props.description}</p>
        </div>
      </div>

      <div className="summary-strip">
        {props.metrics.map((metric) => (
          <article key={metric.label} className="summary-chip">
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </article>
        ))}
      </div>
    </article>
  )
}

function MachineSpotlight({ machine, metric }: { machine: ProductionMachineRow | undefined; metric: MetricConfig }) {
  if (!machine) {
    return (
      <article className="production-hero-card">
        <p className="inline-feedback">Nenhuma maquina disponivel para destaque.</p>
      </article>
    )
  }

  const progress = machine.progressPercent == null ? 0 : Math.max(0, Math.min(machine.progressPercent, 100))
  const tone = progressClass(machine.progressPercent)
  const metricValue = metric.getMachineValue(machine)

  return (
    <article className={`production-hero-card machine-spotlight machine-spotlight--${tone}`}>
      <div className="machine-spotlight__top">
        <div>
          <p className="eyebrow">Maquina em destaque</p>
          <h3>{machine.machineName}</h3>
          <p className="machine-spotlight__work">{machine.obraName || 'Sem obra definida'}</p>
        </div>
        <div className="machine-spotlight__badges">
          <span className={`status-tag ${tone}`}>
            {machine.progressPercent == null ? 'Sem meta' : `${machine.progressPercent.toFixed(1)}% da meta`}
          </span>
          <span className="machine-spotlight__position">{machine.imei}</span>
        </div>
      </div>

      <div className="machine-spotlight__hero">
        <div className="machine-spotlight__score">
          <span className="machine-spotlight__label">{metric.label}</span>
          <strong>{metric.format(metricValue)}</strong>
          <p>{machineSourceLabel(machine)}</p>
        </div>
        <div className="machine-spotlight__progress">
          <div className="machine-spotlight__progress-bar">
            <span style={{ width: `${progress}%` }} />
          </div>
          <div className="machine-spotlight__progress-scale">
            <span>0</span>
            <span>Meta {machine.dailyGoalEstacas || machine.weeklyGoalEstacas || 0}</span>
          </div>
        </div>
      </div>

      <div className="machine-spotlight__metrics">
        <article className="machine-spotlight__metric is-primary">
          <span>Estacas</span>
          <strong>{machine.realizedEstacas}</strong>
        </article>
        <article className="machine-spotlight__metric">
          <span>Metros</span>
          <strong>
            {machine.realizedLinearMeters.toLocaleString('pt-BR', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{' '}
            m
          </strong>
        </article>
        <article className="machine-spotlight__metric">
          <span>Obra</span>
          <strong>{machine.obraCode || '-'}</strong>
        </article>
      </div>

      <div className="machine-spotlight__footer">
        <span>{machine.obraName || 'Sem obra vinculada'}</span>
        <span>{machine.workSource === 'admin' ? 'Admin' : machine.workSource === 'api' ? 'Operacao' : 'Sem fonte'}</span>
      </div>
    </article>
  )
}

function ComparisonList({
  items,
  metric,
}: {
  items: ProductionWorkRankingItem[]
  metric: MetricConfig
}) {
  const maxValue = Math.max(...items.map((item) => metric.getWorkValue(item)), 1)

  if (!items.length) {
    return <p className="inline-feedback">Nenhuma obra em destaque.</p>
  }

  return (
    <div className="compare-list">
      {items.map((item) => {
        const value = metric.getWorkValue(item)
        return (
          <article key={`${item.obraName}-${value}`} className="compare-row">
            <div className="compare-row__head">
              <div>
                <span className="compare-row__kicker">Obra</span>
                <strong>{item.obraName || 'Sem obra'}</strong>
                <p>{item.realizedEstacas} estacas realizadas</p>
              </div>
              <div className="compare-row__values">
                <strong>{metric.format(value)}</strong>
                <span>
                  {item.realizedLinearMeters.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{' '}
                  m
                </span>
              </div>
            </div>
            <div className="compare-row__track">
              <span style={{ width: `${Math.max((value / maxValue) * 100, value ? 8 : 0)}%` }} />
            </div>
          </article>
        )
      })}
    </div>
  )
}

function MachineCard({ machine, metric, mode }: { machine: ProductionMachineRow; metric: MetricConfig; mode: ProductionView }) {
  const percent = machine.progressPercent == null ? 0 : Math.min(machine.progressPercent, 100)
  const targetValue = mode === 'daily' ? machine.dailyGoalEstacas : machine.weeklyGoalEstacas

  return (
    <article className="machine-card">
      <div className="machine-top">
        <div className="machine-meta">
          <strong>{machine.machineName}</strong>
          <small>{machine.imei}</small>
          <small>{machine.obraName || 'Sem obra'}</small>
          <small>{machineSourceLabel(machine)}</small>
        </div>
        <span className={`status-tag ${progressClass(machine.progressPercent)}`}>
          {machine.progressPercent == null ? 'Sem meta' : `${machine.progressPercent.toFixed(0)}%`}
        </span>
      </div>
      <div className="machine-progress">
        <span style={{ width: `${percent}%` }} />
      </div>
      <div className="machine-stats">
        <div>
          <span>{mode === 'daily' ? 'Dia' : 'Semana'}</span>
          <strong>{machine.realizedEstacas}</strong>
        </div>
        <div>
          <span>{metric.label}</span>
          <strong>{metric.format(metric.getMachineValue(machine))}</strong>
        </div>
        <div>
          <span>Meta</span>
          <strong>{targetValue}</strong>
        </div>
      </div>
    </article>
  )
}

function TimelineList({ items, metric }: { items: ProductionTimelineItem[]; metric: MetricConfig }) {
  if (!items.length) {
    return <p className="inline-feedback">Nenhum evento registrado para o periodo selecionado.</p>
  }

  return (
    <div className="timeline-list">
      {items.map((item, index) => (
        <article key={`${item.date}-${item.machineName}-${item.estaca}-${index}`} className="timeline-card">
          <div className="timeline-time">
            {item.date ? `${formatDate(item.date)} ${item.finishedAt || ''}` : '-'}
          </div>
          <div>
            <strong>{item.machineName}</strong>
            <p>
              {item.estaca || 'Sem estaca'} | {item.obraName || 'Sem obra'}
              {metric.label !== 'Estacas' ? ` | ${metric.format(metric.getTimelineValue(item))}` : ''}
            </p>
          </div>
        </article>
      ))}
    </div>
  )
}

function TrendChart({
  labels,
  primaryValues,
  primaryLabel,
  secondaryValues,
  secondaryLabel,
}: {
  labels: string[]
  primaryValues: number[]
  primaryLabel: string
  secondaryValues?: number[]
  secondaryLabel?: string
}) {
  const width = 760
  const height = 260
  const padding = 28
  const maxValue = Math.max(...primaryValues, ...(secondaryValues || []), 1)

  function buildPoints(values: number[]) {
    if (!values.length) return ''
    return values
      .map((value, index) => {
        const x = padding + (index * (width - padding * 2)) / Math.max(values.length - 1, 1)
        const y = height - padding - (value / maxValue) * (height - padding * 2)
        return `${x},${y}`
      })
      .join(' ')
  }

  function buildArea(points: string) {
    if (!points) return ''
    const firstX = points.split(' ')[0]?.split(',')[0] || padding
    const lastX = points.split(' ').at(-1)?.split(',')[0] || width - padding
    return `${firstX},${height - padding} ${points} ${lastX},${height - padding}`
  }

  const primaryPoints = buildPoints(primaryValues)
  const secondaryPoints = secondaryValues?.length ? buildPoints(secondaryValues) : ''

  return (
    <div className="production-chart">
      <div className="production-chart__legend">
        <span className="production-chart__legend-item">
          <i className="production-chart__legend-dot is-primary" />
          {primaryLabel}
        </span>
        {secondaryLabel && secondaryValues?.length ? (
          <span className="production-chart__legend-item">
            <i className="production-chart__legend-dot is-secondary" />
            {secondaryLabel}
          </span>
        ) : null}
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="production-chart__svg" role="img" aria-label={primaryLabel}>
        {Array.from({ length: 5 }).map((_, index) => {
          const y = padding + (index * (height - padding * 2)) / 4
          return <line key={index} x1={padding} y1={y} x2={width - padding} y2={y} className="production-chart__grid" />
        })}

        {primaryPoints ? <polygon points={buildArea(primaryPoints)} className="production-chart__area" /> : null}
        {secondaryPoints ? <polyline points={secondaryPoints} className="production-chart__line production-chart__line--secondary" /> : null}
        {primaryPoints ? <polyline points={primaryPoints} className="production-chart__line production-chart__line--primary" /> : null}

        {labels.map((label, index) => {
          const x = padding + (index * (width - padding * 2)) / Math.max(labels.length - 1, 1)
          return (
            <text key={label} x={x} y={height - 8} textAnchor="middle" className="production-chart__label">
              {label}
            </text>
          )
        })}
      </svg>
    </div>
  )
}

export default function ProducaoPage() {
  const [view, setView] = useState<ProductionView>('daily')
  const [metric, setMetric] = useState<ProductionMetric>('estacas')
  const [date, setDate] = useState(getCurrentDateString())
  const [weekStart, setWeekStart] = useState(getCurrentWeekStart())
  const [clientLogin, setClientLogin] = useState('')

  const dailyQuery = useQuery({
    queryKey: ['production-daily', date, clientLogin],
    queryFn: () => productionService.daily({ date, clientLogin }),
    enabled: view === 'daily',
    placeholderData: keepPreviousData,
  })

  const weeklyQuery = useQuery({
    queryKey: ['production-weekly', weekStart, clientLogin],
    queryFn: () => productionService.weekly({ weekStart, clientLogin }),
    enabled: view === 'weekly',
    placeholderData: keepPreviousData,
  })

  const activeMetric = metricConfigs[metric]
  const daily = dailyQuery.data
  const weekly = weeklyQuery.data

  const dailySpotlight = useMemo(() => {
    if (!daily) return undefined
    return [...daily.machines].sort((a, b) => activeMetric.getMachineValue(b) - activeMetric.getMachineValue(a))[0]
  }, [activeMetric, daily])

  const weeklyRanking = useMemo(() => {
    if (!weekly) return []
    return [...weekly.machines].sort((a, b) => activeMetric.getMachineValue(b) - activeMetric.getMachineValue(a)).slice(0, 6)
  }, [activeMetric, weekly])

  const query = view === 'daily' ? dailyQuery : weeklyQuery

  return (
    <div className="page-shell">
      <div>
        <h1 className="page-heading">Producao Operacional</h1>
        <p className="page-subtitle">Acompanhamento diario e acumulado semanal na mesma pegada do dashboard antigo.</p>
      </div>

      <section className="app-panel section-panel production-control-panel">
        <div className="production-control-grid">
          <label>
            <span className="field-label">Cliente login</span>
            <input className="field-input" value={clientLogin} onChange={(event) => setClientLogin(event.target.value)} placeholder="cgontijo" />
          </label>

          {view === 'daily' ? (
            <label>
              <span className="field-label">Data</span>
              <input type="date" className="field-input" value={date} onChange={(event) => setDate(event.target.value)} />
            </label>
          ) : (
            <label>
              <span className="field-label">Inicio da semana</span>
              <input type="date" className="field-input" value={weekStart} onChange={(event) => setWeekStart(event.target.value)} />
            </label>
          )}

          <div>
            <span className="field-label">Metrica</span>
            <div className="metric-toggle">
              {(['estacas', 'meq', 'faturamento'] as ProductionMetric[]).map((metricKey) => (
                <button
                  key={metricKey}
                  type="button"
                  className={`metric-toggle__button ${metric === metricKey ? 'is-active' : ''}`}
                  onClick={() => setMetric(metricKey)}
                >
                  {metricConfigs[metricKey].label}
                </button>
              ))}
            </div>
          </div>

          <div className="inline-actions production-control-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void (view === 'daily' ? dailyQuery.refetch() : weeklyQuery.refetch())}
            >
              <RefreshCcw size={15} />
              Atualizar
            </button>
          </div>
        </div>
      </section>

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

      {query.isLoading ? (
        <QueryFeedback
          type="loading"
          title={`Carregando producao ${view === 'daily' ? 'diaria' : 'semanal'}`}
          description="Buscando as leituras das maquinas e consolidando o painel."
        />
      ) : null}

      {query.isError ? (
        <QueryFeedback
          type="error"
          title="Nao foi possivel carregar a producao"
          description={extractApiErrorMessage(query.error)}
        />
      ) : null}

      {view === 'daily' && daily ? (
        <section className="view-section is-active">
          <div className="view-head">
            <div>
              <p className="eyebrow">Principal</p>
              <h2>Acompanhamento Diario</h2>
            </div>
            <div className="meta-copy">
              <strong>{formatDate(daily.date)}</strong>
              <span>{daily.machines.length} maquinas com leitura</span>
            </div>
          </div>

          <div className="hero-grid">
            <ProductionFigureCard
              eyebrow={metric === 'faturamento' ? 'Financeiro' : 'Principal'}
              title={metric === 'estacas' ? 'Estacas realizadas no dia' : `${activeMetric.label} realizado no dia`}
              primary={activeMetric.format(activeMetric.getDailyTotal(daily))}
              description="Painel principal do dia consolidando as leituras das maquinas ativas."
              progressPercent={daily.totalProgressPercent}
              progressLabel={daily.totalProgressPercent == null ? 'Sem meta' : `${daily.totalProgressPercent.toFixed(1)}% da meta`}
              accent
              metrics={[
                { label: 'Meta dia', value: daily.totalGoalEstacas.toLocaleString('pt-BR') },
                { label: 'Metros', value: `${daily.totalRealizedLinearMeters.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m` },
                { label: 'MEQ', value: metricConfigs.meq.format(daily.totalRealizedMeq) },
              ]}
            />

            <MachineSpotlight machine={dailySpotlight} metric={activeMetric} />

            <article className="production-hero-card">
              <div className="panel-head production-panel-head">
                <div>
                  <p className="eyebrow">Resumo</p>
                  <h3>Obras em destaque</h3>
                </div>
                <span>Distribuicao de producao</span>
              </div>
              <ComparisonList items={[...daily.topWorks].sort((a, b) => activeMetric.getWorkValue(b) - activeMetric.getWorkValue(a)).slice(0, 5)} metric={activeMetric} />
            </article>
          </div>

          <div className="panel-grid two-col">
            <section className="panel">
              <div className="panel-head production-panel-head">
                <h3>Maquinas do dia</h3>
                <span>{daily.machines.filter((item) => item.active).length} maquinas ativas</span>
              </div>
              <div className="machine-card-grid">
                {daily.machines.length ? (
                  daily.machines.map((machine) => <MachineCard key={machine.imei} machine={machine} metric={activeMetric} mode="daily" />)
                ) : (
                  <p className="inline-feedback">Nenhuma maquina com leitura para o dia selecionado.</p>
                )}
              </div>
            </section>

            <section className="panel">
              <div className="panel-head production-panel-head">
                <h3>Timeline do dia</h3>
                <span>Ultimas estacas registradas</span>
              </div>
              <TimelineList items={daily.timeline} metric={activeMetric} />
            </section>
          </div>
        </section>
      ) : null}

      {view === 'weekly' && weekly ? (
        <section className="view-section is-active">
          <div className="view-head">
            <div>
              <p className="eyebrow">Principal</p>
              <h2>Acumulado Semanal</h2>
            </div>
            <div className="meta-copy">
              <strong>{formatWeekRange(weekly.weekStart, weekly.weekDates)}</strong>
              <span>{weekly.machines.length} maquinas na semana</span>
            </div>
          </div>

          <div className="hero-grid">
            <ProductionFigureCard
              eyebrow={metric === 'faturamento' ? 'Financeiro' : 'Principal'}
              title={metric === 'estacas' ? 'Estacas acumuladas na semana' : `${activeMetric.label} acumulado na semana`}
              primary={activeMetric.format(activeMetric.getWeeklyTotal(weekly))}
              description="Consolidado semanal do volume executado pelas maquinas ativas."
              progressPercent={weekly.totalProgressPercent}
              progressLabel={weekly.totalProgressPercent == null ? 'Sem meta' : `${weekly.totalProgressPercent.toFixed(1)}% atingido`}
              accent
              metrics={[
                { label: 'Meta semana', value: weekly.totalGoalEstacas.toLocaleString('pt-BR') },
                { label: 'Metros', value: `${weekly.totalRealizedLinearMeters.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m` },
                { label: 'MEQ', value: metricConfigs.meq.format(weekly.totalRealizedMeq) },
              ]}
            />

            <ProductionFigureCard
              eyebrow="Meta semanal"
              title="Meta consolidada da semana"
              primary={weekly.totalGoalEstacas.toLocaleString('pt-BR')}
              description="Alvo consolidado em estacas para a semana das maquinas ativas cadastradas."
              progressPercent={weekly.totalProgressPercent}
              progressLabel={weekly.totalProgressPercent == null ? 'Sem meta' : `${weekly.totalProgressPercent.toFixed(1)}%`}
              metrics={[
                { label: 'Realizado', value: weekly.totalRealizedEstacas.toLocaleString('pt-BR') },
                { label: 'Faltam', value: Math.max(weekly.totalGoalEstacas - weekly.totalRealizedEstacas, 0).toLocaleString('pt-BR') },
                { label: 'Faturamento', value: formatCurrency(weekly.totalApproxRevenueRealized) },
              ]}
            />

            <article className="production-hero-card hero-card--rhythm">
              <div className="panel-head production-panel-head">
                <div>
                  <p className="eyebrow">Consolidado</p>
                  <h3>Ritmo da semana</h3>
                </div>
                <span className={`status-tag ${
                  (weekly.accumulatedByDay.at(-1)?.accumulatedEstacas || 0) >= (weekly.accumulatedByDay.at(-1)?.expectedAccumulatedEstacas || 0)
                    ? 'green'
                    : 'orange'
                }`}>
                  {weekly.accumulatedByDay.at(-1)
                    ? `${(weekly.accumulatedByDay.at(-1)!.accumulatedEstacas - weekly.accumulatedByDay.at(-1)!.expectedAccumulatedEstacas).toFixed(1)} vs esperado`
                    : 'Sem dados'}
                </span>
              </div>

              <div className="rhythm-grid">
                {weekly.accumulatedByDay.map((day) => (
                  <article
                    key={day.date}
                    className={`rhythm-chip ${
                      day.accumulatedEstacas >= day.expectedAccumulatedEstacas ? 'is-good' : 'is-warning'
                    }`}
                  >
                    <span>{day.date.slice(5)}</span>
                    <strong>{day.accumulatedEstacas}</strong>
                    <small>Esperado {Math.round(day.expectedAccumulatedEstacas)}</small>
                  </article>
                ))}
              </div>
            </article>
          </div>

          <div className="panel-grid two-col">
            <section className="panel">
              <div className="panel-head production-panel-head">
                <h3>Evolucao da semana</h3>
                <span>Serie por dia</span>
              </div>
              <TrendChart
                labels={weekly.accumulatedByDay.map((item) => item.date.slice(5))}
                primaryValues={activeMetric.getAccumulatedValue(weekly)}
                primaryLabel={metric === 'estacas' ? 'Realizado acumulado' : `${activeMetric.label} acumulado`}
                secondaryValues={metric === 'estacas' ? weekly.accumulatedByDay.map((item) => item.expectedAccumulatedEstacas) : undefined}
                secondaryLabel={metric === 'estacas' ? 'Esperado acumulado' : undefined}
              />
            </section>

            <section className="panel">
              <div className="panel-head production-panel-head">
                <h3>Ranking semanal</h3>
                <span>Maior realizado</span>
              </div>
              <div className="ranking-list">
                {weeklyRanking.length ? (
                  weeklyRanking.map((machine, index) => (
                    <article key={machine.imei} className="rank-card">
                      <div className="rank-order">{index + 1}</div>
                      <div className="rank-content">
                        <strong>{machine.machineName}</strong>
                        <p>{machine.obraName || 'Sem obra'}</p>
                      </div>
                      <div className="rank-value">{activeMetric.format(activeMetric.getMachineValue(machine))}</div>
                    </article>
                  ))
                ) : (
                  <p className="inline-feedback">Nenhum ranking disponivel.</p>
                )}
              </div>
            </section>
          </div>

          <section className="panel">
            <div className="panel-head production-panel-head">
              <h3>Maquinas na semana</h3>
              <span>{weekly.machines.length} maquinas</span>
            </div>
            <div className="machine-card-grid">
              {weekly.machines.length ? (
                weekly.machines.map((machine) => <MachineCard key={machine.imei} machine={machine} metric={activeMetric} mode="weekly" />)
              ) : (
                <p className="inline-feedback">Nenhuma maquina com producao para a semana selecionada.</p>
              )}
            </div>
          </section>
        </section>
      ) : null}

      {!query.isLoading && !query.isError && ((view === 'daily' && !daily) || (view === 'weekly' && !weekly)) ? (
        <QueryFeedback
          type="empty"
          title="Sem dados de producao"
          description="Nao houve retorno do backend operacional para o filtro selecionado."
        />
      ) : null}
    </div>
  )
}
