import { AxiosError } from 'axios'
import { api } from '@/lib/api'

type ApiEnvelope<T> = {
  ok: boolean
  data: T
  total?: number
  page?: number
  limit?: number
  summary?: unknown
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

export type SetorOption = {
  id: number
  nome: string
}

export type DashboardOverview = {
  stats: {
    obrasAndamento: number
    maquinasAtivas: number
    diariosConcluidos: number
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

export type SolidesIntegrationStatus = {
  tokenConfigured: boolean
  accountName: string
  employeesEnabled: boolean
  punchEnabled: boolean
  employeesCount: number
  message: string
}

export type SolidesPointCheckParams = {
  date: string
  sectorId?: number | null
  userId?: number | null
  onlyActiveUsers: boolean
  requireClosingPunch: boolean
  ignoreWithoutSchedule: boolean
  showFired: boolean
  statusFilter: '' | 'APPROVED' | 'PENDING' | 'REPROVED'
  entryToleranceMinutes: number
  exitToleranceMinutes: number
}

export type SolidesPointCheckRecord = {
  usuarioId: number
  nome: string
  cpf: string
  telefone: string
  setor: string
  setorId: number | null
  ativo: boolean
  solidesEmployeeId: number | null
  solidesExternalId: string
  escalaNome: string
  jornadaEsperadaInicio: string
  jornadaEsperadaFim: string
  primeiraMarcacao: string
  ultimaMarcacao: string
  totalMarcacoes: number
  totalBatidas: number
  totalFotos: number
  horasTrabalhadas: string
  statusesSolides: string[]
  status: string
  statusLabel: string
  statusTone: 'emerald' | 'amber' | 'red' | 'slate'
  observacao: string
}

export type SolidesPointCheckResult = {
  date: string
  params: SolidesPointCheckParams
  summary: {
    total: number
    ok: number
    semVinculo: number
    semPonto: number
    atencao: number
    reprovado: number
  }
  items: SolidesPointCheckRecord[]
}

export type WhatsAppIntegrationStatus = {
  enabled: boolean
  configured: boolean
  baseUrl: string
  instanceId: string
  clientTokenConfigured: boolean
  timeoutMs: number
  logsTableReady: boolean
  responsibleColumnReady: boolean
  equipmentOperatorColumnReady: boolean
  schedulerEnabled: boolean
  schedulerIntervalMinutes: number
  schedulerRunning: boolean
  schedulerLastRunAt: string
  schedulerLastError: string
  instance: {
    connected: boolean | null
    status: string
    endpoint: string
    error: string
  }
}

export type WhatsAppQrCode = {
  image: string
}

export type WhatsAppDiaryOverdueItem = {
  key: string
  constructionId: number
  constructionNumber: string
  equipmentId: number
  equipmentName: string
  referenceDate: string
  dueAt: string
  responsibleOperatorUserId: number | null
  operatorName: string
  operatorPhone: string
  canSend: boolean
  reason: string
}

export type WhatsAppLogRecord = {
  id: number
  eventType: string
  eventLabel: string
  historyText: string
  status: 'queued' | 'sent' | 'failed' | 'skipped'
  userId: number | null
  userName: string
  phone: string
  constructionId: number | null
  obraNumero: string
  courseId: number | null
  courseTitle: string
  referenceDate: string
  targetName: string
  messageText: string
  providerMessageId: string
  errorText: string
  createdAt: string
  metadata: Record<string, unknown>
}

export type WhatsAppDiaryDelaySummary = {
  total: number
  sent: number
  failed: number
  skipped: number
  operators: number
  constructions: number
  topOperators: Array<{
    name: string
    total: number
    sent: number
    lastDelayAt: string
  }>
}

export type WhatsAppBulkSendResultItem = {
  userId?: number
  nome?: string
  telefone?: string
  ok: boolean
  skipped?: boolean
  reason?: string
  error?: string
}

export type WhatsAppBulkSendResult = {
  total: number
  sent: number
  skipped: number
  failed: number
  items: WhatsAppBulkSendResultItem[]
  referenceDate?: string
  courseId?: number
  courseTitle?: string
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
  operadorId: number | null
  operadorNome: string
  operadorTelefone: string
}

export type EquipamentoPayload = {
  nome: string
  computadorGeo: string
  modalidadeId: number | null
  status?: 'ativo' | 'inativo'
  imei?: string
  obraNumero?: string
  operadorId?: number | null
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

export type ObraArquivo = {
  nome: string
  tipo: string
  tamanho: number | null
}

export type ObraFoto = ObraArquivo & {
  url: string
  titulo: string
  dataFoto: string
  criadoEm: string
}

export type ObraDetail = {
  id?: number
  numero: string
  clienteId: number | null
  responsibleOperatorUserId: number | null
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
  modalidadeContratual: string
  faturamentoMinimoDiarioGlobal: number | null
  diasIncidenciaFatMinimo: string
  modalidadeFatMinimo: string
  acrescimoTransporteNoturno: number | null
  responsavelIcamento: 'cliente' | 'gontijo'
  valorIcamento: number | null
  incideSeguro: boolean
  valorSeguro: number | null
  necessidadeIntegracao: string
  valorIntegracao: number | null
  documentacaoEspecifica: string
  valorDocumentacao: number | null
  mobilizacaoInterna: string
  valorMobilizacaoInterna: number | null
  responsavelLimpezaTrado: 'cliente' | 'gontijo'
  valorLimpezaTrado: number | null
  responsavelHospedagem: 'cliente' | 'gontijo'
  valorHospedagem: number | null
  responsavelCafeManha: 'cliente' | 'gontijo'
  valorCafeManha: number | null
  responsavelAlmoco: 'cliente' | 'gontijo'
  valorAlmoco: number | null
  responsavelJantar: 'cliente' | 'gontijo'
  valorJantar: number | null
  responsavelFornecimentoDiesel: 'cliente' | 'gontijo'
  responsavelCusteioDiesel: 'cliente' | 'gontijo'
  razaoSocialFaturamento: string
  tipoDocumentoFaturamento: 'cpf' | 'cnpj'
  documentoFaturamento: string
  inscricaoMunicipal: string
  issqnPct: number | null
  issqnRetidoFonte: boolean
  modalidadeFaturamento: string
  informarCeiCnoGuia: boolean
  ceiCno: string
  cartaoCeiCno: ObraArquivo | null
  enderecoFaturamentoMesmoCliente: boolean
  faturamentoEstado: string
  faturamentoCidade: string
  faturamentoCep: string
  faturamentoLogradouro: string
  faturamentoBairro: string
  faturamentoNumero: string
  faturamentoComplemento: string
  projetosArquivos: ObraArquivo[]
  sondagensArquivos: ObraArquivo[]
  fotosObra: ObraFoto[]
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
  criadoEm: string
  enviadoEm: string
  assinadoEm: string
  obraNumero: string
  cliente: string
  equipamento: string
  conferenciaStatus?: 'pendente' | 'aprovado' | 'rejeitado'
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
  enviadoEm?: string
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

export type HelperEvaluationRecord = {
  id: number
  diaryId: number
  diaryDate: string
  score: number
  helperUserId: number | null
  helperName: string
  operatorUserId: number | null
  operatorName: string
  constructionId: number | null
  obraNumero: string
  cliente: string
  equipamento: string
  createdAt: string
}

export type HelperEvaluationFilters = {
  page?: number
  limit?: number
  dataInicio?: string
  dataFim?: string
  nome?: string
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

function formatConstructionType(value: unknown): string {
  const text = toStringValue(value).trim()
  return text.toLowerCase() === 'f' ? 'Fundação' : text
}

function toFileValue(value: unknown): ObraArquivo | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  const nome = toStringValue(row.nome || row.name)
  if (!nome) return null
  return {
    nome,
    tipo: toStringValue(row.tipo || row.type),
    tamanho: toNumberValue(row.tamanho || row.size),
  }
}

function toFileListValue(value: unknown): ObraArquivo[] {
  return Array.isArray(value) ? value.map((item) => toFileValue(item)).filter((item): item is ObraArquivo => Boolean(item)) : []
}

function toPhotoValue(value: unknown): ObraFoto | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  const url = toStringValue(row.url || row.src || row.image || row.imagem)
  if (!url) return null
  return {
    nome: toStringValue(row.nome || row.name || row.titulo || row.title || 'Foto da obra'),
    tipo: toStringValue(row.tipo || row.type || 'image/jpeg'),
    tamanho: toNumberValue(row.tamanho || row.size),
    url,
    titulo: toStringValue(row.titulo || row.title || row.nome || row.name || 'Foto da obra'),
    dataFoto: toDateOnly(row.dataFoto || row.data_foto || row.photoDate || row.photo_date || row.date || row.data || row.criadoEm || row.criado_em || row.createdAt || row.created_at),
    criadoEm: toStringValue(row.criadoEm || row.criado_em || row.createdAt || row.created_at),
  }
}

function toPhotoListValue(value: unknown): ObraFoto[] {
  return Array.isArray(value) ? value.map((item) => toPhotoValue(item)).filter((item): item is ObraFoto => Boolean(item)) : []
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
    operadorId: toNumberValue(row.operador_id),
    operadorNome: toStringValue(row.operador_nome),
    operadorTelefone: toStringValue(row.operador_telefone),
  }
}

function adaptObraResumo(row: Record<string, unknown>): ObraResumo {
  return {
    id: Number(row.id),
    numero: toStringValue(row.numero),
    status: (toStringValue(row.status) || 'em andamento') as ObraResumo['status'],
    tipoObra: formatConstructionType(row.tipo_obra),
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
    responsibleOperatorUserId: toNumberValue(row.responsible_operator_user_id),
    status: (toStringValue(row.status) || 'em andamento') as ObraDetail['status'],
    empresaResponsavel: toStringValue(row.empresa_responsavel),
    tipoObra: formatConstructionType(row.tipo_obra),
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
    modalidadeContratual: toStringValue(row.modalidade_contratual),
    faturamentoMinimoDiarioGlobal: toNumberValue(row.faturamento_minimo_diario_global),
    diasIncidenciaFatMinimo: toStringValue(row.dias_incidencia_fat_minimo),
    modalidadeFatMinimo: toStringValue(row.modalidade_fat_minimo),
    acrescimoTransporteNoturno: toNumberValue(row.acrescimo_transporte_noturno),
    responsavelIcamento: toStringValue(row.responsavel_icamento) === 'cliente' ? 'cliente' : 'gontijo',
    valorIcamento: toNumberValue(row.valor_icamento),
    incideSeguro: toBooleanValue(row.incide_seguro),
    valorSeguro: toNumberValue(row.valor_seguro),
    necessidadeIntegracao: toStringValue(row.necessidade_integracao),
    valorIntegracao: toNumberValue(row.valor_integracao),
    documentacaoEspecifica: toStringValue(row.documentacao_especifica),
    valorDocumentacao: toNumberValue(row.valor_documentacao),
    mobilizacaoInterna: toStringValue(row.mobilizacao_interna),
    valorMobilizacaoInterna: toNumberValue(row.valor_mobilizacao_interna),
    responsavelLimpezaTrado: toStringValue(row.responsavel_limpeza_trado) === 'gontijo' ? 'gontijo' : 'cliente',
    valorLimpezaTrado: toNumberValue(row.valor_limpeza_trado),
    responsavelHospedagem: toStringValue(row.responsavel_hospedagem) === 'gontijo' ? 'gontijo' : 'cliente',
    valorHospedagem: toNumberValue(row.valor_hospedagem),
    responsavelCafeManha: toStringValue(row.responsavel_cafe_manha) === 'gontijo' ? 'gontijo' : 'cliente',
    valorCafeManha: toNumberValue(row.valor_cafe_manha),
    responsavelAlmoco: toStringValue(row.responsavel_almoco) === 'gontijo' ? 'gontijo' : 'cliente',
    valorAlmoco: toNumberValue(row.valor_almoco),
    responsavelJantar: toStringValue(row.responsavel_jantar) === 'gontijo' ? 'gontijo' : 'cliente',
    valorJantar: toNumberValue(row.valor_jantar),
    responsavelFornecimentoDiesel: toStringValue(row.responsavel_fornecimento_diesel) === 'gontijo' ? 'gontijo' : 'cliente',
    responsavelCusteioDiesel: toStringValue(row.responsavel_custeio_diesel) === 'gontijo' ? 'gontijo' : 'cliente',
    razaoSocialFaturamento: toStringValue(row.razao_social_faturamento),
    tipoDocumentoFaturamento: toStringValue(row.tipo_documento_faturamento) === 'cpf' ? 'cpf' : 'cnpj',
    documentoFaturamento: toStringValue(row.documento_faturamento),
    inscricaoMunicipal: toStringValue(row.inscricao_municipal),
    issqnPct: toNumberValue(row.issqn_pct),
    issqnRetidoFonte: toBooleanValue(row.issqn_retido_fonte),
    modalidadeFaturamento: toStringValue(row.modalidade_faturamento),
    informarCeiCnoGuia: toBooleanValue(row.informar_cei_cno_guia),
    ceiCno: toStringValue(row.cei_cno),
    cartaoCeiCno: toFileValue(row.cartao_cei_cno),
    enderecoFaturamentoMesmoCliente: toBooleanValue(row.endereco_faturamento_mesmo_cliente),
    faturamentoEstado: toStringValue(row.faturamento_estado),
    faturamentoCidade: toStringValue(row.faturamento_cidade),
    faturamentoCep: toStringValue(row.faturamento_cep),
    faturamentoLogradouro: toStringValue(row.faturamento_logradouro),
    faturamentoBairro: toStringValue(row.faturamento_bairro),
    faturamentoNumero: toStringValue(row.faturamento_numero),
    faturamentoComplemento: toStringValue(row.faturamento_complemento),
    projetosArquivos: toFileListValue(row.projetos_arquivos),
    sondagensArquivos: toFileListValue(row.sondagens_arquivos),
    fotosObra: toPhotoListValue(row.fotos_obra),
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
    criadoEm: toStringValue(row.criado_em),
    enviadoEm: toStringValue(row.enviado_em),
    assinadoEm: toStringValue(row.assinado_em),
    obraNumero: toStringValue(row.obra_numero),
    cliente: toStringValue(row.cliente),
    equipamento: toStringValue(row.equipamento),
    conferenciaStatus: (toStringValue(row.conferencia_status) || undefined) as DiarioRecord['conferenciaStatus'],
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
    responsible_operator_user_id: payload.responsibleOperatorUserId,
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
    modalidade_contratual: payload.modalidadeContratual,
    faturamento_minimo_diario_global: payload.faturamentoMinimoDiarioGlobal,
    dias_incidencia_fat_minimo: payload.diasIncidenciaFatMinimo,
    modalidade_fat_minimo: payload.modalidadeFatMinimo,
    acrescimo_transporte_noturno: payload.acrescimoTransporteNoturno,
    responsavel_icamento: payload.responsavelIcamento,
    valor_icamento: payload.valorIcamento,
    incide_seguro: payload.incideSeguro,
    valor_seguro: payload.valorSeguro,
    necessidade_integracao: payload.necessidadeIntegracao,
    valor_integracao: payload.valorIntegracao,
    documentacao_especifica: payload.documentacaoEspecifica,
    valor_documentacao: payload.valorDocumentacao,
    mobilizacao_interna: payload.mobilizacaoInterna,
    valor_mobilizacao_interna: payload.valorMobilizacaoInterna,
    responsavel_limpeza_trado: payload.responsavelLimpezaTrado,
    valor_limpeza_trado: payload.valorLimpezaTrado,
    responsavel_hospedagem: payload.responsavelHospedagem,
    valor_hospedagem: payload.valorHospedagem,
    responsavel_cafe_manha: payload.responsavelCafeManha,
    valor_cafe_manha: payload.valorCafeManha,
    responsavel_almoco: payload.responsavelAlmoco,
    valor_almoco: payload.valorAlmoco,
    responsavel_jantar: payload.responsavelJantar,
    valor_jantar: payload.valorJantar,
    responsavel_fornecimento_diesel: payload.responsavelFornecimentoDiesel,
    responsavel_custeio_diesel: payload.responsavelCusteioDiesel,
    razao_social_faturamento: payload.razaoSocialFaturamento,
    tipo_documento_faturamento: payload.tipoDocumentoFaturamento,
    documento_faturamento: payload.documentoFaturamento,
    inscricao_municipal: payload.inscricaoMunicipal,
    issqn_pct: payload.issqnPct,
    issqn_retido_fonte: payload.issqnRetidoFonte,
    modalidade_faturamento: payload.modalidadeFaturamento,
    informar_cei_cno_guia: payload.informarCeiCnoGuia,
    cei_cno: payload.ceiCno,
    cartao_cei_cno: payload.cartaoCeiCno,
    endereco_faturamento_mesmo_cliente: payload.enderecoFaturamentoMesmoCliente,
    faturamento_estado: payload.faturamentoEstado,
    faturamento_cidade: payload.faturamentoCidade,
    faturamento_cep: payload.faturamentoCep,
    faturamento_logradouro: payload.faturamentoLogradouro,
    faturamento_bairro: payload.faturamentoBairro,
    faturamento_numero: payload.faturamentoNumero,
    faturamento_complemento: payload.faturamentoComplemento,
    projetos_arquivos: payload.projetosArquivos,
    sondagens_arquivos: payload.sondagensArquivos,
    fotos_obra: payload.fotosObra,
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

export function isNetworkError(error: unknown): boolean {
  if (error instanceof AxiosError) {
    return (
      !error.response &&
      (error.code === 'ERR_NETWORK' ||
        error.code === 'ECONNABORTED' ||
        error.message === 'Network Error' ||
        error.message?.toLowerCase().includes('network') ||
        error.message?.toLowerCase().includes('failed to fetch'))
    )
  }
  if (error instanceof TypeError) {
    return error.message?.toLowerCase().includes('failed to fetch') ||
      error.message?.toLowerCase().includes('network')
  }
  return !navigator.onLine
}

export function extractApiErrorMessage(error: unknown) {
  if (isNetworkError(error)) {
    return 'Sem conexão com a internet. Verifique sua rede e tente novamente.'
  }

  if (error instanceof AxiosError) {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return 'A conexão demorou demais para responder. Verifique sua rede e tente novamente.'
    }

    return (
      (error.response?.data as { error?: string; message?: string } | undefined)?.error ||
      (error.response?.data as { error?: string; message?: string } | undefined)?.message ||
      error.message ||
      'Não foi possível completar a operação.'
    )
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Não foi possível completar a operação.'
}

export const dashboardService = {
  async overview(): Promise<DashboardOverview> {
    const { data } = await api.get<ApiEnvelope<Record<string, unknown>>>('/gontijo/dashboard/overview')
    const payload = data.data

    return {
      stats: {
        obrasAndamento: Number((payload.stats as Record<string, unknown>).obras_andamento),
        maquinasAtivas: Number((payload.stats as Record<string, unknown>).maquinas_ativas),
        diariosConcluidos: Number((payload.stats as Record<string, unknown>).diarios_concluidos),
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
  async remove(id: number) {
    await api.delete(`/gontijo/usuarios/${id}`)
  },
  async listOptions() {
    const result = await usuarioService.list({ status: 'ativo', page: 1, limit: 500 })
    return result.items.map((item) => ({ id: item.id, nome: item.nome }))
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

export const setorService = {
  async list(): Promise<SetorOption[]> {
    const { data } = await api.get<ApiEnvelope<Record<string, unknown>[]>>('/gontijo/setores')
    return Array.isArray(data.data)
      ? data.data.map((row) => ({
          id: Number(row.id || 0),
          nome: toStringValue(row.nome),
        }))
      : []
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
      operador_id: payload.operadorId,
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
      operador_id: payload.operadorId,
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
  async updateFotos(id: number, fotos: ObraFoto[]) {
    const { data } = await api.patch<ApiEnvelope<Record<string, unknown>>>(`/gontijo/obras/${id}/fotos`, {
      fotos_obra: fotos,
    })
    const payload = data.data || {}
    return toPhotoListValue(payload.fotos_obra)
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

export const helperEvaluationService = {
  async list(filters: HelperEvaluationFilters = {}) {
    const { data } = await api.get<ApiEnvelope<Record<string, unknown>[]>>('/gontijo/avaliacoes-ajudantes', {
      params: {
        page: filters.page ?? 1,
        limit: filters.limit ?? 20,
        dataInicio: filters.dataInicio || undefined,
        dataFim: filters.dataFim || undefined,
        nome: filters.nome || undefined,
      },
    })

    const payload = listResult(data)
    return {
      ...payload,
      items: payload.items.map((row) => ({
        id: Number((row as Record<string, unknown>).id || 0),
        diaryId: Number((row as Record<string, unknown>).diary_id || 0),
        diaryDate: toDateOnly((row as Record<string, unknown>).diary_date),
        score: Number((row as Record<string, unknown>).score || 0),
        helperUserId: toNumberValue((row as Record<string, unknown>).helper_user_id),
        helperName: toStringValue((row as Record<string, unknown>).helper_name),
        operatorUserId: toNumberValue((row as Record<string, unknown>).operator_user_id),
        operatorName: toStringValue((row as Record<string, unknown>).operator_name),
        constructionId: toNumberValue((row as Record<string, unknown>).construction_id),
        obraNumero: toStringValue((row as Record<string, unknown>).obra_numero),
        cliente: toStringValue((row as Record<string, unknown>).cliente),
        equipamento: toStringValue((row as Record<string, unknown>).equipamento),
        createdAt: toStringValue((row as Record<string, unknown>).created_at),
      })),
    }
  },

  getExportUrl(filters: HelperEvaluationFilters = {}) {
    const params = new URLSearchParams()
    if (filters.dataInicio) params.set('dataInicio', filters.dataInicio)
    if (filters.dataFim) params.set('dataFim', filters.dataFim)
    if (filters.nome) params.set('nome', filters.nome)
    const query = params.toString()
    return `/api/gontijo/avaliacoes-ajudantes/export${query ? `?${query}` : ''}`
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
    tipoObra: formatConstructionType(row.construction_type || row.tipoObra),
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
  async delete(id: number) {
    await api.delete(`/admin/client-portals/${id}`)
  },
}

export const solidesPointService = {
  async getStatus(): Promise<SolidesIntegrationStatus> {
    const { data } = await api.get<ApiEnvelope<Record<string, unknown>>>('/admin/solides/status')
    const payload = data.data || {}
    return {
      tokenConfigured: toBooleanValue(payload.tokenConfigured),
      accountName: toStringValue(payload.accountName),
      employeesEnabled: toBooleanValue(payload.employeesEnabled),
      punchEnabled: toBooleanValue(payload.punchEnabled),
      employeesCount: Number(payload.employeesCount || 0),
      message: toStringValue(payload.message),
    }
  },
  async checkDaily(params: SolidesPointCheckParams): Promise<SolidesPointCheckResult> {
    const { data } = await api.get<ApiEnvelope<Record<string, unknown>>>('/admin/solides/daily-point-check', {
      params: {
        date: params.date,
        sector_id: params.sectorId || undefined,
        user_id: params.userId || undefined,
        only_active_users: params.onlyActiveUsers,
        require_closing_punch: params.requireClosingPunch,
        ignore_without_schedule: params.ignoreWithoutSchedule,
        show_fired: params.showFired,
        status_filter: params.statusFilter || undefined,
        entry_tolerance_minutes: params.entryToleranceMinutes,
        exit_tolerance_minutes: params.exitToleranceMinutes,
      },
    })
    const payload = (data.data || {}) as Record<string, unknown>
    return {
      date: toDateOnly(payload.date),
      params: {
        date: toDateOnly((payload.params as Record<string, unknown> | undefined)?.date || params.date),
        sectorId: toNumberValue((payload.params as Record<string, unknown> | undefined)?.sectorId),
        userId: toNumberValue((payload.params as Record<string, unknown> | undefined)?.userId),
        onlyActiveUsers: toBooleanValue((payload.params as Record<string, unknown> | undefined)?.onlyActiveUsers ?? params.onlyActiveUsers),
        requireClosingPunch: toBooleanValue((payload.params as Record<string, unknown> | undefined)?.requireClosingPunch ?? params.requireClosingPunch),
        ignoreWithoutSchedule: toBooleanValue((payload.params as Record<string, unknown> | undefined)?.ignoreWithoutSchedule ?? params.ignoreWithoutSchedule),
        showFired: toBooleanValue((payload.params as Record<string, unknown> | undefined)?.showFired ?? params.showFired),
        statusFilter: (toStringValue((payload.params as Record<string, unknown> | undefined)?.statusFilter) as SolidesPointCheckParams['statusFilter']) || '',
        entryToleranceMinutes: Number((payload.params as Record<string, unknown> | undefined)?.entryToleranceMinutes || params.entryToleranceMinutes),
        exitToleranceMinutes: Number((payload.params as Record<string, unknown> | undefined)?.exitToleranceMinutes || params.exitToleranceMinutes),
      },
      summary: {
        total: Number((payload.summary as Record<string, unknown> | undefined)?.total || 0),
        ok: Number((payload.summary as Record<string, unknown> | undefined)?.ok || 0),
        semVinculo: Number((payload.summary as Record<string, unknown> | undefined)?.semVinculo || 0),
        semPonto: Number((payload.summary as Record<string, unknown> | undefined)?.semPonto || 0),
        atencao: Number((payload.summary as Record<string, unknown> | undefined)?.atencao || 0),
        reprovado: Number((payload.summary as Record<string, unknown> | undefined)?.reprovado || 0),
      },
      items: Array.isArray(payload.items)
        ? payload.items.map((row) => {
            const item = row as Record<string, unknown>
            return {
              usuarioId: Number(item.usuarioId || 0),
              nome: toStringValue(item.nome),
              cpf: toStringValue(item.cpf),
              telefone: toStringValue(item.telefone),
              setor: toStringValue(item.setor),
              setorId: toNumberValue(item.setorId),
              ativo: toBooleanValue(item.ativo),
              solidesEmployeeId: toNumberValue(item.solidesEmployeeId),
              solidesExternalId: toStringValue(item.solidesExternalId),
              escalaNome: toStringValue(item.escalaNome),
              jornadaEsperadaInicio: toStringValue(item.jornadaEsperadaInicio),
              jornadaEsperadaFim: toStringValue(item.jornadaEsperadaFim),
              primeiraMarcacao: toStringValue(item.primeiraMarcacao),
              ultimaMarcacao: toStringValue(item.ultimaMarcacao),
              totalMarcacoes: Number(item.totalMarcacoes || 0),
              totalBatidas: Number(item.totalBatidas || 0),
              totalFotos: Number(item.totalFotos || 0),
              horasTrabalhadas: toStringValue(item.horasTrabalhadas),
              statusesSolides: Array.isArray(item.statusesSolides) ? item.statusesSolides.map((entry) => toStringValue(entry)) : [],
              status: toStringValue(item.status),
              statusLabel: toStringValue(item.statusLabel),
              statusTone: (toStringValue(item.statusTone) as SolidesPointCheckRecord['statusTone']) || 'slate',
              observacao: toStringValue(item.observacao),
            }
          })
        : [],
    }
  },
}

export const whatsappAdminService = {
  async getStatus(): Promise<WhatsAppIntegrationStatus> {
    const { data } = await api.get<ApiEnvelope<Record<string, unknown>>>('/admin/whatsapp/status')
    const payload = data.data || {}
    return {
      enabled: toBooleanValue(payload.enabled),
      configured: toBooleanValue(payload.configured),
      baseUrl: toStringValue(payload.baseUrl),
      instanceId: toStringValue(payload.instanceId),
      clientTokenConfigured: toBooleanValue(payload.clientTokenConfigured),
      timeoutMs: Number(payload.timeoutMs || 0),
      logsTableReady: toBooleanValue(payload.logsTableReady),
      responsibleColumnReady: toBooleanValue(payload.responsibleColumnReady),
      equipmentOperatorColumnReady: toBooleanValue(payload.equipmentOperatorColumnReady),
      schedulerEnabled: toBooleanValue(payload.schedulerEnabled),
      schedulerIntervalMinutes: Number(payload.schedulerIntervalMinutes || 0),
      schedulerRunning: toBooleanValue(payload.schedulerRunning),
      schedulerLastRunAt: toStringValue(payload.schedulerLastRunAt),
      schedulerLastError: toStringValue(payload.schedulerLastError),
      instance: {
        connected:
          (payload.instance as Record<string, unknown> | undefined)?.connected === true
            ? true
            : (payload.instance as Record<string, unknown> | undefined)?.connected === false
              ? false
              : null,
        status: toStringValue((payload.instance as Record<string, unknown> | undefined)?.status),
        endpoint: toStringValue((payload.instance as Record<string, unknown> | undefined)?.endpoint),
        error: toStringValue((payload.instance as Record<string, unknown> | undefined)?.error),
      },
    }
  },
  async getQrCode(): Promise<WhatsAppQrCode> {
    const { data } = await api.get<ApiEnvelope<Record<string, unknown>>>('/admin/whatsapp/qr-code')
    return {
      image: toStringValue((data.data || {}).image),
    }
  },
  async getDiaryOverduePreview(): Promise<{ total: number; sendable: number; items: WhatsAppDiaryOverdueItem[] }> {
    const { data } = await api.get<ApiEnvelope<Record<string, unknown>>>('/admin/whatsapp/diary-overdue-preview')
    const payload = data.data || {}
    return {
      total: Number(payload.total || 0),
      sendable: Number(payload.sendable || 0),
      items: Array.isArray(payload.items)
        ? (payload.items as Record<string, unknown>[]).map((item) => ({
            key: toStringValue(item.key),
            constructionId: Number(item.constructionId || 0),
            constructionNumber: toStringValue(item.constructionNumber),
            equipmentId: Number(item.equipmentId || 0),
            equipmentName: toStringValue(item.equipmentName),
            referenceDate: toDateOnly(item.referenceDate),
            dueAt: toStringValue(item.dueAt),
            responsibleOperatorUserId: toNumberValue(item.responsibleOperatorUserId),
            operatorName: toStringValue(item.operatorName),
            operatorPhone: toStringValue(item.operatorPhone),
            canSend: toBooleanValue(item.canSend),
            reason: toStringValue(item.reason),
          }))
        : [],
    }
  },
  async sendDiaryOverdueReminders(payload: { keys: string[]; messageText?: string }): Promise<WhatsAppBulkSendResult> {
    const { data } = await api.post<ApiEnvelope<Record<string, unknown>>>('/admin/whatsapp/diary-overdue-reminders', {
      keys: payload.keys,
      message_text: payload.messageText,
    })
    return {
      total: Number((data.data || {}).total || 0),
      sent: Number((data.data || {}).sent || 0),
      skipped: Number((data.data || {}).skipped || 0),
      failed: Number((data.data || {}).failed || 0),
      items: Array.isArray((data.data || {}).items)
        ? ((data.data || {}).items as Record<string, unknown>[]).map((item) => ({
            nome: toStringValue(item.operador) || undefined,
            telefone: toStringValue(item.telefone) || undefined,
            ok: toBooleanValue(item.ok),
            skipped: toBooleanValue(item.skipped),
            reason: toStringValue(item.reason) || undefined,
            error: toStringValue(item.error) || undefined,
          }))
        : [],
    }
  },
  async listLogs(params: { page?: number; limit?: number; eventType?: string; status?: string; dateFrom?: string; dateTo?: string; obra?: string; operator?: string; referenceDate?: string }) {
    const { data } = await api.get<ApiEnvelope<Record<string, unknown>[]>>('/admin/whatsapp/logs', {
      params: {
        page: params.page,
        limit: params.limit,
        event_type: params.eventType || undefined,
        status: params.status || undefined,
        date_from: params.dateFrom || undefined,
        date_to: params.dateTo || undefined,
        obra: params.obra || undefined,
        operator: params.operator || undefined,
        reference_date: params.referenceDate || undefined,
      },
    })
    const payload = listResult(data)
    const summary = ((data.summary as Record<string, unknown> | undefined) || {})
    const diaryDelays = ((summary.diaryDelays as Record<string, unknown> | undefined) || {})
    return {
      ...payload,
      diaryDelaySummary: {
        total: Number(diaryDelays.total || 0),
        sent: Number(diaryDelays.sent || 0),
        failed: Number(diaryDelays.failed || 0),
        skipped: Number(diaryDelays.skipped || 0),
        operators: Number(diaryDelays.operators || 0),
        constructions: Number(diaryDelays.constructions || 0),
        topOperators: Array.isArray(diaryDelays.topOperators)
          ? (diaryDelays.topOperators as Record<string, unknown>[]).map((item) => ({
              name: toStringValue(item.name),
              total: Number(item.total || 0),
              sent: Number(item.sent || 0),
              lastDelayAt: toStringValue(item.lastDelayAt),
            }))
          : [],
      } satisfies WhatsAppDiaryDelaySummary,
      items: payload.items.map((row) => ({
        id: Number((row as Record<string, unknown>).id || 0),
        eventType: toStringValue((row as Record<string, unknown>).eventType),
        eventLabel: toStringValue((row as Record<string, unknown>).eventLabel),
        historyText: toStringValue((row as Record<string, unknown>).historyText),
        status: (toStringValue((row as Record<string, unknown>).status) || 'queued') as WhatsAppLogRecord['status'],
        userId: toNumberValue((row as Record<string, unknown>).userId),
        userName: toStringValue((row as Record<string, unknown>).userName),
        phone: toStringValue((row as Record<string, unknown>).phone),
        constructionId: toNumberValue((row as Record<string, unknown>).constructionId),
        obraNumero: toStringValue((row as Record<string, unknown>).obraNumero),
        courseId: toNumberValue((row as Record<string, unknown>).courseId),
        courseTitle: toStringValue((row as Record<string, unknown>).courseTitle),
        referenceDate: toDateOnly((row as Record<string, unknown>).referenceDate),
        targetName: toStringValue((row as Record<string, unknown>).targetName),
        messageText: toStringValue((row as Record<string, unknown>).messageText),
        providerMessageId: toStringValue((row as Record<string, unknown>).providerMessageId),
        errorText: toStringValue((row as Record<string, unknown>).errorText),
        createdAt: toStringValue((row as Record<string, unknown>).createdAt),
        metadata: (((row as Record<string, unknown>).metadata as Record<string, unknown> | null) || {}),
      })),
    }
  },
  async sendPointReminders(payload: { date: string; userIds: number[]; messageText?: string }): Promise<WhatsAppBulkSendResult> {
    const { data } = await api.post<ApiEnvelope<Record<string, unknown>>>('/admin/whatsapp/point-reminders', {
      date: payload.date,
      user_ids: payload.userIds,
      message_text: payload.messageText,
    })
    return {
      referenceDate: toDateOnly((data.data || {}).referenceDate),
      total: Number((data.data || {}).total || 0),
      sent: Number((data.data || {}).sent || 0),
      skipped: Number((data.data || {}).skipped || 0),
      failed: Number((data.data || {}).failed || 0),
      items: Array.isArray((data.data || {}).items)
        ? ((data.data || {}).items as Record<string, unknown>[]).map((item) => ({
            userId: toNumberValue(item.userId) || undefined,
            nome: toStringValue(item.nome) || undefined,
            telefone: toStringValue(item.telefone) || undefined,
            ok: toBooleanValue(item.ok),
            skipped: toBooleanValue(item.skipped),
            reason: toStringValue(item.reason) || undefined,
            error: toStringValue(item.error) || undefined,
          }))
        : [],
    }
  },
  async sendCourseNotice(payload: { courseId: number; assignmentIds?: number[]; messageText?: string }): Promise<WhatsAppBulkSendResult> {
    const { data } = await api.post<ApiEnvelope<Record<string, unknown>>>(`/admin/whatsapp/courses/${payload.courseId}/notify`, {
      assignment_ids: payload.assignmentIds || [],
      message_text: payload.messageText || undefined,
    })
    return {
      courseId: Number((data.data || {}).courseId || 0),
      courseTitle: toStringValue((data.data || {}).courseTitle),
      total: Number((data.data || {}).total || 0),
      sent: Number((data.data || {}).sent || 0),
      skipped: Number((data.data || {}).skipped || 0),
      failed: Number((data.data || {}).failed || 0),
      items: Array.isArray((data.data || {}).items)
        ? ((data.data || {}).items as Record<string, unknown>[]).map((item) => ({
            userId: toNumberValue(item.userId) || undefined,
            nome: toStringValue(item.nome) || undefined,
            telefone: toStringValue(item.telefone) || undefined,
            ok: toBooleanValue(item.ok),
            skipped: toBooleanValue(item.skipped),
            reason: toStringValue(item.reason) || undefined,
            error: toStringValue(item.error) || undefined,
          }))
        : [],
    }
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
  concluido_sem_prova?: boolean
  curso_concluido_em?: string | null
  curso_concluido_pontos?: number
  prova_concluida_em?: string | null
  prova_concluida_pontos?: number
}

export type TrainingPointSettings = {
  id: number
  points_course_completion: number
  points_proof_approved: number
  points_proof_failed: number
  created_at: string | null
  updated_at: string | null
}

export type TrainingMonthlyRaffle = {
  id: number
  month_ref: string
  title: string
  description: string | null
  prize: string | null
  draw_date: string | null
  status: 'draft' | 'active' | 'closed'
  banner_label: string | null
  created_at: string | null
  updated_at: string | null
}

export type TrainingRankingRow = {
  usuario_id: number
  nome: string
  apelido: string | null
  documento: string
  setor_nome: string | null
  pontos: number
  eventos: number
}

export type TrainingAdminPayload = {
  month_ref: string
  settings: TrainingPointSettings
  raffle: TrainingMonthlyRaffle | null
  ranking: TrainingRankingRow[]
}

export type TrainingPointsOverview = {
  month_ref: string
  points: {
    month_points: number
    lifetime_points: number
    chances: number
  }
  settings: TrainingPointSettings
  raffle: TrainingMonthlyRaffle | null
  recent_events: Array<{
    id: number
    event_type: 'curso_concluido' | 'prova_aprovada' | 'prova_reprovada'
    points: number
    created_at: string
    curso_titulo: string | null
    prova_titulo: string | null
  }>
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
  getResultados: async (params?: { curso_id?: number; usuario_id?: number; busca?: string; status?: string; page?: number; limit?: number }) => {
    const q = new URLSearchParams()
    if (params?.curso_id) q.set('curso_id', String(params.curso_id))
    if (params?.usuario_id) q.set('usuario_id', String(params.usuario_id))
    if (params?.busca) q.set('busca', params.busca)
    if (params?.status) q.set('status', params.status)
    q.set('page', String(params?.page ?? 1))
    q.set('limit', String(params?.limit ?? 20))
    const res = await api.get<ApiEnvelope<null> & { items: TentativaRecord[]; total: number }>(`/gontijo/cursos/resultados?${q}`)
    return res.data
  },

  getResultadosMatriz: async (params?: { busca?: string; curso_id?: number; status?: string; page?: number; limit?: number }) => {
    const q = new URLSearchParams()
    if (params?.busca) q.set('busca', params.busca)
    if (params?.curso_id) q.set('curso_id', String(params.curso_id))
    if (params?.status) q.set('status', params.status)
    q.set('page', String(params?.page ?? 1))
    q.set('limit', String(params?.limit ?? 20))
    const res = await api.get<ApiEnvelope<ResultadoMatriz>>(`/gontijo/cursos/resultados/matriz?${q}`)
    return res.data.data
  },

  getPontosConfig: async (month?: string) => {
    const q = new URLSearchParams()
    if (month) q.set('month', month)
    const res = await api.get<ApiEnvelope<TrainingAdminPayload>>(`/gontijo/cursos/pontos/config?${q}`)
    return res.data.data
  },

  updatePontosConfig: async (payload: {
    month?: string
    points_course_completion: number
    points_proof_approved: number
    points_proof_failed: number
  }) => {
    const res = await api.put<ApiEnvelope<TrainingAdminPayload>>('/gontijo/cursos/pontos/config', payload)
    return res.data.data
  },

  updateSorteioAtual: async (payload: {
    month_ref: string
    title: string
    description?: string
    prize?: string
    draw_date?: string
    status: 'draft' | 'active' | 'closed'
    banner_label?: string
  }) => {
    const res = await api.put<ApiEnvelope<TrainingMonthlyRaffle>>('/gontijo/cursos/pontos/sorteio-atual', payload)
    return res.data.data
  },

  getRankingPontos: async (month?: string) => {
    const q = new URLSearchParams()
    if (month) q.set('month', month)
    const res = await api.get<ApiEnvelope<{ month_ref: string; items: TrainingRankingRow[] }>>(`/gontijo/cursos/pontos/ranking?${q}`)
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

  getPontos: async (month?: string) => {
    const q = new URLSearchParams()
    if (month) q.set('month', month)
    const res = await api.get<ApiEnvelope<TrainingPointsOverview>>(`/gontijo/operador/cursos/pontos?${q}`)
    return res.data.data
  },

  concluirCurso: async (id: number) => {
    const res = await api.post<ApiEnvelope<{
      awarded: boolean
      points: number
      totals: {
        month_points: number
        lifetime_points: number
        chances: number
      }
    }>>(`/gontijo/operador/cursos/${id}/concluir`)
    return res.data.data
  },

  getQuestoes: async (provaId: number) => {
    const res = await api.get<ApiEnvelope<ProvaRecord & { questoes: QuestaoRecord[] }>>(`/gontijo/operador/provas/${provaId}/questoes`)
    return res.data.data
  },

  submitTentativa: async (provaId: number, respostas: { questao_id: number; alternativa_id: number }[]) => {
    const res = await api.post<ApiEnvelope<{
      id: number; acertos: number; total_questoes: number;
      percentual: number; aprovado: boolean; percentual_aprovacao: number;
      points_awarded: number;
      totals: { month_points: number; lifetime_points: number; chances: number }
    }>>(`/gontijo/operador/provas/${provaId}/tentativa`, { respostas })
    return res.data.data
  },
}

// ── Conferência de Estacas ────────────────────────────────────────────────────

export type EstacaExecutada = {
  nome: string
  diametro: string | null
  profundidade: string | null
}

export type ProducaoPlanejada = {
  diametro: string
  profundidade: string
  qtd_estacas: number
}

export type ComparacaoDetalhe = {
  index: number
  estaca: string
  diametroExec: number | null
  diametroPlan?: number | null
  profExec: number | null
  profPlan?: number
  diferencaPct?: number
  ok: boolean
  motivo?: string
  conferenciaStatus?: 'pendente' | 'aprovado' | 'rejeitado'
  conferenciaObs?: string | null
  conferenciaPorNome?: string | null
  conferenciaEm?: string | null
}

export type AutoComparacao = {
  dentroTolerancia: boolean
  semEstacas?: boolean
  semProducao?: boolean
  detalhes: ComparacaoDetalhe[]
}

export type ConferenciaEstacaItem = {
  id: number
  obraId: number
  obraNumero: string
  cliente: string
  dataDiario: string
  equipamento: string
  operadorNome: string
  conferenciaStatus: 'pendente' | 'aprovado' | 'rejeitado'
  conferenciaEm: string | null
  conferenciaObs: string | null
  conferenciaPorNome: string | null
  estacas: EstacaExecutada[]
  producaoPlanejada: ProducaoPlanejada[]
  autoComparacao: AutoComparacao
}

export const conferenciaEstacasApi = {
  async list(params: { page?: number; limit?: number; conferencia_status?: string; obra_numero?: string }): Promise<ApiListResult<ConferenciaEstacaItem>> {
    const res = await api.get<ApiEnvelope<ConferenciaEstacaItem[]>>('/gontijo/conferencia-estacas', { params })
    return {
      items: res.data.data ?? [],
      total: res.data.total ?? 0,
      page: res.data.page ?? 1,
      limit: res.data.limit ?? 20,
    }
  },

  async aprovar(id: number, obs?: string): Promise<void> {
    await api.post(`/gontijo/conferencia-estacas/${id}/aprovar`, { obs })
  },

  async rejeitar(id: number, obs: string): Promise<void> {
    await api.post(`/gontijo/conferencia-estacas/${id}/rejeitar`, { obs })
  },

  async definirStatusEstaca(id: number, stakeIndex: number, status: 'aprovado' | 'rejeitado', obs?: string): Promise<void> {
    await api.post(`/gontijo/conferencia-estacas/${id}/estacas/${stakeIndex}/status`, { status, obs })
  },
}

// ── Fato Observado ────────────────────────────────────────────────────────────

export const operadorFatoObservadoApi = {
  async registrar(payload: { tipo: 'positivo' | 'negativo'; local_ref?: string; descricao: string }): Promise<void> {
    await api.post('/gontijo/operador/fatos-observados', payload)
  },
}

// ── Indicações de Obra ────────────────────────────────────────────────────────

export const operadorIndicacoesApi = {
  async indicar(payload: { contato_nome: string; contato_telefone?: string; endereco: string; tipo_servico?: string; observacoes?: string }): Promise<void> {
    await api.post('/gontijo/operador/indicacoes-obra', payload)
  },
}
