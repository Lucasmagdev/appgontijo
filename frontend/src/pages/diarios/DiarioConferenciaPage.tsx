import { Fragment, useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import PaginationControls from '@/components/ui/PaginationControls'
import QueryFeedback from '@/components/ui/QueryFeedback'
import { conferenciaEstacasApi, toleranciaConferenciaApi, type ConferenciaEstacaItem, extractApiErrorMessage } from '@/lib/gontijo-api'
import { formatDate } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'

type ConferenciaStatus = 'pendente' | 'aprovado' | 'rejeitado'
type StakeActionState = { diaryId: number; stakeIndex: number; status: 'aprovado' | 'rejeitado' } | null

function statusLabel(status: ConferenciaStatus) {
  if (status === 'aprovado') return 'Aprovado'
  if (status === 'rejeitado') return 'Rejeitado'
  return 'Pendente'
}

function statusStyle(status: ConferenciaStatus): React.CSSProperties {
  if (status === 'aprovado') return { background: '#c6f6d5', color: '#276749', border: '1px solid #9ae6b4' }
  if (status === 'rejeitado') return { background: '#fed7d7', color: '#9b2c2c', border: '1px solid #fc8181' }
  return { background: '#fefcbf', color: '#744210', border: '1px solid #f6e05e' }
}

function Badge({ status, rounded = false }: { status: ConferenciaStatus; rounded?: boolean }) {
  return (
    <span style={{ ...statusStyle(status), borderRadius: rounded ? 999 : 4, padding: rounded ? '3px 9px' : '2px 8px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
      {statusLabel(status)}
    </span>
  )
}

function ExpandedRow({
  item,
  pendingStakeAction,
  onStakeAction,
}: {
  item: ConferenciaEstacaItem
  pendingStakeAction: StakeActionState
  onStakeAction: (diaryId: number, stakeIndex: number, status: 'aprovado' | 'rejeitado', obs?: string) => void
}) {
  const { autoComparacao, estacas, producaoPlanejada } = item

  if (autoComparacao.semEstacas) {
    return <p style={{ color: '#718096', fontSize: 13 }}>Nenhuma estaca encontrada neste diário.</p>
  }

  if (autoComparacao.semProducao && autoComparacao.detalhes.length === 0) {
    return <p style={{ color: '#718096', fontSize: 13 }}>Sem composição de produção cadastrada para esta obra. Revisão manual necessária.</p>
  }

  return (
    <div>
      <p style={{ fontSize: 12, marginBottom: 8, color: '#4a5568' }}>
        Comparação com composição de produção da obra ({producaoPlanejada.length} tipo{producaoPlanejada.length !== 1 ? 's' : ''} cadastrado{producaoPlanejada.length !== 1 ? 's' : ''}).
      </p>

      {autoComparacao.semProducao ? (
        <div style={{ marginBottom: 10, border: '1px solid #fbd38d', background: '#fffaf0', color: '#744210', borderRadius: 10, padding: '10px 12px', fontSize: 12, fontWeight: 700 }}>
          Sem composição de produção cadastrada para esta obra. Confira manualmente as estacas abaixo.
        </div>
      ) : null}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 980, borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f7fafc' }}>
              <th style={thStyle}>Estaca</th>
              <th style={thStyle}>Diâm. Exec.</th>
              <th style={thStyle}>Diâm. Plan.</th>
              <th style={thStyle}>Prof. Exec. (m)</th>
              <th style={thStyle}>Prof. Plan. (m)</th>
              <th style={thStyle}>Diferença</th>
              <th style={thStyle}>Sistema</th>
              <th style={thStyle}>Conferência</th>
              <th style={thStyle}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {autoComparacao.detalhes.map((detail, fallbackIndex) => {
              const stakeIndex = detail.index ?? fallbackIndex
              const isApproving = pendingStakeAction?.diaryId === item.id && pendingStakeAction.stakeIndex === stakeIndex && pendingStakeAction.status === 'aprovado'
              const isRejecting = pendingStakeAction?.diaryId === item.id && pendingStakeAction.stakeIndex === stakeIndex && pendingStakeAction.status === 'rejeitado'
              const isThisPending = isApproving || isRejecting

              return (
                <tr key={stakeIndex} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={tdStyle}>{detail.estaca || '-'}</td>
                  <td style={tdStyle}>{detail.diametroExec != null ? `${detail.diametroExec} cm` : '-'}</td>
                  <td style={tdStyle}>{detail.diametroPlan != null ? `${detail.diametroPlan} cm` : '-'}</td>
                  <td style={tdStyle}>{detail.profExec != null ? detail.profExec : '-'}</td>
                  <td style={tdStyle}>{detail.profPlan != null ? detail.profPlan : '-'}</td>
                  <td style={tdStyle}>
                    {detail.diferencaPct != null
                      ? `${detail.diferencaPct}%`
                      : detail.motivo === 'sem_referencia' || detail.motivo === 'sem_producao'
                        ? 'sem ref.'
                        : '-'}
                  </td>
                  <td style={tdStyle}>
                    {detail.ok
                      ? <span style={{ color: '#276749', fontWeight: 700 }}>OK</span>
                      : <span style={{ color: '#9b2c2c', fontWeight: 700 }}>Fora</span>
                    }
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <Badge status={detail.conferenciaStatus || 'pendente'} rounded />
                      {detail.conferenciaPorNome ? <span style={{ color: '#718096', fontSize: 11 }}>{detail.conferenciaPorNome}</span> : null}
                      {detail.conferenciaObs ? <span style={{ color: '#718096', fontSize: 11, fontStyle: 'italic' }}>{detail.conferenciaObs}</span> : null}
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      <button
                        type="button"
                        className="btn"
                        style={{ background: '#38a169', color: '#fff', padding: '4px 9px', fontSize: 12, minWidth: 92 }}
                        disabled={Boolean(pendingStakeAction)}
                        onClick={() => onStakeAction(item.id, stakeIndex, 'aprovado')}
                      >
                        {isApproving ? 'Aprovando...' : 'Aprovar'}
                      </button>
                      <button
                        type="button"
                        className="btn"
                        style={{ background: '#e53e3e', color: '#fff', padding: '4px 9px', fontSize: 12, minWidth: 96 }}
                        disabled={Boolean(pendingStakeAction)}
                        onClick={() => {
                          const obs = window.prompt(`Motivo para reprovar a estaca ${detail.estaca || fallbackIndex + 1}:`)
                          if (obs?.trim()) onStakeAction(item.id, stakeIndex, 'rejeitado', obs.trim())
                        }}
                      >
                        {isRejecting ? 'Reprovando...' : 'Reprovar'}
                      </button>
                      {isThisPending ? <span style={{ color: '#718096', fontSize: 11, fontWeight: 700 }}>Salvando...</span> : null}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {estacas.length === 0 ? (
        <p style={{ color: '#718096', fontSize: 13, marginTop: 8 }}>Sem dados de estacas no diário.</p>
      ) : null}
    </div>
  )
}

const thStyle: React.CSSProperties = { textAlign: 'left', padding: '6px 10px', fontWeight: 600, color: '#4a5568', fontSize: 12, borderBottom: '2px solid #e2e8f0' }
const tdStyle: React.CSSProperties = { padding: '6px 10px', color: '#2d3748' }

function RejeitarModal({ onConfirm, onCancel }: { onConfirm: (obs: string) => void; onCancel: () => void }) {
  const [obs, setObs] = useState('')

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#fff', borderRadius: 8, padding: 24, width: 400, boxShadow: '0 4px 24px rgba(0,0,0,0.15)' }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700 }}>Rejeitar diário</h3>
        <p style={{ fontSize: 13, color: '#4a5568', marginBottom: 12 }}>Informe o motivo da rejeição (obrigatório):</p>
        <textarea
          value={obs}
          onChange={(event) => setObs(event.target.value)}
          rows={4}
          style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 4, padding: 8, fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
          placeholder="Ex: Profundidade fora do padrão da obra..."
          autoFocus
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
          <button type="button" className="btn" style={{ background: '#e2e8f0', color: '#2d3748' }} onClick={onCancel}>Cancelar</button>
          <button
            type="button"
            className="btn"
            style={{ background: '#e53e3e', color: '#fff' }}
            disabled={!obs.trim()}
            onClick={() => onConfirm(obs.trim())}
          >
            Confirmar rejeição
          </button>
        </div>
      </div>
    </div>
  )
}

export default function DiarioConferenciaPage() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const isAdmin = user?.isAdmin ?? false

  const [filters, setFilters] = useState({ obra_numero: '', conferencia_status: '' })
  const [applied, setApplied] = useState({ obra_numero: '', conferencia_status: '', page: 1 })
  const [toleranciaEdit, setToleranciaEdit] = useState<string>('')
  const [toleranciaSaved, setToleranciasSaved] = useState(false)

  const toleranciaQuery = useQuery({
    queryKey: ['tolerancia-conferencia', applied.obra_numero],
    queryFn: () => toleranciaConferenciaApi.get(applied.obra_numero),
    enabled: Boolean(applied.obra_numero),
    staleTime: 1000 * 60 * 5,
  })

  const toleranciaMutation = useMutation({
    mutationFn: (valor: number) => toleranciaConferenciaApi.set(applied.obra_numero, valor),
    onSuccess: async () => {
      setToleranciasSaved(true)
      setTimeout(() => setToleranciasSaved(false), 2000)
      await queryClient.invalidateQueries({ queryKey: ['tolerancia-conferencia', applied.obra_numero] })
      await queryClient.invalidateQueries({ queryKey: ['conferencia-estacas'] })
    },
  })
  const [expanded, setExpanded] = useState<number | null>(null)
  const [rejeitarId, setRejeitarId] = useState<number | null>(null)
  const [actionError, setActionError] = useState('')
  const [pendingStakeAction, setPendingStakeAction] = useState<StakeActionState>(null)

  const query = useQuery({
    queryKey: ['conferencia-estacas', applied],
    queryFn: () => conferenciaEstacasApi.list({
      page: applied.page,
      limit: 20,
      obra_numero: applied.obra_numero || undefined,
      conferencia_status: applied.conferencia_status || undefined,
    }),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 2,
  })

  const aprovarMutation = useMutation({
    mutationFn: ({ id, obs }: { id: number; obs?: string }) => conferenciaEstacasApi.aprovar(id, obs),
    onSuccess: async () => {
      setActionError('')
      await queryClient.invalidateQueries({ queryKey: ['conferencia-estacas'] })
    },
    onError: (error) => setActionError(extractApiErrorMessage(error)),
  })

  const rejeitarMutation = useMutation({
    mutationFn: ({ id, obs }: { id: number; obs: string }) => conferenciaEstacasApi.rejeitar(id, obs),
    onSuccess: async () => {
      setActionError('')
      setRejeitarId(null)
      await queryClient.invalidateQueries({ queryKey: ['conferencia-estacas'] })
    },
    onError: (error) => setActionError(extractApiErrorMessage(error)),
  })

  const estacaMutation = useMutation({
    mutationFn: ({ id, stakeIndex, status, obs }: { id: number; stakeIndex: number; status: 'aprovado' | 'rejeitado'; obs?: string }) =>
      conferenciaEstacasApi.definirStatusEstaca(id, stakeIndex, status, obs),
    onMutate: (variables) => {
      setActionError('')
      setPendingStakeAction({ diaryId: variables.id, stakeIndex: variables.stakeIndex, status: variables.status })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['conferencia-estacas'] })
    },
    onError: (error) => setActionError(extractApiErrorMessage(error)),
    onSettled: () => setPendingStakeAction(null),
  })

  function handleApply() {
    setApplied({ ...filters, page: 1 })
  }

  function toggleExpanded(id: number) {
    setExpanded((previous) => (previous === id ? null : id))
  }

  const items = query.data?.items ?? []
  const total = query.data?.total ?? 0

  return (
    <div className="page-shell">
      <h1 className="page-heading">Conferência de Estacas</h1>

      {applied.obra_numero ? (
        <section className="app-panel" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#718096', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Tolerância de conferência — Obra {applied.obra_numero}
            </span>
            <span style={{ fontSize: 12, color: '#4a5568' }}>
              Diferença máxima aceita entre profundidade executada e planejada.
              {' '}<strong>Atual: {toleranciaQuery.data ?? 10}%</strong>
              {' '}— diários já aprovados/rejeitados não são afetados.
            </span>
          </div>
          {isAdmin ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={toleranciaEdit !== '' ? toleranciaEdit : (toleranciaQuery.data ?? 10)}
                onChange={(e) => setToleranciaEdit(e.target.value)}
                style={{ width: 72, border: '1px solid #e2e8f0', borderRadius: 4, padding: '4px 8px', fontSize: 13 }}
                placeholder="10"
              />
              <span style={{ fontSize: 13, color: '#718096' }}>%</span>
              <button
                type="button"
                className="btn"
                style={{ background: '#3182ce', color: '#fff', padding: '4px 14px', fontSize: 13 }}
                disabled={toleranciaMutation.isPending}
                onClick={() => {
                  const val = parseFloat(toleranciaEdit !== '' ? toleranciaEdit : String(toleranciaQuery.data ?? 10))
                  if (!isNaN(val)) toleranciaMutation.mutate(val)
                }}
              >
                {toleranciaSaved ? 'Salvo!' : toleranciaMutation.isPending ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          ) : (
            <span style={{ fontSize: 12, color: '#a0aec0', marginLeft: 'auto' }}>Apenas administradores podem alterar.</span>
          )}
        </section>
      ) : null}

      <section className="app-panel toolbar-panel">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="field-label">N° da Obra</label>
            <input
              type="text"
              value={filters.obra_numero}
              onChange={(event) => setFilters((current) => ({ ...current, obra_numero: event.target.value }))}
              placeholder="N° da Obra"
              className="field-input w-32"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="field-label">Status Conferência</label>
            <select
              value={filters.conferencia_status}
              onChange={(event) => setFilters((current) => ({ ...current, conferencia_status: event.target.value }))}
              className="field-select w-40"
            >
              <option value="">Todos</option>
              <option value="pendente">Pendente</option>
              <option value="aprovado">Aprovado</option>
              <option value="rejeitado">Rejeitado</option>
            </select>
          </div>

          <button
            type="button"
            onClick={handleApply}
            className="btn"
            style={{ backgroundColor: '#e53e3e', color: '#fff', alignSelf: 'flex-end' }}
          >
            Filtrar
          </button>
        </div>
      </section>

      {actionError ? <QueryFeedback type="error" title="Erro" description={actionError} /> : null}

      {query.isError ? (
        <QueryFeedback type="error" title="Erro ao carregar" description={extractApiErrorMessage(query.error)} />
      ) : null}

      {query.isLoading ? <p style={{ padding: 24, color: '#718096' }}>Carregando...</p> : null}

      {!query.isLoading && items.length === 0 && !query.isError ? (
        <p style={{ padding: 24, color: '#718096' }}>Nenhum diário assinado encontrado.</p>
      ) : null}

      {items.length > 0 ? (
        <section className="app-panel" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f7fafc', borderBottom: '2px solid #e2e8f0' }}>
                <th style={thStyle}>ID</th>
                <th style={thStyle}>Obra</th>
                <th style={thStyle}>Data</th>
                <th style={thStyle}>Equipamento</th>
                <th style={thStyle}>Operador</th>
                <th style={thStyle}>Estacas</th>
                <th style={thStyle}>Conferência</th>
                <th style={thStyle}>Portal</th>
                <th style={thStyle}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <Fragment key={item.id}>
                  <tr
                    style={{ borderBottom: '1px solid #e2e8f0', cursor: 'pointer', background: expanded === item.id ? '#f0f9ff' : undefined }}
                    onClick={() => toggleExpanded(item.id)}
                  >
                    <td style={tdStyle}>{item.id}</td>
                    <td style={tdStyle}>
                      <span style={{ fontWeight: 600 }}>{item.obraNumero || '-'}</span>
                      {item.cliente ? <span style={{ display: 'block', fontSize: 12, color: '#718096' }}>{item.cliente}</span> : null}
                    </td>
                    <td style={tdStyle}>{formatDate(item.dataDiario)}</td>
                    <td style={tdStyle}>{item.equipamento || '-'}</td>
                    <td style={tdStyle}>{item.operadorNome || '-'}</td>
                    <td style={tdStyle}>
                      {item.estacas.length > 0
                        ? <span>{item.estacas.length} estaca{item.estacas.length !== 1 ? 's' : ''}</span>
                        : <span style={{ color: '#a0aec0' }}>Sem dados</span>
                      }
                    </td>
                    <td style={tdStyle} onClick={(event) => event.stopPropagation()}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Badge status={item.conferenciaStatus} />
                        {item.autoComparacao.dentroTolerancia && item.conferenciaStatus === 'aprovado' && !item.conferenciaPorNome ? (
                          <span style={{ fontSize: 11, color: '#718096' }}>Auto-aprovado</span>
                        ) : null}
                        {item.conferenciaPorNome ? <span style={{ fontSize: 11, color: '#718096' }}>{item.conferenciaPorNome}</span> : null}
                        {item.conferenciaEm ? <span style={{ fontSize: 11, color: '#718096' }}>{formatDate(item.conferenciaEm.slice(0, 10))}</span> : null}
                        {item.conferenciaObs ? (
                          <span style={{ fontSize: 11, color: '#718096', fontStyle: 'italic' }} title={item.conferenciaObs}>
                            {item.conferenciaObs.length > 40 ? `${item.conferenciaObs.slice(0, 40)}...` : item.conferenciaObs}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td style={tdStyle} onClick={(event) => event.stopPropagation()}>
                      {item.conferenciaStatus === 'aprovado'
                        ? <span style={{ background: '#c6f6d5', color: '#276749', border: '1px solid #9ae6b4', borderRadius: 4, padding: '2px 8px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>Visível</span>
                        : <span style={{ background: '#edf2f7', color: '#718096', border: '1px solid #e2e8f0', borderRadius: 4, padding: '2px 8px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>Oculto</span>
                      }
                    </td>
                    <td style={tdStyle} onClick={(event) => event.stopPropagation()}>
                      {item.conferenciaStatus === 'pendente' ? (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            type="button"
                            className="btn"
                            style={{ background: '#38a169', color: '#fff', padding: '4px 10px', fontSize: 12 }}
                            disabled={aprovarMutation.isPending}
                            onClick={() => aprovarMutation.mutate({ id: item.id })}
                          >
                            {aprovarMutation.isPending ? 'Aprovando...' : 'Aprovar'}
                          </button>
                          <button
                            type="button"
                            className="btn"
                            style={{ background: '#e53e3e', color: '#fff', padding: '4px 10px', fontSize: 12 }}
                            disabled={rejeitarMutation.isPending}
                            onClick={() => setRejeitarId(item.id)}
                          >
                            Rejeitar
                          </button>
                        </div>
                      ) : null}
                      {item.conferenciaStatus === 'rejeitado' ? (
                        <button
                          type="button"
                          className="btn"
                          style={{ background: '#38a169', color: '#fff', padding: '4px 10px', fontSize: 12 }}
                          disabled={aprovarMutation.isPending}
                          onClick={() => aprovarMutation.mutate({ id: item.id })}
                        >
                          {aprovarMutation.isPending ? 'Aprovando...' : 'Aprovar'}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                  {expanded === item.id ? (
                    <tr style={{ background: '#f0f9ff' }}>
                      <td colSpan={9} style={{ padding: '12px 20px', borderBottom: '2px solid #bee3f8' }}>
                        <ExpandedRow
                          item={item}
                          pendingStakeAction={pendingStakeAction}
                          onStakeAction={(id, stakeIndex, status, obs) => estacaMutation.mutate({ id, stakeIndex, status, obs })}
                        />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {total > 0 ? (
        <PaginationControls
          page={applied.page}
          limit={20}
          total={total}
          onPageChange={(page) => setApplied((current) => ({ ...current, page }))}
        />
      ) : null}

      {rejeitarId !== null ? (
        <RejeitarModal
          onConfirm={(obs) => rejeitarMutation.mutate({ id: rejeitarId, obs })}
          onCancel={() => setRejeitarId(null)}
        />
      ) : null}
    </div>
  )
}
