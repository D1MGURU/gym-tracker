// ============================================================================
// 1. ВСТАВЬ СВОИ КЛЮЧИ SUPABASE СЮДА:
// ============================================================================
const SUPABASE_URL = 'https://robheofjlizpzbqmonjx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJvYmhlb2ZqbGl6cHpicW1vbmp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI5MTM3MDIsImV4cCI6MjEwODQ4OTcwMn0.xLdSrVfqO7ewWKboQVQiOpiG578UiSidT6mUPFWmML4';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Глобальные переменные состояния
let currentUser = null;
let currentProfile = null;
let activeWorkout = null;
let timerInterval = null;

// Элементы интерфейса
const authScreen = document.getElementById('auth-screen');
const mainScreen = document.getElementById('main-screen');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const authMessage = document.getElementById('auth-message');
const userEmailSpan = document.getElementById('user-email');

const fireIcon = document.getElementById('fire-icon');
const streakCountEl = document.getElementById('streak-count');
const weekDoneEl = document.getElementById('week-done');
const weekGoalDisplayEl = document.getElementById('week-goal-display');
const progressBarFill = document.getElementById('progress-bar-fill');

const gymStatusEl = document.getElementById('gym-status');
const timerBox = document.getElementById('timer-box');
const timerDisplay = document.getElementById('timer-display');
const timerHint = document.getElementById('timer-hint');
const workoutMessage = document.getElementById('workout-message');

const startBtn = document.getElementById('start-btn');
const finishBtn = document.getElementById('finish-btn');
const setGymBtn = document.getElementById('set-gym-btn');
const goalInput = document.getElementById('goal-input');
const saveGoalBtn = document.getElementById('save-goal-btn');
const testModeToggle = document.getElementById('test-mode-toggle');

// ============================================================================
// 2. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (Уведомления и GPS)
// ============================================================================
function showMessage(element, text, type = 'error') {
  element.textContent = text;
  element.className = `status-msg ${type}`;
  element.classList.remove('hidden');
}

function hideMessage(element) {
  element.classList.add('hidden');
}

// Получение точной геопозиции с телефона
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
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  });
}

// ============================================================================
// 3. АВТОРИЗАЦИЯ (Вход, Регистрация, Выход)
// ============================================================================
document.getElementById('login-btn').addEventListener('click', async () => {
  hideMessage(authMessage);
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    return showMessage(authMessage, 'Введи email та пароль');
  }

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    showMessage(authMessage, 'Помилка входу: ' + error.message);
  }
});

document.getElementById('signup-btn').addEventListener('click', async () => {
  hideMessage(authMessage);
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || password.length < 6) {
    return showMessage(authMessage, 'Введи коректний email та пароль (від 6 символів)');
  }

  const { error } = await supabaseClient.auth.signUp({ email, password });
  if (error) {
    showMessage(authMessage, 'Помилка реєстрації: ' + error.message);
  } else {
    showMessage(authMessage, 'Акаунт створено! Входимо...', 'success');
  }
});

document.getElementById('logout-btn').addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
});

// Слушатель состояния сессии
supabaseClient.auth.onAuthStateChange((event, session) => {
  if (session && session.user) {
    currentUser = session.user;
    userEmailSpan.textContent = currentUser.email;
    authScreen.classList.add('hidden');
    mainScreen.classList.remove('hidden');
    loadUserData();
  } else {
    currentUser = null;
    stopTimer();
    mainScreen.classList.add('hidden');
    authScreen.classList.remove('hidden');
  }
});

// ============================================================================
// 4. ЗАГРУЗКА ПРОФИЛЯ И ИСТОРИИ ТРЕНИРОВОК
// ============================================================================
async function loadUserData() {
  if (!currentUser) return;

  // 1. Загружаем профиль
  const { data: profile, error: profileErr } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('id', currentUser.id)
    .single();

  if (profileErr) {
    console.error(profileErr);
    return;
  }

  currentProfile = profile;
  goalInput.value = profile.weekly_goal;
  weekGoalDisplayEl.textContent = profile.weekly_goal;
  testModeToggle.checked = profile.is_test_mode;

  if (profile.gym_lat && profile.gym_lng) {
    gymStatusEl.textContent = `✅ Зал збережено (радіус ${profile.gym_radius_m} м)`;
  } else {
    gymStatusEl.textContent = '⚠️ Точку залу ще не задано. Натисни «Зал тут» у налаштуваннях.';
  }

  // 2. Загружаем все тренировки пользователя
  const { data: workouts, error: workoutsErr } = await supabaseClient
    .from('workouts')
    .select('*')
    .order('started_at', { ascending: false });

  if (workoutsErr) {
    console.error(workoutsErr);
    return;
  }

  // Проверяем, есть ли активная тренировка прямо сейчас
  activeWorkout = workouts.find((w) => w.status === 'in_progress') || null;
  updateWorkoutUI();

  // Считаем прогресс за неделю и streak (по уникальным календарным дням)
  const completedWorkouts = workouts.filter((w) => w.status === 'completed');
  calculateStreakAndWeek(completedWorkouts, profile.weekly_goal);
}

// ============================================================================
// 5. ПОДСЧЕТ УНИКАЛЬНЫХ ДНЕЙ И ОГОНЬКА (STREAK С ПН ПО ВС)
// ============================================================================
function toLocalDateKey(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Возвращает дату понедельника (00:00) для любой даты
function getMondayOfWeek(dateObj) {
  const d = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
  const day = d.getDay(); // 0 - воскресенье, 1 - понедельник ... 6 - суббота
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d;
}

function calculateStreakAndWeek(completedWorkouts, weeklyGoal) {
  // Группируем уникальные календарные дни по неделям (ключ недели = дата её понедельника)
  const weeksMap = new Map();

  for (const w of completedWorkouts) {
    const dt = new Date(w.finished_at || w.started_at);
    const dayKey = toLocalDateKey(dt);
    const mondayKey = toLocalDateKey(getMondayOfWeek(dt));

    if (!weeksMap.has(mondayKey)) {
      weeksMap.set(mondayKey, new Set());
    }
    weeksMap.get(mondayKey).add(dayKey);
  }

  // Текущая неделя
  const currentMonday = getMondayOfWeek(new Date());
  const currentMondayKey = toLocalDateKey(currentMonday);
  const daysThisWeek = weeksMap.get(currentMondayKey)?.size || 0;

  // Обновляем шкалу текущей недели
  weekDoneEl.textContent = daysThisWeek;
  const percent = Math.min(100, Math.round((daysThisWeek / weeklyGoal) * 100));
  progressBarFill.style.width = `${percent}%`;

  // Считаем сколько недель подряд выполнена цель
  let streak = 0;

  // Если на этой неделе цель УЖЕ выполнена — прибавляем текущую неделю
  if (daysThisWeek >= weeklyGoal) {
    streak += 1;
  }

  // Проверяем прошлые недели подряд назад (начиная с прошлой недели)
  let checkMonday = new Date(currentMonday);
  while (true) {
    checkMonday.setDate(checkMonday.getDate() - 7);
    const key = toLocalDateKey(checkMonday);
    const uniqueDays = weeksMap.get(key)?.size || 0;

    if (uniqueDays >= weeklyGoal) {
      streak += 1;
    } else {
      break;
    }
  }

  streakCountEl.textContent = streak;
  if (streak > 0) {
    fireIcon.classList.remove('inactive');
  } else {
    fireIcon.classList.add('inactive');
  }
}

// ============================================================================
// 6. ТАЙМЕР И КНОПКИ «ПОЧАВ» / «ЗАКІНЧИВ»
// ============================================================================
function updateWorkoutUI() {
  stopTimer();

  const reqMinutes = currentProfile?.is_test_mode ? 1 : 20;
  timerHint.textContent = `Щоб зарахувати, тренуйся мінімум ${reqMinutes} хв`;

  if (!activeWorkout) {
    timerBox.classList.add('hidden');
    startBtn.disabled = false;
    finishBtn.disabled = true;
    return;
  }

  // Если тренировка идет
  timerBox.classList.remove('hidden');
  startBtn.disabled = true;

  const tick = () => {
    const startedMs = new Date(activeWorkout.started_at).getTime();
    const nowMs = Date.now();
    const elapsedSeconds = Math.max(0, Math.floor((nowMs - startedMs) / 1000));

    const mins = String(Math.floor(elapsedSeconds / 60)).padStart(2, '0');
    const secs = String(elapsedSeconds % 60).padStart(2, '0');
    timerDisplay.textContent = `${mins}:${secs}`;

    // Активируем кнопку «Закінчив» только когда прошло нужное время
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

// Кнопка «Почав»
startBtn.addEventListener('click', async () => {
  hideMessage(workoutMessage);
  startBtn.disabled = true;
  startBtn.textContent = 'Перевірка GPS...';

  try {
    const coords = await getCurrentPosition();

    const { data, error } = await supabaseClient.rpc('start_workout', {
      user_lat: coords.latitude,
      user_lng: coords.longitude,
      user_accuracy: coords.accuracy
    });

    if (error) throw new Error(error.message);

    activeWorkout = data;
    showMessage(workoutMessage, 'Тренування розпочато! Гарного заняття 💪', 'success');
    updateWorkoutUI();
  } catch (err) {
    showMessage(workoutMessage, err.message, 'error');
    startBtn.disabled = false;
  } finally {
    startBtn.textContent = 'Почав';
  }
});

// Кнопка «Закінчив»
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

    activeWorkout = null;
    showMessage(workoutMessage, '🎉 Тренування зараховано!', 'success');
    await loadUserData();
  } catch (err) {
    showMessage(workoutMessage, err.message, 'error');
    finishBtn.disabled = false;
  } finally {
    finishBtn.textContent = 'Закінчив';
  }
});

// ============================================================================
// 7. НАСТРОЙКИ («Зал тут», Цель на неделю, Тестовый режим)
// ============================================================================
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
      .update({
        gym_lat: coords.latitude,
        gym_lng: coords.longitude
      })
      .eq('id', currentUser.id);

    if (error) throw new Error(error.message);

    showMessage(
      workoutMessage,
      `Точку залу збережено! (Точність GPS: ${Math.round(coords.accuracy)} м)`,
      'success'
    );
    await loadUserData();
  } catch (err) {
    showMessage(workoutMessage, err.message, 'error');
  } finally {
    setGymBtn.disabled = false;
    setGymBtn.textContent = '📍 Зал тут';
  }
});

saveGoalBtn.addEventListener('click', async () => {
  const newGoal = parseInt(goalInput.value, 10);
  if (isNaN(newGoal) || newGoal < 1 || newGoal > 7) {
    return showMessage(workoutMessage, 'Ціль має бути від 1 до 7 днів на тиждень');
  }

  const { error } = await supabaseClient
    .from('profiles')
    .update({ weekly_goal: newGoal })
    .eq('id', currentUser.id);

  if (error) {
    showMessage(workoutMessage, error.message, 'error');
  } else {
    showMessage(workoutMessage, 'Ціль на тиждень оновлено!', 'success');
    await loadUserData();
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
    currentProfile.is_test_mode = isTest;
    updateWorkoutUI();
    showMessage(
      workoutMessage,
      isTest ? 'Тестовий режим увімкнено (таймер 1 хв)' : 'Стандартний режим (таймер 20 хв)',
      'success'
    );
  }
});
