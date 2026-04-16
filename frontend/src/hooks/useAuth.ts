import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api } from '@/lib/api'

interface User {
  id: number
  name: string
  login: string
  role: string
  cpf?: string
  isAdmin?: boolean
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isReady: boolean
  initialize: () => Promise<void>
  login: (cpf: string, password: string, remember: boolean) => Promise<void>
  logout: () => Promise<void>
  setUser: (user: User) => void
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isReady: false,
      initialize: async () => {
        try {
          const { data } = await api.get('/admin/status')

          if (data?.authenticated) {
            const serverUser = data.user
            const stored = get().user
            set({
              user: {
                id: serverUser?.id ?? stored?.id ?? 1,
                name: stored?.name ?? 'Usuario',
                login: serverUser?.cpf ?? stored?.login ?? '',
                role: serverUser?.isAdmin ? 'admin' : 'operador',
                cpf: serverUser?.cpf ?? stored?.cpf,
                isAdmin: serverUser?.isAdmin ?? false,
              },
              isAuthenticated: true,
              isReady: true,
            })
            return
          }
        } catch {
          return undefined
        }

        set({ user: null, isAuthenticated: false, isReady: true })
      },
      login: async (cpf, password, remember) => {
        const { data } = await api.post('/admin/session', { cpf, password, remember })
        const u = data.user
        set({
          user: {
            id: u?.id ?? 1,
            name: u?.nome ?? cpf,
            login: cpf,
            role: u?.isAdmin ? 'admin' : 'operador',
            cpf: u?.cpf ?? cpf,
            isAdmin: u?.isAdmin ?? false,
          },
          isAuthenticated: true,
          isReady: true,
        })
      },
      logout: async () => {
        await api.post('/admin/logout')
        set({ user: null, isAuthenticated: false, isReady: true })
        window.location.href = '/login'
      },
      setUser: (user) => set({ user, isAuthenticated: true, isReady: true }),
    }),
    { name: 'gontijo-auth' }
  )
)
