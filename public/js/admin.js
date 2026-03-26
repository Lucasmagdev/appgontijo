import { api } from './api.js';

function feedback(message, tone = 'neutral') {
  const node = document.getElementById('mappingFeedback');
  node.textContent = message;
  node.className = 'inline-feedback';
  node.style.color = tone === 'error' ? '#b9141a' : tone === 'success' ? '#0f8b4c' : '';
}

function loginFeedback(message, tone = 'neutral') {
  const node = document.getElementById('adminLoginFeedback');
  node.textContent = message;
  node.className = 'inline-feedback';
  node.style.color = tone === 'error' ? '#b9141a' : tone === 'success' ? '#0f8b4c' : '';
}

function goalImportFeedback(message, tone = 'neutral') {
  const node = document.getElementById('goalImportFeedback');
  node.textContent = message;
  node.className = 'inline-feedback';
  node.style.color = tone === 'error' ? '#b9141a' : tone === 'success' ? '#0f8b4c' : '';
}

function formatNumber(value, digits = 2) {
  return Number(value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function machineOption(item) {
  const selected = item.active_mapping;
  return `<option value="${item.imei}" data-machine-name="${selected?.machine_name || item.machine_name}">
    ${selected?.machine_name || item.machine_name} | ${item.imei}
  </option>`;
}

function mappingRow(item) {
  const status = item.active ? 'Ativo' : 'Historico';
  return `
    <tr>
      <td>
        <strong>${item.machine_name}</strong><br />
        <small>${item.updated_at ? new Date(item.updated_at).toLocaleString('pt-BR') : '-'}</small>
      </td>
      <td>${item.imei}</td>
      <td>
        <strong>${item.obra_name || '-'}</strong><br />
        <small>${item.obra_code || '-'}</small>
      </td>
      <td>${item.daily_goal_estacas}</td>
      <td>${item.weekly_goal_estacas}</td>
      <td><span class="status-tag ${item.active ? 'green' : 'neutral'}">${status}</span></td>
      <td>
        <div class="table-actions">
          <button class="mini-button" type="button" data-action="edit" data-id="${item.id}">Editar</button>
          ${item.active ? '' : `<button class="mini-button" type="button" data-action="activate" data-id="${item.id}">Ativar</button>`}
          ${item.active ? `<button class="mini-button" type="button" data-action="archive" data-id="${item.id}">Encerrar</button>` : ''}
        </div>
      </td>
    </tr>
  `;
}

function goalTargetRow(item) {
  return `
    <tr>
      <td>${item.date ? new Date(`${item.date}T00:00:00`).toLocaleDateString('pt-BR') : '-'}</td>
      <td>
        <strong>${item.machine_name || item.equipment_label || '-'}</strong><br />
        <small>${item.imei || 'Sem IMEI'}</small>
      </td>
      <td>${item.obra_code || '-'}</td>
      <td>${item.meta_estacas_total ?? 0}</td>
      <td>${formatNumber(item.meta_meq_total || 0, 2)}</td>
      <td>${item.source_file_name || '-'}</td>
      <td><span class="status-tag ${item.status === 'confirmed' ? 'green' : 'neutral'}">${item.status || 'confirmed'}</span></td>
    </tr>
  `;
}

function fillForm(item) {
  document.getElementById('mappingIdInput').value = item?.id || '';
  document.getElementById('mappingImeiInput').value = item?.imei || '';
  document.getElementById('mappingMachineNameInput').value = item?.machine_name || '';
  document.getElementById('mappingObraCodeInput').value = item?.obra_code || '';
  document.getElementById('mappingObraNameInput').value = item?.obra_name || '';
  document.getElementById('mappingDailyGoalInput').value = item?.daily_goal_estacas ?? 0;
  document.getElementById('mappingWeeklyGoalInput').value = item?.weekly_goal_estacas ?? 0;
  document.getElementById('mappingActiveInput').checked = item?.active ?? true;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function isImportItemInvalid(item) {
  return !item?.date
    || !item?.equipment_label
    || !item?.machine_name
    || !item?.imei
    || !Array.isArray(item?.segments)
    || !item.segments.length
    || Boolean((item.errors || []).length);
}

function getImportStats(items) {
  const stats = items.reduce((acc, item) => {
    if (isImportItemInvalid(item)) {
      acc.invalid += 1;
    } else {
      acc.valid += 1;
    }
    acc.warnings += (item.warnings || []).length;
    return acc;
  }, { total: items.length, valid: 0, invalid: 0, warnings: 0 });

  return {
    ...stats,
    validItems: items.filter((item) => !isImportItemInvalid(item)),
    invalidItems: items.filter((item) => isImportItemInvalid(item)),
  };
}

function importRow(item, index) {
  const warnings = item.warnings || [];
  const errors = item.errors || [];
  const machineLabel = item.machine_name || item.equipment_label || '-';
  const obraLabel = item.obra_code || '-';
  const segmentLabel = (item.segments || []).length
    ? item.segments.map((segment) => `${segment.meta_estacas || 0} x Ø${segment.diameter_cm ?? '-'} x ${segment.profundidade_m ?? '-'}m`).join('<br />')
    : '-';
  const rowClass = errors.length ? 'is-error' : warnings.length ? 'is-warning' : 'is-ok';

  return `
    <tr class="goal-import-row ${rowClass}">
      <td>${item.date ? new Date(`${item.date}T00:00:00`).toLocaleDateString('pt-BR') : '-'}</td>
      <td>${escapeHtml(item.equipment_label || '-')}</td>
      <td>
        <strong>${escapeHtml(machineLabel)}</strong><br />
        <small>${escapeHtml(item.imei || 'Sem IMEI')}</small>
      </td>
      <td>${escapeHtml(obraLabel)}</td>
      <td>${item.meta_estacas_total ?? 0}</td>
      <td>${formatNumber(item.meta_meq_total || 0, 2)}</td>
      <td>${segmentLabel}</td>
      <td><small class="goal-import-source">${escapeHtml(item.source_text || '-')}</small></td>
      <td>
        ${errors.length || warnings.length
          ? `
            <div class="goal-alert-list">
              ${errors.map((alert) => `<div class="goal-alert is-error">${escapeHtml(alert)}</div>`).join('')}
              ${warnings.map((alert) => `<div class="goal-alert is-warning">${escapeHtml(alert)}</div>`).join('')}
            </div>
          `
          : '<span class="status-tag green">Pronta para salvar</span>'}
      </td>
      <td>
        <button class="mini-button" type="button" data-import-remove="${index}">Remover</button>
      </td>
    </tr>
  `;
}

function summaryText(items, sourceFileName, skippedWithoutOfficialMachine = 0) {
  const stats = getImportStats(items);
  const skippedText = skippedWithoutOfficialMachine
    ? ` | ${skippedWithoutOfficialMachine} ignorada(s) por nao constarem no cadastro-base oficial`
    : '';
  return `${stats.total} linha(s) aproveitada(s) de ${sourceFileName || 'arquivo'} | ${stats.valid} pronta(s), ${stats.invalid} com erro, ${stats.warnings} alerta(s)${skippedText}.`;
}

export async function initAdminModule() {
  const loginCard = document.getElementById('adminLoginCard');
  const panel = document.getElementById('adminPanel');
  const modeLabel = document.getElementById('adminModeLabel');
  const includeInactiveInput = document.getElementById('includeInactiveInput');
  const mappingTableBody = document.getElementById('mappingTableBody');
  const machineSelect = document.getElementById('machineSelect');
  const goalTargetsTableBody = document.getElementById('goalTargetsTableBody');
  const goalImportReview = document.getElementById('goalImportReview');
  const goalImportStats = document.getElementById('goalImportStats');
  const goalImportTableBody = document.getElementById('goalImportTableBody');
  const goalImportSummary = document.getElementById('goalImportSummary');
  const goalImportExcelFileInput = document.getElementById('goalImportExcelFileInput');
  const goalImportSaveButton = document.getElementById('goalImportSaveButton');

  let currentMappings = [];
  let currentMachines = [];
  let currentImportItems = [];
  let currentImportFileName = '';
  let currentSkippedWithoutOfficialMachine = 0;

  function renderImportReview() {
    const stats = getImportStats(currentImportItems);
    goalImportReview.classList.toggle('is-hidden', !currentImportItems.length);
    goalImportSummary.textContent = currentImportItems.length
      ? summaryText(currentImportItems, currentImportFileName, currentSkippedWithoutOfficialMachine)
      : 'Nenhuma linha lida.';
    goalImportStats.innerHTML = currentImportItems.length
      ? `
        <article class="goal-import-stat">
          <strong>${stats.total}</strong>
          <span>Linhas lidas</span>
        </article>
        <article class="goal-import-stat is-good">
          <strong>${stats.valid}</strong>
          <span>Prontas para salvar</span>
        </article>
        <article class="goal-import-stat ${stats.invalid ? 'is-error' : ''}">
          <strong>${stats.invalid}</strong>
          <span>Com erro</span>
        </article>
        <article class="goal-import-stat ${stats.warnings ? 'is-warning' : ''}">
          <strong>${stats.warnings}</strong>
          <span>Alertas de revisao</span>
        </article>
      `
      : '';
    goalImportTableBody.innerHTML = currentImportItems.length
      ? currentImportItems.map(importRow).join('')
      : '';
    goalImportSaveButton.disabled = !stats.validItems.length;
    goalImportSaveButton.textContent = stats.validItems.length
      ? `Confirmar e salvar ${stats.validItems.length} meta(s)`
      : 'Nenhuma meta valida para salvar';
  }

  function resetImportReview(message = 'Importacao limpa.', tone = 'neutral') {
    currentImportItems = [];
    currentImportFileName = '';
    currentSkippedWithoutOfficialMachine = 0;
    goalImportExcelFileInput.value = '';
    renderImportReview();
    goalImportFeedback(message, tone);
  }

  async function refreshAdmin() {
    const status = await api.getAdminStatus();
    modeLabel.textContent = status.mode === 'supabase' ? 'Supabase' : 'Modo local';
    if (!status.authenticated) {
      loginCard.classList.remove('is-hidden');
      panel.classList.add('is-hidden');
      return;
    }

    loginCard.classList.add('is-hidden');
    panel.classList.remove('is-hidden');

    const [machinesResponse, mappingsResponse, goalsResponse] = await Promise.all([
      api.getAdminMachines(),
      api.getAdminMappings(includeInactiveInput.checked),
      api.getGoalTargets(120),
    ]);

    currentMachines = machinesResponse.items;
    currentMappings = mappingsResponse.items;
    machineSelect.innerHTML = currentMachines.map(machineOption).join('');
    mappingTableBody.innerHTML = currentMappings.length
      ? currentMappings.map(mappingRow).join('')
      : '<tr><td colspan="7">Nenhum vinculo cadastrado.</td></tr>';
    goalTargetsTableBody.innerHTML = goalsResponse.items.length
      ? goalsResponse.items.map(goalTargetRow).join('')
      : '<tr><td colspan="7">Nenhuma meta confirmada.</td></tr>';
    fillForm(null);
    renderImportReview();
    feedback('Area admin carregada.', 'success');
  }

  document.getElementById('adminLoginForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await api.loginAdmin(document.getElementById('adminPasswordInput').value);
      loginFeedback('Autenticacao realizada com sucesso.', 'success');
      await refreshAdmin();
    } catch (error) {
      loginFeedback(error.message, 'error');
    }
  });

  document.getElementById('adminLogoutButton').addEventListener('click', async () => {
    await api.logoutAdmin();
    loginFeedback('Sessao encerrada.');
    await refreshAdmin();
  });

  includeInactiveInput.addEventListener('change', refreshAdmin);

  machineSelect.addEventListener('change', () => {
    const option = machineSelect.selectedOptions[0];
    document.getElementById('mappingImeiInput').value = machineSelect.value;
    document.getElementById('mappingMachineNameInput').value = option?.dataset.machineName || '';
  });

  document.getElementById('mappingResetButton').addEventListener('click', () => {
    fillForm(null);
    feedback('Formulario limpo.');
  });

  document.getElementById('mappingForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const id = document.getElementById('mappingIdInput').value;
    const payload = {
      imei: document.getElementById('mappingImeiInput').value,
      machine_name: document.getElementById('mappingMachineNameInput').value,
      obra_code: document.getElementById('mappingObraCodeInput').value,
      obra_name: document.getElementById('mappingObraNameInput').value,
      daily_goal_estacas: Number(document.getElementById('mappingDailyGoalInput').value || 0),
      weekly_goal_estacas: Number(document.getElementById('mappingWeeklyGoalInput').value || 0),
      active: document.getElementById('mappingActiveInput').checked,
    };

    try {
      if (id) {
        await api.updateMapping(id, payload);
        feedback('Vinculo atualizado.', 'success');
      } else {
        await api.createMapping(payload);
        feedback('Vinculo criado.', 'success');
      }
      await refreshAdmin();
    } catch (error) {
      feedback(error.message, 'error');
    }
  });

  document.getElementById('goalImportExcelForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const file = goalImportExcelFileInput.files?.[0];
    if (!file) {
      goalImportFeedback('Selecione uma planilha .xlsx, .xls ou .csv.', 'error');
      return;
    }

    try {
      goalImportFeedback('Lendo planilha...');
      const response = await api.parseGoalImport(file);
      currentImportItems = response.items || [];
      currentImportFileName = response.sourceFileName || file.name;
      currentSkippedWithoutOfficialMachine = Number(response.skippedWithoutOfficialMachine || 0);
      renderImportReview();
      goalImportFeedback(
        summaryText(currentImportItems, currentImportFileName, currentSkippedWithoutOfficialMachine),
        currentImportItems.length ? 'success' : 'error'
      );
    } catch (error) {
      resetImportReview(error.message, 'error');
    }
  });

  document.getElementById('goalImportResetButton').addEventListener('click', () => {
    resetImportReview();
  });

  document.getElementById('goalImportForm').addEventListener('submit', (event) => {
    event.preventDefault();
    goalImportFeedback('OCR permanece como fallback, mas nao esta conectado neste fluxo. Use a planilha Excel.', 'error');
  });

  goalImportTableBody.addEventListener('click', (event) => {
    const button = event.target.closest('[data-import-remove]');
    if (!button) return;
    const index = Number(button.dataset.importRemove);
    currentImportItems = currentImportItems.filter((_, itemIndex) => itemIndex !== index);
    renderImportReview();
    goalImportFeedback(summaryText(currentImportItems, currentImportFileName, currentSkippedWithoutOfficialMachine));
  });

  goalImportSaveButton.addEventListener('click', async () => {
    const stats = getImportStats(currentImportItems);
    if (!stats.validItems.length) {
      goalImportFeedback('Nenhuma linha valida para salvar. Remova ou corrija as linhas com erro.', 'error');
      return;
    }

    try {
      goalImportFeedback('Salvando metas confirmadas...');
      const response = await api.confirmGoalImport(stats.validItems);
      currentImportItems = stats.invalidItems;
      if (!stats.invalidItems.length) {
        currentImportFileName = '';
        goalImportExcelFileInput.value = '';
      }
      renderImportReview();
      goalImportFeedback(
        response.rejectedCount
          ? `${response.savedCount} meta(s) salva(s). ${response.rejectedCount} linha(s) continuam pendentes na revisao.`
          : `${response.savedCount} meta(s) salva(s) com sucesso.`,
        response.rejectedCount ? 'neutral' : 'success'
      );
      await refreshAdmin();
    } catch (error) {
      goalImportFeedback(error.message, 'error');
    }
  });

  mappingTableBody.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const id = button.dataset.id;
    const item = currentMappings.find((mapping) => String(mapping.id) === String(id));
    if (!item) return;

    try {
      if (button.dataset.action === 'edit') {
        fillForm(item);
        feedback(`Editando ${item.machine_name}.`);
      }
      if (button.dataset.action === 'activate') {
        await api.activateMapping(id);
        await refreshAdmin();
        feedback('Vinculo ativado.', 'success');
      }
      if (button.dataset.action === 'archive') {
        await api.archiveMapping(id);
        await refreshAdmin();
        feedback('Vinculo encerrado.', 'success');
      }
    } catch (error) {
      feedback(error.message, 'error');
    }
  });

  await refreshAdmin();
  return { refreshAdmin };
}
