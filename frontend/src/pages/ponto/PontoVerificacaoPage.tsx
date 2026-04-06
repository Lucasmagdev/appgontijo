import { useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Fingerprint,
  LoaderCircle,
  RefreshCcw,
  Search,
  ShieldAlert,
  UserRoundX,
} from 'lucide-react'
import QueryFeedback from '@/components/ui/QueryFeedback'
import {
  extractApiErrorMessage,
  setorService,
  solidesPointService,
  usuarioService,
  type SolidesPointCheckParams,
} from '@/lib/gontijo-api'
import { cn } from '@/lib/utils'

type FiltersState = SolidesPointCheckParams

const DEFAULT_FILTERS: FiltersState = {
  date: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }),
  sectorId: null,
  userId: null,
  onlyActiveUsers: true,
  requireClosingPunch: true,
  ignoreWithoutSchedule: true,
  showFired: false,
  statusFilter: '',
  entryToleranceMinutes: 0,
  exitToleranceMinutes: 0,
}

function formatDateBr(value: string) {
  if (!value) return '-'

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (match) return `${match[3]}/${match[2]}/${match[1]}`

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parsed)
}

function formatCpf(value: string) {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.length !== 11) return value || '-'
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

function SummaryCard({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string
  value: number
  tone: 'emerald' | 'amber' | 'red' | 'slate'
  icon: typeof CheckCircle2
}) {
  const toneClass =
    tone === 'emerald'
      ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
      : tone === 'amber'
        ? 'border-amber-100 bg-amber-50 text-amber-700'
        : tone === 'red'
          ? 'border-red-100 bg-red-50 text-red-700'
          : 'border-slate-100 bg-slate-50 text-slate-700'

  return (
    <article className={cn('rounded-2xl border px-4 py-4 shadow-sm', toneClass)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em]">{label}</div>
          <div className="mt-2 text-3xl font-black">{value}</div>
        </div>
        <div className="rounded-xl bg-white/70 p-2">
          <Icon size={18} />
        </div>
      </div>
    </article>
  )
}

export default function PontoVerificacaoPage() {
  const [filters, setFilters] = useState<FiltersState>(DEFAULT_FILTERS)
  const [hasSearched, setHasSearched] = useState(false)
  const [showOnlyLinked, setShowOnlyLinked] = useState(false)
  const [submittedFilters, setSubmittedFilters] = useState<FiltersState | null>(null)
  const [requestVersion, setRequestVersion] = useState(0)

  const statusQuery = useQuery({
    queryKey: ['solides-status'],
    queryFn: solidesPointService.getStatus,
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 5,
  })

  const setoresQuery = useQuery({
    queryKey: ['setores'],
    queryFn: setorService.list,
    staleTime: 1000 * 60 * 15,
  })

  const usuariosQuery = useQuery({
    queryKey: ['usuarios-ponto-check-options', filters.onlyActiveUsers],
    queryFn: () =>
      usuarioService.list({
        page: 1,
        limit: 500,
        status: filters.onlyActiveUsers ? 'ativo' : undefined,
      }),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 15,
  })

  const verificationQuery = useQuery({
    queryKey: ['solides-daily-point-check', submittedFilters, requestVersion],
    queryFn: () => solidesPointService.checkDaily(submittedFilters as FiltersState),
    enabled: hasSearched && Boolean(submittedFilters),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    retry: false,
  })

  const filteredUsers = useMemo(() => {
    const rows = usuariosQuery.data?.items ?? []
    if (!filters.sectorId) return rows
    return rows.filter((item) => {
      const anyItem = item as unknown as { setorId?: number | null }
      return Number(anyItem.setorId || 0) === Number(filters.sectorId)
    })
  }, [filters.sectorId, usuariosQuery.data?.items])

  const selectedDateLabel = useMemo(() => formatDateBr(filters.date), [filters.date])
  const checkedDateLabel = useMemo(
    () => formatDateBr(verificationQuery.data?.date || filters.date),
    [filters.date, verificationQuery.data?.date]
  )
  const hasVerificationData = Boolean(verificationQuery.data)
  const isRefreshingVerification = verificationQuery.isFetching && hasVerificationData
  const isFirstVerificationLoading = verificationQuery.isLoading && !hasVerificationData
  const visibleItems = useMemo(() => {
    const items = verificationQuery.data?.items ?? []
    if (!showOnlyLinked) return items
    return items.filter((item) => Boolean(item.solidesEmployeeId))
  }, [showOnlyLinked, verificationQuery.data?.items])

  function updateField<K extends keyof FiltersState>(key: K, value: FiltersState[K]) {
    setFilters((current) => ({ ...current, [key]: value }))
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmittedFilters({ ...filters })
    setRequestVersion((current) => current + 1)
    setHasSearched(true)
  }

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-heading">Verificação diária de ponto</h1>
          <p className="page-subtitle">
            Cruza usuários do sistema com a Sólides por CPF e valida marcações e status do ponto.
          </p>
        </div>
      </div>

      {statusQuery.isLoading ? (
        <QueryFeedback
          type="loading"
          title="Validando integração com a Sólides"
          description="Testando token, cadastros e módulo de ponto."
        />
      ) : null}

      {statusQuery.isError ? (
        <QueryFeedback
          type="error"
          title="Não foi possível validar a Sólides"
          description={extractApiErrorMessage(statusQuery.error)}
        />
      ) : null}

      {statusQuery.data ? (
        <section className="app-panel section-panel">
          <div className="mb-4 flex items-center gap-2 text-slate-700">
            <Fingerprint size={18} />
            <h2 className="section-heading !mb-0">Status da integração</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <SummaryCard
              label="Token"
              value={statusQuery.data.tokenConfigured ? 1 : 0}
              tone={statusQuery.data.tokenConfigured ? 'emerald' : 'red'}
              icon={CheckCircle2}
            />
            <SummaryCard
              label="Cadastros"
              value={statusQuery.data.employeesEnabled ? statusQuery.data.employeesCount : 0}
              tone={statusQuery.data.employeesEnabled ? 'emerald' : 'red'}
              icon={UserRoundX}
            />
            <SummaryCard
              label="Módulo ponto"
              value={statusQuery.data.punchEnabled ? 1 : 0}
              tone={statusQuery.data.punchEnabled ? 'emerald' : 'amber'}
              icon={Clock3}
            />
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <div className="font-semibold text-slate-900">
              {statusQuery.data.accountName || 'Conta não identificada'}
            </div>
            <div className="mt-1">{statusQuery.data.message}</div>
          </div>
        </section>
      ) : null}

      <section className="app-panel section-panel">
        <div className="mb-4 flex items-center gap-2 text-slate-700">
          <Search size={18} />
          <h2 className="section-heading !mb-0">Parâmetros da verificação</h2>
        </div>

        <div className="mb-5 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white px-4 py-4">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Conferência selecionada
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <div className="rounded-xl bg-slate-900 px-3 py-2 text-lg font-black text-white">
                {selectedDateLabel}
              </div>
              <div className="text-sm text-slate-600">
                O sistema cruza os usuários locais com a Sólides por <strong>CPF</strong> e classifica o dia conforme vínculo, marcações e aprovação do ponto.
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle size={16} />
              Como ler esse painel
            </div>
            <div className="mt-2 leading-6">
              <strong>OK</strong> significa vínculo encontrado, pelo menos <strong>4 batidas</strong>, foto em todas elas e status aprovado na Sólides. <strong>Sem vínculo</strong> indica que o CPF do usuário ainda não foi localizado na Sólides.
            </div>
          </div>
        </div>

        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="filter-grid">
            <div className="filter-col-2">
              <label className="field-label">Data</label>
              <input
                type="date"
                className="field-input"
                value={filters.date}
                onChange={(event) => updateField('date', event.target.value)}
              />
            </div>

            <div className="filter-col-2">
              <label className="field-label">Setor</label>
              <select
                className="field-select"
                value={filters.sectorId ?? ''}
                onChange={(event) =>
                  updateField('sectorId', event.target.value ? Number(event.target.value) : null)
                }
              >
                <option value="">Todos os setores</option>
                {setoresQuery.data?.map((setor) => (
                  <option key={setor.id} value={setor.id}>
                    {setor.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-col-4">
              <label className="field-label">Colaborador</label>
              <select
                className="field-select"
                value={filters.userId ?? ''}
                onChange={(event) =>
                  updateField('userId', event.target.value ? Number(event.target.value) : null)
                }
              >
                <option value="">Todos os colaboradores</option>
                {filteredUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-col-2">
              <label className="field-label">Status Sólides</label>
              <select
                className="field-select"
                value={filters.statusFilter}
                onChange={(event) =>
                  updateField(
                    'statusFilter',
                    event.target.value as FiltersState['statusFilter']
                  )
                }
              >
                <option value="">Todos</option>
                <option value="APPROVED">Aprovado</option>
                <option value="PENDING">Pendente</option>
                <option value="REPROVED">Reprovado</option>
              </select>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={filters.onlyActiveUsers}
                onChange={(event) => updateField('onlyActiveUsers', event.target.checked)}
              />
              Somente usuários ativos
            </label>
            <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={filters.requireClosingPunch}
                onChange={(event) => updateField('requireClosingPunch', event.target.checked)}
              />
              Exigir saída registrada
            </label>
            <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={filters.showFired}
                onChange={(event) => updateField('showFired', event.target.checked)}
              />
              Incluir demitidos na Sólides
            </label>
          </div>

          <div className="flex flex-wrap gap-3">
            <button type="submit" className="btn btn-primary" disabled={verificationQuery.isFetching}>
              {verificationQuery.isFetching ? (
                <LoaderCircle size={15} className="animate-spin" />
              ) : (
                <Search size={15} />
              )}
              {verificationQuery.isFetching ? 'Atualizando verificação...' : 'Verificar pontos'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={verificationQuery.isFetching}
              onClick={() => {
                setFilters(DEFAULT_FILTERS)
                setHasSearched(false)
              }}
            >
              <RefreshCcw size={15} />
              Resetar filtros
            </button>
          </div>
        </form>
      </section>

      {!hasSearched ? (
        <QueryFeedback
          type="empty"
          title="Defina os filtros e inicie a conferência"
          description="Escolha a data desejada, aplique os filtros necessários e clique em “Verificar pontos” para carregar o painel."
        />
      ) : null}

      {isFirstVerificationLoading ? (
        <QueryFeedback
          type="loading"
          title="Conferindo os pontos do dia"
          description="Buscando usuários, escalas e marcações para montar a verificação."
        />
      ) : null}

      {verificationQuery.isError ? (
        <QueryFeedback
          type="error"
          title="Não foi possível conferir os pontos"
          description={extractApiErrorMessage(verificationQuery.error)}
        />
      ) : null}

      {verificationQuery.data ? (
        <>
          {isRefreshingVerification ? (
            <div className="mb-4 flex items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              <LoaderCircle size={16} className="animate-spin" />
              Atualizando a conferência de <strong>{checkedDateLabel}</strong> sem perder os dados já exibidos.
            </div>
          ) : null}

          <section className="mb-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Resultado da conferência
                </div>
                <div className="mt-1 text-2xl font-black text-slate-900">{checkedDateLabel}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <div className="font-semibold text-slate-900">
                  {verificationQuery.data.items.length} colaboradores avaliados
                </div>
                <div className="mt-1">
                  Resultado calculado com base em vínculo por CPF, 4 batidas no dia, foto nas batidas, saída registrada e status do ponto na Sólides.
                </div>
              </div>
            </div>

            {verificationQuery.data.summary.semVinculo > 0 ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <div className="font-semibold">Há colaboradores sem vínculo com a Sólides.</div>
                <div className="mt-1">
                  {verificationQuery.data.summary.semVinculo} registro(s) ainda não encontraram correspondência por CPF. Enquanto isso acontecer, esses colaboradores nunca aparecerão como <strong>OK</strong>.
                </div>
              </div>
            ) : null}
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <SummaryCard
              label="Total"
              value={verificationQuery.data.summary.total}
              tone="slate"
              icon={Fingerprint}
            />
            <SummaryCard
              label="OK"
              value={verificationQuery.data.summary.ok}
              tone="emerald"
              icon={CheckCircle2}
            />
            <SummaryCard
              label="Sem ponto"
              value={verificationQuery.data.summary.semPonto}
              tone="red"
              icon={ShieldAlert}
            />
            <SummaryCard
              label="Atenção"
              value={verificationQuery.data.summary.atencao}
              tone="amber"
              icon={AlertTriangle}
            />
            <SummaryCard
              label="Sem vínculo"
              value={verificationQuery.data.summary.semVinculo}
              tone="slate"
              icon={UserRoundX}
            />
          </section>

          <section className="app-panel table-shell">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="section-heading !mb-1">Colaboradores avaliados</h2>
                <p className="text-sm text-slate-500">
                  Visão consolidada da conferência diária com batidas, fotos e status.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className={cn(
                    'rounded-full border px-3 py-2 text-sm font-semibold transition',
                    showOnlyLinked
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  )}
                  onClick={() => setShowOnlyLinked((current) => !current)}
                >
                  {showOnlyLinked ? 'Mostrando somente com vínculo' : 'Filtrar: somente com vínculo'}
                </button>
                <div className="rounded-full bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
                  {visibleItems.length}
                  {showOnlyLinked ? ` de ${verificationQuery.data.items.length}` : ''} registro(s)
                </div>
              </div>
            </div>

            <div className="table-scroll">
              <table className="data-table min-w-[1550px]">
                <thead>
                  <tr>
                    <th>Colaborador</th>
                    <th>Setor</th>
                    <th>CPF</th>
                    <th>Primeira</th>
                    <th>Última</th>
                    <th>Batidas</th>
                    <th>Fotos</th>
                    <th>Horas</th>
                    <th>Status</th>
                    <th>Detalhe</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleItems.length ? (
                    visibleItems.map((item) => (
                      <tr
                        key={item.usuarioId}
                        className={cn(
                          item.statusTone === 'red' && 'bg-red-50/40',
                          item.statusTone === 'amber' && 'bg-amber-50/30'
                        )}
                      >
                        <td className="font-semibold text-slate-800">
                          <div>{item.nome}</div>
                          <div className="text-xs text-slate-400">
                            {item.solidesEmployeeId
                              ? `Sólides #${item.solidesEmployeeId}`
                              : 'Sem vínculo'}
                          </div>
                        </td>
                        <td>{item.setor || '-'}</td>
                        <td>{formatCpf(item.cpf)}</td>
                        <td>{item.primeiraMarcacao || '-'}</td>
                        <td>{item.ultimaMarcacao || '-'}</td>
                        <td>{item.totalBatidas || 0}</td>
                        <td>{item.totalFotos || 0}</td>
                        <td>{item.horasTrabalhadas || '-'}</td>
                        <td>
                          <span
                            className={cn(
                              'status-badge',
                              item.statusTone === 'emerald'
                                ? 'status-success'
                                : item.statusTone === 'red'
                                  ? 'bg-red-50 text-red-700'
                                  : item.statusTone === 'amber'
                                    ? 'bg-amber-50 text-amber-700'
                                    : 'status-neutral'
                            )}
                          >
                            {item.statusLabel}
                          </span>
                          {item.statusesSolides?.length ? (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {item.statusesSolides.map((status) => (
                                <span
                                  key={status}
                                  className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600"
                                >
                                  {status}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </td>
                        <td className="max-w-[340px] whitespace-normal text-sm text-slate-600">
                          {item.observacao}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={10}>
                        <QueryFeedback
                          type="empty"
                          title={
                            showOnlyLinked
                              ? 'Nenhum colaborador com vínculo encontrado'
                              : 'Nenhum colaborador encontrado'
                          }
                          description={
                            showOnlyLinked
                              ? 'Desative o filtro para voltar a exibir também os registros sem vínculo com a Sólides.'
                              : 'Ajuste os filtros ou amplie o escopo da verificação.'
                          }
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  )
}
