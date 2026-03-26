import { api } from './api.js';
import { getFriendlyWeekRange, getState, getWeekStartFromInput } from './state.js';
import { renderBuildingCard, renderComparisonList, renderMultiLineChart } from './charts.js';
import { formatMetric, getMetricConfig } from './metrics.js';

function toneClass(machine) {
  if (machine.progress_percent == null) return 'neutral';
  if (machine.progress_percent >= 100) return 'green';
  if (machine.progress_percent >= 70) return 'orange';
  return 'red';
}

function machineCard(machine) {
  const metric = getMetricConfig();
  const percent = machine.progress_percent == null ? 0 : Math.min(machine.progress_percent, 100);
  const sourceLabel =
    machine.work_source === 'admin'
      ? 'Obra definida no admin'
      : machine.work_source === 'api'
      ? 'Obra puxada da operacao'
      : 'Sem obra definida';
  const thirdMetric = metric.isRevenueMetric
    ? `${Number(machine.realized_linear_meters || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m`
    : metric.isCountMetric
    ? (machine.realized_estacas / 7).toFixed(1)
    : formatMetric(machine[metric.machineKey] || 0, metric);
  const thirdLabel = metric.isRevenueMetric ? 'Metros' : (metric.isCountMetric ? 'Media/dia' : metric.shortLabel);

  return `
    <article class="machine-card">
      <div class="machine-top">
        <div class="machine-meta">
          <strong>${machine.machine_name}</strong>
          <small>${machine.imei}</small>
          <small>${machine.obra_name || 'Sem obra'}</small>
          <small>${sourceLabel}</small>
        </div>
        <span class="status-tag ${toneClass(machine)}">
          ${machine.progress_percent == null ? 'Sem meta' : `${machine.progress_percent.toFixed(0)}%`}
        </span>
      </div>
      <div class="machine-progress"><span style="width:${percent}%"></span></div>
      <div class="machine-stats">
        <div><span>Semana</span><strong>${machine.realized_estacas}</strong></div>
        <div><span>${metric.isRevenueMetric ? 'Faturamento' : 'Meta'}</span><strong>${metric.isRevenueMetric ? formatMetric(machine[metric.machineKey] || 0, metric) : machine.weekly_goal_estacas}</strong></div>
        <div><span>${thirdLabel}</span><strong>${thirdMetric}</strong></div>
      </div>
    </article>
  `;
}

export async function renderWeeklyView() {
  const state = getState();
  const metric = getMetricConfig();
  const weekStart = getWeekStartFromInput(state.weekInput);
  const data = await api.getWeekly({
    clientLogin: state.clientLogin,
    weekStart,
  });

  document.getElementById('weeklyRangeLabel').textContent = getFriendlyWeekRange(state.weekInput);
  document.getElementById('weeklyMachinesCount').textContent = `${data.machines.length} maquinas`;

  const hero = document.getElementById('weeklyHero');
  const lastAccumulated = data.accumulated_by_day[data.accumulated_by_day.length - 1];
  const weeklyDelta = lastAccumulated
    ? Number((lastAccumulated.accumulated_estacas - lastAccumulated.expected_accumulated_estacas).toFixed(1))
    : 0;
  hero.innerHTML = `
    <div id="weeklyBuildingMain"></div>
    <div id="weeklyBuildingGoal"></div>
    <article class="hero-card hero-card--rhythm">
      <div class="panel-head">
        <div>
          <p class="eyebrow">Consolidado</p>
          <h3>Ritmo da semana</h3>
        </div>
        <span class="status-tag ${weeklyDelta >= 0 ? 'green' : 'orange'}">
          ${weeklyDelta >= 0 ? '+' : ''}${weeklyDelta} vs esperado
        </span>
      </div>
      <div class="rhythm-grid">
        ${data.accumulated_by_day
          .map(
            (day) => `
              <article class="rhythm-chip ${day.accumulated_estacas >= day.expected_accumulated_estacas ? 'is-good' : 'is-warning'}">
                <span>${day.date.slice(5)}</span>
                <strong>${day.accumulated_estacas}</strong>
                <small>Esperado ${Math.round(day.expected_accumulated_estacas)}</small>
              </article>
            `
          )
          .join('')}
      </div>
    </article>
  `;

  if (metric.isRevenueMetric) {
    renderBuildingCard(document.getElementById('weeklyBuildingMain'), {
      eyebrow: 'Financeiro',
      title: 'Faturamento aproximado acumulado na semana',
      primaryValue: data.total_approx_revenue_realized || 0,
      primaryDisplayValue: formatMetric(data.total_approx_revenue_realized || 0, metric),
      realized: data.total_approx_revenue_realized || 0,
      goal: 0,
      percent: null,
      percentLabel: 'Estimativa por valor x metro linear',
      description: 'Consolidado semanal do faturamento aproximado com base nas metas confirmadas por diametro.',
      accent: true,
      metrics: [
        { label: 'Faturamento', displayValue: formatMetric(data.total_approx_revenue_realized || 0, metric), value: data.total_approx_revenue_realized || 0 },
        { label: 'Estacas', value: data.total_realized_estacas },
        { label: 'Metros', value: `${Number(data.total_realized_linear_meters || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m` },
      ],
    });
  } else {
    renderBuildingCard(document.getElementById('weeklyBuildingMain'), {
      eyebrow: 'Principal',
      title: metric.isCountMetric ? 'Estacas acumuladas na semana' : 'MEQ acumulado na semana',
      primaryValue: metric.isCountMetric ? data.total_realized_estacas : data[metric.totalKey] || 0,
      primaryDisplayValue: metric.isCountMetric ? data.total_realized_estacas : formatMetric(data[metric.totalKey] || 0, metric),
      realized: data.total_realized_estacas,
      goal: data.total_goal_estacas,
      percent: data.total_progress_percent,
      description: metric.isCountMetric
        ? 'Consolidado semanal do volume executado pelas maquinas ativas.'
        : 'Consolidado semanal do volume equivalente realizado pelas maquinas ativas.',
      accent: true,
      metrics: metric.isCountMetric
        ? undefined
        : [
            { label: 'Realizado', value: data.total_realized_estacas },
            { label: 'Meta', value: data.total_goal_estacas },
            { label: metric.shortLabel, displayValue: formatMetric(data[metric.totalKey] || 0, metric), value: data[metric.totalKey] || 0 },
          ],
    });
  }

  renderBuildingCard(document.getElementById('weeklyBuildingGoal'), {
    eyebrow: 'Meta semanal',
    title: 'Meta consolidada da semana',
    primaryValue: data.total_goal_estacas,
    primaryDisplayValue: data.total_goal_estacas,
    realized: data.total_realized_estacas,
    goal: data.total_goal_estacas,
    percent: data.total_progress_percent,
    percentLabel: data.total_progress_percent == null ? 'Sem meta' : `${data.total_progress_percent.toFixed(1)}% atingido`,
    fillPercent: 0,
    fillClass: 'building-fill--goal',
    description: 'Alvo consolidado em estacas para a semana das maquinas ativas cadastradas.',
    metrics: [
      { label: 'Meta da semana', value: data.total_goal_estacas },
      { label: 'Realizado', value: data.total_realized_estacas },
      { label: 'Faltam', value: Math.max(data.total_goal_estacas - data.total_realized_estacas, 0) },
      ...(metric.isRevenueMetric
        ? [{ label: 'Faturamento', displayValue: formatMetric(data.total_approx_revenue_realized || 0, metric), value: data.total_approx_revenue_realized || 0 }]
        : metric.isCountMetric
        ? []
        : [{ label: metric.shortLabel, displayValue: formatMetric(data[metric.totalKey] || 0, metric), value: data[metric.totalKey] || 0 }]),
    ],
  });

  renderMultiLineChart(
    'weeklyTrendChart',
    data.accumulated_by_day.map((item) => item.date.slice(5)),
    metric.isRevenueMetric
      ? [
          {
            label: 'Faturamento diario',
            data: data.accumulated_by_day.map((item) => item.approx_revenue_realized || 0),
            borderColor: '#d81f26',
            backgroundColor: 'rgba(216, 31, 38, 0.14)',
            fill: true,
            tension: 0.25,
            pointRadius: 4,
            pointBackgroundColor: '#ffffff',
            pointBorderColor: '#b9141a',
            pointBorderWidth: 2,
          },
        ]
      : [
          {
            label: metric.isCountMetric ? 'Realizado acumulado' : metric.longLabel,
            data: data.accumulated_by_day.map((item) => item[metric.accumulatedKey] || 0),
            borderColor: '#d81f26',
            backgroundColor: 'rgba(216, 31, 38, 0.14)',
            fill: true,
            tension: 0.25,
            pointRadius: 4,
            pointBackgroundColor: '#ffffff',
            pointBorderColor: '#b9141a',
            pointBorderWidth: 2,
          },
          {
            label: metric.isCountMetric ? 'Esperado acumulado' : 'Estacas acumuladas',
            data: data.accumulated_by_day.map((item) => item.expected_accumulated_estacas),
            borderColor: '#8a4f4f',
            borderDash: [10, 8],
            fill: false,
            tension: 0,
            pointRadius: 0,
          },
        ]
  );

  renderComparisonList(
    document.getElementById('weeklyRanking'),
    [...data.machines]
      .sort((a, b) => (b[metric.machineKey] || 0) - (a[metric.machineKey] || 0))
      .slice(0, 6)
      .map((machine) => ({
        label: machine.machine_name,
        subLabel: machine.obra_name || 'Sem obra',
        value: machine[metric.machineKey] || 0,
        displayValue: metric.isRevenueMetric ? formatMetric(machine[metric.machineKey] || 0, metric) : undefined,
        sideValue: metric.isCountMetric
          ? (machine.progress_percent == null ? 'Sem meta' : `${machine.progress_percent.toFixed(0)}%`)
          : `${machine.realized_estacas} estacas | ${formatMetric(machine[metric.machineKey] || 0, metric)}`,
      })),
    {
      kicker: 'Maquina',
      emptyText: 'Nenhum ranking disponivel.',
    }
  );

  document.getElementById('weeklyMachineCards').innerHTML = data.machines.map(machineCard).join('');

  return data;
}
