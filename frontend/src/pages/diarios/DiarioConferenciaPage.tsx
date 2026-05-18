import { Fragment, useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import PaginationControls from '@/components/ui/PaginationControls'
import QueryFeedback from '@/components/ui/QueryFeedback'
import { conferenciaEstacasApi, diarioAdminSignatureService, toleranciaConferenciaApi, type ConferenciaEstacaItem, type EstacaComCusto, extractApiErrorMessage } from '@/lib/gontijo-api'
import { formatDate } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'

function formatBRL(value: number | null): string {
  if (value == null) return '—'
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

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

function StakeAcoes({
  item,
  stakeIndex,
  pendingStakeAction,
  onStakeAction,
}: {
  item: ConferenciaEstacaItem
  stakeIndex: number
  pendingStakeAction: StakeActionState
  onStakeAction: (diaryId: number, stakeIndex: number, status: 'aprovado' | 'rejeitado', obs?: string) => void
}) {
  const [rejectingObs, setRejectingObs] = useState<string | null>(null)
  const isApproving = pendingStakeAction?.diaryId === item.id && pendingStakeAction.stakeIndex === stakeIndex && pendingStakeAction.status === 'aprovado'
  const isRejecting = pendingStakeAction?.diaryId === item.id && pendingStakeAction.stakeIndex === stakeIndex && pendingStakeAction.status === 'rejeitado'

  if (rejectingObs !== null) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 220 }}>
        <textarea
          autoFocus
          placeholder="Motivo da reprovação (obrigatório)"
          value={rejectingObs}
          onChange={(e) => setRejectingObs(e.target.value)}
          style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid #fc8181', minHeight: 60, resize: 'vertical' }}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            className="btn"
            style={{ background: '#e53e3e', color: '#fff', padding: '4px 9px', fontSize: 12, flex: 1 }}
            disabled={!rejectingObs.trim() || Boolean(pendingStakeAction)}
            onClick={() => { onStakeAction(item.id, stakeIndex, 'rejeitado', rejectingObs.trim()); setRejectingObs(null) }}
          >
            {isRejecting ? 'Reprovando...' : 'Confirmar'}
          </button>
          <button type="button" className="btn btn-secondary" style={{ padding: '4px 9px', fontSize: 12 }} onClick={() => setRejectingObs(null)}>
            Cancelar
          </button>
        </div>
      </div>
    )
  }

  return (
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
        onClick={() => setRejectingObs('')}
      >
        Reprovar
      </button>
      {(isApproving || isRejecting) ? <span style={{ color: '#718096', fontSize: 11, fontWeight: 700 }}>Salvando...</span> : null}
    </div>
  )
}

function ExpandedRow({
  item,
  pendingStakeAction,
  onStakeAction,
  onConsideraFatMinimo,
  pendingFatMinimo,
}: {
  item: ConferenciaEstacaItem
  pendingStakeAction: StakeActionState
  onStakeAction: (diaryId: number, stakeIndex: number, status: 'aprovado' | 'rejeitado', obs?: string) => void
  onConsideraFatMinimo: (diaryId: number, considera: boolean) => void
  pendingFatMinimo: number | null
}) {
  const { estacasComCusto, ocorrencias, contratoPrecos, consideraFatMinimo, producaoReal, valorFaturado, producaoRealFechado, valorFaturadoFechado, conferenciaStatus } = item
  const fatMinimoValor = contratoPrecos?.fatMinimoValor ?? null
  const isFatMinimoPending = pendingFatMinimo === item.id

  if (!estacasComCusto || estacasComCusto.length === 0) {
    return <p style={{ color: '#718096', fontSize: 13 }}>Nenhuma estaca encontrada neste diário.</p>
  }

  const totalCusto = estacasComCusto.reduce((sum, e) => sum + (e.custo_total ?? 0), 0)
  const temAlgumCusto = estacasComCusto.some((e) => e.custo_total != null)

  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 1100, borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f7fafc' }}>
              <th style={thStyle}>Estaca</th>
              <th style={thStyle}>Diâm. Exec.</th>
              <th style={thStyle}>Prof. Exec. (m)</th>
              <th style={thStyle}>Usou Bit</th>
              <th style={thStyle}>Metros Arm.</th>
              <th style={thStyle}>R$/m</th>
              <th style={thStyle}>Custo Metro</th>
              <th style={thStyle}>Acrésc. Bit</th>
              <th style={thStyle}>Custo Arm.</th>
              <th style={{ ...thStyle, fontWeight: 700 }}>Custo Total</th>
              <th style={thStyle}>Conferência</th>
              <th style={thStyle}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {estacasComCusto.map((estaca: EstacaComCusto) => (
              <tr key={estaca.index} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={tdStyle}>{estaca.nome || '—'}</td>
                <td style={tdStyle}>{estaca.diametroExec != null ? `${estaca.diametroExec} cm` : '—'}</td>
                <td style={tdStyle}>{estaca.profExec != null ? estaca.profExec : '—'}</td>
                <td style={tdStyle}>{estaca.usoBits ? <span style={{ color: '#276749', fontWeight: 700 }}>✓</span> : <span style={{ color: '#a0aec0' }}>—</span>}</td>
                <td style={tdStyle}>{estaca.metrosIcamento != null ? `${estaca.metrosIcamento} m` : '—'}</td>
                <td style={tdStyle}>{formatBRL(estaca.valorMetro)}</td>
                <td style={tdStyle}>{formatBRL(estaca.custo_metro)}</td>
                <td style={tdStyle}>{formatBRL(estaca.custo_bit)}</td>
                <td style={tdStyle}>{formatBRL(estaca.custo_armacao)}</td>
                <td style={{ ...tdStyle, fontWeight: 700 }}>{formatBRL(estaca.custo_total)}</td>
                <td style={tdStyle}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <Badge status={estaca.conferenciaStatus || 'pendente'} rounded />
                    {estaca.conferenciaPorNome ? <span style={{ color: '#718096', fontSize: 11 }}>{estaca.conferenciaPorNome}</span> : null}
                    {estaca.conferenciaObs ? <span style={{ color: '#718096', fontSize: 11, fontStyle: 'italic' }}>{estaca.conferenciaObs}</span> : null}
                  </div>
                </td>
                <td style={tdStyle}>
                  <StakeAcoes item={item} stakeIndex={estaca.index} pendingStakeAction={pendingStakeAction} onStakeAction={onStakeAction} />
                </td>
              </tr>
            ))}
          </tbody>
          {temAlgumCusto ? (
            <tfoot>
              <tr style={{ background: '#f7fafc', borderTop: '2px solid #e2e8f0' }}>
                <td colSpan={9} style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#4a5568' }}>Total do Diário</td>
                <td style={{ ...tdStyle, fontWeight: 700, color: '#276749' }}>R$ {formatBRL(totalCusto)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>

      <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #e2e8f0' }}>
        <strong style={{ fontSize: 13, color: '#2d3748' }}>Ocorrências do Diário</strong>
        {ocorrencias && ocorrencias.length > 0 ? (
          <ul style={{ margin: '8px 0 0', paddingLeft: 18, listStyle: 'disc' }}>
            {ocorrencias.map((o, i) => (
              <li key={i} style={{ fontSize: 12, color: '#4a5568', marginBottom: 4 }}>
                {o.hora_ini && o.hora_fim ? (
                  <span style={{ color: '#718096', marginRight: 6 }}>{o.hora_ini}–{o.hora_fim}</span>
                ) : null}
                {o.desc}
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ color: '#a0aec0', fontSize: 12, margin: '6px 0 0' }}>Nenhuma ocorrência registrada.</p>
        )}
      </div>

      {temAlgumCusto && (
        <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #e2e8f0', display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 24 }}>
          <div>
            <strong style={{ fontSize: 13, color: '#2d3748', display: 'block', marginBottom: 8 }}>Faturamento</strong>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ color: '#718096' }}>Produção Real:</span>
                <span style={{ fontWeight: 700, color: '#2d3748' }}>R$ {formatBRL(producaoReal)}</span>
              </div>
              {fatMinimoValor != null && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ color: '#718096' }}>Faturamento Mínimo:</span>
                  <span style={{ fontWeight: 600, color: '#744210' }}>R$ {formatBRL(fatMinimoValor)}</span>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
                <span style={{ color: '#718096' }}>Valor a Faturar:</span>
                <span style={{ fontWeight: 700, fontSize: 15, color: '#276749' }}>
                  R$ {formatBRL(conferenciaStatus === 'aprovado' && valorFaturadoFechado != null ? valorFaturadoFechado : valorFaturado)}
                </span>
                {consideraFatMinimo && fatMinimoValor != null && producaoReal != null && producaoReal < fatMinimoValor && (
                  <span style={{ fontSize: 11, background: '#fefcbf', color: '#744210', border: '1px solid #f6e05e', borderRadius: 4, padding: '1px 6px' }}>mín. aplicado</span>
                )}
                {conferenciaStatus === 'aprovado' && valorFaturadoFechado != null && (
                  <span style={{ fontSize: 11, background: '#c6f6d5', color: '#276749', border: '1px solid #9ae6b4', borderRadius: 4, padding: '1px 6px' }}>fechado</span>
                )}
              </div>
            </div>
          </div>

          {fatMinimoValor != null && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <strong style={{ fontSize: 13, color: '#2d3748' }}>Considerar Faturamento Mínimo</strong>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: isFatMinimoPending ? 'not-allowed' : 'pointer', userSelect: 'none' }}>
                <div
                  onClick={() => !isFatMinimoPending && onConsideraFatMinimo(item.id, !consideraFatMinimo)}
                  style={{
                    width: 40, height: 22, borderRadius: 11, position: 'relative', cursor: isFatMinimoPending ? 'not-allowed' : 'pointer',
                    background: consideraFatMinimo ? '#38a169' : '#cbd5e0', transition: 'background 0.2s',
                  }}
                >
                  <div style={{
                    position: 'absolute', top: 3, left: consideraFatMinimo ? 21 : 3,
                    width: 16, height: 16, borderRadius: '50%', background: '#fff',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s',
                  }} />
                </div>
                <span style={{ fontSize: 13, color: consideraFatMinimo ? '#276749' : '#718096', fontWeight: consideraFatMinimo ? 700 : 400 }}>
                  {isFatMinimoPending ? 'Salvando...' : consideraFatMinimo ? 'Sim' : 'Não'}
                </span>
              </label>
              <p style={{ fontSize: 11, color: '#a0aec0', margin: 0, maxWidth: 220 }}>
                {consideraFatMinimo
                  ? 'Usa o maior valor entre produção real e faturamento mínimo.'
                  : 'Usa estritamente a produção real.'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const thStyle: React.CSSProperties = { textAlign: 'left', padding: '6px 10px', fontWeight: 600, color: '#4a5568', fontSize: 12, borderBottom: '2px solid #e2e8f0' }
const tdStyle: React.CSSProperties = { padding: '6px 10px', color: '#2d3748' }

function ParametrosModal({
  obraInicial,
  isAdmin,
  onClose,
}: {
  obraInicial: string
  isAdmin: boolean
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [obraNumero, setObraNumero] = useState(obraInicial)
  const [toleranciaEdit, setToleranciaEdit] = useState<string>('')
  const [saved, setSaved] = useState(false)

  const toleranciaQuery = useQuery({
    queryKey: ['tolerancia-conferencia', obraNumero],
    queryFn: () => toleranciaConferenciaApi.get(obraNumero),
    enabled: Boolean(obraNumero),
    staleTime: 1000 * 60 * 5,
  })

  const toleranciaMutation = useMutation({
    mutationFn: (valor: number) => toleranciaConferenciaApi.set(obraNumero, valor),
    onSuccess: async () => {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      await queryClient.invalidateQueries({ queryKey: ['tolerancia-conferencia', obraNumero] })
      await queryClient.invalidateQueries({ queryKey: ['conferencia-estacas'] })
    },
  })

  const valorAtual = toleranciaQuery.data ?? 10
  const valorExibido = toleranciaEdit !== '' ? toleranciaEdit : valorAtual

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#fff', borderRadius: 8, padding: 28, width: 440, boxShadow: '0 4px 24px rgba(0,0,0,0.15)' }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 700 }}>Parâmetros de Conferência</h3>
        <p style={{ fontSize: 13, color: '#718096', marginBottom: 20 }}>
          Define a tolerância de aprovação automática por obra.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#4a5568', display: 'block', marginBottom: 4 }}>N° da Obra</label>
            <input
              type="text"
              value={obraNumero}
              onChange={(e) => { setObraNumero(e.target.value); setToleranciaEdit('') }}
              placeholder="Ex: 2024-001"
              style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 4, padding: '6px 10px', fontSize: 13, boxSizing: 'border-box' }}
            />
          </div>

          {obraNumero && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#4a5568', display: 'block', marginBottom: 4 }}>
                Tolerância de profundidade (%)
              </label>
              <p style={{ fontSize: 12, color: '#718096', marginBottom: 8 }}>
                Diferença máxima aceita entre profundidade executada e planejada para aprovação automática.
                {toleranciaQuery.isSuccess && <> <strong>Atual: {valorAtual}%</strong></>}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={valorExibido}
                  onChange={(e) => setToleranciaEdit(e.target.value)}
                  disabled={!isAdmin}
                  style={{ width: 80, border: '1px solid #e2e8f0', borderRadius: 4, padding: '6px 10px', fontSize: 13 }}
                />
                <span style={{ fontSize: 13, color: '#718096' }}>%</span>
                {!isAdmin && (
                  <span style={{ fontSize: 12, color: '#a0aec0' }}>Apenas administradores podem alterar.</span>
                )}
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 24, justifyContent: 'flex-end' }}>
          <button type="button" className="btn" style={{ background: '#e2e8f0', color: '#2d3748' }} onClick={onClose}>
            Fechar
          </button>
          {isAdmin && obraNumero && (
            <button
              type="button"
              className="btn"
              style={{ background: '#3182ce', color: '#fff' }}
              disabled={toleranciaMutation.isPending}
              onClick={() => {
                const val = parseFloat(String(valorExibido))
                if (!isNaN(val)) toleranciaMutation.mutate(val)
              }}
            >
              {saved ? 'Salvo!' : toleranciaMutation.isPending ? 'Salvando...' : 'Salvar'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

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
  const [showParams, setShowParams] = useState(false)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [rejeitarId, setRejeitarId] = useState<number | null>(null)
  const [actionError, setActionError] = useState('')
  const [pendingStakeAction, setPendingStakeAction] = useState<StakeActionState>(null)
  const [signatureLoadingId, setSignatureLoadingId] = useState<number | null>(null)
  const [pendingFatMinimo, setPendingFatMinimo] = useState<number | null>(null)

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

  const fatMinimoMutation = useMutation({
    mutationFn: ({ id, considera }: { id: number; considera: boolean }) =>
      conferenciaEstacasApi.setConsideraFatMinimo(id, considera),
    onMutate: (variables) => setPendingFatMinimo(variables.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['conferencia-estacas'] })
    },
    onError: (error) => setActionError(extractApiErrorMessage(error)),
    onSettled: () => setPendingFatMinimo(null),
  })

  function handleConsideraFatMinimo(diaryId: number, considera: boolean) {
    fatMinimoMutation.mutate({ id: diaryId, considera })
  }

  function handleApply() {
    setApplied({ ...filters, page: 1 })
  }

  function toggleExpanded(id: number) {
    setExpanded((previous) => (previous === id ? null : id))
  }

  async function handleSignatureLink(item: ConferenciaEstacaItem) {
    if (item.conferenciaStatus !== 'aprovado') return
    setActionError('')
    setSignatureLoadingId(item.id)

    try {
      let status = await diarioAdminSignatureService.getStatus(item.id)
      if (status.status === 'nao_gerado' || status.status === 'expirado') {
        status = await diarioAdminSignatureService.generate(item.id)
      }
      if (!status.publicUrl) {
        throw new Error('Este diario nao tem link publico disponivel.')
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(status.publicUrl)
      }
      const message = status.whatsappText || `Segue o link para assinatura do diario: ${status.publicUrl}`
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer')
      await queryClient.invalidateQueries({ queryKey: ['conferencia-estacas'] })
    } catch (error) {
      setActionError(extractApiErrorMessage(error))
    } finally {
      setSignatureLoadingId(null)
    }
  }

  const items = query.data?.items ?? []
  const total = query.data?.total ?? 0

  return (
    <div className="page-shell">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <h1 className="page-heading" style={{ margin: 0 }}>Conferência de Estacas</h1>
        <button
          type="button"
          className="btn"
          style={{ background: '#edf2f7', color: '#2d3748', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 6 }}
          onClick={() => setShowParams(true)}
        >
          ⚙ Parâmetros
        </button>
      </div>

      {showParams && (
        <ParametrosModal
          obraInicial={filters.obra_numero || applied.obra_numero}
          isAdmin={isAdmin}
          onClose={() => setShowParams(false)}
        />
      )}

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
                <th style={thStyle}>Valor Faturado</th>
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
                      {item.conferenciaStatus === 'aprovado' && item.valorFaturadoFechado != null ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ fontWeight: 700, color: '#276749', fontSize: 13 }}>R$ {formatBRL(item.valorFaturadoFechado)}</span>
                          {item.producaoRealFechado != null && item.producaoRealFechado !== item.valorFaturadoFechado && (
                            <span style={{ fontSize: 11, color: '#a0aec0' }}>Prod.: R$ {formatBRL(item.producaoRealFechado)}</span>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: '#a0aec0', fontSize: 12 }}>—</span>
                      )}
                    </td>
                    <td style={tdStyle} onClick={(event) => event.stopPropagation()}>
                      {item.conferenciaStatus === 'aprovado'
                        ? <span style={{ background: '#c6f6d5', color: '#276749', border: '1px solid #9ae6b4', borderRadius: 4, padding: '2px 8px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>Visível</span>
                        : <span style={{ background: '#edf2f7', color: '#718096', border: '1px solid #e2e8f0', borderRadius: 4, padding: '2px 8px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>Oculto</span>
                      }
                    </td>
                    <td style={tdStyle} onClick={(event) => event.stopPropagation()}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-start' }}>
                        {item.conferenciaStatus === 'pendente' ? (
                          <div style={{ display: 'flex', gap: 5 }}>
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
                        <div style={{ display: 'flex', gap: 5 }}>
                          <button
                            type="button"
                            className="btn"
                            style={{ background: item.conferenciaStatus === 'aprovado' ? '#2f855a' : '#a0aec0', color: '#fff', padding: '4px 10px', fontSize: 12 }}
                            disabled={item.conferenciaStatus !== 'aprovado' || signatureLoadingId === item.id}
                            title={item.conferenciaStatus !== 'aprovado' ? 'Conclua a conferencia antes de gerar o link.' : undefined}
                            onClick={() => void handleSignatureLink(item)}
                          >
                            {signatureLoadingId === item.id ? 'Gerando...' : 'Link assinatura'}
                          </button>
                          <Link
                            to={`/diarios/${item.id}/editar`}
                            className="btn"
                            style={{ background: '#4a5568', color: '#fff', padding: '4px 10px', fontSize: 12 }}
                          >
                            Editar diário
                          </Link>
                        </div>
                      </div>
                    </td>
                  </tr>
                  {expanded === item.id ? (
                    <tr style={{ background: '#f0f9ff' }}>
                      <td colSpan={9} style={{ padding: '12px 20px', borderBottom: '2px solid #bee3f8' }}>
                        <ExpandedRow
                          item={item}
                          pendingStakeAction={pendingStakeAction}
                          onStakeAction={(id, stakeIndex, status, obs) => estacaMutation.mutate({ id, stakeIndex, status, obs })}
                          onConsideraFatMinimo={handleConsideraFatMinimo}
                          pendingFatMinimo={pendingFatMinimo}
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
