import { useNavigate } from 'react-router-dom'

interface Props {
  titulo: string
  voltarPara?: string
  mensagem?: string
}

export default function OperadorPlaceholder({ titulo, voltarPara = '/operador', mensagem }: Props) {
  const navigate = useNavigate()

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#f2f2f2' }}>
      <div style={{ background: '#c0392b', padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          onClick={() => navigate(voltarPara)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', padding: 0, display: 'flex', alignItems: 'center' }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <span style={{ color: '#fff', fontSize: '16px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {titulo}
        </span>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px', textAlign: 'center' }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '16px' }}>
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <line x1="3" y1="9" x2="21" y2="9"/>
          <line x1="9" y1="21" x2="9" y2="9"/>
        </svg>
        <p style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#444' }}>Em construção</p>
        <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#999' }}>{mensagem ?? 'Este módulo estará disponível em breve.'}</p>
      </div>
    </div>
  )
}
