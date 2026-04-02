import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { clientPortalService, type ClientPortalUser } from '@/lib/client-portal-api'

interface ClientePortalAuthState {
  user: ClientPortalUser | null
  isAuthenticated: boolean
  isReady: boolean
  initialize: () => Promise<void>
  login: (login: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

export const useClientePortalAuth = create<ClientePortalAuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isReady: false,

      initialize: async () => {
        try {
          const payload = await clientPortalService.status()
          if (payload.authenticated && payload.user) {
            set({ user: payload.user, isAuthenticated: true, isReady: true })
            return
          }
        } catch {
          // keep unauthenticated
        }

        set({ user: null, isAuthenticated: false, isReady: true })
      },

      login: async (login, password) => {
        const user = await clientPortalService.login(login, password)
        set({ user, isAuthenticated: true, isReady: true })
      },

      logout: async () => {
        try {
          await clientPortalService.logout()
        } catch {
          // ignore local reset on logout
        }
        set({ user: null, isAuthenticated: false, isReady: true })
        window.location.href = '/portal-cliente/login'
      },
    }),
    { name: 'gontijo-client-portal-auth' }
  )
)
