import { api } from './api.js';
import { state, refreshStatus } from './state.js';
import { showConfirm } from './ui/dialogs.js';
import { showToast } from './ui/toast.js';

export function renderDevPanel(mountEl) {
  mountEl.replaceChildren();
  const s = state.myStatus;
  if (!s || !s.is_dev) return;

  const card = document.createElement('section');
  card.className = 'card stack-md';

  const title = document.createElement('h2');
  title.textContent = '🛠 Dev Панель';

  const vNowText = document.createElement('p');
  const formattedNow = new Date(s.virtual_now).toLocaleString('uk-UA', {
    timeZone: s.timezone || 'Europe/Kyiv'
  });
  vNowText.textContent = `Віртуальна дата (app_now): ${formattedNow}`;

  // Кнопки зсуву часу
  const shiftGrid = document.createElement('div');
  shiftGrid.className = 'dev-grid';
  [
    { label: '⏪ -1 день', days: -1 },
    { label: '⏩ +1 день', days: 1 },
    { label: '⏭ +7 днів', days: 7 },
    { label: '🔄 Скинути час', days: 0 }
  ].forEach(({ label, days }) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-outline';
    btn.textContent = label;
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        await api.devShiftTime(days);
        await refreshStatus();
        showToast(`Час змінено (${label})`, 'info');
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        btn.disabled = false;
      }
    });
    shiftGrid.appendChild(btn);
  });

  // Додати тренування за дату
  const addRow = document.createElement('div');
  addRow.className = 'row-between';
  const dateInput = document.createElement('input');
  dateInput.type = 'date';
  dateInput.className = 'input';
  dateInput.value = s.local_date || '';

  const addWorkoutBtn = document.createElement('button');
  addWorkoutBtn.type = 'button';
  addWorkoutBtn.className = 'btn btn-secondary';
  addWorkoutBtn.textContent = '➕ Тренування';
  addWorkoutBtn.addEventListener('click', async () => {
    if (!dateInput.value) return;
    addWorkoutBtn.disabled = true;
    try {
      await api.devAddWorkout(dateInput.value);
      await refreshStatus();
      showToast(`Додано тренування за ${dateInput.value}`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      addWorkoutBtn.disabled = false;
    }
  });
  addRow.append(dateInput, addWorkoutBtn);

  // Сценарії (оскільки вони перезаписують тренування — через danger-діалог)
  const scenGrid = document.createElement('div');
  scenGrid.className = 'dev-grid';
  ['streak5', 'at_risk', 'dead', 'empty_week'].forEach((scen) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-outline';
    btn.textContent = `Сценарій: ${scen}`;
    btn.addEventListener('click', () => {
      showConfirm({
        title: `Запустити сценарій «${scen}»?`,
        message: 'Поточні тренування буде очищено й замінено тестовими даними сценарію.',
        cancelText: 'Скасувати',
        confirmText: 'Застосувати сценарій',
        danger: true,
        onConfirm: async () => {
          try {
            await api.devSetScenario(scen);
            await refreshStatus();
            showToast(`Сценарій ${scen} активовано`, 'success');
          } catch (err) {
            showToast(err.message, 'error');
          }
        }
      });
    });
    scenGrid.appendChild(btn);
  });

  // Віртуальний партнер
  const fakeGrid = document.createElement('div');
  fakeGrid.className = 'dev-grid';

  const createFakeBtn = document.createElement('button');
  createFakeBtn.type = 'button';
  createFakeBtn.className = 'btn btn-secondary';
  createFakeBtn.textContent = '🤖 Створити фейк';
  createFakeBtn.addEventListener('click', async () => {
    createFakeBtn.disabled = true;
    try {
      await api.devCreateFakePartner();
      await refreshStatus();
      showToast('Віртуального партнера створено!', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      createFakeBtn.disabled = false;
    }
  });

  const removeFakeBtn = document.createElement('button');
  removeFakeBtn.type = 'button';
  removeFakeBtn.className = 'btn btn-danger-secondary';
  removeFakeBtn.textContent = '🗑 Видалити фейк';
  removeFakeBtn.addEventListener('click', () => {
    showConfirm({
      title: 'Видалити віртуального партнера?',
      message: 'Фейковий профіль та пару з ним буде видалено.',
      cancelText: 'Скасувати',
      confirmText: 'Видалити',
      danger: true,
      onConfirm: async () => {
        try {
          await api.devRemoveFakePartner();
          await refreshStatus();
          showToast('Віртуального партнера видалено', 'info');
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    });
  });
  fakeGrid.append(createFakeBtn, removeFakeBtn);

  // Параметри фейк-партнера
  const fakeParamsRow = document.createElement('div');
  fakeParamsRow.className = 'row-between';
  const doneIn = document.createElement('input');
  doneIn.type = 'number';
  doneIn.className = 'input';
  doneIn.value = '2';
  doneIn.title = 'Днів зроблено';

  const goalIn = document.createElement('input');
  goalIn.type = 'number';
  goalIn.className = 'input';
  goalIn.value = '3';
  goalIn.title = 'Ціль';

  const streakIn = document.createElement('input');
  streakIn.type = 'number';
  streakIn.className = 'input';
  streakIn.value = '3';
  streakIn.title = 'Streak';

  const setFakeBtn = document.createElement('button');
  setFakeBtn.type = 'button';
  setFakeBtn.className = 'btn btn-secondary';
  setFakeBtn.textContent = 'Задати';
  setFakeBtn.addEventListener('click', async () => {
    setFakeBtn.disabled = true;
    try {
      await api.devSetFakePartner(
        parseInt(doneIn.value, 10) || 0,
        parseInt(goalIn.value, 10) || 3,
        parseInt(streakIn.value, 10) || 0
      );
      await refreshStatus();
      showToast('Дані фейк-партнера оновлено', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setFakeBtn.disabled = false;
    }
  });
  fakeParamsRow.append(doneIn, goalIn, streakIn, setFakeBtn);

  // Очистити всі дані користувача (danger-діалог)
  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'btn btn-danger-secondary btn-block';
  clearBtn.textContent = '🧹 Очистити всі мої дані (dev_clear_my_data)';
  clearBtn.addEventListener('click', () => {
    showConfirm({
      title: 'Очистити всі твої дані?',
      message: 'Усі тренування, заморозки, історію цілей та зсув часу буде повністю скинуто.',
      cancelText: 'Скасувати',
      confirmText: 'Очистити все',
      danger: true,
      onConfirm: async () => {
        try {
          await api.devClearMyData();
          await refreshStatus();
          showToast('Усі дані очищено', 'info');
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    });
  });

  // Сирий статус через textContent (без innerHTML)
  const rawPre = document.createElement('pre');
  rawPre.className = 'dev-pre';
  rawPre.textContent = JSON.stringify(
    { my_status: state.myStatus, pair_status: state.pairStatus },
    null,
    2
  );

  card.append(
    title,
    vNowText,
    shiftGrid,
    addRow,
    scenGrid,
    fakeGrid,
    fakeParamsRow,
    clearBtn,
    rawPre
  );
  mountEl.appendChild(card);
}