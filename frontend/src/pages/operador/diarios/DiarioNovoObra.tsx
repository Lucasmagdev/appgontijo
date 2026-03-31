import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { equipamentoService, extractApiErrorMessage } from '@/lib/gontijo-api'

function OperadorHeader() {
  const navigate = useNavigate()

  return (
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
        Novo Diario
      </span>
    </div>
  )
}

export default function DiarioNovoObra() {
  const navigate = useNavigate()
  const equipamentosQuery = useQuery({
    queryKey: ['equipamentos-parametrizados'],
    queryFn: equipamentoService.listParametrizados,
  })

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
      <OperadorHeader />

      <div style={{ padding: '24px 20px 32px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <p style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#1f2937' }}>
            Escolha a maquina para iniciar o diario
          </p>
          <p style={{ margin: 0, fontSize: '13px', color: '#6b7280', lineHeight: '1.5' }}>
            Aqui aparecem somente as maquinas que ja estao parametrizadas com numero da obra e IMEI no administrativo.
          </p>
        </div>

        {equipamentosQuery.isLoading ? (
          <div
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: '14px',
              padding: '18px',
              background: '#f8fafc',
              color: '#6b7280',
              fontSize: '14px',
            }}
          >
            Carregando maquinas disponiveis...
          </div>
        ) : null}

        {equipamentosQuery.isError ? (
          <div
            style={{
              border: '1px solid #fecaca',
              borderRadius: '14px',
              padding: '18px',
              background: '#fef2f2',
              color: '#b91c1c',
              fontSize: '14px',
              lineHeight: '1.5',
            }}
          >
            {extractApiErrorMessage(equipamentosQuery.error)}
          </div>
        ) : null}

        {equipamentosQuery.data?.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {equipamentosQuery.data.map((equipamento) => (
              <button
                key={equipamento.id}
                onClick={() => navigate(`/operador/diario-de-obras/novo/${equipamento.id}`)}
                style={{
                  width: '100%',
                  border: '1px solid #d1d5db',
                  borderRadius: '16px',
                  background: '#fff',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  gap: '12px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  boxShadow: '0 1px 3px rgba(15,23,42,0.06)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Obra
                    </span>
                    <span style={{ fontSize: '22px', fontWeight: 800, color: '#111827', lineHeight: 1 }}>
                      {equipamento.obraNumero}
                    </span>
                  </div>

                  <span
                    style={{
                      minWidth: '38px',
                      minHeight: '38px',
                      borderRadius: '12px',
                      background: '#fef2f2',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#c0392b',
                      fontWeight: 800,
                    }}
                  >
                    M
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div>
                    <span style={{ display: 'block', fontSize: '11px', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Maquina
                    </span>
                    <span style={{ display: 'block', marginTop: '3px', fontSize: '15px', fontWeight: 700, color: '#1f2937' }}>
                      {equipamento.nome}
                    </span>
                  </div>

                  <div>
                    <span style={{ display: 'block', fontSize: '11px', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      IMEI
                    </span>
                    <span style={{ display: 'block', marginTop: '3px', fontSize: '14px', color: '#4b5563', fontWeight: 600 }}>
                      {equipamento.imei}
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    borderTop: '1px solid #f1f5f9',
                    paddingTop: '12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontSize: '13px', color: '#6b7280' }}>
                    Tocar para continuar
                  </span>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: '#c0392b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Selecionar
                  </span>
                </div>
              </button>
            ))}
          </div>
        ) : null}

        {!equipamentosQuery.isLoading && !equipamentosQuery.isError && !equipamentosQuery.data?.length ? (
          <div
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: '16px',
              padding: '24px 18px',
              background: '#f8fafc',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              textAlign: 'center',
            }}
          >
            <span style={{ fontSize: '16px', fontWeight: 700, color: '#334155' }}>
              Nenhuma maquina disponivel
            </span>
            <span style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.5' }}>
              Cadastre no administrativo o numero da obra e o IMEI do equipamento para ele aparecer aqui.
            </span>
          </div>
        ) : null}
      </div>
    </div>
  )
}
