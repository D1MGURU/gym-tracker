// ============================================================================
// 1. КЛЮЧІ SUPABASE
// ============================================================================
const SUPABASE_URL = 'https://robheofjlizpzbqmonjx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJvYmhlb2ZqbGl6cHpicW1vbmp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI5MTM3MDIsImV4cCI6MjEwODQ4OTcwMn0.xLdSrVfqO7ewWKboQVQiOpiG578UiSidT6mUPFWmML4';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Стан клієнта (усі розрахунки виконує сервер)
let currentUser = null;
let myStatus = null;
let pairStatus = null;
let serverTimeOffsetMs = 0;
let timerInterval = null;

const DAY_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
const FLAME_LABELS = {
  goal_met: 'Виконано 🔥',
  growing: 'Росте 📈',
  at_risk: 'Під загрозою ⚠️',
  dead: 'Згас 💤'
};

// Елементи DOM
const authScreen = document.getElementById('auth-screen');
const nameModal = document.getElementById('name-modal');
const mainScreen = document.getElementById('main-screen');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const authMessage = document.getElementById('auth-message');
const displayNameInput = document.getElementById('display-name-input');
const userDisplayNameEl = document.getElementById('user-display-name');
const userEmailSpan = document.getElementById('user-email');

const flamesRow = document.getElementById('flames-row');
const myFlameSlot = document.getElementById('my-flame-slot');
const streakCountEl = document.getElementById('streak-count');
const myFlameBadge = document.getElementById('my-flame-badge');

const pairFlameCol = document.getElementById('pair-flame-col');
const pairFlameSlot = document.getElementById('pair-flame-slot');
const pairStreakCountEl = document.getElementById('pair-streak-count');
const pairFlameBadge = document.getElementById('pair-flame-badge');
const pairSummaryBar = document.getElementById('pair-summary-bar');

const weekCalendarEl = document.getElementById('week-calendar');
const weekDoneEl = document.getElementById('week-done');
const weekGoalDisplayEl = document.getElementById('week-goal-display');
const progressBarFill = document.getElementById('progress-bar-fill');
const nextGoalHint = document.getElementById('next-goal-hint');

const gymStatusEl = document.getElementById('gym-status');
const timerBox = document.getElementById('timer-box');
const timerDisplay = document.getElementById('timer-display');
const timerHint = document.getElementById('timer-hint');
const workoutMessage = document.getElementById('workout-message');
const startBtn = document.getElementById('start-btn');
const finishBtn = document.getElementById('finish-btn');

const pairMessage = document.getElementById('pair-message');
const noPairBox = document.getElementById('no-pair-box');
const activePairBox = document.getElementById('active-pair-box');
const inviteCodeBox = document.getElementById('invite-code-box');
const inviteCodeText = document.getElementById('invite-code-text');
const joinCodeInput = document.getElementById('join-code-input');
const partnerNameText = document.getElementById('partner-name-text');
const partnerStatsText = document.getElementById('partner-stats-text');
const partnerMiniFlame = document.getElementById('partner-mini-flame');

const setGymBtn = document.getElementById('set-gym-btn');
const goalInput = document.getElementById('goal-input');
const saveGoalBtn = document.getElementById('save-goal-btn');
const testModeToggle = document.getElementById('test-mode-toggle');
const devPanelRoot = document.getElementById('dev-panel-root');

// ============================================================================
// 2. КОМПОНЕНТ ВОГНИКА: renderFlame(state, size)
// ============================================================================
function renderFlame(state = 'dead', size = 'lg') {
  const safeState = ['goal_met', 'growing', 'at_risk', 'dead'].includes(state) ? state : 'dead';
  const safeSize = ['sm', 'md', 'lg'].includes(size) ? size : 'lg';
  return `<div class="flame-component flame-${safeState} flame-${safeSize}" data-state="${safeState}">🔥</div>`;
}

document.getElementById('auth-logo-flame').innerHTML = renderFlame('goal_met', 'lg');

// ============================================================================
// 3. ДОПОМІЖНІ ФУНКЦІЇ (Повідомлення та GPS)
// ============================================================================
function showMessage(element, text, type = 'error') {
  element.textContent = text;
  element.className = `status-msg ${type}`;
  element.classList.remove('hidden');
}

function hideMessage(element) {
  element.classList.add('hidden');
}

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Твій браузер не підтримує геолокацію'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos.coords),
      (err) => {
        if (err.code === 1) {
          reject(new Error('Дозволь доступ до геолокації в налаштуваннях браузера'));
        } else {
          reject(new Error('Не вдалося отримати GPS-сигнал. Спробуй ще раз'));
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

// ============================================================================
// 4. АВТОРИЗАЦІЯ ТА ПЕРШИЙ ВХІД (ІМ'Я + ТАЙМЗОНА)
// ============================================================================
document.getElementById('login-btn').addEventListener('click', async () => {
  hideMessage(authMessage);
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  if (!email || !password) return showMessage(authMessage, 'Введи email та пароль');

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) showMessage(authMessage, 'Помилка входу: ' + error.message);
});

document.getElementById('signup-btn').addEventListener('click', async () => {
  hideMessage(authMessage);
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  if (!email || password.length < 6) {
    return showMessage(authMessage, 'Введи коректний email та пароль (від 6 символів)');
  }

  const { error } = await supabaseClient.auth.signUp({ email, password });
  if (error) showMessage(authMessage, 'Помилка реєстрації: ' + error.message);
});

document.getElementById('logout-btn').addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
});

document.getElementById('save-name-btn').addEventListener('click', async () => {
  const name = displayNameInput.value.trim();
  if (!name) return;

  await supabaseClient
    .from('profiles')
    .update({ display_name: name })
    .eq('id', currentUser.id);

  nameModal.classList.add('hidden');
  mainScreen.classList.remove('hidden');
  await refreshAllStatus();
});

supabaseClient.auth.onAuthStateChange(async (event, session) => {
  if (session && session.user) {
    currentUser = session.user;
    userEmailSpan.textContent = currentUser.email;
    authScreen.classList.add('hidden');

    // Відправляємо часовий пояс браузера на сервер
    const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Kyiv';
    await supabaseClient
      .from('profiles')
      .update({ timezone: browserTz })
      .eq('id', currentUser.id);

    await refreshAllStatus();
  } else {
    currentUser = null;
    stopTimer();
    mainScreen.classList.add('hidden');
    nameModal.classList.add('hidden');
    authScreen.classList.remove('hidden');
  }
});

// ============================================================================
// 5. ОТРИМАННЯ СТАТУСУ З СЕРВЕРА (GET_MY_STATUS + GET_PAIR_STATUS)
// ============================================================================
async function refreshAllStatus() {
  if (!currentUser) return;

  const [myRes, pairRes] = await Promise.all([
    supabaseClient.rpc('get_my_status'),
    supabaseClient.rpc('get_pair_status')
  ]);

  if (myRes.error) {
    console.error('get_my_status error:', myRes.error);
    return;
  }

  myStatus = myRes.data;
  pairStatus = pairRes.data || { has_pair: false };

  // Якщо ім'я ще не задано — питаємо при першому вході
  if (!myStatus.display_name) {
    mainScreen.classList.add('hidden');
    nameModal.classList.remove('hidden');
    return;
  }

  nameModal.classList.add('hidden');
  mainScreen.classList.remove('hidden');

  // Різниця між віртуальним часом сервера (app_now) і телефоном
  serverTimeOffsetMs = new Date(myStatus.virtual_now).getTime() - Date.now();

  renderMainUI();
  renderPairUI();
  updateWorkoutUI();
  renderDevPanel();
}

function renderMainUI() {
  userDisplayNameEl.textContent = myStatus.display_name || '';

  // Особистий вогник
  myFlameSlot.innerHTML = renderFlame(myStatus.flame_state, 'lg');
  streakCountEl.textContent = myStatus.streak_weeks;
  myFlameBadge.textContent = FLAME_LABELS[myStatus.flame_state] || '';

  // Календар Пн–Нд
  weekCalendarEl.innerHTML = (myStatus.week_days || [])
    .map((d, idx) => {
      const classes = ['cal-day'];
      if (d.is_today) classes.push('is-today');
      if (d.done) classes.push('is-done');
      return `
        <div class="${classes.join(' ')}">
          <span class="cal-day-name">${DAY_NAMES[idx]}</span>
          <div class="cal-day-check">${d.done ? '✓' : ''}</div>
        </div>
      `;
    })
    .join('');

  // Прогрес тижня
  weekDoneEl.textContent = myStatus.days_done;
  weekGoalDisplayEl.textContent = myStatus.goal;
  const percent = Math.min(100, Math.round((myStatus.days_done / myStatus.goal) * 100));
  progressBarFill.style.width = `${percent}%`;

  if (myStatus.next_week_goal && myStatus.next_week_goal !== myStatus.goal) {
    nextGoalHint.textContent = `📌 З наступного понеділка діятиме нова ціль: ${myStatus.next_week_goal} дн./тиж.`;
    nextGoalHint.classList.remove('hidden');
  } else {
    nextGoalHint.classList.add('hidden');
  }

  // Налаштування
  goalInput.value = myStatus.next_week_goal || myStatus.goal;
  testModeToggle.checked = !!myStatus.is_test_mode;
  gymStatusEl.textContent = myStatus.gym_saved
    ? `✅ Зал збережено (радіус ${myStatus.gym_radius_m} м)`
    : '⚠️ Точку залу ще не задано. Натисни «Зал тут» у налаштуваннях.';
}

function renderPairUI() {
  if (!pairStatus || !pairStatus.has_pair) {
    flamesRow.className = 'flames-row single';
    pairFlameCol.classList.add('hidden');
    pairSummaryBar.classList.add('hidden');

    noPairBox.classList.remove('hidden');
    activePairBox.classList.add('hidden');

    if (pairStatus?.active_invite?.code) {
      inviteCodeBox.classList.remove('hidden');
      inviteCodeText.textContent = pairStatus.active_invite.code;
    } else {
      inviteCodeBox.classList.add('hidden');
    }
    return;
  }

  // Відображаємо другий вогник поруч
  flamesRow.className = 'flames-row double';
  pairFlameCol.classList.remove('hidden');
  pairFlameSlot.innerHTML = renderFlame(pairStatus.pair_flame_state, 'lg');
  pairStreakCountEl.textContent = pairStatus.shared_streak;
  pairFlameBadge.textContent = pairStatus.pair_state_label;

  pairSummaryBar.classList.remove('hidden');
  pairSummaryBar.innerHTML = `
    <strong>${pairStatus.summary_text}</strong>
    <span>${pairStatus.pair_state_label}</span>
  `;

  noPairBox.classList.add('hidden');
  activePairBox.classList.remove('hidden');

  const p = pairStatus.partner;
  partnerNameText.textContent = p.display_name;
  partnerStatsText.textContent = `Цього тижня: ${p.days_done}/${p.goal} дн. · Особистий streak: ${p.streak_weeks} тиж.`;
  partnerMiniFlame.innerHTML = renderFlame(p.flame_state, 'sm');
}

// ============================================================================
// 6. ТАЙМЕР І ТРЕНУВАННЯ
// ============================================================================
function updateWorkoutUI() {
  stopTimer();

  const reqMinutes = myStatus?.is_test_mode ? 1 : 20;
  timerHint.textContent = `Щоб зарахувати, тренуйся мінімум ${reqMinutes} хв`;

  const activeWorkout = myStatus?.active_workout;
  if (!activeWorkout) {
    timerBox.classList.add('hidden');
    startBtn.disabled = false;
    finishBtn.disabled = true;
    return;
  }

  timerBox.classList.remove('hidden');
  startBtn.disabled = true;

  const tick = () => {
    const startedMs = new Date(activeWorkout.started_at).getTime();
    const virtualNowMs = Date.now() + serverTimeOffsetMs;
    const elapsedSeconds = Math.max(0, Math.floor((virtualNowMs - startedMs) / 1000));

    const mins = String(Math.floor(elapsedSeconds / 60)).padStart(2, '0');
    const secs = String(elapsedSeconds % 60).padStart(2, '0');
    timerDisplay.textContent = `${mins}:${secs}`;

    if (elapsedSeconds >= reqMinutes * 60) {
      finishBtn.disabled = false;
      timerHint.textContent = '✅ Час вийшов! Можна натискати «Закінчив»';
    } else {
      finishBtn.disabled = true;
    }
  };

  tick();
  timerInterval = setInterval(tick, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

startBtn.addEventListener('click', async () => {
  hideMessage(workoutMessage);
  startBtn.disabled = true;
  startBtn.textContent = 'Перевірка GPS...';

  try {
    const coords = await getCurrentPosition();
    const { error } = await supabaseClient.rpc('start_workout', {
      user_lat: coords.latitude,
      user_lng: coords.longitude,
      user_accuracy: coords.accuracy
    });
    if (error) throw new Error(error.message);

    showMessage(workoutMessage, 'Тренування розпочато! Гарного заняття 💪', 'success');
    await refreshAllStatus();
  } catch (err) {
    showMessage(workoutMessage, err.message, 'error');
    startBtn.disabled = false;
  } finally {
    startBtn.textContent = 'Почав';
  }
});

finishBtn.addEventListener('click', async () => {
  hideMessage(workoutMessage);
  finishBtn.disabled = true;
  finishBtn.textContent = 'Перевірка GPS...';

  try {
    const coords = await getCurrentPosition();
    const { error } = await supabaseClient.rpc('finish_workout', {
      user_lat: coords.latitude,
      user_lng: coords.longitude,
      user_accuracy: coords.accuracy
    });
    if (error) throw new Error(error.message);

    showMessage(workoutMessage, '🎉 Тренування зараховано!', 'success');
    await refreshAllStatus();
  } catch (err) {
    showMessage(workoutMessage, err.message, 'error');
    finishBtn.disabled = false;
  } finally {
    finishBtn.textContent = 'Закінчив';
  }
});

// ============================================================================
// 7. ПАРНІ ДІЇ ТА НАЛАШТУВАННЯ
// ============================================================================
document.getElementById('create-invite-btn').addEventListener('click', async () => {
  hideMessage(pairMessage);
  const { data, error } = await supabaseClient.rpc('create_invite');
  if (error) {
    showMessage(pairMessage, error.message, 'error');
  } else {
    inviteCodeBox.classList.remove('hidden');
    inviteCodeText.textContent = data.code;
    showMessage(pairMessage, 'Код створено! Передай його партнеру (діє 48 год).', 'success');
  }
});

document.getElementById('accept-invite-btn').addEventListener('click', async () => {
  hideMessage(pairMessage);
  const code = joinCodeInput.value.trim();
  if (!code) return showMessage(pairMessage, 'Введи 6-значний код запрошення');

  const { error } = await supabaseClient.rpc('accept_invite', { code });
  if (error) {
    showMessage(pairMessage, error.message, 'error');
  } else {
    joinCodeInput.value = '';
    showMessage(pairMessage, 'Пару успішно створено! 🎉', 'success');
    await refreshAllStatus();
  }
});

document.getElementById('leave-pair-btn').addEventListener('click', async () => {
  hideMessage(pairMessage);
  const { error } = await supabaseClient.rpc('leave_pair');
  if (error) {
    showMessage(pairMessage, error.message, 'error');
  } else {
    showMessage(pairMessage, 'Ти вийшов із пари. Спільний streak обнулено.', 'success');
    await refreshAllStatus();
  }
});

setGymBtn.addEventListener('click', async () => {
  hideMessage(workoutMessage);
  setGymBtn.disabled = true;
  setGymBtn.textContent = 'Шукаю GPS...';

  try {
    const coords = await getCurrentPosition();
    if (coords.accuracy > 100) {
      throw new Error(`GPS неточний (${Math.round(coords.accuracy)} м), вийди на відкрите місце`);
    }

    const { error } = await supabaseClient
      .from('profiles')
      .update({ gym_lat: coords.latitude, gym_lng: coords.longitude })
      .eq('id', currentUser.id);

    if (error) throw new Error(error.message);

    showMessage(workoutMessage, `Точку залу збережено! (Точність: ${Math.round(coords.accuracy)} м)`, 'success');
    await refreshAllStatus();
  } catch (err) {
    showMessage(workoutMessage, err.message, 'error');
  } finally {
    setGymBtn.disabled = false;
    setGymBtn.textContent = '📍 Зал тут';
  }
});

saveGoalBtn.addEventListener('click', async () => {
  hideMessage(workoutMessage);
  const newGoal = parseInt(goalInput.value, 10);

  const { data, error } = await supabaseClient.rpc('set_weekly_goal', { new_goal: newGoal });
  if (error) {
    showMessage(workoutMessage, error.message, 'error');
  } else {
    showMessage(workoutMessage, data.message, 'success');
    await refreshAllStatus();
  }
});

testModeToggle.addEventListener('change', async () => {
  const isTest = testModeToggle.checked;
  const { error } = await supabaseClient
    .from('profiles')
    .update({ is_test_mode: isTest })
    .eq('id', currentUser.id);

  if (error) {
    showMessage(workoutMessage, error.message, 'error');
    testModeToggle.checked = !isTest;
  } else {
    await refreshAllStatus();
  }
});

// ============================================================================
// 8. ПАНЕЛЬ РОЗРОБНИКА (РЕНДЕРИТЬСЯ ЛИШЕ ЯКЩО IS_DEV = TRUE)
// ============================================================================
function renderDevPanel() {
  if (!myStatus || !myStatus.is_dev) {
    devPanelRoot.innerHTML = '';
    return;
  }

  const vDateStr = new Date(myStatus.virtual_now).toLocaleString('uk-UA', {
    timeZone: myStatus.timezone
  });

  devPanelRoot.innerHTML = `
    <div class="card dev-card">
      <h2>🛠 Dev Панель</h2>
      <p class="setting-desc" style="margin-bottom: 10px;">
        Віртуальна дата (<code>app_now</code>): <strong style="color:#fde047">${vDateStr}</strong>
      </p>

      <div class="dev-grid">
        <button class="dev-btn" data-shift="-1">⏪ -1 день</button>
        <button class="dev-btn" data-shift="1">⏩ +1 день</button>
        <button class="dev-btn" data-shift="7">⏭ +7 днів</button>
        <button class="dev-btn" data-shift="0">🔄 Скинути час</button>
      </div>

      <div class="dev-row">
        <input type="date" id="dev-workout-date" class="dev-input" value="${myStatus.local_date}" />
        <button id="dev-add-workout-btn" class="dev-btn">➕ Тренування</button>
      </div>

      <p class="setting-desc" style="margin: 8px 0 6px;">Швидкі сценарії:</p>
      <div class="dev-grid">
        <button class="dev-btn" data-scenario="streak5">🔥 streak5</button>
        <button class="dev-btn" data-scenario="at_risk">⚠️ at_risk</button>
        <button class="dev-btn" data-scenario="dead">💤 dead</button>
        <button class="dev-btn" data-scenario="empty_week">📅 empty_week</button>
      </div>

      <p class="setting-desc" style="margin: 8px 0 6px;">Віртуальний партнер:</p>
      <div class="dev-grid">
        <button id="dev-create-fake-btn" class="dev-btn">🤖 Створити фейк</button>
        <button id="dev-remove-fake-btn" class="dev-btn">🗑 Видалити фейк</button>
      </div>
      <div class="dev-row">
        <input type="number" id="dev-fake-done" class="dev-input" placeholder="Днів" value="2" min="0" max="7" />
        <input type="number" id="dev-fake-goal" class="dev-input" placeholder="Ціль" value="3" min="1" max="7" />
        <input type="number" id="dev-fake-streak" class="dev-input" placeholder="Streak" value="3" min="0" max="99" />
        <button id="dev-set-fake-btn" class="dev-btn">Задати</button>
      </div>

      <button id="dev-clear-btn" class="dev-btn" style="width:100%; margin: 6px 0 12px; color:#fca5a5;">
        🧹 Очистити всі мої дані (dev_clear_my_data)
      </button>

      <p class="setting-desc" style="margin-bottom: 4px;">Сирий статус (JSON):</p>
      <pre class="dev-pre">${JSON.stringify({ my_status: myStatus, pair_status: pairStatus }, null, 2)}</pre>
    </div>
  `;

  devPanelRoot.querySelectorAll('[data-shift]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const days = parseInt(btn.getAttribute('data-shift'), 10);
      await supabaseClient.rpc('dev_shift_time', { days });
      await refreshAllStatus();
    });
  });

  devPanelRoot.querySelectorAll('[data-scenario]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const name = btn.getAttribute('data-scenario');
      await supabaseClient.rpc('dev_set_scenario', { name });
      await refreshAllStatus();
    });
  });

  document.getElementById('dev-add-workout-btn').addEventListener('click', async () => {
    const dt = document.getElementById('dev-workout-date').value;
    if (!dt) return;
    await supabaseClient.rpc('dev_add_workout', { date: dt });
    await refreshAllStatus();
  });

  document.getElementById('dev-create-fake-btn').addEventListener('click', async () => {
    await supabaseClient.rpc('dev_create_fake_partner');
    await refreshAllStatus();
  });

  document.getElementById('dev-remove-fake-btn').addEventListener('click', async () => {
    await supabaseClient.rpc('dev_remove_fake_partner');
    await refreshAllStatus();
  });

  document.getElementById('dev-set-fake-btn').addEventListener('click', async () => {
    const days_done = parseInt(document.getElementById('dev-fake-done').value, 10) || 0;
    const goal = parseInt(document.getElementById('dev-fake-goal').value, 10) || 3;
    const streak = parseInt(document.getElementById('dev-fake-streak').value, 10) || 0;
    await supabaseClient.rpc('dev_set_fake_partner', { days_done, goal, streak });
    await refreshAllStatus();
  });

  document.getElementById('dev-clear-btn').addEventListener('click', async () => {
    await supabaseClient.rpc('dev_clear_my_data');
    await refreshAllStatus();
  });
}
