import { useMemo, useState, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { extractApiErrorMessage, operadorObraService, type EquipamentoRecord, type OperadorObraLookup } from '@/lib/gontijo-api'

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

function buildAddress(obra: OperadorObraLookup) {
  const endereco = obra.endereco
  return [
    endereco.logradouro,
    endereco.numero,
    endereco.bairro,
    endereco.cidade,
    endereco.estado,
  ].filter(Boolean).join(', ')
}

function EquipmentButton({ equipment, selected, onClick }: { equipment: EquipamentoRecord; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        border: selected ? '2px solid #c0392b' : '1px solid #d1d5db',
        borderRadius: '14px',
        background: selected ? '#fff7f6' : '#fff',
        padding: '14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        textAlign: 'left',
        cursor: 'pointer',
      }}
    >
      <span style={{ fontSize: '15px', fontWeight: 800, color: '#111827' }}>{equipment.nome}</span>
      <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 700 }}>
        {equipment.modalidadeNome || 'Modalidade nao informada'}
      </span>
      <span style={{ fontSize: '12px', color: '#4b5563' }}>
        IMEI: {equipment.imei || 'Nao informado'}
      </span>
    </button>
  )
}

export default function DiarioNovoObra() {
  const navigate = useNavigate()
  const [obraNumero, setObraNumero] = useState('')
  const [obra, setObra] = useState<OperadorObraLookup | null>(null)
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<number | null>(null)

  const lookupMutation = useMutation({
    mutationFn: operadorObraService.lookup,
    onSuccess: (data) => {
      setObra(data)
      setSelectedEquipmentId(data.equipamentos[0]?.id ?? null)
    },
  })

  const selectedEquipment = useMemo(
    () => obra?.equipamentos.find((item) => item.id === selectedEquipmentId) ?? null,
    [obra?.equipamentos, selectedEquipmentId],
  )

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const numero = obraNumero.trim()
    if (!numero) return
    setObra(null)
    setSelectedEquipmentId(null)
    lookupMutation.mutate(numero)
  }

  function handleContinue() {
    if (!obra || !selectedEquipment) return
    navigate(`/operador/diario-de-obras/novo/${selectedEquipment.id}?obra=${encodeURIComponent(obra.numero)}`)
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
      <OperadorHeader />

      <div style={{ padding: '24px 20px 32px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label htmlFor="obra-numero" style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#1f2937' }}>
              Numero da obra
            </label>
            <p style={{ margin: 0, fontSize: '13px', color: '#6b7280', lineHeight: '1.5' }}>
              Digite o numero exato da obra para carregar os equipamentos cadastrados nela.
            </p>
          </div>

          <input
            id="obra-numero"
            type="text"
            inputMode="numeric"
            value={obraNumero}
            onChange={(event) => setObraNumero(event.target.value)}
            placeholder="Ex: 22365"
            style={{
              width: '100%',
              border: '1px solid #cbd5e1',
              borderRadius: '14px',
              padding: '14px 15px',
              fontSize: '18px',
              fontWeight: 800,
              color: '#111827',
              outline: 'none',
            }}
          />

          <button
            type="submit"
            disabled={lookupMutation.isPending || !obraNumero.trim()}
            style={{
              border: 'none',
              borderRadius: '14px',
              background: lookupMutation.isPending || !obraNumero.trim() ? '#d1d5db' : '#c0392b',
              color: '#fff',
              minHeight: '48px',
              padding: '0 16px',
              fontSize: '14px',
              fontWeight: 800,
              cursor: lookupMutation.isPending || !obraNumero.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            {lookupMutation.isPending ? 'Buscando obra...' : 'Buscar obra'}
          </button>
        </form>

        {lookupMutation.isError ? (
          <div
            style={{
              border: '1px solid #fecaca',
              borderRadius: '14px',
              padding: '16px',
              background: '#fef2f2',
              color: '#b91c1c',
              fontSize: '14px',
              lineHeight: '1.5',
            }}
          >
            {extractApiErrorMessage(lookupMutation.error)}
          </div>
        ) : null}

        {obra ? (
          <section
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: '16px',
              background: '#fff',
              padding: '16px',
              boxShadow: '0 1px 3px rgba(15,23,42,0.06)',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Obra
                </span>
                <span style={{ fontSize: '24px', fontWeight: 900, color: '#111827', lineHeight: 1 }}>
                  {obra.numero}
                </span>
              </div>
              <span style={{ fontSize: '12px', color: '#991b1b', background: '#fef2f2', borderRadius: '999px', padding: '6px 10px', fontWeight: 800 }}>
                {obra.status}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <span style={{ fontSize: '13px', color: '#1f2937', fontWeight: 800 }}>
                {obra.cliente || 'Cliente nao informado'}
              </span>
              <span style={{ fontSize: '12px', color: '#6b7280', lineHeight: '1.45' }}>
                {buildAddress(obra) || 'Endereco nao informado'}
              </span>
            </div>

            {obra.equipamentos.length ? (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '12px', color: '#374151', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Equipamento
                  </span>
                  {obra.equipamentos.map((equipment) => (
                    <EquipmentButton
                      key={equipment.id}
                      equipment={equipment}
                      selected={equipment.id === selectedEquipmentId}
                      onClick={() => setSelectedEquipmentId(equipment.id)}
                    />
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleContinue}
                  disabled={!selectedEquipment}
                  style={{
                    border: 'none',
                    borderRadius: '14px',
                    background: selectedEquipment ? '#c0392b' : '#d1d5db',
                    color: '#fff',
                    minHeight: '50px',
                    padding: '0 16px',
                    fontSize: '14px',
                    fontWeight: 900,
                    cursor: selectedEquipment ? 'pointer' : 'not-allowed',
                  }}
                >
                  Continuar
                </button>
              </>
            ) : (
              <div
                style={{
                  border: '1px solid #fed7aa',
                  borderRadius: '14px',
                  padding: '16px',
                  background: '#fff7ed',
                  color: '#9a3412',
                  fontSize: '13px',
                  lineHeight: '1.5',
                  fontWeight: 700,
                }}
              >
                Esta obra nao tem equipamentos ativos cadastrados. Cadastre os equipamentos possiveis na aba Obras antes de iniciar o diario.
              </div>
            )}
          </section>
        ) : null}
      </div>
    </div>
  )
}
