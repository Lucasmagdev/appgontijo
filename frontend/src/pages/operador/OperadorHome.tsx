import { useOperadorAuth } from '@/hooks/useOperadorAuth'

export default function OperadorHomePage() {
  const { user, logout } = useOperadorAuth()

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        background: '#ebebeb',
      }}
    >
      <div
        style={{
          background: '#c0392b',
          padding: '18px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span
          style={{
            color: '#fff',
            fontSize: '16px',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}
        >
          Gontijo
        </span>
        <button
          onClick={() => void logout()}
          style={{
            background: 'rgba(0,0,0,0.2)',
            border: 'none',
            borderRadius: '6px',
            color: '#fff',
            fontSize: '13px',
            fontWeight: 600,
            padding: '6px 12px',
            cursor: 'pointer',
          }}
        >
          Sair
        </button>
      </div>

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 24px',
          textAlign: 'center',
        }}
      >
        <p style={{ fontSize: '20px', fontWeight: 700, color: '#333', margin: 0 }}>
          Olá, {user?.nome ?? 'Operador'}
        </p>
        <p style={{ fontSize: '14px', color: '#888', marginTop: '8px' }}>
          Área do operador em construção.
        </p>
      </div>
    </div>
  )
}
