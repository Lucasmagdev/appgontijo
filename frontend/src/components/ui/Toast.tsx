import { useEffect, useState } from 'react'

export type ToastType = 'error' | 'success' | 'info'
type ToastItem = { id: number; message: string; type: ToastType }
type Listener = (items: ToastItem[]) => void

let items: ToastItem[] = []
const listeners = new Set<Listener>()
let nextId = 1

function emit() {
  listeners.forEach((listener) => listener(items))
}

export function dismissToast(id: number) {
  items = items.filter((item) => item.id !== id)
  emit()
}

export function showToast(message: string, type: ToastType = 'error', durationMs = 6000) {
  if (!message) return
  // Evita empilhar a mesma mensagem repetida
  if (items.some((item) => item.message === message && item.type === type)) return
  const id = nextId++
  items = [...items, { id, message, type }]
  emit()
  if (durationMs > 0) {
    setTimeout(() => dismissToast(id), durationMs)
  }
}

export function Toaster() {
  const [list, setList] = useState<ToastItem[]>(items)

  useEffect(() => {
    listeners.add(setList)
    setList(items)
    return () => {
      listeners.delete(setList)
    }
  }, [])

  if (!list.length) return null

  return (
    <div className="toast-stack" role="region" aria-live="assertive">
      {list.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.type}`} role="alert">
          <span className="toast-icon" aria-hidden>
            {toast.type === 'error' ? '!' : toast.type === 'success' ? '✓' : 'i'}
          </span>
          <span className="toast-message">{toast.message}</span>
          <button
            type="button"
            className="toast-close"
            aria-label="Fechar"
            onClick={() => dismissToast(toast.id)}
          >
            {'×'}
          </button>
        </div>
      ))}
    </div>
  )
}
