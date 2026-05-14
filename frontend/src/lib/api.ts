import axios from 'axios'

export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

export function resolveApiUrl(path: string): string {
  if (!path) return ''
  if (/^https?:\/\//i.test(path)) return path

  const base = API_BASE_URL.replace(/\/+$/, '')
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const pathWithoutApiPrefix =
    normalizedPath.startsWith('/api/') && base.endsWith('/api')
      ? normalizedPath.slice('/api'.length)
      : normalizedPath

  return `${base}${pathWithoutApiPrefix}`
}

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

  if (pathname.startsWith('/operador')) {
    return isAdminRequest ? null : '/operador/login'
  }

  if (pathname.startsWith('/portal-cliente')) {
    return isAdminRequest ? null : '/portal-cliente/login'
  }

  if (pathname.startsWith('/assinatura/diario/')) return null
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
