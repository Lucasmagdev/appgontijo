import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Camera, ChevronDown, ChevronUp, Plus, Save, Trash2, Upload } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import QueryFeedback from '@/components/ui/QueryFeedback'
import {
  clienteService,
  equipamentoService,
  extractApiErrorMessage,
  modalidadeService,
  obraService,
  usuarioService,
  type ObraArquivo,
  type ObraContato,
  type ObraDetail,
  type ObraFoto,
  type ObraProducao,
} from '@/lib/gontijo-api'

type SectionKey = 'basicos' | 'arquivos' | 'contrato' | 'responsabilidades' | 'faturamento' | 'contatos'

const UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO']
const STATUS_OPTIONS = [{ value: 'em andamento', label: 'Em execução' },{ value: 'pausada', label: 'Pausada' },{ value: 'finalizada', label: 'Finalizada' },{ value: 'cancelada', label: 'Cancelada' }] as const
const EMPRESA_OPTIONS = [{ value: 'gontijo', label: 'Gontijo' },{ value: 'fundacoes', label: 'Gontijo Fundações' }] as const
const CONTRACT_OPTIONS = [{ value: 'FM', label: 'Faturamento mínimo' },{ value: 'GL', label: 'Global' },{ value: 'DI', label: 'Diário' },{ value: 'AP', label: 'Apropriação' },{ value: 'OU', label: 'Outro' }] as const
const FAT_MIN_DAY_OPTIONS = [{ value: 'SA', label: 'Segunda a sábado' },{ value: 'SO', label: 'Segunda a sexta' },{ value: 'TD', label: 'Todos os dias' },{ value: 'NA', label: 'Não se aplica' }] as const
const FAT_MIN_MODAL_OPTIONS = [{ value: 'D', label: 'Diário' },{ value: 'S', label: 'Semanal' },{ value: 'Q', label: 'Quinzenal' },{ value: 'M', label: 'Mensal' },{ value: 'O', label: 'Outro' }]
const YES_NO_OPTIONS = [{ value: 'Y', label: 'Sim' },{ value: 'N', label: 'Não' }] as const
const YES_NO_THIRD_OPTIONS = [{ value: 'Y', label: 'Sim' },{ value: 'N', label: 'Não' },{ value: 'T', label: 'Terceiro' }] as const
const RESPONSAVEL_OPTIONS = [{ value: 'cliente', label: 'Cliente' },{ value: 'gontijo', label: 'Gontijo' }] as const
const MOD_FAT_OPTIONS = [{ value: 'FL', label: 'Fatura de locação' },{ value: 'NF', label: 'Nota fiscal' },{ value: 'OU', label: 'Outro' }] as const

const emptyArquivo = (file: File): ObraArquivo => ({ nome: file.name, tipo: file.type || '', tamanho: Number.isFinite(file.size) ? file.size : null })
const emptyProducao = (): ObraProducao => ({ diametro: '', profundidade: null, qtdEstacas: null, preco: null, subtotal: null })
const emptyContato = (): ObraContato => ({ nome: '', funcao: '', telefone: '', email: '' })

const initialForm: ObraDetail = {
  numero: '', clienteId: null, responsibleOperatorUserId: null, status: 'em andamento', empresaResponsavel: 'gontijo', tipoObra: 'Fundação', finalidade: '', dataPrevistaInicio: '', estado: '', cidade: '', cep: '', logradouro: '', bairro: '', numeroEnd: '', complemento: '',
  projetoGontijo: true, valorProjeto: null, fatMinimoTipo: 'global', fatMinimoValor: null, fatMinimoDias: null, usaBits: false, valorBits: null, transporteNoturno: false, icamento: false, seguroPct: null, totalProducao: null, mobilizacao: null, desmobilizacao: null, totalGeral: null,
  responsavelComercialGontijo: '', telComercialGontijo: '', responsavelContratante: '', telContratante: '', observacoes: '',
  modalidadeContratual: 'FM', faturamentoMinimoDiarioGlobal: null, diasIncidenciaFatMinimo: 'SO', modalidadeFatMinimo: 'D', acrescimoTransporteNoturno: null, responsavelIcamento: 'gontijo', valorIcamento: null, incideSeguro: true, valorSeguro: null,
  necessidadeIntegracao: 'N', valorIntegracao: null, documentacaoEspecifica: 'N', valorDocumentacao: null, mobilizacaoInterna: 'N', valorMobilizacaoInterna: null, responsavelLimpezaTrado: 'cliente', valorLimpezaTrado: null, responsavelHospedagem: 'cliente', valorHospedagem: null, responsavelCafeManha: 'cliente', valorCafeManha: null, responsavelAlmoco: 'cliente', valorAlmoco: null, responsavelJantar: 'cliente', valorJantar: null, responsavelFornecimentoDiesel: 'cliente', responsavelCusteioDiesel: 'cliente',
  razaoSocialFaturamento: '', tipoDocumentoFaturamento: 'cnpj', documentoFaturamento: '', inscricaoMunicipal: '', issqnPct: null, issqnRetidoFonte: false, modalidadeFaturamento: 'FL', informarCeiCnoGuia: true, ceiCno: '', cartaoCeiCno: null, enderecoFaturamentoMesmoCliente: false, faturamentoEstado: '', faturamentoCidade: '', faturamentoCep: '', faturamentoLogradouro: '', faturamentoBairro: '', faturamentoNumero: '', faturamentoComplemento: '',
  projetosArquivos: [], sondagensArquivos: [], fotosObra: [], producao: [emptyProducao()], responsabilidades: [], contatos: [emptyContato()], modalidades: [], equipamentos: [],
}

function parseNumberInput(value: string) { if (!value.trim()) return null; const parsed = Number(value.replace(',', '.')); return Number.isFinite(parsed) ? parsed : null }
function formatCurrency(value: number | null | undefined) { if (value == null || !Number.isFinite(value)) return '0,00'; return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function gridSpan(columns: number): React.CSSProperties { return { gridColumn: `span ${columns} / span ${columns}` } }
function toggleArrayId(current: number[], value: number) { return current.includes(value) ? current.filter((item) => item !== value) : [...current, value] }
function calculateProducaoSubtotal(item: ObraProducao) {
  const profundidade = item.profundidade || 0
  const qtdEstacas = item.qtdEstacas || 0
  const preco = item.preco || 0
  const subtotal = profundidade * qtdEstacas * preco
  return subtotal > 0 ? subtotal : null
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error || new Error('Nao foi possivel ler a imagem.'))
    reader.readAsDataURL(file)
  })
}

async function compressPhotoFile(file: File) {
  const source = await readFileAsDataUrl(file)
  const image = new Image()

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('Nao foi possivel carregar a imagem.'))
    image.src = source
  })

  const maxSize = 1400
  const scale = Math.min(1, maxSize / Math.max(image.width, image.height))
  const width = Math.max(1, Math.round(image.width * scale))
  const height = Math.max(1, Math.round(image.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return source
  ctx.drawImage(image, 0, 0, width, height)
  return canvas.toDataURL('image/jpeg', 0.78)
}

async function makeObraFoto(file: File): Promise<ObraFoto> {
  const now = new Date()
  return {
    nome: file.name,
    tipo: file.type || 'image/jpeg',
    tamanho: Number.isFinite(file.size) ? file.size : null,
    titulo: file.name.replace(/\.[^.]+$/, '') || 'Foto da obra',
    url: await compressPhotoFile(file),
    dataFoto: now.toISOString().slice(0, 10),
    criadoEm: now.toISOString(),
  }
}

function ObraSection({ title, sectionKey, activeSection, setActiveSection, children }: { title: string; sectionKey: SectionKey; activeSection: SectionKey; setActiveSection: (section: SectionKey) => void; children: React.ReactNode }) {
  const open = activeSection === sectionKey
  return <section className="app-panel section-panel !p-0 overflow-hidden"><button type="button" onClick={() => setActiveSection(sectionKey)} className="w-full flex items-center justify-between px-5 py-4 text-left" style={{ borderBottom: open ? '1px solid #e5e7eb' : 'none' }}><span style={{ color: 'var(--brand-red)', fontSize: '1.05rem', fontWeight: 800 }}>{title}</span>{open ? <ChevronUp size={18} color="#b91c1c" /> : <ChevronDown size={18} color="#b91c1c" />}</button>{open ? <div className="px-4 py-4">{children}</div> : null}</section>
}

export default function ObraFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isEditing = Boolean(id)
  const [form, setForm] = useState<ObraDetail>(initialForm)
  const [submitError, setSubmitError] = useState('')
  const [activeSection, setActiveSection] = useState<SectionKey>('basicos')
  const projectInputRef = useRef<HTMLInputElement | null>(null)
  const pollInputRef = useRef<HTMLInputElement | null>(null)
  const photoInputRef = useRef<HTMLInputElement | null>(null)
  const ceiCnoInputRef = useRef<HTMLInputElement | null>(null)

  const obraQuery = useQuery({ queryKey: ['obra', id], queryFn: () => obraService.getById(Number(id)), enabled: isEditing })
  const clientesQuery = useQuery({ queryKey: ['cliente-options'], queryFn: clienteService.listOptions })
  const clienteDetailQuery = useQuery({ queryKey: ['cliente-detail-for-obra', form.clienteId], queryFn: () => clienteService.getById(form.clienteId as number), enabled: Boolean(form.clienteId) })
  const modalidadesQuery = useQuery({ queryKey: ['modalidades'], queryFn: modalidadeService.list })
  const equipamentosQuery = useQuery({ queryKey: ['equipamentos'], queryFn: equipamentoService.list })
  const operadoresQuery = useQuery({
    queryKey: ['operadores-obra'],
    queryFn: async () => {
      const data = await usuarioService.list({ page: 1, limit: 500, status: 'ativo' })
      return data.items.filter((item) => item.status === 'ativo' && item.perfil === 'operador')
    },
  })

  useEffect(() => { if (obraQuery.data) setForm({ ...initialForm, ...obraQuery.data, contatos: obraQuery.data.contatos.length ? obraQuery.data.contatos : [emptyContato()] }) }, [obraQuery.data])
  useEffect(() => { if (!form.enderecoFaturamentoMesmoCliente || !clienteDetailQuery.data) return; setForm((prev) => ({ ...prev, faturamentoEstado: clienteDetailQuery.data.estado, faturamentoCidade: clienteDetailQuery.data.cidade, faturamentoCep: clienteDetailQuery.data.cep, faturamentoLogradouro: clienteDetailQuery.data.logradouro, faturamentoBairro: clienteDetailQuery.data.bairro, faturamentoNumero: clienteDetailQuery.data.numero, faturamentoComplemento: clienteDetailQuery.data.complemento, razaoSocialFaturamento: prev.razaoSocialFaturamento || clienteDetailQuery.data.razaoSocial, tipoDocumentoFaturamento: clienteDetailQuery.data.tipoDoc, documentoFaturamento: prev.documentoFaturamento || clienteDetailQuery.data.documento, inscricaoMunicipal: prev.inscricaoMunicipal || clienteDetailQuery.data.inscricaoMunicipal })) }, [form.enderecoFaturamentoMesmoCliente, clienteDetailQuery.data])

  const filteredEquipamentos = useMemo(() => { if (!equipamentosQuery.data) return []; if (!form.modalidades.length) return equipamentosQuery.data; return equipamentosQuery.data.filter((item) => !item.modalidadeId || form.modalidades.includes(item.modalidadeId)) }, [equipamentosQuery.data, form.modalidades])
  const totalProducaoCalculado = useMemo(() => form.producao.reduce((sum, item) => sum + (calculateProducaoSubtotal(item) || 0), 0), [form.producao])
  const totalObraCalculado = useMemo(() => totalProducaoCalculado + (form.mobilizacao || 0) + (form.desmobilizacao || 0), [form.desmobilizacao, form.mobilizacao, totalProducaoCalculado])

  const mutation = useMutation({ mutationFn: async (payload: ObraDetail) => isEditing ? (await obraService.update(Number(id), payload), Number(id)) : obraService.create(payload), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['obras'] }); if (isEditing) await queryClient.invalidateQueries({ queryKey: ['obra', id] }); navigate('/obras') }, onError: (error) => setSubmitError(extractApiErrorMessage(error)) })

  function setField<K extends keyof ObraDetail>(field: K, value: ObraDetail[K]) { setForm((prev) => ({ ...prev, [field]: value })) }
  function updateContato(index: number, field: keyof ObraContato, value: string) { setForm((prev) => { const next = [...prev.contatos]; next[index] = { ...next[index], [field]: value }; return { ...prev, contatos: next } }) }
  function updateProducao(index: number, field: keyof ObraProducao, value: string | number | null) { setForm((prev) => { const next = [...prev.producao]; const updated = { ...next[index], [field]: value }; updated.subtotal = calculateProducaoSubtotal(updated); next[index] = updated; return { ...prev, producao: next } }) }
  function pushArquivos(field: 'projetosArquivos' | 'sondagensArquivos', files: FileList | null) { if (!files?.length) return; setForm((prev) => ({ ...prev, [field]: [...prev[field], ...Array.from(files).map(emptyArquivo)] })) }
  async function pushFotosObra(files: FileList | null) {
    if (!files?.length) return
    setSubmitError('')
    try {
      const images = Array.from(files).filter((file) => file.type.startsWith('image/'))
      if (!images.length) {
        setSubmitError('Selecione apenas arquivos de imagem para as fotos da obra.')
        return
      }
      const fotos = await Promise.all(images.map(makeObraFoto))
      setForm((prev) => ({ ...prev, fotosObra: [...prev.fotosObra, ...fotos] }))
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Nao foi possivel anexar as fotos.')
    } finally {
      if (photoInputRef.current) photoInputRef.current.value = ''
    }
  }
  function addProducaoRow() { setForm((prev) => ({ ...prev, producao: [...prev.producao, emptyProducao()] })) }
  function removeProducaoRow(index: number) {
    setForm((prev) => {
      const nextRows = prev.producao.filter((_, current) => current !== index)
      return { ...prev, producao: nextRows.length ? nextRows : [emptyProducao()] }
    })
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSubmitError('')
    const producao = form.producao
      .map((item) => ({ ...item, subtotal: calculateProducaoSubtotal(item) }))
      .filter((item) => item.diametro || item.profundidade || item.qtdEstacas || item.preco || item.subtotal)
    await mutation.mutateAsync({ ...form, numero: form.numero.trim(), tipoObra: form.tipoObra.trim(), finalidade: form.finalidade.trim(), estado: form.estado.trim().toUpperCase(), cidade: form.cidade.trim(), cep: form.cep.trim(), logradouro: form.logradouro.trim(), bairro: form.bairro.trim(), numeroEnd: form.numeroEnd.trim(), complemento: form.complemento.trim(), totalProducao: totalProducaoCalculado || null, totalGeral: totalObraCalculado || null, contatos: form.contatos.filter((item) => item.nome || item.funcao || item.telefone || item.email), producao, responsabilidades: [] })
  }

  return (
    <div className="page-shell">
      <div className="flex items-center justify-between gap-4"><h1 className="page-heading">Adicionar Obra</h1><Link to="/obras" className="btn btn-primary">Voltar</Link></div>
      {obraQuery.isLoading ? <QueryFeedback type="loading" title="Carregando obra" description="Buscando os dados existentes antes de liberar a edição." /> : null}
      {obraQuery.isError ? <QueryFeedback type="error" title="Não foi possível carregar a obra" description={extractApiErrorMessage(obraQuery.error)} /> : null}
      {submitError ? <QueryFeedback type="error" title="Não foi possível salvar" description={submitError} /> : null}
      {(!isEditing || obraQuery.data) && <form onSubmit={handleSubmit} className="space-y-3">
        <ObraSection title="Dados básicos" sectionKey="basicos" activeSection={activeSection} setActiveSection={setActiveSection}>
          <div className="form-grid">
            <div style={gridSpan(3)}><label className="field-label">Cliente</label><select value={form.clienteId ?? ''} onChange={(event) => setField('clienteId', event.target.value ? Number(event.target.value) : null)} className="field-select"><option value="">- Cliente -</option>{clientesQuery.data?.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></div>
            <div style={gridSpan(3)}><label className="field-label" style={{ color: 'var(--brand-red)' }}>Número da obra</label><input className="field-input" value={form.numero} onChange={(event) => setField('numero', event.target.value)} placeholder="nº da Obra" required /></div>
            <div style={gridSpan(3)}><label className="field-label">Status da obra</label><select className="field-select" value={form.status} onChange={(event) => setField('status', event.target.value as ObraDetail['status'])}>{STATUS_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
            <div style={gridSpan(3)}><label className="field-label">Empresa responsável</label><select className="field-select" value={form.empresaResponsavel} onChange={(event) => setField('empresaResponsavel', event.target.value)}>{EMPRESA_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
            <div style={gridSpan(4)}><label className="field-label">Operador responsável pela obra</label><select className="field-select" value={form.responsibleOperatorUserId ?? ''} onChange={(event) => setField('responsibleOperatorUserId', event.target.value ? Number(event.target.value) : null)}><option value="">- Selecione um operador -</option>{operadoresQuery.data?.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></div>
            <div className="span-12"><label className="field-label">Modalidades</label><div className="selection-grid" style={{ gridTemplateColumns: 'repeat(6, minmax(0, 1fr))' }}>{modalidadesQuery.data?.map((item) => (<label key={item.id} className="checkbox-card"><input type="checkbox" checked={form.modalidades.includes(item.id)} onChange={() => setField('modalidades', toggleArrayId(form.modalidades, item.id))} />{item.nome}</label>))}</div></div>
            <div className="span-12"><label className="field-label">Equipamentos possíveis</label><div className="stack-list" style={{ maxHeight: '11rem', overflowY: 'auto', border: '1px solid #d7dde5', borderRadius: '8px', padding: '0.75rem', background: '#fff' }}><div className="selection-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>{filteredEquipamentos.map((item) => (<label key={item.id} className="checkbox-card"><input type="checkbox" checked={form.equipamentos.includes(item.id)} onChange={() => setField('equipamentos', toggleArrayId(form.equipamentos, item.id))} />{item.nome}</label>))}</div></div></div>
            <div style={gridSpan(4)}><label className="field-label">Tipo de obra</label><input className="field-input" value={form.tipoObra} onChange={(event) => setField('tipoObra', event.target.value)} /></div>
            <div style={gridSpan(4)}><label className="field-label">Finalidade</label><input className="field-input" value={form.finalidade} onChange={(event) => setField('finalidade', event.target.value)} /></div>
            <div style={gridSpan(4)}><label className="field-label">Data prevista de início</label><input type="date" className="field-input" value={form.dataPrevistaInicio} onChange={(event) => setField('dataPrevistaInicio', event.target.value)} /></div>
            <div className="span-12"><h3 className="section-heading !mb-0" style={{ fontSize: '1rem', marginTop: '0.25rem' }}>Endereço da obra</h3></div>
            <div style={gridSpan(4)}><label className="field-label">Estado</label><select className="field-select" value={form.estado} onChange={(event) => setField('estado', event.target.value)}><option value="">- Estado -</option>{UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}</select></div>
            <div style={gridSpan(4)}><label className="field-label">Cidade</label><input className="field-input" value={form.cidade} onChange={(event) => setField('cidade', event.target.value)} placeholder="- Cidade -" /></div>
            <div style={gridSpan(4)}><label className="field-label">CEP</label><input className="field-input" value={form.cep} onChange={(event) => setField('cep', event.target.value)} /></div>
            <div style={gridSpan(4)}><label className="field-label">Logradouro</label><input className="field-input" value={form.logradouro} onChange={(event) => setField('logradouro', event.target.value)} /></div>
            <div style={gridSpan(4)}><label className="field-label">Bairro</label><input className="field-input" value={form.bairro} onChange={(event) => setField('bairro', event.target.value)} /></div>
            <div style={gridSpan(2)}><label className="field-label">Número</label><input className="field-input" value={form.numeroEnd} onChange={(event) => setField('numeroEnd', event.target.value)} /></div>
            <div style={gridSpan(2)}><label className="field-label">Complemento</label><input className="field-input" value={form.complemento} onChange={(event) => setField('complemento', event.target.value)} /></div>
          </div>
        </ObraSection>

        <ObraSection title="Projetos, Sondagens e Fotos" sectionKey="arquivos" activeSection={activeSection} setActiveSection={setActiveSection}>
          <input ref={projectInputRef} type="file" multiple hidden onChange={(event) => pushArquivos('projetosArquivos', event.target.files)} />
          <input ref={pollInputRef} type="file" multiple hidden onChange={(event) => pushArquivos('sondagensArquivos', event.target.files)} />
          <input ref={photoInputRef} type="file" accept="image/*" multiple hidden onChange={(event) => void pushFotosObra(event.target.files)} />
          <div className="form-grid">
            <div style={gridSpan(6)}><button type="button" className="btn btn-secondary" onClick={() => projectInputRef.current?.click()}><Upload size={15} />Inserir projetos</button><div className="stack-list mt-3">{form.projetosArquivos.length ? form.projetosArquivos.map((arquivo, index) => (<div key={`${arquivo.nome}-${index}`} className="nested-card" style={{ padding: '0.7rem 0.9rem' }}><div className="flex items-center justify-between gap-3"><div className="text-sm font-medium">{arquivo.nome}</div><button type="button" className="btn btn-secondary btn-icon text-red-600" onClick={() => setField('projetosArquivos', form.projetosArquivos.filter((_, current) => current !== index))}><Trash2 size={14} /></button></div></div>)) : <QueryFeedback type="empty" title="Nenhum projeto inserido" description="Adicione os arquivos de projeto vinculados à obra." />}</div></div>
            <div style={gridSpan(6)}><button type="button" className="btn btn-secondary" onClick={() => pollInputRef.current?.click()}><Upload size={15} />Inserir sondagens</button><div className="stack-list mt-3">{form.sondagensArquivos.length ? form.sondagensArquivos.map((arquivo, index) => (<div key={`${arquivo.nome}-${index}`} className="nested-card" style={{ padding: '0.7rem 0.9rem' }}><div className="flex items-center justify-between gap-3"><div className="text-sm font-medium">{arquivo.nome}</div><button type="button" className="btn btn-secondary btn-icon text-red-600" onClick={() => setField('sondagensArquivos', form.sondagensArquivos.filter((_, current) => current !== index))}><Trash2 size={14} /></button></div></div>)) : <QueryFeedback type="empty" title="Nenhuma sondagem inserida" description="Adicione os arquivos de sondagem vinculados à obra." />}</div></div>
            <div className="span-12 mt-2">
              <div className="rounded-2xl border border-red-100 bg-[linear-gradient(180deg,#fff8f7_0%,#ffffff_100%)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--brand-red)]">Fotos para o portal do cliente</div>
                    <p className="mt-1 text-sm text-slate-500">Essas fotos aparecem na galeria pública do cliente, sem entrar no PDF do diário.</p>
                  </div>
                  <button type="button" className="btn btn-primary" onClick={() => photoInputRef.current?.click()}><Camera size={15} />Anexar fotos</button>
                </div>

                {form.fotosObra.length ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {form.fotosObra.map((foto, index) => (
                      <div key={`${foto.nome}-${index}`} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <div className="aspect-[4/3] bg-slate-100">
                          <img src={foto.url} alt={foto.titulo || foto.nome} className="h-full w-full object-cover" loading="lazy" />
                        </div>
                        <div className="flex items-center justify-between gap-2 p-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-bold text-slate-800">{foto.titulo || foto.nome}</div>
                            <div className="text-xs text-slate-400">{foto.tamanho ? `${Math.round(foto.tamanho / 1024)} KB` : 'Imagem anexada'}</div>
                          </div>
                          <button type="button" className="btn btn-secondary btn-icon text-red-600" onClick={() => setField('fotosObra', form.fotosObra.filter((_, current) => current !== index))} title="Remover foto">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <QueryFeedback type="empty" title="Nenhuma foto anexada" description="Adicione fotos de acompanhamento para enriquecer o portal do cliente." />
                )}
              </div>
            </div>
          </div>
        </ObraSection>

        <ObraSection title="Questões Contratuais" sectionKey="contrato" activeSection={activeSection} setActiveSection={setActiveSection}>
          <div className="form-grid">
            <div style={gridSpan(4)}><label className="field-label">Projeto é da gontijo?</label><select className="field-select" value={form.projetoGontijo ? 'Y' : 'N'} onChange={(event) => setField('projetoGontijo', event.target.value === 'Y')}>{YES_NO_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
            <div style={gridSpan(4)}><label className="field-label">Qual o valor do projeto?</label><input className="field-input" value={form.valorProjeto ?? ''} onChange={(event) => setField('valorProjeto', parseNumberInput(event.target.value))} /></div>
            <div style={gridSpan(4)}><label className="field-label">Selecione a modalidade contratual</label><select className="field-select" value={form.modalidadeContratual} onChange={(event) => setField('modalidadeContratual', event.target.value)}>{CONTRACT_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
            <div style={gridSpan(4)}><label className="field-label">Faturamento mínimo, diário ou global</label><input className="field-input" value={form.faturamentoMinimoDiarioGlobal ?? ''} onChange={(event) => setField('faturamentoMinimoDiarioGlobal', parseNumberInput(event.target.value))} /></div>
            <div style={gridSpan(4)}><label className="field-label">Dias que incidem o Fat. Mínimo ou Diário</label><select className="field-select" value={form.diasIncidenciaFatMinimo} onChange={(event) => setField('diasIncidenciaFatMinimo', event.target.value)}>{FAT_MIN_DAY_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
            <div style={gridSpan(4)}><label className="field-label">Modalidade de Fat. Mínimo</label><select className="field-select" value={form.modalidadeFatMinimo} onChange={(event) => setField('modalidadeFatMinimo', event.target.value)}>{FAT_MIN_MODAL_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
            <div style={gridSpan(4)}><label className="field-label">Previsto uso de BITS?</label><select className="field-select" value={form.usaBits ? 'Y' : 'N'} onChange={(event) => setField('usaBits', event.target.value === 'Y')}>{YES_NO_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
            <div style={gridSpan(4)}><label className="field-label">Valor do BITS</label><input className="field-input" value={form.valorBits ?? ''} onChange={(event) => setField('valorBits', parseNumberInput(event.target.value))} /></div>
            <div style={gridSpan(4)}><label className="field-label">Acréscimo de transporte noturno</label><input className="field-input" value={form.acrescimoTransporteNoturno ?? ''} onChange={(event) => setField('acrescimoTransporteNoturno', parseNumberInput(event.target.value))} /></div>
            <div style={gridSpan(6)}><label className="field-label">Responsável pelo içamento?</label><select className="field-select" value={form.responsavelIcamento} onChange={(event) => setField('responsavelIcamento', event.target.value as ObraDetail['responsavelIcamento'])}>{RESPONSAVEL_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
            <div style={gridSpan(6)}><label className="field-label">Valor do içamento</label><input className="field-input" value={form.valorIcamento ?? ''} onChange={(event) => setField('valorIcamento', parseNumberInput(event.target.value))} /></div>
            <div style={gridSpan(6)}><label className="field-label">Incide seguro?</label><select className="field-select" value={form.incideSeguro ? 'Y' : 'N'} onChange={(event) => setField('incideSeguro', event.target.value === 'Y')}>{YES_NO_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
            <div style={gridSpan(6)}><label className="field-label">Valor do seguro</label><input className="field-input" value={form.valorSeguro ?? ''} onChange={(event) => setField('valorSeguro', parseNumberInput(event.target.value))} /></div>
          </div>
          <div className="mt-4 overflow-hidden rounded-[20px] border border-[rgba(167,39,39,0.16)] bg-white shadow-[0_14px_28px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between gap-3 border-b border-[rgba(167,39,39,0.1)] bg-[linear-gradient(180deg,#fff6f5_0%,#ffffff_100%)] px-4 py-4">
              <div className="grid gap-1">
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--brand-red)]">Composição da produção</div>
                <div className="text-sm font-semibold text-slate-800">Adicione uma linha para cada diâmetro/perfil da obra.</div>
                <div className="text-xs text-slate-500">Exemplo: 40 cm e 30 cm na mesma obra, cada um com sua profundidade, quantidade e preço.</div>
              </div>
              <button type="button" className="btn btn-primary shrink-0" onClick={addProducaoRow}>
                <Plus size={14} />
                Adicionar linha
              </button>
            </div>
            <div className="flex flex-wrap gap-2 border-b border-[rgba(167,39,39,0.08)] bg-white px-4 py-3">
              <span className="inline-flex items-center rounded-full bg-red-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--brand-red)]">
                Multi diâmetro
              </span>
              <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600">
                Sub-total automático
              </span>
              <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600">
                Total consolidado da obra
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead style={{ background: '#fff' }}>
                  <tr>
                    <th className="text-left px-4 py-3 border-b border-[rgba(167,39,39,0.08)] text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">Diâmetro/Perfil</th>
                    <th className="text-left px-4 py-3 border-b border-[rgba(167,39,39,0.08)] text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">Profundidade</th>
                    <th className="text-left px-4 py-3 border-b border-[rgba(167,39,39,0.08)] text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">Qtd Estacas</th>
                    <th className="text-left px-4 py-3 border-b border-[rgba(167,39,39,0.08)] text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">Preço Diâmetro</th>
                    <th className="text-left px-4 py-3 border-b border-[rgba(167,39,39,0.08)] text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">Sub-total</th>
                    <th className="text-center px-4 py-3 border-b border-[rgba(167,39,39,0.08)] text-[11px] font-black uppercase tracking-[0.12em] text-slate-500" style={{ width: '72px' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {form.producao.map((item, index) => (
                    <tr key={`prod-${index}`} className="bg-white">
                      <td className="p-3 border-b border-slate-100">
                        <input className="field-input" value={item.diametro} onChange={(event) => updateProducao(index, 'diametro', event.target.value)} placeholder="Ex.: 40 cm" />
                      </td>
                      <td className="p-3 border-b border-slate-100">
                        <input className="field-input" value={item.profundidade ?? ''} onChange={(event) => updateProducao(index, 'profundidade', parseNumberInput(event.target.value))} placeholder="Ex.: 10" />
                      </td>
                      <td className="p-3 border-b border-slate-100">
                        <input className="field-input" value={item.qtdEstacas ?? ''} onChange={(event) => updateProducao(index, 'qtdEstacas', parseNumberInput(event.target.value))} placeholder="Ex.: 10" />
                      </td>
                      <td className="p-3 border-b border-slate-100">
                        <input className="field-input" value={item.preco ?? ''} onChange={(event) => updateProducao(index, 'preco', parseNumberInput(event.target.value))} placeholder="Ex.: 1500" />
                      </td>
                      <td className="p-3 border-b border-slate-100">
                        <div className="field-input flex items-center font-bold text-slate-700" style={{ background: '#f8fafc' }}>
                          {item.subtotal != null ? formatCurrency(item.subtotal) : '—'}
                        </div>
                      </td>
                      <td className="p-3 border-b border-slate-100 text-center">
                        <button type="button" className="btn btn-secondary btn-icon text-red-600" onClick={() => removeProducaoRow(index)} title="Remover linha">
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-[linear-gradient(180deg,#fff8f7_0%,#ffffff_100%)]"><td colSpan={4} className="px-4 py-3 font-black uppercase tracking-[0.08em] text-[var(--brand-red)] border-b border-[rgba(167,39,39,0.08)]">Total de produção</td><td className="px-4 py-3 border-b border-[rgba(167,39,39,0.08)] font-bold text-slate-800">{formatCurrency(totalProducaoCalculado)}</td><td className="border-b border-[rgba(167,39,39,0.08)]" /></tr>
                  <tr><td colSpan={4} className="px-4 py-3 font-black uppercase tracking-[0.08em] text-slate-600 border-b border-slate-100">Valor da mobilização</td><td className="px-4 py-2 border-b border-slate-100"><input className="field-input" value={form.mobilizacao ?? ''} onChange={(event) => setField('mobilizacao', parseNumberInput(event.target.value))} /></td><td className="border-b border-slate-100" /></tr>
                  <tr><td colSpan={4} className="px-4 py-3 font-black uppercase tracking-[0.08em] text-slate-600 border-b border-slate-100">Valor da desmobilização</td><td className="px-4 py-2 border-b border-slate-100"><input className="field-input" value={form.desmobilizacao ?? ''} onChange={(event) => setField('desmobilizacao', parseNumberInput(event.target.value))} /></td><td className="border-b border-slate-100" /></tr>
                  <tr className="bg-[linear-gradient(180deg,#fff6f5_0%,#ffffff_100%)]"><td colSpan={4} className="px-4 py-3 font-black uppercase tracking-[0.08em] text-[var(--brand-red)]">Total da obra</td><td className="px-4 py-3 font-black text-[var(--brand-red)]">{formatCurrency(totalObraCalculado)}</td><td /></tr>
                </tbody>
              </table>
            </div>
          </div>
        </ObraSection>
        <ObraSection title="Responsabilidades" sectionKey="responsabilidades" activeSection={activeSection} setActiveSection={setActiveSection}>
          <div className="form-grid">
            <div style={gridSpan(6)}><label className="field-label">Necessidade de Integração?</label><select className="field-select" value={form.necessidadeIntegracao} onChange={(event) => setField('necessidadeIntegracao', event.target.value)}>{YES_NO_THIRD_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
            <div style={gridSpan(6)}><label className="field-label">Valor da Integração</label><input className="field-input" value={form.valorIntegracao ?? ''} onChange={(event) => setField('valorIntegracao', parseNumberInput(event.target.value))} /></div>
            <div style={gridSpan(6)}><label className="field-label">Documentação específica?</label><select className="field-select" value={form.documentacaoEspecifica} onChange={(event) => setField('documentacaoEspecifica', event.target.value)}>{YES_NO_THIRD_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
            <div style={gridSpan(6)}><label className="field-label">Valor da Documentação</label><input className="field-input" value={form.valorDocumentacao ?? ''} onChange={(event) => setField('valorDocumentacao', parseNumberInput(event.target.value))} /></div>
            <div style={gridSpan(6)}><label className="field-label">Mobilização interna?</label><select className="field-select" value={form.mobilizacaoInterna} onChange={(event) => setField('mobilizacaoInterna', event.target.value)}>{YES_NO_THIRD_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
            <div style={gridSpan(6)}><label className="field-label">Valor da Mob. Interna</label><input className="field-input" value={form.valorMobilizacaoInterna ?? ''} onChange={(event) => setField('valorMobilizacaoInterna', parseNumberInput(event.target.value))} /></div>
            <div style={gridSpan(6)}><label className="field-label">Responsável pela limpeza de terra do trado</label><select className="field-select" value={form.responsavelLimpezaTrado} onChange={(event) => setField('responsavelLimpezaTrado', event.target.value as ObraDetail['responsavelLimpezaTrado'])}>{RESPONSAVEL_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
            <div style={gridSpan(6)}><label className="field-label">Valor da limpeza do trado</label><input className="field-input" value={form.valorLimpezaTrado ?? ''} onChange={(event) => setField('valorLimpezaTrado', parseNumberInput(event.target.value))} /></div>
            <div style={gridSpan(6)}><label className="field-label">Responsável hospedagem</label><select className="field-select" value={form.responsavelHospedagem} onChange={(event) => setField('responsavelHospedagem', event.target.value as ObraDetail['responsavelHospedagem'])}>{RESPONSAVEL_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
            <div style={gridSpan(6)}><label className="field-label">Valor hospedagem</label><input className="field-input" value={form.valorHospedagem ?? ''} onChange={(event) => setField('valorHospedagem', parseNumberInput(event.target.value))} /></div>
            <div style={gridSpan(6)}><label className="field-label">Responsável café da manhã</label><select className="field-select" value={form.responsavelCafeManha} onChange={(event) => setField('responsavelCafeManha', event.target.value as ObraDetail['responsavelCafeManha'])}>{RESPONSAVEL_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
            <div style={gridSpan(6)}><label className="field-label">Valor café da manhã</label><input className="field-input" value={form.valorCafeManha ?? ''} onChange={(event) => setField('valorCafeManha', parseNumberInput(event.target.value))} /></div>
            <div style={gridSpan(6)}><label className="field-label">Responsável almoço</label><select className="field-select" value={form.responsavelAlmoco} onChange={(event) => setField('responsavelAlmoco', event.target.value as ObraDetail['responsavelAlmoco'])}>{RESPONSAVEL_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
            <div style={gridSpan(6)}><label className="field-label">Valor almoço</label><input className="field-input" value={form.valorAlmoco ?? ''} onChange={(event) => setField('valorAlmoco', parseNumberInput(event.target.value))} /></div>
            <div style={gridSpan(6)}><label className="field-label">Responsável jantar</label><select className="field-select" value={form.responsavelJantar} onChange={(event) => setField('responsavelJantar', event.target.value as ObraDetail['responsavelJantar'])}>{RESPONSAVEL_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
            <div style={gridSpan(6)}><label className="field-label">Valor jantar</label><input className="field-input" value={form.valorJantar ?? ''} onChange={(event) => setField('valorJantar', parseNumberInput(event.target.value))} /></div>
            <div style={gridSpan(6)}><label className="field-label">Responsável fornecimento do Diesel</label><select className="field-select" value={form.responsavelFornecimentoDiesel} onChange={(event) => setField('responsavelFornecimentoDiesel', event.target.value as ObraDetail['responsavelFornecimentoDiesel'])}>{RESPONSAVEL_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
            <div style={gridSpan(6)}><label className="field-label">Responsável custeio do Diesel</label><select className="field-select" value={form.responsavelCusteioDiesel} onChange={(event) => setField('responsavelCusteioDiesel', event.target.value as ObraDetail['responsavelCusteioDiesel'])}>{RESPONSAVEL_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
          </div>
        </ObraSection>

        <ObraSection title="Dados de Faturamento" sectionKey="faturamento" activeSection={activeSection} setActiveSection={setActiveSection}>
          <input ref={ceiCnoInputRef} type="file" hidden onChange={(event) => setField('cartaoCeiCno', event.target.files?.[0] ? emptyArquivo(event.target.files[0]) : null)} />
          <div className="form-grid">
            <div style={gridSpan(4)}><label className="field-label">Razão social</label><input className="field-input" value={form.razaoSocialFaturamento} onChange={(event) => setField('razaoSocialFaturamento', event.target.value)} /></div>
            <div style={gridSpan(4)}><label className="field-label">Clique por usar</label><div className="inline-actions"><button type="button" className={`mini-button ${form.tipoDocumentoFaturamento === 'cnpj' ? 'red' : 'gray'}`} onClick={() => setField('tipoDocumentoFaturamento', 'cnpj')}>CNPJ</button><button type="button" className={`mini-button ${form.tipoDocumentoFaturamento === 'cpf' ? 'red' : 'gray'}`} onClick={() => setField('tipoDocumentoFaturamento', 'cpf')}>CPF</button></div><input className="field-input mt-2" value={form.documentoFaturamento} onChange={(event) => setField('documentoFaturamento', event.target.value)} placeholder={form.tipoDocumentoFaturamento === 'cpf' ? 'CPF' : 'CNPJ'} /></div>
            <div style={gridSpan(4)}><label className="field-label">Inscrição municipal</label><input className="field-input" value={form.inscricaoMunicipal} onChange={(event) => setField('inscricaoMunicipal', event.target.value)} /></div>
            <div style={gridSpan(6)}><label className="field-label">ISSQN (%)</label><input className="field-input" value={form.issqnPct ?? ''} onChange={(event) => setField('issqnPct', parseNumberInput(event.target.value))} /></div>
            <div style={gridSpan(6)}><label className="field-label">ISSQN retido na fonte?</label><select className="field-select" value={form.issqnRetidoFonte ? 'Y' : 'N'} onChange={(event) => setField('issqnRetidoFonte', event.target.value === 'Y')}>{YES_NO_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
            <div style={gridSpan(4)}><label className="field-label">Modalidade de faturamento</label><select className="field-select" value={form.modalidadeFaturamento} onChange={(event) => setField('modalidadeFaturamento', event.target.value)}>{MOD_FAT_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
            <div style={gridSpan(4)}><label className="field-label">Informar CEI/CNO na guia do INSS</label><select className="field-select" value={form.informarCeiCnoGuia ? 'Y' : 'N'} onChange={(event) => setField('informarCeiCnoGuia', event.target.value === 'Y')}>{YES_NO_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
            <div style={gridSpan(4)}><label className="field-label">Cartão CEI/CNO</label><div className="inline-actions"><button type="button" className="btn btn-secondary" onClick={() => ceiCnoInputRef.current?.click()}><Upload size={15} />Selecionar</button><span className="pagination-chip">{form.cartaoCeiCno?.nome || 'Nenhum arquivo'}</span></div></div>
            <div className="span-12"><h3 className="section-heading !mb-0" style={{ fontSize: '1rem', marginTop: '0.25rem' }}>Endereço de faturamento</h3><label className="field-label">O endereço de faturamento é o mesmo do cliente?</label><select className="field-select" value={form.enderecoFaturamentoMesmoCliente ? 'Y' : 'N'} onChange={(event) => setField('enderecoFaturamentoMesmoCliente', event.target.value === 'Y')}>{YES_NO_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
            <div style={gridSpan(4)}><label className="field-label">Estado</label><select className="field-select" value={form.faturamentoEstado} onChange={(event) => setField('faturamentoEstado', event.target.value)}><option value="">- Estado -</option>{UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}</select></div>
            <div style={gridSpan(4)}><label className="field-label">Cidade</label><input className="field-input" value={form.faturamentoCidade} onChange={(event) => setField('faturamentoCidade', event.target.value)} /></div>
            <div style={gridSpan(4)}><label className="field-label">CEP</label><input className="field-input" value={form.faturamentoCep} onChange={(event) => setField('faturamentoCep', event.target.value)} /></div>
            <div style={gridSpan(4)}><label className="field-label">Logradouro</label><input className="field-input" value={form.faturamentoLogradouro} onChange={(event) => setField('faturamentoLogradouro', event.target.value)} /></div>
            <div style={gridSpan(4)}><label className="field-label">Bairro</label><input className="field-input" value={form.faturamentoBairro} onChange={(event) => setField('faturamentoBairro', event.target.value)} /></div>
            <div style={gridSpan(2)}><label className="field-label">Número</label><input className="field-input" value={form.faturamentoNumero} onChange={(event) => setField('faturamentoNumero', event.target.value)} /></div>
            <div style={gridSpan(2)}><label className="field-label">Complemento</label><input className="field-input" value={form.faturamentoComplemento} onChange={(event) => setField('faturamentoComplemento', event.target.value)} /></div>
          </div>
        </ObraSection>
        <ObraSection title="Contatos" sectionKey="contatos" activeSection={activeSection} setActiveSection={setActiveSection}>
          <div className="form-grid">
            <div style={gridSpan(6)}><label className="field-label">Responsável comercial Gontijo</label><input className="field-input" value={form.responsavelComercialGontijo} onChange={(event) => setField('responsavelComercialGontijo', event.target.value)} /></div>
            <div style={gridSpan(6)}><label className="field-label">Telefone</label><input className="field-input" value={form.telComercialGontijo} onChange={(event) => setField('telComercialGontijo', event.target.value)} /></div>
            <div style={gridSpan(6)}><label className="field-label">Responsável da CONTRATANTE no canteiro de obras</label><input className="field-input" value={form.responsavelContratante} onChange={(event) => setField('responsavelContratante', event.target.value)} /></div>
            <div style={gridSpan(6)}><label className="field-label">Telefone</label><input className="field-input" value={form.telContratante} onChange={(event) => setField('telContratante', event.target.value)} /></div>
          </div>
          <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200"><table className="w-full text-sm border-collapse"><thead style={{ background: '#e5e7eb' }}><tr><th className="text-left px-3 py-2 border-b">Nome</th><th className="text-left px-3 py-2 border-b">Função</th><th className="text-left px-3 py-2 border-b">Telefone</th><th className="text-left px-3 py-2 border-b">Email</th><th className="text-center px-3 py-2 border-b" style={{ width: '52px' }}><button type="button" className="mini-button" onClick={() => setForm((prev) => ({ ...prev, contatos: [...prev.contatos, emptyContato()] }))}><Plus size={12} /></button></th></tr></thead><tbody>{form.contatos.map((item, index) => (<tr key={`contact-${index}`}><td className="p-2 border-b"><input className="field-input" value={item.nome} onChange={(event) => updateContato(index, 'nome', event.target.value)} /></td><td className="p-2 border-b"><input className="field-input" value={item.funcao} onChange={(event) => updateContato(index, 'funcao', event.target.value)} /></td><td className="p-2 border-b"><input className="field-input" value={item.telefone} onChange={(event) => updateContato(index, 'telefone', event.target.value)} /></td><td className="p-2 border-b"><input className="field-input" value={item.email} onChange={(event) => updateContato(index, 'email', event.target.value)} /></td><td className="p-2 border-b text-center"><button type="button" className="btn btn-secondary btn-icon text-red-600" onClick={() => setForm((prev) => ({ ...prev, contatos: prev.contatos.length === 1 ? [emptyContato()] : prev.contatos.filter((_, current) => current !== index) }))}><Trash2 size={13} /></button></td></tr>))}</tbody></table></div>
        </ObraSection>

        <div className="inline-actions justify-start"><button type="submit" className="btn btn-primary" disabled={mutation.isPending}><Save size={15} />{mutation.isPending ? 'Enviando...' : 'Enviar'}</button></div>
      </form>}
    </div>
  )
}

