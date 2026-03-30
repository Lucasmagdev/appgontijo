import { AxiosError } from 'axios'
import { api } from '@/lib/api'

type ApiEnvelope<T> = {
  ok: boolean
  data: T
  total?: number
  page?: number
  limit?: number
}

type ApiListResult<T> = {
  items: T[]
  total: number
  page: number
  limit: number
}

export type OptionItem = {
  id: number
  nome: string
}

export type DashboardOverview = {
  stats: {
    obrasAndamento: number
    obrasFinalizadas: number
    maquinasAtivas: number
    diariosPendentes: number
  }
  recentActivities: Array<{
    id: string
    date: string
    type: 'obra' | 'diario'
    title: string
    description: string
  }>
  alerts: Array<{
    id: string
    severity: 'info' | 'warning'
    title: string
    description: string
  }>
}

export type UsuarioRecord = {
  id: number
  nome: string
  apelido: string
  login: string
  telefone: string
  perfil: 'admin' | 'operador'
  status: 'ativo' | 'inativo'
  criadoEm?: string
}

export type UsuarioPayload = {
  nome: string
  apelido: string
  login: string
  telefone: string
  perfil: 'admin' | 'operador'
  status?: 'ativo' | 'inativo'
  senha?: string
}

export type ClienteRecord = {
  id: number
  razaoSocial: string
  tipoDoc: 'cpf' | 'cnpj'
  documento: string
  inscricaoMunicipal: string
  email: string
  telefone: string
  cep: string
  estado: string
  cidade: string
  logradouro: string
  bairro: string
  numero: string
  complemento: string
}

export type ClientePayload = Omit<ClienteRecord, 'id'>

export type ModalidadeRecord = {
  id: number
  nome: string
}

export type EquipamentoRecord = {
  id: number
  nome: string
  computadorGeo: string
  modalidadeId: number | null
  modalidadeNome: string
  status: 'ativo' | 'inativo'
}

export type EquipamentoPayload = {
  nome: string
  computadorGeo: string
  modalidadeId: number | null
  status?: 'ativo' | 'inativo'
}

export type ObraResumo = {
  id: number
  numero: string
  status: 'em andamento' | 'finalizada' | 'pausada' | 'cancelada'
  tipoObra: string
  cidade: string
  estado: string
  dataPrevistaInicio: string
  cliente: string
}

export type ObraProducao = {
  id?: number
  diametro: string
  profundidade: number | null
  qtdEstacas: number | null
  preco: number | null
  subtotal: number | null
}

export type ObraResponsabilidade = {
  id?: number
  item: string
  responsavel: 'cliente' | 'gontijo'
  valor: number | null
}

export type ObraContato = {
  id?: number
  nome: string
  funcao: string
  telefone: string
  email: string
}

export type ObraDetail = {
  id?: number
  numero: string
  clienteId: number | null
  status: 'em andamento' | 'finalizada' | 'pausada' | 'cancelada'
  empresaResponsavel: string
  tipoObra: string
  finalidade: string
  dataPrevistaInicio: string
  estado: string
  cidade: string
  cep: string
  logradouro: string
  bairro: string
  numeroEnd: string
  complemento: string
  projetoGontijo: boolean
  valorProjeto: number | null
  fatMinimoTipo: 'diario' | 'global'
  fatMinimoValor: number | null
  fatMinimoDias: number | null
  usaBits: boolean
  valorBits: number | null
  transporteNoturno: boolean
  icamento: boolean
  seguroPct: number | null
  totalProducao: number | null
  mobilizacao: number | null
  desmobilizacao: number | null
  totalGeral: number | null
  responsavelComercialGontijo: string
  telComercialGontijo: string
  responsavelContratante: string
  telContratante: string
  observacoes: string
  producao: ObraProducao[]
  responsabilidades: ObraResponsabilidade[]
  contatos: ObraContato[]
  modalidades: number[]
  equipamentos: number[]
}

export type DiarioRecord = {
  id: number
  obraId: number
  equipamentoId: number | null
  dataDiario: string
  status: 'rascunho' | 'pendente' | 'assinado'
  assinadoEm: string
  obraNumero: string
  cliente: string
  equipamento: string
}

export type DiarioDetail = DiarioRecord & {
  operadorId: number | null
  operadorNome: string
  clienteNome: string
  dadosJson: Record<string, unknown> | null
}

export type DiarioPayload = {
  dataDiario: string
  status: 'rascunho' | 'pendente' | 'assinado'
  equipamentoId: number | null
  assinadoEm: string
  dadosJson: Record<string, unknown> | null
}

export type DiarioFilters = {
  page?: number
  limit?: number
  dataInicio?: string
  dataFim?: string
  obra?: string
  modalidadeId?: number | null
  equipamentoId?: number | null
  status?: string
}

function listResult<T>(payload: ApiEnvelope<T[]>): ApiListResult<T> {
  return {
    items: payload.data,
    total: payload.total || 0,
    page: payload.page || 1,
    limit: payload.limit || payload.data.length || 20,
  }
}

function toStringValue(value: unknown): string {
  return value == null ? '' : String(value)
}

function toNumberValue(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function toBooleanValue(value: unknown): boolean {
  return value === true || value === 1 || value === '1'
}

function adaptUsuario(row: Record<string, unknown>): UsuarioRecord {
  return {
    id: Number(row.id),
    nome: toStringValue(row.nome),
    apelido: toStringValue(row.apelido),
    login: toStringValue(row.login),
    telefone: toStringValue(row.telefone),
    perfil: row.perfil === 'admin' ? 'admin' : 'operador',
    status: row.status === 'inativo' ? 'inativo' : 'ativo',
    criadoEm: toStringValue(row.criado_em),
  }
}

function adaptCliente(row: Record<string, unknown>): ClienteRecord {
  return {
    id: Number(row.id),
    razaoSocial: toStringValue(row.razao_social),
    tipoDoc: row.tipo_doc === 'cpf' ? 'cpf' : 'cnpj',
    documento: toStringValue(row.documento),
    inscricaoMunicipal: toStringValue(row.inscricao_municipal),
    email: toStringValue(row.email),
    telefone: toStringValue(row.telefone),
    cep: toStringValue(row.cep),
    estado: toStringValue(row.estado),
    cidade: toStringValue(row.cidade),
    logradouro: toStringValue(row.logradouro),
    bairro: toStringValue(row.bairro),
    numero: toStringValue(row.numero),
    complemento: toStringValue(row.complemento),
  }
}

function adaptEquipamento(row: Record<string, unknown>): EquipamentoRecord {
  return {
    id: Number(row.id),
    nome: toStringValue(row.nome),
    computadorGeo: toStringValue(row.computador_geo),
    modalidadeId: toNumberValue(row.modalidade_id),
    modalidadeNome: toStringValue(row.modalidade_nome),
    status: row.status === 'inativo' ? 'inativo' : 'ativo',
  }
}

function adaptObraResumo(row: Record<string, unknown>): ObraResumo {
  return {
    id: Number(row.id),
    numero: toStringValue(row.numero),
    status: (toStringValue(row.status) || 'em andamento') as ObraResumo['status'],
    tipoObra: toStringValue(row.tipo_obra),
    cidade: toStringValue(row.cidade),
    estado: toStringValue(row.estado),
    dataPrevistaInicio: toStringValue(row.data_prevista_inicio),
    cliente: toStringValue(row.cliente),
  }
}

function adaptObraDetail(row: Record<string, unknown>): ObraDetail {
  const producao = Array.isArray(row.producao)
    ? row.producao.map((item) => ({
        id: Number((item as Record<string, unknown>).id),
        diametro: toStringValue((item as Record<string, unknown>).diametro),
        profundidade: toNumberValue((item as Record<string, unknown>).profundidade),
        qtdEstacas: toNumberValue((item as Record<string, unknown>).qtd_estacas),
        preco: toNumberValue((item as Record<string, unknown>).preco),
        subtotal: toNumberValue((item as Record<string, unknown>).subtotal),
      }))
    : []

  const responsabilidades = Array.isArray(row.responsabilidades)
    ? row.responsabilidades.map((item) => ({
        id: Number((item as Record<string, unknown>).id),
        item: toStringValue((item as Record<string, unknown>).item),
        responsavel: (toStringValue((item as Record<string, unknown>).responsavel) || 'gontijo') as
          | 'cliente'
          | 'gontijo',
        valor: toNumberValue((item as Record<string, unknown>).valor),
      }))
    : []

  const contatos = Array.isArray(row.contatos)
    ? row.contatos.map((item) => ({
        id: Number((item as Record<string, unknown>).id),
        nome: toStringValue((item as Record<string, unknown>).nome),
        funcao: toStringValue((item as Record<string, unknown>).funcao),
        telefone: toStringValue((item as Record<string, unknown>).telefone),
        email: toStringValue((item as Record<string, unknown>).email),
      }))
    : []

  const modalidades = Array.isArray(row.modalidades)
    ? row.modalidades.map((item) => Number((item as Record<string, unknown>).id))
    : []

  const equipamentos = Array.isArray(row.equipamentos)
    ? row.equipamentos.map((item) => Number((item as Record<string, unknown>).id))
    : []

  return {
    id: toNumberValue(row.id) || undefined,
    numero: toStringValue(row.numero),
    clienteId: toNumberValue(row.cliente_id),
    status: (toStringValue(row.status) || 'em andamento') as ObraDetail['status'],
    empresaResponsavel: toStringValue(row.empresa_responsavel),
    tipoObra: toStringValue(row.tipo_obra),
    finalidade: toStringValue(row.finalidade),
    dataPrevistaInicio: toStringValue(row.data_prevista_inicio),
    estado: toStringValue(row.estado),
    cidade: toStringValue(row.cidade),
    cep: toStringValue(row.cep),
    logradouro: toStringValue(row.logradouro),
    bairro: toStringValue(row.bairro),
    numeroEnd: toStringValue(row.numero_end),
    complemento: toStringValue(row.complemento),
    projetoGontijo: toBooleanValue(row.projeto_gontijo),
    valorProjeto: toNumberValue(row.valor_projeto),
    fatMinimoTipo: row.fat_minimo_tipo === 'diario' ? 'diario' : 'global',
    fatMinimoValor: toNumberValue(row.fat_minimo_valor),
    fatMinimoDias: toNumberValue(row.fat_minimo_dias),
    usaBits: toBooleanValue(row.usa_bits),
    valorBits: toNumberValue(row.valor_bits),
    transporteNoturno: toBooleanValue(row.transporte_noturno),
    icamento: toBooleanValue(row.icamento),
    seguroPct: toNumberValue(row.seguro_pct),
    totalProducao: toNumberValue(row.total_producao),
    mobilizacao: toNumberValue(row.mobilizacao),
    desmobilizacao: toNumberValue(row.desmobilizacao),
    totalGeral: toNumberValue(row.total_geral),
    responsavelComercialGontijo: toStringValue(row.responsavel_comercial_gontijo),
    telComercialGontijo: toStringValue(row.tel_comercial_gontijo),
    responsavelContratante: toStringValue(row.responsavel_contratante),
    telContratante: toStringValue(row.tel_contratante),
    observacoes: toStringValue(row.observacoes),
    producao,
    responsabilidades,
    contatos,
    modalidades,
    equipamentos,
  }
}

function adaptDiario(row: Record<string, unknown>): DiarioRecord {
  return {
    id: Number(row.id),
    obraId: Number(row.obra_id),
    equipamentoId: toNumberValue(row.equipamento_id),
    dataDiario: toStringValue(row.data_diario),
    status: (toStringValue(row.status) || 'pendente') as DiarioRecord['status'],
    assinadoEm: toStringValue(row.assinado_em),
    obraNumero: toStringValue(row.obra_numero),
    cliente: toStringValue(row.cliente),
    equipamento: toStringValue(row.equipamento),
  }
}

function adaptDiarioDetail(row: Record<string, unknown>): DiarioDetail {
  const base = adaptDiario(row)
  return {
    ...base,
    operadorId: toNumberValue(row.operador_id),
    operadorNome: toStringValue(row.operador_nome),
    clienteNome: toStringValue(row.cliente),
    dadosJson:
      row.dados_json && typeof row.dados_json === 'object'
        ? (row.dados_json as Record<string, unknown>)
        : null,
  }
}

function buildObraPayload(payload: ObraDetail) {
  return {
    numero: payload.numero,
    cliente_id: payload.clienteId,
    status: payload.status,
    empresa_responsavel: payload.empresaResponsavel,
    tipo_obra: payload.tipoObra,
    finalidade: payload.finalidade,
    data_prevista_inicio: payload.dataPrevistaInicio || null,
    estado: payload.estado,
    cidade: payload.cidade,
    cep: payload.cep,
    logradouro: payload.logradouro,
    bairro: payload.bairro,
    numero_end: payload.numeroEnd,
    complemento: payload.complemento,
    projeto_gontijo: payload.projetoGontijo,
    valor_projeto: payload.valorProjeto,
    fat_minimo_tipo: payload.fatMinimoTipo,
    fat_minimo_valor: payload.fatMinimoValor,
    fat_minimo_dias: payload.fatMinimoDias,
    usa_bits: payload.usaBits,
    valor_bits: payload.valorBits,
    transporte_noturno: payload.transporteNoturno,
    icamento: payload.icamento,
    seguro_pct: payload.seguroPct,
    total_producao: payload.totalProducao,
    mobilizacao: payload.mobilizacao,
    desmobilizacao: payload.desmobilizacao,
    total_geral: payload.totalGeral,
    responsavel_comercial_gontijo: payload.responsavelComercialGontijo,
    tel_comercial_gontijo: payload.telComercialGontijo,
    responsavel_contratante: payload.responsavelContratante,
    tel_contratante: payload.telContratante,
    observacoes: payload.observacoes,
    producao: payload.producao.map((item) => ({
      diametro: item.diametro,
      profundidade: item.profundidade,
      qtd_estacas: item.qtdEstacas,
      preco: item.preco,
      subtotal: item.subtotal,
    })),
    responsabilidades: payload.responsabilidades.map((item) => ({
      item: item.item,
      responsavel: item.responsavel,
      valor: item.valor,
    })),
    contatos: payload.contatos.map((item) => ({
      nome: item.nome,
      funcao: item.funcao,
      telefone: item.telefone,
      email: item.email,
    })),
    modalidades: payload.modalidades,
    equipamentos: payload.equipamentos,
  }
}

export function extractApiErrorMessage(error: unknown) {
  if (error instanceof AxiosError) {
    return (
      (error.response?.data as { error?: string } | undefined)?.error ||
      error.message ||
      'Nao foi possivel completar a operacao.'
    )
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Nao foi possivel completar a operacao.'
}

export const dashboardService = {
  async overview(): Promise<DashboardOverview> {
    const { data } = await api.get<ApiEnvelope<Record<string, unknown>>>('/gontijo/dashboard/overview')
    const payload = data.data

    return {
      stats: {
        obrasAndamento: Number((payload.stats as Record<string, unknown>).obras_andamento),
        obrasFinalizadas: Number((payload.stats as Record<string, unknown>).obras_finalizadas),
        maquinasAtivas: Number((payload.stats as Record<string, unknown>).maquinas_ativas),
        diariosPendentes: Number((payload.stats as Record<string, unknown>).diarios_pendentes),
      },
      recentActivities: ((payload.recent_activities as Array<Record<string, unknown>>) || []).map((item) => ({
        id: toStringValue(item.id),
        date: toStringValue(item.date),
        type: item.type === 'diario' ? 'diario' : 'obra',
        title: toStringValue(item.title),
        description: toStringValue(item.description),
      })),
      alerts: ((payload.alerts as Array<Record<string, unknown>>) || []).map((item) => ({
        id: toStringValue(item.id),
        severity: item.severity === 'info' ? 'info' : 'warning',
        title: toStringValue(item.title),
        description: toStringValue(item.description),
      })),
    }
  },
}

export const usuarioService = {
  async list(params: { busca?: string; status?: string; page?: number; limit?: number }) {
    const { data } = await api.get<ApiEnvelope<Record<string, unknown>[]>>('/gontijo/usuarios', { params })
    const payload = listResult(data)
    return { ...payload, items: payload.items.map(adaptUsuario) }
  },
  async getById(id: number) {
    const { data } = await api.get<ApiEnvelope<Record<string, unknown>>>(`/gontijo/usuarios/${id}`)
    return adaptUsuario(data.data)
  },
  async create(payload: UsuarioPayload) {
    const { data } = await api.post<{ id: number }>('/gontijo/usuarios', {
      nome: payload.nome,
      apelido: payload.apelido,
      login: payload.login,
      telefone: payload.telefone,
      senha: payload.senha,
      perfil: payload.perfil,
    })
    return data.id
  },
  async update(id: number, payload: UsuarioPayload) {
    await api.put(`/gontijo/usuarios/${id}`, {
      nome: payload.nome,
      apelido: payload.apelido,
      login: payload.login,
      telefone: payload.telefone,
      perfil: payload.perfil,
      status: payload.status,
    })
  },
}

export const clienteService = {
  async list(params: { busca?: string; page?: number; limit?: number }) {
    const { data } = await api.get<ApiEnvelope<Record<string, unknown>[]>>('/gontijo/clientes', { params })
    const payload = listResult(data)
    return { ...payload, items: payload.items.map(adaptCliente) }
  },
  async listOptions() {
    const result = await clienteService.list({ page: 1, limit: 500 })
    return result.items.map((item) => ({ id: item.id, nome: item.razaoSocial }))
  },
  async getById(id: number) {
    const { data } = await api.get<ApiEnvelope<Record<string, unknown>>>(`/gontijo/clientes/${id}`)
    return adaptCliente(data.data)
  },
  async create(payload: ClientePayload) {
    const { data } = await api.post<{ id: number }>('/gontijo/clientes', {
      razao_social: payload.razaoSocial,
      tipo_doc: payload.tipoDoc,
      documento: payload.documento,
      inscricao_municipal: payload.inscricaoMunicipal,
      email: payload.email,
      telefone: payload.telefone,
      cep: payload.cep,
      estado: payload.estado,
      cidade: payload.cidade,
      logradouro: payload.logradouro,
      bairro: payload.bairro,
      numero: payload.numero,
      complemento: payload.complemento,
    })
    return data.id
  },
  async update(id: number, payload: ClientePayload) {
    await api.put(`/gontijo/clientes/${id}`, {
      razao_social: payload.razaoSocial,
      tipo_doc: payload.tipoDoc,
      documento: payload.documento,
      inscricao_municipal: payload.inscricaoMunicipal,
      email: payload.email,
      telefone: payload.telefone,
      cep: payload.cep,
      estado: payload.estado,
      cidade: payload.cidade,
      logradouro: payload.logradouro,
      bairro: payload.bairro,
      numero: payload.numero,
      complemento: payload.complemento,
    })
  },
  async remove(id: number) {
    await api.delete(`/gontijo/clientes/${id}`)
  },
}

export const modalidadeService = {
  async list() {
    const { data } = await api.get<ApiEnvelope<Record<string, unknown>[]>>('/gontijo/modalidades')
    return data.data.map((row) => ({
      id: Number(row.id),
      nome: toStringValue(row.nome),
    }))
  },
}

export const equipamentoService = {
  async list() {
    const { data } = await api.get<ApiEnvelope<Record<string, unknown>[]>>('/gontijo/equipamentos')
    return data.data.map(adaptEquipamento)
  },
  async listOptions(): Promise<OptionItem[]> {
    const rows = await equipamentoService.list()
    return rows.map((item) => ({ id: item.id, nome: item.nome }))
  },
  async create(payload: EquipamentoPayload) {
    const { data } = await api.post<{ id: number }>('/gontijo/equipamentos', {
      nome: payload.nome,
      computador_geo: payload.computadorGeo,
      modalidade_id: payload.modalidadeId,
    })
    return data.id
  },
  async update(id: number, payload: EquipamentoPayload) {
    await api.put(`/gontijo/equipamentos/${id}`, {
      nome: payload.nome,
      computador_geo: payload.computadorGeo,
      modalidade_id: payload.modalidadeId,
      status: payload.status,
    })
  },
}

export const obraService = {
  async list(params: { busca?: string; status?: string; clienteId?: number | null; page?: number; limit?: number }) {
    const { data } = await api.get<ApiEnvelope<Record<string, unknown>[]>>('/gontijo/obras', {
      params: {
        busca: params.busca,
        status: params.status,
        cliente_id: params.clienteId,
        page: params.page,
        limit: params.limit,
      },
    })
    const payload = listResult(data)
    return { ...payload, items: payload.items.map(adaptObraResumo) }
  },
  async getById(id: number) {
    const { data } = await api.get<ApiEnvelope<Record<string, unknown>>>(`/gontijo/obras/${id}`)
    return adaptObraDetail(data.data)
  },
  async create(payload: ObraDetail) {
    const { data } = await api.post<{ id: number }>('/gontijo/obras', buildObraPayload(payload))
    return data.id
  },
  async update(id: number, payload: ObraDetail) {
    await api.put(`/gontijo/obras/${id}`, buildObraPayload(payload))
  },
}

export const diarioService = {
  async list(filters: DiarioFilters) {
    const { data } = await api.get<ApiEnvelope<Record<string, unknown>[]>>('/gontijo/diarios', {
      params: {
        page: filters.page,
        limit: filters.limit,
        data_inicio: filters.dataInicio,
        data_fim: filters.dataFim,
        obra: filters.obra,
        modalidade_id: filters.modalidadeId,
        equipamento_id: filters.equipamentoId,
        status: filters.status,
      },
    })
    const payload = listResult(data)
    return { ...payload, items: payload.items.map(adaptDiario) }
  },
  async remove(id: number) {
    await api.delete(`/gontijo/diarios/${id}`)
  },
  async getById(id: number) {
    const { data } = await api.get<ApiEnvelope<Record<string, unknown>>>(`/gontijo/diarios/${id}`)
    return adaptDiarioDetail(data.data)
  },
  async update(id: number, payload: DiarioPayload) {
    await api.put(`/gontijo/diarios/${id}`, {
      data_diario: payload.dataDiario,
      status: payload.status,
      equipamento_id: payload.equipamentoId,
      assinado_em: payload.assinadoEm || null,
      dados_json: payload.dadosJson,
    })
  },
  getPdfUrl(id: number) {
    return `/api/gontijo/diarios/${id}/pdf`
  },
}
