import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { operadorIndicacoesApi } from '@/lib/gontijo-api'
import OperadorBottomNav from '@/components/operador/OperadorBottomNav'

const TIPOS_SERVICO = [
  'Fundação por estacas',
  'Contenção / Muro de arrimo',
  'Sondagem / Investigação',
  'Micro-estacas',
  'Tirantes',
  'Outro',
]

export default function IndiqueUmaObraPage() {
  const navigate = useNavigate()
  const [contatoNome, setContatoNome] = useState('')
  const [contatoTel, setContatoTel] = useState('')
  const [endereco, setEndereco] = useState('')
  const [tipoServico, setTipoServico] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [loading, setLoading] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [erros, setErros] = useState<Record<string, string>>({})

  function validate() {
    const e: Record<string, string> = {}
    if (!contatoNome.trim()) e.contatoNome = 'Informe o nome do contato.'
    if (!endereco.trim()) e.endereco = 'Informe o endereço da obra.'
    return e
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    const e = validate()
    if (Object.keys(e).length > 0) { setErros(e); return }
    setErros({})
    setLoading(true)
    try {
      await operadorIndicacoesApi.indicar({ contato_nome: contatoNome, contato_telefone: contatoTel, endereco, tipo_servico: tipoServico, observacoes })
      setEnviado(true)
    } catch {
      setErros({ geral: 'Falha ao enviar. Tente novamente.' })
    } finally {
      setLoading(false)
    }
  }

  if (enviado) {
    return (
      <div style={{ minHeight: '100dvh', background: '#f8fafc', display: 'flex', flexDirection: 'column', maxWidth: '430px', margin: '0 auto' }}>
        <div style={{ background: 'linear-gradient(135deg, #c0392b 0%, #922b21 100%)', padding: '48px 20px 24px' }}>
          <button onClick={() => navigate('/operador')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: 0, marginBottom: '16px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            Voltar
          </button>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: '#fff' }}>Indique uma Obra</h1>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px', textAlign: 'center' }}>
          <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <p style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#14532d' }}>Indicação enviada!</p>
          <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
            Nossa equipe comercial vai analisar<br />e entrar em contato. Obrigado!
          </p>
          <button
            onClick={() => { setEnviado(false); setContatoNome(''); setContatoTel(''); setEndereco(''); setTipoServico(''); setObservacoes('') }}
            style={{ marginTop: '28px', padding: '14px 32px', background: '#c0392b', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}
          >
            Nova indicação
          </button>
          <button
            onClick={() => navigate('/operador')}
            style={{ marginTop: '12px', padding: '12px 32px', background: 'none', border: '1.5px solid #e2e8f0', borderRadius: '12px', color: '#64748b', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
          >
            Voltar ao início
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#f8fafc', display: 'flex', flexDirection: 'column', maxWidth: '430px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #c0392b 0%, #922b21 100%)', padding: '48px 20px 24px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '150px', height: '150px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
        <button onClick={() => navigate('/operador')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: 0, marginBottom: '16px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          Voltar
        </button>
        <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: '#fff' }}>Indique uma Obra</h1>
        <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'rgba(255,255,255,0.8)' }}>
          Conhece uma obra que pode ser cliente? Indique para o comercial!
        </p>
      </div>

      {/* Formulário */}
      <form onSubmit={handleSubmit} style={{ padding: '20px 16px 112px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {erros.geral && (
          <div style={{ background: '#fee2e2', borderRadius: '10px', padding: '12px 14px' }}>
            <p style={{ margin: 0, fontSize: '13px', color: '#dc2626', fontWeight: 600 }}>{erros.geral}</p>
          </div>
        )}

        {/* Nome do contato */}
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
            Nome do contato <span style={{ color: '#c0392b' }}>*</span>
          </label>
          <input
            type="text"
            value={contatoNome}
            onChange={(e) => setContatoNome(e.target.value)}
            placeholder="Responsável / proprietário"
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: '10px',
              border: `1.5px solid ${erros.contatoNome ? '#dc2626' : '#e2e8f0'}`,
              fontSize: '14px',
              color: '#0f172a',
              background: '#fff',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          {erros.contatoNome && <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#dc2626' }}>{erros.contatoNome}</p>}
        </div>

        {/* Telefone */}
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
            Telefone / WhatsApp
          </label>
          <input
            type="tel"
            value={contatoTel}
            onChange={(e) => setContatoTel(e.target.value)}
            placeholder="(31) 9 9999-9999"
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

        {/* Endereço */}
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
            Endereço da obra <span style={{ color: '#c0392b' }}>*</span>
          </label>
          <textarea
            value={endereco}
            onChange={(e) => setEndereco(e.target.value)}
            placeholder="Rua, número, bairro, cidade..."
            rows={3}
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: '10px',
              border: `1.5px solid ${erros.endereco ? '#dc2626' : '#e2e8f0'}`,
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
          {erros.endereco && <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#dc2626' }}>{erros.endereco}</p>}
        </div>

        {/* Tipo de serviço */}
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
            Tipo de serviço
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {TIPOS_SERVICO.map((t) => (
              <button
                type="button"
                key={t}
                onClick={() => setTipoServico(tipoServico === t ? '' : t)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '999px',
                  border: `1.5px solid ${tipoServico === t ? '#c0392b' : '#e2e8f0'}`,
                  background: tipoServico === t ? '#fee2e2' : '#fff',
                  color: tipoServico === t ? '#c0392b' : '#64748b',
                  fontSize: '12px',
                  fontWeight: tipoServico === t ? 700 : 500,
                  cursor: 'pointer',
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Observações */}
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
            Observações
          </label>
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Detalhes adicionais sobre a oportunidade..."
            rows={3}
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: '10px',
              border: '1.5px solid #e2e8f0',
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
        </div>

        {/* Botão */}
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '16px',
            background: loading ? '#94a3b8' : 'linear-gradient(135deg, #c0392b 0%, #922b21 100%)',
            border: 'none',
            borderRadius: '14px',
            color: '#fff',
            fontSize: '15px',
            fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: loading ? 'none' : '0 8px 20px rgba(192,57,43,0.30)',
          }}
        >
          {loading ? 'Enviando...' : 'Enviar indicação'}
        </button>
      </form>
      <OperadorBottomNav />
    </div>
  )
}
