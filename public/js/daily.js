import { api } from './api.js';
import { getState } from './state.js';
import { renderBuildingCard, renderComparisonList } from './charts.js';
import { formatMetric, getMetricConfig } from './metrics.js';

let machineSpotlightTimer = null;

function toneClass(machine) {
  if (machine.progress_percent == null) return 'neutral';
  if (machine.progress_percent >= 100) return 'green';
  if (machine.progress_percent >= 70) return 'orange';
  return 'red';
}

function clearMachineSpotlightTimer() {
  if (machineSpotlightTimer) {
    clearInterval(machineSpotlightTimer);
    machineSpotlightTimer = null;
  }
}

function machineSpotlightTone(machine) {
  if (machine.progress_percent == null) return 'neutral';
  if (machine.progress_percent >= 100) return 'green';
  if (machine.progress_percent >= 70) return 'orange';
  return 'red';
}

function renderMachineSpotlight(container, machines) {
  clearMachineSpotlightTimer();
  const metric = getMetricConfig();

  if (!machines.length) {
    container.innerHTML = '<article class="hero-card"><p class="inline-feedback">Nenhuma maquina disponivel para destaque.</p></article>';
    return;
  }

  let index = 0;

  const draw = () => {
    const machine = machines[index];
    const remaining = Math.max(Number(machine.daily_goal_estacas || 0) - Number(machine.realized_estacas || 0), 0);
    const progress = machine.progress_percent == null ? 0 : Math.max(0, Math.min(machine.progress_percent, 100));
    const tone = machineSpotlightTone(machine);
    const percentLabel = machine.progress_percent == null ? 'Sem meta cadastrada' : `${machine.progress_percent.toFixed(1)}% da meta`;
    const workSourceLabel =
      machine.work_source === 'admin'
        ? 'Admin'
        : machine.work_source === 'api'
        ? 'Operacao'
        : 'Sem obra';
    const metricBlock = metric.isCountMetric
      ? `
          <article class="machine-spotlight__metric">
            <span>Faltam</span>
            <strong>${remaining}</strong>
          </article>
          <article class="machine-spotlight__metric">
            <span>Fonte</span>
            <strong>${workSourceLabel}</strong>
          </article>
        `
      : metric.isRevenueMetric
      ? `
          <article class="machine-spotlight__metric">
            <span>Metros hoje</span>
            <strong>${Number(machine.realized_linear_meters || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m</strong>
          </article>
          <article class="machine-spotlight__metric">
            <span>Faltam</span>
            <strong>${remaining}</strong>
          </article>
        `
      : `
          <article class="machine-spotlight__metric">
            <span>${metric.shortLabel}</span>
            <strong>${formatMetric(machine[metric.machineKey] || 0, metric)}</strong>
          </article>
          <article class="machine-spotlight__metric">
            <span>Faltam</span>
            <strong>${remaining}</strong>
          </article>
        `;
    const footerLabel = metric.isCountMetric ? 'Rotacao automatica a cada 10 segundos' : workSourceLabel;
    const primaryLabel = metric.isCountMetric
      ? 'Realizado hoje'
      : metric.isRevenueMetric
      ? 'Faturamento hoje'
      : 'MEQ hoje';
    const primaryValue = metric.isCountMetric
      ? machine.realized_estacas
      : formatMetric(machine[metric.machineKey] || 0, metric);

    container.innerHTML = `
      <article class="hero-card machine-spotlight machine-spotlight--${tone}">
        <div class="machine-spotlight__top">
          <div>
            <p class="eyebrow">Maquina a maquina</p>
            <h3>${machine.machine_name}</h3>
            <p class="machine-spotlight__work">${machine.obra_name || 'Sem obra definida'}</p>
          </div>
          <div class="machine-spotlight__badges">
            <span class="status-tag ${tone}">${percentLabel}</span>
            <span class="machine-spotlight__position">${index + 1}/${machines.length}</span>
          </div>
        </div>
        <div class="machine-spotlight__hero">
          <div class="machine-spotlight__score">
            <span class="machine-spotlight__label">${primaryLabel}</span>
            <strong>${primaryValue}</strong>
            <p>IMEI ${machine.imei}</p>
          </div>
          <div class="machine-spotlight__progress">
            <div class="machine-spotlight__progress-bar">
              <span style="width:${progress}%"></span>
            </div>
            <div class="machine-spotlight__progress-scale">
              <span>0</span>
              <span>Meta ${machine.daily_goal_estacas}</span>
            </div>
          </div>
        </div>
        <div class="machine-spotlight__metrics">
          <article class="machine-spotlight__metric is-primary">
            <span>Meta dia</span>
            <strong>${machine.daily_goal_estacas}</strong>
          </article>
          ${metricBlock}
        </div>
        <div class="machine-spotlight__footer">
          <span>${footerLabel}</span>
          <span>${machine.obra_code ? `Obra ${machine.obra_code}` : 'Codigo da obra indisponivel'}</span>
        </div>
      </article>
    `;
    index = (index + 1) % machines.length;
  };

  draw();
  if (machines.length > 1) {
    machineSpotlightTimer = setInterval(draw, 10000);
  }
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
  const metricLabel = metric.isCountMetric ? 'Meta dia' : metric.shortLabel;
  const metricValue = metric.isCountMetric ? machine.daily_goal_estacas : formatMetric(machine[metric.machineKey] || 0, metric);

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
        <div><span>${metricLabel}</span><strong>${metricValue}</strong></div>
        <div><span>Numero obra</span><strong>${machine.obra_code || '-'}</strong></div>
      </div>
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

function renderDailyOperationalPanels(data) {
  const activeMachines = data.machines.filter((machine) => machine.active);
  const machineCardsHtml = activeMachines.map(machineCard).join('');
  const timelineHtml = data.timeline.length
    ? data.timeline.map(timelineCard).join('')
    : '<p class="inline-feedback">Nenhum evento registrado para o dia selecionado.</p>';

  document.getElementById('dailyMachineCards').innerHTML = machineCardsHtml;
  document.getElementById('dailyTimeline').innerHTML = timelineHtml;

  const opsDate = document.getElementById('dailyOpsDateLabel');
  const opsMachinesCount = document.getElementById('dailyOpsMachinesCount');
  const opsMachineCards = document.getElementById('dailyOpsMachineCards');
  const opsTimeline = document.getElementById('dailyOpsTimeline');

  if (opsDate) opsDate.textContent = new Date(`${data.date}T00:00:00`).toLocaleDateString('pt-BR');
  if (opsMachinesCount) opsMachinesCount.textContent = `${activeMachines.length} maquinas ativas`;
  if (opsMachineCards) opsMachineCards.innerHTML = machineCardsHtml;
  if (opsTimeline) opsTimeline.innerHTML = timelineHtml;
}

export async function renderDailyView() {
  const state = getState();
  const metric = getMetricConfig();
  const data = await api.getDaily({
    clientLogin: state.clientLogin,
    date: state.date,
  });

  document.getElementById('dailyDateLabel').textContent = new Date(`${data.date}T00:00:00`).toLocaleDateString('pt-BR');
  document.getElementById('dailyMachinesCount').textContent = `${data.machines.length} maquinas`;

  const hero = document.getElementById('dailyHero');
  hero.innerHTML = `
    <div id="dailyBuildingMain"></div>
    <div id="dailyBuildingGoal"></div>
    <article class="hero-card">
      <div class="panel-head">
        <div>
          <p class="eyebrow">Resumo</p>
          <h3>Obras em destaque</h3>
        </div>
        <span>Distribuicao de producao</span>
      </div>
      <div id="dailyWorksComparison" class="compare-list"></div>
    </article>
  `;

  if (metric.isRevenueMetric) {
    renderBuildingCard(document.getElementById('dailyBuildingMain'), {
      eyebrow: 'Financeiro',
      title: 'Faturamento aproximado realizado no dia',
      primaryValue: data.total_approx_revenue_realized || 0,
      primaryDisplayValue: formatMetric(data.total_approx_revenue_realized || 0, metric),
      realized: data.total_approx_revenue_realized || 0,
      goal: 0,
      percent: null,
      percentLabel: 'Estimativa por valor x metro linear',
      description: 'Estimativa financeira baseada no valor confirmado por diametro aplicado ao metro linear realizado no dia.',
      accent: true,
      metrics: [
        { label: 'Faturamento', displayValue: formatMetric(data.total_approx_revenue_realized || 0, metric), value: data.total_approx_revenue_realized || 0 },
        { label: 'Estacas', value: data.total_realized_estacas },
        { label: 'Metros', value: `${Number(data.total_realized_linear_meters || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m` },
      ],
    });
  } else {
    renderBuildingCard(document.getElementById('dailyBuildingMain'), {
      eyebrow: 'Principal',
      title: metric.isCountMetric ? 'Estacas realizadas no dia' : 'MEQ realizado no dia',
      primaryValue: metric.isCountMetric ? data.total_realized_estacas : data[metric.totalKey] || 0,
      primaryDisplayValue: metric.isCountMetric ? data.total_realized_estacas : formatMetric(data[metric.totalKey] || 0, metric),
      realized: data.total_realized_estacas,
      goal: data.total_goal_estacas,
      percent: data.total_progress_percent,
      description: metric.isCountMetric
        ? 'Painel principal para acompanhar o total executado no dia frente a meta diaria consolidada.'
        : 'Painel principal para acompanhar o volume equivalente realizado no dia, com meta em estacas como referencia.',
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

  renderMachineSpotlight(document.getElementById('dailyBuildingGoal'), data.machines);
  renderComparisonList(
    document.getElementById('dailyWorksComparison'),
    [...data.top_works]
      .sort((a, b) => (b[metric.machineKey] || 0) - (a[metric.machineKey] || 0))
      .slice(0, 5)
      .map((work) => ({
        label: work.obra_name,
        subLabel: metric.isRevenueMetric ? `${work.realized_estacas} estacas no dia` : `${work.goal_estacas || 0} de meta no dia`,
        value: work[metric.machineKey] || 0,
        displayValue: metric.isRevenueMetric ? formatMetric(work[metric.machineKey] || 0, metric) : undefined,
        sideValue: metric.isCountMetric
          ? `${work.realized_estacas} estacas`
          : `${work.realized_estacas} estacas | ${formatMetric(work[metric.machineKey] || 0, metric)}`,
      })),
    {
      kicker: 'Obra',
      emptyText: 'Nenhuma obra em destaque.',
    }
  );

  renderDailyOperationalPanels(data);

  return data;
}
