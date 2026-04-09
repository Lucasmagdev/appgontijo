import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { operadorCursosApi, type OperadorCurso } from '@/lib/gontijo-api'
import OperadorBottomNav from '@/components/operador/OperadorBottomNav'

type CursoStatus = 'nao_iniciado' | 'aprovado' | 'reprovado' | 'conteudo'

function resolveCursoStatus(curso: OperadorCurso): CursoStatus {
  const aprovado = curso.ja_aprovado === 1
  const exigeProva = curso.tem_prova > 0 && curso.tipo_acesso !== 'so_curso'

  if (aprovado) return 'aprovado'
  if (exigeProva && curso.tentativas > 0) return 'reprovado'
  if (exigeProva && curso.tentativas === 0) return 'nao_iniciado'
  return 'conteudo'
}

function statusConfig(status: CursoStatus) {
  switch (status) {
    case 'aprovado':
      return {
        border: '#bbf7d0',
        badgeBg: '#dcfce7',
        badgeColor: '#15803d',
        badgeText: 'Concluido',
        helper: 'Curso e prova concluidos.',
      }
    case 'reprovado':
      return {
        border: '#fed7aa',
        badgeBg: '#fff7ed',
        badgeColor: '#c2410c',
        badgeText: 'Refazer prova',
        helper: 'A prova ja foi feita e pode ser refeita.',
      }
    case 'nao_iniciado':
      return {
        border: '#fecaca',
        badgeBg: '#fee2e2',
        badgeColor: '#dc2626',
        badgeText: 'Novo',
        helper: 'Curso liberado e prova ainda nao realizada.',
      }
    default:
      return {
        border: '#cbd5e1',
        badgeBg: '#f1f5f9',
        badgeColor: '#475569',
        badgeText: 'Conteudo',
        helper: 'Curso disponivel para estudo.',
      }
  }
}

function sectionTitle(status: CursoStatus) {
  switch (status) {
    case 'nao_iniciado':
      return 'Novos para iniciar'
    case 'reprovado':
      return 'Necessitam refazer'
    case 'aprovado':
      return 'Concluidos'
    default:
      return 'Apenas conteudo'
  }
}

function CursoCard({ curso }: { curso: OperadorCurso }) {
  const navigate = useNavigate()
  const [imgError, setImgError] = useState(false)
  const status = resolveCursoStatus(curso)
  const visual = statusConfig(status)
  const provaResumo =
    curso.tem_prova > 0
      ? curso.tentativas > 0
        ? `${curso.tentativas} tentativa(s) registrada(s)`
        : 'Prova aguardando primeira tentativa'
      : 'Sem prova obrigatoria neste curso'

  const gradientBg =
    status === 'nao_iniciado'
      ? 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)'
      : status === 'reprovado'
        ? 'linear-gradient(135deg, #ea580c 0%, #9a3412 100%)'
        : status === 'aprovado'
          ? 'linear-gradient(135deg, #16a34a 0%, #166534 100%)'
          : 'linear-gradient(135deg, #334155 0%, #1e293b 100%)'

  const thumbnailBlock =
    curso.thumbnail_url && !imgError ? (
      <img
        src={curso.thumbnail_url}
        alt={curso.titulo}
        style={{ width: '100%', height: '120px', objectFit: 'cover', display: 'block' }}
        onError={() => setImgError(true)}
      />
    ) : (
      <div style={{ height: '72px', background: gradientBg }} />
    )

  return (
    <button
      onClick={() => navigate(`/operador/cursos/${curso.id}`)}
      style={{
        background: '#fff',
        border: `1.5px solid ${visual.border}`,
        borderRadius: '16px',
        padding: '0',
        overflow: 'hidden',
        textAlign: 'left',
        cursor: 'pointer',
        boxShadow: '0 10px 24px rgba(15,23,42,0.06)',
        width: '100%',
      }}
    >
      {thumbnailBlock}

      <div style={{ padding: '14px 14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          <p style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#0f172a', lineHeight: 1.35, flex: 1 }}>
            {curso.titulo}
          </p>
          <span
            style={{
              flexShrink: 0,
              fontSize: '10px',
              fontWeight: 800,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              padding: '4px 9px',
              borderRadius: '999px',
              background: visual.badgeBg,
              color: visual.badgeColor,
            }}
          >
            {visual.badgeText}
          </span>
        </div>

        {curso.descricao && (
          <p
            style={{
              margin: '6px 0 0',
              fontSize: '11px',
              color: '#64748b',
              lineHeight: 1.45,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {curso.descricao}
          </p>
        )}

        <div
          style={{
            marginTop: '12px',
            padding: '10px 12px',
            background: '#f8fafc',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '3px',
          }}
        >
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#334155' }}>{visual.helper}</span>
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>{provaResumo}</span>
        </div>
      </div>
    </button>
  )
}

export default function OperadorCursosPage() {
  const navigate = useNavigate()
  const { data: cursos = [], isLoading } = useQuery({
    queryKey: ['operador-cursos'],
    queryFn: operadorCursosApi.list,
    refetchOnMount: 'always',
  })
  const { data: pontosData } = useQuery({
    queryKey: ['operador-cursos-pontos'],
    queryFn: () => operadorCursosApi.getPontos(),
    refetchOnMount: 'always',
  })

  const grouped = {
    nao_iniciado: cursos.filter((curso) => resolveCursoStatus(curso) === 'nao_iniciado'),
    reprovado: cursos.filter((curso) => resolveCursoStatus(curso) === 'reprovado'),
    aprovado: cursos.filter((curso) => resolveCursoStatus(curso) === 'aprovado'),
    conteudo: cursos.filter((curso) => resolveCursoStatus(curso) === 'conteudo'),
  }

  const sections: Array<{ key: CursoStatus; items: OperadorCurso[]; color: string }> = [
    { key: 'nao_iniciado', items: grouped.nao_iniciado, color: '#dc2626' },
    { key: 'reprovado', items: grouped.reprovado, color: '#c2410c' },
    { key: 'aprovado', items: grouped.aprovado, color: '#15803d' },
    { key: 'conteudo', items: grouped.conteudo, color: '#475569' },
  ]

  return (
    <div style={{ minHeight: '100dvh', background: '#f8fafc', maxWidth: '430px', margin: '0 auto' }}>
      <div style={{ background: 'linear-gradient(135deg, #c0392b 0%, #922b21 100%)', padding: '48px 20px 24px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '160px', height: '160px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
        <button onClick={() => navigate('/operador')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: 'rgba(255,255,255,0.8)', fontSize: '13px', padding: 0, marginBottom: '16px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Voltar
        </button>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: '#fff', letterSpacing: '0.01em' }}>Cursos e Provas</h1>
        <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'rgba(255,255,255,0.82)' }}>
          {grouped.nao_iniciado.length > 0
            ? `${grouped.nao_iniciado.length} prova(s) ainda nao iniciada(s)`
            : 'Tudo em dia com as provas pendentes'}
        </p>
      </div>

      <div style={{ padding: '20px 16px 112px' }}>
        {pontosData && (
          <div
            style={{
              marginBottom: '18px',
              borderRadius: '18px',
              background: 'linear-gradient(135deg, #c0392b 0%, #7b1d1d 100%)',
              padding: '16px',
              color: '#fff',
              boxShadow: '0 14px 28px rgba(192,57,43,0.22)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{ position: 'absolute', top: '-30px', right: '-30px', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(255,255,255,0.07)', pointerEvents: 'none' }} />
            <p style={{ margin: 0, fontSize: '11px', fontWeight: 800, color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {pontosData.raffle?.banner_label || 'Sorteio do mês'}
            </p>
            <p style={{ margin: '4px 0 0', fontSize: '16px', fontWeight: 800 }}>
              {pontosData.raffle?.title || 'Ganhe pontos estudando'}
            </p>
            {pontosData.raffle?.prize && (
              <p style={{ margin: '6px 0 0', fontSize: '12px', color: 'rgba(255,255,255,0.80)' }}>
                Prêmio: <strong style={{ color: '#fff' }}>{pontosData.raffle.prize}</strong>
              </p>
            )}
            <p style={{ margin: '6px 0 0', fontSize: '11px', color: 'rgba(255,255,255,0.65)' }}>
              {pontosData.points.month_points > 0
                ? `Você tem ${pontosData.points.month_points} ponto(s) este mês`
                : 'Conclua cursos e provas para pontuar'}
            </p>
          </div>
        )}

        {!isLoading && cursos.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: '10px',
              marginBottom: '18px',
            }}
          >
            {[
              { label: 'Novos', value: grouped.nao_iniciado.length, bg: '#fef2f2', color: '#dc2626' },
              { label: 'Refazer', value: grouped.reprovado.length, bg: '#fff7ed', color: '#c2410c' },
              { label: 'Concluidos', value: grouped.aprovado.length, bg: '#f0fdf4', color: '#15803d' },
              { label: 'Conteudo', value: grouped.conteudo.length, bg: '#f1f5f9', color: '#475569' },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  borderRadius: '14px',
                  background: item.bg,
                  border: '1px solid rgba(148,163,184,0.15)',
                  padding: '12px 14px',
                }}
              >
                <p style={{ margin: 0, fontSize: '11px', fontWeight: 800, color: item.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {item.label}
                </p>
                <p style={{ margin: '6px 0 0', fontSize: '22px', fontWeight: 800, color: '#0f172a' }}>{item.value}</p>
              </div>
            ))}
          </div>
        )}

        {isLoading ? (
          <div style={{ paddingTop: '60px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>Carregando...</div>
        ) : cursos.length === 0 ? (
          <div style={{ paddingTop: '60px', textAlign: 'center' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 12px', display: 'block' }}>
              <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
              <path d="M6 12v5c3 3 9 3 12 0v-5"/>
            </svg>
            <p style={{ margin: 0, fontSize: '14px', color: '#94a3b8' }}>Nenhum curso atribuido a voce.</p>
          </div>
        ) : (
          sections
            .filter((section) => section.items.length > 0)
            .map((section) => (
              <section key={section.key} style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <p style={{ margin: 0, fontSize: '11px', fontWeight: 800, color: section.color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {sectionTitle(section.key)}
                  </p>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>{section.items.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {section.items.map((curso) => <CursoCard key={curso.id} curso={curso} />)}
                </div>
              </section>
            ))
        )}
      </div>
      <OperadorBottomNav />
    </div>
  )
}
