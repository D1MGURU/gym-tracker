import { api, getCurrentPosition } from '../api.js';
import { state, refreshStatus } from '../state.js';
import { showConfirm } from '../ui/dialogs.js';
import { showToast } from '../ui/toast.js';
import { renderDevPanel } from '../dev.js';

function getNextMondayFormatted() {
  const now = new Date();
  const day = now.getDay();
  const diff = (day === 0 ? 1 : 8 - day);
  const nextMon = new Date(now);
  nextMon.setDate(now.getDate() + diff);
  return nextMon.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function renderProfileScreen(container) {
  container.replaceChildren();
  const s = state.myStatus;
  if (!s) return;

  // 1. Картка облікового запису (Ім'я + Email + Тема)
  const accountCard = document.createElement('section');
  accountCard.className = 'card stack-md';

  const accTitle = document.createElement('h2');
  accTitle.textContent = 'Профіль';

  const emailRow = document.createElement('p');
  emailRow.textContent = `Email: ${state.user?.email || ''}`;

  const nameRow = document.createElement('div');
  nameRow.className = 'row-between';
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'input';
  nameInput.maxLength = 24;
  nameInput.value = s.display_name || '';

  const saveNameBtn = document.createElement('button');
  saveNameBtn.type = 'button';
  saveNameBtn.className = 'btn btn-secondary';
  saveNameBtn.textContent = 'Зберегти';

  saveNameBtn.addEventListener('click', async () => {
    const val = nameInput.value.trim();
    if (!val) {
      showToast("Ім'я не може бути порожнім", 'error');
      return;
    }
    saveNameBtn.disabled = true;
    try {
      await api.updateProfileFields(state.user.id, { display_name: val });
      showToast("Ім'я оновлено!", 'success');
      await refreshStatus();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      saveNameBtn.disabled = false;
    }
  });
  nameRow.append(nameInput, saveNameBtn);

  // Перемикач теми (dark / light)
  const themeRow = document.createElement('div');
  themeRow.className = 'row-between';
  const themeLabel = document.createElement('span');
  themeLabel.textContent = 'Тема оформлення';
  const themeBtn = document.createElement('button');
  themeBtn.type = 'button';
  themeBtn.className = 'btn btn-outline';
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
  themeBtn.textContent = currentTheme === 'dark' ? '🌙 Темна' : '☀️ Світла';
  themeBtn.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('gym_theme', next); } catch (_) {}
    themeBtn.textContent = next === 'dark' ? '🌙 Темна' : '☀️ Світла';
  });
  themeRow.append(themeLabel, themeBtn);

  accountCard.append(accTitle, emailRow, nameRow, themeRow);

  // 2. Картка налаштувань (Точка залу, Ціль, Тестовий режим)
  const settingsCard = document.createElement('section');
  settingsCard.className = 'card stack-md';

  const setTitle = document.createElement('h2');
  setTitle.textContent = 'Налаштування залу та цілі';

  // Точка залу
  const gymRow = document.createElement('div');
  gymRow.className = 'row-between';
  const gymInfo = document.createElement('div');
  gymInfo.className = 'stack-sm';
  const gymTitle = document.createElement('strong');
  gymTitle.textContent = 'Точка мого залу';
  const gymSub = document.createElement('small');
  gymSub.textContent = s.gym_saved ? `Збережено (радіус ${s.gym_radius_m} м)` : 'Ще не задано';
  gymInfo.append(gymTitle, gymSub);

  const setGymBtn = document.createElement('button');
  setGymBtn.type = 'button';
  setGymBtn.className = 'btn btn-outline';
  setGymBtn.textContent = '📍 Зал тут';

  async function performSaveGym() {
    setGymBtn.disabled = true;
    setGymBtn.textContent = 'GPS...';
    try {
      const coords = await getCurrentPosition();
      if (coords.accuracy > 100) {
        throw new Error(`GPS неточний (${Math.round(coords.accuracy)} м), вийди на відкрите місце`);
      }
      await api.updateProfileFields(state.user.id, {
        gym_lat: coords.latitude,
        gym_lng: coords.longitude
      });
      showToast(`Точку залу збережено! (Точність: ${Math.round(coords.accuracy)} м)`, 'success');
      await refreshStatus();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setGymBtn.disabled = false;
      setGymBtn.textContent = '📍 Зал тут';
    }
  }

  setGymBtn.addEventListener('click', async () => {
    if (s.gym_saved) {
      await showConfirm({
        title: 'Замінити точку залу?',
        message: 'Поточні координати залу буде перезаписано твоєю поточною геопозицією.',
        cancelText: 'Скасувати',
        confirmText: 'Замінити точку',
        onConfirm: performSaveGym
      });
    } else {
      await performSaveGym();
    }
  });
  gymRow.append(gymInfo, setGymBtn);

  // Ціль на тиждень
  const goalRow = document.createElement('div');
  goalRow.className = 'row-between';
  const goalInfo = document.createElement('div');
  goalInfo.className = 'stack-sm';
  const goalTitle = document.createElement('strong');
  goalTitle.textContent = 'Ціль (днів на тиждень)';
  const goalSub = document.createElement('small');
  goalSub.textContent = `Зараз: ${s.goal} дн. (зміна раз на 14 днів)`;
  goalInfo.append(goalTitle, goalSub);

  const goalControls = document.createElement('div');
  goalControls.className = 'row-between';
  const goalInput = document.createElement('input');
  goalInput.type = 'number';
  goalInput.className = 'input';
  goalInput.min = '1';
  goalInput.max = '7';
  goalInput.style.width = '72px';
  goalInput.value = String(s.next_week_goal || s.goal);

  const saveGoalBtn = document.createElement('button');
  saveGoalBtn.type = 'button';
  saveGoalBtn.className = 'btn btn-secondary';
  saveGoalBtn.textContent = 'Зберегти';

  saveGoalBtn.addEventListener('click', async () => {
    const newGoal = parseInt(goalInput.value, 10);
    if (isNaN(newGoal) || newGoal < 1 || newGoal > 7) {
      showToast('Ціль має бути від 1 до 7 днів', 'error');
      return;
    }
    const nextMonStr = getNextMondayFormatted();
    await showConfirm({
      title: 'Змінити тижневу ціль?',
      message: `Нова ціль (${newGoal} дн./тиж.) набуде чинності з понеділка ${nextMonStr}. Наступна зміна буде можлива лише через 14 днів.`,
      cancelText: 'Скасувати',
      confirmText: 'Все одно змінити',
      onConfirm: async () => {
        try {
          const res = await api.setWeeklyGoal(newGoal);
          showToast(res.message || 'Ціль заплановано!', 'success');
          await refreshStatus();
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    });
  });
  goalControls.append(goalInput, saveGoalBtn);
  goalRow.append(goalInfo, goalControls);

  // Тестовий режим (1 хв)
  const testRow = document.createElement('div');
  testRow.className = 'row-between';
  const testLabel = document.createElement('span');
  testLabel.textContent = 'Тестовий режим таймера (1 хв)';
  const testBtn = document.createElement('button');
  testBtn.type = 'button';
  testBtn.className = s.is_test_mode ? 'btn btn-success' : 'btn btn-outline';
  testBtn.textContent = s.is_test_mode ? 'Увімкнено (1 хв)' : 'Вимкнено (20 хв)';
  testBtn.addEventListener('click', async () => {
    testBtn.disabled = true;
    try {
      await api.updateProfileFields(state.user.id, { is_test_mode: !s.is_test_mode });
      showToast(!s.is_test_mode ? 'Тестовий режим (1 хв) увімкнено' : 'Стандартний таймер (20 хв)', 'info');
      await refreshStatus();
    } catch (err) {
      showToast(err.message, 'error');
      testBtn.disabled = false;
    }
  });
  testRow.append(testLabel, testBtn);

  // Кнопка «Вийти»
  const logoutBtn = document.createElement('button');
  logoutBtn.type = 'button';
  logoutBtn.className = 'btn btn-danger-secondary btn-block';
  logoutBtn.textContent = 'Вийти з акаунта';
  logoutBtn.addEventListener('click', () => {
    showConfirm({
      title: 'Вийти з акаунта?',
      message: 'Тобі потрібно буде знову ввести email і пароль для входу.',
      cancelText: 'Залишитись',
      confirmText: 'Вийти',
      danger: true,
      onConfirm: async () => {
        await api.signOut();
      }
    });
  });

  settingsCard.append(
    setTitle,
    gymRow,
    document.createElement('hr'),
    goalRow,
    document.createElement('hr'),
    testRow
  );

  container.append(accountCard, settingsCard, logoutBtn);

  // 3. Dev-панель (рендериться лише якщо is_dev === true)
  if (s.is_dev) {
    const devMount = document.createElement('div');
    renderDevPanel(devMount);
    container.appendChild(devMount);
  }
}