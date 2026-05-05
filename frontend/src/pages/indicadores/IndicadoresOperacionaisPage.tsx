import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart3, Clock3, FileSignature, RefreshCcw, Search } from 'lucide-react'
import QueryFeedback from '@/components/ui/QueryFeedback'
import { extractApiErrorMessage, operationalIndicatorsService } from '@/lib/gontijo-api'

type Filters = {
  dateFrom: string
  dateTo: string
  operator: string
  obra: string
}

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10)
}

function defaultFilters(): Filters {
  const now = new Date()
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
  return {
    dateFrom: dateOnly(firstDay),
    dateTo: dateOnly(now),
    operator: '',
    obra: '',
  }
}

function formatDate(value: string) {
  if (!value) return '-'
  const text = String(value).slice(0, 10)
  const [year, month, day] = text.split('-')
  if (!year || !month || !day) return value
  return `${day}/${month}/${year}`
}

function formatDateTime(value: string) {
  if (!value) return '-'
  const parsed = new Date(String(value).replace(' ', 'T'))
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(parsed)
}

function formatDuration(minutes: number | null) {
  if (minutes == null) return '-'
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours < 24) return rest ? `${hours}h ${rest}min` : `${hours}h`
  const days = Math.floor(hours / 24)
  const dayHours = hours % 24
  return dayHours ? `${days}d ${dayHours}h` : `${days}d`
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    sent: 'Enviada',
    failed: 'Falhou',
    skipped: 'Ignorada',
    queued: 'Fila',
    signed: 'Assinado',
    active: 'Pendente',
    expired: 'Expirado',
    revoked: 'Revogado',
  }
  return labels[status] || status || '-'
}

function statusClass(status: string) {
  if (status === 'sent' || status === 'signed') return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
  if (status === 'failed' || status === 'expired') return 'bg-red-50 text-red-700 ring-1 ring-red-200'
  if (status === 'active' || status === 'queued') return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
  return 'bg-slate-100 text-slate-600 ring-1 ring-slate-200'
}

export default function IndicadoresOperacionaisPage() {
  const [filters, setFilters] = useState<Filters>(() => defaultFilters())
  const [appliedFilters, setAppliedFilters] = useState<Filters>(() => defaultFilters())

  const indicatorsQuery = useQuery({
    queryKey: ['operational-indicators', appliedFilters],
    queryFn: () => operationalIndicatorsService.get(appliedFilters),
  })

  const data = indicatorsQuery.data
  const signatureSummary = data?.signatures.summary
  const delaySummary = data?.delays.summary

  const periodLabel = useMemo(() => {
    if (!appliedFilters.dateFrom && !appliedFilters.dateTo) return 'Todo o periodo'
    return `${formatDate(appliedFilters.dateFrom) || '-'} ate ${formatDate(appliedFilters.dateTo) || '-'}`
  }, [appliedFilters])

  function updateField<K extends keyof Filters>(field: K, value: Filters[K]) {
    setFilters((current) => ({ ...current, [field]: value }))
  }

  function applyFilters(event: React.FormEvent) {
    event.preventDefault()
    setAppliedFilters(filters)
  }

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-heading">Indicadores Operacionais</h1>
          <p className="page-subtitle">Atrasos notificados via WhatsApp e conversao de assinatura dos diarios.</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => indicatorsQuery.refetch()}>
          <RefreshCcw size={15} />
          Atualizar
        </button>
      </div>

      <form onSubmit={applyFilters} className="app-panel section-panel">
        <div className="grid gap-4 md:grid-cols-5">
          <label className="field-group">
            <span className="field-label">Inicio</span>
            <input className="field-input" type="date" value={filters.dateFrom} onChange={(event) => updateField('dateFrom', event.target.value)} />
          </label>
          <label className="field-group">
            <span className="field-label">Fim</span>
            <input className="field-input" type="date" value={filters.dateTo} onChange={(event) => updateField('dateTo', event.target.value)} />
          </label>
          <label className="field-group">
            <span className="field-label">Operador</span>
            <input className="field-input" value={filters.operator} onChange={(event) => updateField('operator', event.target.value)} placeholder="Nome" />
          </label>
          <label className="field-group">
            <span className="field-label">Obra</span>
            <input className="field-input" value={filters.obra} onChange={(event) => updateField('obra', event.target.value)} placeholder="Numero" />
          </label>
          <div className="flex items-end">
            <button type="submit" className="btn btn-primary w-full">
              <Search size={15} />
              Filtrar
            </button>
          </div>
        </div>
      </form>

      {indicatorsQuery.isLoading ? (
        <QueryFeedback type="loading" title="Carregando indicadores" description="Consolidando logs de atraso e assinaturas." />
      ) : null}
      {indicatorsQuery.isError ? (
        <QueryFeedback type="error" title="Erro ao carregar indicadores" description={extractApiErrorMessage(indicatorsQuery.error)} />
      ) : null}

      {data ? (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <MetricCard
              icon={Clock3}
              label="Atrasos notificados"
              value={String(delaySummary?.sent || 0)}
              detail={`${delaySummary?.operators || 0} operador(es), ${delaySummary?.constructions || 0} obra(s)`}
              tone="red"
            />
            <MetricCard
              icon={FileSignature}
              label="Taxa de assinatura"
              value={`${signatureSummary?.rate || 0}%`}
              detail={`${signatureSummary?.signed || 0}/${signatureSummary?.total || 0} links assinados`}
              tone="green"
            />
            <MetricCard
              icon={BarChart3}
              label="Tempo medio de assinatura"
              value={formatDuration(signatureSummary?.averageMinutesToSign ?? null)}
              detail={periodLabel}
              tone="slate"
            />
          </div>

          <section className="app-panel section-panel">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="section-heading !mb-1">Atrasos notificados por operador</h2>
                <p className="text-sm text-slate-500">Conta atraso quando a mensagem de diario atrasado foi enviada com sucesso.</p>
              </div>
              <span className="rounded-full bg-red-50 px-3 py-1 text-sm font-bold text-red-700">{delaySummary?.failed || 0} falha(s)</span>
            </div>

            {data.delays.operators.length ? (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Operador</th>
                      <th>Telefone</th>
                      <th>Enviadas</th>
                      <th>Falhas</th>
                      <th>Obras</th>
                      <th>Ultima notificacao</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.delays.operators.map((row) => (
                      <tr key={row.operatorName}>
                        <td className="font-semibold text-slate-900">{row.operatorName}</td>
                        <td>{row.phone || '-'}</td>
                        <td>{row.sentNotifications}</td>
                        <td>{row.failedNotifications}</td>
                        <td>{row.constructions}</td>
                        <td>{formatDateTime(row.lastNotificationAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <QueryFeedback type="empty" title="Sem atrasos notificados" description="Nao ha mensagens enviadas para os filtros atuais." />
            )}
          </section>

          <section className="app-panel section-panel">
            <div className="mb-4">
              <h2 className="section-heading !mb-1">Assinaturas de cliente</h2>
              <p className="text-sm text-slate-500">Links enviados para assinatura e seus status no periodo filtrado.</p>
            </div>

            <div className="mb-4 grid gap-3 sm:grid-cols-4">
              <SmallStat label="Assinados" value={signatureSummary?.signed || 0} />
              <SmallStat label="Pendentes" value={signatureSummary?.active || 0} />
              <SmallStat label="Expirados" value={signatureSummary?.expired || 0} />
              <SmallStat label="Revogados" value={signatureSummary?.revoked || 0} />
            </div>

            {data.signatures.recent.length ? (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Diario</th>
                      <th>Obra</th>
                      <th>Cliente</th>
                      <th>Operador</th>
                      <th>Enviado em</th>
                      <th>Assinado em</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.signatures.recent.map((row) => (
                      <tr key={row.id}>
                        <td className="font-semibold text-slate-900">#{row.diaryId}</td>
                        <td>{row.obraNumero || '-'}</td>
                        <td>{row.clientName || '-'}</td>
                        <td>{row.operatorName || '-'}</td>
                        <td>{formatDateTime(row.sentAt)}</td>
                        <td>{formatDateTime(row.signedAt)}</td>
                        <td><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClass(row.status)}`}>{statusLabel(row.status)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <QueryFeedback type="empty" title="Sem links de assinatura" description="Nenhum link encontrado para os filtros atuais." />
            )}
          </section>
        </>
      ) : null}
    </div>
  )
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: typeof BarChart3
  label: string
  value: string
  detail: string
  tone: 'red' | 'green' | 'slate'
}) {
  const toneClass = {
    red: 'border-red-100 bg-red-50 text-red-700',
    green: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    slate: 'border-slate-200 bg-white text-slate-700',
  }[tone]

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl border ${toneClass}`}>
        <Icon size={21} />
      </div>
      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</div>
      <div className="mt-2 text-3xl font-black text-slate-900">{value}</div>
      <div className="mt-1 text-sm text-slate-500">{detail}</div>
    </article>
  )
}

function SmallStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-black text-slate-900">{value}</div>
    </div>
  )
}
