import { useLocation, useNavigate } from 'react-router-dom'

type NavItem = {
  label: string
  route: string
  match: (pathname: string) => boolean
  icon: React.ReactNode
}

const ITEMS: NavItem[] = [
  {
    label: 'Inicio',
    route: '/operador',
    match: (pathname) => pathname === '/operador',
    icon: (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 11.5 12 4l9 7.5" />
        <path d="M5 10.5V20h14v-9.5" />
      </svg>
    ),
  },
  {
    label: 'Diario',
    route: '/operador/diario-de-obras',
    match: (pathname) => pathname.startsWith('/operador/diario-de-obras'),
    icon: (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="8" y1="13" x2="16" y2="13"/>
        <line x1="8" y1="17" x2="13" y2="17"/>
      </svg>
    ),
  },
  {
    label: 'Cursos',
    route: '/operador/cursos',
    match: (pathname) => pathname.startsWith('/operador/cursos'),
    icon: (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
        <path d="M6 12v5c3 3 9 3 12 0v-5"/>
      </svg>
    ),
  },
  {
    label: 'Fatos',
    route: '/operador/fato-observado',
    match: (pathname) => pathname.startsWith('/operador/fato-observado'),
    icon: (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    ),
  },
  {
    label: 'Ajustes',
    route: '/operador/configuracoes',
    match: (pathname) => pathname.startsWith('/operador/configuracoes'),
    icon: (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    ),
  },
]

export default function OperadorBottomNav() {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <div
      style={{
        position: 'fixed',
        left: '50%',
        bottom: '14px',
        transform: 'translateX(-50%)',
        width: 'min(398px, calc(100vw - 20px))',
        zIndex: 40,
      }}
    >
      <div
        style={{
          borderRadius: '24px',
          background: 'rgba(255,255,255,0.96)',
          border: '1px solid rgba(226,232,240,0.95)',
          boxShadow: '0 18px 44px rgba(15,23,42,0.16)',
          padding: '10px 8px calc(10px + env(safe-area-inset-bottom, 0px))',
          backdropFilter: 'blur(14px)',
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${ITEMS.length}, minmax(0, 1fr))`, gap: '4px' }}>
          {ITEMS.map((item) => {
            const active = item.match(location.pathname)
            return (
              <button
                key={item.route}
                type="button"
                onClick={() => navigate(item.route)}
                style={{
                  border: 'none',
                  background: active ? 'linear-gradient(180deg, #fee2e2 0%, #ffffff 100%)' : 'transparent',
                  borderRadius: '18px',
                  minHeight: '62px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  color: active ? '#c0392b' : '#94a3b8',
                  transition: 'all 0.2s ease',
                  boxShadow: active ? 'inset 0 0 0 1px rgba(192,57,43,0.12)' : 'none',
                }}
              >
                <div style={{ display: 'grid', placeItems: 'center', width: '22px', height: '22px' }}>{item.icon}</div>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: active ? 800 : 700,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    lineHeight: 1,
                  }}
                >
                  {item.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
