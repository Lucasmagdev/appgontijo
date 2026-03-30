import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, PencilLine, Plus, Save, Trash2 } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import QueryFeedback from '@/components/ui/QueryFeedback'
import { diarioService, equipamentoService, extractApiErrorMessage, type DiarioPayload } from '@/lib/gontijo-api'

type JsonMap = Record<string, unknown>
type StakeKey = 'stakes' | 'stakesBE'
type DiaryStakeRow = Record<string, string>
type DiaryStaffRow = { item: string }
type DiaryOccurrenceRow = { desc: string; hora_ini: string; hora_fim: string }
type DiaryPlanRow = { numeroEstacas: string; diametro: string }
type DiarySupply = {
  litrosTanqueAntes: string
  litrosGalaoAntes: string
  litrosTanque: string
  litrosGalao: string
  chegouDiesel: string
  fornecidoPor: string
  litros: string
  horario: string
}

type DiaryEditorState = {
  client: string
  start: string
  end: string
  modality: string
  horimetro: string
  endDate: string
  signatureName: string
  signatureDoc: string
  signature: string
  constructionNumber: string
  address: { street: string; number: string; neighborhood: string }
  staff: DiaryStaffRow[]
  occurrences: DiaryOccurrenceRow[]
  planning: DiaryPlanRow[]
  endConstruction: DiaryPlanRow[]
  supply: DiarySupply
  stakesKey: StakeKey
  stakes: DiaryStakeRow[]
  extrasText: string
}

const EMPTY_SUPPLY: DiarySupply = {
  litrosTanqueAntes: '',
  litrosGalaoAntes: '',
  litrosTanque: '',
  litrosGalao: '',
  chegouDiesel: '',
  fornecidoPor: '',
  litros: '',
  horario: '',
}

const EMPTY_STAKE_ROW: DiaryStakeRow = {
  stake: '',
  meters: '',
  diameter: '',
  bits: '',
  armacao: '',
  justify: '',
  compCravado: '',
  secao: '',
  nega: '',
  soldas: '',
  cortes: '',
  elemento1: '',
  elemento2: '',
  elemento3: '',
  elemento4: '',
  sobra: '',
}

const EMPTY_EDITOR: DiaryEditorState = {
  client: '',
  start: '',
  end: '',
  modality: '',
  horimetro: '',
  endDate: '',
  signatureName: '',
  signatureDoc: '',
  signature: '',
  constructionNumber: '',
  address: { street: '', number: '', neighborhood: '' },
  staff: [],
  occurrences: [],
  planning: [],
  endConstruction: [],
  supply: EMPTY_SUPPLY,
  stakesKey: 'stakes',
  stakes: [],
  extrasText: '{}',
}

const STAKE_LABELS: Record<string, string> = {
  stake: 'Pilar/Estaca',
  meters: 'Comp. cravado / metros',
  diameter: 'Secao / diametro',
  bits: 'Bits',
  armacao: 'Armacao',
  justify: 'Observacao',
  compCravado: 'Comp Cravado',
  secao: 'Secao',
  nega: 'Nega',
  soldas: 'Soldas',
  cortes: 'Cortes',
  elemento1: '1o Elemento',
  elemento2: '2o Elemento',
  elemento3: '3o Elemento',
  elemento4: '4o Elemento',
  sobra: 'Sobra',
}

const REGULAR_STAKE_FIELDS = ['stake', 'meters', 'diameter', 'bits', 'armacao', 'justify']
const DRIVEN_STAKE_FIELDS = ['stake', 'compCravado', 'secao', 'nega', 'soldas', 'cortes', 'elemento1', 'elemento2', 'elemento3', 'elemento4', 'sobra']

function asRecord(value: unknown): JsonMap {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonMap) : {}
}

function toText(value: unknown) {
  if (value === undefined || value === null) return ''
  const text = String(value)
  return text === 'null' || text === 'undefined' ? '' : text
}

function normalizeStakeRow(value: unknown): DiaryStakeRow {
  const source = asRecord(value)
  const row: DiaryStakeRow = {}
  Object.entries(source).forEach(([key, rawValue]) => {
    row[key] = toText(rawValue)
  })
  row.stake = row.stake || row.pilar || row.estaca || row.name || ''
  row.meters = row.meters || row.realizado || ''
  row.diameter = row.diameter || row.diametro || row.section || ''
  row.compCravado = row.compCravado || row.comp_cravado || ''
  row.secao = row.secao || row.section || row['seção'] || ''
  row.nega = row.nega || ''
  row.soldas = row.soldas || ''
  row.cortes = row.cortes || ''
  row.elemento1 = row.elemento1 || row.firstElement || ''
  row.elemento2 = row.elemento2 || row.secondElement || ''
  row.elemento3 = row.elemento3 || row.thirdElement || ''
  row.elemento4 = row.elemento4 || row.fourthElement || ''
  row.sobra = row.sobra || ''
  row.bits = row.bits || ''
  row.armacao = row.armacao || ''
  row.justify = row.justify || row.observacao || ''
  return { ...EMPTY_STAKE_ROW, ...row }
}

function normalizeStaffRow(value: unknown): DiaryStaffRow {
  const source = asRecord(value)
  return { item: toText(source.item || source.name) }
}

function normalizeOccurrenceRow(value: unknown): DiaryOccurrenceRow {
  const source = asRecord(value)
  return { desc: toText(source.desc), hora_ini: toText(source.hora_ini), hora_fim: toText(source.hora_fim) }
}

function normalizePlanRow(value: unknown): DiaryPlanRow {
  const source = asRecord(value)
  return { numeroEstacas: toText(source.numeroEstacas || source.numero_estacas || source.piles), diametro: toText(source.diametro || source.diameter) }
}

function parseLegacyEquipmentOptions(data: JsonMap) {
  const rawValue = data.equipments
  if (Array.isArray(rawValue)) {
    return rawValue.map((item) => {
      if (typeof item === 'string') return item
      const record = asRecord(item)
      return toText(record.item || record.name || record.id)
    })
  }
  if (typeof rawValue === 'string' && rawValue.trim()) {
    try {
      const parsed = JSON.parse(rawValue) as unknown[]
      if (Array.isArray(parsed)) {
        return parsed.map((item) => {
          if (typeof item === 'string') return item
          const record = asRecord(item)
          return toText(record.item || record.name || record.id)
        })
      }
    } catch {
      return rawValue.split(',').map((item) => item.trim()).filter(Boolean)
    }
  }
  return []
}

function buildEditorState(rawValue: Record<string, unknown> | null): DiaryEditorState {
  const source = asRecord(rawValue)
  const address = asRecord(source.address)
  const supply = asRecord(source.supply)
  const stakesKey: StakeKey = Array.isArray(source.stakesBE) ? 'stakesBE' : 'stakes'
  const managedKeys = new Set([
    'client',
    'start',
    'end',
    'modality',
    'horimetro',
    'endDate',
    'signatureName',
    'signatureDoc',
    'signature',
    'construction_number',
    'address',
    'staff',
    'occurrences',
    'planning',
    'endConstruction',
    'supply',
    'stakes',
    'stakesBE',
  ])
  const extras = Object.fromEntries(Object.entries(source).filter(([key]) => !managedKeys.has(key)))

  return {
    client: toText(source.client),
    start: toText(source.start),
    end: toText(source.end),
    modality: toText(source.modality),
    horimetro: toText(source.horimetro),
    endDate: toText(source.endDate),
    signatureName: toText(source.signatureName),
    signatureDoc: toText(source.signatureDoc),
    signature: toText(source.signature),
    constructionNumber: toText(source.construction_number),
    address: {
      street: toText(address.street),
      number: toText(address.number),
      neighborhood: toText(address.neighborhood),
    },
    staff: Array.isArray(source.staff) ? source.staff.map(normalizeStaffRow) : [],
    occurrences: Array.isArray(source.occurrences) ? source.occurrences.map(normalizeOccurrenceRow) : [],
    planning: Array.isArray(source.planning) ? source.planning.map(normalizePlanRow) : [],
    endConstruction: Array.isArray(source.endConstruction) ? source.endConstruction.map(normalizePlanRow) : [],
    supply: {
      litrosTanqueAntes: toText(supply.litrosTanqueAntes || supply.litrosTanqueInicial),
      litrosGalaoAntes: toText(supply.litrosGalaoAntes || supply.litrosGalaoInicial),
      litrosTanque: toText(supply.litrosTanque),
      litrosGalao: toText(supply.litrosGalao),
      chegouDiesel: toText(supply.chegouDiesel),
      fornecidoPor: toText(supply.fornecidoPor),
      litros: toText(supply.litros),
      horario: toText(supply.horario),
    },
    stakesKey,
    stakes: Array.isArray(source[stakesKey]) ? (source[stakesKey] as unknown[]).map(normalizeStakeRow) : [],
    extrasText: JSON.stringify(extras, null, 2),
  }
}

function parseExtras(text: string) {
  const trimmed = text.trim()
  if (!trimmed) return {}
  return JSON.parse(trimmed) as JsonMap
}

function compactObject(value: JsonMap) {
  return Object.fromEntries(
    Object.entries(value).filter(([, fieldValue]) => {
      if (fieldValue === null || fieldValue === undefined) return false
      if (typeof fieldValue === 'string') return fieldValue.trim() !== ''
      if (Array.isArray(fieldValue)) return fieldValue.length > 0
      if (typeof fieldValue === 'object') return Object.keys(fieldValue as JsonMap).length > 0
      return true
    })
  )
}

function compactStringArray<T extends Record<string, string>>(rows: T[]) {
  return rows
    .map((row) => compactObject(Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value.trim()]))) as T)
    .filter((row) => Object.keys(row).length > 0)
}

function makeStakeRow(isDrivenPile: boolean) {
  return isDrivenPile ? { ...EMPTY_STAKE_ROW, nega: '0.0', soldas: '0', cortes: '0' } : { ...EMPTY_STAKE_ROW }
}

function prettyStakeLabel(key: string) {
  return STAKE_LABELS[key] || key
}

export default function DiarioFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [form, setForm] = useState<DiarioPayload>({
    dataDiario: '',
    status: 'pendente',
    equipamentoId: null,
    assinadoEm: '',
    dadosJson: null,
  })
  const [editor, setEditor] = useState<DiaryEditorState>(EMPTY_EDITOR)
  const [selectedStakeIndex, setSelectedStakeIndex] = useState(0)
  const [submitError, setSubmitError] = useState('')

  const diarioQuery = useQuery({
    queryKey: ['diario', id],
    queryFn: () => diarioService.getById(Number(id)),
    enabled: Boolean(id),
  })

  const equipamentosQuery = useQuery({
    queryKey: ['equipamentos'],
    queryFn: equipamentoService.list,
  })

  useEffect(() => {
    if (!diarioQuery.data) return
    const nextEditor = buildEditorState(diarioQuery.data.dadosJson)
    /* eslint-disable react-hooks/set-state-in-effect */
    setForm({
      dataDiario: diarioQuery.data.dataDiario.slice(0, 10),
      status: diarioQuery.data.status,
      equipamentoId: diarioQuery.data.equipamentoId,
      assinadoEm: diarioQuery.data.assinadoEm ? diarioQuery.data.assinadoEm.slice(0, 16) : '',
      dadosJson: diarioQuery.data.dadosJson,
    })
    setEditor(nextEditor)
    setSelectedStakeIndex(0)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [diarioQuery.data])

  const legacyEquipmentOptions = useMemo(
    () => (diarioQuery.data?.dadosJson ? parseLegacyEquipmentOptions(diarioQuery.data.dadosJson as JsonMap) : []),
    [diarioQuery.data]
  )

  const isDrivenPile = useMemo(
    () => editor.stakesKey === 'stakesBE' || editor.stakes.some((row) => row.compCravado || row.secao || row.nega || row.soldas || row.cortes),
    [editor.stakes, editor.stakesKey]
  )

  const stakeFields = useMemo(() => {
    const dynamicKeys = new Set<string>()
    editor.stakes.forEach((row) => {
      Object.entries(row).forEach(([key, value]) => {
        if (value.trim()) dynamicKeys.add(key)
      })
    })
    const baseOrder = isDrivenPile ? DRIVEN_STAKE_FIELDS : REGULAR_STAKE_FIELDS
    const remaining = Array.from(dynamicKeys).filter((key) => !baseOrder.includes(key))
    return [...baseOrder, ...remaining]
  }, [editor.stakes, isDrivenPile])

  const selectedStake = editor.stakes[selectedStakeIndex] || makeStakeRow(isDrivenPile)
  const mutation = useMutation({
    mutationFn: async (payload: DiarioPayload) => {
      await diarioService.update(Number(id), payload)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['diarios'] })
      await queryClient.invalidateQueries({ queryKey: ['diario', id] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] })
      navigate('/diarios')
    },
    onError: (error) => setSubmitError(extractApiErrorMessage(error)),
  })

  function setEditorField<Key extends keyof DiaryEditorState>(key: Key, value: DiaryEditorState[Key]) {
    setEditor((prev) => ({ ...prev, [key]: value }))
  }

  function updateAddressField(key: keyof DiaryEditorState['address'], value: string) {
    setEditor((prev) => ({ ...prev, address: { ...prev.address, [key]: value } }))
  }

  function updateSupplyField(key: keyof DiarySupply, value: string) {
    setEditor((prev) => ({ ...prev, supply: { ...prev.supply, [key]: value } }))
  }

  function addStakeRow() {
    const nextIndex = editor.stakes.length
    setEditor((prev) => ({ ...prev, stakes: [...prev.stakes, makeStakeRow(isDrivenPile)] }))
    setSelectedStakeIndex(nextIndex)
  }

  function removeStakeRow(index: number) {
    setEditor((prev) => ({ ...prev, stakes: prev.stakes.filter((_, rowIndex) => rowIndex !== index) }))
    setSelectedStakeIndex((current) => Math.max(0, Math.min(current, editor.stakes.length - 2)))
  }

  function updateStakeField(key: string, value: string) {
    setEditor((prev) => ({
      ...prev,
      stakes: prev.stakes.map((row, index) => (index === selectedStakeIndex ? { ...row, [key]: value } : row)),
    }))
  }

  function addStaffRow() {
    setEditor((prev) => ({ ...prev, staff: [...prev.staff, { item: '' }] }))
  }

  function updateStaffRow(index: number, value: string) {
    setEditor((prev) => ({
      ...prev,
      staff: prev.staff.map((item, rowIndex) => (rowIndex === index ? { ...item, item: value } : item)),
    }))
  }

  function removeStaffRow(index: number) {
    setEditor((prev) => ({ ...prev, staff: prev.staff.filter((_, rowIndex) => rowIndex !== index) }))
  }

  function addOccurrenceRow() {
    setEditor((prev) => ({ ...prev, occurrences: [...prev.occurrences, { desc: '', hora_ini: '', hora_fim: '' }] }))
  }

  function updateOccurrenceRow(index: number, key: keyof DiaryOccurrenceRow, value: string) {
    setEditor((prev) => ({
      ...prev,
      occurrences: prev.occurrences.map((item, rowIndex) => (rowIndex === index ? { ...item, [key]: value } : item)),
    }))
  }

  function removeOccurrenceRow(index: number) {
    setEditor((prev) => ({ ...prev, occurrences: prev.occurrences.filter((_, rowIndex) => rowIndex !== index) }))
  }

  function addPlanRow(key: 'planning' | 'endConstruction') {
    setEditor((prev) => ({ ...prev, [key]: [...prev[key], { numeroEstacas: '', diametro: '' }] }))
  }

  function updatePlanRow(key: 'planning' | 'endConstruction', index: number, field: keyof DiaryPlanRow, value: string) {
    setEditor((prev) => ({
      ...prev,
      [key]: prev[key].map((item, rowIndex) => (rowIndex === index ? { ...item, [field]: value } : item)),
    }))
  }

  function removePlanRow(key: 'planning' | 'endConstruction', index: number) {
    setEditor((prev) => ({ ...prev, [key]: prev[key].filter((_, rowIndex) => rowIndex !== index) }))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitError('')

    let extras: JsonMap
    try {
      extras = parseExtras(editor.extrasText)
    } catch {
      setSubmitError('O JSON complementar esta invalido. Corrija antes de salvar.')
      return
    }

    const rebuiltJson: JsonMap = {
      ...extras,
      ...compactObject({
        client: editor.client,
        start: editor.start,
        end: editor.end,
        modality: editor.modality,
        horimetro: editor.horimetro,
        endDate: editor.endDate,
        signatureName: editor.signatureName,
        signatureDoc: editor.signatureDoc,
        signature: editor.signature,
        construction_number: editor.constructionNumber || diarioQuery.data?.obraNumero || '',
        equipment: form.equipamentoId ?? extras.equipment ?? null,
        address: compactObject({
          street: editor.address.street,
          number: editor.address.number,
          neighborhood: editor.address.neighborhood,
        }),
        supply: compactObject({
          litrosTanqueAntes: editor.supply.litrosTanqueAntes,
          litrosGalaoAntes: editor.supply.litrosGalaoAntes,
          litrosTanque: editor.supply.litrosTanque,
          litrosGalao: editor.supply.litrosGalao,
          chegouDiesel: editor.supply.chegouDiesel,
          fornecidoPor: editor.supply.fornecidoPor,
          litros: editor.supply.litros,
          horario: editor.supply.horario,
        }),
        staff: compactStringArray(editor.staff),
        occurrences: compactStringArray(editor.occurrences),
        planning: compactStringArray(editor.planning),
        endConstruction: compactStringArray(editor.endConstruction),
      }),
    }

    delete rebuiltJson.stakes
    delete rebuiltJson.stakesBE
    rebuiltJson[editor.stakesKey] = compactStringArray(editor.stakes)

    await mutation.mutateAsync({
      dataDiario: form.dataDiario,
      status: form.status,
      equipamentoId: form.equipamentoId,
      assinadoEm: form.assinadoEm,
      dadosJson: rebuiltJson,
    })
  }

  return (
    <div className="page-shell">
      <div className="flex items-center gap-3">
        <Link to="/diarios" className="btn btn-secondary btn-icon">
          <ArrowLeft size={15} />
        </Link>
        <div>
          <h1 className="page-heading">Editar Diario</h1>
          <p className="page-subtitle">Distribuicao dos campos do JSON em secoes editaveis do formulario.</p>
        </div>
      </div>

      {diarioQuery.isLoading ? <QueryFeedback type="loading" title="Carregando diario" description="Buscando o registro atual no MySQL." /> : null}
      {diarioQuery.isError ? <QueryFeedback type="error" title="Nao foi possivel carregar o diario" description={extractApiErrorMessage(diarioQuery.error)} /> : null}
      {submitError ? <QueryFeedback type="error" title="Nao foi possivel salvar" description={submitError} /> : null}

      {diarioQuery.data ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <section className="app-panel section-panel">
            <h2 className="section-heading">Dados basicos</h2>
            <div className="form-grid">
              <div className="span-2"><label className="field-label">ID</label><input type="text" value={String(diarioQuery.data.id)} className="field-input" disabled /></div>
              <div className="span-2"><label className="field-label">Obra</label><input type="text" value={diarioQuery.data.obraNumero || '-'} className="field-input" disabled /></div>
              <div className="span-4"><label className="field-label">Cliente</label><input type="text" value={editor.client || diarioQuery.data.clienteNome || ''} onChange={(event) => setEditorField('client', event.target.value)} className="field-input" /></div>
              <div className="span-2"><label className="field-label">Data</label><input type="date" value={form.dataDiario} onChange={(event) => setForm((prev) => ({ ...prev, dataDiario: event.target.value }))} className="field-input" required /></div>
              <div className="span-2"><label className="field-label">Status</label><select value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as DiarioPayload['status'] }))} className="field-select"><option value="rascunho">Rascunho</option><option value="pendente">Pendente</option><option value="assinado">Assinado</option></select></div>
              <div className="span-2"><label className="field-label">Inicio</label><input type="text" value={editor.start} onChange={(event) => setEditorField('start', event.target.value)} className="field-input" /></div>
              <div className="span-2"><label className="field-label">Fim</label><input type="text" value={editor.end} onChange={(event) => setEditorField('end', event.target.value)} className="field-input" /></div>
              <div className="span-3"><label className="field-label">Modalidade</label><input type="text" value={editor.modality} onChange={(event) => setEditorField('modality', event.target.value)} className="field-input" /></div>
              <div className="span-2"><label className="field-label">Horimetro</label><input type="text" value={editor.horimetro} onChange={(event) => setEditorField('horimetro', event.target.value)} className="field-input" /></div>
              <div className="span-3"><label className="field-label">Assinado em</label><input type="datetime-local" value={form.assinadoEm} onChange={(event) => setForm((prev) => ({ ...prev, assinadoEm: event.target.value }))} className="field-input" /></div>
              <div className="span-2"><label className="field-label">Numero obra legado</label><input type="text" value={editor.constructionNumber} onChange={(event) => setEditorField('constructionNumber', event.target.value)} className="field-input" /></div>
              <div className="span-3"><label className="field-label">Previsao termino</label><input type="text" value={editor.endDate} onChange={(event) => setEditorField('endDate', event.target.value)} className="field-input" /></div>
              <div className="span-3"><label className="field-label">Assinante</label><input type="text" value={editor.signatureName} onChange={(event) => setEditorField('signatureName', event.target.value)} className="field-input" /></div>
              <div className="span-3"><label className="field-label">Documento</label><input type="text" value={editor.signatureDoc} onChange={(event) => setEditorField('signatureDoc', event.target.value)} className="field-input" /></div>
              <div className="span-3"><label className="field-label">Arquivo assinatura</label><input type="text" value={editor.signature} onChange={(event) => setEditorField('signature', event.target.value)} className="field-input" /></div>
              <div className="span-4"><label className="field-label">Rua</label><input type="text" value={editor.address.street} onChange={(event) => updateAddressField('street', event.target.value)} className="field-input" /></div>
              <div className="span-2"><label className="field-label">Numero</label><input type="text" value={editor.address.number} onChange={(event) => updateAddressField('number', event.target.value)} className="field-input" /></div>
              <div className="span-3"><label className="field-label">Bairro</label><input type="text" value={editor.address.neighborhood} onChange={(event) => updateAddressField('neighborhood', event.target.value)} className="field-input" /></div>
              <div className="span-3"><label className="field-label">Operador vinculado</label><input type="text" value={diarioQuery.data.operadorNome || '-'} className="field-input" disabled /></div>
            </div>
          </section>

          <section className="app-panel section-panel">
            <h2 className="section-heading">Equipamentos</h2>
            <div className="form-grid">
              <div className="span-4"><label className="field-label">Equipamento principal</label><select value={form.equipamentoId ?? ''} onChange={(event) => setForm((prev) => ({ ...prev, equipamentoId: event.target.value ? Number(event.target.value) : null }))} className="field-select"><option value="">Sem vinculo</option>{equipamentosQuery.data?.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></div>
              <div className="span-4"><label className="field-label">Equipamento detectado</label><input type="text" value={diarioQuery.data.equipamento || '-'} className="field-input" disabled /></div>
              <div className="span-4"><label className="field-label">Opcoes do legado</label><input type="text" value={legacyEquipmentOptions.length ? legacyEquipmentOptions.join(', ') : '-'} className="field-input" disabled /></div>
            </div>
          </section>

          <section className="app-panel section-panel">
            <div className="section-header-inline"><h2 className="section-heading mb-0">Equipe</h2><button type="button" className="btn btn-secondary" onClick={addStaffRow}><Plus size={14} />Adicionar membro</button></div>
            <div className="stack-list">
              {editor.staff.length ? editor.staff.map((person, index) => (
                <div key={`staff-${index}`} className="nested-card">
                  <div className="form-grid">
                    <div className="span-10"><label className="field-label">Nome</label><input type="text" value={person.item} onChange={(event) => updateStaffRow(index, event.target.value)} className="field-input" /></div>
                    <div className="span-2 nested-actions"><button type="button" className="btn btn-secondary text-red-600" onClick={() => removeStaffRow(index)}><Trash2 size={14} />Remover</button></div>
                  </div>
                </div>
              )) : <QueryFeedback type="empty" title="Sem equipe registrada" description="Adicione os colaboradores do diario por aqui." />}
            </div>
          </section>

          <section className="app-panel section-panel">
            <div className="section-header-inline"><h2 className="section-heading mb-0">Estacas</h2><div className="inline-actions"><select value={editor.stakesKey} onChange={(event) => setEditorField('stakesKey', event.target.value as StakeKey)} className="field-select" style={{ minWidth: '10rem' }}><option value="stakes">Estacas convencionais</option><option value="stakesBE">Estacas cravadas</option></select><button type="button" className="btn btn-secondary" onClick={addStakeRow}><Plus size={14} />Nova estaca</button></div></div>
            <div className="diary-stakes-layout">
              <div className="diary-stake-editor">
                <div className="inline-actions mb-3"><PencilLine size={15} /><strong>{editor.stakes.length ? `Editando estaca ${selectedStakeIndex + 1}` : 'Sem estacas'}</strong></div>
                <div className="form-grid">
                  {stakeFields.map((field) => <div key={field} className="span-12"><label className="field-label">{prettyStakeLabel(field)}</label><input type="text" value={selectedStake[field] || ''} onChange={(event) => updateStakeField(field, event.target.value)} className="field-input" disabled={!editor.stakes.length} /></div>)}
                </div>
              </div>
              <div className="table-shell">
                <div className="table-scroll">
                  <table className="data-table min-w-[760px]">
                    <thead><tr>{stakeFields.slice(0, 6).map((field) => <th key={`stake-header-${field}`}>{prettyStakeLabel(field)}</th>)}<th>Acoes</th></tr></thead>
                    <tbody>
                      {editor.stakes.length ? editor.stakes.map((row, index) => (
                        <tr key={`stake-row-${index}`} className={index === selectedStakeIndex ? 'diary-row-active' : ''}>
                          {stakeFields.slice(0, 6).map((field) => <td key={`${index}-${field}`}>{row[field] || '-'}</td>)}
                          <td><div className="action-row"><button type="button" className="btn btn-secondary btn-icon" onClick={() => setSelectedStakeIndex(index)} title="Editar estaca"><PencilLine size={14} /></button><button type="button" className="btn btn-secondary btn-icon text-red-600" onClick={() => removeStakeRow(index)} title="Excluir estaca"><Trash2 size={14} /></button></div></td>
                        </tr>
                      )) : <tr><td colSpan={7}><QueryFeedback type="empty" title="Nenhuma estaca cadastrada" description="Adicione as estacas do diario pelo formulario ao lado." /></td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>
          <section className="app-panel section-panel">
            <div className="section-header-inline"><h2 className="section-heading mb-0">Ocorrencias</h2><button type="button" className="btn btn-secondary" onClick={addOccurrenceRow}><Plus size={14} />Nova ocorrencia</button></div>
            <div className="stack-list">
              {editor.occurrences.length ? editor.occurrences.map((occurrence, index) => (
                <div key={`occurrence-${index}`} className="nested-card">
                  <div className="form-grid">
                    <div className="span-6"><label className="field-label">Descricao</label><input type="text" value={occurrence.desc} onChange={(event) => updateOccurrenceRow(index, 'desc', event.target.value)} className="field-input" /></div>
                    <div className="span-2"><label className="field-label">Inicio</label><input type="text" value={occurrence.hora_ini} onChange={(event) => updateOccurrenceRow(index, 'hora_ini', event.target.value)} className="field-input" /></div>
                    <div className="span-2"><label className="field-label">Fim</label><input type="text" value={occurrence.hora_fim} onChange={(event) => updateOccurrenceRow(index, 'hora_fim', event.target.value)} className="field-input" /></div>
                    <div className="span-2 nested-actions"><button type="button" className="btn btn-secondary text-red-600" onClick={() => removeOccurrenceRow(index)}><Trash2 size={14} />Remover</button></div>
                  </div>
                </div>
              )) : <QueryFeedback type="empty" title="Sem ocorrencias" description="Adicione paradas, manutencoes ou eventos do dia." />}
            </div>
          </section>

          <section className="app-panel section-panel">
            <h2 className="section-heading">Abastecimento e planejamento</h2>
            <div className="form-grid">
              <div className="span-3"><label className="field-label">Litros tanque antes</label><input type="text" value={editor.supply.litrosTanqueAntes} onChange={(event) => updateSupplyField('litrosTanqueAntes', event.target.value)} className="field-input" /></div>
              <div className="span-3"><label className="field-label">Litros galao antes</label><input type="text" value={editor.supply.litrosGalaoAntes} onChange={(event) => updateSupplyField('litrosGalaoAntes', event.target.value)} className="field-input" /></div>
              <div className="span-3"><label className="field-label">Litros tanque final</label><input type="text" value={editor.supply.litrosTanque} onChange={(event) => updateSupplyField('litrosTanque', event.target.value)} className="field-input" /></div>
              <div className="span-3"><label className="field-label">Litros galao final</label><input type="text" value={editor.supply.litrosGalao} onChange={(event) => updateSupplyField('litrosGalao', event.target.value)} className="field-input" /></div>
              <div className="span-3"><label className="field-label">Chegou diesel</label><input type="text" value={editor.supply.chegouDiesel} onChange={(event) => updateSupplyField('chegouDiesel', event.target.value)} className="field-input" /></div>
              <div className="span-3"><label className="field-label">Fornecido por</label><input type="text" value={editor.supply.fornecidoPor} onChange={(event) => updateSupplyField('fornecidoPor', event.target.value)} className="field-input" /></div>
              <div className="span-3"><label className="field-label">Quantos litros</label><input type="text" value={editor.supply.litros} onChange={(event) => updateSupplyField('litros', event.target.value)} className="field-input" /></div>
              <div className="span-3"><label className="field-label">Horario chegada</label><input type="text" value={editor.supply.horario} onChange={(event) => updateSupplyField('horario', event.target.value)} className="field-input" /></div>
            </div>
            <div className="diary-plan-grid mt-4">
              <div className="nested-card">
                <div className="section-header-inline"><h3 className="section-heading mb-0">Planejamento do dia seguinte</h3><button type="button" className="btn btn-secondary" onClick={() => addPlanRow('planning')}><Plus size={14} />Linha</button></div>
                <div className="stack-list">
                  {editor.planning.map((row, index) => <div key={`planning-${index}`} className="form-grid"><div className="span-5"><label className="field-label">Nº de estacas</label><input type="text" value={row.numeroEstacas} onChange={(event) => updatePlanRow('planning', index, 'numeroEstacas', event.target.value)} className="field-input" /></div><div className="span-5"><label className="field-label">Diametro</label><input type="text" value={row.diametro} onChange={(event) => updatePlanRow('planning', index, 'diametro', event.target.value)} className="field-input" /></div><div className="span-2 nested-actions"><button type="button" className="btn btn-secondary text-red-600" onClick={() => removePlanRow('planning', index)}><Trash2 size={14} />Remover</button></div></div>)}
                  {!editor.planning.length ? <QueryFeedback type="empty" title="Sem planejamento" description="Adicione a previsao do dia seguinte." /> : null}
                </div>
              </div>
              <div className="nested-card">
                <div className="section-header-inline"><h3 className="section-heading mb-0">Termino da obra</h3><button type="button" className="btn btn-secondary" onClick={() => addPlanRow('endConstruction')}><Plus size={14} />Linha</button></div>
                <div className="stack-list">
                  {editor.endConstruction.map((row, index) => <div key={`end-construction-${index}`} className="form-grid"><div className="span-5"><label className="field-label">Nº de estacas</label><input type="text" value={row.numeroEstacas} onChange={(event) => updatePlanRow('endConstruction', index, 'numeroEstacas', event.target.value)} className="field-input" /></div><div className="span-5"><label className="field-label">Diametro</label><input type="text" value={row.diametro} onChange={(event) => updatePlanRow('endConstruction', index, 'diametro', event.target.value)} className="field-input" /></div><div className="span-2 nested-actions"><button type="button" className="btn btn-secondary text-red-600" onClick={() => removePlanRow('endConstruction', index)}><Trash2 size={14} />Remover</button></div></div>)}
                  {!editor.endConstruction.length ? <QueryFeedback type="empty" title="Sem previsao final" description="Adicione o saldo para termino da obra, se houver." /> : null}
                </div>
              </div>
            </div>
          </section>

          <section className="app-panel section-panel">
            <h2 className="section-heading">JSON complementar</h2>
            <p className="page-subtitle">Campos ainda nao mapeados no formulario permanecem aqui para nao perder informacao.</p>
            <textarea value={editor.extrasText} onChange={(event) => setEditorField('extrasText', event.target.value)} className="field-textarea font-mono" style={{ minHeight: '16rem' }} />
          </section>

          <div className="inline-actions justify-end">
            <Link to="/diarios" className="btn btn-secondary">Cancelar</Link>
            <button type="submit" className="btn btn-primary" disabled={mutation.isPending}><Save size={15} />{mutation.isPending ? 'Salvando...' : 'Salvar diario'}</button>
          </div>
        </form>
      ) : null}
    </div>
  )
}
