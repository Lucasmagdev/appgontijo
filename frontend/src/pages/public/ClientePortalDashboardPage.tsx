import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import {
  CalendarDays,
  Camera,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  FileText,
  Gauge,
  LogOut,
  MapPin,
  TrendingUp,
} from 'lucide-react'
import QueryFeedback from '@/components/ui/QueryFeedback'
import { useClientePortalAuth } from '@/hooks/useClientePortalAuth'
import { clientPortalService, type ClientPortalDiarySummary } from '@/lib/client-portal-api'
import { cn, formatDate } from '@/lib/utils'
import { extractApiErrorMessage } from '@/lib/gontijo-api'

const statusClasses: Record<string, string> = {
  assinado: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  aprovado: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  pendente: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  rascunho: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
}

function formatSafeDate(value: string) {
  return value ? formatDate(value) : '-'
}

function getPhotoDate(photo: { dataFoto?: string; dataDiario?: string }) {
  const value = photo.dataFoto || photo.dataDiario || ''
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return match ? `${match[1]}-${match[2]}-${match[3]}` : ''
}

function formatPhotoDay(value: string) {
  if (!value) return 'Sem data'
  const [year, month, day] = value.split('-')
  const date = new Date(Number(year), Number(month) - 1, Number(day))
  const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(date)
  const formattedDate = new Intl.DateTimeFormat('pt-BR').format(date)
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} - ${formattedDate}`
}

export default function ClientePortalDashboardPage() {
  const { user, logout } = useClientePortalAuth()
  const [expandedPhotoDays, setExpandedPhotoDays] = useState<Record<string, boolean>>({})

  const dashboardQuery = useQuery({
    queryKey: ['client-portal-dashboard'],
    queryFn: clientPortalService.getDashboard,
    staleTime: 60_000,
  })

  const data = dashboardQuery.data
  const percent = data?.resumo.percentualConcluido ?? 0
  const latestDiary = data?.diarios[0]
  const photoGroups = useMemo(() => {
    const photos = data?.fotos ?? []
    const map = new Map<string, typeof photos>()

    photos
      .slice()
      .sort((a, b) => getPhotoDate(b).localeCompare(getPhotoDate(a)))
      .forEach((photo) => {
        const photoDate = getPhotoDate(photo)
        const key = photoDate || 'sem-data'
        const current = map.get(key) ?? []
        current.push(photo)
        map.set(key, current)
      })

    return Array.from(map.entries()).map(([key, photosByDay]) => ({
      key,
      label: key === 'sem-data' ? 'Sem data' : formatPhotoDay(key),
      shortLabel: key === 'sem-data' ? 'Sem data' : key.split('-').reverse().join('/'),
      photos: photosByDay,
    }))
  }, [data?.fotos])

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.28),transparent_32%),linear-gradient(180deg,#8d1f1f_0%,#7b1919_22%,#f6f2ef_22%,#f6f2ef_100%)] px-2 py-3 sm:px-4 sm:py-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <section className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_24px_56px_rgba(15,23,42,0.14)] sm:rounded-[34px] sm:shadow-[0_30px_80px_rgba(15,23,42,0.16)]">
          <div className="relative overflow-hidden bg-[linear-gradient(135deg,#b12929_0%,#811818_58%,#4b1010_100%)] px-4 py-5 text-white sm:px-6 sm:py-6">
            <div className="absolute right-[-90px] top-[-120px] h-72 w-72 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute bottom-[-120px] left-[18%] h-56 w-56 rounded-full bg-red-200/10 blur-2xl" />

            <div className="relative flex flex-wrap items-start justify-between gap-5">
              <div className="min-w-0">
                <div className="app-title text-2xl tracking-[0.08em] sm:text-3xl sm:tracking-[0.12em]">Portal do Cliente</div>
                <p className="mt-1 break-words text-sm text-red-50/80">
                  {user?.cliente || 'Cliente'} - acesso {user?.login || '-'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => logout()}
                className="inline-flex items-center gap-2 rounded-lg border border-white/18 bg-white/10 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/16 sm:px-4"
              >
                <LogOut size={16} />
                Sair
              </button>
            </div>

            {data ? (
              <>
                <div className="relative mt-8 grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
                  <div className="min-w-0">
                    <div className="inline-flex rounded-full bg-white/12 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-red-50">
                      Obra em acompanhamento
                    </div>
                    <h1 className="mt-3 break-words text-3xl font-black tracking-tight sm:text-4xl md:text-5xl">
                      Obra {data.obra.numero || '-'}
                    </h1>
                    <p className="mt-2 max-w-2xl break-words text-base text-red-50/85">
                      {data.obra.cliente || '-'} {data.obra.tipo ? `- ${data.obra.tipo}` : ''}
                    </p>

                    <div className="mt-5 flex flex-wrap gap-2 text-sm text-red-50/90 sm:gap-3">
                      <span className="inline-flex max-w-full items-center gap-2 rounded-lg bg-white/12 px-3 py-2">
                        <MapPin size={15} />
                        <span className="min-w-0 truncate">{[data.obra.cidade, data.obra.estado].filter(Boolean).join(' / ') || 'Localidade nao informada'}</span>
                      </span>
                      <span className="inline-flex max-w-full items-center gap-2 rounded-lg bg-white/12 px-3 py-2">
                        <CalendarDays size={15} />
                        <span className="min-w-0 truncate">Ultima atualizacao: {formatSafeDate(data.resumo.ultimaAtualizacao)}</span>
                      </span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/18 bg-white/12 p-4 backdrop-blur sm:rounded-[28px] sm:p-5">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-red-50/75">Progresso geral</div>
                        <div className="mt-2 text-4xl font-black sm:text-5xl">{percent}%</div>
                      </div>
                      <Gauge size={44} className="text-red-50/80" />
                    </div>
                    <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/20">
                      <div className="h-full rounded-full bg-white" style={{ width: `${Math.min(Math.max(percent, 0), 100)}%` }} />
                    </div>
                    <p className="mt-3 text-sm text-red-50/80">
                      {data.resumo.estacasExecutadas} de {data.resumo.estacasPlanejadas || 0} estacas previstas executadas.
                    </p>
                  </div>
                </div>

              </>
            ) : null}
          </div>

          <div className="p-3 sm:p-5 md:p-6">
            {dashboardQuery.isLoading ? (
              <QueryFeedback
                type="loading"
                title="Carregando obra"
                description="Buscando progresso, fotos e diarios liberados para este acesso."
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
                <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <MetricCard icon={FileText} label="Diarios disponiveis" value={String(data.resumo.totalDiarios)} detail={latestDiary ? `Ultimo: ${formatSafeDate(latestDiary.dataDiario)}` : 'Aguardando diarios'} />
                  <MetricCard icon={TrendingUp} label="Estacas executadas" value={String(data.resumo.estacasExecutadas)} detail={`${data.resumo.estacasRestantes} restantes`} tone="success" />
                </section>

                {photoGroups.length > 0 && (
                  <section className="overflow-hidden rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:rounded-[28px] sm:p-5">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                      <div className="min-w-0">
                        <h2 className="flex min-w-0 items-center gap-2 text-lg font-bold text-slate-900 sm:text-xl">
                          <Camera size={20} className="text-[var(--brand-red)]" />
                          <span className="truncate">Fotos da Obra</span>
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">Acompanhamento visual organizado por dia.</p>
                      </div>
                      <div className="self-start rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500 sm:self-auto sm:text-sm">
                        {photoGroups[0]?.key.slice(0, 4) || new Date().getFullYear()}
                      </div>
                    </div>

                    <div className="mt-5 grid gap-6 sm:mt-6 sm:border-l sm:border-slate-200 sm:pl-4">
                      {photoGroups.map((group) => {
                        const expanded = Boolean(expandedPhotoDays[group.key])
                        const visiblePhotos = expanded ? group.photos : group.photos.slice(0, 4)
                        const hiddenCount = Math.max(group.photos.length - visiblePhotos.length, 0)

                        return (
                          <div key={group.key} className="relative min-w-0 sm:pb-6 sm:last:pb-0">
                            <div className="absolute top-1 hidden h-2.5 w-2.5 rounded-full bg-slate-300 ring-4 ring-white sm:-left-[21px] sm:block" />
                            <div className="mb-3 flex min-w-0 items-end justify-between gap-2 sm:block">
                              <div className="min-w-0 truncate text-sm font-semibold text-slate-500">{group.label}</div>
                              <div className="shrink-0 text-xs font-black text-slate-900">{group.shortLabel}</div>
                            </div>

                            <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(104px,1fr))] gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
                              {visiblePhotos.map((photo, index) => {
                                const isLastCollapsed = !expanded && hiddenCount > 0 && index === visiblePhotos.length - 1

                                return (
                                  <a
                                    key={`${group.key}-${photo.diarioId}-${photo.url}-${index}`}
                                    href={photo.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="group relative aspect-[4/3] min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 shadow-sm"
                                  >
                                    <img
                                      src={photo.url}
                                      alt={photo.titulo || 'Foto da obra'}
                                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                                      loading="lazy"
                                    />
                                    {isLastCollapsed ? (
                                      <div className="absolute inset-0 grid place-items-center bg-black/42 text-center text-sm font-black text-white">
                                        Mais<br />{hiddenCount}
                                      </div>
                                    ) : null}
                                  </a>
                                )
                              })}
                            </div>

                            {group.photos.length > 4 ? (
                              <div className="mt-4 flex justify-center">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedPhotoDays((current) => ({
                                      ...current,
                                      [group.key]: !current[group.key],
                                    }))
                                  }
                                  className="w-full rounded-lg bg-slate-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-slate-700 sm:w-auto"
                                >
                                  {expanded ? 'Ver menos' : 'Ver mais fotos'}
                                </button>
                              </div>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  </section>
                )}

                <section className="grid gap-6">
                  <div className="rounded-xl border border-slate-200 bg-[linear-gradient(180deg,#fff8f7_0%,#ffffff_100%)] p-4 shadow-sm sm:rounded-[28px] sm:p-5">
                    <h2 className="text-xl font-bold text-slate-900">Resumo da obra</h2>
                    <div className="mt-4 grid gap-3">
                      <InfoCard label="Endereco" value={data.obra.endereco || '-'} />
                      <InfoCard label="Status" value={data.obra.status || '-'} />
                      <InfoCard label="Tipo/modalidade" value={data.obra.tipo || '-'} />
                    </div>
                  </div>
                </section>

                <section className="grid gap-6 lg:grid-cols-[1fr]">
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:rounded-[28px] sm:p-5">
                    <h2 className="text-xl font-bold text-slate-900">Linha do tempo</h2>
                    <p className="mt-1 text-sm text-slate-500">Ultimos movimentos relevantes da obra.</p>

                    <div className="mt-5 grid gap-3">
                      {data.timeline.length ? (
                        data.timeline.map((item) => (
                          <a
                            key={item.id}
                            href={item.pdfUrl || undefined}
                            target={item.pdfUrl ? '_blank' : undefined}
                            rel="noreferrer"
                            className="group grid grid-cols-[auto_1fr] gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 transition hover:border-red-200 hover:bg-red-50/50 sm:rounded-2xl sm:p-4"
                          >
                            <div className={cn(
                              'mt-1 flex h-9 w-9 items-center justify-center rounded-full bg-white ring-1',
                              item.tipo === 'ocorrencia'
                                ? 'text-amber-500 ring-amber-100'
                                : 'text-emerald-600 ring-emerald-100'
                            )}>
                              {item.tipo === 'ocorrencia' ? <AlertTriangle size={17} /> : <CheckCircle2 size={17} />}
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="min-w-0 break-words font-bold text-slate-900">{item.titulo}</div>
                                <div className="text-xs font-semibold text-slate-500">{formatSafeDate(item.data)}</div>
                              </div>
                              <p className="mt-1 break-words text-sm leading-6 text-slate-600">{item.descricao}</p>
                              {item.detalhe ? <div className="mt-1 break-words text-xs font-semibold text-slate-500">{item.detalhe}</div> : null}
                            </div>
                          </a>
                        ))
                      ) : (
                        <QueryFeedback type="empty" title="Sem historico" description="A linha do tempo sera criada conforme os diarios forem aprovados." />
                      )}
                    </div>
                  </div>
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:rounded-[28px] sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-bold text-slate-900">Diarios da obra</h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Registros recentes, producao do dia e acesso ao PDF de cada diario.
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:hidden">
                    {data.diarios.length ? (
                      data.diarios.map((diario) => <DiaryMobileCard key={diario.id} diario={diario} />)
                    ) : (
                      <QueryFeedback
                        type="empty"
                        title="Nenhum diario encontrado"
                        description="Ainda nao existem diarios vinculados a esta obra ativa."
                      />
                    )}
                  </div>

                  <div className="mt-5 hidden overflow-x-auto sm:block">
                    <table className="data-table min-w-[1020px]">
                      <thead>
                        <tr>
                          <th>Data</th>
                          <th>Status</th>
                          <th>Equipamento</th>
                          <th>Operador</th>
                          <th>Estacas</th>
                          <th>Clima</th>
                          <th>Fotos</th>
                          <th>PDF</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.diarios.length ? (
                          data.diarios.map((diario) => <DiaryRow key={diario.id} diario={diario} />)
                        ) : (
                          <tr>
                            <td colSpan={8}>
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

function DiaryRow({ diario }: { diario: ClientPortalDiarySummary }) {
  return (
    <tr>
      <td className="font-semibold text-slate-700">{formatSafeDate(diario.dataDiario)}</td>
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
      <td>{diario.clima || '-'}</td>
      <td>{diario.fotos.length}</td>
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
  )
}

function DiaryMobileCard({ diario }: { diario: ClientPortalDiarySummary }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 shadow-sm">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Diario</div>
          <div className="mt-1 text-base font-black text-slate-900">{formatSafeDate(diario.dataDiario)}</div>
        </div>
        <span
          className={cn(
            'shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]',
            statusClasses[diario.status] || statusClasses.rascunho
          )}
        >
          {diario.status || 'rascunho'}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <InfoPill label="Equipamento" value={diario.equipamento || '-'} />
        <InfoPill label="Operador" value={diario.operadorNome || '-'} />
        <InfoPill label="Estacas" value={String(diario.estacasNoDia)} />
        <InfoPill label="Fotos" value={String(diario.fotos.length)} />
      </div>

      <a
        href={diario.pdfUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-700 transition hover:border-[var(--brand-red)] hover:text-[var(--brand-red)]"
      >
        <FileText size={14} />
        Ver PDF
        <ExternalLink size={13} />
      </a>
    </article>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 sm:rounded-2xl">
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</div>
      <div className="mt-2 break-words text-sm font-medium leading-6 text-slate-700">{value}</div>
    </div>
  )
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</div>
      <div className="mt-1 truncate text-sm font-bold text-slate-800">{value}</div>
    </div>
  )
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
  tone = 'neutral',
}: {
  icon: typeof FileText
  label: string
  value: string
  detail: string
  tone?: 'success' | 'warning' | 'neutral'
}) {
  const toneClasses =
    tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : tone === 'warning'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : 'border-slate-200 bg-white text-slate-900'

  return (
    <div className={cn('rounded-xl border px-4 py-4 shadow-sm sm:rounded-[24px] sm:px-5 sm:py-5', toneClasses)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-70">{label}</div>
          <div className="mt-2 text-3xl font-black sm:text-4xl">{value}</div>
        </div>
        <Icon size={24} className="opacity-75" />
      </div>
      <div className="mt-3 text-sm font-semibold opacity-70">{detail}</div>
    </div>
  )
}
