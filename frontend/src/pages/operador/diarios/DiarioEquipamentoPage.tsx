import { useDeferredValue, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, Tractor } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { diarioService, equipamentoService, extractApiErrorMessage } from '@/lib/gontijo-api'

type Props = {
  diarioId: number
  equipamentoId?: string
}

function ConfirmSwapModal(_props: {
  machineName: string
  isSaving: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const { machineName, isSaving, onCancel, onConfirm } = _props

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(17,24,39,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        zIndex: 120,
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '360px',
          borderRadius: '24px',
          background: '#fff',
          boxShadow: '0 28px 60px rgba(15,23,42,0.22)',
          padding: '18px 18px 20px',
          display: 'grid',
          gap: '14px',
        }}
      >
        <div
          style={{
            width: '48px',
            height: '5px',
            borderRadius: '999px',
            background: '#e5e7eb',
            justifySelf: 'center',
          }}
        />

        <div style={{ display: 'grid', gap: '8px' }}>
          <div style={{ fontSize: '20px', fontWeight: 900, color: '#a72727' }}>Trocar maquina do diario?</div>
          <div style={{ fontSize: '14px', color: '#4b5563', lineHeight: '1.5' }}>
            O diario passara a usar <strong>{machineName}</strong> como maquina selecionada.
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <button
            onClick={onCancel}
            disabled={isSaving}
            style={{
              minHeight: '52px',
              borderRadius: '16px',
              border: '1px solid #d1d5db',
              background: '#fff',
              color: '#111827',
              fontSize: '15px',
              fontWeight: 800,
              cursor: isSaving ? 'not-allowed' : 'pointer',
            }}
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={isSaving}
            style={{
              minHeight: '52px',
              borderRadius: '16px',
              border: 'none',
              background: isSaving ? '#cbd5e1' : '#a72727',
              color: '#fff',
              fontSize: '15px',
              fontWeight: 800,
              cursor: isSaving ? 'not-allowed' : 'pointer',
              boxShadow: isSaving ? 'none' : '0 12px 24px rgba(167,39,39,0.18)',
            }}
          >
            {isSaving ? 'Salvando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function DiarioEquipamentoPage({ diarioId, equipamentoId }: Props) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search.trim().toLowerCase())
  const [submitError, setSubmitError] = useState('')
  const [pendingEquipmentId, setPendingEquipmentId] = useState<number | null>(null)

  const diarioQuery = useQuery({
    queryKey: ['operador-diario', diarioId],
    enabled: diarioId > 0,
    queryFn: () => diarioService.getById(diarioId),
  })

  const equipamentosQuery = useQuery({
    queryKey: ['equipamentos-parametrizados-operador'],
    queryFn: equipamentoService.listParametrizados,
  })

  const routeEquipmentId = Number(equipamentoId || '') || null
  const currentEquipmentId = diarioQuery.data?.equipamentoId ?? routeEquipmentId
  const diaryObraNumero = String(diarioQuery.data?.obraNumero || '').trim()
  const isEquipmentConfirmed = ((diarioQuery.data?.dadosJson as Record<string, unknown> | null)?.equipment_confirmed) === true

  const availableEquipments = useMemo(() => {
    const rows = (equipamentosQuery.data || []).filter((item) => item.status === 'ativo')
    if (!diaryObraNumero) {
      return currentEquipmentId ? rows.filter((item) => item.id === currentEquipmentId) : []
    }
    return rows.filter((item) => String(item.obraNumero || '').trim() === diaryObraNumero)
  }, [currentEquipmentId, diaryObraNumero, equipamentosQuery.data])

  const visibleEquipments = useMemo(() => {
    const rows = [...availableEquipments].filter((item) => {
      if (!deferredSearch) return true
      return item.nome.toLowerCase().includes(deferredSearch)
    })

    return rows.sort((left, right) => {
      if (left.id === currentEquipmentId) return -1
      if (right.id === currentEquipmentId) return 1
      return left.nome.localeCompare(right.nome, 'pt-BR')
    })
  }, [availableEquipments, currentEquipmentId, deferredSearch])

  const pendingEquipment =
    (pendingEquipmentId !== null ? availableEquipments.find((item) => item.id === pendingEquipmentId) : null) || null

  const mutation = useMutation({
    mutationFn: async (nextEquipmentId: number) => {
      if (!diarioQuery.data) throw new Error('Diario nao identificado. Feche e reabra esta aba.')

      const currentJson = (diarioQuery.data.dadosJson as Record<string, unknown> | null) || {}
      const selectedEquipment = availableEquipments.find((item) => item.id === nextEquipmentId) || null

      await diarioService.update(diarioQuery.data.id, {
        dataDiario: diarioQuery.data.dataDiario,
        status: diarioQuery.data.status,
        equipamentoId: nextEquipmentId,
        assinadoEm: diarioQuery.data.assinadoEm,
        dadosJson: {
          ...currentJson,
          equipment_confirmed: true,
          equipment_id: nextEquipmentId,
          equipment: selectedEquipment?.nome || currentJson.equipment || '',
          equipment_name: selectedEquipment?.nome || currentJson.equipment_name || '',
        },
      })

      return nextEquipmentId
    },
    onSuccess: async (nextEquipmentId) => {
      if (!nextEquipmentId) return
      setSubmitError('')
      setPendingEquipmentId(null)
      await queryClient.invalidateQueries({ queryKey: ['operador-diario', diarioId] })
      await queryClient.invalidateQueries({ queryKey: ['operador-diario-draft'] })
      navigate(`/operador/diario-de-obras/novo/${nextEquipmentId}`)
    },
    onError: (error) => {
      setSubmitError(extractApiErrorMessage(error))
      setPendingEquipmentId(null)
    },
  })

  function handleEquipmentTap(nextEquipmentId: number) {
    if (nextEquipmentId === currentEquipmentId && isEquipmentConfirmed) return
    setSubmitError('')
    setPendingEquipmentId(nextEquipmentId)
  }

  return (
    <>
      <div
        style={{
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(180deg, #f8f3f2 0%, #ffffff 24%)',
          maxWidth: '430px',
          margin: '0 auto',
        }}
      >
        <div
          style={{
            background: 'linear-gradient(180deg, #a72727 0%, #981f1f 100%)',
            padding: '0 16px',
            height: '72px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            flexShrink: 0,
          }}
        >
          <button
            onClick={() => navigate(`/operador/diario-de-obras/novo/${currentEquipmentId || equipamentoId || ''}`)}
            style={{
              background: 'rgba(0,0,0,0.28)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '12px',
              width: '40px',
              height: '40px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div style={{ color: '#fff', fontSize: '21px', fontWeight: 800 }}>Equipamento</div>
        </div>

        <div style={{ padding: '22px 18px 24px', display: 'grid', gap: '18px' }}>
          <div
            style={{
              borderRadius: '24px',
              background: '#fff',
              border: '1px solid rgba(167,39,39,0.14)',
              boxShadow: '0 18px 32px rgba(15,23,42,0.08)',
              padding: '20px 18px',
              display: 'grid',
              gap: '14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '16px',
                  background: '#fff1f1',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <Tractor size={24} color="#a72727" />
              </div>
              <div>
                <div style={{ fontSize: '24px', fontWeight: 900, color: '#a72727' }}>Selecionar equipamento</div>
                <div style={{ fontSize: '14px', color: '#6b7280', lineHeight: '1.4' }}>
                  Escolha qual maquina ativa desta obra sera usada neste diario.
                </div>
              </div>
            </div>

            <div
              style={{
                borderRadius: '18px',
                background: '#f8fafc',
                border: '1px solid #e5e7eb',
                padding: '14px 16px',
                display: 'grid',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#475569' }}>Maquinas disponiveis nesta obra</span>
                <span style={{ fontSize: '13px', fontWeight: 900, color: '#166534' }}>{availableEquipments.length}</span>
              </div>

              <div
                style={{
                  minHeight: '52px',
                  borderRadius: '16px',
                  border: '1.5px solid #d8dee7',
                  background: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '0 14px',
                }}
              >
                <Search size={18} color="#6b7280" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por nome da maquina"
                  style={{
                    border: 'none',
                    outline: 'none',
                    flex: 1,
                    fontSize: '15px',
                    fontWeight: 600,
                    color: '#111827',
                    background: 'transparent',
                  }}
                />
              </div>
            </div>

            {diarioQuery.isLoading || equipamentosQuery.isLoading ? (
              <div style={{ color: '#6b7280', fontSize: '14px' }}>Carregando maquinas disponiveis...</div>
            ) : null}

            {diarioQuery.isError ? (
              <div
                style={{
                  border: '1px solid #fecaca',
                  borderRadius: '14px',
                  padding: '14px',
                  background: '#fef2f2',
                  color: '#b91c1c',
                  fontSize: '14px',
                }}
              >
                {extractApiErrorMessage(diarioQuery.error)}
              </div>
            ) : null}

            {equipamentosQuery.isError ? (
              <div
                style={{
                  border: '1px solid #fecaca',
                  borderRadius: '14px',
                  padding: '14px',
                  background: '#fef2f2',
                  color: '#b91c1c',
                  fontSize: '14px',
                }}
              >
                {extractApiErrorMessage(equipamentosQuery.error)}
              </div>
            ) : null}

            {!diarioQuery.isLoading && !equipamentosQuery.isLoading && !visibleEquipments.length ? (
              <div
                style={{
                  borderRadius: '18px',
                  border: '1px dashed #cbd5e1',
                  background: '#fff',
                  padding: '18px 16px',
                  fontSize: '14px',
                  color: '#6b7280',
                  lineHeight: '1.5',
                  textAlign: 'center',
                }}
              >
                {deferredSearch
                  ? 'Nenhuma maquina encontrada para essa busca.'
                  : 'Nenhuma maquina ativa parametrizada encontrada para esta obra.'}
              </div>
            ) : null}

            <div style={{ display: 'grid', gap: '12px' }}>
              {visibleEquipments.map((item) => {
                const selected = item.id === currentEquipmentId
                return (
                  <button
                    key={item.id}
                    onClick={() => handleEquipmentTap(item.id)}
                    disabled={mutation.isPending}
                      style={{
                        border: `1.5px solid ${selected ? 'rgba(15,23,42,0.08)' : 'rgba(185,28,28,0.18)'}`,
                        borderRadius: '22px',
                        background: selected ? '#f9fafb' : 'linear-gradient(180deg, #ffffff 0%, #fff7f7 100%)',
                        boxShadow: selected
                          ? '0 10px 20px rgba(15,23,42,0.05)'
                          : '0 12px 26px rgba(185,28,28,0.08)',
                        padding: '16px',
                        display: 'grid',
                        gap: '10px',
                        cursor: mutation.isPending ? 'not-allowed' : selected && isEquipmentConfirmed ? 'default' : 'pointer',
                        textAlign: 'left',
                      }}
                    >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '17px',
                          fontWeight: 900,
                          color: selected ? '#1f2937' : '#991b1b',
                        }}
                      >
                        <Tractor size={18} />
                        {item.nome}
                      </div>

                        {selected ? (
                          <span
                            style={{
                              padding: '7px 10px',
                              borderRadius: '999px',
                              background: isEquipmentConfirmed ? '#eef2f7' : '#fff1f1',
                              color: isEquipmentConfirmed ? '#475569' : '#a72727',
                              fontSize: '11px',
                              fontWeight: 800,
                              flexShrink: 0,
                            }}
                          >
                            {isEquipmentConfirmed ? 'Maquina atual' : 'Confirmar maquina'}
                          </span>
                        ) : null}
                      </div>

                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#6b7280' }}>
                        {selected
                          ? isEquipmentConfirmed
                            ? 'Esta maquina ja esta sendo usada neste diario.'
                            : 'Toque para confirmar esta maquina neste diario.'
                          : 'Toque para usar esta maquina neste diario.'}
                      </div>

                    {!selected ? (
                      <div
                        style={{
                          fontSize: '12px',
                          fontWeight: 800,
                          color: '#a72727',
                        }}
                      >
                        Selecionar maquina
                      </div>
                    ) : null}
                  </button>
                )
              })}
            </div>

            {submitError ? (
              <div
                style={{
                  border: '1px solid #fecaca',
                  borderRadius: '14px',
                  padding: '14px',
                  background: '#fef2f2',
                  color: '#b91c1c',
                  fontSize: '14px',
                }}
              >
                {submitError}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {pendingEquipment ? (
        <ConfirmSwapModal
          machineName={pendingEquipment.nome}
          isSaving={mutation.isPending}
          onCancel={() => setPendingEquipmentId(null)}
          onConfirm={() => void mutation.mutateAsync(pendingEquipment.id)}
        />
      ) : null}
    </>
  )
}
