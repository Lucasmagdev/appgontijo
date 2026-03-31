import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import axios from 'axios'

const operadorApi = axios.create({ baseURL: '/api', withCredentials: true })

interface OperadorUser {
  id: number
  nome: string
  cpf: string
  perfil: string
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
    (set) => ({
      user: null,
      isAuthenticated: false,
      isReady: false,

      initialize: async () => {
        try {
          const { data } = await operadorApi.get('/operador/status')
          if (data?.authenticated && data.user) {
            set({ user: data.user, isAuthenticated: true, isReady: true })
            return
          }
        } catch {
          // network error — keep unauthenticated
        }
        set({ user: null, isAuthenticated: false, isReady: true })
      },

      login: async (cpf, senha) => {
        const { data } = await operadorApi.post('/operador/session', { cpf, senha })
        set({ user: data.user, isAuthenticated: true, isReady: true })
      },

      logout: async () => {
        try {
          await operadorApi.post('/operador/logout')
        } catch {
          // ignore
        }
        set({ user: null, isAuthenticated: false, isReady: true })
        window.location.href = '/operador/login'
      },
    }),
    { name: 'gontijo-operador-auth' }
  )
)
