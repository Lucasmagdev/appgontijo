import { setState, getState } from './state.js';
import { renderDailyView } from './daily.js';
import { renderWeeklyView } from './weekly.js';
import { renderSecondaryView } from './secondary.js';
import { initAdminModule } from './admin.js';
import { initTvMode } from './tv.js';

function syncControls() {
  const state = getState();
  document.getElementById('clientLoginInput').value = state.clientLogin;
  document.getElementById('dateInput').value = state.date;
  document.getElementById('weekInput').value = state.weekInput;
  document.getElementById('metricEstacasButton').classList.toggle('is-active', state.metricMode === 'estacas');
  document.getElementById('metricMeqButton').classList.toggle('is-active', state.metricMode === 'meq');
  document.getElementById('metricRevenueButton').classList.toggle('is-active', state.metricMode === 'revenue');
}

function setActiveView(view) {
  setState({ activeView: view });
  document.querySelectorAll('.nav-pill').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.view === view);
  });
  document.querySelectorAll('.view-section').forEach((section) => {
    const expectedId = `${view}View`;
    section.classList.toggle('is-active', section.id === expectedId);
  });
}

async function refreshActiveView() {
  const state = getState();
  if (state.activeView === 'daily') await safeRender('dailyView', renderDailyView);
  if (state.activeView === 'weekly') await safeRender('weeklyView', renderWeeklyView);
  if (state.activeView === 'secondary') await safeRender('secondaryView', renderSecondaryView);
}

function weekValueFromDate(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  const day = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - day + 3);
  const firstThursday = new Date(date.getFullYear(), 0, 4);
  const firstDay = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstDay + 3);
  const weekNumber = 1 + Math.round((date - firstThursday) / 604800000);
  return `${date.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
}

async function safeRender(viewId, renderFn) {
  try {
    await renderFn();
  } catch (error) {
    const view = document.getElementById(viewId);
    view.innerHTML = `
      <section class="panel">
        <div class="panel-head">
          <h3>Falha ao carregar esta visao</h3>
          <span>Verifique S3, credenciais e filtros</span>
        </div>
        <p class="inline-feedback" style="color:#b9141a">${error.message}</p>
      </section>
    `;
  }
}

async function boot() {
  syncControls();
  const state = getState();

  if (state.screen === 'primary-tv' || state.screen === 'secondary-tv') {
    await initTvMode(state.screen);
    return;
  }

  document.querySelectorAll('.nav-pill').forEach((button) => {
    button.addEventListener('click', async () => {
      setActiveView(button.dataset.view);
      if (button.dataset.view !== 'admin') {
        await refreshActiveView();
      }
    });
  });

  document.getElementById('clientLoginInput').addEventListener('input', (event) => {
    setState({ clientLogin: event.target.value.trim() || 'cgontijo' });
  });

  document.getElementById('dateInput').addEventListener('change', (event) => {
    const nextDate = event.target.value;
    setState({
      date: nextDate,
      weekInput: weekValueFromDate(nextDate),
    });
    syncControls();
  });

  document.getElementById('weekInput').addEventListener('change', (event) => {
    setState({ weekInput: event.target.value });
  });

  document.getElementById('metricEstacasButton').addEventListener('click', async () => {
    setState({ metricMode: 'estacas' });
    syncControls();
    await refreshActiveView();
  });

  document.getElementById('metricMeqButton').addEventListener('click', async () => {
    setState({ metricMode: 'meq' });
    syncControls();
    await refreshActiveView();
  });

  document.getElementById('metricRevenueButton').addEventListener('click', async () => {
    setState({ metricMode: 'revenue' });
    syncControls();
    await refreshActiveView();
  });

  document.getElementById('refreshButton').addEventListener('click', refreshActiveView);

  await Promise.all([
    safeRender('dailyView', renderDailyView),
    safeRender('weeklyView', renderWeeklyView),
    safeRender('secondaryView', renderSecondaryView),
    initAdminModule(),
  ]);
}

boot().catch((error) => {
  document.body.innerHTML = `
    <main class="shell">
      <section class="panel">
        <div class="panel-head">
          <h2>Falha ao iniciar o dashboard</h2>
          <span>Verifique as variaveis e a API</span>
        </div>
        <p class="inline-feedback" style="color:#b9141a">${error.message}</p>
      </section>
    </main>
  `;
});
