import { useQuery } from '@tanstack/react-query'
import { ExternalLink, FileText, LogOut } from 'lucide-react'
import QueryFeedback from '@/components/ui/QueryFeedback'
import { useClientePortalAuth } from '@/hooks/useClientePortalAuth'
import { clientPortalService } from '@/lib/client-portal-api'
import { cn, formatDate } from '@/lib/utils'
import { extractApiErrorMessage } from '@/lib/gontijo-api'

const statusClasses: Record<string, string> = {
  assinado: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  pendente: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  rascunho: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
}

export default function ClientePortalDashboardPage() {
  const { user, logout } = useClientePortalAuth()

  const dashboardQuery = useQuery({
    queryKey: ['client-portal-dashboard'],
    queryFn: clientPortalService.getDashboard,
  })

  const data = dashboardQuery.data

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#8d1f1f_0%,#7b1919_24%,#f6f2ef_24%,#f6f2ef_100%)] px-4 py-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <section className="overflow-hidden rounded-[30px] border border-black/10 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.16)]">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-black/6 bg-[linear-gradient(180deg,#b12929_0%,#9a2020_100%)] px-6 py-5 text-white">
            <div>
              <div className="app-title text-3xl tracking-[0.12em]">Portal do Cliente</div>
              <p className="mt-1 text-sm text-red-50/80">
                {user?.cliente || 'Cliente'} • acesso {user?.login || '-'}
              </p>
            </div>

            <button type="button" onClick={() => logout()} className="inline-flex items-center gap-2 rounded-full border border-white/18 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/16">
              <LogOut size={16} />
              Sair
            </button>
          </div>

          <div className="p-6">
            {dashboardQuery.isLoading ? (
              <QueryFeedback
                type="loading"
                title="Carregando obra"
                description="Buscando o resumo da producao e os diarios liberados para este acesso."
              />
            ) : null}

            {dashboardQuery.isError ? (
              <QueryFeedback
                type="error"
                title="Nao foi possivel abrir o portal"
                description={extractApiErrorMessage(dashboardQuery.error)}
              />
            ) : null}

            {data ? (
              <div className="grid gap-6">
                <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                  <div className="rounded-[26px] border border-slate-200 bg-[linear-gradient(180deg,#fff8f7_0%,#ffffff_100%)] p-6">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Obra ativa</div>
                    <div className="mt-2 text-3xl font-semibold text-slate-900">{data.obra.numero || '-'}</div>
                    <div className="mt-1 text-lg text-slate-600">{data.obra.cliente || '-'}</div>

                    <div className="mt-5 grid gap-3 md:grid-cols-2">
                      <InfoCard label="Localidade" value={[data.obra.cidade, data.obra.estado].filter(Boolean).join(' / ') || '-'} />
                      <InfoCard label="Endereco" value={data.obra.endereco || '-'} />
                      <InfoCard label="Status" value={data.obra.status || '-'} />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                    <MetricCard label="Diarios disponiveis" value={String(data.resumo.totalDiarios)} tone="neutral" />
                    <MetricCard label="Estacas executadas" value={String(data.resumo.estacasExecutadas)} tone="success" />
                    <MetricCard label="Estacas planejadas" value={String(data.resumo.estacasPlanejadas)} tone="neutral" />
                    <MetricCard label="Faltam para concluir" value={String(data.resumo.estacasRestantes)} tone="warning" />
                  </div>
                </section>

                <section className="rounded-[26px] border border-slate-200 bg-white p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold text-slate-900">Diarios da obra</h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Acompanhe os registros mais recentes, producao do dia e acesso ao PDF de cada diario.
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 overflow-x-auto">
                    <table className="data-table min-w-[880px]">
                      <thead>
                        <tr>
                          <th>Data</th>
                          <th>Status</th>
                          <th>Equipamento</th>
                          <th>Operador</th>
                          <th>Estacas no dia</th>
                          <th>Revisado</th>
                          <th>PDF</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.diarios.length ? (
                          data.diarios.map((diario) => (
                            <tr key={diario.id}>
                              <td className="font-semibold text-slate-700">
                                {diario.dataDiario ? formatDate(diario.dataDiario) : '-'}
                              </td>
                              <td>
                                <span
                                  className={cn(
                                    'inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em]',
                                    statusClasses[diario.status] || statusClasses.rascunho
                                  )}
                                >
                                  {diario.status || 'rascunho'}
                                </span>
                              </td>
                              <td>{diario.equipamento || '-'}</td>
                              <td>{diario.operadorNome || '-'}</td>
                              <td className="font-semibold text-slate-900">{diario.estacasNoDia}</td>
                              <td>{diario.reviewConfirmed ? 'Sim' : 'Nao'}</td>
                              <td>
                                <a
                                  href={diario.pdfUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-700 transition hover:border-[var(--brand-red)] hover:text-[var(--brand-red)]"
                                >
                                  <FileText size={14} />
                                  Ver PDF
                                  <ExternalLink size={13} />
                                </a>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={7}>
                              <QueryFeedback
                                type="empty"
                                title="Nenhum diario encontrado"
                                description="Ainda nao existem diarios vinculados a esta obra ativa."
                              />
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</div>
      <div className="mt-2 text-sm font-medium leading-6 text-slate-700">{value}</div>
    </div>
  )
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'success' | 'warning' | 'neutral'
}) {
  const toneClasses =
    tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : tone === 'warning'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : 'border-slate-200 bg-white text-slate-900'

  return (
    <div className={cn('rounded-[24px] border px-5 py-5', toneClasses)}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-70">{label}</div>
      <div className="mt-2 text-4xl font-semibold">{value}</div>
    </div>
  )
}
