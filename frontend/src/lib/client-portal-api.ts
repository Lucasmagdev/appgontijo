import axios from 'axios'

export const clientPortalApi = axios.create({
  baseURL: '/api',
  withCredentials: true,
})

clientPortalApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      window.location.href = '/portal-cliente/login'
    }
    return Promise.reject(error)
  }
)

export type ClientPortalUser = {
  accessId: number
  login: string
  obraNumero: string
  cliente: string
}

export type ClientPortalDiarySummary = {
  id: number
  dataDiario: string
  status: string
  assinadoEm: string
  equipamento: string
  operadorNome: string
  estacasNoDia: number
  clima: string
  ocorrencias: {
    descricao: string
    inicio: string
    fim: string
  }[]
  fotos: ClientPortalPhoto[]
  reviewConfirmed: boolean
  pdfUrl: string
}

export type ClientPortalProgressRow = {
  diametro: string
  profundidade: number
  previstas: number
  executadas: number
  restantes: number
  percentual: number
  subtotal: number
}

export type ClientPortalPhoto = {
  url: string
  titulo: string
  dataDiario: string
  dataFoto: string
  diarioId: number
}

export type ClientPortalTimelineItem = {
  id: string
  data: string
  tipo: string
  titulo: string
  descricao: string
  detalhe: string
  pdfUrl: string
}

export type ClientPortalDashboard = {
  obra: {
    id: number
    numero: string
    cliente: string
    tipo: string
    cidade: string
    estado: string
    endereco: string
    status: string
  }
  resumo: {
    totalDiarios: number
    estacasExecutadas: number
    estacasPlanejadas: number
    estacasRestantes: number
    percentualConcluido: number
    diasTrabalhados: number
    diasSemProducao: number
    mediaDiaria: number
    ultimaAtualizacao: string
  }
  progressoPorDiametro: ClientPortalProgressRow[]
  fotos: ClientPortalPhoto[]
  timeline: ClientPortalTimelineItem[]
  diarios: ClientPortalDiarySummary[]
}

function toStringValue(value: unknown) {
  return value == null ? '' : String(value)
}

function toNumberValue(value: unknown) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

function formatConstructionType(value: unknown) {
  const text = toStringValue(value).trim()
  return text.toLowerCase() === 'f' ? 'Fundação' : text
}

function adaptClientPortalUser(row: Record<string, unknown>): ClientPortalUser {
  return {
    accessId: toNumberValue(row.accessId || row.access_id || row.id),
    login: toStringValue(row.login),
    obraNumero: toStringValue(row.obraNumero || row.obra_numero),
    cliente: toStringValue(row.cliente || row.client_name),
  }
}

function adaptDashboard(row: Record<string, unknown>): ClientPortalDashboard {
  const obra = (row.obra as Record<string, unknown> | undefined) || {}
  const resumo = (row.resumo as Record<string, unknown> | undefined) || {}
  const diarios = Array.isArray(row.diarios) ? row.diarios : []
  const progressoPorDiametro = Array.isArray(row.progressoPorDiametro) ? row.progressoPorDiametro : []
  const fotos = Array.isArray(row.fotos) ? row.fotos : []
  const timeline = Array.isArray(row.timeline) ? row.timeline : []

  return {
    obra: {
      id: toNumberValue(obra.id),
      numero: toStringValue(obra.numero),
      cliente: toStringValue(obra.cliente),
      tipo: formatConstructionType(obra.tipo),
      cidade: toStringValue(obra.cidade),
      estado: toStringValue(obra.estado),
      endereco: toStringValue(obra.endereco),
      status: toStringValue(obra.status),
    },
    resumo: {
      totalDiarios: toNumberValue(resumo.totalDiarios),
      estacasExecutadas: toNumberValue(resumo.estacasExecutadas),
      estacasPlanejadas: toNumberValue(resumo.estacasPlanejadas),
      estacasRestantes: toNumberValue(resumo.estacasRestantes),
      percentualConcluido: toNumberValue(resumo.percentualConcluido),
      diasTrabalhados: toNumberValue(resumo.diasTrabalhados),
      diasSemProducao: toNumberValue(resumo.diasSemProducao),
      mediaDiaria: toNumberValue(resumo.mediaDiaria),
      ultimaAtualizacao: toStringValue(resumo.ultimaAtualizacao),
    },
    progressoPorDiametro: progressoPorDiametro.map((item) => {
      const rowItem = item as Record<string, unknown>
      return {
        diametro: toStringValue(rowItem.diametro),
        profundidade: toNumberValue(rowItem.profundidade),
        previstas: toNumberValue(rowItem.previstas),
        executadas: toNumberValue(rowItem.executadas),
        restantes: toNumberValue(rowItem.restantes),
        percentual: toNumberValue(rowItem.percentual),
        subtotal: toNumberValue(rowItem.subtotal),
      }
    }),
    fotos: fotos.map((item) => {
      const rowItem = item as Record<string, unknown>
      return {
        url: toStringValue(rowItem.url),
        titulo: toStringValue(rowItem.titulo),
        dataDiario: toStringValue(rowItem.dataDiario),
        dataFoto: toStringValue(rowItem.dataFoto || rowItem.data_foto || rowItem.dataDiario),
        diarioId: toNumberValue(rowItem.diarioId),
      }
    }),
    timeline: timeline.map((item) => {
      const rowItem = item as Record<string, unknown>
      return {
        id: toStringValue(rowItem.id),
        data: toStringValue(rowItem.data),
        tipo: toStringValue(rowItem.tipo),
        titulo: toStringValue(rowItem.titulo),
        descricao: toStringValue(rowItem.descricao),
        detalhe: toStringValue(rowItem.detalhe),
        pdfUrl: toStringValue(rowItem.pdfUrl),
      }
    }),
    diarios: diarios.map((item) => {
      const rowItem = item as Record<string, unknown>
      const ocorrencias = Array.isArray(rowItem.ocorrencias) ? rowItem.ocorrencias : []
      const itemFotos = Array.isArray(rowItem.fotos) ? rowItem.fotos : []
      return {
        id: toNumberValue(rowItem.id),
        dataDiario: toStringValue(rowItem.dataDiario),
        status: toStringValue(rowItem.status),
        assinadoEm: toStringValue(rowItem.assinadoEm),
        equipamento: toStringValue(rowItem.equipamento),
        operadorNome: toStringValue(rowItem.operadorNome),
        estacasNoDia: toNumberValue(rowItem.estacasNoDia),
        clima: toStringValue(rowItem.clima),
        ocorrencias: ocorrencias.map((occurrence) => {
          const occurrenceRow = occurrence as Record<string, unknown>
          return {
            descricao: toStringValue(occurrenceRow.descricao),
            inicio: toStringValue(occurrenceRow.inicio),
            fim: toStringValue(occurrenceRow.fim),
          }
        }),
        fotos: itemFotos.map((photo) => {
          const photoRow = photo as Record<string, unknown>
          return {
            url: toStringValue(photoRow.url),
            titulo: toStringValue(photoRow.titulo),
            dataDiario: toStringValue(photoRow.dataDiario),
            dataFoto: toStringValue(photoRow.dataFoto || photoRow.data_foto || photoRow.dataDiario),
            diarioId: toNumberValue(photoRow.diarioId),
          }
        }),
        reviewConfirmed: Boolean(rowItem.reviewConfirmed),
        pdfUrl: toStringValue(rowItem.pdfUrl),
      }
    }),
  }
}

export const clientPortalService = {
  async login(login: string, password: string) {
    const { data } = await clientPortalApi.post<{ ok: boolean; user: Record<string, unknown> }>('/client-portal/session', {
      login,
      password,
    })
    return adaptClientPortalUser(data.user || {})
  },
  async logout() {
    await clientPortalApi.post('/client-portal/logout')
  },
  async status() {
    const { data } = await clientPortalApi.get<{ ok: boolean; authenticated: boolean; user?: Record<string, unknown> }>('/client-portal/status')
    return {
      authenticated: Boolean(data.authenticated),
      user: data.user ? adaptClientPortalUser(data.user) : null,
    }
  },
  async getDashboard() {
    const { data } = await clientPortalApi.get<{ ok: boolean; data: Record<string, unknown> }>('/client-portal/dashboard')
    return adaptDashboard(data.data || {})
  },
}
