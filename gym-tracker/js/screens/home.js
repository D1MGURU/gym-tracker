import { api, getCurrentPosition } from '../api.js';
import { state, STATE_LABELS, refreshStatus, getVirtualNowMs } from '../state.js';
import { renderCharacter } from '../character.js';
import { renderFlame } from '../flame.js';
import { showConfirm } from '../ui/dialogs.js';
import { showToast } from '../ui/toast.js';

const DAY_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
let homeTimerInterval = null;

export function cleanupHomeScreen() {
  if (homeTimerInterval) {
    clearInterval(homeTimerInterval);
    homeTimerInterval = null;
  }
}

export function renderHomeScreen(container) {
  cleanupHomeScreen();
  container.replaceChildren();

  const s = state.myStatus;
  if (!s) return;

  // 1. Картка персонажа, streak, календаря та прогресу тижня
  const heroCard = document.createElement('section');
  heroCard.className = 'card card-centered';

  const charEl = renderCharacter({ state: s.flame_state, size: 'md' });

  const streakRow = document.createElement('div');
  streakRow.className = 'streak-header';
  const flameIcon = renderFlame(s.flame_state, 'sm');
  const streakNum = document.createElement('span');
  streakNum.className = 'streak-count-text';
  streakNum.textContent = String(s.streak_weeks ?? 0);
  streakRow.append(flameIcon, streakNum);

  const streakSub = document.createElement('small');
  streakSub.textContent = 'тижнів поспіль';

  const stateBadge = document.createElement('span');
  stateBadge.className = 'badge';
  stateBadge.textContent = STATE_LABELS[s.flame_state] || STATE_LABELS.dead;

  // Календар Пн–Нд
  const calGrid = document.createElement('div');
  calGrid.className = 'week-calendar';
  const days = Array.isArray(s.week_days) ? s.week_days : [];
  days.forEach((d, idx) => {
    const cell = document.createElement('div');
    cell.className = 'cal-day';
    if (d.is_today) cell.classList.add('is-today');
    if (d.done) cell.classList.add('is-done');

    const dayLabel = document.createElement('span');
    dayLabel.className = 'cal-day-name';
    dayLabel.textContent = DAY_NAMES[idx] || '';

    const checkEl = document.createElement('span');
    checkEl.className = 'cal-day-check';
    checkEl.textContent = d.done ? '✓' : '';

    cell.append(dayLabel, checkEl);
    calGrid.appendChild(cell);
  });

  // Прогрес тижня
  const progWrap = document.createElement('div');
  progWrap.className = 'stack-sm';
  progWrap.style.width = '100%';

  const progHeader = document.createElement('div');
  progHeader.className = 'row-between';
  const progLabel = document.createElement('span');
  progLabel.textContent = 'Цей тиждень (Пн–Нд):';
  const progVal = document.createElement('strong');
  progVal.textContent = `${s.days_done} / ${s.goal} дн.`;
  progHeader.append(progLabel, progVal);

  const track = document.createElement('div');
  track.className = 'progress-track';
  const fill = document.createElement('div');
  fill.className = 'progress-fill';
  const pct = Math.min(100, Math.round(((s.days_done || 0) / (s.goal || 1)) * 100));
  fill.style.width = `${pct}%`;
  track.appendChild(fill);

  progWrap.append(progHeader, track);

  if (s.next_week_goal && s.next_week_goal !== s.goal) {
    const nextHint = document.createElement('small');
    nextHint.textContent = `З наступного понеділка діятиме ціль: ${s.next_week_goal} дн./тиж.`;
    progWrap.appendChild(nextHint);
  }

  heroCard.append(charEl, streakRow, streakSub, stateBadge, calGrid, progWrap);

  // 2. Картка тренування
  const workoutCard = document.createElement('section');
  workoutCard.className = 'card';

  const wTitle = document.createElement('h2');
  wTitle.textContent = 'Тренування';

  const gymStatus = document.createElement('p');
  gymStatus.textContent = s.gym_saved
    ? `Точка залу активна (радіус ${s.gym_radius_m} м)`
    : 'Точку залу не задано (задай у вкладці «Профіль»)';

  const timerBox = document.createElement('div');
  timerBox.className = 'timer-box hidden';

  const timerLabel = document.createElement('small');
  timerLabel.textContent = 'Час у залі:';
  const timerDigits = document.createElement('div');
  timerDigits.className = 'timer-digits';
  timerDigits.textContent = '00:00';
  const timerHint = document.createElement('small');

  timerBox.append(timerLabel, timerDigits, timerHint);

  const actionsCol = document.createElement('div');
  actionsCol.className = 'stack-sm';

  const startBtn = document.createElement('button');
  startBtn.type = 'button';
  startBtn.className = 'btn btn-success btn-block';
  startBtn.textContent = 'Почав';

  const finishBtn = document.createElement('button');
  finishBtn.type = 'button';
  finishBtn.className = 'btn btn-warning btn-block hidden';
  finishBtn.textContent = 'Закінчив';

  const abandonBtn = document.createElement('button');
  abandonBtn.type = 'button';
  abandonBtn.className = 'btn btn-danger-secondary btn-block hidden';
  abandonBtn.textContent = 'Завершити достроково';

  actionsCol.append(startBtn, finishBtn, abandonBtn);
  workoutCard.append(wTitle, gymStatus, timerBox, actionsCol);

  container.append(heroCard, workoutCard);

  // Логіка таймера
  const reqMinutes = s.is_test_mode ? 1 : 20;
  const activeWorkout = s.active_workout;

  if (activeWorkout) {
    startBtn.classList.add('hidden');
    timerBox.classList.remove('hidden');

    const tick = () => {
      const startedMs = new Date(activeWorkout.started_at).getTime();
      const elapsedSeconds = Math.max(0, Math.floor((getVirtualNowMs() - startedMs) / 1000));
      const mins = String(Math.floor(elapsedSeconds / 60)).padStart(2, '0');
      const secs = String(elapsedSeconds % 60).padStart(2, '0');
      timerDigits.textContent = `${mins}:${secs}`;

      if (elapsedSeconds >= reqMinutes * 60) {
        // Після досягнення мінімуму — лише «Закінчив»
        finishBtn.classList.remove('hidden');
        finishBtn.disabled = false;
        abandonBtn.classList.add('hidden');
        timerHint.textContent = 'Мінімальний час виконано! Натискай «Закінчив»';
      } else {
        // Поки таймер не досяг мінімуму — видима «Завершити достроково»
        finishBtn.classList.add('hidden');
        abandonBtn.classList.remove('hidden');
        timerHint.textContent = `Щоб зарахувати, тренуйся щонайменше ${reqMinutes} хв`;
      }
    };

    tick();
    homeTimerInterval = setInterval(tick, 1000);
  }

  // Події кнопок
  startBtn.addEventListener('click', async () => {
    startBtn.disabled = true;
    startBtn.textContent = 'Перевірка GPS...';
    try {
      const coords = await getCurrentPosition();
      await api.startWorkout(coords.latitude, coords.longitude, coords.accuracy);
      showToast('Тренування розпочато! Гарного заняття 💪', 'success');
      await refreshStatus();
    } catch (err) {
      showToast(err.message, 'error');
      startBtn.disabled = false;
      startBtn.textContent = 'Почав';
    }
  });

  finishBtn.addEventListener('click', async () => {
    finishBtn.disabled = true;
    finishBtn.textContent = 'Перевірка GPS...';
    try {
      const coords = await getCurrentPosition();
      await api.finishWorkout(coords.latitude, coords.longitude, coords.accuracy);
      showToast('Тренування зараховано! 🎉', 'success');
      await refreshStatus();
    } catch (err) {
      showToast(err.message, 'error');
      finishBtn.disabled = false;
      finishBtn.textContent = 'Закінчив';
    }
  });

  abandonBtn.addEventListener('click', async () => {
    const currentFormatted = timerDigits.textContent;
    await showConfirm({
      title: 'Здаватись зарано?',
      message: `Пройшло ${currentFormatted} із ${reqMinutes} хв. Тренування не зарахується, і день не потрапить у streak.`,
      cancelText: 'Продовжувати тренування',
      confirmText: 'Завершити без зарахування',
      danger: true,
      onConfirm: async () => {
        try {
          await api.abandonWorkout();
          showToast('Тренування скасовано без зарахування', 'info');
          await refreshStatus();
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    });
  });
}