import { useEffect, useRef, useState } from 'react'

type Props = {
  isSaving: boolean
  isError?: boolean
}

export default function DiarySaveStatus({ isSaving, isError = false }: Props) {
  const wasSaving = useRef(false)
  const [showSaved, setShowSaved] = useState(false)

  useEffect(() => {
    if (isSaving) {
      wasSaving.current = true
      return
    }

    if (!wasSaving.current) return
    wasSaving.current = false
    if (isError) return

    const showTimer = window.setTimeout(() => setShowSaved(true), 0)
    const hideTimer = window.setTimeout(() => setShowSaved(false), 1800)
    return () => {
      window.clearTimeout(showTimer)
      window.clearTimeout(hideTimer)
    }
  }, [isError, isSaving])

  if (isError || (!isSaving && !showSaved)) return null

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        right: '16px',
        bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
        zIndex: 1000,
        borderRadius: '999px',
        padding: '10px 14px',
        background: isSaving ? '#334155' : '#15803d',
        color: '#fff',
        fontSize: '13px',
        fontWeight: 800,
        boxShadow: '0 12px 28px rgba(15,23,42,0.2)',
      }}
    >
      {isSaving ? 'Salvando...' : 'Salvo'}
    </div>
  )
}
