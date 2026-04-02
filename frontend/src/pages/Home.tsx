import { AlertCircle, CheckCircle2, FileText, HardHat, TrendingUp, Wrench } from 'lucide-react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import QueryFeedback from '@/components/ui/QueryFeedback'
import { dashboardService, extractApiErrorMessage } from '@/lib/gontijo-api'
import { formatDate } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'

const metricCards = [
  {
    key: 'obrasAndamento',
    label: 'Obras em andamento',
    icon: HardHat,
    chipClass: 'bg-red-50 text-red-700',
  },
  {
    key: 'obrasFinalizadas',
    label: 'Obras finalizadas',
    icon: CheckCircle2,
    chipClass: 'bg-emerald-50 text-emerald-700',
  },
  {
    key: 'maquinasAtivas',
    label: 'Maquinas ativas',
    icon: Wrench,
    chipClass: 'bg-sky-50 text-sky-700',
  },
  {
    key: 'diariosPendentes',
    label: 'Diarios pendentes',
    icon: FileText,
    chipClass: 'bg-amber-50 text-amber-700',
  },
] as const

export default function HomePage() {
  const { user } = useAuth()
  const overviewQuery = useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: dashboardService.overview,
    placeholderData: keepPreviousData,
  })

  const overview = overviewQuery.data

  return (
    <div className="page-shell">
      <div>
        <h1 className="page-heading">Painel Operacional</h1>
        <p className="page-subtitle">
          Visao consolidada para {user?.name?.split(' ')[0] ?? 'Usuario'} acompanhar o dia.
        </p>
      </div>

      {overviewQuery.isLoading ? (
        <QueryFeedback
          type="loading"
          title="Carregando indicadores"
          description="Buscando os numeros reais do banco que voce migrou."
        />
      ) : null}

      {overviewQuery.isError ? (
        <QueryFeedback
          type="error"
          title="Nao foi possivel carregar o painel"
          description={extractApiErrorMessage(overviewQuery.error)}
        />
      ) : null}

      {overview ? (
        <>
          <section className="stat-grid">
            {metricCards.map((card) => {
              const Icon = card.icon
              const value = overview.stats[card.key]

              return (
                <article key={card.key} className="app-panel stat-card">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[0.78rem] font-semibold uppercase tracking-[0.12em] text-slate-500">
                        {card.label}
                      </div>
                      <div className="stat-value">{value}</div>
                    </div>

                    <div className={`kpi-chip ${card.chipClass}`}>
                      <Icon size={15} />
                      real
                    </div>
                  </div>
                </article>
              )
            })}
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
            <article className="app-panel section-panel">
              <div className="mb-4 flex items-center gap-2 text-slate-700">
                <TrendingUp size={18} />
                <h2 className="section-heading !mb-0">Movimentacoes recentes</h2>
              </div>

              {overview.recentActivities.length ? (
                <div className="space-y-3">
                  {overview.recentActivities.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600"
                    >
                      <div className="font-semibold text-slate-800">{item.title}</div>
                      <div className="mt-1">{item.description}</div>
                      <div className="mt-2 text-xs uppercase tracking-[0.08em] text-slate-400">
                        {formatDate(item.date)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <QueryFeedback
                  type="empty"
                  title="Nenhuma movimentacao recente"
                  description="Os proximos eventos aparecem aqui conforme o banco for sendo atualizado."
                />
              )}
            </article>

            <article className="app-panel section-panel">
              <div className="mb-4 flex items-center gap-2 text-slate-700">
                <AlertCircle size={18} />
                <h2 className="section-heading !mb-0">Alertas</h2>
              </div>

              {overview.alerts.length ? (
                <div className="space-y-3">
                  {overview.alerts.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-md border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
                    >
                      <div className="font-semibold">{item.title}</div>
                      <div className="mt-1 font-normal text-red-700/90">{item.description}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <QueryFeedback
                  type="empty"
                  title="Sem alertas no momento"
                  description="Nao ha pendencias criticas detectadas pelas regras atuais."
                />
              )}
            </article>
          </section>
        </>
      ) : null}
    </div>
  )
}
