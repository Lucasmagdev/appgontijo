import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import QueryFeedback from '@/components/ui/QueryFeedback'
import {
  clienteService,
  equipamentoService,
  extractApiErrorMessage,
  modalidadeService,
  obraService,
  type ObraContato,
  type ObraDetail,
  type ObraProducao,
  type ObraResponsabilidade,
} from '@/lib/gontijo-api'

const emptyProducao = (): ObraProducao => ({
  diametro: '',
  profundidade: null,
  qtdEstacas: null,
  preco: null,
  subtotal: null,
})

const emptyResponsabilidade = (): ObraResponsabilidade => ({
  item: '',
  responsavel: 'gontijo',
  valor: null,
})

const emptyContato = (): ObraContato => ({
  nome: '',
  funcao: '',
  telefone: '',
  email: '',
})

const initialForm: ObraDetail = {
  numero: '',
  clienteId: null,
  status: 'em andamento',
  empresaResponsavel: '',
  tipoObra: '',
  finalidade: '',
  dataPrevistaInicio: '',
  estado: '',
  cidade: '',
  cep: '',
  logradouro: '',
  bairro: '',
  numeroEnd: '',
  complemento: '',
  projetoGontijo: false,
  valorProjeto: null,
  fatMinimoTipo: 'global',
  fatMinimoValor: null,
  fatMinimoDias: null,
  usaBits: false,
  valorBits: null,
  transporteNoturno: false,
  icamento: false,
  seguroPct: null,
  totalProducao: null,
  mobilizacao: null,
  desmobilizacao: null,
  totalGeral: null,
  responsavelComercialGontijo: '',
  telComercialGontijo: '',
  responsavelContratante: '',
  telContratante: '',
  observacoes: '',
  producao: [],
  responsabilidades: [],
  contatos: [],
  modalidades: [],
  equipamentos: [],
}

function parseNumberInput(value: string) {
  if (!value.trim()) return null
  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

export default function ObraFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isEditing = Boolean(id)
  const [form, setForm] = useState<ObraDetail>(initialForm)
  const [submitError, setSubmitError] = useState('')

  const obraQuery = useQuery({
    queryKey: ['obra', id],
    queryFn: () => obraService.getById(Number(id)),
    enabled: isEditing,
  })

  const clientesQuery = useQuery({
    queryKey: ['cliente-options'],
    queryFn: clienteService.listOptions,
  })

  const modalidadesQuery = useQuery({
    queryKey: ['modalidades'],
    queryFn: modalidadeService.list,
  })

  const equipamentosQuery = useQuery({
    queryKey: ['equipamentos'],
    queryFn: equipamentoService.list,
  })

  useEffect(() => {
    if (obraQuery.data) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm(obraQuery.data)
    }
  }, [obraQuery.data])

  const mutation = useMutation({
    mutationFn: async (payload: ObraDetail) => {
      if (isEditing) {
        await obraService.update(Number(id), payload)
        return Number(id)
      }
      return obraService.create(payload)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['obras'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] })
      if (isEditing) await queryClient.invalidateQueries({ queryKey: ['obra', id] })
      navigate('/obras')
    },
    onError: (error) => setSubmitError(extractApiErrorMessage(error)),
  })

  function setField<K extends keyof ObraDetail>(field: K, value: ObraDetail[K]) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function toggleId(field: 'modalidades' | 'equipamentos', value: number) {
    setForm((prev) => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter((current) => current !== value)
        : [...prev[field], value],
    }))
  }

  function updateProducao(index: number, field: keyof ObraProducao, value: string | number | null) {
    setForm((prev) => {
      const next = [...prev.producao]
      next[index] = { ...next[index], [field]: value }
      return { ...prev, producao: next }
    })
  }

  function updateResponsabilidade(index: number, field: keyof ObraResponsabilidade, value: string | number | null) {
    setForm((prev) => {
      const next = [...prev.responsabilidades]
      next[index] = { ...next[index], [field]: value }
      return { ...prev, responsabilidades: next }
    })
  }

  function updateContato(index: number, field: keyof ObraContato, value: string) {
    setForm((prev) => {
      const next = [...prev.contatos]
      next[index] = { ...next[index], [field]: value }
      return { ...prev, contatos: next }
    })
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitError('')
    await mutation.mutateAsync({
      ...form,
      numero: form.numero.trim(),
      empresaResponsavel: form.empresaResponsavel.trim(),
      tipoObra: form.tipoObra.trim(),
      finalidade: form.finalidade.trim(),
      estado: form.estado.trim().toUpperCase(),
      cidade: form.cidade.trim(),
      cep: form.cep.trim(),
      logradouro: form.logradouro.trim(),
      bairro: form.bairro.trim(),
      numeroEnd: form.numeroEnd.trim(),
      complemento: form.complemento.trim(),
      responsavelComercialGontijo: form.responsavelComercialGontijo.trim(),
      telComercialGontijo: form.telComercialGontijo.trim(),
      responsavelContratante: form.responsavelContratante.trim(),
      telContratante: form.telContratante.trim(),
      observacoes: form.observacoes.trim(),
    })
  }

  return (
    <div className="page-shell">
      <div className="flex items-center gap-3">
        <Link to="/obras" className="btn btn-secondary btn-icon">
          <ArrowLeft size={15} />
        </Link>
        <div>
          <h1 className="page-heading">{isEditing ? 'Editar obra' : 'Nova obra'}</h1>
          <p className="page-subtitle">Cadastro operacional completo ligado ao banco real.</p>
        </div>
      </div>

      {obraQuery.isLoading ? <QueryFeedback type="loading" title="Carregando obra" description="Buscando os dados existentes antes de liberar a edicao." /> : null}
      {obraQuery.isError ? <QueryFeedback type="error" title="Nao foi possivel carregar a obra" description={extractApiErrorMessage(obraQuery.error)} /> : null}
      {submitError ? <QueryFeedback type="error" title="Nao foi possivel salvar" description={submitError} /> : null}

      {(!isEditing || obraQuery.data) && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <section className="app-panel section-panel">
            <h2 className="section-heading">Dados principais</h2>
            <div className="form-grid">
              <div className="span-3">
                <label className="field-label">Numero da obra</label>
                <input type="text" value={form.numero} onChange={(event) => setField('numero', event.target.value)} className="field-input" required />
              </div>
              <div className="span-5">
                <label className="field-label">Cliente</label>
                <select value={form.clienteId ?? ''} onChange={(event) => setField('clienteId', event.target.value ? Number(event.target.value) : null)} className="field-select" required>
                  <option value="">Selecione</option>
                  {clientesQuery.data?.map((item) => (
                    <option key={item.id} value={item.id}>{item.nome}</option>
                  ))}
                </select>
              </div>
              <div className="span-2">
                <label className="field-label">Status</label>
                <select value={form.status} onChange={(event) => setField('status', event.target.value as ObraDetail['status'])} className="field-select">
                  <option value="em andamento">Em andamento</option>
                  <option value="finalizada">Finalizada</option>
                  <option value="pausada">Pausada</option>
                  <option value="cancelada">Cancelada</option>
                </select>
              </div>
              <div className="span-2">
                <label className="field-label">Inicio previsto</label>
                <input type="date" value={form.dataPrevistaInicio} onChange={(event) => setField('dataPrevistaInicio', event.target.value)} className="field-input" />
              </div>
              <div className="span-4">
                <label className="field-label">Empresa responsavel</label>
                <input type="text" value={form.empresaResponsavel} onChange={(event) => setField('empresaResponsavel', event.target.value)} className="field-input" />
              </div>
              <div className="span-4">
                <label className="field-label">Tipo de obra</label>
                <input type="text" value={form.tipoObra} onChange={(event) => setField('tipoObra', event.target.value)} className="field-input" />
              </div>
              <div className="span-4">
                <label className="field-label">Finalidade</label>
                <input type="text" value={form.finalidade} onChange={(event) => setField('finalidade', event.target.value)} className="field-input" />
              </div>
            </div>
          </section>

          <section className="app-panel section-panel">
            <h2 className="section-heading">Endereco</h2>
            <div className="form-grid">
              <div className="span-2">
                <label className="field-label">UF</label>
                <input type="text" value={form.estado} onChange={(event) => setField('estado', event.target.value)} className="field-input" maxLength={2} />
              </div>
              <div className="span-4">
                <label className="field-label">Cidade</label>
                <input type="text" value={form.cidade} onChange={(event) => setField('cidade', event.target.value)} className="field-input" />
              </div>
              <div className="span-2">
                <label className="field-label">CEP</label>
                <input type="text" value={form.cep} onChange={(event) => setField('cep', event.target.value)} className="field-input" />
              </div>
              <div className="span-8">
                <label className="field-label">Logradouro</label>
                <input type="text" value={form.logradouro} onChange={(event) => setField('logradouro', event.target.value)} className="field-input" />
              </div>
              <div className="span-2">
                <label className="field-label">Numero</label>
                <input type="text" value={form.numeroEnd} onChange={(event) => setField('numeroEnd', event.target.value)} className="field-input" />
              </div>
              <div className="span-4">
                <label className="field-label">Bairro</label>
                <input type="text" value={form.bairro} onChange={(event) => setField('bairro', event.target.value)} className="field-input" />
              </div>
              <div className="span-4">
                <label className="field-label">Complemento</label>
                <input type="text" value={form.complemento} onChange={(event) => setField('complemento', event.target.value)} className="field-input" />
              </div>
            </div>
          </section>

          <section className="app-panel section-panel">
            <h2 className="section-heading">Contrato e totais</h2>
            <div className="form-grid">
              <div className="span-3"><label className="field-label">Valor do projeto</label><input type="number" value={form.valorProjeto ?? ''} onChange={(event) => setField('valorProjeto', parseNumberInput(event.target.value))} className="field-input" step="0.01" /></div>
              <div className="span-3"><label className="field-label">Fat. minimo tipo</label><select value={form.fatMinimoTipo} onChange={(event) => setField('fatMinimoTipo', event.target.value as ObraDetail['fatMinimoTipo'])} className="field-select"><option value="global">Global</option><option value="diario">Diario</option></select></div>
              <div className="span-3"><label className="field-label">Fat. minimo valor</label><input type="number" value={form.fatMinimoValor ?? ''} onChange={(event) => setField('fatMinimoValor', parseNumberInput(event.target.value))} className="field-input" step="0.01" /></div>
              <div className="span-3"><label className="field-label">Fat. minimo dias</label><input type="number" value={form.fatMinimoDias ?? ''} onChange={(event) => setField('fatMinimoDias', parseNumberInput(event.target.value))} className="field-input" /></div>
              <div className="span-3"><label className="field-label">Valor bits</label><input type="number" value={form.valorBits ?? ''} onChange={(event) => setField('valorBits', parseNumberInput(event.target.value))} className="field-input" step="0.01" /></div>
              <div className="span-3"><label className="field-label">Seguro %</label><input type="number" value={form.seguroPct ?? ''} onChange={(event) => setField('seguroPct', parseNumberInput(event.target.value))} className="field-input" step="0.01" /></div>
              <div className="span-3"><label className="field-label">Mobilizacao</label><input type="number" value={form.mobilizacao ?? ''} onChange={(event) => setField('mobilizacao', parseNumberInput(event.target.value))} className="field-input" step="0.01" /></div>
              <div className="span-3"><label className="field-label">Desmobilizacao</label><input type="number" value={form.desmobilizacao ?? ''} onChange={(event) => setField('desmobilizacao', parseNumberInput(event.target.value))} className="field-input" step="0.01" /></div>
              <div className="span-3"><label className="field-label">Total producao</label><input type="number" value={form.totalProducao ?? ''} onChange={(event) => setField('totalProducao', parseNumberInput(event.target.value))} className="field-input" step="0.01" /></div>
              <div className="span-3"><label className="field-label">Total geral</label><input type="number" value={form.totalGeral ?? ''} onChange={(event) => setField('totalGeral', parseNumberInput(event.target.value))} className="field-input" step="0.01" /></div>
              <div className="span-6 checkbox-grid">
                <label className="checkbox-card"><input type="checkbox" checked={form.projetoGontijo} onChange={(event) => setField('projetoGontijo', event.target.checked)} />Projeto Gontijo</label>
                <label className="checkbox-card"><input type="checkbox" checked={form.usaBits} onChange={(event) => setField('usaBits', event.target.checked)} />Usa bits</label>
                <label className="checkbox-card"><input type="checkbox" checked={form.transporteNoturno} onChange={(event) => setField('transporteNoturno', event.target.checked)} />Transporte noturno</label>
                <label className="checkbox-card"><input type="checkbox" checked={form.icamento} onChange={(event) => setField('icamento', event.target.checked)} />Icamento</label>
              </div>
              <div className="span-6">
                <label className="field-label">Observacoes</label>
                <textarea value={form.observacoes} onChange={(event) => setField('observacoes', event.target.value)} className="field-textarea" />
              </div>
            </div>
          </section>

          <section className="app-panel section-panel">
            <h2 className="section-heading">Responsaveis comerciais</h2>
            <div className="form-grid">
              <div className="span-4"><label className="field-label">Responsavel comercial Gontijo</label><input type="text" value={form.responsavelComercialGontijo} onChange={(event) => setField('responsavelComercialGontijo', event.target.value)} className="field-input" /></div>
              <div className="span-2"><label className="field-label">Telefone Gontijo</label><input type="text" value={form.telComercialGontijo} onChange={(event) => setField('telComercialGontijo', event.target.value)} className="field-input" /></div>
              <div className="span-4"><label className="field-label">Responsavel contratante</label><input type="text" value={form.responsavelContratante} onChange={(event) => setField('responsavelContratante', event.target.value)} className="field-input" /></div>
              <div className="span-2"><label className="field-label">Telefone contratante</label><input type="text" value={form.telContratante} onChange={(event) => setField('telContratante', event.target.value)} className="field-input" /></div>
            </div>
          </section>

          <section className="app-panel section-panel">
            <h2 className="section-heading">Modalidades</h2>
            <div className="selection-grid">
              {modalidadesQuery.data?.map((item) => (
                <label key={item.id} className="checkbox-card">
                  <input type="checkbox" checked={form.modalidades.includes(item.id)} onChange={() => toggleId('modalidades', item.id)} />
                  {item.nome}
                </label>
              ))}
            </div>
          </section>

          <section className="app-panel section-panel">
            <h2 className="section-heading">Equipamentos da obra</h2>
            <div className="selection-grid">
              {equipamentosQuery.data?.map((item) => (
                <label key={item.id} className="checkbox-card">
                  <input type="checkbox" checked={form.equipamentos.includes(item.id)} onChange={() => toggleId('equipamentos', item.id)} />
                  <span>{item.nome}{item.modalidadeNome ? ` · ${item.modalidadeNome}` : ''}</span>
                </label>
              ))}
            </div>
          </section>

          <section className="app-panel section-panel">
            <div className="section-header-inline">
              <h2 className="section-heading !mb-0">Producao</h2>
              <button type="button" className="btn btn-secondary" onClick={() => setForm((prev) => ({ ...prev, producao: [...prev.producao, emptyProducao()] }))}><Plus size={15} />Adicionar linha</button>
            </div>
            <div className="stack-list">
              {form.producao.length ? form.producao.map((item, index) => (
                <div key={`producao-${index}`} className="nested-card">
                  <div className="form-grid">
                    <div className="span-2"><label className="field-label">Diametro</label><input type="text" value={item.diametro} onChange={(event) => updateProducao(index, 'diametro', event.target.value)} className="field-input" /></div>
                    <div className="span-2"><label className="field-label">Profundidade</label><input type="number" value={item.profundidade ?? ''} onChange={(event) => updateProducao(index, 'profundidade', parseNumberInput(event.target.value))} className="field-input" step="0.01" /></div>
                    <div className="span-2"><label className="field-label">Qtd. estacas</label><input type="number" value={item.qtdEstacas ?? ''} onChange={(event) => updateProducao(index, 'qtdEstacas', parseNumberInput(event.target.value))} className="field-input" /></div>
                    <div className="span-2"><label className="field-label">Preco</label><input type="number" value={item.preco ?? ''} onChange={(event) => updateProducao(index, 'preco', parseNumberInput(event.target.value))} className="field-input" step="0.01" /></div>
                    <div className="span-3"><label className="field-label">Subtotal</label><input type="number" value={item.subtotal ?? ''} onChange={(event) => updateProducao(index, 'subtotal', parseNumberInput(event.target.value))} className="field-input" step="0.01" /></div>
                    <div className="span-1 nested-actions"><button type="button" className="btn btn-secondary btn-icon text-red-600" onClick={() => setForm((prev) => ({ ...prev, producao: prev.producao.filter((_, currentIndex) => currentIndex !== index) }))}><Trash2 size={14} /></button></div>
                  </div>
                </div>
              )) : <QueryFeedback type="empty" title="Nenhuma linha de producao" description="Adicione as faixas de diametro e volume da obra." />}
            </div>
          </section>

          <section className="app-panel section-panel">
            <div className="section-header-inline">
              <h2 className="section-heading !mb-0">Responsabilidades</h2>
              <button type="button" className="btn btn-secondary" onClick={() => setForm((prev) => ({ ...prev, responsabilidades: [...prev.responsabilidades, emptyResponsabilidade()] }))}><Plus size={15} />Adicionar item</button>
            </div>
            <div className="stack-list">
              {form.responsabilidades.length ? form.responsabilidades.map((item, index) => (
                <div key={`responsabilidade-${index}`} className="nested-card">
                  <div className="form-grid">
                    <div className="span-5"><label className="field-label">Item</label><input type="text" value={item.item} onChange={(event) => updateResponsabilidade(index, 'item', event.target.value)} className="field-input" /></div>
                    <div className="span-3"><label className="field-label">Responsavel</label><select value={item.responsavel} onChange={(event) => updateResponsabilidade(index, 'responsavel', event.target.value as ObraResponsabilidade['responsavel'])} className="field-select"><option value="gontijo">Gontijo</option><option value="cliente">Cliente</option></select></div>
                    <div className="span-3"><label className="field-label">Valor</label><input type="number" value={item.valor ?? ''} onChange={(event) => updateResponsabilidade(index, 'valor', parseNumberInput(event.target.value))} className="field-input" step="0.01" /></div>
                    <div className="span-1 nested-actions"><button type="button" className="btn btn-secondary btn-icon text-red-600" onClick={() => setForm((prev) => ({ ...prev, responsabilidades: prev.responsabilidades.filter((_, currentIndex) => currentIndex !== index) }))}><Trash2 size={14} /></button></div>
                  </div>
                </div>
              )) : <QueryFeedback type="empty" title="Nenhuma responsabilidade cadastrada" description="Adicione os custos e seus respectivos responsaveis." />}
            </div>
          </section>

          <section className="app-panel section-panel">
            <div className="section-header-inline">
              <h2 className="section-heading !mb-0">Contatos</h2>
              <button type="button" className="btn btn-secondary" onClick={() => setForm((prev) => ({ ...prev, contatos: [...prev.contatos, emptyContato()] }))}><Plus size={15} />Adicionar contato</button>
            </div>
            <div className="stack-list">
              {form.contatos.length ? form.contatos.map((item, index) => (
                <div key={`contato-${index}`} className="nested-card">
                  <div className="form-grid">
                    <div className="span-4"><label className="field-label">Nome</label><input type="text" value={item.nome} onChange={(event) => updateContato(index, 'nome', event.target.value)} className="field-input" /></div>
                    <div className="span-3"><label className="field-label">Funcao</label><input type="text" value={item.funcao} onChange={(event) => updateContato(index, 'funcao', event.target.value)} className="field-input" /></div>
                    <div className="span-2"><label className="field-label">Telefone</label><input type="text" value={item.telefone} onChange={(event) => updateContato(index, 'telefone', event.target.value)} className="field-input" /></div>
                    <div className="span-2"><label className="field-label">Email</label><input type="email" value={item.email} onChange={(event) => updateContato(index, 'email', event.target.value)} className="field-input" /></div>
                    <div className="span-1 nested-actions"><button type="button" className="btn btn-secondary btn-icon text-red-600" onClick={() => setForm((prev) => ({ ...prev, contatos: prev.contatos.filter((_, currentIndex) => currentIndex !== index) }))}><Trash2 size={14} /></button></div>
                  </div>
                </div>
              )) : <QueryFeedback type="empty" title="Nenhum contato cadastrado" description="Adicione os contatos operacionais e comerciais da obra." />}
            </div>
          </section>

          <div className="inline-actions justify-end">
            <Link to="/obras" className="btn btn-secondary">Cancelar</Link>
            <button type="submit" className="btn btn-primary" disabled={mutation.isPending}><Save size={15} />{mutation.isPending ? 'Salvando...' : 'Salvar obra'}</button>
          </div>
        </form>
      )}
    </div>
  )
}
