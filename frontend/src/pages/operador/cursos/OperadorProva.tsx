import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { operadorCursosApi, type QuestaoRecord } from '@/lib/gontijo-api'
import { SkeletonBlock, SkeletonLine } from '@/components/ui/Skeleton'

type Resultado = {
  id: number
  acertos: number
  total_questoes: number
  percentual: number
  aprovado: boolean
  percentual_aprovacao: number
  points_awarded: number
  totals: {
    month_points: number
    lifetime_points: number
    chances: number
  }
}

function ResultadoScreen({ resultado, cursoId }: { resultado: Resultado; cursoId: string }) {
  const navigate = useNavigate()
  const { aprovado, acertos, total_questoes, percentual, percentual_aprovacao } = resultado
  const pct = Math.round(percentual)

  // Progresso circular
  const radius = 60
  const circ = 2 * Math.PI * radius
  const offset = circ - (pct / 100) * circ

  return (
    <div style={{
      minHeight: '100dvh', maxWidth: '430px', margin: '0 auto',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '40px 24px',
      background: aprovado
        ? 'linear-gradient(160deg, #052e16 0%, #14532d 40%, #166534 100%)'
        : 'linear-gradient(160deg, #450a0a 0%, #7f1d1d 40%, #991b1b 100%)',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Decoração de fundo */}
      <div style={{ position: 'absolute', top: '-80px', right: '-80px', width: '300px', height: '300px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-60px', left: '-60px', width: '220px', height: '220px', borderRadius: '50%', background: 'rgba(255,255,255,0.03)', pointerEvents: 'none' }} />

      {/* Ícone principal */}
      <div style={{ fontSize: '64px', marginBottom: '8px', lineHeight: 1 }}>
        {aprovado ? '🎓' : '📚'}
      </div>

      {/* Título */}
      <h1 style={{
        margin: '0 0 4px', textAlign: 'center',
        fontSize: '32px', fontWeight: 900, letterSpacing: '-0.02em',
        color: aprovado ? '#86efac' : '#fca5a5',
      }}>
        {aprovado ? 'Aprovado!' : 'Reprovado'}
      </h1>
      <p style={{ margin: '0 0 36px', fontSize: '14px', color: 'rgba(255,255,255,0.55)', textAlign: 'center' }}>
        {aprovado ? 'Parabéns pelo seu desempenho!' : `Nota mínima: ${percentual_aprovacao}%. Continue estudando!`}
      </p>

      <div style={{ marginBottom: '24px', borderRadius: '16px', background: 'rgba(255,255,255,0.08)', padding: '14px 18px', textAlign: 'center', maxWidth: '320px' }}>
        <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
          Pontos desta tentativa
        </p>
        <p style={{ margin: '6px 0 0', fontSize: '28px', fontWeight: 900, color: '#fff' }}>+{resultado.points_awarded}</p>
        <p style={{ margin: '6px 0 0', fontSize: '12px', color: 'rgba(255,255,255,0.72)' }}>
          Agora você tem {resultado.totals.month_points} ponto(s) acumulado(s) neste mês.
        </p>
      </div>

      {/* Círculo de progresso */}
      <div style={{ position: 'relative', width: '160px', height: '160px', marginBottom: '32px' }}>
        <svg width="160" height="160" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="80" cy="80" r={radius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="12" />
          <circle
            cx="80" cy="80" r={radius} fill="none"
            stroke={aprovado ? '#4ade80' : '#f87171'}
            strokeWidth="12"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1s ease' }}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: '38px', fontWeight: 900, color: '#fff', lineHeight: 1 }}>{pct}%</span>
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>sua nota</span>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '40px' }}>
        <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '12px', padding: '14px 24px', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: '28px', fontWeight: 800, color: '#fff' }}>{acertos}</p>
          <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Acertos</p>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '12px', padding: '14px 24px', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: '28px', fontWeight: 800, color: '#fff' }}>{total_questoes - acertos}</p>
          <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Erros</p>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '12px', padding: '14px 24px', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: '28px', fontWeight: 800, color: '#fff' }}>{total_questoes}</p>
          <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total</p>
        </div>
      </div>

      {/* Ações */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', maxWidth: '300px' }}>
        <button
          onClick={() => navigate(`/operador/cursos/${cursoId}`)}
          style={{
            background: 'linear-gradient(135deg, #c0392b 0%, #922b21 100%)',
            border: 'none', borderRadius: '14px', padding: '16px',
            fontSize: '15px', fontWeight: 700, color: '#fff', cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(192,57,43,0.4)',
          }}
        >
          {aprovado ? 'Ver curso' : 'Estudar novamente'}
        </button>
        <button
          onClick={() => navigate('/operador/cursos')}
          style={{
            background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '14px', padding: '14px',
            fontSize: '14px', fontWeight: 600, color: 'rgba(255,255,255,0.8)', cursor: 'pointer',
          }}
        >
          Ver todos os cursos
        </button>
      </div>
    </div>
  )
}

export default function OperadorProvaPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const [respostas, setRespostas] = useState<Record<number, number>>({})
  const [currentIndex, setCurrentIndex] = useState(0)
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [error, setError] = useState('')

  const { data: provaData, isLoading } = useQuery({
    queryKey: ['operador-prova', id],
    queryFn: async () => {
      const curso = await operadorCursosApi.get(Number(id))
      if (!curso.prova?.id) throw new Error('Prova não encontrada')
      return operadorCursosApi.getQuestoes(curso.prova.id)
    },
    enabled: !!id,
  })

  const submitMutation = useMutation({
    mutationFn: () => {
      const provaId = provaData!.id
      const payload = Object.entries(respostas).map(([questao_id, alternativa_id]) => ({
        questao_id: Number(questao_id),
        alternativa_id,
      }))
      return operadorCursosApi.submitTentativa(provaId, payload)
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['operador-cursos'] })
      qc.invalidateQueries({ queryKey: ['operador-pendencias'] })
      qc.invalidateQueries({ queryKey: ['operador-curso', id] })
      qc.invalidateQueries({ queryKey: ['operador-cursos-pontos'] })
      setResultado(data)
    },
    onError: (e: Error) => setError(e.message),
  })

  if (isLoading) {
    return (
      <div style={{ minHeight: '100dvh', maxWidth: '430px', margin: '0 auto', display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
        <div style={{ background: 'linear-gradient(135deg, #c0392b 0%, #922b21 100%)', height: '4px', flexShrink: 0 }} />
        <div style={{ padding: '24px 18px', display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
          <SkeletonLine width="30%" height="12px" />
          <div style={{ borderRadius: '20px', background: '#fff', padding: '24px', boxShadow: '0 4px 16px rgba(15,23,42,0.06)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <SkeletonLine width="90%" height="16px" />
            <SkeletonLine width="75%" height="16px" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <SkeletonBlock height="56px" style={{ borderRadius: '14px' }} />
            <SkeletonBlock height="56px" style={{ borderRadius: '14px' }} />
            <SkeletonBlock height="56px" style={{ borderRadius: '14px' }} />
            <SkeletonBlock height="56px" style={{ borderRadius: '14px' }} />
          </div>
        </div>
      </div>
    )
  }

  if (resultado) {
    return <ResultadoScreen resultado={resultado} cursoId={id!} />
  }

  const questoes: QuestaoRecord[] = provaData?.questoes ?? []
  const total = questoes.length
  const current = questoes[currentIndex]
  const progress = total > 0 ? ((currentIndex + 1) / total) * 100 : 0
  const answered = Object.keys(respostas).length

  if (!current) return null

  const handleAnswer = (altId: number) => {
    setRespostas((prev) => ({ ...prev, [current.id]: altId }))
  }

  const handleNext = () => {
    if (currentIndex < total - 1) setCurrentIndex((i) => i + 1)
  }

  const handlePrev = () => {
    if (currentIndex > 0) setCurrentIndex((i) => i - 1)
  }

  const handleSubmit = () => {
    setError('')
    if (answered < total) { setError('Responda todas as questões antes de finalizar.'); return }
    submitMutation.mutate()
  }

  const selectedAlt = respostas[current.id]

  return (
    <div style={{ minHeight: '100dvh', background: '#f8fafc', maxWidth: '430px', margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
      {/* Header com progresso */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0' }}>
        {/* Faixa vermelha de topo */}
        <div style={{ height: '4px', background: 'linear-gradient(90deg, #c0392b 0%, #922b21 100%)' }} />
        <div style={{ padding: '14px 16px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <button
              onClick={() => navigate(`/operador/cursos/${id}`)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c0392b', padding: 0, display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: 600 }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
              Sair
            </button>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
              {currentIndex + 1} <span style={{ color: '#94a3b8', fontWeight: 400 }}>/ {total}</span>
            </span>
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>{answered} respondidas</span>
          </div>
          {/* Barra de progresso */}
          <div style={{ height: '5px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, #c0392b 0%, #e74c3c 100%)', borderRadius: '4px', transition: 'width 0.3s ease' }} />
          </div>
        </div>
      </div>

      {/* Questão */}
      <div style={{ flex: 1, padding: '24px 16px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: '#fff', borderRadius: '16px', padding: '20px', marginBottom: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Questão {currentIndex + 1}
          </p>
          <p style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1e293b', lineHeight: 1.5 }}>
            {current.enunciado}
          </p>
        </div>

        {/* Alternativas */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
          {current.alternativas.map((alt, i) => {
            const isSelected = selectedAlt === alt.id
            return (
              <button
                key={alt.id}
                onClick={() => handleAnswer(alt.id)}
                style={{
                  background: isSelected ? '#c0392b' : '#fff',
                  border: `2px solid ${isSelected ? '#c0392b' : '#e2e8f0'}`,
                  borderRadius: '12px',
                  padding: '14px 16px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  transition: 'all 0.15s ease',
                  boxShadow: isSelected ? '0 2px 12px rgba(192,57,43,0.25)' : 'none',
                }}
              >
                <span style={{
                  width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                  background: isSelected ? 'rgba(255,255,255,0.2)' : '#f1f5f9',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '12px', fontWeight: 700,
                  color: isSelected ? '#fff' : '#64748b',
                }}>
                  {String.fromCharCode(65 + i)}
                </span>
                <span style={{ fontSize: '14px', fontWeight: isSelected ? 600 : 400, color: isSelected ? '#fff' : '#334155', lineHeight: 1.4 }}>
                  {alt.texto}
                </span>
              </button>
            )
          })}
        </div>

        {error && <p style={{ marginTop: '12px', fontSize: '13px', color: '#dc2626', textAlign: 'center' }}>{error}</p>}
      </div>

      {/* Navegação */}
      <div style={{ background: '#fff', borderTop: '1px solid #e2e8f0', padding: '16px', display: 'flex', gap: '10px' }}>
        <button
          onClick={handlePrev}
          disabled={currentIndex === 0}
          style={{
            flex: 1, background: 'none', border: '2px solid #e2e8f0', borderRadius: '12px', padding: '14px',
            fontSize: '14px', fontWeight: 600, color: '#64748b', cursor: currentIndex === 0 ? 'not-allowed' : 'pointer',
            opacity: currentIndex === 0 ? 0.4 : 1,
          }}
        >
          Anterior
        </button>

        {currentIndex < total - 1 ? (
          <button
            onClick={handleNext}
            disabled={!selectedAlt}
            style={{
              flex: 2,
              background: selectedAlt ? 'linear-gradient(135deg, #c0392b 0%, #922b21 100%)' : '#f1f5f9',
              border: 'none', borderRadius: '12px', padding: '14px',
              fontSize: '14px', fontWeight: 700, color: selectedAlt ? '#fff' : '#94a3b8',
              cursor: selectedAlt ? 'pointer' : 'not-allowed',
              transition: 'all 0.15s ease',
              boxShadow: selectedAlt ? '0 4px 12px rgba(192,57,43,0.28)' : 'none',
            }}
          >
            Próxima →
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitMutation.isPending}
            style={{
              flex: 2, background: 'linear-gradient(135deg, #c0392b 0%, #922b21 100%)',
              border: 'none', borderRadius: '12px', padding: '14px',
              fontSize: '14px', fontWeight: 700, color: '#fff', cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(192,57,43,0.3)',
              opacity: submitMutation.isPending ? 0.7 : 1,
            }}
          >
            {submitMutation.isPending ? 'Enviando...' : 'Finalizar Prova'}
          </button>
        )}
      </div>
    </div>
  )
}
