import type { QueryClient } from '@tanstack/react-query'
import type { DiarioDetail } from '@/lib/gontijo-api'

export const PARAMETRIZED_EQUIPMENT_STALE_TIME = 0

export function updateOperatorDiaryCache(
  queryClient: QueryClient,
  diaryId: number,
  patch: Partial<DiarioDetail>,
) {
  const update = (current: DiarioDetail | undefined) => {
    if (!current || current.id !== diaryId) return current
    return { ...current, ...patch }
  }

  queryClient.setQueryData<DiarioDetail>(['operador-diario', diaryId], update)
  queryClient.setQueriesData<DiarioDetail>(
    { queryKey: ['operador-diario-draft'] },
    update,
  )
}
