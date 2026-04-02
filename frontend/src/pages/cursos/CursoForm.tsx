import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Save, BookOpen, ClipboardList } from 'lucide-react'
import { cursosApi } from '@/lib/gontijo-api'

export default function CursoFormPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id
  const qc = useQueryClient()

  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [thumbnailUrl, setThumbnailUrl] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [ativo, setAtivo] = useState(true)
  const [error, setError] = useState('')

  const { data: curso, isLoading } = useQuery({
    queryKey: ['curso', id],
    queryFn: () => cursosApi.get(Number(id)),
    enabled: isEdit,
  })

  useEffect(() => {
    if (curso) {
      setTitulo(curso.titulo)
      setDescricao(curso.descricao ?? '')
      setThumbnailUrl(curso.thumbnail_url ?? '')
      setVideoUrl(curso.video_url ?? '')
      setAtivo(!!curso.ativo)
    }
  }, [curso])

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = { titulo, descricao: descricao || null, thumbnail_url: thumbnailUrl || null, video_url: videoUrl || null, ativo: ativo ? 1 : 0 }
      return isEdit ? cursosApi.update(Number(id), payload) : cursosApi.create(payload as Parameters<typeof cursosApi.create>[0])
    },
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['cursos'] })
      navigate(`/cursos/${saved!.id}/prova`)
    },
    onError: (e: Error) => setError(e.message),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!titulo.trim()) { setError('Título obrigatório'); return }
    saveMutation.mutate()
  }

  if (isEdit && isLoading) return <div className="py-12 text-center text-sm text-slate-400">Carregando...</div>

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => navigate('/cursos')} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <BookOpen size={18} className="text-[var(--brand-red)]" />
            {isEdit ? 'Editar Curso' : 'Novo Curso'}
          </h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="app-panel flex flex-col gap-4 p-5">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Dados do Curso</h2>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Título *</label>
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="app-input w-full"
              placeholder="Ex: Segurança no Trabalho em Fundações"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Descrição</label>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={3}
              className="app-input w-full resize-none"
              placeholder="Descreva o objetivo do curso..."
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">URL da Thumbnail</label>
            <input
              value={thumbnailUrl}
              onChange={(e) => setThumbnailUrl(e.target.value)}
              className="app-input w-full"
              placeholder="https://..."
            />
            {thumbnailUrl && (
              <img src={thumbnailUrl} alt="preview" className="mt-2 h-32 w-full rounded-md object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">URL do Vídeo (YouTube)</label>
            <input
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              className="app-input w-full"
              placeholder="https://youtube.com/watch?v=..."
            />
            <p className="mt-1 text-xs text-slate-400">Cole a URL do YouTube. O colaborador poderá assistir pelo app.</p>
          </div>

          {isEdit && (
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
              <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} className="rounded" />
              Curso ativo
            </label>
          )}
        </div>

        {error && <p className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="inline-flex items-center gap-2 rounded-md bg-[var(--brand-red)] px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            <Save size={14} />
            {saveMutation.isPending ? 'Salvando...' : isEdit ? 'Salvar e ir para Prova' : 'Criar e configurar Prova'}
          </button>
          {isEdit && (
            <button
              type="button"
              onClick={() => navigate(`/cursos/${id}/prova`)}
              className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              <ClipboardList size={14} /> Editar Prova
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate('/cursos')}
            className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
