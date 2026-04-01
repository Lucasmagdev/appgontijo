import { type CSSProperties, type ReactNode, useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Fuel } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { diarioService, extractApiErrorMessage } from '@/lib/gontijo-api'

type SupplyForm = {
  litrosTanqueAntes: string
  litrosGalaoAntes: string
  litrosTanque: string
  litrosGalao: string
  chegouDiesel: string
}

type Props = {
  diarioId: number
  equipamentoId?: string
}

const EMPTY_FORM: SupplyForm = {
  litrosTanqueAntes: '',
  litrosGalaoAntes: '',
  litrosTanque: '',
  litrosGalao: '',
  chegouDiesel: '',
}

const inputStyle: CSSProperties = {
  width: '100%',
  minHeight: '56px',
  borderRadius: '18px',
  border: '1.5px solid #e5e7eb',
  background: '#f8fafc',
  padding: '0 16px',
  fontSize: '18px',
  fontWeight: 700,
  color: '#111827',
  outline: 'none',
  boxSizing: 'border-box',
}

function normalizeText(value: unknown) {
  return String(value || '').trim()
}

function readSupply(source: unknown): SupplyForm {
  if (!source || typeof source !== 'object') return EMPTY_FORM
  const supply = source as Record<string, unknown>
  return {
    litrosTanqueAntes: normalizeText(supply.litrosTanqueAntes || supply.litrosTanqueInicial),
    litrosGalaoAntes: normalizeText(supply.litrosGalaoAntes || supply.litrosGalaoInicial),
    litrosTanque: normalizeText(supply.litrosTanque),
    litrosGalao: normalizeText(supply.litrosGalao),
    chegouDiesel: normalizeText(supply.chegouDiesel),
  }
}

function hasSupplyContent(supply: SupplyForm) {
  return Boolean(
    supply.litrosTanqueAntes ||
    supply.litrosGalaoAntes ||
    supply.litrosTanque ||
    supply.litrosGalao ||
    supply.chegouDiesel
  )
}

export default function DiarioAbastecimentoPage({ diarioId, equipamentoId }: Props) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [form, setForm] = useState<SupplyForm>(EMPTY_FORM)
  const [submitError, setSubmitError] = useState('')

  const diarioQuery = useQuery({
    queryKey: ['operador-diario', diarioId],
    enabled: diarioId > 0,
    queryFn: () => diarioService.getById(diarioId),
  })

  const routeEquipmentId = Number(equipamentoId || '') || null
  const currentEquipmentId = diarioQuery.data?.equipamentoId ?? routeEquipmentId
  const backUrl = `/operador/diario-de-obras/novo/${currentEquipmentId || equipamentoId || ''}`

  useEffect(() => {
    const currentSupply = readSupply((diarioQuery.data?.dadosJson as Record<string, unknown> | null)?.supply)
    setForm(currentSupply)
  }, [diarioQuery.data?.dadosJson])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!diarioQuery.data) throw new Error('Diario nao carregado.')

      const currentJson = (diarioQuery.data.dadosJson as Record<string, unknown> | null) || {}
      const currentSupply =
        currentJson.supply && typeof currentJson.supply === 'object'
          ? (currentJson.supply as Record<string, unknown>)
          : {}

      const nextSupply = {
        ...currentSupply,
        litrosTanqueAntes: form.litrosTanqueAntes,
        litrosGalaoAntes: form.litrosGalaoAntes,
        litrosTanque: form.litrosTanque,
        litrosGalao: form.litrosGalao,
        chegouDiesel: form.chegouDiesel,
      }

      await diarioService.update(diarioId, {
        dataDiario: diarioQuery.data.dataDiario,
        status: diarioQuery.data.status,
        equipamentoId: diarioQuery.data.equipamentoId,
        assinadoEm: diarioQuery.data.assinadoEm,
        dadosJson: {
          ...currentJson,
          supply: nextSupply,
        },
      })
    },
    onSuccess: async () => {
      setSubmitError('')
      await queryClient.invalidateQueries({ queryKey: ['operador-diario', diarioId] })
      await queryClient.invalidateQueries({ queryKey: ['operador-diario-draft'] })
      navigate(backUrl)
    },
    onError: (error) => {
      setSubmitError(extractApiErrorMessage(error))
    },
  })

  function setField<K extends keyof SupplyForm>(key: K, value: SupplyForm[K]) {
    setForm((current) => ({ ...current, [key]: value }))
    setSubmitError('')
  }

  const canSave = hasSupplyContent(form)

  return (
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
          onClick={() => navigate(backUrl)}
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
        <div style={{ color: '#fff', fontSize: '21px', fontWeight: 800 }}>Diario de obras</div>
      </div>

      <div style={{ padding: '22px 18px 28px', display: 'grid', gap: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '14px',
              background: '#fff1f1',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <Fuel size={22} color="#a72727" />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 900, color: '#a72727' }}>Abastecimento</div>
        </div>

        {diarioQuery.isLoading ? (
          <div style={{ color: '#6b7280', fontSize: '14px' }}>Carregando dados do diario...</div>
        ) : null}

        {diarioQuery.isError ? (
          <FeedbackBox tone="error">{extractApiErrorMessage(diarioQuery.error)}</FeedbackBox>
        ) : null}

        {!diarioQuery.isLoading && !diarioQuery.isError ? (
          <>
            <SectionCard
              title="Antes da mobilizacao"
              subtitle="Preencher na data da mobilizacao"
            >
              <FormField
                label="Litros de diesel no tanque:"
                input={
                  <input
                    type="text"
                    inputMode="decimal"
                    value={form.litrosTanqueAntes}
                    onChange={(event) => setField('litrosTanqueAntes', event.target.value)}
                    style={inputStyle}
                  />
                }
              />

              <FormField
                label="Litros de diesel no galao:"
                input={
                  <input
                    type="text"
                    inputMode="decimal"
                    value={form.litrosGalaoAntes}
                    onChange={(event) => setField('litrosGalaoAntes', event.target.value)}
                    style={inputStyle}
                  />
                }
              />
            </SectionCard>

            <SectionCard
              title="Depois da mobilizacao"
              subtitle="Preencher todos os dias"
            >
              <FormField
                label="Litros de diesel no tanque final do dia:"
                input={
                  <input
                    type="text"
                    inputMode="decimal"
                    value={form.litrosTanque}
                    onChange={(event) => setField('litrosTanque', event.target.value)}
                    style={inputStyle}
                  />
                }
              />

              <FormField
                label="Litros de diesel no galao final do dia:"
                input={
                  <input
                    type="text"
                    inputMode="decimal"
                    value={form.litrosGalao}
                    onChange={(event) => setField('litrosGalao', event.target.value)}
                    style={inputStyle}
                  />
                }
              />

              <FormField
                label="Chegou diesel na obra?"
                input={
                  <select
                    value={form.chegouDiesel}
                    onChange={(event) => setField('chegouDiesel', event.target.value)}
                    style={{
                      ...inputStyle,
                      WebkitAppearance: 'none',
                      appearance: 'none',
                      backgroundImage: 'linear-gradient(45deg, transparent 50%, #6b7280 50%), linear-gradient(135deg, #6b7280 50%, transparent 50%)',
                      backgroundPosition: 'calc(100% - 22px) calc(50% - 3px), calc(100% - 14px) calc(50% - 3px)',
                      backgroundSize: '8px 8px, 8px 8px',
                      backgroundRepeat: 'no-repeat',
                      paddingRight: '44px',
                    }}
                  >
                    <option value="">Selecione</option>
                    <option value="Nao">Nao</option>
                    <option value="Sim">Sim</option>
                  </select>
                }
              />
            </SectionCard>

            {submitError ? <FeedbackBox tone="error">{submitError}</FeedbackBox> : null}

            <button
              onClick={() => saveMutation.mutate()}
              disabled={!canSave || saveMutation.isPending}
              style={{
                border: 'none',
                borderRadius: '22px',
                background: !canSave || saveMutation.isPending ? '#9ca3af' : '#4b5563',
                color: '#fff',
                minHeight: '64px',
                fontSize: '18px',
                fontWeight: 700,
                cursor: !canSave || saveMutation.isPending ? 'not-allowed' : 'pointer',
                boxShadow: !canSave || saveMutation.isPending ? 'none' : '0 14px 28px rgba(75,85,99,0.18)',
                marginTop: '8px',
              }}
            >
              {saveMutation.isPending ? 'Salvando...' : 'Voltar'}
            </button>
          </>
        ) : null}
      </div>
    </div>
  )
}

function SectionCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div
      style={{
        borderRadius: '22px',
        background: '#fff',
        border: '1px solid rgba(15,23,42,0.06)',
        boxShadow: '0 10px 22px rgba(15,23,42,0.05)',
        padding: '18px 16px',
        display: 'grid',
        gap: '14px',
      }}
    >
      <div style={{ textAlign: 'center', display: 'grid', gap: '4px' }}>
        <div style={{ fontSize: '22px', fontWeight: 900, color: '#111827' }}>{title}</div>
        <div style={{ fontSize: '13px', color: '#9ca3af', fontWeight: 600 }}>{subtitle}</div>
      </div>
      {children}
    </div>
  )
}

function FormField({ label, input }: { label: string; input: ReactNode }) {
  return (
    <label style={{ display: 'grid', gap: '8px' }}>
      <span style={{ fontSize: '14px', fontWeight: 700, color: '#1f2937' }}>{label}</span>
      {input}
    </label>
  )
}

function FeedbackBox({ children, tone }: { children: ReactNode; tone: 'error' }) {
  return (
    <div
      style={{
        border: tone === 'error' ? '1px solid #fecaca' : '1px solid #d1fae5',
        borderRadius: '14px',
        padding: '14px',
        background: tone === 'error' ? '#fef2f2' : '#ecfdf5',
        color: tone === 'error' ? '#b91c1c' : '#047857',
        fontSize: '14px',
        fontWeight: 700,
      }}
    >
      {children}
    </div>
  )
}
