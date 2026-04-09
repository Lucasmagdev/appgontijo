import { useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import PaginationControls from '@/components/ui/PaginationControls'
import QueryFeedback from '@/components/ui/QueryFeedback'
import { conferenciaEstacasApi, type ConferenciaEstacaItem, extractApiErrorMessage } from '@/lib/gontijo-api'
import { formatDate } from '@/lib/utils'

type ConferenciaStatus = 'pendente' | 'aprovado' | 'rejeitado'

function statusLabel(s: ConferenciaStatus) {
  if (s === 'aprovado') return 'Aprovado'
  if (s === 'rejeitado') return 'Rejeitado'
  return 'Pendente'
}

function statusStyle(s: ConferenciaStatus): React.CSSProperties {
  if (s === 'aprovado') return { background: '#c6f6d5', color: '#276749', border: '1px solid #9ae6b4' }
  if (s === 'rejeitado') return { background: '#fed7d7', color: '#9b2c2c', border: '1px solid #fc8181' }
  return { background: '#fefcbf', color: '#744210', border: '1px solid #f6e05e' }
}

function Badge({ status }: { status: ConferenciaStatus }) {
  return (
    <span style={{ ...statusStyle(status), borderRadius: 4, padding: '2px 8px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {statusLabel(status)}
    </span>
  )
}

function ExpandedRow({ item }: { item: ConferenciaEstacaItem }) {
  const { autoComparacao, estacas, producaoPlanejada } = item

  if (autoComparacao.semEstacas) {
    return <p style={{ color: '#718096', fontSize: 13 }}>Nenhuma estaca encontrada neste diário.</p>
  }
  if (autoComparacao.semProducao) {
    return <p style={{ color: '#718096', fontSize: 13 }}>Sem composição de produção cadastrada para esta obra. Revisão manual necessária.</p>
  }

  return (
    <div>
      <p style={{ fontSize: 12, marginBottom: 8, color: '#4a5568' }}>
        Comparação com composição de produção da obra ({producaoPlanejada.length} tipo{producaoPlanejada.length !== 1 ? 's' : ''} cadastrado{producaoPlanejada.length !== 1 ? 's' : ''})
      </p>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#f7fafc' }}>
            <th style={thStyle}>Estaca</th>
            <th style={thStyle}>Diâm. Exec.</th>
            <th style={thStyle}>Diâm. Plan.</th>
            <th style={thStyle}>Prof. Exec. (m)</th>
            <th style={thStyle}>Prof. Plan. (m)</th>
            <th style={thStyle}>Diferença</th>
            <th style={thStyle}>Status</th>
          </tr>
        </thead>
        <tbody>
          {autoComparacao.detalhes.map((d, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
              <td style={tdStyle}>{d.estaca || '-'}</td>
              <td style={tdStyle}>{d.diametroExec != null ? `${d.diametroExec} mm` : '-'}</td>
              <td style={tdStyle}>{d.diametroPlan != null ? `${d.diametroPlan} mm` : '-'}</td>
              <td style={tdStyle}>{d.profExec != null ? d.profExec : '-'}</td>
              <td style={tdStyle}>{d.profPlan != null ? d.profPlan : '-'}</td>
              <td style={tdStyle}>{d.diferencaPct != null ? `${d.diferencaPct}%` : d.motivo === 'sem_referencia' ? 'sem ref.' : '-'}</td>
              <td style={tdStyle}>
                {d.ok
                  ? <span style={{ color: '#276749', fontWeight: 600 }}>✓ OK</span>
                  : <span style={{ color: '#9b2c2c', fontWeight: 600 }}>✗ Fora</span>
                }
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {estacas.length === 0 && (
        <p style={{ color: '#718096', fontSize: 13, marginTop: 8 }}>Sem dados de estacas no diário.</p>
      )}
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
          onChange={(e) => setObs(e.target.value)}
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

  const [filters, setFilters] = useState({ obra_numero: '', conferencia_status: '' })
  const [applied, setApplied] = useState({ obra_numero: '', conferencia_status: '', page: 1 })
  const [expanded, setExpanded] = useState<number | null>(null)
  const [rejeitarId, setRejeitarId] = useState<number | null>(null)
  const [actionError, setActionError] = useState('')

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
    onError: (e) => setActionError(extractApiErrorMessage(e)),
  })

  const rejeitarMutation = useMutation({
    mutationFn: ({ id, obs }: { id: number; obs: string }) => conferenciaEstacasApi.rejeitar(id, obs),
    onSuccess: async () => {
      setActionError('')
      setRejeitarId(null)
      await queryClient.invalidateQueries({ queryKey: ['conferencia-estacas'] })
    },
    onError: (e) => setActionError(extractApiErrorMessage(e)),
  })

  function handleApply() {
    setApplied({ ...filters, page: 1 })
  }

  function toggleExpanded(id: number) {
    setExpanded((prev) => (prev === id ? null : id))
  }

  const items = query.data?.items ?? []
  const total = query.data?.total ?? 0

  return (
    <div className="page-shell">
      <h1 className="page-heading">Conferência de Estacas</h1>

      <section className="app-panel toolbar-panel">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="field-label">N° da Obra</label>
            <input
              type="text"
              value={filters.obra_numero}
              onChange={(e) => setFilters((f) => ({ ...f, obra_numero: e.target.value }))}
              placeholder="N° da Obra"
              className="field-input w-32"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="field-label">Status Conferência</label>
            <select
              value={filters.conferencia_status}
              onChange={(e) => setFilters((f) => ({ ...f, conferencia_status: e.target.value }))}
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

      {actionError && (
        <QueryFeedback type="error" title="Erro" description={actionError} />
      )}

      {query.isError && (
        <QueryFeedback type="error" title="Erro ao carregar" description={extractApiErrorMessage(query.error)} />
      )}

      {query.isLoading && <p style={{ padding: 24, color: '#718096' }}>Carregando...</p>}

      {!query.isLoading && items.length === 0 && !query.isError && (
        <p style={{ padding: 24, color: '#718096' }}>Nenhum diário assinado encontrado.</p>
      )}

      {items.length > 0 && (
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
                <th style={thStyle}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <>
                  <tr
                    key={item.id}
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
                    <td style={tdStyle} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Badge status={item.conferenciaStatus} />
                        {item.autoComparacao.dentroTolerancia && item.conferenciaStatus === 'aprovado' && !item.conferenciaPorNome && (
                          <span style={{ fontSize: 11, color: '#718096' }}>Auto-aprovado</span>
                        )}
                        {item.conferenciaPorNome && (
                          <span style={{ fontSize: 11, color: '#718096' }}>{item.conferenciaPorNome}</span>
                        )}
                        {item.conferenciaEm && (
                          <span style={{ fontSize: 11, color: '#718096' }}>{formatDate(item.conferenciaEm.slice(0, 10))}</span>
                        )}
                        {item.conferenciaObs && (
                          <span style={{ fontSize: 11, color: '#718096', fontStyle: 'italic' }} title={item.conferenciaObs}>
                            {item.conferenciaObs.length > 40 ? item.conferenciaObs.slice(0, 40) + '…' : item.conferenciaObs}
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={tdStyle} onClick={(e) => e.stopPropagation()}>
                      {item.conferenciaStatus === 'pendente' && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            type="button"
                            className="btn"
                            style={{ background: '#38a169', color: '#fff', padding: '4px 10px', fontSize: 12 }}
                            disabled={aprovarMutation.isPending}
                            onClick={() => aprovarMutation.mutate({ id: item.id })}
                          >
                            Aprovar
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
                      )}
                      {item.conferenciaStatus === 'rejeitado' && (
                        <button
                          type="button"
                          className="btn"
                          style={{ background: '#38a169', color: '#fff', padding: '4px 10px', fontSize: 12 }}
                          disabled={aprovarMutation.isPending}
                          onClick={() => aprovarMutation.mutate({ id: item.id })}
                        >
                          Aprovar
                        </button>
                      )}
                    </td>
                  </tr>
                  {expanded === item.id && (
                    <tr key={`${item.id}-detail`} style={{ background: '#f0f9ff' }}>
                      <td colSpan={8} style={{ padding: '12px 20px', borderBottom: '2px solid #bee3f8' }}>
                        <ExpandedRow item={item} />
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {total > 0 && (
        <PaginationControls
          page={applied.page}
          limit={20}
          total={total}
          onPageChange={(p) => setApplied((a) => ({ ...a, page: p }))}
        />
      )}

      {rejeitarId !== null && (
        <RejeitarModal
          onConfirm={(obs) => rejeitarMutation.mutate({ id: rejeitarId, obs })}
          onCancel={() => setRejeitarId(null)}
        />
      )}
    </div>
  )
}
