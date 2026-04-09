import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { operadorFatoObservadoApi } from '@/lib/gontijo-api'
import OperadorBottomNav from '@/components/operador/OperadorBottomNav'

type Tipo = 'positivo' | 'negativo'

export default function FatoObservadoPage() {
  const navigate = useNavigate()
  const [tipo, setTipo] = useState<Tipo>('negativo')
  const [localRef, setLocalRef] = useState('')
  const [descricao, setDescricao] = useState('')
  const [loading, setLoading] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [erro, setErro] = useState('')

  const isPos = tipo === 'positivo'
  const corPrimaria = isPos ? '#15803d' : '#c0392b'
  const corClara = isPos ? '#dcfce7' : '#fee2e2'
  const corTexto = isPos ? '#14532d' : '#7f1d1d'
  const label = isPos ? 'FO+' : 'FO−'
  const labelFull = isPos ? 'FATO OBSERVADO POSITIVO' : 'FATO OBSERVADO NEGATIVO'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!descricao.trim()) { setErro('Descrição obrigatória.'); return }
    setErro('')
    setLoading(true)
    try {
      await operadorFatoObservadoApi.registrar({ tipo, local_ref: localRef, descricao })
      setEnviado(true)
    } catch {
      setErro('Falha ao registrar. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  if (enviado) {
    return (
      <div style={{ minHeight: '100dvh', background: '#f8fafc', display: 'flex', flexDirection: 'column', maxWidth: '430px', margin: '0 auto' }}>
        <div style={{ background: corPrimaria, padding: '48px 20px 24px' }}>
          <button onClick={() => navigate('/operador')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: 0, marginBottom: '16px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            Voltar
          </button>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: '#fff', letterSpacing: '0.04em' }}>FATO OBSERVADO</h1>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px', textAlign: 'center' }}>
          <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: corClara, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={corPrimaria} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <p style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: corTexto, letterSpacing: '0.06em' }}>{label} REGISTRADO</p>
          <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#64748b' }}>Fato observado enviado com sucesso.</p>
          <button
            onClick={() => { setEnviado(false); setLocalRef(''); setDescricao('') }}
            style={{ marginTop: '28px', padding: '14px 32px', background: corPrimaria, border: 'none', borderRadius: '12px', color: '#fff', fontSize: '14px', fontWeight: 800, cursor: 'pointer', letterSpacing: '0.06em' }}
          >
            NOVO REGISTRO
          </button>
          <button
            onClick={() => navigate('/operador')}
            style={{ marginTop: '12px', padding: '12px 32px', background: 'none', border: '1.5px solid #e2e8f0', borderRadius: '12px', color: '#64748b', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
          >
            Voltar ao início
          </button>
        </div>
        <OperadorBottomNav />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#f8fafc', display: 'flex', flexDirection: 'column', maxWidth: '430px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ background: corPrimaria, padding: '48px 20px 20px', position: 'relative', overflow: 'hidden', transition: 'background 0.3s' }}>
        <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '150px', height: '150px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
        <button onClick={() => navigate('/operador')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: 0, marginBottom: '16px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          Voltar
        </button>
        <p style={{ margin: 0, fontSize: '11px', fontWeight: 800, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          GONTIJO FUNDAÇÕES
        </p>
        <h1 style={{ margin: '4px 0 0', fontSize: '22px', fontWeight: 800, color: '#fff', letterSpacing: '0.04em' }}>FATO OBSERVADO</h1>
        <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'rgba(255,255,255,0.7)', letterSpacing: '0.04em' }}>{labelFull}</p>
      </div>

      {/* Toggle FO+ / FO- */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ display: 'flex', background: '#e2e8f0', borderRadius: '14px', padding: '4px', gap: '4px' }}>
          {(['negativo', 'positivo'] as Tipo[]).map((t) => {
            const sel = tipo === t
            const bg = t === 'positivo' ? '#15803d' : '#c0392b'
            const lbl = t === 'positivo' ? 'FO+  Positivo' : 'FO−  Negativo'
            return (
              <button
                key={t}
                onClick={() => setTipo(t)}
                style={{
                  flex: 1,
                  padding: '12px 8px',
                  borderRadius: '10px',
                  border: 'none',
                  background: sel ? bg : 'transparent',
                  color: sel ? '#fff' : '#64748b',
                  fontSize: '14px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  letterSpacing: '0.04em',
                  transition: 'all 0.2s',
                  boxShadow: sel ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
                }}
              >
                {lbl}
              </button>
            )
          })}
        </div>
      </div>

      {/* Indicador de tipo */}
      <div style={{ padding: '12px 16px 0' }}>
        <div style={{ background: corClara, borderRadius: '10px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: corPrimaria, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {isPos ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            )}
          </div>
          <div>
            <p style={{ margin: 0, fontSize: '11px', fontWeight: 800, color: corTexto, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {isPos ? 'Ocorrência positiva' : 'Ocorrência negativa'}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: '11px', color: corPrimaria }}>
              {isPos ? 'Boa prática, melhoria ou destaque observado em campo.' : 'Não conformidade, risco ou problema identificado.'}
            </p>
          </div>
        </div>
      </div>

      {/* Formulário */}
      <form onSubmit={handleSubmit} style={{ padding: '16px 16px 112px', display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
        {/* Local / Referência */}
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
            Local / Referência
          </label>
          <input
            type="text"
            value={localRef}
            onChange={(e) => setLocalRef(e.target.value)}
            placeholder="Ex: Obra Rua das Flores, Setor A, Equip. 03..."
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: '10px',
              border: '1.5px solid #e2e8f0',
              fontSize: '14px',
              color: '#0f172a',
              background: '#fff',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Descrição */}
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
            Descrição <span style={{ color: corPrimaria }}>*</span>
          </label>
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder={isPos
              ? 'Descreva o fato positivo observado de forma objetiva...'
              : 'Descreva o problema ou não conformidade de forma objetiva...'}
            rows={5}
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: '10px',
              border: `1.5px solid ${erro ? '#dc2626' : '#e2e8f0'}`,
              fontSize: '14px',
              color: '#0f172a',
              background: '#fff',
              outline: 'none',
              resize: 'vertical',
              fontFamily: 'inherit',
              lineHeight: 1.5,
              boxSizing: 'border-box',
            }}
          />
          {erro && <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#dc2626' }}>{erro}</p>}
        </div>

        {/* Data/hora automática */}
        <div style={{ background: '#f1f5f9', borderRadius: '10px', padding: '10px 14px' }}>
          <p style={{ margin: 0, fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Data/hora do registro
          </p>
          <p style={{ margin: '2px 0 0', fontSize: '13px', fontWeight: 700, color: '#334155' }}>
            {new Date().toLocaleString('pt-BR', { dateStyle: 'full', timeStyle: 'short' })}
          </p>
        </div>

        <div style={{ flex: 1 }} />

        {/* Botão */}
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '16px',
            background: loading ? '#94a3b8' : corPrimaria,
            border: 'none',
            borderRadius: '14px',
            color: '#fff',
            fontSize: '15px',
            fontWeight: 800,
            cursor: loading ? 'not-allowed' : 'pointer',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            boxShadow: loading ? 'none' : `0 8px 20px ${corPrimaria}44`,
          }}
        >
          {loading ? 'Registrando...' : `Registrar ${label}`}
        </button>
      </form>
      <OperadorBottomNav />
    </div>
  )
}
