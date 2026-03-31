import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, UserPlus, Users, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { diarioService, extractApiErrorMessage, usuarioService } from '@/lib/gontijo-api'

type Props = {
  diarioId: number
  equipamentoId?: string
}

type TeamMember = {
  userId: number | null
  nome: string
}

function normalizeTeamRows(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (typeof item === 'string') return { userId: null, nome: item.trim() }
      if (item && typeof item === 'object') {
        const row = item as Record<string, unknown>
        return {
          userId: Number(row.userId ?? row.user_id ?? row.usuario_id ?? row.id) || null,
          nome: String(row.nome || row.nome_membro || row.item || row.name || '').trim(),
        }
      }
      return { userId: null, nome: '' }
    })
    .filter((item) => item.nome)
}

export default function DiarioEquipePage({ diarioId, equipamentoId }: Props) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search.trim())
  const [members, setMembers] = useState<TeamMember[]>([])
  const [submitError, setSubmitError] = useState('')

  const diarioQuery = useQuery({
    queryKey: ['operador-diario', diarioId],
    enabled: diarioId > 0,
    queryFn: () => diarioService.getById(diarioId),
  })

  useEffect(() => {
    if (!diarioQuery.data) return
    const dados = (diarioQuery.data.dadosJson as Record<string, unknown> | null) || {}
    setMembers(normalizeTeamRows(dados.staff))
  }, [diarioQuery.data])

  const suggestionsQuery = useQuery({
    queryKey: ['operador-equipe-sugestoes', deferredSearch],
    enabled: deferredSearch.length >= 1,
    queryFn: async () => {
      const result = await usuarioService.list({
        busca: deferredSearch,
        status: 'ativo',
        page: 1,
        limit: 10,
      })
      return result.items
        .filter((item) => item.perfil === 'operador')
        .map((item) => ({ id: item.id, nome: item.nome.trim() }))
        .filter((item) => item.nome)
    },
  })

  const availableSuggestions = useMemo(() => {
    const unique = new Set<string>()
    return (suggestionsQuery.data || []).filter((item) => {
      const normalized = item.nome.toLowerCase()
      if (unique.has(normalized)) return false
      if (members.some((member) => member.nome.toLowerCase() === normalized)) return false
      unique.add(normalized)
      return true
    })
  }, [members, suggestionsQuery.data])

  const canAddFreeText =
    deferredSearch.length > 0 &&
    members.length < 7 &&
    !members.some((item) => item.nome.toLowerCase() === deferredSearch.toLowerCase())

  function addMember(member: TeamMember) {
    const cleaned = member.nome.trim()
    if (!cleaned) return
    if (members.length >= 7) return
    if (members.some((item) => item.nome.toLowerCase() === cleaned.toLowerCase())) return
    setMembers((prev) => [...prev, { userId: member.userId, nome: cleaned }])
    setSearch('')
    setSubmitError('')
  }

  function removeMember(index: number) {
    setMembers((prev) => prev.filter((_, current) => current !== index))
  }

  const mutation = useMutation({
    mutationFn: async () => {
      if (!diarioQuery.data) return
      const currentJson = (diarioQuery.data.dadosJson as Record<string, unknown> | null) || {}
      await diarioService.update(diarioQuery.data.id, {
        dataDiario: diarioQuery.data.dataDiario,
        status: diarioQuery.data.status,
        equipamentoId: diarioQuery.data.equipamentoId,
        assinadoEm: diarioQuery.data.assinadoEm,
        dadosJson: {
          ...currentJson,
          staff: members.map((item) => ({
            usuario_id: item.userId,
            userId: item.userId,
            nome: item.nome,
            item: item.nome,
          })),
        },
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
        <div style={{ color: '#fff', fontSize: '21px', fontWeight: 800 }}>Equipe</div>
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
              <Users size={24} color="#a72727" />
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 900, color: '#a72727' }}>Equipe</div>
              <div style={{ fontSize: '14px', color: '#6b7280', lineHeight: '1.4' }}>
                Busque nomes livremente e monte a equipe do diario.
              </div>
            </div>
          </div>

          <div
            style={{
              borderRadius: '18px',
              background: '#f8fafc',
              border: '1px solid #e5e7eb',
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#475569' }}>Membros adicionados</span>
            <span style={{ fontSize: '13px', fontWeight: 900, color: members.length >= 7 ? '#b91c1c' : '#15803d' }}>
              {members.length}/7
            </span>
          </div>

          <div style={{ position: 'relative', display: 'grid', gap: '10px' }}>
            <div
              style={{
                minHeight: '56px',
                borderRadius: '18px',
                border: '1.5px solid #d8dee7',
                background: '#fff',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '0 16px',
              }}
            >
              <Search size={18} color="#6b7280" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && canAddFreeText) {
                    event.preventDefault()
                    addMember({ userId: null, nome: deferredSearch })
                  }
                }}
                placeholder={members.length >= 7 ? 'Limite de 7 membros atingido' : 'Digite o nome do membro'}
                disabled={members.length >= 7}
                style={{
                  border: 'none',
                  outline: 'none',
                  flex: 1,
                  fontSize: '16px',
                  fontWeight: 600,
                  color: '#111827',
                  background: 'transparent',
                }}
              />
            </div>

            {(availableSuggestions.length > 0 || canAddFreeText || suggestionsQuery.isLoading) && members.length < 7 ? (
              <div
                style={{
                  borderRadius: '18px',
                  border: '1px solid #e5e7eb',
                  background: '#fff',
                  boxShadow: '0 16px 30px rgba(15,23,42,0.08)',
                  overflow: 'hidden',
                }}
              >
                {availableSuggestions.map((item) => (
                  <button
                    key={`${item.id}-${item.nome}`}
                    onClick={() => addMember({ userId: item.id, nome: item.nome })}
                    style={{
                      width: '100%',
                      border: 'none',
                      background: '#fff',
                      padding: '14px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      fontSize: '15px',
                      fontWeight: 700,
                      color: '#111827',
                    }}
                  >
                    <span>{item.nome}</span>
                    <UserPlus size={16} color="#a72727" />
                  </button>
                ))}

                {suggestionsQuery.isLoading ? (
                  <div style={{ padding: '14px 16px', fontSize: '14px', color: '#6b7280', fontWeight: 600 }}>
                    Buscando sugestoes...
                  </div>
                ) : null}

                {canAddFreeText ? (
                  <button
                    onClick={() => addMember({ userId: null, nome: deferredSearch })}
                    style={{
                      width: '100%',
                      border: 'none',
                      borderTop: '1px solid #f1f5f9',
                      background: '#fffaf9',
                      padding: '14px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      fontSize: '15px',
                      fontWeight: 800,
                      color: '#a72727',
                    }}
                  >
                    <span>Adicionar "{deferredSearch}"</span>
                    <UserPlus size={16} color="#a72727" />
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          <div style={{ display: 'grid', gap: '10px' }}>
            {members.length === 0 ? (
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
                Nenhum membro adicionado ainda.
              </div>
            ) : null}

            {members.map((member, index) => (
              <div
                key={`${member.userId || 'manual'}-${member.nome}-${index}`}
                style={{
                  borderRadius: '18px',
                  border: '1px solid #e5e7eb',
                  background: '#fff',
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'grid', gap: '2px' }}>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#111827' }}>{member.nome}</div>
                  {member.userId ? (
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280' }}>Vinculado ao cadastro</div>
                  ) : (
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#b45309' }}>Nome digitado manualmente</div>
                  )}
                </div>
                <button
                  onClick={() => removeMember(index)}
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '999px',
                    border: 'none',
                    background: '#fef2f2',
                    color: '#b91c1c',
                    display: 'grid',
                    placeItems: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            ))}
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
            disabled={mutation.isPending}
            style={{
              border: 'none',
              borderRadius: '18px',
              background: mutation.isPending ? '#cbd5e1' : '#16a34a',
              color: '#fff',
              minHeight: '56px',
              fontSize: '17px',
              fontWeight: 800,
              cursor: mutation.isPending ? 'not-allowed' : 'pointer',
              boxShadow: mutation.isPending ? 'none' : '0 14px 28px rgba(22,163,74,0.22)',
            }}
          >
            {mutation.isPending ? 'Salvando...' : 'Salvar equipe'}
          </button>
        </div>
      </div>
    </div>
  )
}
