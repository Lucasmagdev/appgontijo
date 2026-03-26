import { api } from './api.js';
import { getState, getWeekStartFromInput } from './state.js';
import { renderComparisonList, renderHeatmap, renderMultiLineChart } from './charts.js';
import { formatMetric, getMetricConfig } from './metrics.js';

let secondaryTvTimelineTimer = null;

function alertCard(item) {
  return `
    <article class="alert-card warning">
      <strong>${item.machine_name}</strong>
      <p>${item.message}</p>
    </article>
  `;
}

function timelineCard(item) {
  const metric = getMetricConfig();
  const metricText = metric.isCountMetric ? '' : ` | ${formatMetric(item[metric.machineKey] || 0, metric)}`;
  return `
    <article class="timeline-card">
      <div class="timeline-time">${item.date} ${item.finishedAt || '--:--'}</div>
      <div>
        <strong>${item.machine_name}</strong>
        <p>${item.estaca || 'Sem estaca'} | ${item.obra_name || 'Sem obra'}${metricText}</p>
      </div>
    </article>
  `;
}

function toneClass(machine) {
  if (machine.progress_percent == null) return 'neutral';
  if (machine.progress_percent >= 100) return 'green';
  if (machine.progress_percent >= 70) return 'orange';
  return 'red';
}

function machineDayCard(machine) {
  const metric = getMetricConfig();
  const percent = machine.progress_percent == null ? 0 : Math.min(machine.progress_percent, 100);
  const sourceLabel =
    machine.work_source === 'admin'
      ? 'Obra definida no admin'
      : machine.work_source === 'api'
      ? 'Obra puxada da operacao'
      : 'Sem obra definida';

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
        <div><span>Estacas</span><strong>${machine.realized_estacas}</strong></div>
        <div><span>${metric.isCountMetric ? 'Meta dia' : metric.shortLabel}</span><strong>${metric.isCountMetric ? machine.daily_goal_estacas : formatMetric(machine[metric.machineKey] || 0, metric)}</strong></div>
        <div><span>Numero obra</span><strong>${machine.obra_code || '-'}</strong></div>
      </div>
    </article>
  `;
}

function bindAutoScrollTimeline(container) {
  if (secondaryTvTimelineTimer) {
    clearInterval(secondaryTvTimelineTimer);
    secondaryTvTimelineTimer = null;
  }

  if (!container) return;

  container.scrollTop = 0;
  if (container.scrollHeight <= container.clientHeight + 8) {
    return;
  }

  secondaryTvTimelineTimer = setInterval(() => {
    const reachedBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 4;
    container.scrollTop = reachedBottom ? 0 : container.scrollTop + 1;
  }, 80);
}

async function renderSecondaryTvDailyOps(state) {
  const metric = getMetricConfig();
  const data = await api.getDaily({
    clientLogin: state.clientLogin,
    date: state.date,
  });

  const activeMachines = data.machines.filter((machine) => machine.active);
  const container = document.getElementById('secondaryView');

  container.innerHTML = `
    <div class="view-head">
      <div>
        <p class="eyebrow">TV 2</p>
        <h2>Maquinas e Timeline do Dia</h2>
      </div>
      <div class="meta-copy">
        <strong>${new Date(`${data.date}T00:00:00`).toLocaleDateString('pt-BR')}</strong>
        <span>${activeMachines.length} maquinas ativas | ${metric.isCountMetric ? `${data.total_realized_estacas} estacas` : formatMetric(data[metric.totalKey] || 0, metric)}</span>
      </div>
    </div>

    <div class="panel-grid panel-grid--secondary-tv-split secondary-tv-ops">
      <section class="panel">
        <div class="panel-head">
          <h3>Maquinas do dia</h3>
          <span>${activeMachines.length} maquinas</span>
        </div>
        <div class="machine-card-grid">
          ${activeMachines.map(machineDayCard).join('')}
        </div>
      </section>
      <section class="panel">
        <div class="panel-head">
          <h3>Timeline do dia</h3>
          <span>Ultimas estacas registradas</span>
        </div>
        <div id="secondaryTvTimeline" class="timeline-list timeline-list--auto-scroll">
          ${data.timeline.length
            ? data.timeline.map(timelineCard).join('')
            : '<p class="inline-feedback">Nenhum evento registrado para o dia selecionado.</p>'}
        </div>
      </section>
    </div>
  `;

  bindAutoScrollTimeline(document.getElementById('secondaryTvTimeline'));

  return data;
}

export async function renderSecondaryView() {
  const state = getState();
  const metric = getMetricConfig();

  if (state.screen === 'secondary-tv') {
    return renderSecondaryTvDailyOps(state);
  }

  const data = await api.getSecondary({
    clientLogin: state.clientLogin,
    date: state.date,
    weekStart: getWeekStartFromInput(state.weekInput),
  });

  document.getElementById('secondaryMeta').textContent = metric.isCountMetric
    ? `${data.item.today_total_estacas} hoje / ${data.item.week_total_estacas} semana`
    : metric.isRevenueMetric
    ? `${formatMetric(data.item.today_total_approx_revenue_realized || 0, metric)} hoje / ${formatMetric(data.item.week_total_approx_revenue_realized || 0, metric)} semana`
    : `${data.item.today_total_estacas} hoje / ${data.item.week_total_estacas} semana | ${formatMetric(data.item.week_total_meq || 0, metric)}`;
  renderComparisonList(
    document.getElementById('secondaryMachines'),
    [...data.item.top_machines]
      .sort((a, b) => (b[metric.machineKey] || 0) - (a[metric.machineKey] || 0))
      .slice(0, 6)
      .map((item) => ({
        label: item.machine_name,
        subLabel: item.obra_name || 'Sem obra',
        value: item[metric.machineKey] || 0,
        displayValue: metric.isRevenueMetric ? formatMetric(item[metric.machineKey] || 0, metric) : undefined,
        sideValue: metric.isCountMetric
          ? `${item.realized_estacas} estacas`
          : `${item.realized_estacas} estacas | ${formatMetric(item[metric.machineKey] || 0, metric)}`,
      })),
    {
      kicker: 'Maquina',
      emptyText: 'Nenhuma maquina no ranking.',
    }
  );
  renderComparisonList(
    document.getElementById('secondaryWorks'),
    [...data.item.top_works]
      .sort((a, b) => (b[metric.machineKey] || 0) - (a[metric.machineKey] || 0))
      .slice(0, 6)
      .map((item) => ({
        label: item.obra_name,
        subLabel: `${item.machines} maquinas`,
        value: item[metric.machineKey] || 0,
        displayValue: metric.isRevenueMetric ? formatMetric(item[metric.machineKey] || 0, metric) : undefined,
        sideValue: metric.isCountMetric
          ? `${item.realized_estacas} estacas | ${item.goal_estacas || 0} meta`
          : `${item.realized_estacas} estacas | ${formatMetric(item[metric.machineKey] || 0, metric)}`,
      })),
    {
      kicker: 'Obra',
      emptyText: 'Nenhuma obra consolidada.',
    }
  );
  document.getElementById('secondaryAlerts').innerHTML = data.item.alerts.length
    ? data.item.alerts.map(alertCard).join('')
    : '<p class="inline-feedback">Nenhum alerta operacional.</p>';
  document.getElementById('secondaryTimeline').innerHTML = data.item.timeline.length
    ? data.item.timeline.map(timelineCard).join('')
    : '<p class="inline-feedback">Nenhuma timeline disponivel.</p>';

  renderMultiLineChart(
    'secondaryTrendChart',
    data.item.daily_realized_by_day.map((item) => item.date.slice(5)),
    metric.isRevenueMetric
      ? [
          {
            label: 'Faturamento diario',
            data: data.item.daily_realized_by_day.map((item) => item.approx_revenue_realized || 0),
            borderColor: '#d81f26',
            backgroundColor: 'rgba(216, 31, 38, 0.14)',
            fill: true,
            tension: 0.28,
            pointRadius: 5,
            pointBackgroundColor: '#ffffff',
            pointBorderColor: '#b9141a',
            pointBorderWidth: 2,
          },
        ]
      : [
          {
            label: metric.isCountMetric ? 'Realizado' : metric.longLabel,
            data: data.item.daily_realized_by_day.map((item) => item[metric.dayKey] || 0),
            borderColor: '#d81f26',
            backgroundColor: 'rgba(216, 31, 38, 0.14)',
            fill: true,
            tension: 0.28,
            pointRadius: 5,
            pointBackgroundColor: '#ffffff',
            pointBorderColor: '#b9141a',
            pointBorderWidth: 2,
          },
          {
            label: metric.isCountMetric ? 'Meta diaria' : 'Estacas',
            data: data.item.daily_realized_by_day.map((item) => (metric.isCountMetric ? item.goal_estacas : item.realized_estacas)),
            borderColor: '#8a4f4f',
            borderDash: [10, 8],
            fill: false,
            tension: 0,
            pointRadius: 3,
            pointBackgroundColor: '#fff',
          },
        ]
  );
  renderHeatmap(document.getElementById('secondaryHeatmap'), data.item.heatmap);

  return data;
}
