import axios from 'axios'

export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
})

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
        window.location.href = redirectTo
      }
    }
    return Promise.reject(err)
  }
)
