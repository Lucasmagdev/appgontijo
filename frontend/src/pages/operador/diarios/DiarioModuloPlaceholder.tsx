import { useParams, useSearchParams } from 'react-router-dom'
import OperadorPlaceholder from '@/pages/operador/OperadorPlaceholder'

const TITLES: Record<string, string> = {
  data: 'Data',
  entrada: 'Entrada',
  saida: 'Saida',
  equipe: 'Equipe',
  equipamento: 'Equipamento',
  estacas: 'Estacas',
  ocorrencias: 'Ocorrencias',
  abastecimento: 'Abastecimento',
  'planejamento-diario': 'Planejamento Diario',
  'planejamento-final': 'Planejamento Final',
  horimetro: 'Horimetro',
  clima: 'Condicoes Climaticas',
  assinatura: 'Assinatura do Cliente',
  finalizar: 'Finalizar Diario',
  revisao: 'Revisao do Diario',
}

export default function DiarioModuloPlaceholder() {
  const { equipamentoId, modulo } = useParams()
  const [searchParams] = useSearchParams()
  const diarioId = Number(searchParams.get('diario') || '')
  const backUrl = `/operador/diario-de-obras/novo/${equipamentoId || ''}${
    Number.isFinite(diarioId) && diarioId > 0 ? `?diario=${diarioId}` : ''
  }`
  const titulo = TITLES[String(modulo || '')] || 'Diario de obras'

  return (
    <OperadorPlaceholder
      titulo={titulo}
      voltarPara={backUrl}
      mensagem="Esta parte do diario sera montada na proxima etapa."
    />
  )
}
