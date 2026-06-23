import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import axios from 'axios'
import { API_BASE_URL } from '@/lib/api'

// timeout obrigatorio: sem ele, uma VPS lenta/instavel faz o GET /operador/status
// pendurar pra sempre, isReady nunca vira true e a tela fica em branco ("abriu,
// demorou, fechou"). 12s e suficiente ate em rede movel ruim.
const operadorApi = axios.create({ baseURL: API_BASE_URL, withCredentials: true, timeout: 12000 })
let operadorAuthRevision = 0

interface OperadorUser {
  id: number
  nome: string
  perfil: string
  podeGerarLinkAssinatura?: boolean
}

interface OperadorAuthState {
  user: OperadorUser | null
  isAuthenticated: boolean
  isReady: boolean
  initialize: () => Promise<void>
  login: (cpf: string, senha: string) => Promise<void>
  logout: () => Promise<void>
}

export const useOperadorAuth = create<OperadorAuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isReady: false,

      initialize: async () => {
        const revisionAtStart = operadorAuthRevision
        // Render otimista: se ja existe sessao persistida (rehidratada do
        // localStorage), libera a UI na hora e valida em segundo plano. Isso
        // garante que a tela NUNCA fica em branco esperando a rede no boot.
        if (get().isAuthenticated && get().user) {
          set({ isReady: true })
        }
        try {
          const { data } = await operadorApi.get('/operador/status')
          if (revisionAtStart !== operadorAuthRevision) return
          if (data?.authenticated && data.user) {
            // Sessão válida confirmada pelo servidor.
            set({ user: data.user, isAuthenticated: true, isReady: true })
            return
          }
          // Servidor respondeu OK e disse, explicitamente, que NÃO está
          // autenticado (cookie ausente/expirado) → limpar de fato.
          set({ user: null, isAuthenticated: false, isReady: true })
        } catch (error) {
          if (revisionAtStart !== operadorAuthRevision) return
          const status = axios.isAxiosError(error) ? error.response?.status : undefined
          if (status === 401 || status === 403) {
            // Servidor rejeitou a sessão de forma explícita → limpar.
            set({ user: null, isAuthenticated: false, isReady: true })
            return
          }
          // Falha transitória (offline, timeout, 5xx, instabilidade do banco).
          // NÃO deslogar o operador: preservar a sessão persistida e apenas
          // liberar a UI. Isso evita o chute crônico pro login no campo.
          set({ isReady: true })
        }
      },

      login: async (cpf, senha) => {
        const { data } = await operadorApi.post('/operador/session', { cpf, senha })
        operadorAuthRevision += 1
        set({ user: data.user, isAuthenticated: true, isReady: true })
      },

      logout: async () => {
        operadorAuthRevision += 1
        try {
          await operadorApi.post('/operador/logout')
        } catch {
          // ignore
        }
        set({ user: null, isAuthenticated: false, isReady: true })
        window.location.href = '/operador/login'
      },
    }),
    {
      name: 'gontijo-operador-auth',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
)
