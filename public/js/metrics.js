import { getState } from './state.js';

function formatNumber(value, digits = 2) {
  return Number(value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function getMetricMode() {
  const metricMode = getState().metricMode;
  return metricMode === 'meq' || metricMode === 'revenue' ? metricMode : 'estacas';
}

export function getMetricConfig() {
  const mode = getMetricMode();
  if (mode === 'meq') {
    return {
      mode,
      label: 'MEQ',
      longLabel: 'Metros equivalentes',
      shortLabel: 'MEQ',
      machineKey: 'realized_meq',
      totalKey: 'total_realized_meq',
      dayKey: 'realized_meq',
      accumulatedKey: 'accumulated_meq',
      decimals: 2,
      isCountMetric: false,
      isCurrencyMetric: false,
      isRevenueMetric: false,
    };
  }

  if (mode === 'revenue') {
    return {
      mode,
      label: 'R$',
      longLabel: 'Faturamento aproximado',
      shortLabel: 'Faturamento',
      machineKey: 'approx_revenue_realized',
      totalKey: 'total_approx_revenue_realized',
      dayKey: 'approx_revenue_realized',
      accumulatedKey: 'accumulated_approx_revenue_realized',
      decimals: 2,
      isCountMetric: false,
      isCurrencyMetric: true,
      isRevenueMetric: true,
    };
  }

  return {
    mode,
    label: 'estacas',
    longLabel: 'Estacas',
    shortLabel: 'Estacas',
    machineKey: 'realized_estacas',
    totalKey: 'total_realized_estacas',
    dayKey: 'realized_estacas',
    accumulatedKey: 'accumulated_estacas',
    decimals: 0,
    isCountMetric: true,
    isCurrencyMetric: false,
    isRevenueMetric: false,
  };
}

export function pickMetric(item, config = getMetricConfig()) {
  return Number(item?.[config.machineKey] || item?.[config.dayKey] || item?.[config.totalKey] || 0);
}

export function formatMetric(value, config = getMetricConfig(), digits = 2) {
  if (config.isCurrencyMetric) {
    return formatCurrency(value);
  }
  return `${formatNumber(value, config.decimals ?? digits)} ${config.label}`;
}
