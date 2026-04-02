import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus, Trash2, Check, Edit2, Save, X, ChevronDown, ChevronUp, Users } from 'lucide-react'
import { cursosApi, type QuestaoRecord } from '@/lib/gontijo-api'

type AlternativaInput = { texto: string; correta: boolean }

const defaultAlts = (): AlternativaInput[] => [
  { texto: '', correta: true },
  { texto: '', correta: false },
  { texto: '', correta: false },
  { texto: '', correta: false },
]

function QuestaoEditor({
  questao,
  index,
  provaId,
  onSaved,
  onDelete,
}: {
  questao: QuestaoRecord | null
  index: number
  provaId: number
  onSaved: () => void
  onDelete?: () => void
}) {
  const [enunciado, setEnunciado] = useState(questao?.enunciado ?? '')
  const [alts, setAlts] = useState<AlternativaInput[]>(
    questao?.alternativas?.map((a) => ({ texto: a.texto, correta: !!a.correta })) ?? defaultAlts()
  )
  const [error, setError] = useState('')
  const [isOpen, setIsOpen] = useState(!questao)

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = { enunciado, alternativas: alts, ordem: index }
      return questao
        ? cursosApi.updateQuestao(questao.id, payload)
        : cursosApi.createQuestao(provaId, payload)
    },
    onSuccess: () => { onSaved(); setIsOpen(false) },
    onError: (e: Error) => setError(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: () => cursosApi.deleteQuestao(questao!.id),
    onSuccess: onDelete,
  })

  const toggleCorreta = (i: number) => {
    setAlts((prev) => prev.map((a, idx) => ({ ...a, correta: idx === i })))
  }

  const handleSave = () => {
    setError('')
    if (!enunciado.trim()) { setError('Enunciado obrigatório'); return }
    if (alts.some((a) => !a.texto.trim())) { setError('Preencha todas as alternativas'); return }
    if (!alts.some((a) => a.correta)) { setError('Marque a alternativa correta'); return }
    saveMutation.mutate()
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition-colors"
      >
        <span className="text-sm font-semibold text-slate-700">
          Questão {index + 1}{questao ? `: ${questao.enunciado.slice(0, 60)}${questao.enunciado.length > 60 ? '…' : ''}` : ' (nova)'}
        </span>
        <div className="flex items-center gap-2">
          {questao && onDelete && (
            <span
              onClick={(e) => { e.stopPropagation(); if (confirm('Excluir esta questão?')) deleteMutation.mutate() }}
              className="rounded p-1 text-red-400 hover:bg-red-50"
            >
              <Trash2 size={13} />
            </span>
          )}
          {isOpen ? <ChevronUp size={15} className="text-slate-400" /> : <ChevronDown size={15} className="text-slate-400" />}
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-slate-100 p-4 flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Enunciado</label>
            <textarea
              value={enunciado}
              onChange={(e) => setEnunciado(e.target.value)}
              rows={2}
              className="app-input w-full resize-none text-sm"
              placeholder="Digite a pergunta..."
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium text-slate-600">Alternativas — marque a correta</label>
            <div className="flex flex-col gap-2">
              {alts.map((alt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleCorreta(i)}
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                      alt.correta ? 'border-green-500 bg-green-500 text-white' : 'border-slate-300'
                    }`}
                  >
                    {alt.correta && <Check size={10} />}
                  </button>
                  <input
                    value={alt.texto}
                    onChange={(e) => setAlts((prev) => prev.map((a, idx) => idx === i ? { ...a, texto: e.target.value } : a))}
                    className="app-input flex-1 text-sm"
                    placeholder={`Alternativa ${String.fromCharCode(65 + i)}`}
                  />
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-md bg-[var(--brand-red)] px-4 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              <Save size={12} /> {saveMutation.isPending ? 'Salvando...' : 'Salvar questão'}
            </button>
            {questao && (
              <button onClick={() => setIsOpen(false)} className="rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50">
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function CursoProvaPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const [addingNew, setAddingNew] = useState(false)
  const [provaError, setProvaError] = useState('')

  const { data: curso, isLoading: loadingCurso } = useQuery({
    queryKey: ['curso', id],
    queryFn: () => cursosApi.get(Number(id)),
    enabled: !!id,
  })

  const prova = curso?.provas?.[0] ?? null

  const { data: provaData, isLoading: loadingQuestoes } = useQuery({
    queryKey: ['prova-questoes', prova?.id],
    queryFn: () => cursosApi.getQuestoes(prova!.id),
    enabled: !!prova?.id,
  })

  const createProvaMutation = useMutation({
    mutationFn: () => cursosApi.createProva(Number(id), { titulo: `Prova — ${curso?.titulo}`, percentual_aprovacao: 70 }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['curso', id] }),
    onError: (e: Error) => setProvaError(e.message),
  })

  const updateProvaMutation = useMutation({
    mutationFn: (payload: { titulo?: string; percentual_aprovacao?: number }) =>
      cursosApi.updateProva(prova!.id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['curso', id] }),
  })

  const [editProva, setEditProva] = useState(false)
  const [provaTitulo, setProvaTitulo] = useState('')
  const [provaPerc, setProvaPerc] = useState(70)

  if (loadingCurso) return <div className="py-12 text-center text-sm text-slate-400">Carregando...</div>

  const questoes = provaData?.questoes ?? []

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => navigate('/cursos')} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-800">{curso?.titulo}</h1>
          <p className="text-sm text-slate-500">Editor de Prova</p>
        </div>
        <button
          onClick={() => navigate(`/cursos/${id}/atribuicoes`)}
          className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          <Users size={14} /> Atribuições
        </button>
      </div>

      {!prova ? (
        <div className="app-panel py-12 text-center">
          <p className="text-sm text-slate-500 mb-4">Este curso ainda não tem prova.</p>
          {provaError && <p className="mb-3 text-xs text-red-500">{provaError}</p>}
          <button
            onClick={() => createProvaMutation.mutate()}
            disabled={createProvaMutation.isPending}
            className="inline-flex items-center gap-2 rounded-md bg-[var(--brand-red)] px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            <Plus size={14} /> Criar Prova
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {/* Config da prova */}
          <div className="app-panel p-4">
            {!editProva ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{prova.titulo}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Mínimo para aprovação: <strong>{prova.percentual_aprovacao}%</strong></p>
                </div>
                <button
                  onClick={() => { setEditProva(true); setProvaTitulo(prova.titulo); setProvaPerc(prova.percentual_aprovacao) }}
                  className="rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50 flex items-center gap-1"
                >
                  <Edit2 size={11} /> Editar
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Título da prova</label>
                  <input value={provaTitulo} onChange={(e) => setProvaTitulo(e.target.value)} className="app-input w-full text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">% mínimo de aprovação</label>
                  <input type="number" min={1} max={100} value={provaPerc} onChange={(e) => setProvaPerc(Number(e.target.value))} className="app-input w-32 text-sm" />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => updateProvaMutation.mutate({ titulo: provaTitulo, percentual_aprovacao: provaPerc })}
                    disabled={updateProvaMutation.isPending}
                    className="inline-flex items-center gap-1.5 rounded-md bg-[var(--brand-red)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                  >
                    <Save size={11} /> Salvar
                  </button>
                  <button onClick={() => setEditProva(false)} className="rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50">
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Questões */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-700">Questões ({questoes.length})</h2>
              <button
                onClick={() => setAddingNew(true)}
                className="inline-flex items-center gap-1.5 rounded-md bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
              >
                <Plus size={12} /> Nova questão
              </button>
            </div>

            {loadingQuestoes ? (
              <div className="py-8 text-center text-sm text-slate-400">Carregando questões...</div>
            ) : (
              <div className="flex flex-col gap-3">
                {questoes.map((q, i) => (
                  <QuestaoEditor
                    key={q.id}
                    questao={q}
                    index={i}
                    provaId={prova.id}
                    onSaved={() => qc.invalidateQueries({ queryKey: ['prova-questoes', prova.id] })}
                    onDelete={() => qc.invalidateQueries({ queryKey: ['prova-questoes', prova.id] })}
                  />
                ))}
                {addingNew && (
                  <QuestaoEditor
                    questao={null}
                    index={questoes.length}
                    provaId={prova.id}
                    onSaved={() => { qc.invalidateQueries({ queryKey: ['prova-questoes', prova.id] }); setAddingNew(false) }}
                  />
                )}
              </div>
            )}

            {!addingNew && questoes.length === 0 && !loadingQuestoes && (
              <div className="rounded-lg border-2 border-dashed border-slate-200 py-10 text-center">
                <p className="text-sm text-slate-400">Nenhuma questão ainda. Adicione a primeira!</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
