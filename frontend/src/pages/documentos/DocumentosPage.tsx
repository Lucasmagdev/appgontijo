import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Archive, ChevronDown, Download, FileSpreadsheet, FileText, Plus, RefreshCw, Save, Search, Trash2, Upload } from 'lucide-react'
import QueryFeedback from '@/components/ui/QueryFeedback'
import {
  documentosService,
  extractApiErrorMessage,
  obraService,
  usuarioService,
  type DocumentoAlerta,
  type DocumentoColaborador,
  type DocumentoEnvio,
  type DocumentoTipo,
} from '@/lib/gontijo-api'
import { cn, formatDate } from '@/lib/utils'

type TabKey = 'alertas' | 'cargos' | 'tipos' | 'colaboradores' | 'envios'

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
  secao: 'DP',
  nome: '',
  codigo: '',
  obrigatorio: true,
  validadePadraoDias: '',
  cargoIds: [],
}

const secoesDocumento = ['DP', 'Seguranca', 'Geral', 'Documentos Pessoais', 'Documentos de Seguranca']

const emptyDoc: DocForm = {
  id: null,
  tipoDocumentoId: '',
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

const statusLabels: Record<DocumentoColaborador['status'] | DocumentoAlerta['status'], string> = {
  pendente: 'Pendente',
  vigente: 'Vigente',
  vence_em_breve: 'Vence em breve',
  vencido: 'Vencido',
  sem_vencimento: 'Sem vencimento',
}

function statusClass(status: DocumentoColaborador['status'] | DocumentoAlerta['status']) {
  if (status === 'vigente') return 'status-success'
  if (status === 'vence_em_breve') return 'status-warning'
  if (status === 'vencido' || status === 'pendente') return 'status-danger'
  return 'status-neutral'
}

function toNumberOrNull(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && value.trim() ? parsed : null
}

export default function DocumentosPage() {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('alertas')
  const [cargoNome, setCargoNome] = useState('')
  const [tipoForm, setTipoForm] = useState<TipoForm>(emptyTipo)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [docForm, setDocForm] = useState<DocForm>(emptyDoc)
  const [docFile, setDocFile] = useState<File | null>(null)
  const [envioForm, setEnvioForm] = useState<EnvioForm>(emptyEnvio)
  const [selectedEnvioId, setSelectedEnvioId] = useState('')
  const [selectedItemKeys, setSelectedItemKeys] = useState<Set<string>>(new Set())
  const [extraForm, setExtraForm] = useState({ nome: '', url: '', observacao: '' })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [alertasExpandidos, setAlertasExpandidos] = useState<Set<number>>(new Set())
  const [alertaBusca, setAlertaBusca] = useState('')

  const cargosQuery = useQuery({ queryKey: ['documentos-cargos'], queryFn: documentosService.listCargos })
  const tiposQuery = useQuery({ queryKey: ['documentos-tipos'], queryFn: documentosService.listTipos })
  const alertasQuery = useQuery({ queryKey: ['documentos-alertas'], queryFn: documentosService.listAlertas })
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

  const colaboradorResumo = useMemo(() => {
    const esperados = colaboradorQuery.data?.esperados ?? []
    let pendente = 0
    let vencido = 0
    let venceEmBreve = 0
    let vigente = 0
    for (const tipo of esperados) {
      const doc = userDocsByType.get(tipo.id)
      if (!doc) {
        pendente += 1
      } else if (doc.status === 'vencido') {
        vencido += 1
      } else if (doc.status === 'vence_em_breve') {
        venceEmBreve += 1
      } else if (doc.status === 'vigente' || doc.status === 'sem_vencimento') {
        vigente += 1
      }
    }
    return { total: esperados.length, pendente, vencido, venceEmBreve, vigente }
  }, [colaboradorQuery.data, userDocsByType])

  useEffect(() => {
    if (!envioDetalheQuery.data) return
    setSelectedItemKeys(new Set(envioDetalheQuery.data.itens.map((item) => `${item.usuarioId}:${item.tipoDocumentoId}:${item.documentoUsuarioId || 0}`)))
  }, [envioDetalheQuery.data])

  // agrupa os alertas por colaborador (evita listona) + contadores por status
  const alertasPorPessoa = useMemo(() => {
    type Grupo = {
      usuarioId: number
      nome: string
      cargo: string
      itens: DocumentoAlerta[]
      pendente: number
      vencido: number
      venceEmBreve: number
    }
    const map = new Map<number, Grupo>()
    for (const a of alertasQuery.data?.alertas ?? []) {
      let g = map.get(a.usuarioId)
      if (!g) {
        g = { usuarioId: a.usuarioId, nome: a.usuarioNome, cargo: a.cargo || '', itens: [], pendente: 0, vencido: 0, venceEmBreve: 0 }
        map.set(a.usuarioId, g)
      }
      g.itens.push(a)
      if (a.status === 'pendente') g.pendente += 1
      else if (a.status === 'vencido') g.vencido += 1
      else if (a.status === 'vence_em_breve') g.venceEmBreve += 1
    }
    const lista = Array.from(map.values()).sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR'))
    const termo = alertaBusca.trim().toLowerCase()
    return termo ? lista.filter((g) => g.nome.toLowerCase().includes(termo) || g.cargo.toLowerCase().includes(termo)) : lista
  }, [alertasQuery.data, alertaBusca])

  const toggleAlertaPessoa = (usuarioId: number) => {
    setAlertasExpandidos((prev) => {
      const next = new Set(prev)
      if (next.has(usuarioId)) next.delete(usuarioId)
      else next.add(usuarioId)
      return next
    })
  }

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
      await queryClient.invalidateQueries({ queryKey: ['documentos-alertas'] })
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
      await queryClient.invalidateQueries({ queryKey: ['documentos-alertas'] })
    },
    onError: showError,
  })

  const importMutation = useMutation({
    mutationFn: (file: File) => documentosService.importarChecklist(file),
    onSuccess: async (result) => {
      setMessage(`Checklist importado: ${result.total} itens, ${result.criados} novos, ${result.atualizados} atualizados.`)
      await queryClient.invalidateQueries({ queryKey: ['documentos-tipos'] })
      await queryClient.invalidateQueries({ queryKey: ['documentos-cargos'] })
      await queryClient.invalidateQueries({ queryKey: ['documentos-alertas'] })
    },
    onError: showError,
  })

  const docMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUserId) throw new Error('Selecione um colaborador.')
      const payload = {
        tipoDocumentoId: Number(docForm.tipoDocumentoId),
        arquivo: docFile,
        dataEmissao: docForm.dataEmissao,
        vencimento: docForm.vencimento,
        observacao: docForm.observacao.trim(),
        ativo: true,
      }
      if (!payload.tipoDocumentoId) throw new Error('Informe o tipo do documento.')
      if (!docForm.id && !payload.arquivo) throw new Error('Anexe o arquivo do documento.')
      if (docForm.id) return documentosService.updateColaboradorDocumento(Number(selectedUserId), docForm.id, payload)
      return documentosService.createColaboradorDocumento(Number(selectedUserId), payload)
    },
    onSuccess: async () => {
      setDocForm(emptyDoc)
      setDocFile(null)
      setMessage('Documento do colaborador salvo.')
      await queryClient.invalidateQueries({ queryKey: ['documentos-colaborador', selectedUserId] })
      await queryClient.invalidateQueries({ queryKey: ['documentos-alertas'] })
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
      dataEmissao: doc.dataEmissao,
      vencimento: doc.vencimento,
      observacao: doc.observacao,
    })
    setDocFile(null)
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
          void queryClient.invalidateQueries({ queryKey: ['documentos-alertas'] })
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
            ['alertas', 'Alertas', AlertTriangle],
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

      {activeTab === 'alertas' ? (
        <div className="space-y-4">
          {alertasQuery.isLoading ? (
            <QueryFeedback type="loading" title="Carregando alertas" description="Conferindo documentos pendentes, vencidos e proximos do vencimento." />
          ) : null}

          {alertasQuery.isError ? (
            <QueryFeedback type="error" title="Nao foi possivel carregar alertas" description={extractApiErrorMessage(alertasQuery.error)} />
          ) : null}

          {alertasQuery.data ? (
            <>
              <section className="grid gap-3 md:grid-cols-4">
                <div className="app-panel section-panel">
                  <p className="text-xs font-semibold uppercase text-slate-500">Pendentes</p>
                  <strong className="mt-1 block text-2xl text-red-700">{alertasQuery.data.resumo.pendente}</strong>
                </div>
                <div className="app-panel section-panel">
                  <p className="text-xs font-semibold uppercase text-slate-500">Vencidos</p>
                  <strong className="mt-1 block text-2xl text-red-700">{alertasQuery.data.resumo.vencido}</strong>
                </div>
                <div className="app-panel section-panel">
                  <p className="text-xs font-semibold uppercase text-slate-500">Vencem em 30 dias</p>
                  <strong className="mt-1 block text-2xl text-amber-700">{alertasQuery.data.resumo.vence_em_breve}</strong>
                </div>
                <div className="app-panel section-panel">
                  <p className="text-xs font-semibold uppercase text-slate-500">Ok / sem vencimento</p>
                  <strong className="mt-1 block text-2xl text-emerald-700">{alertasQuery.data.resumo.vigente + alertasQuery.data.resumo.sem_vencimento}</strong>
                </div>
              </section>

              <section className="app-panel section-panel">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="section-heading">Alertas por colaborador</h2>
                    <p className="text-sm text-slate-500">Clique no colaborador para ver os documentos pendentes/vencidos dele.</p>
                  </div>
                  <div className="relative w-full sm:w-72">
                    <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      className="field-input field-input-with-icon"
                      value={alertaBusca}
                      onChange={(event) => setAlertaBusca(event.target.value)}
                      placeholder="Buscar colaborador ou cargo"
                    />
                  </div>
                </div>

                {!alertasPorPessoa.length ? (
                  <p className="mt-4 text-center text-sm text-slate-500">
                    {alertaBusca ? 'Nenhum colaborador encontrado.' : 'Nenhum documento pendente, vencido ou perto do vencimento.'}
                  </p>
                ) : (
                  <div className="mt-4 space-y-2">
                    <p className="text-xs text-slate-400">{alertasPorPessoa.length} colaborador(es) com pendências</p>
                    {alertasPorPessoa.map((grupo) => {
                      const aberto = alertasExpandidos.has(grupo.usuarioId)
                      return (
                        <div key={grupo.usuarioId} className="overflow-hidden rounded-lg border border-slate-200">
                          <button
                            type="button"
                            className="flex w-full items-center justify-between gap-3 bg-white px-4 py-3 text-left hover:bg-slate-50"
                            onClick={() => toggleAlertaPessoa(grupo.usuarioId)}
                          >
                            <div className="min-w-0">
                              <div className="truncate font-semibold text-slate-800">{grupo.nome}</div>
                              <div className="truncate text-xs text-slate-500">{grupo.cargo || 'Sem cargo'} · {grupo.itens.length} documento(s)</div>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              {grupo.vencido ? <span className="status-badge status-danger">{grupo.vencido} vencido(s)</span> : null}
                              {grupo.pendente ? <span className="status-badge status-danger">{grupo.pendente} pendente(s)</span> : null}
                              {grupo.venceEmBreve ? <span className="status-badge status-warning">{grupo.venceEmBreve} vence(m)</span> : null}
                              <ChevronDown size={18} className={cn('text-slate-400 transition-transform', aberto && 'rotate-180')} />
                            </div>
                          </button>

                          {aberto ? (
                            <div className="border-t border-slate-100 table-scroll">
                              <table className="data-table min-w-[760px]">
                                <thead><tr><th>Area</th><th>Documento</th><th>Vencimento</th><th>Status</th><th>Acoes</th></tr></thead>
                                <tbody>
                                  {grupo.itens.map((alerta) => (
                                    <tr key={`${alerta.usuarioId}:${alerta.tipoDocumentoId}`}>
                                      <td>{alerta.secao}</td>
                                      <td className="font-semibold text-slate-800">{alerta.tipoDocumento}</td>
                                      <td>{alerta.vencimento ? formatDate(alerta.vencimento) : '-'}</td>
                                      <td><span className={cn('status-badge', statusClass(alerta.status))}>{statusLabels[alerta.status]}</span></td>
                                      <td>
                                        <div className="inline-actions">
                                          {alerta.downloadUrl ? <a className="btn btn-secondary btn-icon" href={alerta.downloadUrl} target="_blank" rel="noreferrer"><Download size={14} /></a> : null}
                                          <button
                                            className="btn btn-secondary"
                                            type="button"
                                            onClick={() => {
                                              setSelectedUserId(String(alerta.usuarioId))
                                              setDocForm({ ...emptyDoc, tipoDocumentoId: String(alerta.tipoDocumentoId) })
                                              setDocFile(null)
                                              setActiveTab('colaboradores')
                                            }}
                                          >
                                            Regularizar
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>
            </>
          ) : null}
        </div>
      ) : null}

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
              <div className="span-3">
                <label className="field-label">Area</label>
                <select className="field-select" value={tipoForm.secao} onChange={(event) => setTipoForm((f) => ({ ...f, secao: event.target.value }))}>
                  {tipoForm.secao && !secoesDocumento.includes(tipoForm.secao) ? <option value={tipoForm.secao}>{tipoForm.secao}</option> : null}
                  {secoesDocumento.map((secao) => <option key={secao} value={secao}>{secao}</option>)}
                </select>
              </div>
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
            <select className="field-select" value={selectedUserId} onChange={(event) => { setSelectedUserId(event.target.value); setDocForm(emptyDoc); setDocFile(null) }}>
              <option value="">Selecione</option>
              {(usuariosQuery.data ?? []).map((user) => <option key={user.id} value={user.id}>{user.nome}</option>)}
            </select>
          </section>

          {colaboradorQuery.data ? (
            <>
              <section className="grid gap-3 md:grid-cols-5">
                <div className="app-panel section-panel">
                  <p className="text-xs font-semibold uppercase text-slate-500">Cargo</p>
                  <strong className="mt-1 block text-base text-slate-800">{colaboradorQuery.data.colaborador.cargo || '-'}</strong>
                </div>
                <div className="app-panel section-panel">
                  <p className="text-xs font-semibold uppercase text-slate-500">Esperados</p>
                  <strong className="mt-1 block text-2xl text-slate-800">{colaboradorResumo.total}</strong>
                </div>
                <div className="app-panel section-panel">
                  <p className="text-xs font-semibold uppercase text-slate-500">Pendentes</p>
                  <strong className="mt-1 block text-2xl text-red-700">{colaboradorResumo.pendente}</strong>
                </div>
                <div className="app-panel section-panel">
                  <p className="text-xs font-semibold uppercase text-slate-500">Vencidos</p>
                  <strong className="mt-1 block text-2xl text-red-700">{colaboradorResumo.vencido}</strong>
                </div>
                <div className="app-panel section-panel">
                  <p className="text-xs font-semibold uppercase text-slate-500">Vencem / ok</p>
                  <strong className="mt-1 block text-2xl text-amber-700">{colaboradorResumo.venceEmBreve}<span className="text-slate-300"> / </span><span className="text-emerald-700">{colaboradorResumo.vigente}</span></strong>
                </div>
              </section>

              <section className="app-panel section-panel">
                <h2 className="section-heading">Documento de {colaboradorQuery.data.colaborador.nome}</h2>
                <div className="form-grid">
                  <div className="span-4"><label className="field-label">Tipo</label><select className="field-select" value={docForm.tipoDocumentoId} onChange={(event) => setDocForm((f) => ({ ...f, tipoDocumentoId: event.target.value }))}><option value="">Selecione</option>{(tiposQuery.data ?? []).filter((tipo) => tipo.ativo).map((tipo) => <option key={tipo.id} value={tipo.id}>{tipo.secao} - {tipo.nome}</option>)}</select></div>
                  <div className="span-8">
                    <label className="field-label">{docForm.id ? 'Substituir arquivo (opcional)' : 'Arquivo'}</label>
                    <input className="field-input" type="file" onChange={(event) => setDocFile(event.target.files?.[0] ?? null)} />
                    {docFile ? <p className="mt-1 text-xs text-slate-500">{docFile.name}</p> : null}
                  </div>
                  <div className="span-3"><label className="field-label">Emissao</label><input type="date" className="field-input" value={docForm.dataEmissao} onChange={(event) => setDocForm((f) => ({ ...f, dataEmissao: event.target.value }))} /></div>
                  <div className="span-3"><label className="field-label">Vencimento</label><input type="date" className="field-input" value={docForm.vencimento} onChange={(event) => setDocForm((f) => ({ ...f, vencimento: event.target.value }))} /></div>
                  <div className="span-6"><label className="field-label">Observacao</label><input className="field-input" value={docForm.observacao} onChange={(event) => setDocForm((f) => ({ ...f, observacao: event.target.value }))} /></div>
                  <div className="span-12 inline-actions">
                    <button type="button" className="btn btn-primary" disabled={docMutation.isPending} onClick={() => docMutation.mutate()}><Save size={15} />Salvar documento</button>
                    <button type="button" className="btn btn-secondary" onClick={() => { setDocForm(emptyDoc); setDocFile(null) }}>Limpar</button>
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
                            <td>{doc?.downloadUrl ? <a className="text-[var(--brand-red)]" href={doc.downloadUrl} target="_blank" rel="noreferrer">abrir arquivo</a> : doc?.url ? <a className="text-[var(--brand-red)]" href={doc.url} target="_blank" rel="noreferrer">abrir link</a> : '-'}</td>
                            <td>{doc?.vencimento ? formatDate(doc.vencimento) : '-'}</td>
                            <td><span className={cn('status-badge', statusClass(doc?.status || 'pendente'))}>{doc ? statusLabels[doc.status] : 'Pendente'}</span></td>
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
                            <td><span className={cn('status-badge', statusClass(doc?.status || 'pendente'))}>{doc ? statusLabels[doc.status] : 'Pendente'}</span></td>
                            <td>{doc?.downloadUrl || doc?.url ? 'ok' : 'sem arquivo'}</td>
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
