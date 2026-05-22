import { Fragment, useEffect, useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import PaginationControls from '@/components/ui/PaginationControls'
import QueryFeedback from '@/components/ui/QueryFeedback'
import { conferenciaEstacasApi, diarioAdminSignatureService, planejamentoDiarioApi, toleranciaConferenciaApi, type ConferenciaEstacaItem, extractApiErrorMessage } from '@/lib/gontijo-api'
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

const PERDAS = [
  { grupo: 'Comercial', itens: ['Aguardando início da obra','Aguardando liberação de projeto do cliente','Aguardando projeto interno','Dificuldade de perfuração devido ao terreno','Estacas curtas / diâmetro menor','Falta de área de trabalho','Falta de liberação da obra','Interferências na obra','Mudança de projeto','Obra embargada','Paralisação do cliente','Problema com vizinhança','Reunião com cliente','Revisão de projeto'] },
  { grupo: 'Segurança', itens: ['Aguardando documentação de equipe'] },
  { grupo: 'Manutenção', itens: ["Aguardando documentação (equipamento)",'Aguardando manutenção','Manutenção da máquina em obra','Manutenção da máquina no pátio',"Problemas com a bomba d'água",'Problemas hidráulicos','Problemas elétricos','Quebra de equipamento','Troca de peças','Vazamentos'] },
  { grupo: 'Caldeiraria', itens: ['Reparo de trados e/ou ponteiras','Adaptações e melhorias','Manutenção preventiva / melhorias','Pintura'] },
  { grupo: 'Produção', itens: ['(Des)Montagem do equipamento','Aguardando armação / trilho','Aguardando bomba de concreto','Aguardando concretagem das estacas','Aguardando concreto','Aguardando ferragem','Aguardando locação','Aguardando topografia','Falta de insumos','Limpeza da área','Montagem de armação','Reposicionamento de equipamento','Testes operacionais'] },
  { grupo: 'Logística', itens: ['Aguardando peças','Aguardando transporte','Mobilização da máquina','Desmobilização da máquina','Problemas com transporte'] },
  { grupo: 'Condições naturais', itens: ['Chuva','Domingo','Feriado','Sábado ocioso','Terreno inacessível','Ventos fortes'] },
  { grupo: 'Geoteste', itens: ['Aguardando execução de ensaios','Execução de ensaios'] },
  { grupo: 'Operacional', itens: ['Diário não enviado','Erro operacional'] },
  { grupo: 'Gestão de pessoas', itens: ['Falta de equipe','Folga acordada com o cliente','Troca de equipe'] },
]

function AprovarModal({
  equipamentoId,
  dataDiario,
  estacasRealizadas,
  onConfirm,
  onCancel,
}: {
  equipamentoId: number | null
  dataDiario: string
  estacasRealizadas: number
  onConfirm: (meta_atingida: boolean, perda?: string) => void
  onCancel: () => void
}) {
  const planQuery = useQuery({
    queryKey: ['planejamento-modal', equipamentoId, dataDiario],
    queryFn: () =>
      equipamentoId
        ? planejamentoDiarioApi.list({ equipamento_id: equipamentoId, data_inicio: dataDiario, data_fim: dataDiario })
        : Promise.resolve([]),
    enabled: !!equipamentoId && !!dataDiario,
    staleTime: 1000 * 60 * 5,
  })

  const totalPlanejado = (planQuery.data ?? []).reduce(
    (sum, p) => sum + p.itens.reduce((s, it) => s + it.metaQtdEstacas, 0),
    0
  )
  const temPlanejamento = (planQuery.data ?? []).length > 0
  const autoMeta = !temPlanejamento || estacasRealizadas >= totalPlanejado

  const [tipo, setTipo] = useState<'meta' | 'perda'>('meta')
  const [perdaSelecionada, setPerdaSelecionada] = useState('')
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if ((planQuery.isSuccess || !equipamentoId) && !initialized) {
      setTipo(autoMeta ? 'meta' : 'perda')
      setInitialized(true)
    }
  }, [planQuery.isSuccess, equipamentoId, initialized, autoMeta])

  const podeConfirmar = tipo === 'meta' || (tipo === 'perda' && perdaSelecionada !== '')

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#fff', borderRadius: 8, padding: 24, width: 460, boxShadow: '0 4px 24px rgba(0,0,0,0.15)' }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>Aprovar diário</h3>
        <p style={{ fontSize: 13, color: '#4a5568', marginBottom: temPlanejamento ? 8 : 16 }}>Informe o resultado em relação à meta diária (obrigatório):</p>

        {temPlanejamento && (
          <div style={{ background: autoMeta ? '#f0fff4' : '#fff5f5', border: `1px solid ${autoMeta ? '#c6f6d5' : '#fed7d7'}`, borderRadius: 6, padding: '8px 12px', marginBottom: 14, fontSize: 13 }}>
            <span style={{ fontWeight: 600 }}>Meta planejada:</span> {totalPlanejado} estacas &nbsp;|&nbsp;
            <span style={{ fontWeight: 600 }}>Realizado:</span> {estacasRealizadas} estacas &nbsp;—&nbsp;
            <span style={{ color: autoMeta ? '#276749' : '#c53030', fontWeight: 600 }}>{autoMeta ? 'Meta atingida ✓' : 'Abaixo da meta'}</span>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, fontWeight: tipo === 'meta' ? 600 : 400 }}>
            <input type="radio" name="tipo" value="meta" checked={tipo === 'meta'} onChange={() => { setTipo('meta'); setPerdaSelecionada('') }} />
            Meta atingida
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, fontWeight: tipo === 'perda' ? 600 : 400 }}>
            <input type="radio" name="tipo" value="perda" checked={tipo === 'perda'} onChange={() => setTipo('perda')} />
            Perda
          </label>
        </div>

        {tipo === 'perda' && (
          <select
            value={perdaSelecionada}
            onChange={(e) => setPerdaSelecionada(e.target.value)}
            className="field-select"
            style={{ width: '100%', marginBottom: 8 }}
            autoFocus
          >
            <option value="">Selecione a perda...</option>
            {PERDAS.map((grupo) => (
              <optgroup key={grupo.grupo} label={grupo.grupo}>
                {grupo.itens.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </optgroup>
            ))}
          </select>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
          <button type="button" className="btn" style={{ background: '#e2e8f0', color: '#2d3748' }} onClick={onCancel}>Cancelar</button>
          <button
            type="button"
            className="btn"
            style={{ background: '#38a169', color: '#fff' }}
            disabled={!podeConfirmar || planQuery.isPending}
            onClick={() => onConfirm(tipo === 'meta', tipo === 'perda' ? perdaSelecionada : undefined)}
          >
            {planQuery.isPending ? 'Carregando...' : 'Confirmar aprovação'}
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
  const [aprovarItem, setAprovarItem] = useState<ConferenciaEstacaItem | null>(null)
  const [actionError, setActionError] = useState('')
  const [pendingStakeAction, setPendingStakeAction] = useState<StakeActionState>(null)
  const [signatureLoadingId, setSignatureLoadingId] = useState<number | null>(null)

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
    mutationFn: ({ id, meta_atingida, perda, obs }: { id: number; meta_atingida: boolean; perda?: string; obs?: string }) =>
      conferenciaEstacasApi.aprovar(id, { meta_atingida, perda, obs }),
    onSuccess: async () => {
      setAprovarItem(null)
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
                            onClick={() => setAprovarItem(item)}
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
                      ) : null}
                      {item.conferenciaStatus === 'rejeitado' ? (
                        <button
                          type="button"
                          className="btn"
                          style={{ background: '#38a169', color: '#fff', padding: '4px 10px', fontSize: 12 }}
                          disabled={aprovarMutation.isPending}
                          onClick={() => setAprovarItem(item)}
                        >
                          Aprovar
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="btn"
                        style={{
                          background: item.conferenciaStatus === 'aprovado' ? '#2f855a' : '#a0aec0',
                          color: '#fff',
                          padding: '4px 10px',
                          fontSize: 12,
                          marginTop: item.conferenciaStatus === 'pendente' ? 6 : 0,
                        }}
                        disabled={item.conferenciaStatus !== 'aprovado' || signatureLoadingId === item.id}
                        title={item.conferenciaStatus !== 'aprovado' ? 'Conclua a conferencia antes de gerar o link.' : undefined}
                        onClick={() => void handleSignatureLink(item)}
                      >
                        {signatureLoadingId === item.id ? 'Gerando...' : 'Link assinatura'}
                      </button>
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

      {aprovarItem !== null ? (
        <AprovarModal
          equipamentoId={aprovarItem.equipamentoId}
          dataDiario={aprovarItem.dataDiario}
          estacasRealizadas={aprovarItem.estacas.length}
          onConfirm={(meta_atingida, perda) => aprovarMutation.mutate({ id: aprovarItem.id, meta_atingida, perda })}
          onCancel={() => setAprovarItem(null)}
        />
      ) : null}
    </div>
  )
}
