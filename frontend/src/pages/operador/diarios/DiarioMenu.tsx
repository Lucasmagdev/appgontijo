import { useNavigate } from 'react-router-dom'

function OperadorHeader({ titulo, voltarPara }: { titulo: string; voltarPara: string }) {
  const navigate = useNavigate()
  return (
    <div
      style={{
        background: '#c0392b',
        padding: '0 16px',
        height: '64px',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        flexShrink: 0,
      }}
    >
      <button
        onClick={() => navigate(voltarPara)}
        style={{
          background: 'rgba(0,0,0,0.28)',
          border: 'none',
          borderRadius: '8px',
          width: '36px',
          height: '36px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
      <span
        style={{
          color: '#fff',
          fontSize: '18px',
          fontWeight: 700,
          letterSpacing: '0.04em',
        }}
      >
        {titulo}
      </span>
    </div>
  )
}

export default function DiarioMenu() {
  const navigate = useNavigate()

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        background: '#fff',
        maxWidth: '430px',
        margin: '0 auto',
      }}
    >
      <OperadorHeader titulo="Diário de obras" voltarPara="/operador" />

      {/* Cards */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 20px',
          gap: '16px',
        }}
      >
        {/* Novo Diário */}
        <button
          onClick={() => navigate('/operador/diario-de-obras/novo')}
          style={{
            flex: 1,
            aspectRatio: '1',
            background: '#fff',
            border: '2px solid #2c2c2c',
            borderRadius: '16px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '14px',
            cursor: 'pointer',
            padding: '20px 12px',
          }}
        >
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#c0392b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="12" y1="18" x2="12" y2="12" />
            <line x1="9" y1="15" x2="15" y2="15" />
          </svg>
          <span
            style={{
              fontSize: '15px',
              fontWeight: 700,
              color: '#1a1a1a',
              textAlign: 'center',
              lineHeight: '1.3',
            }}
          >
            Novo{'\n'}Diário
          </span>
        </button>

        {/* Pesquisar Diário */}
        <button
          onClick={() => navigate('/operador/diario-de-obras/pesquisar')}
          style={{
            flex: 1,
            aspectRatio: '1',
            background: '#fff',
            border: '2px solid #2c2c2c',
            borderRadius: '16px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '14px',
            cursor: 'pointer',
            padding: '20px 12px',
          }}
        >
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#c0392b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span
            style={{
              fontSize: '15px',
              fontWeight: 700,
              color: '#1a1a1a',
              textAlign: 'center',
              lineHeight: '1.3',
            }}
          >
            Pesquisar{'\n'}Diário
          </span>
        </button>
      </div>
    </div>
  )
}
