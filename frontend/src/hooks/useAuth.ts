import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api } from '@/lib/api'

interface User {
  id: number
  name: string
  login: string
  role: string
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isReady: boolean
  initialize: () => Promise<void>
  login: (login: string, password: string, remember: boolean) => Promise<void>
  logout: () => Promise<void>
  setUser: (user: User) => void
}

function buildMockUser(loginValue: string, user?: Partial<User> | null): User {
  if (user?.id && user.name && user.login && user.role) {
    return user as User
  }

  const normalizedLogin = loginValue.trim() || 'admin'
  const displayName =
    user?.name ||
    normalizedLogin
      .split(/[.@\s_-]+/)
      .filter(Boolean)
      .map((part) => part[0]?.toUpperCase() + part.slice(1))
      .join(' ') ||
    'Administrador'

  return {
    id: user?.id ?? 1,
    name: displayName,
    login: user?.login ?? normalizedLogin,
    role: user?.role ?? 'admin',
  }
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
            set({
              user: buildMockUser(get().user?.login ?? 'admin', get().user),
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
      login: async (login, password, remember) => {
        const { data } = await api.post('/admin/session', { login, password, remember })
        set({
          user: buildMockUser(login, data.user),
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
