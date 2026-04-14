import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MessageCircle, QrCode, RefreshCcw, Settings, Wifi, WifiOff } from 'lucide-react'
import QueryFeedback from '@/components/ui/QueryFeedback'
import { extractApiErrorMessage, whatsappAdminService } from '@/lib/gontijo-api'

function formatDateTime(value: string) {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(parsed)
}

type Filters = {
  eventType: string
  status: string
  dateFrom: string
  dateTo: string
  obra: string
  operator: string
}

const DEFAULT_FILTERS: Filters = {
  eventType: 'diary_overdue_reminder',
  status: '',
  dateFrom: '',
  dateTo: '',
  obra: '',
  operator: '',
}

const DIARY_MESSAGE_VARIABLES = [
  { token: '{operador}', label: 'Operador', description: 'Nome do operador' },
  { token: '{obra}', label: 'Obra', description: 'Numero da obra' },
  { token: '{equipamento}', label: 'Equipamento', description: 'Maquina vinculada' },
  { token: '{data}', label: 'Data', description: 'Dia do diario' },
  { token: '{prazo}', label: 'Prazo', description: 'Limite para envio' },
]

export default function WhatsAppLogsPage() {
  const queryClient = useQueryClient()
  const diaryMessageRef = useRef<HTMLTextAreaElement | null>(null)
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [page] = useState(1)
  const [activeTab, setActiveTab] = useState<'config' | 'logs'>('config')
  const [showQrCode, setShowQrCode] = useState(false)
  const [selectedDiaryKeys, setSelectedDiaryKeys] = useState<string[]>([])
  const [diaryMessage, setDiaryMessage] = useState('Ola, {operador}! O diario da obra {obra} / equipamento {equipamento}, referente ao dia {data}, esta atrasado. Prazo era {prazo}. Por favor, envie pelo app da Gontijo.')
  const [sendProgress, setSendProgress] = useState(0)
  const sendProgressRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const statusQuery = useQuery({
    queryKey: ['whatsapp-status'],
    queryFn: whatsappAdminService.getStatus,
    staleTime: 1000 * 20,
    refetchInterval: activeTab === 'config' ? 1000 * 20 : false,
  })

  const qrCodeQuery = useQuery({
    queryKey: ['whatsapp-qr-code'],
    queryFn: whatsappAdminService.getQrCode,
    enabled: showQrCode,
    staleTime: 1000 * 15,
  })

  const logsQuery = useQuery({
    queryKey: ['whatsapp-logs', filters, page],
    queryFn: () =>
      whatsappAdminService.listLogs({
        page,
        limit: 50,
        eventType: filters.eventType,
        status: filters.status,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        obra: filters.obra,
        operator: filters.operator,
      }),
    enabled: activeTab === 'logs',
  })

  const diaryPreviewQuery = useQuery({
    queryKey: ['whatsapp-diary-overdue-preview'],
    queryFn: whatsappAdminService.getDiaryOverduePreview,
    enabled: activeTab === 'config',
    staleTime: 1000 * 30,
  })

  const sendDiaryMutation = useMutation({
    mutationFn: () => whatsappAdminService.sendDiaryOverdueReminders({
      keys: selectedDiaryKeys,
      messageText: diaryMessage,
    }),
    onSuccess: async () => {
      setSelectedDiaryKeys([])
      await queryClient.invalidateQueries({ queryKey: ['whatsapp-diary-overdue-preview'] })
      await queryClient.invalidateQueries({ queryKey: ['whatsapp-logs'] })
    },
  })

  function updateField<K extends keyof Filters>(field: K, value: Filters[K]) {
    setFilters((current) => ({ ...current, [field]: value }))
  }

  function insertDiaryVariable(token: string) {
    const textarea = diaryMessageRef.current
    if (!textarea) {
      setDiaryMessage((current) => `${current}${token}`)
      return
    }

    const start = textarea.selectionStart ?? diaryMessage.length
    const end = textarea.selectionEnd ?? diaryMessage.length
    const nextMessage = `${diaryMessage.slice(0, start)}${token}${diaryMessage.slice(end)}`
    setDiaryMessage(nextMessage)

    window.requestAnimationFrame(() => {
      textarea.focus()
      const nextCursor = start + token.length
      textarea.setSelectionRange(nextCursor, nextCursor)
    })
  }

  useEffect(() => {
    if (sendDiaryMutation.isPending) {
      setSendProgress(0)
      const total = Math.max(1, selectedDiaryKeys.length)
      const estimatedMs = Math.max(2000, total * 1800)
      const step = 92 / (estimatedMs / 100)
      sendProgressRef.current = setInterval(() => {
        setSendProgress((prev) => Math.min(prev + step, 92))
      }, 100)
    } else {
      if (sendProgressRef.current) clearInterval(sendProgressRef.current)
      if (sendDiaryMutation.isSuccess) setSendProgress(100)
    }
    return () => {
      if (sendProgressRef.current) clearInterval(sendProgressRef.current)
    }
  }, [sendDiaryMutation.isPending, sendDiaryMutation.isSuccess])

  const status = statusQuery.data
  const qrImage = qrCodeQuery.data?.image
    ? qrCodeQuery.data.image.startsWith('data:image')
      ? qrCodeQuery.data.image
      : `data:image/png;base64,${qrCodeQuery.data.image}`
    : ''
  const instanceConnected = status?.instance.connected === true
  const instanceDisconnected = status?.instance.connected === false
  const selectedDiaryItems = diaryPreviewQuery.data?.items.filter((item) => selectedDiaryKeys.includes(item.key)) || []

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-heading">WhatsApp e lembretes</h1>
          <p className="page-subtitle">Configure a instância Z-API, acompanhe conexão e monitore envios.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className={`btn ${activeTab === 'config' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('config')}>
          <Settings size={16} />
          Configuração
        </button>
        <button type="button" className={`btn ${activeTab === 'logs' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('logs')}>
          <MessageCircle size={16} />
          Histórico
        </button>
      </div>

      {statusQuery.isLoading ? (
        <QueryFeedback type="loading" title="Validando Z-API" description="Carregando configuração e status do scheduler local." />
      ) : null}

      {activeTab === 'config' && status ? (
        <section className="app-panel section-panel">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-red-700">
                <Settings size={18} />
                Configuração da instância
              </div>
              <h2 className="text-2xl font-black text-slate-900">Z-API WhatsApp</h2>
              <p className="mt-1 max-w-2xl text-sm text-slate-500">
                As credenciais ficam somente no backend local. Use esta área para acompanhar conexão e gerar o QR Code quando a instância estiver desconectada.
              </p>
            </div>
            <button type="button" className="btn btn-secondary" onClick={() => statusQuery.refetch()}>
              <RefreshCcw size={15} />
              Atualizar status
            </button>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <article className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Integração</div>
                <div className="mt-2 text-2xl font-black text-slate-900">{status.configured ? 'Configurada' : 'Pendente'}</div>
                <div className="mt-1 text-sm text-slate-500">{status.enabled ? 'Envios habilitados' : 'Envios desativados'}</div>
              </article>
              <article className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Instância</div>
                <div className="mt-2 break-all text-sm font-black text-slate-900">{status.instanceId || 'Não informada'}</div>
                <div className="mt-1 text-sm text-slate-500">{status.baseUrl || 'Sem base URL'}</div>
              </article>
              <article className={`rounded-2xl border p-4 ${instanceConnected ? 'border-emerald-200 bg-emerald-50' : instanceDisconnected ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
                  {instanceConnected ? <Wifi size={16} /> : <WifiOff size={16} />}
                  Conexão
                </div>
                <div className={`mt-2 text-2xl font-black ${instanceConnected ? 'text-emerald-800' : instanceDisconnected ? 'text-red-800' : 'text-amber-800'}`}>
                  {instanceConnected ? 'Conectada' : instanceDisconnected ? 'Desconectada' : 'A conferir'}
                </div>
                <div className="mt-1 text-sm text-slate-600">{status.instance.status || 'status desconhecido'}</div>
              </article>
              <article className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Client-Token</div>
                <div className="mt-2 text-2xl font-black text-slate-900">{status.clientTokenConfigured ? 'OK' : 'Vazio'}</div>
                <div className="mt-1 text-sm text-slate-500">Recomendado para segurança da Z-API</div>
              </article>
              <article className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Logs</div>
                <div className="mt-2 text-2xl font-black text-slate-900">{status.logsTableReady ? 'Pronto' : 'Migration'}</div>
                <div className="mt-1 text-sm text-slate-500">Tabela de auditoria</div>
              </article>
              <article className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Scheduler local</div>
                <div className="mt-2 text-2xl font-black text-slate-900">{status.schedulerEnabled ? 'Ativo' : 'Desligado'}</div>
                <div className="mt-1 text-sm text-slate-500">
                  Última execução: {status.schedulerLastRunAt ? formatDateTime(status.schedulerLastRunAt) : '-'}
                </div>
              </article>
            </div>

            <aside className="rounded-3xl border border-red-100 bg-gradient-to-br from-white to-red-50 p-5 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.14em] text-red-700">
                <QrCode size={18} />
                QR Code
              </div>
              <p className="mt-2 text-sm text-slate-600">
                Clique para buscar o QR Code da Z-API e escaneie com o WhatsApp do número que vai enviar as mensagens.
              </p>
              <div className="mt-4">
                <button
                  type="button"
                  className="btn btn-primary w-full justify-center"
                  onClick={() => {
                    setShowQrCode(true)
                    void qrCodeQuery.refetch()
                  }}
                  disabled={!status.configured || qrCodeQuery.isFetching}
                >
                  <QrCode size={16} />
                  {qrCodeQuery.isFetching ? 'Carregando QR...' : 'Carregar QR Code'}
                </button>
              </div>

              {qrCodeQuery.isError ? (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {extractApiErrorMessage(qrCodeQuery.error)}
                </div>
              ) : null}

              {qrImage ? (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                  <img src={qrImage} alt="QR Code da Z-API" className="mx-auto h-auto max-w-full rounded-xl" />
                  <p className="mt-3 text-center text-xs text-slate-500">Depois de escanear, clique em “Atualizar status”.</p>
                </div>
              ) : null}

              {status.instance.error ? (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  {status.instance.error}
                </div>
              ) : null}
            </aside>
          </div>
        </section>
      ) : null}

      {activeTab === 'config' ? (
        <section className="app-panel section-panel">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-red-700">
                <MessageCircle size={18} />
                Preview de diarios atrasados
              </div>
              <h2 className="text-2xl font-black text-slate-900">Enviar lembrete ao operador da maquina</h2>
              <p className="mt-1 max-w-3xl text-sm text-slate-500">
                Regra: o diario do dia pode ser feito ate 08:00 do dia seguinte. Depois disso, aparece aqui para revisao antes do envio.
              </p>
            </div>
            <button type="button" className="btn btn-secondary" onClick={() => diaryPreviewQuery.refetch()}>
              <RefreshCcw size={15} />
              Atualizar preview
            </button>
          </div>

          {diaryPreviewQuery.isLoading ? (
            <QueryFeedback type="loading" title="Buscando diarios atrasados" description="Conferindo obras ativas, equipamentos e operadores vinculados." />
          ) : null}

          {diaryPreviewQuery.isError ? (
            <QueryFeedback type="error" title="Nao foi possivel montar o preview" description={extractApiErrorMessage(diaryPreviewQuery.error)} />
          ) : null}

          {diaryPreviewQuery.data ? (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <article className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Atrasados</div>
                  <div className="mt-1 text-2xl font-black text-slate-900">{diaryPreviewQuery.data.total}</div>
                </article>
                <article className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Prontos para envio</div>
                  <div className="mt-1 text-2xl font-black text-emerald-700">{diaryPreviewQuery.data.sendable}</div>
                </article>
                <article className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Selecionados</div>
                  <div className="mt-1 text-2xl font-black text-red-700">{selectedDiaryKeys.length}</div>
                </article>
              </div>

              <div>
                <label className="field-label">Mensagem do envio</label>
                <div className="mb-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Variaveis da mensagem</div>
                      <p className="mt-1 text-xs text-slate-500">Clique ou arraste um card para montar o texto do lembrete.</p>
                    </div>
                    <button
                      type="button"
                      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:border-red-200 hover:text-red-700"
                      onClick={() => setDiaryMessage('Ola, {operador}! O diario da obra {obra} / equipamento {equipamento}, referente ao dia {data}, esta atrasado. Prazo era {prazo}. Por favor, envie pelo app da Gontijo.')}
                    >
                      Restaurar padrao
                    </button>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                    {DIARY_MESSAGE_VARIABLES.map((variable) => (
                      <button
                        key={variable.token}
                        type="button"
                        draggable
                        onClick={() => insertDiaryVariable(variable.token)}
                        onDragStart={(event) => {
                          event.dataTransfer.setData('text/plain', variable.token)
                          event.dataTransfer.effectAllowed = 'copy'
                        }}
                        className="cursor-grab rounded-2xl border border-white bg-white px-3 py-3 text-left shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:border-red-200 hover:ring-red-100 active:cursor-grabbing"
                        title={`Inserir ${variable.token}`}
                      >
                        <span className="block text-sm font-black text-red-700">{variable.token}</span>
                        <span className="mt-1 block text-xs font-bold text-slate-800">{variable.label}</span>
                        <span className="mt-0.5 block text-[11px] text-slate-500">{variable.description}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  ref={diaryMessageRef}
                  className="field-textarea min-h-[110px]"
                  value={diaryMessage}
                  onChange={(event) => setDiaryMessage(event.target.value)}
                  onDragOver={(event) => {
                    event.preventDefault()
                    event.dataTransfer.dropEffect = 'copy'
                  }}
                  onDrop={(event) => {
                    event.preventDefault()
                    const token = event.dataTransfer.getData('text/plain')
                    if (DIARY_MESSAGE_VARIABLES.some((variable) => variable.token === token)) {
                      insertDiaryVariable(token)
                    }
                  }}
                />
                <p className="mt-1 text-xs text-slate-500">No envio, o sistema troca automaticamente os cards pelos dados reais de cada diario selecionado.</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setSelectedDiaryKeys(diaryPreviewQuery.data?.items.filter((item) => item.canSend).map((item) => item.key) || [])}
                >
                  Selecionar enviaveis
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setSelectedDiaryKeys([])}>
                  Limpar selecao
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!selectedDiaryKeys.length || sendDiaryMutation.isPending}
                  onClick={() => sendDiaryMutation.mutate()}
                >
                  <MessageCircle size={15} />
                  {sendDiaryMutation.isPending ? 'Enviando...' : `Enviar ${selectedDiaryKeys.length} lembrete(s)`}
                </button>
              </div>

              {(sendDiaryMutation.isPending || sendDiaryMutation.isSuccess) ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
                  <div className="flex items-center justify-between text-sm font-semibold text-slate-700">
                    {sendDiaryMutation.isPending ? (
                      <span className="animate-pulse">
                        Enviando... {Math.round(sendProgress / 100 * selectedDiaryKeys.length)} de {selectedDiaryKeys.length}
                      </span>
                    ) : (
                      <span className="text-emerald-700">
                        Concluido — {sendDiaryMutation.data.total} processado(s)
                      </span>
                    )}
                    <span className="text-xs text-slate-400">{Math.round(sendProgress)}%</span>
                  </div>

                  {/* Barra de progresso */}
                  <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
                    {sendDiaryMutation.isPending ? (
                      <div
                        className="h-full rounded-full bg-red-500 transition-all duration-200"
                        style={{ width: `${sendProgress}%` }}
                      />
                    ) : (
                      <div className="flex h-full w-full overflow-hidden rounded-full">
                        {sendDiaryMutation.data.sent > 0 && (
                          <div
                            className="h-full bg-emerald-500 transition-all duration-500"
                            style={{ width: `${(sendDiaryMutation.data.sent / sendDiaryMutation.data.total) * 100}%` }}
                          />
                        )}
                        {sendDiaryMutation.data.skipped > 0 && (
                          <div
                            className="h-full bg-amber-400 transition-all duration-500"
                            style={{ width: `${(sendDiaryMutation.data.skipped / sendDiaryMutation.data.total) * 100}%` }}
                          />
                        )}
                        {sendDiaryMutation.data.failed > 0 && (
                          <div
                            className="h-full bg-red-500 transition-all duration-500"
                            style={{ width: `${(sendDiaryMutation.data.failed / sendDiaryMutation.data.total) * 100}%` }}
                          />
                        )}
                      </div>
                    )}
                  </div>

                  {/* Legenda resultado */}
                  {sendDiaryMutation.isSuccess && (
                    <div className="flex flex-wrap gap-4 text-xs font-semibold">
                      <span className="flex items-center gap-1.5 text-emerald-700">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                        {sendDiaryMutation.data.sent} enviado(s)
                      </span>
                      <span className="flex items-center gap-1.5 text-amber-700">
                        <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                        {sendDiaryMutation.data.skipped} ignorado(s)
                      </span>
                      <span className="flex items-center gap-1.5 text-red-700">
                        <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                        {sendDiaryMutation.data.failed} falha(s)
                      </span>
                    </div>
                  )}
                </div>
              ) : null}

              {sendDiaryMutation.isError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {extractApiErrorMessage(sendDiaryMutation.error)}
                </div>
              ) : null}

              <div className="table-scroll">
                <table className="data-table min-w-[1180px]">
                  <thead>
                    <tr>
                      <th>Selecionar</th>
                      <th>Obra</th>
                      <th>Equipamento</th>
                      <th>Data atrasada</th>
                      <th>Prazo</th>
                      <th>Operador</th>
                      <th>Telefone</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diaryPreviewQuery.data.items.length ? (
                      diaryPreviewQuery.data.items.map((item) => (
                        <tr key={item.key}>
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedDiaryKeys.includes(item.key)}
                              onChange={(event) =>
                                setSelectedDiaryKeys((current) =>
                                  event.target.checked
                                    ? [...new Set([...current, item.key])]
                                    : current.filter((key) => key !== item.key)
                                )
                              }
                            />
                          </td>
                          <td>{item.constructionNumber || '-'}</td>
                          <td>{item.equipmentName || '-'}</td>
                          <td>{item.referenceDate ? item.referenceDate.split('-').reverse().join('/') : '-'}</td>
                          <td>{item.dueAt || '-'}</td>
                          <td>{item.operatorName || '-'}</td>
                          <td>{item.operatorPhone || '-'}</td>
                          <td>
                            <span className={`status-badge ${item.canSend ? 'status-success' : 'bg-amber-50 text-amber-700'}`}>
                              {item.canSend ? 'Pronto' : item.reason === 'missing_equipment_operator' ? 'Sem operador' : 'Sem telefone'}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8}>
                          <QueryFeedback type="empty" title="Nenhum diario atrasado" description="Pela regra atual, nao ha lembretes pendentes para enviar." />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {selectedDiaryItems.length ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Preview usando a primeira selecao: {diaryMessage
                    .replace(/\{operador\}/gi, selectedDiaryItems[0]?.operatorName || 'colaborador')
                    .replace(/\{obra\}/gi, selectedDiaryItems[0]?.constructionNumber || '-')
                    .replace(/\{equipamento\}/gi, selectedDiaryItems[0]?.equipmentName || '-')
                    .replace(/\{data\}/gi, selectedDiaryItems[0]?.referenceDate ? selectedDiaryItems[0].referenceDate.split('-').reverse().join('/') : '-')
                    .replace(/\{prazo\}/gi, selectedDiaryItems[0]?.dueAt || '-')}
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {activeTab === 'logs' && status ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article className="app-panel p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Integração</div>
            <div className="mt-2 text-2xl font-black text-slate-900">{status.configured ? 'OK' : 'Pendente'}</div>
            <div className="mt-1 text-sm text-slate-500">{status.baseUrl || 'Sem base URL'}</div>
          </article>
          <article className="app-panel p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Logs</div>
            <div className="mt-2 text-2xl font-black text-slate-900">{status.logsTableReady ? 'Pronto' : 'Migration'}</div>
            <div className="mt-1 text-sm text-slate-500">Tabela de auditoria</div>
          </article>
          <article className="app-panel p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Responsável por obra</div>
            <div className="mt-2 text-2xl font-black text-slate-900">{status.responsibleColumnReady ? 'Pronto' : 'Migration'}</div>
            <div className="mt-1 text-sm text-slate-500">Vínculo fixo do operador</div>
          </article>
          <article className="app-panel p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Scheduler local</div>
            <div className="mt-2 text-2xl font-black text-slate-900">{status.schedulerEnabled ? 'Ativo' : 'Desligado'}</div>
            <div className="mt-1 text-sm text-slate-500">
              Última execução: {status.schedulerLastRunAt ? formatDateTime(status.schedulerLastRunAt) : '-'}
            </div>
          </article>
        </section>
      ) : null}

      {activeTab === 'logs' && statusQuery.data?.schedulerLastError ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {statusQuery.data.schedulerLastError}
        </div>
      ) : null}

      {activeTab === 'logs' ? (
        <section className="app-panel section-panel">
          <div className="mb-4 flex items-center gap-2">
            <MessageCircle size={18} />
            <h2 className="section-heading !mb-0">Filtros</h2>
          </div>
          <div className="filter-grid">
            <div className="filter-col-3">
              <label className="field-label">Tipo</label>
              <select className="field-select" value={filters.eventType} onChange={(event) => updateField('eventType', event.target.value)}>
                <option value="">Todos</option>
                <option value="diary_overdue_reminder">Diário atrasado</option>
                <option value="point_missing_reminder">Ponto pendente</option>
                <option value="course_available_notice">Curso disponível</option>
              </select>
            </div>
            <div className="filter-col-2">
              <label className="field-label">Status</label>
              <select className="field-select" value={filters.status} onChange={(event) => updateField('status', event.target.value)}>
                <option value="">Todos</option>
                <option value="sent">Enviado</option>
                <option value="failed">Falhou</option>
                <option value="skipped">Ignorado</option>
                <option value="queued">Na fila</option>
              </select>
            </div>
            <div className="filter-col-2">
              <label className="field-label">De</label>
              <input type="date" className="field-input" value={filters.dateFrom} onChange={(event) => updateField('dateFrom', event.target.value)} />
            </div>
            <div className="filter-col-2">
              <label className="field-label">Até</label>
              <input type="date" className="field-input" value={filters.dateTo} onChange={(event) => updateField('dateTo', event.target.value)} />
            </div>
            <div className="filter-col-3">
              <label className="field-label">Obra ou alvo</label>
              <input className="field-input" value={filters.obra} onChange={(event) => updateField('obra', event.target.value)} placeholder="Ex.: 22307" />
            </div>
            <div className="filter-col-3">
              <label className="field-label">Operador</label>
              <input className="field-input" value={filters.operator} onChange={(event) => updateField('operator', event.target.value)} placeholder="Nome do operador" />
            </div>
          </div>
          <div className="mt-4">
            <button type="button" className="btn btn-secondary" onClick={() => setFilters(DEFAULT_FILTERS)}>
              <RefreshCcw size={15} />
              Resetar filtros
            </button>
          </div>
        </section>
      ) : null}

      {activeTab === 'logs' && logsQuery.isLoading ? (
        <QueryFeedback type="loading" title="Carregando logs do WhatsApp" description="Buscando histórico de envios e falhas." />
      ) : null}

      {activeTab === 'logs' && logsQuery.isError ? (
        <QueryFeedback type="error" title="Não foi possível carregar os logs" description={extractApiErrorMessage(logsQuery.error)} />
      ) : null}

      {activeTab === 'logs' && logsQuery.data ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <article className="app-panel p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Atrasos no periodo</div>
              <div className="mt-2 text-3xl font-black text-slate-900">{logsQuery.data.diaryDelaySummary.total}</div>
              <div className="mt-1 text-sm text-slate-500">Diarios atrasados registrados</div>
            </article>
            <article className="app-panel p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Mensagens enviadas</div>
              <div className="mt-2 text-3xl font-black text-emerald-700">{logsQuery.data.diaryDelaySummary.sent}</div>
              <div className="mt-1 text-sm text-slate-500">Lembretes via WhatsApp</div>
            </article>
            <article className="app-panel p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Operadores</div>
              <div className="mt-2 text-3xl font-black text-red-700">{logsQuery.data.diaryDelaySummary.operators}</div>
              <div className="mt-1 text-sm text-slate-500">Com atraso no filtro atual</div>
            </article>
            <article className="app-panel p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Obras impactadas</div>
              <div className="mt-2 text-3xl font-black text-slate-900">{logsQuery.data.diaryDelaySummary.constructions}</div>
              <div className="mt-1 text-sm text-slate-500">Obras com lembrete</div>
            </article>
          </section>

          {logsQuery.data.diaryDelaySummary.topOperators.length ? (
            <section className="app-panel section-panel">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="section-heading !mb-1">Operadores com diario atrasado</h2>
                  <p className="text-sm text-slate-500">Ranking do periodo filtrado, considerando os lembretes registrados pelo WhatsApp.</p>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {logsQuery.data.diaryDelaySummary.topOperators.map((operator) => (
                  <button
                    key={operator.name}
                    type="button"
                    onClick={() => updateField('operator', operator.name)}
                    className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-red-200 hover:bg-red-50/40"
                  >
                    <div className="truncate text-base font-black text-slate-900">{operator.name}</div>
                    <div className="mt-3 flex items-end justify-between gap-3">
                      <div>
                        <div className="text-2xl font-black text-red-700">{operator.total}</div>
                        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">atraso(s)</div>
                      </div>
                      <div className="text-right text-xs text-slate-500">
                        <div>{operator.sent} enviado(s)</div>
                        <div>{operator.lastDelayAt ? formatDateTime(operator.lastDelayAt) : '-'}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <section className="app-panel table-shell">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="section-heading !mb-1">Histórico</h2>
              <p className="text-sm text-slate-500">{logsQuery.data.total} registro(s) encontrados.</p>
            </div>
          </div>
          <div className="table-scroll">
            <table className="data-table min-w-[1540px]">
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Evento</th>
                  <th>Histórico</th>
                  <th>Status</th>
                  <th>Alvo</th>
                  <th>Telefone</th>
                  <th>Obra</th>
                  <th>Curso</th>
                  <th>Referência</th>
                  <th>Erro</th>
                </tr>
              </thead>
              <tbody>
                {logsQuery.data.items.length ? (
                  logsQuery.data.items.map((item) => (
                    <tr key={item.id}>
                      <td>{formatDateTime(item.createdAt)}</td>
                      <td>{item.eventLabel}</td>
                      <td className="max-w-[420px] whitespace-normal text-sm font-semibold text-slate-700">{item.historyText || '-'}</td>
                      <td>
                        <span className={`status-badge ${
                          item.status === 'sent'
                            ? 'status-success'
                            : item.status === 'failed'
                              ? 'bg-red-50 text-red-700'
                              : item.status === 'skipped'
                                ? 'bg-amber-50 text-amber-700'
                                : 'status-neutral'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      <td>{item.targetName || item.userName || '-'}</td>
                      <td>{item.phone || '-'}</td>
                      <td>{item.obraNumero || '-'}</td>
                      <td>{item.courseTitle || '-'}</td>
                      <td>{item.referenceDate || '-'}</td>
                      <td className="max-w-[280px] whitespace-normal text-sm text-slate-600">{item.errorText || '-'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={10}>
                      <QueryFeedback type="empty" title="Nenhum log encontrado" description="Ajuste os filtros ou gere os primeiros envios para começar a auditoria." />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          </section>
        </>
      ) : null}
    </div>
  )
}
