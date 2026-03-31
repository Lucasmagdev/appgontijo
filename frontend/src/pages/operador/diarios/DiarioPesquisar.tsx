import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { diarioService, extractApiErrorMessage } from '@/lib/gontijo-api'

type DiarioResultado = Awaited<ReturnType<typeof diarioService.list>>

export default function DiarioPesquisar() {
  const navigate = useNavigate()
  const [busca, setBusca] = useState('')
  const [resultado, setResultado] = useState<DiarioResultado | null>(null)
  const [naoEncontrado, setNaoEncontrado] = useState(false)
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleBuscar(e: React.FormEvent) {
    e.preventDefault()
    const numero = busca.trim()
    if (!numero) return

    setLoading(true)
    setResultado(null)
    setNaoEncontrado(false)
    setErro('')

    try {
      const diarios = await diarioService.list({ obra: numero, page: 1, limit: 20 })
      setResultado(diarios)
      setNaoEncontrado(diarios.items.length === 0)
    } catch (error) {
      setErro(extractApiErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  function openPdf(id: number) {
    window.open(diarioService.getPdfUrl(id), '_blank', 'noopener,noreferrer')
  }

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
          onClick={() => navigate('/operador/diario-de-obras')}
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
        <span style={{ color: '#fff', fontSize: '18px', fontWeight: 700, letterSpacing: '0.04em' }}>
          Pesquisar Diario
        </span>
      </div>

      <div style={{ padding: '28px 20px 32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <p style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#1f2937' }}>
            Procure diarios pelo numero da obra
          </p>
          <p style={{ margin: 0, fontSize: '13px', color: '#6b7280', lineHeight: '1.5' }}>
            Digite o numero da obra para encontrar os diarios que ja foram registrados.
          </p>
        </div>

        <form onSubmit={handleBuscar} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <label
            style={{
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '0.1em',
              color: '#888',
              textTransform: 'uppercase',
            }}
          >
            Numero da obra
          </label>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              type="text"
              inputMode="numeric"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Ex: 1042"
              style={{
                flex: 1,
                border: '2px solid #e0e0e0',
                borderRadius: '10px',
                padding: '14px 16px',
                fontSize: '18px',
                fontWeight: 600,
                color: '#1a1a1a',
                outline: 'none',
                letterSpacing: '0.04em',
              }}
              autoFocus
            />
            <button
              type="submit"
              disabled={loading || !busca.trim()}
              style={{
                background: loading || !busca.trim() ? '#ccc' : '#c0392b',
                border: 'none',
                borderRadius: '10px',
                width: '52px',
                cursor: loading || !busca.trim() ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </button>
          </div>
        </form>

        {erro ? (
          <div
            style={{
              border: '1px solid #fecaca',
              borderRadius: '14px',
              padding: '16px',
              background: '#fef2f2',
              color: '#b91c1c',
              fontSize: '14px',
            }}
          >
            {erro}
          </div>
        ) : null}

        {loading ? (
          <div
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: '14px',
              padding: '16px',
              background: '#f8fafc',
              color: '#6b7280',
              fontSize: '14px',
            }}
          >
            Buscando diarios...
          </div>
        ) : null}

        {resultado?.items.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {resultado.items.map((item) => (
              <div
                key={item.id}
                style={{
                  border: '1px solid #d1d5db',
                  borderRadius: '16px',
                  background: '#fff',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  boxShadow: '0 1px 3px rgba(15,23,42,0.06)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'start' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Obra
                    </span>
                    <span style={{ fontSize: '20px', fontWeight: 800, color: '#111827', lineHeight: 1 }}>
                      {item.obraNumero || '-'}
                    </span>
                  </div>
                  <span
                    style={{
                      borderRadius: '999px',
                      padding: '5px 10px',
                      background:
                        item.status === 'assinado'
                          ? '#dcfce7'
                          : item.status === 'pendente'
                            ? '#fee2e2'
                            : '#e5e7eb',
                      color:
                        item.status === 'assinado'
                          ? '#166534'
                          : item.status === 'pendente'
                            ? '#b91c1c'
                            : '#4b5563',
                      fontSize: '11px',
                      fontWeight: 800,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {item.status}
                  </span>
                </div>

                <div style={{ display: 'grid', gap: '8px' }}>
                  <div>
                    <span style={{ display: 'block', fontSize: '11px', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Equipamento
                    </span>
                    <span style={{ display: 'block', marginTop: '3px', fontSize: '14px', fontWeight: 700, color: '#1f2937' }}>
                      {item.equipamento || '-'}
                    </span>
                  </div>

                  <div>
                    <span style={{ display: 'block', fontSize: '11px', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Data
                    </span>
                    <span style={{ display: 'block', marginTop: '3px', fontSize: '14px', color: '#4b5563', fontWeight: 600 }}>
                      {item.dataDiario || '-'}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => openPdf(item.id)}
                  style={{
                    border: 'none',
                    borderRadius: '10px',
                    background: '#c0392b',
                    color: '#fff',
                    padding: '13px 14px',
                    fontSize: '13px',
                    fontWeight: 800,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                  }}
                >
                  Abrir PDF
                </button>
              </div>
            ))}
          </div>
        ) : null}

        {naoEncontrado ? (
          <div
            style={{
              textAlign: 'center',
              padding: '32px 0',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ddd" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <p style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#444' }}>
              Nenhum diario encontrado
            </p>
            <p style={{ margin: 0, fontSize: '13px', color: '#999' }}>
              Tente outro numero de obra.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
