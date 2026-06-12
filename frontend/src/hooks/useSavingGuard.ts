import { useEffect } from 'react'

export function useSavingGuard(isSaving: boolean) {
  useEffect(() => {
    if (!isSaving) return

    const preventClose = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', preventClose)
    return () => window.removeEventListener('beforeunload', preventClose)
  }, [isSaving])
}
