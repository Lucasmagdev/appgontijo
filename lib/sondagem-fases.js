// Paleta de cores por fase do funil Pipefy (CRM Comercial - Gontijo).
// Fonte unica usada pelo backend (rota /mapa) e pela legenda do front.
// Pipefy nao expoe cor de fase via API, entao a paleta e definida aqui.

const FASE_CORES = {
  'Aguardando 1° Contato': '#94A3B8',
  '1° Contato Feito / Em Conversa': '#38BDF8',
  'Elaboração de Pré-Proj/Projeto': '#6366F1',
  'Proposta Helice/Perfuratriz': '#8B5CF6',
  'Proposta Bate Estaca': '#A855F7',
  'Proposta Raiz': '#D946EF',
  'Agendar Visita  em Obra Não Fechada': '#F59E0B',
  'Elaboração de Proposta': '#FB923C',
  'Neg. Longo Prazo/Licitação': '#EAB308',
  'Proposta Enviada / Negociação': '#3B82F6',
  'Avaliação de Clientes': '#14B8A6',
  'Contrato Assinado / Iniciar Obra': '#22C55E',
  'Negociações Perdidas': '#EF4444',
  'Encaminhamento Geofusa': '#64748B',
}

const COR_PADRAO = '#94A3B8'

function corDaFase(fase) {
  if (!fase) return COR_PADRAO
  return FASE_CORES[fase] || COR_PADRAO
}

module.exports = { FASE_CORES, COR_PADRAO, corDaFase }
