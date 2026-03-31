import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOperadorAuth } from '@/hooks/useOperadorAuth'

export default function OperadorSplash() {
  const navigate = useNavigate()
  const { isAuthenticated, isReady, user } = useOperadorAuth()
  const startRef = useRef(Date.now())

  useEffect(() => {
    if (!isReady) return

    const elapsed = Date.now() - startRef.current
    const remaining = Math.max(0, 1000 - elapsed)

    const timer = setTimeout(() => {
      navigate(isAuthenticated ? '/operador' : '/operador/login', { replace: true })
    }, remaining)

    return () => clearTimeout(timer)
  }, [isReady, isAuthenticated, navigate])

  const firstName = user?.nome?.split(' ')[0] ?? 'Operador'

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: '#f2f2f2',
        padding: '0 24px',
      }}
    >
      <div />

      {/* Centro */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '32px' }}>
        <div style={{ textAlign: 'center' }}>
          <p
            style={{
              margin: 0,
              fontSize: '22px',
              fontWeight: 500,
              color: '#c0392b',
              letterSpacing: '0.02em',
            }}
          >
            Bem vindo,
          </p>
          <p
            style={{
              margin: '4px 0 0',
              fontSize: '32px',
              fontWeight: 700,
              color: '#2c2c2c',
              letterSpacing: '0.01em',
            }}
          >
            {firstName}
          </p>
        </div>

        {/* Logo */}
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: '13px',
              fontWeight: 700,
              letterSpacing: '0.28em',
              color: '#888',
              textTransform: 'uppercase',
              marginBottom: '2px',
            }}
          >
            GONTIJO
          </div>
          <div
            style={{
              fontSize: '9px',
              fontWeight: 600,
              letterSpacing: '0.18em',
              color: '#bbb',
              textTransform: 'uppercase',
            }}
          >
            FUNDAÇÕES
          </div>
        </div>
      </div>

      {/* Rodapé */}
      <div
        style={{
          paddingBottom: '32px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '2px',
        }}
      >
        <span style={{ fontSize: '11px', color: '#bbb', letterSpacing: '0.04em' }}>
          Developed by
        </span>
        <span
          style={{
            fontSize: '12px',
            fontWeight: 700,
            color: '#999',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          Zarb Solution
        </span>
      </div>
    </div>
  )
}
