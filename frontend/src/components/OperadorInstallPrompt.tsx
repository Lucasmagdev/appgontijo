import { useEffect, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'gontijo-install-prompt-dismissed-at'
const DISMISS_INTERVAL_MS = 3 * 24 * 60 * 60 * 1000 // reaparece após 3 dias

function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

function isIOS() {
  const ua = window.navigator.userAgent
  const ios = /iphone|ipad|ipod/i.test(ua)
  const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua)
  return ios && isSafari
}

function recentlyDismissed() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) || 0)
    return Number.isFinite(at) && Date.now() - at < DISMISS_INTERVAL_MS
  } catch {
    return false
  }
}

export default function OperadorInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)
  const [iosHint, setIosHint] = useState(false)

  useEffect(() => {
    if (isStandalone() || recentlyDismissed()) return

    // Android/Chrome: evento capturado em main.tsx (pode ter ocorrido antes do mount)
    const existing = (window as unknown as { __deferredInstallPrompt?: BeforeInstallPromptEvent })
      .__deferredInstallPrompt
    if (existing) {
      setDeferred(existing)
      setVisible(true)
    } else if (isIOS()) {
      setIosHint(true)
      setVisible(true)
    }

    const onInstallable = () => {
      const evt = (window as unknown as { __deferredInstallPrompt?: BeforeInstallPromptEvent })
        .__deferredInstallPrompt
      if (evt && !isStandalone()) {
        setDeferred(evt)
        setVisible(true)
      }
    }
    const onInstalled = () => {
      setVisible(false)
      ;(window as unknown as { __deferredInstallPrompt?: BeforeInstallPromptEvent }).__deferredInstallPrompt = undefined
    }

    window.addEventListener('pwa-installable', onInstallable)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('pwa-installable', onInstallable)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch { /* ignore */ }
    setVisible(false)
  }

  async function install() {
    if (!deferred) return
    try {
      await deferred.prompt()
      await deferred.userChoice
    } catch { /* ignore */ }
    ;(window as unknown as { __deferredInstallPrompt?: BeforeInstallPromptEvent }).__deferredInstallPrompt = undefined
    setDeferred(null)
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      style={{
        position: 'fixed',
        left: 12,
        right: 12,
        bottom: 12,
        zIndex: 10000,
        background: '#fff',
        borderRadius: 16,
        boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
        border: '1px solid #f0d6d2',
        padding: 16,
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
        maxWidth: 460,
        margin: '0 auto',
      }}
      role="dialog"
      aria-label="Instalar aplicativo"
    >
      <img
        src="/pwa-icon-192.png"
        alt="Gontijo"
        width={44}
        height={44}
        style={{ borderRadius: 10, flexShrink: 0 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: '#1f2937' }}>
          Instalar aplicativo Gontijo
        </p>
        {iosHint ? (
          <p style={{ margin: '4px 0 10px', fontSize: 12.5, color: '#6b7280', lineHeight: 1.4 }}>
            Toque em <strong>Compartilhar</strong> e depois em{' '}
            <strong>Adicionar à Tela de Início</strong> para instalar.
          </p>
        ) : (
          <p style={{ margin: '4px 0 10px', fontSize: 12.5, color: '#6b7280', lineHeight: 1.4 }}>
            Instale na tela inicial para abrir mais rápido e usar em tela cheia.
          </p>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          {!iosHint && (
            <button
              type="button"
              onClick={install}
              style={{
                background: '#b91c1c',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Instalar
            </button>
          )}
          <button
            type="button"
            onClick={dismiss}
            style={{
              background: 'transparent',
              color: '#6b7280',
              border: 'none',
              borderRadius: 10,
              padding: '8px 12px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Agora não
          </button>
        </div>
      </div>
    </div>
  )
}
