import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { operadorCursosApi } from '@/lib/gontijo-api'

function getYoutubeEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url)
    let videoId: string | null = null
    if (u.hostname.includes('youtube.com')) videoId = u.searchParams.get('v')
    else if (u.hostname === 'youtu.be') videoId = u.pathname.slice(1)
    return videoId ? `https://www.youtube.com/embed/${videoId}` : null
  } catch {
    return null
  }
}

export default function OperadorCursoDetalhePage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()

  const { data: curso, isLoading } = useQuery({
    queryKey: ['operador-curso', id],
    queryFn: () => operadorCursosApi.get(Number(id)),
    enabled: !!id,
  })

  const embedUrl = curso?.video_url ? getYoutubeEmbedUrl(curso.video_url) : null
  const aprovado = curso?.ja_aprovado === 1
  const ultimaTentativa = curso?.ultima_tentativa
  const exigeProva = Boolean(curso?.tem_prova && curso.tipo_acesso !== 'so_curso')
  const naoIniciado = Boolean(curso && exigeProva && curso.tentativas === 0 && !aprovado)
  const reprovado = Boolean(curso && exigeProva && curso.tentativas > 0 && !aprovado)

  if (isLoading) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
        <p style={{ color: '#94a3b8', fontSize: '14px' }}>Carregando...</p>
      </div>
    )
  }

  if (!curso) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
        <p style={{ color: '#94a3b8', fontSize: '14px' }}>Curso nao encontrado.</p>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#f8fafc', maxWidth: '430px', margin: '0 auto', paddingBottom: '40px' }}>
      <div style={{ position: 'relative' }}>
        {curso.thumbnail_url ? (
          <img src={curso.thumbnail_url} alt={curso.titulo} style={{ width: '100%', height: '220px', objectFit: 'cover', display: 'block' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
        ) : (
          <div style={{ height: '180px', background: 'linear-gradient(135deg, #c0392b 0%, #922b21 100%)' }} />
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.68) 100%)' }} />
        <button
          onClick={() => navigate('/operador/cursos')}
          style={{ position: 'absolute', top: '48px', left: '16px', background: 'rgba(0,0,0,0.35)', border: 'none', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
      </div>

      <div style={{ padding: '20px 16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' }}>
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#1e293b', lineHeight: 1.3, flex: 1 }}>{curso.titulo}</h1>
          {aprovado && (
            <span style={{ flexShrink: 0, background: '#dcfce7', color: '#15803d', fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '20px', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
              Concluido
            </span>
          )}
        </div>

        {curso.descricao && (
          <p style={{ margin: '0 0 20px', fontSize: '14px', color: '#64748b', lineHeight: 1.6 }}>{curso.descricao}</p>
        )}

        {naoIniciado && (
          <div style={{ background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: '12px', padding: '14px 16px', marginBottom: '20px' }}>
            <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 800, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Pronto para iniciar</p>
            <p style={{ margin: 0, fontSize: '14px', color: '#7f1d1d' }}>
              A prova deste curso ainda nao foi realizada. Assim que voce finalizar a primeira tentativa, ela deixa de aparecer como pendente.
            </p>
          </div>
        )}

        {embedUrl && (
          <div style={{ marginBottom: '20px' }}>
            <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Conteudo do curso</p>
            <div style={{ borderRadius: '12px', overflow: 'hidden', background: '#000', aspectRatio: '16/9' }}>
              <iframe
                src={embedUrl}
                title={curso.titulo}
                style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        )}

        {!embedUrl && curso.video_url && (
          <a
            href={curso.video_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: '10px', background: '#fff', border: '1.5px solid #fee2e2',
              borderRadius: '12px', padding: '14px 16px', marginBottom: '20px', textDecoration: 'none', color: '#c0392b',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            <span style={{ fontSize: '14px', fontWeight: 600 }}>Assistir video no YouTube</span>
          </a>
        )}

        {ultimaTentativa && !aprovado && (
          <div style={{ background: '#fff7ed', border: '1.5px solid #fed7aa', borderRadius: '12px', padding: '14px 16px', marginBottom: '20px' }}>
            <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: '#ea580c', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Ultima tentativa</p>
            <p style={{ margin: 0, fontSize: '14px', color: '#7c2d12' }}>
              {ultimaTentativa.acertos}/{ultimaTentativa.total_questoes} acertos - {Number(ultimaTentativa.percentual).toFixed(0)}%
            </p>
            {reprovado && (
              <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#9a3412' }}>
                A prova ja foi feita. Agora ela aparece como refazer prova, e nao mais como pendente.
              </p>
            )}
          </div>
        )}

        {curso.prova && exigeProva && (
          <div style={{ marginTop: '8px' }}>
            {!aprovado && (
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px 14px', marginBottom: '14px' }}>
                <p style={{ margin: 0, fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Situacao da prova
                </p>
                <p style={{ margin: '6px 0 0', fontSize: '14px', color: '#334155' }}>
                  {ultimaTentativa
                    ? 'Voce ja realizou esta prova e pode tentar novamente para melhorar o resultado.'
                    : 'Voce ainda nao realizou esta prova. Ela esta pendente para este colaborador.'}
                </p>
              </div>
            )}

            {aprovado ? (
              <div style={{ background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#16a34a' }}>Voce ja foi aprovado neste curso.</p>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#4ade80' }}>O resultado ficou registrado no sistema.</p>
              </div>
            ) : (
              <button
                onClick={() => navigate(`/operador/cursos/${id}/prova`)}
                style={{
                  width: '100%', background: 'linear-gradient(135deg, #c0392b 0%, #922b21 100%)',
                  border: 'none', borderRadius: '14px', padding: '16px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', color: '#fff',
                  boxShadow: '0 4px 16px rgba(192,57,43,0.35)',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
                <span style={{ fontSize: '16px', fontWeight: 700, letterSpacing: '0.02em' }}>
                  {ultimaTentativa ? 'Refazer prova' : 'Iniciar prova'}
                </span>
              </button>
            )}
          </div>
        )}

        {!exigeProva && (
          <div style={{ background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: '12px', padding: '14px 16px', marginTop: '10px' }}>
            <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 800, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Conteudo liberado</p>
            <p style={{ margin: 0, fontSize: '14px', color: '#1e3a8a' }}>
              Este item foi atribuido somente como curso. Nao existe prova obrigatoria para ele.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
