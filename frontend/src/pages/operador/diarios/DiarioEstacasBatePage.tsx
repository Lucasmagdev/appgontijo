import { type CSSProperties, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { diarioService, equipamentoService, extractApiErrorMessage } from '@/lib/gontijo-api'

type BateInfo = {
  alturaQuedaNega: string
  pesoMartelo: string
  modalidade: string
}

type BateStake = {
  id: string
  stake: string
  elemento1: string
  elemento2: string
  elemento3: string
  elemento4: string
  sobra: string
  compCravado: string
  secao: string
  nega: string
  soldas: string
  cortes: string
}

type Props = {
  diarioId: number
  equipamentoId?: string
}

const emptyInfo: BateInfo = {
  alturaQuedaNega: '',
  pesoMartelo: '',
  modalidade: 'Metalica',
}

const emptyStake: BateStake = {
  id: '',
  stake: '',
  elemento1: '',
  elemento2: '',
  elemento3: '',
  elemento4: '',
  sobra: '',
  compCravado: '0',
  secao: '',
  nega: '',
  soldas: '',
  cortes: '',
}

const secaoOptions = ['Perfil I', 'Perfil H', 'Tubular', 'Cantoneira', 'Prancha', 'Outro']
const modalidadeOptions = ['Metalica', 'Concreto', 'Madeira', 'Mista']

function genId() {
  return `be-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function toText(value: unknown) {
  if (value === undefined || value === null) return ''
  const text = String(value).trim()
  return text === 'null' || text === 'undefined' ? '' : text
}

function normalizeStakeRow(value: unknown): BateStake {
  const row = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  return {
    id: toText(row.id) || genId(),
    stake: toText(row.stake || row.pilar || row.estaca),
    elemento1: toText(row.elemento1 || row.firstElement),
    elemento2: toText(row.elemento2 || row.secondElement),
    elemento3: toText(row.elemento3 || row.thirdElement),
    elemento4: toText(row.elemento4 || row.fourthElement),
    sobra: toText(row.sobra),
    compCravado: toText(row.compCravado || row.comp_cravado || row.meters),
    secao: toText(row.secao || row.section),
    nega: toText(row.nega),
    soldas: toText(row.soldas),
    cortes: toText(row.cortes),
  }
}

function compactStake(row: BateStake) {
  return Object.fromEntries(
    Object.entries({
      stake: row.stake.trim(),
      elemento1: row.elemento1.trim(),
      elemento2: row.elemento2.trim(),
      elemento3: row.elemento3.trim(),
      elemento4: row.elemento4.trim(),
      sobra: row.sobra.trim(),
      compCravado: row.compCravado.trim(),
      secao: row.secao.trim(),
      nega: row.nega.trim(),
      soldas: row.soldas.trim(),
      cortes: row.cortes.trim(),
    }).filter(([, value]) => value)
  )
}

const inputStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  marginTop: '4px',
  padding: '12px 14px',
  borderRadius: '14px',
  border: '1.5px solid #e2e8f0',
  background: '#f8fafc',
  fontSize: '15px',
  fontWeight: 600,
  color: '#111827',
  outline: 'none',
  boxSizing: 'border-box',
}

const labelStyle: CSSProperties = {
  fontSize: '13px',
  fontWeight: 600,
  color: '#374151',
  marginBottom: '4px',
}

export default function DiarioEstacasBatePage({ diarioId, equipamentoId }: Props) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [infoOpen, setInfoOpen] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [submitErr, setSubmitErr] = useState('')
  const [form, setForm] = useState<BateStake>(emptyStake)
  const [info, setInfo] = useState<BateInfo>(emptyInfo)

  const diarioQuery = useQuery({
    queryKey: ['operador-diario', diarioId],
    enabled: diarioId > 0,
    queryFn: () => diarioService.getById(diarioId),
  })

  const equipamentosQuery = useQuery({
    queryKey: ['equipamentos-parametrizados'],
    queryFn: equipamentoService.listParametrizados,
  })

  const routeEquipmentId = Number(equipamentoId || '') || null
  const currentEquipmentId = diarioQuery.data?.equipamentoId ?? routeEquipmentId
  const equipment = equipamentosQuery.data?.find((e) => e.id === currentEquipmentId) ?? null
  const backUrl = `/operador/diario-de-obras/novo/${currentEquipmentId || equipamentoId || ''}`

  const stakes = useMemo(() => {
    const raw = diarioQuery.data?.dadosJson
    if (!raw || typeof raw !== 'object') return []
    const list = (raw as Record<string, unknown>).stakesBE
    return Array.isArray(list) ? list.map(normalizeStakeRow) : []
  }, [diarioQuery.data?.dadosJson])

  useEffect(() => {
    const raw = diarioQuery.data?.dadosJson
    if (!raw || typeof raw !== 'object') return
    const json = raw as Record<string, unknown>
    const source =
      json.stakesBEInfo && typeof json.stakesBEInfo === 'object'
        ? (json.stakesBEInfo as Record<string, unknown>)
        : {}
    setInfo({
      alturaQuedaNega: toText(source.alturaQuedaNega || source.altura_queda_nega),
      pesoMartelo: toText(source.pesoMartelo || source.peso_martelo),
      modalidade: toText(source.modalidade) || 'Metalica',
    })
  }, [diarioQuery.data?.dadosJson])

  const saveMutation = useMutation({
    mutationFn: async (nextStakes: BateStake[]) => {
      if (!diarioQuery.data) throw new Error('Diario nao carregado.')
      const currentJson = (diarioQuery.data.dadosJson as Record<string, unknown> | null) || {}
      const currentInfo =
        currentJson.stakesBEInfo && typeof currentJson.stakesBEInfo === 'object'
          ? (currentJson.stakesBEInfo as Record<string, unknown>)
          : {}

      await diarioService.update(diarioId, {
        dataDiario: diarioQuery.data.dataDiario,
        status: diarioQuery.data.status,
        equipamentoId: diarioQuery.data.equipamentoId,
        assinadoEm: diarioQuery.data.assinadoEm,
        dadosJson: {
          ...currentJson,
          stakesBEInfo: {
            ...currentInfo,
            alturaQuedaNega: info.alturaQuedaNega.trim(),
            pesoMartelo: info.pesoMartelo.trim(),
            modalidade: info.modalidade.trim(),
          },
          stakesBE: nextStakes.map(compactStake),
          estacas_confirmed: nextStakes.length > 0,
        },
      })
      return nextStakes
    },
    onSuccess: async () => {
      setSubmitErr('')
      await queryClient.invalidateQueries({ queryKey: ['operador-diario', diarioId] })
      await queryClient.invalidateQueries({ queryKey: ['operador-diario-draft'] })
    },
    onError: (error) => setSubmitErr(extractApiErrorMessage(error)),
  })

  function handleSubmit() {
    if (!form.stake.trim()) {
      setSubmitErr('Informe o pilar / estaca.')
      return
    }

    const row: BateStake = {
      ...form,
      id: editingId || genId(),
      stake: form.stake.trim(),
    }

    const next = editingId
      ? stakes.map((item) => (item.id === editingId ? row : item))
      : [...stakes, row]

    setEditingId(null)
    setForm(emptyStake)
    setSubmitErr('')
    saveMutation.mutate(next)
  }

  function handleDelete(id: string) {
    const next = stakes.filter((item) => item.id !== id)
    if (editingId === id) {
      setEditingId(null)
      setForm(emptyStake)
    }
    saveMutation.mutate(next)
  }

  function startEdit(item: BateStake) {
    setEditingId(item.id)
    setSubmitErr('')
    setForm(item)
  }

  function handleBack() {
    if (saveMutation.isPending) return
    saveMutation.mutate(stakes, {
      onSuccess: () => navigate(backUrl),
    })
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
        <div>
          <div style={{ color: '#fff', fontSize: '21px', fontWeight: 800 }}>Estacas</div>
          {equipment ? (
            <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: '12px', fontWeight: 600 }}>
              {equipment.modalidadeNome || 'Bate Estaca'}
            </div>
          ) : null}
        </div>
      </div>

      <div style={{ padding: '18px 18px 90px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {(diarioQuery.isLoading || equipamentosQuery.isLoading) ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
            Carregando...
          </div>
        ) : null}

        {!diarioQuery.isLoading && !equipamentosQuery.isLoading ? (
          <>
            <div
              style={{
                borderRadius: '18px',
                background: '#fff',
                border: '1px solid #e5e7eb',
                boxShadow: '0 8px 20px rgba(15,23,42,0.06)',
                overflow: 'hidden',
              }}
            >
              <button
                onClick={() => setInfoOpen((prev) => !prev)}
                style={{
                  border: 'none',
                  width: '100%',
                  background: '#d4d4d8',
                  color: '#111827',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  fontSize: '16px',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                <span>Informacoes Iniciais</span>
                {infoOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>

              {infoOpen ? (
                <div style={{ padding: '16px', display: 'grid', gap: '14px' }}>
                  <div>
                    <label style={labelStyle}>Altura de queda p/ nega (m)</label>
                    <input
                      value={info.alturaQuedaNega}
                      onChange={(e) => setInfo((prev) => ({ ...prev, alturaQuedaNega: e.target.value }))}
                      inputMode="decimal"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Peso Martelo (kg)</label>
                    <input
                      value={info.pesoMartelo}
                      onChange={(e) => setInfo((prev) => ({ ...prev, pesoMartelo: e.target.value }))}
                      inputMode="decimal"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Modalidade</label>
                    <select
                      value={info.modalidade}
                      onChange={(e) => setInfo((prev) => ({ ...prev, modalidade: e.target.value }))}
                      style={inputStyle}
                    >
                      {modalidadeOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : null}
            </div>

            {stakes.length > 0 ? (
              <div
                style={{
                  borderRadius: '18px',
                  background: '#fff',
                  border: '1px solid #e5e7eb',
                  boxShadow: '0 8px 20px rgba(15,23,42,0.06)',
                  overflow: 'hidden',
                }}
              >
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', fontSize: '14px', fontWeight: 800, color: '#1f2937' }}>
                  {stakes.length} estaca{stakes.length !== 1 ? 's' : ''} registrada{stakes.length !== 1 ? 's' : ''}
                </div>

                {stakes.map((item, index) => (
                  <div
                    key={item.id}
                    style={{
                      padding: '12px 16px',
                      borderBottom: index < stakes.length - 1 ? '1px solid #f8fafc' : 'none',
                      display: 'flex',
                      gap: '12px',
                      alignItems: 'flex-start',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '15px', fontWeight: 800, color: '#111827', marginBottom: '6px' }}>{item.stake}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {item.compCravado ? <span style={{ fontSize: '12px', color: '#475569', fontWeight: 600 }}>Comp. {item.compCravado} m</span> : null}
                        {item.secao ? <span style={{ fontSize: '12px', color: '#475569', fontWeight: 600 }}>{item.secao}</span> : null}
                        {item.nega ? <span style={{ fontSize: '12px', color: '#475569', fontWeight: 600 }}>Nega {item.nega} mm</span> : null}
                        {item.soldas ? <span style={{ fontSize: '12px', color: '#475569', fontWeight: 600 }}>Soldas {item.soldas}</span> : null}
                        {item.cortes ? <span style={{ fontSize: '12px', color: '#475569', fontWeight: 600 }}>Cortes {item.cortes}</span> : null}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      <button
                        onClick={() => startEdit(item)}
                        disabled={saveMutation.isPending}
                        style={{ background: '#f1f5f9', border: 'none', borderRadius: '10px', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                      >
                        <Pencil size={13} color="#475569" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        disabled={saveMutation.isPending}
                        style={{ background: '#fef2f2', border: 'none', borderRadius: '10px', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                      >
                        <Trash2 size={13} color="#b91c1c" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            <div
              style={{
                borderRadius: '18px',
                background: '#fff',
                border: '1px solid #e5e7eb',
                boxShadow: '0 8px 20px rgba(15,23,42,0.06)',
                padding: '16px',
                display: 'grid',
                gap: '14px',
              }}
            >
              <div>
                <label style={labelStyle}>Pilar / Estaca</label>
                <input
                  value={form.stake}
                  onChange={(e) => setForm((prev) => ({ ...prev, stake: e.target.value }))}
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Elemento 1 (m)</label>
                  <input value={form.elemento1} onChange={(e) => setForm((prev) => ({ ...prev, elemento1: e.target.value }))} inputMode="decimal" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Elemento 2 (m)</label>
                  <input value={form.elemento2} onChange={(e) => setForm((prev) => ({ ...prev, elemento2: e.target.value }))} inputMode="decimal" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Elemento 3 (m)</label>
                  <input value={form.elemento3} onChange={(e) => setForm((prev) => ({ ...prev, elemento3: e.target.value }))} inputMode="decimal" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Elemento 4 (m)</label>
                  <input value={form.elemento4} onChange={(e) => setForm((prev) => ({ ...prev, elemento4: e.target.value }))} inputMode="decimal" style={inputStyle} />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Sobra (m)</label>
                <input
                  value={form.sobra}
                  onChange={(e) => setForm((prev) => ({ ...prev, sobra: e.target.value }))}
                  inputMode="decimal"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Comp. Cravado (m)</label>
                <input
                  value={form.compCravado}
                  onChange={(e) => setForm((prev) => ({ ...prev, compCravado: e.target.value }))}
                  inputMode="decimal"
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Secao/Perfil</label>
                  <select
                    value={form.secao}
                    onChange={(e) => setForm((prev) => ({ ...prev, secao: e.target.value }))}
                    style={inputStyle}
                  >
                    <option value="">Selecione</option>
                    {secaoOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Nega(mm)</label>
                  <input
                    value={form.nega}
                    onChange={(e) => setForm((prev) => ({ ...prev, nega: e.target.value }))}
                    inputMode="decimal"
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Soldas</label>
                  <input
                    value={form.soldas}
                    onChange={(e) => setForm((prev) => ({ ...prev, soldas: e.target.value }))}
                    inputMode="numeric"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Cortes</label>
                  <input
                    value={form.cortes}
                    onChange={(e) => setForm((prev) => ({ ...prev, cortes: e.target.value }))}
                    inputMode="numeric"
                    style={inputStyle}
                  />
                </div>
              </div>

              {submitErr ? (
                <div style={{ borderRadius: '12px', background: '#fef2f2', border: '1px solid #fecaca', padding: '10px 14px', fontSize: '13px', color: '#b91c1c' }}>
                  {submitErr}
                </div>
              ) : null}

              <button
                onClick={handleSubmit}
                disabled={saveMutation.isPending}
                style={{
                  border: 'none',
                  borderRadius: '14px',
                  background: saveMutation.isPending ? '#cbd5e1' : '#d4d4d8',
                  color: '#111827',
                  padding: '13px',
                  fontSize: '15px',
                  fontWeight: 800,
                  cursor: saveMutation.isPending ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                <Plus size={16} />
                {editingId ? 'Salvar' : 'Adicionar'}
              </button>

              <button
                onClick={handleBack}
                disabled={saveMutation.isPending}
                style={{
                  border: 'none',
                  borderRadius: '14px',
                  background: '#5b6470',
                  color: '#fff',
                  padding: '13px',
                  fontSize: '15px',
                  fontWeight: 800,
                  cursor: saveMutation.isPending ? 'not-allowed' : 'pointer',
                }}
              >
                Voltar
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
