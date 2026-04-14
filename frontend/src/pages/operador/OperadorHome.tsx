import type { CSSProperties, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useOperadorAuth } from '@/hooks/useOperadorAuth'
import { operadorCursosApi } from '@/lib/gontijo-api'
import OperadorBottomNav from '@/components/operador/OperadorBottomNav'

const RED = '#c0392b'
const RED_DARK = '#8f1f18'
const TEXT = '#241f21'
const MUTED = '#7a6f72'

const ATALHOS = [
  {
    label: 'Fazer ou revisar diario',
    description: 'Preencha ou revise o diario do dia',
    rota: '/operador/diario-de-obras',
    icon: DocumentIcon,
    featured: true,
  },
  {
    label: 'Indique uma Obra',
    description: 'Envie uma oportunidade',
    rota: '/operador/indique-uma-obra',
    icon: PinIcon,
  },
  {
    label: 'Fato Observado',
    description: 'Registre uma situacao',
    rota: '/operador/fato-observado',
    icon: AlertIcon,
  },
  {
    label: 'Cursos e Provas',
    description: 'Pontos de aprendizado',
    rota: '/operador/cursos',
    icon: CourseIcon,
  },
  {
    label: 'Configuracoes',
    description: 'Assinatura e conta',
    rota: '/operador/configuracoes',
    icon: GearIcon,
  },
]

function Avatar({ nome }: { nome: string }) {
  const initials = nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('')

  return (
    <div
      style={{
        width: '48px',
        height: '48px',
        borderRadius: '8px',
        background: '#fff',
        border: '1px solid rgba(255,255,255,0.7)',
        display: 'grid',
        placeItems: 'center',
        fontSize: '15px',
        fontWeight: 900,
        color: RED,
        flexShrink: 0,
        boxShadow: '0 12px 26px rgba(88,18,14,0.16)',
      }}
    >
      {initials}
    </div>
  )
}

function IconFrame({ children, tone = 'light' }: { children: ReactNode; tone?: 'light' | 'red' }) {
  return (
    <div
      style={{
        width: '38px',
        height: '38px',
        borderRadius: '8px',
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
        color: tone === 'red' ? '#fff' : RED,
        background: tone === 'red' ? 'rgba(255,255,255,0.16)' : '#fff4f3',
        border: tone === 'red' ? '1px solid rgba(255,255,255,0.24)' : '1px solid rgba(192,57,43,0.12)',
      }}
    >
      {children}
    </div>
  )
}

function Chevron({ color = RED }: { color?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

function DocumentIcon() {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="13" y2="17" />
    </svg>
  )
}

function PinIcon() {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

function AlertIcon() {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  )
}

function CourseIcon() {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
      <path d="M6 12v5c3 3 9 3 12 0v-5" />
    </svg>
  )
}

function GearIcon() {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

const panelStyle: CSSProperties = {
  background: '#fff',
  border: '1px solid rgba(72,35,31,0.09)',
  borderRadius: '8px',
  boxShadow: '0 12px 28px rgba(41,26,25,0.11)',
}

export default function OperadorHomePage() {
  const navigate = useNavigate()
  const { user, logout } = useOperadorAuth()

  const { data: pendenciasData } = useQuery({
    queryKey: ['operador-pendencias'],
    queryFn: operadorCursosApi.pendencias,
    refetchOnMount: 'always',
  })
  const { data: pontosData } = useQuery({
    queryKey: ['operador-cursos-pontos'],
    queryFn: () => operadorCursosApi.getPontos(),
    refetchOnMount: 'always',
  })

  const pendencias = pendenciasData?.pendencias ?? 0
  const points = pontosData?.points.month_points ?? 0
  const raffle = pontosData?.raffle ?? null
  const firstName = user?.nome?.split(' ')[0] ?? 'Operador'
  const featured = ATALHOS.find((item) => item.featured) ?? ATALHOS[0]
  const secondary = ATALHOS.filter((item) => !item.featured)
  const FeaturedIcon = featured.icon

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        background: 'linear-gradient(to right, #c0392b 42%, #ffffff 42%)',
        maxWidth: '430px',
        margin: '0 auto',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0) 34%), radial-gradient(circle at 15% 15%, rgba(255,255,255,0.10) 0 68px, transparent 70px)',
        }}
      />

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', flex: 1, paddingBottom: '112px' }}>
        <header style={{ padding: '40px 20px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
            <div>
              <p style={{ margin: 0, color: 'rgba(255,255,255,0.82)', fontSize: '14px', fontWeight: 600 }}>Ola,</p>
              <p style={{ margin: '3px 0 0', color: '#fff', fontSize: '28px', lineHeight: 1, fontWeight: 900 }}>{firstName}</p>
            </div>
            <Avatar nome={user?.nome ?? 'Operador'} />
          </div>
        </header>

        <main style={{ display: 'grid', gap: '12px', padding: '0 16px 18px' }}>
          {pendencias > 0 ? (
            <button
              onClick={() => navigate('/operador/cursos')}
              style={{
                ...panelStyle,
                minHeight: '72px',
                padding: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <IconFrame>
                <CourseIcon />
              </IconFrame>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, color: RED_DARK, fontSize: '13px', fontWeight: 900 }}>
                  {pendencias} prova{pendencias > 1 ? 's' : ''} pendente{pendencias > 1 ? 's' : ''}
                </p>
                <p style={{ margin: '3px 0 0', color: MUTED, fontSize: '12px', lineHeight: 1.25 }}>Toque para ver os cursos atribuidos</p>
              </div>
              <Chevron />
            </button>
          ) : null}

          {(raffle || points > 0) ? (
            <button
              onClick={() => navigate('/operador/cursos')}
              style={{
                ...panelStyle,
                minHeight: '96px',
                padding: '14px',
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                alignItems: 'center',
                gap: '12px',
                textAlign: 'left',
                cursor: 'pointer',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: RED }} />
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, color: RED, fontSize: '10px', fontWeight: 900, letterSpacing: '0.09em', textTransform: 'uppercase' }}>
                  {raffle?.banner_label || 'Pontos de aprendizado'}
                </p>
                <p style={{ margin: '5px 0 0', color: TEXT, fontSize: '16px', fontWeight: 900, lineHeight: 1.15 }}>
                  {raffle?.title || 'Ganhe pontos estudando'}
                </p>
                <p style={{ margin: '6px 0 0', color: MUTED, fontSize: '12px', lineHeight: 1.35 }}>
                  {points > 0 ? `${points} ponto(s) acumulados neste mes` : 'Conclua cursos e provas para pontuar'}
                </p>
              </div>
              <div
                style={{
                  minWidth: '54px',
                  height: '54px',
                  borderRadius: '8px',
                  background: '#fff4f3',
                  display: 'grid',
                  placeItems: 'center',
                  color: RED,
                  fontSize: '18px',
                  fontWeight: 900,
                }}
              >
                {points}
              </div>
            </button>
          ) : null}

          <section style={{ ...panelStyle, padding: '14px 15px' }}>
            <p style={{ margin: 0, color: RED, fontSize: '11px', fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Comunicacao interna
            </p>
            <p style={{ margin: '6px 0 0', color: TEXT, fontSize: '14px', lineHeight: 1.45 }}>Bem vindo ao APP da Gontijo Fundacoes!</p>
          </section>

          <button
            onClick={() => navigate(featured.rota)}
            style={{
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #ffffff 0%, #fff6f4 58%, #f7e7e3 100%)',
              color: TEXT,
              minHeight: '116px',
              padding: '16px',
              display: 'grid',
              gridTemplateColumns: 'auto 1fr auto',
              alignItems: 'center',
              gap: '14px',
              cursor: 'pointer',
              textAlign: 'left',
              boxShadow: '0 18px 36px rgba(80,41,36,0.18)',
              position: 'relative',
              overflow: 'hidden',
              border: '1px solid rgba(192,57,43,0.18)',
            }}
          >
            <div
              style={{
                position: 'absolute',
                right: '-26px',
                bottom: '-34px',
                width: '138px',
                height: '138px',
                borderRadius: '50%',
                border: '24px solid rgba(192,57,43,0.08)',
              }}
            />
            <IconFrame>
              <FeaturedIcon />
            </IconFrame>
            <div style={{ position: 'relative', minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: '11px', fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', color: RED }}>
                Acao principal
              </p>
              <p style={{ margin: '5px 0 0', fontSize: '20px', lineHeight: 1.05, fontWeight: 900 }}>{featured.label}</p>
              <p style={{ margin: '6px 0 0', fontSize: '12px', lineHeight: 1.35, color: MUTED }}>{featured.description}</p>
            </div>
            <div style={{ position: 'relative' }}>
              <Chevron />
            </div>
          </button>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {secondary.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.rota}
                  onClick={() => navigate(item.rota)}
                  style={{
                    ...panelStyle,
                    minHeight: '126px',
                    padding: '13px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: '12px',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <IconFrame>
                    <Icon />
                  </IconFrame>
                  <div>
                    <p style={{ margin: 0, color: TEXT, fontSize: '13px', fontWeight: 900, lineHeight: 1.2 }}>{item.label}</p>
                    <p style={{ margin: '5px 0 0', color: MUTED, fontSize: '11px', lineHeight: 1.3 }}>{item.description}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </main>

        <footer style={{ marginTop: 'auto', padding: '4px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            onClick={() => void logout()}
            style={{
              border: 'none',
              borderRadius: '8px',
              background: 'rgba(255,255,255,0.12)',
              color: '#fff',
              minHeight: '38px',
              padding: '0 11px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sair
          </button>
          <span style={{ color: 'rgba(255,255,255,0.52)', fontSize: '11px', fontWeight: 800, letterSpacing: '0.08em' }}>v4.0.3</span>
        </footer>
      </div>

      <OperadorBottomNav />
    </div>
  )
}
