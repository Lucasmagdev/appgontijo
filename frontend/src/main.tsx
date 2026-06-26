import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider, MutationCache } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import { Toaster, showToast } from './components/ui/Toast'
import { extractApiErrorMessage } from './lib/gontijo-api'

// Captura o prompt de instalacao do PWA antes do React montar (o evento
// pode disparar muito cedo). O componente OperadorInstallPrompt consome isso.
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  ;(window as unknown as { __deferredInstallPrompt?: Event }).__deferredInstallPrompt = e
  window.dispatchEvent(new Event('pwa-installable'))
})

// Evita que a roda do mouse altere o valor de inputs numericos quando o usuario
// apenas rola a pagina com o cursor sobre o campo (ex.: profundidade 14 -> 13,9).
window.addEventListener(
  'wheel',
  () => {
    const active = document.activeElement
    if (active instanceof HTMLInputElement && active.type === 'number') {
      active.blur()
    }
  },
  { passive: true },
)

const queryClient = new QueryClient({
  // Popup global em qualquer falha de cadastro/salvamento (mutation).
  // Mostra mensagem amigavel para o usuario nao achar que e erro do sistema.
  mutationCache: new MutationCache({
    onError: (error) => {
      showToast(extractApiErrorMessage(error), 'error')
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster />
    </QueryClientProvider>
  </StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    let refreshing = false

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return
      refreshing = true
      window.location.reload()
    })

    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        void registration.update()

        const activateWaitingWorker = () => {
          registration.waiting?.postMessage({ type: 'SKIP_WAITING' })
        }

        activateWaitingWorker()

        registration.addEventListener('updatefound', () => {
          const worker = registration.installing
          if (!worker) return

          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              worker.postMessage({ type: 'SKIP_WAITING' })
            }
          })
        })
      })
      .catch((error) => {
        console.warn('Falha ao registrar PWA service worker:', error)
      })
  })
} else if ('serviceWorker' in navigator) {
  void navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => {
      void registration.unregister()
    })
  })
  if ('caches' in window) {
    void caches.keys().then((keys) => {
      keys.forEach((key) => {
        void caches.delete(key)
      })
    })
  }
}
