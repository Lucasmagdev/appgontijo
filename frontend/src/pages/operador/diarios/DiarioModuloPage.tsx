import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import DiarioEquipamentoPage from '@/pages/operador/diarios/DiarioEquipamentoPage'
import DiarioEquipePage from '@/pages/operador/diarios/DiarioEquipePage'
import DiarioEstacasPage from '@/pages/operador/diarios/DiarioEstacasPage'
import OperadorPlaceholder from '@/pages/operador/OperadorPlaceholder'
import { diarioService, extractApiErrorMessage } from '@/lib/gontijo-api'

const FIELD_CONFIG = {
  data: {
    title: 'Data',
    helper: 'Escolha a data do diario.',
    inputType: 'date',
    jsonKey: 'date',
  },
  entrada: {
    title: 'Entrada',
    helper: 'Informe o horario de entrada da equipe na obra.',
    inputType: 'time',
    jsonKey: 'start',
  },
  saida: {
    title: 'Saida',
    helper: 'Informe o horario de saida da equipe.',
    inputType: 'time',
    jsonKey: 'end',
  },
} as const

type SupportedModule = keyof typeof FIELD_CONFIG

function isSupportedModule(value: string): value is SupportedModule {
  return value === 'data' || value === 'entrada' || value === 'saida'
}

export default function DiarioModuloPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { equipamentoId, modulo } = useParams()
  const [searchParams] = useSearchParams()
  const diarioId = Number(searchParams.get('diario') || '')
  const moduloParam = String(modulo || '')
  const isEquipeModule = moduloParam === 'equipe'
  const isEquipamentoModule = moduloParam === 'equipamento'
  const isEstacasModule = moduloParam === 'estacas'
  const supportedModule = isSupportedModule(moduloParam)
  const config = supportedModule ? FIELD_CONFIG[moduloParam] : null

  if (isEquipeModule) {
    return <DiarioEquipePage diarioId={diarioId} equipamentoId={equipamentoId} />
  }

  if (isEquipamentoModule) {
    return <DiarioEquipamentoPage diarioId={diarioId} equipamentoId={equipamentoId} />
  }

  if (isEstacasModule) {
    return <DiarioEstacasPage diarioId={diarioId} equipamentoId={equipamentoId} />
  }

  const diarioQuery = useQuery({
    queryKey: ['operador-diario', diarioId],
    enabled: supportedModule && Number.isFinite(diarioId) && diarioId > 0,
    queryFn: () => diarioService.getById(diarioId),
  })

  const [value, setValue] = useState('')
  const [submitError, setSubmitError] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)
  const autoOpenedRef = useRef(false)

  useEffect(() => {
    if (!supportedModule || !config || !diarioQuery.data) return
    const dados = (diarioQuery.data.dadosJson as Record<string, unknown> | null) || {}
    const current =
      moduloParam === 'data'
        ? dados.date_confirmed === true
          ? String(dados.date || '')
          : ''
        : String(dados[config.jsonKey] || '')
    setValue(current)
  }, [config, diarioQuery.data, moduloParam, supportedModule])

  const previewLabel = useMemo(() => {
    if (!value) return 'Ainda nao preenchido'
    if (moduloParam === 'data') {
      const [year, month, day] = value.split('-')
      if (year && month && day) return `${day}/${month}/${year}`
    }
    if (moduloParam === 'entrada' || moduloParam === 'saida') {
      return value.slice(0, 5)
    }
    return value
  }, [value])

  useEffect(() => {
    autoOpenedRef.current = false
  }, [moduloParam])

  useEffect(() => {
    if (!supportedModule || diarioQuery.isLoading || diarioQuery.isError || autoOpenedRef.current) return
    const input = inputRef.current
    if (!input) return

    autoOpenedRef.current = true

    const openPicker = () => {
      try {
        if (typeof input.showPicker === 'function') {
          input.showPicker()
          return
        }
      } catch {
        // Some mobile browsers block showPicker; fallback below.
      }

      input.focus()
      input.click()
    }

    const timer = window.setTimeout(openPicker, 180)
    return () => window.clearTimeout(timer)
  }, [diarioQuery.isError, diarioQuery.isLoading, supportedModule])

  const mutation = useMutation({
    mutationFn: async () => {
      if (!supportedModule || !config || !diarioQuery.data) return

      const currentJson = (diarioQuery.data.dadosJson as Record<string, unknown> | null) || {}
      const nextJson = {
        ...currentJson,
        [config.jsonKey]: value,
      }

      if (moduloParam === 'data') {
        nextJson.date_confirmed = true
      }

      if (moduloParam === 'saida') {
        const entrada = String(currentJson.start || '')
        if (entrada && value && value < entrada) {
          throw new Error('A saida nao pode ser antes da entrada.')
        }
      }

      if (moduloParam === 'entrada') {
        const saida = String(currentJson.end || '')
        if (saida && value && value > saida) {
          throw new Error('A entrada nao pode ser depois da saida ja informada.')
        }
      }

      await diarioService.update(diarioQuery.data.id, {
        dataDiario: moduloParam === 'data' ? value : diarioQuery.data.dataDiario,
        status: diarioQuery.data.status,
        equipamentoId: diarioQuery.data.equipamentoId,
        assinadoEm: diarioQuery.data.assinadoEm,
        dadosJson: nextJson,
      })
    },
    onSuccess: async () => {
      setSubmitError('')
      await queryClient.invalidateQueries({ queryKey: ['operador-diario', diarioId] })
      await queryClient.invalidateQueries({ queryKey: ['operador-diario-draft'] })
      navigate(`/operador/diario-de-obras/novo/${equipamentoId}`)
    },
    onError: (error) => {
      setSubmitError(extractApiErrorMessage(error))
    },
  })

  if (!supportedModule || !config) {
    return (
      <OperadorPlaceholder
        titulo="Diario de obras"
        voltarPara={`/operador/diario-de-obras/novo/${equipamentoId}`}
        mensagem="Esta parte do diario sera montada na proxima etapa."
      />
    )
  }

  if (!Number.isFinite(diarioId) || diarioId <= 0) {
    return (
      <OperadorPlaceholder
        titulo={config.title}
        voltarPara={`/operador/diario-de-obras/novo/${equipamentoId}`}
        mensagem="Nao foi possivel identificar o diario em edicao."
      />
    )
  }

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
          onClick={() => navigate(`/operador/diario-de-obras/novo/${equipamentoId}`)}
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
        <div style={{ color: '#fff', fontSize: '21px', fontWeight: 800 }}>{config.title}</div>
      </div>

      <div style={{ padding: '22px 18px 24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <div
          style={{
            borderRadius: '24px',
            background: '#fff',
            border: '1px solid rgba(167,39,39,0.14)',
            boxShadow: '0 18px 32px rgba(15,23,42,0.08)',
            padding: '20px 18px',
            display: 'grid',
            gap: '12px',
          }}
        >
          <div style={{ fontSize: '24px', fontWeight: 900, color: '#a72727' }}>{config.title}</div>
          <div style={{ fontSize: '14px', color: '#6b7280', lineHeight: '1.5' }}>{config.helper}</div>

          {diarioQuery.isLoading ? (
            <div style={{ color: '#6b7280', fontSize: '14px' }}>Carregando dados do diario...</div>
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

          {!diarioQuery.isLoading && !diarioQuery.isError ? (
            <>
              <label
                style={{
                  display: 'grid',
                  gap: '8px',
                }}
              >
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 800,
                    color: '#6b7280',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}
                >
                  {config.title}
                </span>
                <input
                  ref={inputRef}
                  type={config.inputType}
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  onClick={(event) => {
                    const target = event.currentTarget
                    try {
                      if (typeof target.showPicker === 'function') {
                        target.showPicker()
                      }
                    } catch {
                      target.focus()
                    }
                  }}
                  style={{
                    minHeight: '58px',
                    width: '100%',
                    borderRadius: '18px',
                    border: '1.5px solid #d8dee7',
                    padding: '0 16px',
                    fontSize: '18px',
                    fontWeight: 700,
                    color: '#111827',
                    outline: 'none',
                    background: '#fff',
                    WebkitAppearance: 'none',
                    appearance: 'none',
                    boxSizing: 'border-box',
                    touchAction: 'manipulation',
                  }}
                />
              </label>

              <div
                style={{
                  borderRadius: '18px',
                  background: '#f8fafc',
                  border: '1px solid #e5e7eb',
                  padding: '14px 16px',
                  display: 'grid',
                  gap: '6px',
                }}
              >
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    color: '#94a3b8',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}
                >
                  Valor atual
                </span>
                <span style={{ fontSize: '18px', fontWeight: 800, color: '#1f2937' }}>{previewLabel}</span>
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

              <button
                onClick={() => void mutation.mutateAsync()}
                disabled={!value || mutation.isPending}
                style={{
                  border: 'none',
                  borderRadius: '18px',
                  background: !value || mutation.isPending ? '#cbd5e1' : '#16a34a',
                  color: '#fff',
                  minHeight: '56px',
                  fontSize: '17px',
                  fontWeight: 800,
                  cursor: !value || mutation.isPending ? 'not-allowed' : 'pointer',
                  boxShadow: mutation.isPending ? 'none' : '0 14px 28px rgba(22,163,74,0.22)',
                }}
              >
                {mutation.isPending ? 'Salvando...' : 'Salvar'}
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
