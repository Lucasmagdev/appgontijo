import axios from 'axios'

function resolveApiBaseUrl() {
  if (typeof window !== 'undefined' && window.location.hostname === 'appgontijo.netlify.app') {
    return '/api'
  }

  return import.meta.env.VITE_API_URL || '/api'
}

export const API_BASE_URL = resolveApiBaseUrl()

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
})

const AUTH_STORAGE_KEYS: Record<string, string> = {
  '/operador/login': 'gontijo-operador-auth',
  '/portal-cliente/login': 'gontijo-portal-cliente-auth',
  '/login': 'gontijo-auth',
}

function resolveUnauthorizedRedirect(pathname: string, requestUrl: string): string | null {
  const isAdminRequest = requestUrl.includes('/admin/')
  const isStatusRequest = requestUrl.includes('/admin/status')

  if (isStatusRequest) return null

  if (pathname.startsWith('/operador')) {
    return isAdminRequest ? null : '/operador/login'
  }

  if (pathname.startsWith('/portal-cliente')) {
    return isAdminRequest ? null : '/portal-cliente/login'
  }

  if (pathname.startsWith('/assinatura/diario/') || pathname.startsWith('/assinatura/medicao/')) return null
  return '/login'
}

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      const pathname = window.location.pathname || '/'
      const requestUrl = String(err.config?.url || '')
      const redirectTo = resolveUnauthorizedRedirect(pathname, requestUrl)
      if (redirectTo && pathname !== redirectTo) {
        const storageKey = AUTH_STORAGE_KEYS[redirectTo]
        if (storageKey) {
          try {
            const stored = localStorage.getItem(storageKey)
            if (stored) {
              const parsed = JSON.parse(stored)
              parsed.state = { ...parsed.state, isAuthenticated: false, user: null }
              localStorage.setItem(storageKey, JSON.stringify(parsed))
            }
          } catch {
            // ignore storage errors
          }
        }
        window.location.href = redirectTo
      }
    }
    return Promise.reject(err)
  }
)
