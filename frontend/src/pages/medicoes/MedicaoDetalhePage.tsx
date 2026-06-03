import { Component, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, ArrowDown, CheckCircle2, Copy, Download, DollarSign, Grip, Layers, Link2, Lock, LockOpen, Pencil, Plus, RefreshCw, Save, Trash2, X,
} from 'lucide-react'
import QueryFeedback from '@/components/ui/QueryFeedback'
import {
  extractApiErrorMessage, medicoesApi, usuarioService,
  type MedicaoEstaca,
  type MedicaoFatMinimoRow,
} from '@/lib/gontijo-api'
import { formatDate } from '@/lib/utils'

class PageErrorBoundary extends Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null }
  static getDerivedStateFromError(e: Error) { return { error: e } }
  render() {
    if (this.state.error) {
      return (
        <div className="page-shell">
          <div className="app-panel p-6">
            <div className="text-sm font-bold text-red-700 mb-2">Erro ao carregar página</div>
            <pre className="text-xs text-red-600 whitespace-pre-wrap">{String(this.state.error)}</pre>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function fmtBRL(v: number | null | undefined) {
  if (v == null) return '—'
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(v: string | null | undefined) {
  if (!v) return '—'
  return formatDate(String(v).slice(0, 10))
}

function fmtDateTime(v: string | null | undefined) {
  if (!v) return '—'
  const parsed = new Date(String(v).replace(' ', 'T'))
  if (Number.isNaN(parsed.getTime())) return String(v)
  return parsed.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

const MEDICAO_DESCONTO_OPTIONS = [
  'Manutenção',
  'Comercial',
  'Desconto Amigável',
  'Erro Operacional',
  'Logística de Obras',
  'Chuva',
  'Geoteste',
  'Outros',
  'Baixada de Equipe',
] as const

const CUSTOM_DESCONTO_VALUE = '__custom__'

type ExtraDraftItem = {
  descricao: string
  valor: string
  tipo: string
}

function buildExtraDraftItem(descricao: string, valor: string): ExtraDraftItem {
  const normalized = descricao.trim()
  const matched = MEDICAO_DESCONTO_OPTIONS.find((option) => option === normalized)
  return {
    descricao,
    valor,
    tipo: matched ?? (normalized ? CUSTOM_DESCONTO_VALUE : ''),
  }
}

function InlineCell({ value, onSave, type = 'text', disabled }: {
  value: string | number | null
  onSave: (v: string) => void
  type?: 'text' | 'number' | 'date'
  disabled?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value ?? ''))
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  function commit() {
    setEditing(false)
    if (draft !== String(value ?? '')) onSave(draft)
  }

  if (disabled) {
    return <span className="px-1 text-xs text-slate-600">{value ?? '—'}</span>
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={type}
        value={draft}
        className="w-full rounded border border-blue-400 px-1 py-0.5 text-xs focus:outline-none"
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(String(value ?? '')); setEditing(false) } }}
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => { setDraft(String(value ?? '')); setEditing(true) }}
      className="w-full rounded px-1 py-0.5 text-left text-xs text-slate-700 transition hover:bg-blue-50 hover:text-blue-700"
      title="Clique para editar"
    >
      {value != null && value !== '' ? String(value) : <span className="text-slate-300">—</span>}
    </button>
  )
}

function MedicaoOccurrencesCell({ row, disabled, saving, onSaveOccurrences, onRestoreDiary, onSaveComplement }: {
  row: MedicaoFatMinimoRow
  disabled: boolean
  saving: boolean
  onSaveOccurrences: (value: string) => void
  onRestoreDiary: () => void
  onSaveComplement: (value: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [complementEditing, setComplementEditing] = useState(false)
  const [complementDraft, setComplementDraft] = useState('')
  const occurrenceText = row.ocorrenciasMedicao ?? ''
  const badgeLabel = row.ocorrenciasEditadas ? 'Ocorrências da medição' : 'Diário de obra'

  function openEditor() {
    setDraft(occurrenceText)
    setEditing(true)
  }

  function saveEditor() {
    onSaveOccurrences(draft)
    setEditing(false)
  }

  function openComplementEditor() {
    setComplementDraft(row.observacaoManual ?? '')
    setComplementEditing(true)
  }

  function saveComplement() {
    onSaveComplement(complementDraft)
    setComplementEditing(false)
  }

  if (disabled) {
    return (
      <>
        {occurrenceText ? (
          <div className="mb-1.5">
            <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-700">{badgeLabel}</span>
            <div className="mt-1 whitespace-normal text-slate-700">{occurrenceText}</div>
          </div>
        ) : null}
        {row.observacaoManual ? (
          <div className={occurrenceText ? 'mt-1 text-slate-500' : ''}>
            {occurrenceText ? `Complemento: ${row.observacaoManual}` : row.observacaoManual}
          </div>
        ) : (!occurrenceText && '—')}
      </>
    )
  }

  return (
    <div>
      {editing ? (
        <div className="space-y-1.5">
          <textarea
            value={draft}
            onChange={event => setDraft(event.target.value)}
            rows={3}
            className="w-full min-w-[300px] rounded border border-blue-400 px-2 py-1 text-xs text-slate-700 focus:outline-none"
            placeholder="Informe as ocorrências desta medição"
          />
          <div className="flex flex-wrap gap-1">
            <button type="button" onClick={saveEditor} disabled={saving} className="rounded bg-blue-600 px-2 py-1 text-[10px] font-semibold text-white disabled:opacity-50">
              Salvar
            </button>
            <button type="button" onClick={() => setEditing(false)} className="rounded px-2 py-1 text-[10px] font-semibold text-slate-500 hover:bg-slate-100">
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <>
          {occurrenceText ? (
            <div className="mb-1.5">
              <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-700">{badgeLabel}</span>
              <div className="mt-1 whitespace-normal text-slate-700">{occurrenceText}</div>
            </div>
          ) : row.ocorrenciasEditadas && row.ocorrenciasDiario ? (
            <div className="mb-1 text-[10px] font-semibold text-slate-400">Ocorrência removida desta medição</div>
          ) : null}
          <div className="mb-1.5 flex flex-wrap gap-1">
            <button type="button" onClick={openEditor} disabled={saving} className="rounded bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50">
              {occurrenceText ? 'Editar' : 'Adicionar ocorrência'}
            </button>
            {occurrenceText && (
              <button type="button" onClick={() => onSaveOccurrences('')} disabled={saving} className="rounded bg-red-50 px-2 py-1 text-[10px] font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50">
                Excluir
              </button>
            )}
            {row.ocorrenciasEditadas && row.ocorrenciasDiario && (
              <button type="button" onClick={onRestoreDiary} disabled={saving} className="rounded bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-200 disabled:opacity-50">
                Restaurar do diário
              </button>
            )}
          </div>
        </>
      )}
      <div className="mt-1">
        <div className="mb-0.5 text-[10px] font-semibold uppercase text-slate-400">Observação adicional</div>
        {complementEditing ? (
          <div className="space-y-1.5">
            <textarea
              value={complementDraft}
              onChange={event => setComplementDraft(event.target.value)}
              rows={2}
              className="w-full min-w-[260px] rounded border border-blue-400 px-2 py-1 text-xs text-slate-700 focus:outline-none"
              placeholder="Adicione uma observação adicional"
            />
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={saveComplement}
                disabled={saving}
                className="rounded bg-blue-600 px-2 py-1 text-[10px] font-semibold text-white disabled:opacity-50"
              >
                Salvar
              </button>
              <button
                type="button"
                onClick={() => setComplementEditing(false)}
                className="rounded px-2 py-1 text-[10px] font-semibold text-slate-500 hover:bg-slate-100"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 min-w-[120px]">
              {row.observacaoManual?.trim() ? row.observacaoManual : '—'}
            </div>
            <button
              type="button"
              onClick={openComplementEditor}
              disabled={saving}
              className="rounded bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
            >
              {row.observacaoManual?.trim() ? 'Editar' : 'Adicionar'}
            </button>
            {row.observacaoManual?.trim() ? (
              <button
                type="button"
                onClick={() => onSaveComplement('')}
                disabled={saving}
                className="rounded bg-red-50 px-2 py-1 text-[10px] font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50"
              >
                Excluir
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}

function MedicaoDetalhePageInner() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const medicaoId = Number(id)

  const [headerEdit, setHeaderEdit] = useState(false)
  const [headerDraft, setHeaderDraft] = useState({
    tipoMedicao: 'parcial' as 'adiantamento' | 'inicial' | 'parcial' | 'final',
    responsavelMedicao: '',
    issqnPct: '',
    pctNf: '',
    pctLocacao: '',
    issqnCobradoCliente: false,
  })
  const [headerError, setHeaderError] = useState('')
  const [extraDraft, setExtraDraft] = useState<ExtraDraftItem[]>([])
  const [extraError, setExtraError] = useState('')
  const [editingExtras, setEditingExtras] = useState(false)
  const [actionError, setActionError] = useState('')
  const [signatureNotice, setSignatureNotice] = useState('')
  const [deletingEstacaId, setDeletingEstacaId] = useState<number | null>(null)

  const query = useQuery({
    queryKey: ['medicao-detalhe', medicaoId],
    queryFn: () => medicoesApi.get(medicaoId),
    staleTime: 30_000,
  })

  const colaboradoresQuery = useQuery({
    queryKey: ['usuarios-options'],
    queryFn: usuarioService.listOptions,
    staleTime: 1000 * 60 * 15,
  })

  const data = query.data
  const medicao = data?.medicao
  const isFechada = medicao?.status === 'fechada'

  const assinaturaQuery = useQuery({
    queryKey: ['medicao-assinatura', medicaoId],
    queryFn: () => medicoesApi.assinaturaStatus(medicaoId),
    enabled: Boolean(medicaoId),
  })
  const assinatura = assinaturaQuery.data
  const assinaturaStatus = assinatura?.status ?? medicao?.assinatura_status ?? 'nao_gerado'
  const assinaturaProtegida = assinaturaStatus === 'assinado'
  const assinaturaClienteNome = assinatura?.clientName || medicao?.assinatura_cliente_nome || ''
  const assinaturaClienteData = assinatura?.signedAt || medicao?.assinatura_assinada_em || medicao?.assinatura_enviada_em || ''
  const assinaturaClienteResumo = assinaturaStatus === 'assinado'
    ? `Assinada por ${assinaturaClienteNome || 'cliente'} em ${fmtDateTime(assinaturaClienteData)}`
    : assinaturaStatus === 'aguardando_assinatura'
      ? `Aguardando assinatura do cliente${assinaturaClienteData ? ` desde ${fmtDateTime(assinaturaClienteData)}` : ''}`
      : assinaturaStatus === 'expirado'
        ? 'Link de assinatura expirado'
        : 'Ainda sem link de assinatura'

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: ['medicao-detalhe', medicaoId] })
  }

  const statusMutation = useMutation({
    mutationFn: (s: 'rascunho' | 'fechada') => medicoesApi.setStatus(medicaoId, s),
    onSuccess: () => { setActionError(''); void invalidate(); void assinaturaQuery.refetch() },
    onError: e => setActionError(extractApiErrorMessage(e)),
  })

  const gerarAssinaturaMutation = useMutation({
    mutationFn: () => medicoesApi.gerarLinkAssinatura(medicaoId),
    onSuccess: async (result) => {
      setActionError('')
      setSignatureNotice('Link de assinatura gerado. Ele expira em 24 horas.')
      await queryClient.invalidateQueries({ queryKey: ['medicao-assinatura', medicaoId] })
      if (navigator.clipboard && result.publicUrl) {
        await navigator.clipboard.writeText(result.publicUrl).catch(() => undefined)
      }
    },
    onError: e => setActionError(extractApiErrorMessage(e)),
  })

  async function copySignatureLink() {
    if (!assinatura?.publicUrl) return
    await navigator.clipboard.writeText(assinatura.publicUrl).catch(() => undefined)
    setSignatureNotice('Link copiado para enviar ao cliente.')
  }

  const headerMutation = useMutation({
    mutationFn: () => medicoesApi.update(medicaoId, {
      tipoMedicao: headerDraft.tipoMedicao,
      responsavelMedicao: headerDraft.responsavelMedicao,
      issqnPct: headerDraft.issqnPct !== '' ? parseFloat(headerDraft.issqnPct.replace(',', '.')) || 0 : null,
      pctNf: headerDraft.pctNf !== '' ? parseFloat(headerDraft.pctNf.replace(',', '.')) || 0 : null,
      pctLocacao: headerDraft.pctLocacao !== '' ? parseFloat(headerDraft.pctLocacao.replace(',', '.')) || 0 : null,
      issqnCobradoCliente: headerDraft.issqnCobradoCliente,
    }),
    onSuccess: async () => { setHeaderEdit(false); setHeaderError(''); await invalidate() },
    onError: e => setHeaderError(extractApiErrorMessage(e)),
  })

  const extrasMutation = useMutation({
    mutationFn: (items: { descricao: string; valor: number }[]) =>
      medicoesApi.update(medicaoId, { itensExtras: items }),
    onSuccess: async () => { setEditingExtras(false); setExtraError(''); await invalidate() },
    onError: e => setExtraError(extractApiErrorMessage(e)),
  })

  const obsDiaMutation = useMutation({
    mutationFn: ({ data, observacao }: { data: string; observacao: string }) =>
      medicoesApi.salvarObservacaoDia(medicaoId, data, observacao),
    onSuccess: () => invalidate(),
    onError: e => setActionError(extractApiErrorMessage(e)),
  })

  const ocorrenciasDiaMutation = useMutation({
    mutationFn: ({ data, ocorrencias, restaurarDiario = false }: { data: string; ocorrencias: string; restaurarDiario?: boolean }) =>
      medicoesApi.salvarOcorrenciasDia(medicaoId, data, ocorrencias, restaurarDiario),
    onSuccess: () => invalidate(),
    onError: e => setActionError(extractApiErrorMessage(e)),
  })

  const estacaMutation = useMutation({
    mutationFn: ({ eId, patch }: { eId: number; patch: Partial<MedicaoEstaca> }) =>
      medicoesApi.updateEstaca(medicaoId, eId, patch),
    onSuccess: () => invalidate(),
    onError: e => setActionError(extractApiErrorMessage(e)),
  })

  const addEstacaMutation = useMutation({
    mutationFn: () => medicoesApi.addEstaca(medicaoId, {
      data_estaca: null, nome_estaca: 'Nova estaca', diametro: null, profundidade: null,
      valor_metro: null, uso_bits: 0, metros_armacao: null, valor_armacao_metro: null,
    }),
    onSuccess: () => { setActionError(''); void invalidate() },
    onError: e => setActionError(extractApiErrorMessage(e)),
  })

  const removeEstacaMutation = useMutation({
    mutationFn: (eId: number) => medicoesApi.removeEstaca(medicaoId, eId),
    onSuccess: () => { setDeletingEstacaId(null); void invalidate() },
    onError: e => setActionError(extractApiErrorMessage(e)),
  })

  const reimportarMutation = useMutation({
    mutationFn: () => medicoesApi.reimportar(medicaoId),
    onSuccess: async (r) => { setActionError(''); await invalidate(); alert(`${r.estacasImportadas} estacas importadas dos diários aprovados.`) },
    onError: e => setActionError(extractApiErrorMessage(e)),
  })

  if (query.isLoading) return <div className="page-shell"><QueryFeedback type="loading" title="Carregando medição" /></div>
  if (query.isError || !data || !medicao) return <div className="page-shell"><QueryFeedback type="error" title="Erro" description={extractApiErrorMessage(query.error)} /></div>

  const { estacas, extras, fatMinimoTable, totais } = data

  function patchEstaca(eId: number, field: string, rawValue: string) {
    let value: string | number | null = rawValue
    const numFields = ['diametro', 'profundidade', 'valor_metro', 'metros_armacao', 'valor_armacao_metro', 'custo_total']
    if (numFields.includes(field)) {
      const n = parseFloat(rawValue.replace(',', '.'))
      value = isNaN(n) ? null : n
    }
    if (field === 'uso_bits') value = rawValue === 'true' || rawValue === '1' ? 1 : 0
    estacaMutation.mutate({ eId, patch: { [field]: value } })
  }

  function openEditExtras() {
    setExtraDraft(extras.map(e => buildExtraDraftItem(e.descricao, String(e.valor))))
    setEditingExtras(true)
  }

  function saveExtras() {
    const items = extraDraft
      .filter(e => e.descricao.trim())
      .map(e => ({ descricao: e.descricao, valor: parseFloat(e.valor.replace(',', '.')) || 0 }))
    extrasMutation.mutate(items)
  }

  return (
    <div className="page-shell">
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate('/medicoes')} className="btn btn-secondary btn-icon">
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="page-heading">Medição #{medicao.numero} — {medicao.obra_numero}</h1>
            <p className="page-subtitle">{medicao.cliente} · {fmtDate(medicao.data_inicio)} até {fmtDate(medicao.data_fim)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={medicoesApi.pdfUrl(medicaoId)}
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary"
          >
            <Download size={14} />
            PDF
          </a>
          {isFechada && assinaturaStatus !== 'assinado' && (
            <button
              type="button"
              onClick={() => gerarAssinaturaMutation.mutate()}
              disabled={gerarAssinaturaMutation.isPending}
              className="btn btn-primary"
            >
              <Link2 size={14} />
              {assinaturaStatus === 'aguardando_assinatura' ? 'Gerar novo link' : 'Enviar para assinatura'}
            </button>
          )}
          <button
            type="button"
            onClick={() => statusMutation.mutate(isFechada ? 'rascunho' : 'fechada')}
            disabled={statusMutation.isPending || (isFechada && assinaturaProtegida)}
            className={isFechada ? 'btn btn-secondary' : 'btn btn-primary'}
            title={isFechada && assinaturaProtegida ? 'A medição já foi assinada.' : undefined}
          >
            {isFechada ? <><LockOpen size={14} /> Reabrir</> : <><Lock size={14} /> Fechar medição</>}
          </button>
        </div>
      </div>

      {actionError && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</div>
      )}

      {isFechada && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          <Lock size={14} /> {assinaturaProtegida ? 'Medição assinada pelo cliente — edição bloqueada.' : 'Medição fechada — edição bloqueada. Ao reabrir, qualquer link pendente será cancelado.'}
        </div>
      )}

      {isFechada && (
        <div className="app-panel mb-6 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                {assinaturaStatus === 'assinado' ? <CheckCircle2 size={16} className="text-emerald-600" /> : <Link2 size={16} className="text-slate-500" />}
                Assinatura do cliente
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {assinaturaStatus === 'assinado'
                  ? `Assinada por ${assinatura?.clientName || medicao.assinatura_cliente_nome || 'cliente'} em ${fmtDateTime(assinatura?.signedAt || medicao.assinatura_assinada_em)}.`
                  : assinaturaStatus === 'aguardando_assinatura'
                    ? `Aguardando assinatura. Link valido ate ${fmtDateTime(assinatura?.expiresAt)}.`
                    : assinaturaStatus === 'expirado'
                      ? 'O link anterior expirou. Gere um novo link para reenviar.'
                      : 'Feche e envie a medição para o cliente assinar por um link.'}
              </p>
            </div>
            {assinatura?.publicUrl && assinaturaStatus === 'aguardando_assinatura' && (
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void copySignatureLink()} className="btn btn-secondary text-xs">
                  <Copy size={12} /> Copiar link
                </button>
                <a
                  className="btn btn-secondary text-xs"
                  target="_blank"
                  rel="noreferrer"
                  href={`https://wa.me/?text=${encodeURIComponent(assinatura.whatsappText || `Segue o link para assinatura da medição: ${assinatura.publicUrl}`)}`}
                >
                  Enviar no WhatsApp
                </a>
              </div>
            )}
          </div>
          {signatureNotice && <div className="mt-3 text-xs font-semibold text-emerald-700">{signatureNotice}</div>}
        </div>
      )}

      {/* Info cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard label="Estacas" value={String(estacas.length)} />
        <StatCard label="Valor estacas" value={`R$ ${fmtBRL(totais.valorEstacas)}`} />
        <StatCard label="Fat. mínimo" value={`R$ ${fmtBRL(totais.valorFatMinimo)}`} color={totais.valorFatMinimo > 0 ? 'amber' : undefined} />
        <StatCard label="Total geral" value={`R$ ${fmtBRL(totais.valorTotal)}`} color="green" bold />
      </div>

      {/* Header info */}
      <div className="app-panel mb-6">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <div className="text-sm font-bold text-slate-800">Informações da medição</div>
          {!isFechada && !headerEdit && (
            <button type="button" onClick={() => { setHeaderDraft({ tipoMedicao: medicao.tipo_medicao ?? 'parcial', responsavelMedicao: medicao.responsavel_medicao ?? '', issqnPct: medicao.issqn_pct != null ? String(medicao.issqn_pct) : '', pctNf: medicao.pct_nf != null ? String(medicao.pct_nf) : '', pctLocacao: medicao.pct_locacao != null ? String(medicao.pct_locacao) : '', issqnCobradoCliente: Number(medicao.issqn_cobrado_cliente) === 1 }); setHeaderEdit(true) }} className="btn btn-secondary text-xs">
              <Pencil size={12} /> Editar
            </button>
          )}
        </div>
        {headerEdit ? (
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <div>
              <label className="field-label">Tipo da medição</label>
              <select value={headerDraft.tipoMedicao} onChange={e => setHeaderDraft(d => ({ ...d, tipoMedicao: e.target.value as typeof headerDraft.tipoMedicao }))} className="field-select">
                <option value="adiantamento">Adiantamento</option>
                <option value="inicial">Inicial</option>
                <option value="parcial">Parcial</option>
                <option value="final">Final</option>
              </select>
            </div>
            <div>
              <label className="field-label">Responsável pela medição</label>
              <select value={headerDraft.responsavelMedicao} onChange={e => setHeaderDraft(d => ({ ...d, responsavelMedicao: e.target.value }))} className="field-select">
                <option value="">Selecione um colaborador</option>
                {headerDraft.responsavelMedicao && !colaboradoresQuery.data?.some(colaborador => colaborador.nome === headerDraft.responsavelMedicao) && (
                  <option value={headerDraft.responsavelMedicao}>{headerDraft.responsavelMedicao}</option>
                )}
                {colaboradoresQuery.data?.map(colaborador => (
                  <option key={colaborador.id} value={colaborador.nome}>{colaborador.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Assinatura do cliente</label>
              <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                {assinaturaClienteResumo}
              </div>
            </div>
            <div>
              <label className="field-label">% NF (Nota Fiscal)</label>
              <input type="number" min="0" max="100" step="0.01" placeholder="Ex: 70" value={headerDraft.pctNf} onChange={e => setHeaderDraft(d => ({ ...d, pctNf: e.target.value }))} className="field-input" />
            </div>
            <div>
              <label className="field-label">% Fatura de Locação</label>
              <input type="number" min="0" max="100" step="0.01" placeholder="Ex: 30" value={headerDraft.pctLocacao} onChange={e => setHeaderDraft(d => ({ ...d, pctLocacao: e.target.value }))} className="field-input" />
            </div>
            <div>
              <label className="field-label">ISSQN (% sobre NF)</label>
              <input type="number" min="0" max="100" step="0.01" placeholder="Ex: 3" value={headerDraft.issqnPct} onChange={e => setHeaderDraft(d => ({ ...d, issqnPct: e.target.value }))} className="field-input" />
            </div>
            <div className="flex items-center gap-3 pt-5">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
                <input type="checkbox" checked={headerDraft.issqnCobradoCliente} onChange={e => setHeaderDraft(d => ({ ...d, issqnCobradoCliente: e.target.checked }))} className="rounded" />
                ISSQN cobrado do cliente
              </label>
            </div>
            {headerError && <div className="col-span-2 text-sm text-red-600">{headerError}</div>}
            <div className="col-span-2 flex gap-2">
              <button type="button" onClick={() => headerMutation.mutate()} disabled={headerMutation.isPending} className="btn btn-primary text-xs">
                <Save size={12} /> {headerMutation.isPending ? 'Salvando...' : 'Salvar'}
              </button>
              <button type="button" onClick={() => setHeaderEdit(false)} className="btn btn-secondary text-xs">Cancelar</button>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4 text-sm">
            <InfoItem label="Período" value={`${fmtDate(medicao.data_inicio)} — ${fmtDate(medicao.data_fim)}`} />
            <InfoItem label="Tipo" value={medicao.tipo_medicao || 'parcial'} />
            <InfoItem label="Responsável" value={medicao.responsavel_medicao || '—'} />
            <InfoItem label="Assinatura do cliente" value={assinaturaClienteResumo} />
            <InfoItem label="% NF" value={medicao.pct_nf != null && medicao.pct_nf > 0 ? `${fmtBRL(medicao.pct_nf)}%` : '—'} />
            <InfoItem label="% Locação" value={medicao.pct_locacao != null && medicao.pct_locacao > 0 ? `${fmtBRL(medicao.pct_locacao)}%` : '—'} />
            <InfoItem label="ISSQN" value={medicao.issqn_pct != null && medicao.issqn_pct > 0 ? `${fmtBRL(medicao.issqn_pct)}% ${Number(medicao.issqn_cobrado_cliente) === 1 ? '(cobrado do cliente)' : '(incluso)'}` : '—'} />
          </div>
        )}
      </div>

      {/* Stake table */}
      <div className="app-panel mb-6 overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <div className="text-sm font-bold text-slate-800">Estacas ({estacas.length})</div>
          {!isFechada && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { if (confirm('Reimportar apaga as estacas atuais e repuxa dos diários aprovados no período. Continuar?')) reimportarMutation.mutate() }}
                disabled={reimportarMutation.isPending}
                className="btn btn-secondary text-xs"
                title="Repuxa estacas dos diários aprovados no período"
              >
                <RefreshCw size={12} className={reimportarMutation.isPending ? 'animate-spin' : ''} />
                {reimportarMutation.isPending ? 'Importando...' : 'Reimportar'}
              </button>
              <button type="button" onClick={() => addEstacaMutation.mutate()} disabled={addEstacaMutation.isPending} className="btn btn-primary text-xs">
                <Plus size={12} /> Adicionar estaca
              </button>
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-400">
                <th className="w-10 px-4 py-3 text-center whitespace-nowrap">#</th>
                <th className="min-w-[100px] px-4 py-3 text-left whitespace-nowrap">Data</th>
                <th className="min-w-[80px] px-4 py-3 text-left whitespace-nowrap">Estaca</th>
                <th className="min-w-[60px] px-4 py-3 text-right whitespace-nowrap">Ø (CM)</th>
                <th className="min-w-[70px] px-4 py-3 text-right whitespace-nowrap">Prof. (M)</th>
                <th className="min-w-[50px] px-4 py-3 text-center whitespace-nowrap">Bits</th>
                <th className="min-w-[70px] px-4 py-3 text-right whitespace-nowrap">Arm. (M)</th>
                <th className="min-w-[60px] px-4 py-3 text-right whitespace-nowrap">R$/M</th>
                <th className="min-w-[70px] px-4 py-3 text-right whitespace-nowrap">R$/Arm.</th>
                <th className="min-w-[90px] px-4 py-3 text-right font-bold text-slate-600 whitespace-nowrap">Total</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Observações</th>
                {!isFechada && <th className="w-10" />}
              </tr>
            </thead>
            <tbody>
              {estacas.map((e, idx) => (
                <EstacaRow
                  key={e.id}
                  idx={idx}
                  estaca={e}
                  disabled={isFechada}
                  confirmingDelete={deletingEstacaId === e.id}
                  onPatch={(field, val) => patchEstaca(e.id, field, val)}
                  onDeleteRequest={() => setDeletingEstacaId(e.id)}
                  onDeleteCancel={() => setDeletingEstacaId(null)}
                  onDeleteConfirm={() => removeEstacaMutation.mutate(e.id)}
                  isDeleting={removeEstacaMutation.isPending && deletingEstacaId === e.id}
                />
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid grid-cols-4 divide-x divide-slate-100 border-t-2 border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3 px-5 py-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
              <Layers size={20} />
            </div>
            <div>
              <div className="text-xl font-black text-slate-800">{estacas.length}</div>
              <div className="text-xs text-slate-400">Estacas</div>
            </div>
          </div>
          <div className="flex items-center gap-3 px-5 py-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
              <ArrowDown size={20} />
            </div>
            <div>
              <div className="text-xl font-black text-slate-800">{fmtBRL(estacas.reduce((s, e) => s + (Number(e.profundidade) || 0), 0))} m</div>
              <div className="text-xs text-slate-400">Profundidade total</div>
            </div>
          </div>
          <div className="flex items-center gap-3 px-5 py-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
              <Grip size={20} />
            </div>
            <div>
              <div className="text-xl font-black text-slate-800">{fmtBRL(estacas.reduce((s, e) => s + (Number(e.metros_armacao) || 0), 0))} m</div>
              <div className="text-xs text-slate-400">Armação total</div>
            </div>
          </div>
          <div className="flex items-center gap-3 px-5 py-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
              <DollarSign size={20} />
            </div>
            <div>
              <div className="text-xl font-black text-slate-800">R$ {fmtBRL(totais.valorEstacas)}</div>
              <div className="text-xs text-slate-400">Valor total</div>
            </div>
          </div>
        </div>
      </div>

      {/* Fat mínimo table */}
      {fatMinimoTable.length > 0 && (
        <div className="app-panel mb-6 overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-3">
            <div className="text-sm font-bold text-slate-800">
              Faturamento Mínimo Diário
              {medicao.fat_minimo_valor != null && (
                <span className="ml-2 text-xs font-normal text-slate-400">R$ {fmtBRL(medicao.fat_minimo_valor)}/dia</span>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2 text-left">Data</th>
                  <th className="px-4 py-2 text-right">Produção</th>
                  <th className="px-4 py-2 text-right">Saldo Fat. Mín</th>
                  <th className="px-4 py-2 text-left">Observações</th>
                </tr>
              </thead>
              <tbody>
                {fatMinimoTable.map(row => (
                  <tr key={row.data} className={row.dayType || row.producao === 0 ? 'bg-red-50/40 text-red-600' : 'border-b border-slate-50'}>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {fmtDate(row.data)}
                      {row.dayType && <span className="ml-1 text-[10px] font-medium">({row.dayType})</span>}
                    </td>
                    <td className="px-4 py-2 text-right">{row.producao > 0 ? `R$ ${fmtBRL(row.producao)}` : 'R$ —'}</td>
                    <td className="px-4 py-2 text-right font-semibold">
                      {row.saldo > 0 ? `R$ ${fmtBRL(row.saldo)}` : '—'}
                    </td>
                    <td className="px-4 py-2 text-slate-600 max-w-xs min-w-[160px]">
                      <MedicaoOccurrencesCell
                        row={row}
                        disabled={isFechada}
                        saving={ocorrenciasDiaMutation.isPending}
                        onSaveOccurrences={v => ocorrenciasDiaMutation.mutate({ data: row.data, ocorrencias: v })}
                        onRestoreDiary={() => ocorrenciasDiaMutation.mutate({ data: row.data, ocorrencias: '', restaurarDiario: true })}
                        onSaveComplement={v => obsDiaMutation.mutate({ data: row.data, observacao: v })}
                      />
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold">
                  <td className="px-4 py-2 text-right text-slate-500" colSpan={2}>TOTAL FAT. MÍNIMO</td>
                  <td className="px-4 py-2 text-right text-amber-700">R$ {fmtBRL(totais.valorFatMinimo)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Extras */}
      <div className="app-panel mb-6">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <div className="text-sm font-bold text-slate-800">Acréscimos e Descontos</div>
          {!isFechada && !editingExtras && (
            <button type="button" onClick={openEditExtras} className="btn btn-secondary text-xs">
              <Pencil size={12} /> Editar
            </button>
          )}
        </div>

        {editingExtras ? (
          <div className="p-5">
            <div className="flex flex-col gap-2">
              {extraDraft.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex-1">
                    <select
                      value={item.tipo}
                      onChange={e => setExtraDraft(d => d.map((x, j) => j === i ? {
                        ...x,
                        tipo: e.target.value,
                        descricao: e.target.value === CUSTOM_DESCONTO_VALUE ? '' : e.target.value,
                      } : x))}
                      className="field-select text-sm"
                    >
                      <option value="">Selecione o motivo do desconto</option>
                      {MEDICAO_DESCONTO_OPTIONS.map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                      <option value={CUSTOM_DESCONTO_VALUE}>Outros (personalizar)</option>
                    </select>
                    {item.tipo === CUSTOM_DESCONTO_VALUE && (
                      <input
                        type="text"
                        value={item.descricao}
                        onChange={e => setExtraDraft(d => d.map((x, j) => j === i ? { ...x, descricao: e.target.value } : x))}
                        placeholder="Descreva o desconto"
                        className="field-input mt-2 text-sm"
                      />
                    )}
                  </div>
                  <input
                    type="number"
                    value={item.valor}
                    onChange={e => setExtraDraft(d => d.map((x, j) => j === i ? { ...x, valor: e.target.value } : x))}
                    placeholder="Valor (negativo = desconto)"
                    className="field-input w-40 text-sm"
                    step="0.01"
                  />
                  <button type="button" onClick={() => setExtraDraft(d => d.filter((_, j) => j !== i))} className="btn btn-secondary btn-icon text-red-500">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => setExtraDraft(d => [...d, buildExtraDraftItem('', '')])} className="btn btn-secondary text-xs w-fit">
                <Plus size={12} /> Adicionar item
              </button>
            </div>
            {extraError && <div className="mt-2 text-sm text-red-600">{extraError}</div>}
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={saveExtras} disabled={extrasMutation.isPending} className="btn btn-primary text-xs">
                <Save size={12} /> {extrasMutation.isPending ? 'Salvando...' : 'Salvar'}
              </button>
              <button type="button" onClick={() => setEditingExtras(false)} className="btn btn-secondary text-xs">Cancelar</button>
            </div>
          </div>
        ) : (
          <div>
            {extras.length === 0 ? (
              <div className="px-5 py-6 text-center text-sm text-slate-400">Nenhum acréscimo ou desconto adicionado.</div>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {extras.map(e => (
                    <tr key={e.id} className="border-b border-slate-50">
                      <td className="px-5 py-2 text-slate-700">{e.descricao}</td>
                      <td className={`px-5 py-2 text-right font-semibold ${Number(e.valor) < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                        {Number(e.valor) < 0 ? '-' : ''}R$ {fmtBRL(Math.abs(Number(e.valor)))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Final totals */}
      <div className="app-panel mb-6">
        <div className="border-b border-slate-100 px-5 py-3 text-sm font-bold text-slate-800">Descrição Serviços</div>
        <div className="divide-y divide-slate-50">
          <SummaryRow label="Medição das estacas" value={totais.valorEstacas} />
          {totais.valorFatMinimo > 0 && <SummaryRow label="Saldo Faturamento Mínimo Diário" value={totais.valorFatMinimo} />}
          {extras.map(e => <SummaryRow key={e.id} label={e.descricao} value={Number(e.valor)} />)}
          <SummaryRow label="TOTAL" value={totais.valorTotal} bold />
          {totais.issqnPct > 0 && (
            <SummaryRow
              label={totais.issqnCobradoCliente ? `ISSQN (${fmtBRL(totais.issqnPct)}% sobre NF) — cobrado do cliente` : `ISSQN (${fmtBRL(totais.issqnPct)}% sobre NF) — incluso nos preços`}
              value={totais.issqnCobradoCliente ? totais.valorIssqn : -totais.valorIssqn}
            />
          )}
          {(() => {
            const brutoNf = totais.pctNf > 0
              ? (totais.issqnCobradoCliente ? totais.valorNf + totais.valorIssqn : totais.valorNf)
              : (totais.issqnCobradoCliente ? totais.valorTotal + totais.valorIssqn : totais.valorTotal)
            const liquidoNf = totais.pctNf > 0
              ? (totais.issqnCobradoCliente ? totais.valorNf : totais.valorNf - totais.valorIssqn)
              : (totais.issqnCobradoCliente ? totais.valorTotal : totais.valorTotal - totais.valorIssqn)
            const nfLabel = totais.pctNf > 0 ? `NF (${fmtBRL(totais.pctNf)}%)` : 'NF'
            return <>
              <SummaryRow label={`VALOR BRUTO (R$) — ${nfLabel}`} value={brutoNf} bold />
              <SummaryRow label={`VALOR LÍQUIDO (R$) — ${nfLabel}`} value={liquidoNf} bold />
              {totais.pctLocacao > 0 && <SummaryRow label={`VALOR (R$) — FATURA DE LOCAÇÃO (${fmtBRL(totais.pctLocacao)}%)`} value={totais.valorLocacao} bold />}
            </>
          })()}
        </div>
      </div>
    </div>
  )
}

export default function MedicaoDetalhePage() {
  return (
    <PageErrorBoundary>
      <MedicaoDetalhePageInner />
    </PageErrorBoundary>
  )
}

function EstacaRow({ idx, estaca, disabled, confirmingDelete, onPatch, onDeleteRequest, onDeleteCancel, onDeleteConfirm, isDeleting }: {
  idx: number
  estaca: MedicaoEstaca
  disabled: boolean
  confirmingDelete: boolean
  onPatch: (field: string, val: string) => void
  onDeleteRequest: () => void
  onDeleteCancel: () => void
  onDeleteConfirm: () => void
  isDeleting: boolean
}) {
  return (
    <tr className="border-b border-slate-100 transition-colors hover:bg-slate-50/60">
      <td className="px-4 py-3 text-center text-slate-400">{idx + 1}</td>
      <td className="px-4 py-3"><InlineCell value={estaca.data_estaca ? String(estaca.data_estaca).slice(0, 10) : ''} onSave={v => onPatch('data_estaca', v)} type="date" disabled={disabled} /></td>
      <td className="px-4 py-3 font-medium text-slate-800"><InlineCell value={estaca.nome_estaca} onSave={v => onPatch('nome_estaca', v)} disabled={disabled} /></td>
      <td className="px-4 py-3 text-right"><InlineCell value={estaca.diametro} onSave={v => onPatch('diametro', v)} type="number" disabled={disabled} /></td>
      <td className="px-4 py-3 text-right"><InlineCell value={estaca.profundidade} onSave={v => onPatch('profundidade', v)} type="number" disabled={disabled} /></td>
      <td className="px-4 py-3 text-center">
        {disabled
          ? <span className={estaca.uso_bits ? 'font-semibold text-emerald-600' : 'text-slate-400'}>{estaca.uso_bits ? 'Sim' : 'Não'}</span>
          : <button type="button" onClick={() => onPatch('uso_bits', estaca.uso_bits ? '0' : '1')} className={`rounded px-2 py-0.5 text-sm font-medium transition hover:bg-emerald-50 ${estaca.uso_bits ? 'text-emerald-600' : 'text-slate-400'}`}>
              {estaca.uso_bits ? 'Sim' : 'Não'}
            </button>
        }
      </td>
      <td className="px-4 py-3 text-right"><InlineCell value={estaca.metros_armacao} onSave={v => onPatch('metros_armacao', v)} type="number" disabled={disabled} /></td>
      <td className="px-4 py-3 text-right"><InlineCell value={estaca.valor_metro} onSave={v => onPatch('valor_metro', v)} type="number" disabled={disabled} /></td>
      <td className="px-4 py-3 text-right"><InlineCell value={estaca.valor_armacao_metro} onSave={v => onPatch('valor_armacao_metro', v)} type="number" disabled={disabled} /></td>
      <td className="px-4 py-3 text-right font-semibold text-slate-800">
        {disabled
          ? (estaca.custo_total != null ? `R$ ${fmtBRL(estaca.custo_total)}` : '—')
          : <InlineCell value={estaca.custo_total} onSave={v => onPatch('custo_total', v)} type="number" disabled={false} />
        }
      </td>
      <td className="px-4 py-3"><InlineCell value={estaca.observacao} onSave={v => onPatch('observacao', v)} disabled={disabled} /></td>
      {!disabled && (
        <td className="px-1 py-1">
          {confirmingDelete ? (
            <div className="flex items-center gap-1">
              <button type="button" onClick={onDeleteConfirm} disabled={isDeleting} className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 hover:bg-red-200">
                {isDeleting ? '...' : 'OK'}
              </button>
              <button type="button" onClick={onDeleteCancel} className="rounded px-1 py-0.5 text-slate-400 hover:text-slate-600">
                <X size={11} />
              </button>
            </div>
          ) : (
            <button type="button" onClick={onDeleteRequest} className="rounded p-0.5 text-slate-300 hover:text-red-500">
              <Trash2 size={12} />
            </button>
          )}
        </td>
      )}
    </tr>
  )
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</div>
      <div className="mt-0.5 text-sm text-slate-800">{value}</div>
    </div>
  )
}

function StatCard({ label, value, color, bold }: { label: string; value: string; color?: string; bold?: boolean }) {
  const colors: Record<string, string> = {
    green: 'border-emerald-200 bg-emerald-50',
    amber: 'border-amber-200 bg-amber-50',
  }
  return (
    <div className={`app-panel p-4 ${color ? colors[color] : ''}`}>
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</div>
      <div className={`mt-1 text-lg ${bold ? 'font-black text-slate-900' : 'font-semibold text-slate-700'}`}>{value}</div>
    </div>
  )
}

function SummaryRow({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  const isNeg = value < 0
  return (
    <div className={`flex items-center justify-between px-5 py-2.5 ${bold ? 'bg-slate-50' : ''}`}>
      <span className={`text-sm ${bold ? 'font-bold text-slate-800' : 'text-slate-600'}`}>{label}</span>
      <span className={`text-sm ${bold ? 'font-bold text-slate-900' : ''} ${isNeg ? 'text-red-600' : ''}`}>
        {isNeg ? '-' : ''}R$ {fmtBRL(Math.abs(value))}
      </span>
    </div>
  )
}
