import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Archive, Download, FileSpreadsheet, FileText, Plus, RefreshCw, Save, Search, Trash2, Upload } from 'lucide-react'
import QueryFeedback from '@/components/ui/QueryFeedback'
import {
  documentosService,
  extractApiErrorMessage,
  obraService,
  usuarioService,
  type DocumentoColaborador,
  type DocumentoEnvio,
  type DocumentoTipo,
} from '@/lib/gontijo-api'
import { cn, formatDate } from '@/lib/utils'

type TabKey = 'cargos' | 'tipos' | 'colaboradores' | 'envios'

type TipoForm = {
  id: number | null
  secao: string
  nome: string
  codigo: string
  obrigatorio: boolean
  validadePadraoDias: string
  cargoIds: number[]
}

type DocForm = {
  id: number | null
  tipoDocumentoId: string
  url: string
  nomeArquivo: string
  dataEmissao: string
  vencimento: string
  observacao: string
}

type EnvioForm = {
  id: number | null
  obraId: string
  nome: string
  status: DocumentoEnvio['status']
}

const emptyTipo: TipoForm = {
  id: null,
  secao: 'Documentos Pessoais',
  nome: '',
  codigo: '',
  obrigatorio: true,
  validadePadraoDias: '',
  cargoIds: [],
}

const emptyDoc: DocForm = {
  id: null,
  tipoDocumentoId: '',
  url: '',
  nomeArquivo: '',
  dataEmissao: '',
  vencimento: '',
  observacao: '',
}

const emptyEnvio: EnvioForm = {
  id: null,
  obraId: '',
  nome: '',
  status: 'rascunho',
}

const statusLabels: Record<DocumentoColaborador['status'], string> = {
  vigente: 'Vigente',
  vence_em_breve: 'Vence em breve',
  vencido: 'Vencido',
  sem_vencimento: 'Sem vencimento',
}

function statusClass(status: DocumentoColaborador['status']) {
  if (status === 'vigente') return 'status-success'
  if (status === 'vence_em_breve') return 'status-warning'
  if (status === 'vencido') return 'status-danger'
  return 'status-neutral'
}

function toNumberOrNull(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && value.trim() ? parsed : null
}

export default function DocumentosPage() {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('cargos')
  const [cargoNome, setCargoNome] = useState('')
  const [tipoForm, setTipoForm] = useState<TipoForm>(emptyTipo)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [docForm, setDocForm] = useState<DocForm>(emptyDoc)
  const [envioForm, setEnvioForm] = useState<EnvioForm>(emptyEnvio)
  const [selectedEnvioId, setSelectedEnvioId] = useState('')
  const [selectedItemKeys, setSelectedItemKeys] = useState<Set<string>>(new Set())
  const [extraForm, setExtraForm] = useState({ nome: '', url: '', observacao: '' })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const cargosQuery = useQuery({ queryKey: ['documentos-cargos'], queryFn: documentosService.listCargos })
  const tiposQuery = useQuery({ queryKey: ['documentos-tipos'], queryFn: documentosService.listTipos })
  const usuariosQuery = useQuery({ queryKey: ['documentos-usuarios-options'], queryFn: usuarioService.listOptions, staleTime: 1000 * 60 * 5 })
  const obrasQuery = useQuery({ queryKey: ['documentos-obras-options'], queryFn: () => obraService.list({ page: 1, limit: 500 }), staleTime: 1000 * 60 * 5 })
  const enviosQuery = useQuery({ queryKey: ['documentos-envios'], queryFn: documentosService.listEnvios })
  const colaboradorQuery = useQuery({
    queryKey: ['documentos-colaborador', selectedUserId],
    queryFn: () => documentosService.getColaborador(Number(selectedUserId)),
    enabled: Boolean(selectedUserId),
  })
  const envioDetalheQuery = useQuery({
    queryKey: ['documentos-envio', selectedEnvioId],
    queryFn: () => documentosService.getEnvio(Number(selectedEnvioId)),
    enabled: Boolean(selectedEnvioId),
  })

  const userDocsByType = useMemo(() => {
    const map = new Map<number, DocumentoColaborador>()
    for (const doc of colaboradorQuery.data?.documentos ?? []) {
      if (!map.has(doc.tipoDocumentoId)) map.set(doc.tipoDocumentoId, doc)
    }
    return map
  }, [colaboradorQuery.data])

  useEffect(() => {
    if (!envioDetalheQuery.data) return
    setSelectedItemKeys(new Set(envioDetalheQuery.data.itens.map((item) => `${item.usuarioId}:${item.tipoDocumentoId}:${item.documentoUsuarioId || 0}`)))
  }, [envioDetalheQuery.data])

  function clearNotices() {
    setMessage('')
    setError('')
  }

  function showError(err: unknown) {
    setMessage('')
    setError(extractApiErrorMessage(err))
  }

  const cargoMutation = useMutation({
    mutationFn: () => documentosService.createCargo({ nome: cargoNome.trim(), ativo: true }),
    onSuccess: async () => {
      setCargoNome('')
      setMessage('Cargo salvo.')
      await queryClient.invalidateQueries({ queryKey: ['documentos-cargos'] })
    },
    onError: showError,
  })

  const tipoMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        secao: tipoForm.secao.trim() || 'Geral',
        nome: tipoForm.nome.trim(),
        codigo: tipoForm.codigo.trim(),
        obrigatorio: tipoForm.obrigatorio,
        validadePadraoDias: toNumberOrNull(tipoForm.validadePadraoDias),
        ativo: true,
        cargoIds: tipoForm.cargoIds,
      }
      if (!payload.nome) throw new Error('Informe o nome do tipo de documento.')
      if (tipoForm.id) return documentosService.updateTipo(tipoForm.id, payload)
      return documentosService.createTipo(payload)
    },
    onSuccess: async () => {
      setTipoForm(emptyTipo)
      setMessage('Tipo de documento salvo.')
      await queryClient.invalidateQueries({ queryKey: ['documentos-tipos'] })
    },
    onError: showError,
  })

  const importMutation = useMutation({
    mutationFn: (file: File) => documentosService.importarChecklist(file),
    onSuccess: async (result) => {
      setMessage(`Checklist importado: ${result.total} itens, ${result.criados} novos, ${result.atualizados} atualizados.`)
      await queryClient.invalidateQueries({ queryKey: ['documentos-tipos'] })
      await queryClient.invalidateQueries({ queryKey: ['documentos-cargos'] })
    },
    onError: showError,
  })

  const docMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUserId) throw new Error('Selecione um colaborador.')
      const payload = {
        tipoDocumentoId: Number(docForm.tipoDocumentoId),
        url: docForm.url.trim(),
        nomeArquivo: docForm.nomeArquivo.trim(),
        dataEmissao: docForm.dataEmissao,
        vencimento: docForm.vencimento,
        observacao: docForm.observacao.trim(),
        ativo: true,
      }
      if (!payload.tipoDocumentoId || !payload.url) throw new Error('Informe tipo e link do documento.')
      if (docForm.id) return documentosService.updateColaboradorDocumento(Number(selectedUserId), docForm.id, payload)
      return documentosService.createColaboradorDocumento(Number(selectedUserId), payload)
    },
    onSuccess: async () => {
      setDocForm(emptyDoc)
      setMessage('Documento do colaborador salvo.')
      await queryClient.invalidateQueries({ queryKey: ['documentos-colaborador', selectedUserId] })
    },
    onError: showError,
  })

  const envioMutation = useMutation({
    mutationFn: async () => {
      const payload = { obraId: Number(envioForm.obraId), nome: envioForm.nome.trim(), status: envioForm.status }
      if (!payload.obraId || !payload.nome) throw new Error('Informe obra e nome da pasta.')
      if (envioForm.id) return documentosService.updateEnvio(envioForm.id, { nome: payload.nome, status: payload.status })
      return documentosService.createEnvio(payload)
    },
    onSuccess: async (id) => {
      setMessage('Pasta de envio salva.')
      await queryClient.invalidateQueries({ queryKey: ['documentos-envios'] })
      if (typeof id === 'number') setSelectedEnvioId(String(id))
      setEnvioForm(emptyEnvio)
    },
    onError: showError,
  })

  const itemMutation = useMutation({
    mutationFn: async () => {
      if (!selectedEnvioId) throw new Error('Selecione uma pasta de envio.')
      const itens = [...selectedItemKeys].map((key) => {
        const [usuarioId, tipoDocumentoId, documentoUsuarioId] = key.split(':').map(Number)
        return { usuarioId, tipoDocumentoId, documentoUsuarioId: documentoUsuarioId || null }
      })
      await documentosService.replaceEnvioItens(Number(selectedEnvioId), itens)
    },
    onSuccess: async () => {
      setMessage('Selecao de documentos salva na pasta.')
      await queryClient.invalidateQueries({ queryKey: ['documentos-envio', selectedEnvioId] })
      await queryClient.invalidateQueries({ queryKey: ['documentos-envios'] })
    },
    onError: showError,
  })

  const extraMutation = useMutation({
    mutationFn: async () => {
      if (!selectedEnvioId) throw new Error('Selecione uma pasta de envio.')
      if (!extraForm.nome.trim() || !extraForm.url.trim()) throw new Error('Informe nome e link do extra.')
      await documentosService.createEnvioExtra(Number(selectedEnvioId), {
        nome: extraForm.nome.trim(),
        url: extraForm.url.trim(),
        observacao: extraForm.observacao.trim(),
      })
    },
    onSuccess: async () => {
      setExtraForm({ nome: '', url: '', observacao: '' })
      setMessage('Documento extra adicionado.')
      await queryClient.invalidateQueries({ queryKey: ['documentos-envio', selectedEnvioId] })
      await queryClient.invalidateQueries({ queryKey: ['documentos-envios'] })
    },
    onError: showError,
  })

  function editTipo(tipo: DocumentoTipo) {
    setTipoForm({
      id: tipo.id,
      secao: tipo.secao,
      nome: tipo.nome,
      codigo: tipo.codigo,
      obrigatorio: tipo.obrigatorio,
      validadePadraoDias: tipo.validadePadraoDias == null ? '' : String(tipo.validadePadraoDias),
      cargoIds: tipo.cargos.map((cargo) => cargo.id),
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function editDoc(doc: DocumentoColaborador) {
    setDocForm({
      id: doc.id,
      tipoDocumentoId: String(doc.tipoDocumentoId),
      url: doc.url,
      nomeArquivo: doc.nomeArquivo,
      dataEmissao: doc.dataEmissao,
      vencimento: doc.vencimento,
      observacao: doc.observacao,
    })
  }

  function toggleTipoCargo(cargoId: number) {
    setTipoForm((current) => ({
      ...current,
      cargoIds: current.cargoIds.includes(cargoId)
        ? current.cargoIds.filter((id) => id !== cargoId)
        : [...current.cargoIds, cargoId],
    }))
  }

  function addExpectedDocsToSelection() {
    if (!selectedUserId || !colaboradorQuery.data) return
    setSelectedItemKeys((current) => {
      const next = new Set(current)
      for (const tipo of colaboradorQuery.data.esperados) {
        const doc = userDocsByType.get(tipo.id)
        next.add(`${selectedUserId}:${tipo.id}:${doc?.id || 0}`)
      }
      return next
    })
  }

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-heading">Documentos</h1>
          <p className="page-subtitle">Controle de documentos por cargo e montagem de pastas de envio por obra.</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => {
          void queryClient.invalidateQueries({ queryKey: ['documentos-cargos'] })
          void queryClient.invalidateQueries({ queryKey: ['documentos-tipos'] })
          void queryClient.invalidateQueries({ queryKey: ['documentos-envios'] })
        }}>
          <RefreshCw size={15} />
          Atualizar
        </button>
      </div>

      <section className="app-panel toolbar-panel">
        <div className="inline-actions flex-wrap">
          {[
            ['cargos', 'Cargos', Archive],
            ['tipos', 'Tipos e checklist', FileSpreadsheet],
            ['colaboradores', 'Por colaborador', FileText],
            ['envios', 'Envio por obra', Upload],
          ].map(([key, label, Icon]) => (
            <button
              key={String(key)}
              type="button"
              className={cn('btn', activeTab === key ? 'btn-primary' : 'btn-secondary')}
              onClick={() => {
                clearNotices()
                setActiveTab(key as TabKey)
              }}
            >
              <Icon size={15} />
              {String(label)}
            </button>
          ))}
        </div>
      </section>

      {message ? (
        <div className="feedback-card border border-emerald-200 bg-emerald-50 text-emerald-900">
          <div className="feedback-title">Tudo certo</div>
          <p className="feedback-description">{message}</p>
        </div>
      ) : null}
      {error ? <QueryFeedback type="error" title="Nao foi possivel concluir" description={error} /> : null}

      {activeTab === 'cargos' ? (
        <section className="app-panel section-panel">
          <h2 className="section-heading">Cargos fixos</h2>
          <div className="form-grid">
            <div className="span-8">
              <label className="field-label">Novo cargo</label>
              <input className="field-input" value={cargoNome} onChange={(event) => setCargoNome(event.target.value)} placeholder="Ex: Operador" />
            </div>
            <div className="span-4 flex items-end">
              <button type="button" className="btn btn-primary w-full" disabled={cargoMutation.isPending} onClick={() => cargoMutation.mutate()}>
                <Plus size={15} />
                Adicionar
              </button>
            </div>
          </div>

          <div className="mt-4 table-scroll">
            <table className="data-table min-w-[520px]">
              <thead><tr><th>ID</th><th>Cargo</th><th>Status</th></tr></thead>
              <tbody>
                {(cargosQuery.data ?? []).map((cargo) => (
                  <tr key={cargo.id}>
                    <td>#{cargo.id}</td>
                    <td className="font-semibold text-slate-800">{cargo.nome}</td>
                    <td><span className={cn('status-badge', cargo.ativo ? 'status-success' : 'status-neutral')}>{cargo.ativo ? 'Ativo' : 'Inativo'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {activeTab === 'tipos' ? (
        <div className="space-y-4">
          <section className="app-panel section-panel">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="section-heading">Tipos de documento</h2>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) importMutation.mutate(file)
                    event.currentTarget.value = ''
                  }}
                />
                <button type="button" className="btn btn-secondary" onClick={() => fileInputRef.current?.click()} disabled={importMutation.isPending}>
                  <FileSpreadsheet size={15} />
                  Importar checklist
                </button>
              </div>
            </div>

            <div className="form-grid mt-4">
              <div className="span-3"><label className="field-label">Secao</label><input className="field-input" value={tipoForm.secao} onChange={(event) => setTipoForm((f) => ({ ...f, secao: event.target.value }))} /></div>
              <div className="span-4"><label className="field-label">Nome</label><input className="field-input" value={tipoForm.nome} onChange={(event) => setTipoForm((f) => ({ ...f, nome: event.target.value }))} /></div>
              <div className="span-2"><label className="field-label">Codigo</label><input className="field-input" value={tipoForm.codigo} onChange={(event) => setTipoForm((f) => ({ ...f, codigo: event.target.value }))} /></div>
              <div className="span-2"><label className="field-label">Validade padrao</label><input className="field-input" type="number" min="0" value={tipoForm.validadePadraoDias} onChange={(event) => setTipoForm((f) => ({ ...f, validadePadraoDias: event.target.value }))} placeholder="dias" /></div>
              <label className="span-1 flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={tipoForm.obrigatorio} onChange={(event) => setTipoForm((f) => ({ ...f, obrigatorio: event.target.checked }))} /> Obrig.</label>
              <div className="span-12">
                <label className="field-label">Cargos aplicaveis</label>
                <div className="flex flex-wrap gap-2">
                  {(cargosQuery.data ?? []).filter((cargo) => cargo.ativo).map((cargo) => (
                    <button key={cargo.id} type="button" className={cn('mini-button', tipoForm.cargoIds.includes(cargo.id) ? 'red' : 'gray')} onClick={() => toggleTipoCargo(cargo.id)}>
                      {cargo.nome}
                    </button>
                  ))}
                </div>
              </div>
              <div className="span-12 inline-actions">
                <button type="button" className="btn btn-primary" disabled={tipoMutation.isPending} onClick={() => tipoMutation.mutate()}><Save size={15} />Salvar tipo</button>
                <button type="button" className="btn btn-secondary" onClick={() => setTipoForm(emptyTipo)}>Limpar</button>
              </div>
            </div>
          </section>

          <section className="app-panel table-shell">
            <div className="table-scroll">
              <table className="data-table min-w-[980px]">
                <thead><tr><th>Secao</th><th>Documento</th><th>Cargos</th><th>Validade</th><th>Status</th><th>Acoes</th></tr></thead>
                <tbody>
                  {(tiposQuery.data ?? []).map((tipo) => (
                    <tr key={tipo.id}>
                      <td>{tipo.secao}</td>
                      <td className="font-semibold text-slate-800">{tipo.nome}</td>
                      <td>{tipo.cargos.map((cargo) => cargo.nome).join(', ') || '-'}</td>
                      <td>{tipo.validadePadraoDias ? `${tipo.validadePadraoDias} dias` : '-'}</td>
                      <td><span className={cn('status-badge', tipo.ativo ? 'status-success' : 'status-neutral')}>{tipo.ativo ? 'Ativo' : 'Inativo'}</span></td>
                      <td><button type="button" className="btn btn-secondary btn-icon" onClick={() => editTipo(tipo)}><Search size={14} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}

      {activeTab === 'colaboradores' ? (
        <div className="space-y-4">
          <section className="app-panel toolbar-panel">
            <label className="field-label">Colaborador</label>
            <select className="field-select" value={selectedUserId} onChange={(event) => { setSelectedUserId(event.target.value); setDocForm(emptyDoc) }}>
              <option value="">Selecione</option>
              {(usuariosQuery.data ?? []).map((user) => <option key={user.id} value={user.id}>{user.nome}</option>)}
            </select>
          </section>

          {colaboradorQuery.data ? (
            <>
              <section className="app-panel section-panel">
                <h2 className="section-heading">Documento de {colaboradorQuery.data.colaborador.nome}</h2>
                <div className="form-grid">
                  <div className="span-4"><label className="field-label">Tipo</label><select className="field-select" value={docForm.tipoDocumentoId} onChange={(event) => setDocForm((f) => ({ ...f, tipoDocumentoId: event.target.value }))}><option value="">Selecione</option>{(tiposQuery.data ?? []).filter((tipo) => tipo.ativo).map((tipo) => <option key={tipo.id} value={tipo.id}>{tipo.secao} - {tipo.nome}</option>)}</select></div>
                  <div className="span-4"><label className="field-label">Link baixavel</label><input className="field-input" value={docForm.url} onChange={(event) => setDocForm((f) => ({ ...f, url: event.target.value }))} placeholder="https://..." /></div>
                  <div className="span-4"><label className="field-label">Nome do arquivo</label><input className="field-input" value={docForm.nomeArquivo} onChange={(event) => setDocForm((f) => ({ ...f, nomeArquivo: event.target.value }))} /></div>
                  <div className="span-3"><label className="field-label">Emissao</label><input type="date" className="field-input" value={docForm.dataEmissao} onChange={(event) => setDocForm((f) => ({ ...f, dataEmissao: event.target.value }))} /></div>
                  <div className="span-3"><label className="field-label">Vencimento</label><input type="date" className="field-input" value={docForm.vencimento} onChange={(event) => setDocForm((f) => ({ ...f, vencimento: event.target.value }))} /></div>
                  <div className="span-6"><label className="field-label">Observacao</label><input className="field-input" value={docForm.observacao} onChange={(event) => setDocForm((f) => ({ ...f, observacao: event.target.value }))} /></div>
                  <div className="span-12 inline-actions">
                    <button type="button" className="btn btn-primary" disabled={docMutation.isPending} onClick={() => docMutation.mutate()}><Save size={15} />Salvar documento</button>
                    <button type="button" className="btn btn-secondary" onClick={() => setDocForm(emptyDoc)}>Limpar</button>
                  </div>
                </div>
              </section>

              <section className="app-panel table-shell">
                <div className="table-scroll">
                  <table className="data-table min-w-[960px]">
                    <thead><tr><th>Esperado</th><th>Documento</th><th>Link</th><th>Vencimento</th><th>Status</th><th>Acoes</th></tr></thead>
                    <tbody>
                      {colaboradorQuery.data.esperados.map((tipo) => {
                        const doc = userDocsByType.get(tipo.id)
                        return (
                          <tr key={tipo.id}>
                            <td>{tipo.secao}</td>
                            <td className="font-semibold text-slate-800">{tipo.nome}</td>
                            <td>{doc?.url ? <a className="text-[var(--brand-red)]" href={doc.url} target="_blank" rel="noreferrer">abrir</a> : '-'}</td>
                            <td>{doc?.vencimento ? formatDate(doc.vencimento) : '-'}</td>
                            <td><span className={cn('status-badge', statusClass(doc?.status || 'sem_vencimento'))}>{doc ? statusLabels[doc.status] : 'Pendente'}</span></td>
                            <td>{doc ? <button className="btn btn-secondary btn-icon" type="button" onClick={() => editDoc(doc)}><Search size={14} /></button> : null}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          ) : null}
        </div>
      ) : null}

      {activeTab === 'envios' ? (
        <div className="space-y-4">
          <section className="app-panel section-panel">
            <h2 className="section-heading">Pasta de envio por obra</h2>
            <div className="form-grid">
              <div className="span-4"><label className="field-label">Obra</label><select className="field-select" value={envioForm.obraId} onChange={(event) => setEnvioForm((f) => ({ ...f, obraId: event.target.value }))}><option value="">Selecione</option>{(obrasQuery.data?.items ?? []).map((obra) => <option key={obra.id} value={obra.id}>{obra.numero} - {obra.cliente}</option>)}</select></div>
              <div className="span-5"><label className="field-label">Nome da pasta</label><input className="field-input" value={envioForm.nome} onChange={(event) => setEnvioForm((f) => ({ ...f, nome: event.target.value }))} placeholder="Envio documentos obra 22345" /></div>
              <div className="span-2"><label className="field-label">Status</label><select className="field-select" value={envioForm.status} onChange={(event) => setEnvioForm((f) => ({ ...f, status: event.target.value as DocumentoEnvio['status'] }))}><option value="rascunho">Rascunho</option><option value="pronto">Pronto</option><option value="arquivado">Arquivado</option></select></div>
              <div className="span-1 flex items-end"><button type="button" className="btn btn-primary btn-icon" onClick={() => envioMutation.mutate()}><Save size={15} /></button></div>
            </div>
          </section>

          <section className="app-panel toolbar-panel">
            <label className="field-label">Pasta selecionada</label>
            <select className="field-select" value={selectedEnvioId} onChange={(event) => { setSelectedEnvioId(event.target.value); setSelectedItemKeys(new Set()) }}>
              <option value="">Selecione</option>
              {(enviosQuery.data ?? []).map((envio) => <option key={envio.id} value={envio.id}>{envio.nome} - obra {envio.obraNumero}</option>)}
            </select>
          </section>

          {selectedEnvioId ? (
            <section className="app-panel section-panel">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="section-heading">Selecionar documentos</h2>
                <div className="inline-actions">
                  <button type="button" className="btn btn-secondary" disabled={!colaboradorQuery.data} onClick={addExpectedDocsToSelection}><Plus size={15} />Adicionar esperados do colaborador</button>
                  <button type="button" className="btn btn-primary" disabled={itemMutation.isPending} onClick={() => itemMutation.mutate()}><Save size={15} />Salvar selecao</button>
                  <a className="btn btn-secondary" href={documentosService.buildExportUrl(Number(selectedEnvioId))}><Download size={15} />Baixar ZIP</a>
                </div>
              </div>

              <div className="form-grid mt-4">
                <div className="span-5"><label className="field-label">Colaborador para adicionar</label><select className="field-select" value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)}><option value="">Selecione</option>{(usuariosQuery.data ?? []).map((user) => <option key={user.id} value={user.id}>{user.nome}</option>)}</select></div>
              </div>

              {colaboradorQuery.data ? (
                <div className="mt-4 table-scroll">
                  <table className="data-table min-w-[820px]">
                    <thead><tr><th></th><th>Colaborador</th><th>Documento</th><th>Status</th><th>Link</th></tr></thead>
                    <tbody>
                      {colaboradorQuery.data.esperados.map((tipo) => {
                        const doc = userDocsByType.get(tipo.id)
                        const key = `${selectedUserId}:${tipo.id}:${doc?.id || 0}`
                        return (
                          <tr key={key}>
                            <td><input type="checkbox" checked={selectedItemKeys.has(key)} onChange={(event) => setSelectedItemKeys((current) => { const next = new Set(current); event.target.checked ? next.add(key) : next.delete(key); return next })} /></td>
                            <td>{colaboradorQuery.data.colaborador.nome}</td>
                            <td>{tipo.secao} - {tipo.nome}</td>
                            <td><span className={cn('status-badge', statusClass(doc?.status || 'sem_vencimento'))}>{doc ? statusLabels[doc.status] : 'Pendente'}</span></td>
                            <td>{doc?.url ? 'ok' : 'sem link'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : null}

              <div className="mt-6">
                <h3 className="section-heading">Extras da obra</h3>
                <div className="form-grid">
                  <div className="span-3"><label className="field-label">Nome</label><input className="field-input" value={extraForm.nome} onChange={(event) => setExtraForm((f) => ({ ...f, nome: event.target.value }))} /></div>
                  <div className="span-5"><label className="field-label">Link baixavel</label><input className="field-input" value={extraForm.url} onChange={(event) => setExtraForm((f) => ({ ...f, url: event.target.value }))} /></div>
                  <div className="span-3"><label className="field-label">Observacao</label><input className="field-input" value={extraForm.observacao} onChange={(event) => setExtraForm((f) => ({ ...f, observacao: event.target.value }))} /></div>
                  <div className="span-1 flex items-end"><button type="button" className="btn btn-secondary btn-icon" onClick={() => extraMutation.mutate()}><Plus size={15} /></button></div>
                </div>
              </div>

              {envioDetalheQuery.data ? (
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-slate-800">Itens salvos</h3>
                    <div className="space-y-2">
                      {envioDetalheQuery.data.itens.map((item) => (
                        <div key={item.id} className="rounded-md border border-slate-200 bg-white p-3 text-sm">
                          <strong>{item.usuarioNome}</strong> - {item.tipoDocumento}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-slate-800">Extras</h3>
                    <div className="space-y-2">
                      {envioDetalheQuery.data.extras.map((extra) => (
                        <div key={extra.id} className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white p-3 text-sm">
                          <span><strong>{extra.nome}</strong><br /><a href={extra.url} target="_blank" rel="noreferrer" className="text-[var(--brand-red)]">abrir link</a></span>
                          <button type="button" className="btn btn-secondary btn-icon text-red-600" onClick={async () => { await documentosService.removeEnvioExtra(Number(selectedEnvioId), extra.id); await queryClient.invalidateQueries({ queryKey: ['documentos-envio', selectedEnvioId] }) }}><Trash2 size={14} /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
