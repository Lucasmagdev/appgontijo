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
  reviewConfirmed: boolean
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
  }
  diarios: ClientPortalDiarySummary[]
}

function toStringValue(value: unknown) {
  return value == null ? '' : String(value)
}

function toNumberValue(value: unknown) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : 0
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

  return {
    obra: {
      id: toNumberValue(obra.id),
      numero: toStringValue(obra.numero),
      cliente: toStringValue(obra.cliente),
      tipo: toStringValue(obra.tipo),
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
    },
    diarios: diarios.map((item) => {
      const rowItem = item as Record<string, unknown>
      return {
        id: toNumberValue(rowItem.id),
        dataDiario: toStringValue(rowItem.dataDiario),
        status: toStringValue(rowItem.status),
        assinadoEm: toStringValue(rowItem.assinadoEm),
        equipamento: toStringValue(rowItem.equipamento),
        operadorNome: toStringValue(rowItem.operadorNome),
        estacasNoDia: toNumberValue(rowItem.estacasNoDia),
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
