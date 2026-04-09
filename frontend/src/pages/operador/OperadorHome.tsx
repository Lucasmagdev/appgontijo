import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useOperadorAuth } from '@/hooks/useOperadorAuth'
import { operadorCursosApi } from '@/lib/gontijo-api'
import OperadorBottomNav from '@/components/operador/OperadorBottomNav'

const ATALHOS = [
  {
    label: 'Diário de Obras',
    rota: '/operador/diario-de-obras',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#c0392b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10 9 9 9 8 9"/>
      </svg>
    ),
  },
  {
    label: 'Indique uma Obra',
    rota: '/operador/indique-uma-obra',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#c0392b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
        <circle cx="12" cy="10" r="3"/>
      </svg>
    ),
  },
  {
    label: 'Fato Observado',
    rota: '/operador/fato-observado',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#c0392b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="12" y1="11" x2="12" y2="17"/>
        <line x1="9" y1="14" x2="15" y2="14"/>
      </svg>
    ),
  },
  {
    label: 'Cursos e Provas',
    rota: '/operador/cursos',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#c0392b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
        <path d="M6 12v5c3 3 9 3 12 0v-5"/>
      </svg>
    ),
  },
  {
    label: 'Configurações',
    rota: '/operador/configuracoes',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#c0392b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    ),
  },
]

function Avatar({ nome }: { nome: string }) {
  const initials = nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')

  return (
    <div
      style={{
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        background: '#fff',
        border: '2px solid rgba(255,255,255,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '16px',
        fontWeight: 700,
        color: '#c0392b',
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  )
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

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        background: `linear-gradient(to right, #c0392b 42%, #ffffff 42%)`,
        maxWidth: '430px',
        margin: '0 auto',
      }}
    >
      {/* Forma decorativa no fundo vermelho */}
      <div
        style={{
          position: 'absolute',
          top: '-60px',
          left: '-60px',
          width: '260px',
          height: '260px',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.07)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '120px',
          left: '-80px',
          width: '200px',
          height: '200px',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.05)',
          pointerEvents: 'none',
        }}
      />

      {/* Conteúdo */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', flex: 1 }}>

        {/* Topo: saudação + avatar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            padding: '48px 20px 24px',
          }}
        >
          <div>
            <p style={{ margin: 0, fontSize: '15px', color: 'rgba(255,255,255,0.8)', fontWeight: 400 }}>
              Olá,
            </p>
            <p style={{ margin: '2px 0 0', fontSize: '26px', color: '#fff', fontWeight: 700, letterSpacing: '0.01em' }}>
              {firstName}
            </p>
          </div>
          <Avatar nome={user?.nome ?? 'Operador'} />
        </div>

        {/* Banner de pendências de cursos */}
        {pendencias > 0 && (
          <div style={{ padding: '0 16px 12px' }}>
            <button
              onClick={() => navigate('/operador/cursos')}
              style={{
                width: '100%', background: '#fff', borderRadius: '12px',
                padding: '12px 16px', boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
                border: '1.5px solid #fecaca', cursor: 'pointer', textAlign: 'left',
                display: 'flex', alignItems: 'center', gap: '12px',
              }}
            >
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
                  <path d="M6 12v5c3 3 9 3 12 0v-5"/>
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#dc2626' }}>
                  {pendencias} prova{pendencias > 1 ? 's' : ''} pendente{pendencias > 1 ? 's' : ''}
                </p>
                <p style={{ margin: '1px 0 0', fontSize: '11px', color: '#94a3b8' }}>Toque para ver os cursos atribuídos</p>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          </div>
        )}

        {(raffle || points > 0) && (
          <div style={{ padding: '0 16px 12px' }}>
            <button
              onClick={() => navigate('/operador/cursos')}
              style={{
                width: '100%', background: '#fff', borderRadius: '14px',
                padding: '14px 16px', boxShadow: '0 4px 14px rgba(192,57,43,0.10)',
                border: '1.5px solid #fecaca', cursor: 'pointer', textAlign: 'left',
                display: 'flex', alignItems: 'center', gap: '12px',
                position: 'relative', overflow: 'hidden',
              }}
            >
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: '10px', fontWeight: 800, color: '#c0392b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  {raffle?.banner_label || 'Sorteio do mês'}
                </p>
                <p style={{ margin: '4px 0 0', fontSize: '15px', fontWeight: 800, color: '#7f1d1d', lineHeight: 1.2 }}>
                  {raffle?.title || 'Ganhe pontos estudando'}
                </p>
                {raffle?.prize && (
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#991b1b' }}>
                    Prêmio: <strong>{raffle.prize}</strong>
                  </p>
                )}
                <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#94a3b8' }}>
                  {points > 0 ? `Você tem ${points} ponto(s) este mês` : 'Conclua cursos e provas para pontuar'}
                </p>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c0392b" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          </div>
        )}

        {/* Card comunicação interna */}
        <div style={{ padding: '0 16px 16px' }}>
          <div
            style={{
              background: '#fff',
              borderRadius: '12px',
              padding: '16px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
            }}
          >
            <p style={{ margin: 0, fontSize: '12px', fontWeight: 700, color: '#c0392b', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Comunicação interna
            </p>
            <p style={{ margin: '6px 0 0', fontSize: '14px', color: '#555', lineHeight: '1.5' }}>
              Bem vindo ao APP da Gontijo Fundações!
            </p>
          </div>
        </div>

        {/* Grade de atalhos */}
        <div
          style={{
            padding: '0 16px',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
          }}
        >
          {ATALHOS.map((a) => (
            <button
              key={a.rota}
              onClick={() => navigate(a.rota)}
              style={{
                background: '#fff',
                border: '1px solid #e5e5e5',
                borderRadius: '12px',
                padding: '18px 14px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: '10px',
                cursor: 'pointer',
                textAlign: 'left',
                boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
              }}
            >
              {a.icon}
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#2c2c2c', lineHeight: '1.3' }}>
                {a.label}
              </span>
            </button>
          ))}
        </div>

        {/* Espaço flexível */}
        <div style={{ flex: 1 }} />

        {/* Rodapé */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 20px 112px',
          }}
        >
          <button
            onClick={() => void logout()}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 600,
              padding: 0,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sair
          </button>

          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.04em' }}>
            v4.0.3
          </span>

          <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>
            GONTIJO
          </span>
        </div>
      </div>
      <OperadorBottomNav />
    </div>
  )
}
