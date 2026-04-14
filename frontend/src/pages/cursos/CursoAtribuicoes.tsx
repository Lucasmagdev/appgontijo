import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Plus,
  Trash2,
  Users,
  Building2,
  BookOpen,
  ClipboardList,
  MessageCircle,
} from 'lucide-react'
import {
  cursosApi,
  extractApiErrorMessage,
  whatsappAdminService,
  type AtribuicaoRecord,
} from '@/lib/gontijo-api'
import { api } from '@/lib/api'

type TipoAcesso = 'curso_e_prova' | 'so_curso' | 'so_prova'

const TIPO_ACESSO_OPTIONS: { value: TipoAcesso; label: string; desc: string; icon: React.ReactNode }[] = [
  {
    value: 'curso_e_prova',
    label: 'Curso + Prova',
    desc: 'Acessa o vídeo e faz a prova',
    icon: (
      <>
        <BookOpen size={13} />
        <ClipboardList size={13} />
      </>
    ),
  },
  {
    value: 'so_curso',
    label: 'Só Curso',
    desc: 'Apenas assiste o vídeo',
    icon: <BookOpen size={13} />,
  },
  {
    value: 'so_prova',
    label: 'Só Prova',
    desc: 'Direto para a prova',
    icon: <ClipboardList size={13} />,
  },
]

function tipoAcessoLabel(v: string) {
  return TIPO_ACESSO_OPTIONS.find((o) => o.value === v)?.label ?? v
}

function tipoAcessoBadge(v: string) {
  if (v === 'so_curso') return 'bg-blue-50 text-blue-600'
  if (v === 'so_prova') return 'bg-amber-50 text-amber-600'
  return 'bg-slate-100 text-slate-600'
}

export default function CursoAtribuicoesPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const [tipo, setTipo] = useState<'setor' | 'usuario'>('setor')
  const [setorId, setSetorId] = useState('')
  const [usuarioId, setUsuarioId] = useState('')
  const [tipoAcesso, setTipoAcesso] = useState<TipoAcesso>('curso_e_prova')
  const [error, setError] = useState('')
  const [selectedAssignmentIds, setSelectedAssignmentIds] = useState<number[]>([])
  const [sendFeedback, setSendFeedback] = useState('')
  const [courseMessage, setCourseMessage] = useState('Olá, {colaborador}! O curso "{curso}" já está disponível na plataforma da Gontijo. Acesse o app, assista ao conteúdo e conclua a prova, se houver.')
  const [sendProgress, setSendProgress] = useState(0)
  const sendProgressRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const COURSE_MESSAGE_VARIABLES = [
    { token: '{colaborador}', label: 'Colaborador' },
    { token: '{curso}', label: 'Curso' },
  ]

  const { data: curso } = useQuery({
    queryKey: ['curso', id],
    queryFn: () => cursosApi.get(Number(id)),
    enabled: !!id,
  })

  const hasActiveProof = Array.isArray((curso as { provas?: { ativo?: number }[] } | undefined)?.provas)
    ? ((curso as { provas?: { ativo?: number }[] }).provas ?? []).some((prova) => Number(prova.ativo ?? 1) === 1)
    : false

  useEffect(() => {
    if (!hasActiveProof && tipoAcesso !== 'so_curso') {
      setTipoAcesso('so_curso')
    }
  }, [hasActiveProof, tipoAcesso])

  const { data: atribuicoes = [] } = useQuery({
    queryKey: ['atribuicoes', id],
    queryFn: () => cursosApi.getAtribuicoes(Number(id)),
    enabled: !!id,
  })

  const { data: setores = [] } = useQuery({
    queryKey: ['setores-list'],
    queryFn: async () => {
      const res = await api.get<{ ok: boolean; data: { id: number; nome: string }[] }>('/gontijo/setores')
      return res.data.data ?? []
    },
  })

  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios-list'],
    queryFn: async () => {
      const res = await api.get<{ ok: boolean; data: { id: number; nome: string }[] }>('/gontijo/usuarios?limit=500')
      return res.data.data ?? []
    },
  })

  const createMutation = useMutation({
    mutationFn: () =>
      cursosApi.createAtribuicao(Number(id), {
        tipo,
        setor_id: tipo === 'setor' ? Number(setorId) : undefined,
        usuario_id: tipo === 'usuario' ? Number(usuarioId) : undefined,
        tipo_acesso: tipoAcesso,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['atribuicoes', id] })
      setSetorId('')
      setUsuarioId('')
      setError('')
    },
    onError: (e: Error) => setError(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: cursosApi.deleteAtribuicao,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['atribuicoes', id] }),
  })

  const notifyMutation = useMutation({
    mutationFn: (assignmentIds: number[]) =>
      whatsappAdminService.sendCourseNotice({
        courseId: Number(id),
        assignmentIds,
        messageText: courseMessage,
      }),
    onSuccess: () => {
      setSelectedAssignmentIds([])
    },
    onError: (err: unknown) => setSendFeedback(extractApiErrorMessage(err)),
  })

  useEffect(() => {
    if (notifyMutation.isPending) {
      setSendProgress(0)
      setSendFeedback('')
      const total = Math.max(1, selectedAssignmentIds.length || (atribuicoes?.length ?? 1))
      const estimatedMs = Math.max(2000, total * 1800)
      const step = 92 / (estimatedMs / 100)
      sendProgressRef.current = setInterval(() => {
        setSendProgress((prev) => Math.min(prev + step, 92))
      }, 100)
    } else {
      if (sendProgressRef.current) clearInterval(sendProgressRef.current)
      if (notifyMutation.isSuccess) setSendProgress(100)
    }
    return () => { if (sendProgressRef.current) clearInterval(sendProgressRef.current) }
  }, [notifyMutation.isPending, notifyMutation.isSuccess])

  const handleAdd = () => {
    setError('')
    if (tipo === 'setor' && !setorId) {
      setError('Selecione um setor')
      return
    }
    if (tipo === 'usuario' && !usuarioId) {
      setError('Selecione um colaborador')
      return
    }
    if (tipoAcesso !== 'so_curso' && !hasActiveProof) {
      setError('Cadastre ou ative uma prova neste curso antes de atribuir acesso com prova.')
      return
    }
    createMutation.mutate()
  }

  const toggleAssignmentSelection = (assignmentId: number) => {
    setSelectedAssignmentIds((current) =>
      current.includes(assignmentId) ? current.filter((item) => item !== assignmentId) : [...current, assignmentId]
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => navigate(`/cursos/${id}/prova`)}
          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Atribuições</h1>
          <p className="text-sm text-slate-500">{curso?.titulo}</p>
        </div>
      </div>

      <div className="app-panel mb-5 flex flex-col gap-5 p-5">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Nova atribuição</h2>

        <div>
          <p className="mb-2 text-xs font-medium text-slate-600">Atribuir a</p>
          <div className="flex gap-3">
            {(['setor', 'usuario'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTipo(t)}
                className={`flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
                  tipo === t
                    ? 'border-[var(--brand-red)] bg-red-50 text-[var(--brand-red)]'
                    : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
              >
                {t === 'setor' ? <Building2 size={14} /> : <Users size={14} />}
                {t === 'setor' ? 'Setor' : 'Colaborador'}
              </button>
            ))}
          </div>
          <div className="mt-3">
            {tipo === 'setor' ? (
              <select value={setorId} onChange={(e) => setSetorId(e.target.value)} className="app-input w-full">
                <option value="">— Selecione o setor —</option>
                {setores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome}
                  </option>
                ))}
              </select>
            ) : (
              <select value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)} className="app-input w-full">
                <option value="">— Selecione o colaborador —</option>
                {usuarios.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nome}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-slate-600">O que pode acessar</p>
          <div className="flex flex-col gap-2">
            {TIPO_ACESSO_OPTIONS.map((opt) => {
              const requiresProof = opt.value !== 'so_curso'
              const disabled = requiresProof && !hasActiveProof

              return (
                <button
                  key={opt.value}
                  onClick={() => setTipoAcesso(opt.value)}
                  disabled={disabled}
                  className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                    tipoAcesso === opt.value
                      ? 'border-[var(--brand-red)] bg-red-50'
                      : 'border-slate-200 hover:bg-slate-50'
                  } ${disabled ? 'cursor-not-allowed opacity-45 hover:bg-white' : ''}`}
                >
                  <div
                    className={`flex items-center gap-0.5 ${
                      tipoAcesso === opt.value ? 'text-[var(--brand-red)]' : 'text-slate-400'
                    }`}
                  >
                    {opt.icon}
                  </div>
                  <div className="flex-1">
                    <p
                      className={`text-sm font-semibold ${
                        tipoAcesso === opt.value ? 'text-[var(--brand-red)]' : 'text-slate-700'
                      }`}
                    >
                      {opt.label}
                    </p>
                    <p className="text-xs text-slate-400">
                      {disabled ? 'Indisponível até existir uma prova ativa para este curso.' : opt.desc}
                    </p>
                  </div>
                  <div
                    className={`h-4 w-4 rounded-full border-2 ${
                      tipoAcesso === opt.value ? 'border-[var(--brand-red)] bg-[var(--brand-red)]' : 'border-slate-300'
                    }`}
                  />
                </button>
              )
            })}
          </div>
          {!hasActiveProof ? (
            <p className="mt-2 text-xs text-amber-600">
              Este curso ainda não possui prova ativa. Por isso, por enquanto só é possível atribuir como <strong>Só Curso</strong>.
            </p>
          ) : null}
        </div>

        {error ? <p className="text-xs text-red-500">{error}</p> : null}

        <button
          onClick={handleAdd}
          disabled={createMutation.isPending}
          className="inline-flex self-start rounded-md bg-[var(--brand-red)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          <span className="inline-flex items-center gap-2">
            <Plus size={14} /> {createMutation.isPending ? 'Adicionando...' : 'Adicionar atribuição'}
          </span>
        </button>
      </div>

      <div className="app-panel p-5">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-400">
          Atribuições atuais ({atribuicoes.length})
        </h2>

        {/* Builder de mensagem */}
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Mensagem do aviso</div>
            <button
              type="button"
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:border-red-200 hover:text-red-700"
              onClick={() => setCourseMessage('Olá, {colaborador}! O curso "{curso}" já está disponível na plataforma da Gontijo. Acesse o app, assista ao conteúdo e conclua a prova, se houver.')}
            >
              Restaurar padrão
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {COURSE_MESSAGE_VARIABLES.map((v) => (
              <button
                key={v.token}
                type="button"
                onClick={() => setCourseMessage((cur) => cur + v.token)}
                className="rounded-xl border border-white bg-white px-3 py-2 text-left shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:border-red-200 hover:ring-red-100"
              >
                <span className="block text-sm font-black text-red-700">{v.token}</span>
                <span className="block text-xs text-slate-500">{v.label}</span>
              </button>
            ))}
          </div>
          <textarea
            className="field-textarea min-h-[80px]"
            value={courseMessage}
            onChange={(e) => setCourseMessage(e.target.value)}
          />
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!atribuicoes.length || notifyMutation.isPending}
            onClick={() => notifyMutation.mutate(atribuicoes.map((item: AtribuicaoRecord) => item.id))}
          >
            <MessageCircle size={14} />
            Notificar todos deste curso
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!selectedAssignmentIds.length || notifyMutation.isPending}
            onClick={() => notifyMutation.mutate(selectedAssignmentIds)}
          >
            <MessageCircle size={14} />
            Notificar selecionados ({selectedAssignmentIds.length})
          </button>
          <div className="text-xs text-slate-500">
            O aviso é manual e resolve usuários diretos e também colaboradores dos setores atribuídos.
          </div>
        </div>

        {/* Barra de progresso */}
        {(notifyMutation.isPending || notifyMutation.isSuccess) ? (
          <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <div className="flex items-center justify-between text-sm font-semibold text-slate-700">
              {notifyMutation.isPending
                ? <span className="animate-pulse">Enviando avisos...</span>
                : <span className="text-emerald-700">Concluído — {notifyMutation.data.total} processado(s)</span>}
              <span className="text-xs text-slate-400">{Math.round(sendProgress)}%</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
              {notifyMutation.isPending ? (
                <div className="h-full rounded-full bg-red-500 transition-all duration-200" style={{ width: `${sendProgress}%` }} />
              ) : (
                <div className="flex h-full w-full overflow-hidden rounded-full">
                  {notifyMutation.data.sent > 0 && <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${(notifyMutation.data.sent / notifyMutation.data.total) * 100}%` }} />}
                  {notifyMutation.data.skipped > 0 && <div className="h-full bg-amber-400 transition-all duration-500" style={{ width: `${(notifyMutation.data.skipped / notifyMutation.data.total) * 100}%` }} />}
                  {notifyMutation.data.failed > 0 && <div className="h-full bg-red-500 transition-all duration-500" style={{ width: `${(notifyMutation.data.failed / notifyMutation.data.total) * 100}%` }} />}
                </div>
              )}
            </div>
            {notifyMutation.isSuccess && (
              <div className="flex flex-wrap gap-4 text-xs font-semibold">
                <span className="flex items-center gap-1.5 text-emerald-700"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />{notifyMutation.data.sent} enviado(s)</span>
                <span className="flex items-center gap-1.5 text-amber-700"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" />{notifyMutation.data.skipped} ignorado(s)</span>
                <span className="flex items-center gap-1.5 text-red-700"><span className="h-2.5 w-2.5 rounded-full bg-red-500" />{notifyMutation.data.failed} falha(s)</span>
              </div>
            )}
          </div>
        ) : null}

        {sendFeedback ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {sendFeedback}
          </div>
        ) : null}

        {atribuicoes.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">Nenhuma atribuição ainda.</p>
        ) : (
          <div className="flex flex-col divide-y divide-slate-100">
            {atribuicoes.map((a: AtribuicaoRecord) => (
              <div key={a.id} className="flex items-center justify-between gap-3 py-3">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedAssignmentIds.includes(a.id)}
                    onChange={() => toggleAssignmentSelection(a.id)}
                  />
                  {a.tipo === 'setor' ? (
                    <Building2 size={14} className="shrink-0 text-blue-500" />
                  ) : (
                    <Users size={14} className="shrink-0 text-green-500" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-700">
                      {a.tipo === 'setor' ? a.setor_nome : a.usuario_nome}
                    </p>
                    <p className="text-xs text-slate-400">{a.tipo === 'setor' ? 'Setor' : 'Colaborador'}</p>
                  </div>
                </div>

                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    tipoAcessoBadge(a.tipo_acesso ?? 'curso_e_prova')
                  }`}
                >
                  {tipoAcessoLabel(a.tipo_acesso ?? 'curso_e_prova')}
                </span>

                <button
                  onClick={() => {
                    if (confirm('Remover esta atribuição?')) deleteMutation.mutate(a.id)
                  }}
                  className="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
