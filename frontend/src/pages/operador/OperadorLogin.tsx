import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOperadorAuth } from '@/hooks/useOperadorAuth'

function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
}

export default function OperadorLoginPage() {
  const navigate = useNavigate()
  const { login, isAuthenticated, isReady } = useOperadorAuth()
  const [cpfDisplay, setCpfDisplay] = useState('')
  const [senha, setSenha] = useState('')
  const [showSenha, setShowSenha] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isReady && isAuthenticated) {
      navigate('/operador', { replace: true })
    }
  }, [isReady, isAuthenticated, navigate])

  function handleCpfChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\D/g, '')
    setCpfDisplay(formatCpf(raw))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const cpfRaw = cpfDisplay.replace(/\D/g, '')
    try {
      await login(cpfRaw, senha)
      navigate('/operador/carregando', { replace: true })
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'CPF ou senha invalidos.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  if (!isReady) return null

  return (
    <div
      style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#ebebeb' }}
    >
      {/* Header */}
      <div
        style={{
          background: '#c0392b',
          padding: '18px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            color: '#fff',
            fontSize: '18px',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}
        >
          Autenticação
        </span>
      </div>

      {/* Form area */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '32px 24px',
          maxWidth: '440px',
          width: '100%',
          margin: '0 auto',
          boxSizing: 'border-box',
        }}
      >
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* CPF */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label
              style={{
                fontSize: '13px',
                fontWeight: 700,
                letterSpacing: '0.1em',
                color: '#333',
                textTransform: 'uppercase',
              }}
            >
              Login:
            </label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="username"
              value={cpfDisplay}
              onChange={handleCpfChange}
              placeholder="000.000.000-00"
              required
              style={{
                background: '#fff',
                border: '1px solid #ccc',
                borderRadius: '10px',
                padding: '14px 16px',
                fontSize: '16px',
                outline: 'none',
                color: '#222',
                letterSpacing: '0.05em',
              }}
            />
          </div>

          {/* Senha */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label
              style={{
                fontSize: '13px',
                fontWeight: 700,
                letterSpacing: '0.1em',
                color: '#333',
                textTransform: 'uppercase',
              }}
            >
              Senha:
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showSenha ? 'text' : 'password'}
                autoComplete="current-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
                style={{
                  width: '100%',
                  background: '#fff',
                  border: '1px solid #ccc',
                  borderRadius: '10px',
                  padding: '14px 48px 14px 16px',
                  fontSize: '16px',
                  outline: 'none',
                  color: '#222',
                  boxSizing: 'border-box',
                }}
              />
              <button
                type="button"
                onClick={() => setShowSenha((v) => !v)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  color: '#888',
                  display: 'flex',
                  alignItems: 'center',
                }}
                aria-label={showSenha ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showSenha ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fca5a5',
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '13px',
                color: '#b91c1c',
                fontWeight: 500,
              }}
            >
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            style={{
              background: loading ? '#888' : '#3a3f48',
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              padding: '15px',
              fontSize: '15px',
              fontWeight: 700,
              letterSpacing: '0.08em',
              cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: '4px',
              textTransform: 'uppercase',
            }}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>

      {/* Footer */}
      <div
        style={{
          padding: '20px 24px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <span
          style={{
            fontSize: '13px',
            fontWeight: 700,
            letterSpacing: '0.22em',
            color: '#999',
            textTransform: 'uppercase',
          }}
        >
          GONTIJO
        </span>
      </div>
    </div>
  )
}
