import { useMutation, useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronDown,
  Download,
  ExternalLink,
  FileText,
  Filter,
  LogOut,
  MapPin,
  Paperclip,
  Pen,
  TrendingUp,
  X,
} from 'lucide-react'
import QueryFeedback from '@/components/ui/QueryFeedback'
import { useClientePortalAuth } from '@/hooks/useClientePortalAuth'
import { clientPortalService, type ClientPortalDiarySummary } from '@/lib/client-portal-api'
import { cn, formatDate } from '@/lib/utils'
import { extractApiErrorMessage } from '@/lib/gontijo-api'

const TIPO_DOC_LABELS: Record<string, string> = {
  pre_obra: 'Pré-obra',
  visita_primeiro_dia: 'Visita 1° dia',
  visita_tecnica: 'Visita técnica',
  projeto: 'Projeto',
  sondagem: 'Sondagem',
  medicao: 'Medição (PDF)',
  outro: 'Outro',
}

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  assinado: { label: 'Assinado', cls: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200' },
  aprovado: { label: 'Aprovado', cls: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200' },
  pendente: { label: 'Pendente', cls: 'bg-amber-100 text-amber-700 ring-1 ring-amber-200' },
  rascunho: { label: 'Rascunho', cls: 'bg-slate-100 text-slate-500 ring-1 ring-slate-200' },
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
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} — ${formattedDate}`
}

function formatBRL(value: number | null) {
  if (value == null) return '—'
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function ClientePortalDashboardPage() {
  const { user, logout } = useClientePortalAuth()
  const [expandedPhotoDays, setExpandedPhotoDays] = useState<Record<string, boolean>>({})
  const [filterDraft, setFilterDraft] = useState({ dataInicio: '', dataFim: '' })
  const [filterApplied, setFilterApplied] = useState({ dataInicio: '', dataFim: '' })

  const dashboardQuery = useQuery({
    queryKey: ['client-portal-dashboard', filterApplied],
    queryFn: () => clientPortalService.getDashboard({
      dataInicio: filterApplied.dataInicio || null,
      dataFim: filterApplied.dataFim || null,
    }),
    staleTime: 60_000,
  })

  const documentosQuery = useQuery({
    queryKey: ['client-portal-documentos'],
    queryFn: clientPortalService.getDocumentos,
    staleTime: 60_000,
  })

  const data = dashboardQuery.data
  const latestDiary = data?.diarios[0]
  const hasFilter = Boolean(filterApplied.dataInicio || filterApplied.dataFim)

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
    <div className="min-h-screen bg-[#f0ede9] px-2 py-3 sm:px-4 sm:py-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-5">

        {/* ── HEADER CARD ── */}
        <div className="overflow-hidden rounded-3xl shadow-2xl">

          {/* Hero */}
          <div className="relative overflow-hidden bg-[linear-gradient(135deg,#c0302e_0%,#8a1a1a_55%,#5a0f0f_100%)] px-5 pb-7 pt-5 text-white sm:px-8 sm:pt-6">
            {/* decorative blobs */}
            <div className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-white/8 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-16 left-1/3 h-56 w-56 rounded-full bg-red-300/10 blur-3xl" />
            <div className="pointer-events-none absolute right-1/4 top-0 h-40 w-40 rounded-full bg-white/5 blur-2xl" />

            {/* top bar */}
            <div className="relative flex items-center justify-between gap-4">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/50">Portal do Cliente</div>
                <div className="mt-0.5 text-sm font-semibold text-white/80">{user?.cliente || 'Cliente'}</div>
              </div>
              <button
                type="button"
                onClick={() => logout()}
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/8 px-3 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/15 hover:text-white"
              >
                <LogOut size={14} />
                Sair
              </button>
            </div>

            {data ? (
              <>
                {/* obra info */}
                <div className="relative mt-7 flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
                  <div className="flex-1 min-w-0">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      Obra em acompanhamento
                    </span>
                    <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl md:text-6xl">
                      Obra {data.obra.numero || '-'}
                    </h1>
                    <p className="mt-2 text-base font-medium text-white/70">
                      {data.obra.cliente || '-'}{data.obra.tipo ? ` · ${data.obra.tipo}` : ''}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Pill icon={<MapPin size={12} />} text={[data.obra.cidade, data.obra.estado].filter(Boolean).join(' / ') || 'Localidade não informada'} />
                      <Pill icon={<CalendarDays size={12} />} text={`Atualizado: ${formatSafeDate(data.resumo.ultimaAtualizacao)}`} />
                    </div>
                  </div>
                </div>

                {/* metric cards */}
                <div className="relative mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <MetricCard
                    icon={FileText}
                    label="Diários"
                    value={String(data.resumo.totalDiarios)}
                    detail={latestDiary ? `Último: ${formatSafeDate(latestDiary.dataDiario)}` : 'Nenhum ainda'}
                  />
                  <MetricCard
                    icon={TrendingUp}
                    label="Estacas"
                    value={String(data.resumo.estacasExecutadas)}
                    detail={`${data.resumo.estacasRestantes} restantes`}
                    tone="success"
                  />
                  {data.resumo.valorProducao != null && (
                    <MetricCard
                      icon={TrendingUp}
                      label="Valor produção"
                      value={`R$ ${formatBRL(data.resumo.valorProducao)}`}
                      detail="Diários aprovados"
                      tone="success"
                    />
                  )}
                  <MetricCard
                    icon={FileText}
                    label="Fat. mínimo"
                    value={`R$ ${formatBRL(data.resumo.valorFatMinimoCobrado)}`}
                    detail={`${data.resumo.medicoesComFatMinimo} medição${data.resumo.medicoesComFatMinimo === 1 ? '' : 'ões'}`}
                    tone={data.resumo.valorFatMinimoCobrado > 0 ? 'warning' : 'neutral'}
                  />
                </div>
              </>
            ) : null}
          </div>

          {/* white body */}
          <div className="bg-white px-4 py-5 sm:px-6 sm:py-6">
            {dashboardQuery.isLoading && (
              <QueryFeedback type="loading" title="Carregando obra" description="Buscando progresso, fotos e diários." />
            )}
            {dashboardQuery.isError && (
              <QueryFeedback type="error" title="Erro ao carregar" description={extractApiErrorMessage(dashboardQuery.error)} />
            )}

            {data && (
              <div className="flex flex-col gap-6">

                {/* filter bar */}
                <div className="flex flex-wrap items-end gap-3 rounded-2xl bg-slate-50 px-4 py-4 ring-1 ring-slate-200/70">
                  <Filter size={15} className="mb-2.5 shrink-0 text-slate-400" />
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">De</label>
                    <input
                      type="date"
                      value={filterDraft.dataInicio}
                      onChange={(e) => setFilterDraft((p) => ({ ...p, dataInicio: e.target.value }))}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Até</label>
                    <input
                      type="date"
                      value={filterDraft.dataFim}
                      onChange={(e) => setFilterDraft((p) => ({ ...p, dataFim: e.target.value }))}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setFilterApplied(filterDraft)}
                    className="rounded-xl bg-red-700 px-5 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-red-800"
                  >
                    Filtrar
                  </button>
                  {hasFilter && (
                    <button
                      type="button"
                      onClick={() => { setFilterDraft({ dataInicio: '', dataFim: '' }); setFilterApplied({ dataInicio: '', dataFim: '' }) }}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
                    >
                      <X size={13} /> Limpar
                    </button>
                  )}
                  {dashboardQuery.isFetching && <span className="text-xs text-slate-400">Atualizando...</span>}
                </div>

                {/* pending signatures alert */}
                {data.resumo.diariosPendentesAssinatura > 0 && (
                  <div className="overflow-hidden rounded-2xl border-2 border-red-300 bg-red-50">
                    <div className="flex items-start gap-3 px-5 py-4">
                      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100">
                        <AlertTriangle size={18} className="text-red-600" />
                      </div>
                      <div>
                        <h2 className="font-black text-red-800">
                          {data.resumo.diariosPendentesAssinatura} diário{data.resumo.diariosPendentesAssinatura === 1 ? '' : 's'} aguardando sua assinatura
                        </h2>
                        <p className="mt-0.5 text-sm text-red-600">Clique em "Assinar agora" para revisar e assinar cada diário.</p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-0 divide-y divide-red-100 border-t border-red-200 bg-white/60">
                      {data.assinaturasPendentes.map((d) => (
                        <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                          <span className="text-sm font-semibold text-red-900">
                            {formatSafeDate(d.dataDiario)} · {d.equipamento || 'Equipamento'}
                          </span>
                          {d.signingUrl ? (
                            <a
                              href={d.signingUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 rounded-xl bg-red-700 px-4 py-2 text-xs font-bold text-white transition hover:bg-red-800"
                            >
                              <Pen size={12} /> Assinar agora
                            </a>
                          ) : (
                            <span className="rounded-full bg-red-100 px-3 py-1 text-[11px] font-bold uppercase text-red-600">
                              Aguardando
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* diários */}
                <DiariosSection diarios={data.diarios} pendingSignatures={data.assinaturasPendentes} />

                {/* photos */}
                {photoGroups.length > 0 && (
                  <SectionCard
                    title="Fotos da Obra"
                    subtitle="Acompanhamento visual organizado por dia."
                    icon={<Camera size={18} className="text-red-600" />}
                    badge={photoGroups[0]?.key.slice(0, 4) || String(new Date().getFullYear())}
                  >
                    <div className="mt-5 grid gap-8 sm:border-l sm:border-slate-100 sm:pl-4">
                      {photoGroups.map((group) => {
                        const expanded = Boolean(expandedPhotoDays[group.key])
                        const visiblePhotos = expanded ? group.photos : group.photos.slice(0, 4)
                        const hiddenCount = Math.max(group.photos.length - visiblePhotos.length, 0)
                        return (
                          <div key={group.key} className="relative min-w-0">
                            <div className="absolute top-1.5 hidden h-2 w-2 rounded-full bg-slate-300 ring-4 ring-white sm:-left-[18px] sm:block" />
                            <div className="mb-3 flex min-w-0 items-end justify-between gap-2">
                              <div className="min-w-0 truncate text-sm font-semibold text-slate-500">{group.label}</div>
                              <div className="shrink-0 text-xs font-black text-slate-700">{group.shortLabel}</div>
                            </div>
                            <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(110px,1fr))] gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4">
                              {visiblePhotos.map((photo, index) => {
                                const isLastCollapsed = !expanded && hiddenCount > 0 && index === visiblePhotos.length - 1
                                return (
                                  <a
                                    key={`${group.key}-${photo.diarioId}-${photo.url}-${index}`}
                                    href={photo.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-slate-100 bg-slate-100 shadow-sm"
                                  >
                                    <img
                                      src={photo.url}
                                      alt={photo.titulo || 'Foto da obra'}
                                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                                      loading="lazy"
                                    />
                                    {isLastCollapsed && (
                                      <div className="absolute inset-0 grid place-items-center bg-black/50 text-sm font-black text-white">
                                        +{hiddenCount}
                                      </div>
                                    )}
                                  </a>
                                )
                              })}
                            </div>
                            {group.photos.length > 4 && (
                              <button
                                type="button"
                                onClick={() => setExpandedPhotoDays((c) => ({ ...c, [group.key]: !c[group.key] }))}
                                className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-100"
                              >
                                <ChevronDown size={14} className={cn('transition-transform', expanded && 'rotate-180')} />
                                {expanded ? 'Ver menos' : 'Ver mais fotos'}
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </SectionCard>
                )}

                {/* obra summary + timeline side-by-side on large */}
                <div className="grid gap-5 lg:grid-cols-2">
                  <SectionCard title="Resumo da obra" icon={<MapPin size={16} className="text-red-600" />}>
                    <div className="mt-4 grid gap-2">
                      <InfoRow label="Endereço" value={data.obra.endereco || '-'} />
                      <InfoRow label="Status" value={data.obra.status || '-'} />
                      <InfoRow label="Tipo / modalidade" value={data.obra.tipo || '-'} />
                    </div>
                  </SectionCard>

                  <SectionCard title="Linha do tempo" subtitle="Últimos movimentos relevantes." icon={<CheckCircle2 size={16} className="text-red-600" />}>
                    <div className="mt-4 flex flex-col gap-2">
                      {data.timeline.length ? (
                        data.timeline.map((item) => (
                          <a
                            key={item.id}
                            href={item.pdfUrl || undefined}
                            target={item.pdfUrl ? '_blank' : undefined}
                            rel="noreferrer"
                            className="group flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3 transition hover:border-red-100 hover:bg-red-50/40"
                          >
                            <div className={cn(
                              'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white ring-1',
                              item.tipo === 'ocorrencia' ? 'text-amber-500 ring-amber-100' : 'text-emerald-500 ring-emerald-100'
                            )}>
                              {item.tipo === 'ocorrencia' ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center justify-between gap-1">
                                <div className="min-w-0 break-words text-sm font-bold text-slate-800">{item.titulo}</div>
                                <div className="shrink-0 text-[11px] text-slate-400">{formatSafeDate(item.data)}</div>
                              </div>
                              <p className="mt-0.5 break-words text-xs leading-5 text-slate-500">{item.descricao}</p>
                            </div>
                          </a>
                        ))
                      ) : (
                        <QueryFeedback type="empty" title="Sem histórico" description="A linha do tempo será criada conforme os diários forem aprovados." />
                      )}
                    </div>
                  </SectionCard>
                </div>

                {/* documents */}
                {documentosQuery.data && documentosQuery.data.length > 0 && (
                  <SectionCard
                    title="Relatórios e Documentos"
                    subtitle="Arquivos disponibilizados pela equipe Gontijo."
                    icon={<Paperclip size={16} className="text-blue-500" />}
                  >
                    <div className="mt-4 flex flex-col gap-5">
                      {Object.entries(
                        documentosQuery.data.reduce<Record<string, typeof documentosQuery.data>>((acc, doc) => {
                          const key = doc.tipo || 'outro'
                          if (!acc[key]) acc[key] = []
                          acc[key].push(doc)
                          return acc
                        }, {})
                      ).map(([tipo, docs]) => (
                        <div key={tipo}>
                          <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-blue-500">
                            {TIPO_DOC_LABELS[tipo] ?? tipo}
                          </div>
                          <div className="grid gap-1.5">
                            {docs.map((doc) => (
                              <a
                                key={doc.id}
                                href={clientPortalService.getDocumentoDownloadUrl(doc.id)}
                                download={doc.nome_original}
                                className="group flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 transition hover:border-blue-200 hover:bg-blue-50"
                              >
                                <div className="flex min-w-0 items-center gap-3">
                                  <FileText size={16} className="shrink-0 text-blue-400" />
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-semibold text-slate-700">{doc.nome_original}</div>
                                    {doc.tamanho ? <div className="text-xs text-slate-400">{Math.round(doc.tamanho / 1024)} KB</div> : null}
                                  </div>
                                </div>
                                <Download size={15} className="shrink-0 text-slate-300 group-hover:text-blue-500" />
                              </a>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </SectionCard>
                )}

              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── SUB-COMPONENTS ── */

function Pill({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white/75">
      {icon}
      <span className="min-w-0 truncate">{text}</span>
    </span>
  )
}

function SectionCard({
  title,
  subtitle,
  icon,
  badge,
  children,
}: {
  title: string
  subtitle?: string
  icon?: React.ReactNode
  badge?: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {icon && <div className="mt-0.5">{icon}</div>}
          <div>
            <h2 className="text-base font-bold text-slate-900 sm:text-lg">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
        </div>
        {badge && (
          <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">{badge}</span>
        )}
      </div>
      {children}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl bg-slate-50 px-4 py-3">
      <span className="shrink-0 text-xs font-semibold text-slate-400">{label}</span>
      <span className="text-right text-sm font-semibold text-slate-700">{value}</span>
    </div>
  )
}

function DiariosSection({
  diarios,
  pendingSignatures,
}: {
  diarios: ClientPortalDiarySummary[]
  pendingSignatures: import('@/lib/client-portal-api').ClientPortalPendingSignature[]
}) {
  const signingUrlById = new Map(pendingSignatures.filter((p) => p.signingUrl).map((p) => [p.id, p.signingUrl]))

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-red-600" />
          <div>
            <h2 className="text-base font-bold text-slate-900 sm:text-lg">Diários da obra</h2>
            <p className="text-xs text-slate-500">Registros de produção, PDF e assinatura.</p>
          </div>
        </div>
      </div>

      {/* mobile cards */}
      <div className="flex flex-col gap-0 divide-y divide-slate-100 sm:hidden">
        {diarios.length ? (
          diarios.map((d) => <DiaryMobileCard key={d.id} diario={d} signingUrl={signingUrlById.get(d.id)} />)
        ) : (
          <div className="p-5">
            <QueryFeedback type="empty" title="Nenhum diário" description="Ainda não existem diários vinculados a esta obra." />
          </div>
        )}
      </div>

      {/* desktop table */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/70">
              {['Data', 'Status', 'Equipamento', 'Operador', 'Estacas', 'Clima', 'PDF', 'Assinatura'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {diarios.length ? (
              diarios.map((d) => <DiaryRow key={d.id} diario={d} signingUrl={signingUrlById.get(d.id)} />)
            ) : (
              <tr>
                <td colSpan={8} className="p-8">
                  <QueryFeedback type="empty" title="Nenhum diário" description="Ainda não existem diários vinculados a esta obra." />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function canSign(status: string) {
  return status === 'pendente' || status === 'aprovado'
}

function SignButton({ diarioId, signingUrl }: { diarioId: number; signingUrl?: string }) {
  const [url, setUrl] = useState(signingUrl || '')
  const mutation = useMutation({
    mutationFn: () => clientPortalService.solicitarAssinatura(diarioId),
    onSuccess: (newUrl) => { setUrl(newUrl); window.open(newUrl, '_blank', 'noreferrer') },
  })

  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 rounded-lg bg-red-700 px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-red-800"
      >
        <Pen size={11} /> Assinar
      </a>
    )
  }

  return (
    <button
      type="button"
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending}
      className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-[11px] font-bold text-red-700 transition hover:bg-red-700 hover:text-white disabled:opacity-50"
    >
      <Pen size={11} /> {mutation.isPending ? '...' : 'Assinar'}
    </button>
  )
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.rascunho
  return (
    <span className={cn('inline-flex rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide', cfg.cls)}>
      {cfg.label}
    </span>
  )
}

function DiaryRow({ diario, signingUrl }: { diario: ClientPortalDiarySummary; signingUrl?: string }) {
  return (
    <tr className="transition hover:bg-slate-50/60">
      <td className="px-4 py-3 font-semibold text-slate-700">{formatSafeDate(diario.dataDiario)}</td>
      <td className="px-4 py-3"><StatusBadge status={diario.status} /></td>
      <td className="px-4 py-3 text-slate-600">{diario.equipamento || '-'}</td>
      <td className="px-4 py-3 text-slate-600">{diario.operadorNome || '-'}</td>
      <td className="px-4 py-3 font-bold text-slate-800">{diario.estacasNoDia}</td>
      <td className="px-4 py-3 text-slate-500">{diario.clima || '-'}</td>
      <td className="px-4 py-3">
        <a
          href={diario.pdfUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:border-red-200 hover:text-red-700"
        >
          <FileText size={12} /> PDF <ExternalLink size={11} />
        </a>
      </td>
      <td className="px-4 py-3">
        {canSign(diario.status)
          ? <SignButton diarioId={diario.id} signingUrl={signingUrl} />
          : <span className="text-slate-300">—</span>}
      </td>
    </tr>
  )
}

function DiaryMobileCard({ diario, signingUrl }: { diario: ClientPortalDiarySummary; signingUrl?: string }) {
  return (
    <div className="flex flex-col gap-3 px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-base font-black text-slate-900">{formatSafeDate(diario.dataDiario)}</div>
          <div className="mt-0.5 text-xs text-slate-500">{diario.equipamento || '-'} · {diario.operadorNome || '-'}</div>
        </div>
        <StatusBadge status={diario.status} />
      </div>
      <div className="flex gap-2 text-xs text-slate-500">
        <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-semibold">{diario.estacasNoDia} estacas</span>
        {diario.clima && <span className="rounded-lg bg-slate-100 px-2.5 py-1">{diario.clima}</span>}
      </div>
      <div className="flex gap-2">
        <a
          href={diario.pdfUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 py-2 text-xs font-bold text-slate-600 transition hover:border-red-200 hover:text-red-700"
        >
          <FileText size={13} /> Ver PDF <ExternalLink size={12} />
        </a>
        {canSign(diario.status) && (
          <div className="flex-1 flex">
            <div className="flex-1">
              <SignButton diarioId={diario.id} signingUrl={signingUrl} />
            </div>
          </div>
        )}
      </div>
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
  const isWarning = tone === 'warning'

  return (
    <div className={cn(
      'rounded-2xl border px-4 py-4',
      isWarning
        ? 'border-amber-400/50 bg-amber-500/30'
        : 'border-white/15 bg-black/20',
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/50">{label}</div>
        <Icon size={15} className="shrink-0 text-white/35" />
      </div>
      <div className="mt-2 text-2xl font-black text-white sm:text-3xl">{value}</div>
      <div className="mt-1.5 text-[11px] font-medium text-white/50">{detail}</div>
    </div>
  )
}
