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
  imei: string
  obraNumero: string
}

export type EquipamentoPayload = {
  nome: string
  computadorGeo: string
  modalidadeId: number | null
  status?: 'ativo' | 'inativo'
  imei?: string
  obraNumero?: string
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
  diametroCm?: number | null
  meqFactor?: number | null
  metaMeqSegmento?: number | null
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
  operadorId?: number | null
  status?: string
}

export type OperadorProfile = {
  id: number
  nome: string
  apelido: string
  email: string
  telefone: string
  foto: string
  assinatura: string
  documento: string
  perfil: 'operador'
}

export type DiarySignatureLinkStatus = {
  diaryId: number
  status: 'nao_gerado' | 'aguardando_assinatura' | 'assinado' | 'expirado'
  publicUrl: string
  expiresAt: string
  sentAt: string
  signedAt: string
  clientName: string
  clientDocument: string
  hasOperatorSignature: boolean
  hasClientSignature: boolean
  operatorName: string
  operatorDocument: string
  operatorSignature: string
  obraNumero: string
  cliente: string
  equipamento: string
  dataDiario: string
  reviewConfirmed: boolean
  whatsappText?: string
}

export type PublicDiarySignatureDetail = {
  tokenStatus: 'active' | 'signed' | 'expired' | 'revoked' | string
  diaryId: number
  obraNumero: string
  cliente: string
  equipamento: string
  dataDiario: string
  pdfUrl: string
  operatorName: string
  operatorDocument: string
  operatorSignature: string
  clientName: string
  clientDocument: string
  clientSignature: string
  signedAt: string
  expiresAt: string
}

export type ClientPortalAccessRecord = {
  id: number
  constructionId: number
  obraNumero: string
  cliente: string
  cidade: string
  estado: string
  tipoObra: string
  login: string
  status: 'ativo' | 'inativo'
  lastLoginAt: string
  createdAt: string
  updatedAt: string
}

export type LiveDashboardMachine = {
  imei: string
  machineName: string
  obraCode: string
  obraName: string
  realizedEstacas: number
  realizedLinearMeters: number
  realizedMeq: number
  approxRevenueRealized: number
  weeklyGoalEstacas: number
  progressPercent: number | null
}

export type LiveDashboardTimelineItem = {
  date: string
  finishedAt: string
  machineName: string
  obraName: string
  obraCode: string
  estaca: string
  realizedLinearMeters: number
}

export type ObraLiveDashboard = {
  weekStart: string
  weekDates: string[]
  totalRealizedEstacas: number
  totalGoalEstacas: number
  totalRealizedLinearMeters: number
  totalRealizedMeq: number
  totalApproxRevenueRealized: number
  machines: LiveDashboardMachine[]
  timeline: LiveDashboardTimelineItem[]
  accumulatedByDay: Array<{
    date: string
    realizedEstacas: number
    expectedAccumulatedEstacas: number
    accumulatedEstacas: number
  }>
}

export type ProductionMetric = 'estacas' | 'meq' | 'faturamento'

export type ProductionTimelineItem = {
  date: string
  finishedAt: string
  machineName: string
  imei: string
  obraName: string
  obraCode: string
  estaca: string
  realizedLinearMeters: number
  realizedMeq: number
  approxRevenueRealized: number
}

export type ProductionWorkRankingItem = {
  obraName: string
  goalEstacas: number
  realizedEstacas: number
  realizedLinearMeters: number
  realizedMeq: number
  approxRevenueRealized: number
}

export type ProductionMachineDailyRow = {
  date: string
  goalEstacas: number
  realizedEstacas: number
  realizedLinearMeters: number
  realizedMeq: number
  approxRevenueRealized: number
}

export type ProductionMachineRow = {
  imei: string
  machineName: string
  obraCode: string
  obraName: string
  workSource: 'admin' | 'api' | 'none'
  dailyGoalEstacas: number
  weeklyGoalEstacas: number
  realizedEstacas: number
  realizedLinearMeters: number
  realizedMeq: number
  approxRevenueRealized: number
  progressPercent: number | null
  active: boolean
  alerts: string[]
  daily: ProductionMachineDailyRow[]
}

export type ProductionDailyDashboard = {
  date: string
  totalRealizedEstacas: number
  totalGoalEstacas: number
  totalRealizedLinearMeters: number
  totalRealizedMeq: number
  totalApproxRevenueRealized: number
  totalProgressPercent: number | null
  machines: ProductionMachineRow[]
  topWorks: ProductionWorkRankingItem[]
  ranking: ProductionMachineRow[]
  timeline: ProductionTimelineItem[]
  generatedAt: string
}

export type ProductionWeeklyAccumulatedDay = {
  date: string
  goalEstacas: number
  realizedEstacas: number
  realizedLinearMeters: number
  realizedMeq: number
  approxRevenueRealized: number
  accumulatedEstacas: number
  accumulatedLinearMeters: number
  accumulatedMeq: number
  accumulatedApproxRevenueRealized: number
  expectedAccumulatedEstacas: number
}

export type ProductionWeeklyDashboard = {
  weekStart: string
  weekDates: string[]
  totalRealizedEstacas: number
  totalGoalEstacas: number
  totalRealizedLinearMeters: number
  totalRealizedMeq: number
  totalApproxRevenueRealized: number
  totalProgressPercent: number | null
  machines: ProductionMachineRow[]
  ranking: ProductionMachineRow[]
  topWorks: ProductionWorkRankingItem[]
  accumulatedByDay: ProductionWeeklyAccumulatedDay[]
  timeline: ProductionTimelineItem[]
  generatedAt: string
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

function toDateOnly(value: unknown): string {
  const text = toStringValue(value)
  if (!text) return ''
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : text
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
    imei: toStringValue(row.imei),
    obraNumero: toStringValue(row.obra_numero),
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
        diametroCm: toNumberValue((item as Record<string, unknown>).diametro_cm),
        meqFactor: toNumberValue((item as Record<string, unknown>).meq_factor),
        metaMeqSegmento: toNumberValue((item as Record<string, unknown>).meta_meq_segmento),
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
    dataDiario: toDateOnly(row.data_diario),
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

function adaptProductionTimeline(row: Record<string, unknown>): ProductionTimelineItem {
  return {
    date: toStringValue(row.date),
    finishedAt: toStringValue(row.finishedAt),
    machineName: toStringValue(row.machine_name),
    imei: toStringValue(row.imei),
    obraName: toStringValue(row.obra_name),
    obraCode: toStringValue(row.obra_code),
    estaca: toStringValue(row.estaca),
    realizedLinearMeters: Number(row.realized_linear_meters || 0),
    realizedMeq: Number(row.realized_meq || 0),
    approxRevenueRealized: Number(row.approx_revenue_realized || 0),
  }
}

function adaptProductionWorkRanking(row: Record<string, unknown>): ProductionWorkRankingItem {
  return {
    obraName: toStringValue(row.obra_name),
    goalEstacas: Number(row.goal_estacas || 0),
    realizedEstacas: Number(row.realized_estacas || 0),
    realizedLinearMeters: Number(row.realized_linear_meters || 0),
    realizedMeq: Number(row.realized_meq || 0),
    approxRevenueRealized: Number(row.approx_revenue_realized || 0),
  }
}

function adaptProductionMachineDailyRow(row: Record<string, unknown>): ProductionMachineDailyRow {
  return {
    date: toStringValue(row.date),
    goalEstacas: Number(row.goal_estacas || 0),
    realizedEstacas: Number(row.realized_estacas || 0),
    realizedLinearMeters: Number(row.realized_linear_meters || 0),
    realizedMeq: Number(row.realized_meq || 0),
    approxRevenueRealized: Number(row.approx_revenue_realized || 0),
  }
}

function adaptProductionMachine(row: Record<string, unknown>): ProductionMachineRow {
  const workSource = toStringValue(row.work_source)

  return {
    imei: toStringValue(row.imei),
    machineName: toStringValue(row.machine_name),
    obraCode: toStringValue(row.obra_code),
    obraName: toStringValue(row.obra_name),
    workSource: workSource === 'admin' || workSource === 'api' ? workSource : 'none',
    dailyGoalEstacas: Number(row.daily_goal_estacas || 0),
    weeklyGoalEstacas: Number(row.weekly_goal_estacas || 0),
    realizedEstacas: Number(row.realized_estacas || 0),
    realizedLinearMeters: Number(row.realized_linear_meters || 0),
    realizedMeq: Number(row.realized_meq || 0),
    approxRevenueRealized: Number(row.approx_revenue_realized || 0),
    progressPercent: row.progress_percent == null ? null : Number(row.progress_percent || 0),
    active: Boolean(row.active),
    alerts: Array.isArray(row.alerts) ? row.alerts.map((item) => toStringValue(item)).filter(Boolean) : [],
    daily: Array.isArray(row.daily)
      ? row.daily.map((item) => adaptProductionMachineDailyRow(item as Record<string, unknown>))
      : [],
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

export const productionService = {
  async daily(params: { date?: string; clientLogin?: string }): Promise<ProductionDailyDashboard> {
    const { data } = await api.get<Record<string, unknown>>('/dashboard/daily', {
      params: {
        date: params.date,
        clientLogin: params.clientLogin || undefined,
      },
    })

    return {
      date: toStringValue(data.date),
      totalRealizedEstacas: Number(data.total_realized_estacas || 0),
      totalGoalEstacas: Number(data.total_goal_estacas || 0),
      totalRealizedLinearMeters: Number(data.total_realized_linear_meters || 0),
      totalRealizedMeq: Number(data.total_realized_meq || 0),
      totalApproxRevenueRealized: Number(data.total_approx_revenue_realized || 0),
      totalProgressPercent: data.total_progress_percent == null ? null : Number(data.total_progress_percent || 0),
      machines: Array.isArray(data.machines)
        ? data.machines.map((item) => adaptProductionMachine(item as Record<string, unknown>))
        : [],
      topWorks: Array.isArray(data.top_works)
        ? data.top_works.map((item) => adaptProductionWorkRanking(item as Record<string, unknown>))
        : [],
      ranking: Array.isArray(data.ranking)
        ? data.ranking.map((item) => adaptProductionMachine(item as Record<string, unknown>))
        : [],
      timeline: Array.isArray(data.timeline)
        ? data.timeline.map((item) => adaptProductionTimeline(item as Record<string, unknown>))
        : [],
      generatedAt: toStringValue(data.generated_at),
    }
  },

  async weekly(params: { weekStart?: string; clientLogin?: string }): Promise<ProductionWeeklyDashboard> {
    const { data } = await api.get<Record<string, unknown>>('/dashboard/weekly', {
      params: {
        weekStart: params.weekStart,
        clientLogin: params.clientLogin || undefined,
      },
    })

    return {
      weekStart: toStringValue(data.week_start),
      weekDates: Array.isArray(data.week_dates) ? data.week_dates.map((item) => toStringValue(item)) : [],
      totalRealizedEstacas: Number(data.total_realized_estacas || 0),
      totalGoalEstacas: Number(data.total_goal_estacas || 0),
      totalRealizedLinearMeters: Number(data.total_realized_linear_meters || 0),
      totalRealizedMeq: Number(data.total_realized_meq || 0),
      totalApproxRevenueRealized: Number(data.total_approx_revenue_realized || 0),
      totalProgressPercent: data.total_progress_percent == null ? null : Number(data.total_progress_percent || 0),
      machines: Array.isArray(data.machines)
        ? data.machines.map((item) => adaptProductionMachine(item as Record<string, unknown>))
        : [],
      ranking: Array.isArray(data.ranking)
        ? data.ranking.map((item) => adaptProductionMachine(item as Record<string, unknown>))
        : [],
      topWorks: Array.isArray(data.top_works)
        ? data.top_works.map((item) => adaptProductionWorkRanking(item as Record<string, unknown>))
        : [],
      accumulatedByDay: Array.isArray(data.accumulated_by_day)
        ? data.accumulated_by_day.map((item) => {
            const row = item as Record<string, unknown>
            return {
              date: toStringValue(row.date),
              goalEstacas: Number(row.goal_estacas || 0),
              realizedEstacas: Number(row.realized_estacas || 0),
              realizedLinearMeters: Number(row.realized_linear_meters || 0),
              realizedMeq: Number(row.realized_meq || 0),
              approxRevenueRealized: Number(row.approx_revenue_realized || 0),
              accumulatedEstacas: Number(row.accumulated_estacas || 0),
              accumulatedLinearMeters: Number(row.accumulated_linear_meters || 0),
              accumulatedMeq: Number(row.accumulated_meq || 0),
              accumulatedApproxRevenueRealized: Number(row.accumulated_approx_revenue_realized || 0),
              expectedAccumulatedEstacas: Number(row.expected_accumulated_estacas || 0),
            }
          })
        : [],
      timeline: Array.isArray(data.timeline)
        ? data.timeline.map((item) => adaptProductionTimeline(item as Record<string, unknown>))
        : [],
      generatedAt: toStringValue(data.generated_at),
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
  async listAtivos() {
    const { data } = await api.get<ApiEnvelope<Record<string, unknown>[]>>('/gontijo/equipamentos', {
      params: { status: 'ativo' },
    })
    return data.data.map(adaptEquipamento)
  },
  async listParametrizados() {
    const { data } = await api.get<ApiEnvelope<Record<string, unknown>[]>>('/gontijo/equipamentos', {
      params: { parametrizados: 1 },
    })
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
      imei: payload.imei,
      obra_numero: payload.obraNumero,
    })
    return data.id
  },
  async update(id: number, payload: EquipamentoPayload) {
    await api.put(`/gontijo/equipamentos/${id}`, {
      nome: payload.nome,
      computador_geo: payload.computadorGeo,
      modalidade_id: payload.modalidadeId,
      status: payload.status,
      imei: payload.imei,
      obra_numero: payload.obraNumero,
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
        operador_id: filters.operadorId,
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
  async resolveDraft(payload: { obraId?: number | null; obraNumero?: string; operadorId: number; equipamentoId: number }) {
    const { data } = await api.post<ApiEnvelope<Record<string, unknown>>>('/gontijo/operador/diarios/resolve-draft', {
      obra_id: payload.obraId ?? null,
      obra_numero: payload.obraNumero || null,
      operador_id: payload.operadorId,
      equipamento_id: payload.equipamentoId,
    })
    return adaptDiarioDetail(data.data)
  },
  async create(payload: {
    obraId: number
    operadorId: number | null
    dataDiario: string
    status: 'rascunho' | 'pendente' | 'assinado'
    equipamentoId: number | null
    assinadoEm: string
    dadosJson: Record<string, unknown> | null
  }) {
    const { data } = await api.post<{ id: number }>('/gontijo/diarios', {
      obra_id: payload.obraId,
      operador_id: payload.operadorId,
      data_diario: toDateOnly(payload.dataDiario),
      status: payload.status,
      equipamento_id: payload.equipamentoId,
      assinado_em: payload.assinadoEm || null,
      dados_json: payload.dadosJson,
    })
    return data.id
  },
  async update(id: number, payload: DiarioPayload) {
    await api.put(`/gontijo/diarios/${id}`, {
      data_diario: toDateOnly(payload.dataDiario),
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

export const operadorProfileService = {
  async getProfile(): Promise<OperadorProfile> {
    const { data } = await api.get<ApiEnvelope<Record<string, unknown>>>('/operador/profile')
    return {
      id: Number(data.data.id),
      nome: toStringValue(data.data.nome),
      apelido: toStringValue(data.data.apelido),
      email: toStringValue(data.data.email),
      telefone: toStringValue(data.data.telefone),
      foto: toStringValue(data.data.foto),
      assinatura: toStringValue(data.data.assinatura),
      documento: toStringValue(data.data.documento),
      perfil: 'operador',
    }
  },
  async updateProfile(payload: Pick<OperadorProfile, 'assinatura'>) {
    await api.put('/operador/profile', {
      assinatura: payload.assinatura,
    })
  },
}

function adaptDiarySignatureLinkStatus(row: Record<string, unknown>): DiarySignatureLinkStatus {
  return {
    diaryId: Number(row.diaryId || row.diary_id || 0),
    status: (toStringValue(row.status) || 'nao_gerado') as DiarySignatureLinkStatus['status'],
    publicUrl: toStringValue(row.publicUrl),
    expiresAt: toStringValue(row.expiresAt),
    sentAt: toStringValue(row.sentAt),
    signedAt: toStringValue(row.signedAt),
    clientName: toStringValue(row.clientName),
    clientDocument: toStringValue(row.clientDocument),
    hasOperatorSignature: toBooleanValue(row.hasOperatorSignature),
    hasClientSignature: toBooleanValue(row.hasClientSignature),
    operatorName: toStringValue(row.operatorName),
    operatorDocument: toStringValue(row.operatorDocument),
    operatorSignature: toStringValue(row.operatorSignature),
    obraNumero: toStringValue(row.obraNumero),
    cliente: toStringValue(row.cliente),
    equipamento: toStringValue(row.equipamento),
    dataDiario: toDateOnly(row.dataDiario),
    reviewConfirmed: toBooleanValue(row.reviewConfirmed),
    whatsappText: toStringValue(row.whatsappText),
  }
}

function adaptPublicDiarySignatureDetail(row: Record<string, unknown>): PublicDiarySignatureDetail {
  return {
    tokenStatus: toStringValue(row.tokenStatus) || 'expired',
    diaryId: Number(row.diaryId || 0),
    obraNumero: toStringValue(row.obraNumero),
    cliente: toStringValue(row.cliente),
    equipamento: toStringValue(row.equipamento),
    dataDiario: toDateOnly(row.dataDiario),
    pdfUrl: toStringValue(row.pdfUrl),
    operatorName: toStringValue(row.operatorName),
    operatorDocument: toStringValue(row.operatorDocument),
    operatorSignature: toStringValue(row.operatorSignature),
    clientName: toStringValue(row.clientName),
    clientDocument: toStringValue(row.clientDocument),
    clientSignature: toStringValue(row.clientSignature),
    signedAt: toStringValue(row.signedAt),
    expiresAt: toStringValue(row.expiresAt),
  }
}

function adaptClientPortalAccess(row: Record<string, unknown>): ClientPortalAccessRecord {
  return {
    id: Number(row.id || 0),
    constructionId: Number(row.construction_id || row.constructionId || 0),
    obraNumero: toStringValue(row.construction_number || row.obraNumero),
    cliente: toStringValue(row.client_name || row.cliente),
    cidade: toStringValue(row.city_name || row.city || row.cidade),
    estado: toStringValue(row.state || row.estado),
    tipoObra: toStringValue(row.construction_type || row.tipoObra),
    login: toStringValue(row.login),
    status: toStringValue(row.active) === 'N' ? 'inativo' : 'ativo',
    lastLoginAt: toStringValue(row.last_login_at || row.lastLoginAt),
    createdAt: toStringValue(row.created_at || row.createdAt),
    updatedAt: toStringValue(row.updated_at || row.updatedAt),
  }
}

export const diarioSignatureService = {
  async getStatus(diarioId: number): Promise<DiarySignatureLinkStatus> {
    const { data } = await api.get<ApiEnvelope<Record<string, unknown>>>(`/operador/diarios/${diarioId}/signature-link`)
    return adaptDiarySignatureLinkStatus(data.data)
  },
  async generate(diarioId: number): Promise<DiarySignatureLinkStatus> {
    const { data } = await api.post<ApiEnvelope<Record<string, unknown>>>(`/operador/diarios/${diarioId}/signature-link`)
    return adaptDiarySignatureLinkStatus(data.data)
  },
  async getPublic(token: string): Promise<PublicDiarySignatureDetail> {
    const { data } = await api.get<ApiEnvelope<Record<string, unknown>>>(`/public/diarios/signature/${token}`)
    return adaptPublicDiarySignatureDetail(data.data)
  },
  async submitPublic(
    token: string,
    payload: { nome: string; documento: string; assinatura: string }
  ): Promise<{ diaryId: number; signedAt: string }> {
    const { data } = await api.post<ApiEnvelope<Record<string, unknown>>>(`/public/diarios/signature/${token}`, {
      nome: payload.nome,
      documento: payload.documento,
      assinatura: payload.assinatura,
    })
    return {
      diaryId: Number(data.data.diaryId || 0),
      signedAt: toStringValue(data.data.signedAt),
    }
  },
}

export const clientPortalAdminService = {
  async list(): Promise<ClientPortalAccessRecord[]> {
    const { data } = await api.get<ApiEnvelope<Record<string, unknown>[]>>('/admin/client-portals')
    return Array.isArray(data.data) ? data.data.map(adaptClientPortalAccess) : []
  },
  async create(payload: { constructionId: number; login: string; password: string; active: boolean }) {
    const { data } = await api.post<ApiEnvelope<Record<string, unknown>>>('/admin/client-portals', {
      construction_id: payload.constructionId,
      login: payload.login,
      password: payload.password,
      active: payload.active,
    })
    return adaptClientPortalAccess(data.data)
  },
  async update(id: number, payload: { login: string; password?: string; active: boolean }) {
    const { data } = await api.put<ApiEnvelope<Record<string, unknown>>>(`/admin/client-portals/${id}`, {
      login: payload.login,
      password: payload.password,
      active: payload.active,
    })
    return adaptClientPortalAccess(data.data)
  },
}

export type EstacaSyncItem = {
  s3Key: string
  pilar: string
  diametro: string
  realizado: number | null
  finishedAt: string | null
  obra: string
}

export const estacaService = {
  async sync(params: { imei: string; date: string }): Promise<EstacaSyncItem[]> {
    const { data } = await api.get<{ ok: boolean; data: EstacaSyncItem[] }>('/estacas/sync', {
      params: { imei: params.imei, date: params.date },
    })
    return data.data || []
  },
}

export const obraLiveService = {
  async weeklyByObra(params: { weekStart: string; obraNumero: string }) {
    const mappingsResponse = await api.get<{ ok: boolean; items: Array<Record<string, unknown>> }>('/admin/mappings', {
      params: { includeInactive: false },
    })

    const machines = mappingsResponse.data.items
      .map((item) => ({
        name: toStringValue(item.machine_name),
        imei: toStringValue(item.imei),
      }))
      .filter((item) => item.name && item.imei)

    const { data } = await api.post<Record<string, unknown>>('/dashboard/weekly', {
      weekStart: params.weekStart,
      obraFilter: params.obraNumero,
      machines,
    })

    return {
      weekStart: toStringValue(data.weekStart),
      weekDates: Array.isArray(data.weekDates) ? data.weekDates.map((item) => toStringValue(item)) : [],
      totalRealizedEstacas: Number(data.total_realized_estacas || 0),
      totalGoalEstacas: Number(data.total_goal_estacas || 0),
      totalRealizedLinearMeters: Number(data.total_realized_linear_meters || 0),
      totalRealizedMeq: Number(data.total_realized_meq || 0),
      totalApproxRevenueRealized: Number(data.total_approx_revenue_realized || 0),
      machines: Array.isArray(data.machines)
        ? data.machines.map((item) => {
            const machineRow = item as Record<string, unknown>
            const machineInfo = (machineRow.machine as Record<string, unknown> | undefined) || {}

            return {
              imei: toStringValue(machineInfo.imei),
              machineName: toStringValue(machineInfo.name),
              obraCode: toStringValue(machineRow.obra_code),
              obraName: toStringValue(machineRow.obra_name),
              realizedEstacas: Number(machineRow.weeklyTotalCount || 0),
              realizedLinearMeters: Number(machineRow.weeklyTotalMeters || 0),
              realizedMeq: 0,
              approxRevenueRealized: 0,
              weeklyGoalEstacas: Number(machineRow.weekly_goal_estacas || 0),
              progressPercent: machineRow.progress_percent == null ? null : Number(machineRow.progress_percent || 0),
            }
          })
        : [],
      timeline: Array.isArray(data.timeline)
        ? data.timeline.map((item) => ({
            date: toStringValue((item as Record<string, unknown>).date),
            finishedAt: toStringValue((item as Record<string, unknown>).finishedAt),
            machineName: toStringValue((item as Record<string, unknown>).machineName),
            obraName: toStringValue((item as Record<string, unknown>).contrato),
            obraCode: toStringValue((item as Record<string, unknown>).obra),
            estaca: toStringValue((item as Record<string, unknown>).estaca),
            realizedLinearMeters: Number((item as Record<string, unknown>).realizadoM || 0),
          }))
        : [],
      accumulatedByDay: Array.isArray(data.weekDates)
        ? (data.weekDates as unknown[]).reduce<Array<{ date: string; realizedEstacas: number; expectedAccumulatedEstacas: number; accumulatedEstacas: number }>>(
            (acc, dateItem, index, source) => {
              const date = toStringValue(dateItem)
              const realizedEstacas = Array.isArray(data.machines)
                ? (data.machines as Array<Record<string, unknown>>).reduce<number>((sum, machine) => {
                    const daily = Array.isArray(machine.daily) ? machine.daily : []
                    const current = daily.find((item) => toStringValue((item as Record<string, unknown>).date) === date) as
                      | Record<string, unknown>
                      | undefined

                    return sum + Number(current?.totalCount || 0)
                  }, 0)
                : 0

              const accumulatedEstacas = realizedEstacas + (acc[index - 1]?.accumulatedEstacas || 0)
              const expectedAccumulatedEstacas =
                source.length > 0 ? Number((((Number(data.total_goal_estacas || 0) / source.length) * (index + 1))).toFixed(2)) : 0

              acc.push({
                date,
                realizedEstacas,
                expectedAccumulatedEstacas,
                accumulatedEstacas,
              })

              return acc
            },
            []
          )
        : [],
    } satisfies ObraLiveDashboard
  },
}

// ============================================================
// CURSOS E PROVAS
// ============================================================

export type CursoRecord = {
  id: number
  titulo: string
  descricao: string | null
  thumbnail_url: string | null
  video_url: string | null
  ativo: number
  criado_em: string
  atualizado_em: string
  total_provas?: number
  total_atribuicoes?: number
}

export type ProvaRecord = {
  id: number
  curso_id: number
  titulo: string
  percentual_aprovacao: number
  ativo: number
  criado_em: string
  total_questoes?: number
}

export type AlternativaRecord = {
  id: number
  questao_id: number
  texto: string
  correta: boolean
  ordem: number
}

export type QuestaoRecord = {
  id: number
  prova_id: number
  enunciado: string
  ordem: number
  alternativas: AlternativaRecord[]
}

export type AtribuicaoRecord = {
  id: number
  curso_id: number
  tipo: 'setor' | 'usuario'
  setor_id: number | null
  usuario_id: number | null
  setor_nome: string | null
  usuario_nome: string | null
  tipo_acesso: 'curso_e_prova' | 'so_curso' | 'so_prova'
  criado_em: string
}

export type TentativaRecord = {
  id: number
  prova_id: number
  usuario_id: number
  acertos: number
  total_questoes: number
  percentual: number
  aprovado: number
  realizado_em: string
  usuario_nome?: string
  prova_titulo?: string
  curso_id?: number
  curso_titulo?: string
  percentual_aprovacao?: number
}

export type OperadorCurso = CursoRecord & {
  tem_prova: number
  ja_aprovado: number | null
  tentativas: number
  tipo_acesso?: 'curso_e_prova' | 'so_curso' | 'so_prova'
  prova?: Pick<ProvaRecord, 'id' | 'titulo' | 'percentual_aprovacao'> | null
  ultima_tentativa?: TentativaRecord | null
}

export type ResultadoMatrizColumn = {
  curso_id: number
  curso_titulo: string
  prova_id: number | null
  prova_titulo: string | null
  percentual_aprovacao: number
}

export type ResultadoMatrizCell = {
  curso_id: number
  tipo_acesso: 'curso_e_prova' | 'so_curso' | 'so_prova' | null
  assigned: boolean
  has_prova: boolean
  tentativas: number
  aprovado: number
  melhor_percentual: number | null
  ultimo_realizado_em: string | null
  status: 'nao_atribuido' | 'somente_curso' | 'pendente' | 'aprovado' | 'reprovado'
}

export type ResultadoMatrizRow = {
  id: number
  nome: string
  apelido: string | null
  documento: string
  setor_nome: string | null
  cells: ResultadoMatrizCell[]
}

export type ResultadoMatriz = {
  columns: ResultadoMatrizColumn[]
  rows: ResultadoMatrizRow[]
  total: number
  page: number
  limit: number
}

export const cursosApi = {
  list: async (page = 1, limit = 20) => {
    const res = await api.get<ApiEnvelope<null> & { items: CursoRecord[]; total: number }>(
      `/gontijo/cursos?page=${page}&limit=${limit}`
    )
    return res.data
  },

  get: async (id: number) => {
    const res = await api.get<ApiEnvelope<CursoRecord & { provas: ProvaRecord[] }>>(`/gontijo/cursos/${id}`)
    return res.data.data
  },

  create: async (payload: Omit<CursoRecord, 'id' | 'criado_em' | 'atualizado_em' | 'ativo' | 'total_provas' | 'total_atribuicoes'>) => {
    const res = await api.post<ApiEnvelope<CursoRecord>>('/gontijo/cursos', payload)
    return res.data.data
  },

  update: async (id: number, payload: Partial<CursoRecord>) => {
    const res = await api.put<ApiEnvelope<CursoRecord>>(`/gontijo/cursos/${id}`, payload)
    return res.data.data
  },

  remove: async (id: number) => {
    await api.delete(`/gontijo/cursos/${id}`)
  },

  // Provas
  createProva: async (cursoId: number, payload: { titulo: string; percentual_aprovacao: number }) => {
    const res = await api.post<ApiEnvelope<ProvaRecord>>(`/gontijo/cursos/${cursoId}/provas`, payload)
    return res.data.data
  },

  updateProva: async (id: number, payload: Partial<ProvaRecord>) => {
    const res = await api.put<ApiEnvelope<ProvaRecord>>(`/gontijo/provas/${id}`, payload)
    return res.data.data
  },

  deleteProva: async (id: number) => {
    await api.delete(`/gontijo/provas/${id}`)
  },

  // Questões
  getQuestoes: async (provaId: number) => {
    const res = await api.get<ApiEnvelope<ProvaRecord & { questoes: QuestaoRecord[] }>>(`/gontijo/provas/${provaId}/questoes`)
    return res.data.data
  },

  createQuestao: async (provaId: number, payload: { enunciado: string; ordem?: number; alternativas: { texto: string; correta: boolean }[] }) => {
    const res = await api.post<ApiEnvelope<QuestaoRecord>>(`/gontijo/provas/${provaId}/questoes`, payload)
    return res.data.data
  },

  updateQuestao: async (id: number, payload: { enunciado: string; ordem?: number; alternativas: { texto: string; correta: boolean }[] }) => {
    const res = await api.put<ApiEnvelope<QuestaoRecord>>(`/gontijo/questoes/${id}`, payload)
    return res.data.data
  },

  deleteQuestao: async (id: number) => {
    await api.delete(`/gontijo/questoes/${id}`)
  },

  // Atribuições
  getAtribuicoes: async (cursoId: number) => {
    const res = await api.get<ApiEnvelope<AtribuicaoRecord[]>>(`/gontijo/cursos/${cursoId}/atribuicoes`)
    return res.data.data
  },

  createAtribuicao: async (cursoId: number, payload: { tipo: 'setor' | 'usuario'; setor_id?: number; usuario_id?: number; tipo_acesso?: string }) => {
    const res = await api.post<ApiEnvelope<AtribuicaoRecord>>(`/gontijo/cursos/${cursoId}/atribuicoes`, payload)
    return res.data.data
  },

  deleteAtribuicao: async (id: number) => {
    await api.delete(`/gontijo/cursos/atribuicoes/${id}`)
  },

  // Resultados
  getResultados: async (params?: { curso_id?: number; usuario_id?: number; page?: number; limit?: number }) => {
    const q = new URLSearchParams()
    if (params?.curso_id) q.set('curso_id', String(params.curso_id))
    if (params?.usuario_id) q.set('usuario_id', String(params.usuario_id))
    q.set('page', String(params?.page ?? 1))
    q.set('limit', String(params?.limit ?? 20))
    const res = await api.get<ApiEnvelope<null> & { items: TentativaRecord[]; total: number }>(`/gontijo/cursos/resultados?${q}`)
    return res.data
  },

  getResultadosMatriz: async (params?: { busca?: string; page?: number; limit?: number }) => {
    const q = new URLSearchParams()
    if (params?.busca) q.set('busca', params.busca)
    q.set('page', String(params?.page ?? 1))
    q.set('limit', String(params?.limit ?? 20))
    const res = await api.get<ApiEnvelope<ResultadoMatriz>>(`/gontijo/cursos/resultados/matriz?${q}`)
    return res.data.data
  },
}

export const operadorCursosApi = {
  list: async () => {
    const res = await api.get<ApiEnvelope<OperadorCurso[]>>('/gontijo/operador/cursos')
    return res.data.data
  },

  pendencias: async () => {
    const res = await api.get<ApiEnvelope<{ pendencias: number }>>('/gontijo/operador/cursos/pendencias')
    return res.data.data
  },

  get: async (id: number) => {
    const res = await api.get<ApiEnvelope<OperadorCurso>>(`/gontijo/operador/cursos/${id}`)
    return res.data.data
  },

  getQuestoes: async (provaId: number) => {
    const res = await api.get<ApiEnvelope<ProvaRecord & { questoes: QuestaoRecord[] }>>(`/gontijo/operador/provas/${provaId}/questoes`)
    return res.data.data
  },

  submitTentativa: async (provaId: number, respostas: { questao_id: number; alternativa_id: number }[]) => {
    const res = await api.post<ApiEnvelope<{
      id: number; acertos: number; total_questoes: number;
      percentual: number; aprovado: boolean; percentual_aprovacao: number
    }>>(`/gontijo/operador/provas/${provaId}/tentativa`, { respostas })
    return res.data.data
  },
}
