import { api } from '../api.js';
import { state, STATE_LABELS, refreshStatus } from '../state.js';
import { renderCharacter } from '../character.js';
import { renderFlame } from '../flame.js';
import { showConfirm, showCustomDialog } from '../ui/dialogs.js';
import { showToast } from '../ui/toast.js';

function formatLocalDateTime(isoString) {
  if (!isoString) return '';
  try {
    return new Date(isoString).toLocaleString('uk-UA', {
      timeZone: state.myStatus?.timezone || 'Europe/Kyiv',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (_) {
    return String(isoString);
  }
}

async function copyText(text, successMsg) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(successMsg, 'success');
  } catch (_) {
    showToast(`Скопіюй вручну: ${text}`, 'info');
  }
}

function openAddPairDialog() {
  const existingInvite = state.pairStatus?.active_invite;

  showCustomDialog({
    title: 'Додати пару 🤝',
    renderBody: (bodyEl, close) => {
      // Опція 1: Мій код пари
      const opt1 = document.createElement('div');
      opt1.className = 'card stack-sm';
      const opt1Title = document.createElement('h3');
      opt1Title.textContent = '1. Мій код пари';
      const codeStatus = document.createElement('p');
      const codeBtnRow = document.createElement('div');
      codeBtnRow.className = 'row-between';

      let currentCode = existingInvite?.code || null;
      let currentExpires = existingInvite?.expires_at || null;

      function updateCodeView() {
        codeBtnRow.replaceChildren();
        if (currentCode) {
          codeStatus.textContent = `Код: ${currentCode} (діє до ${formatLocalDateTime(currentExpires)})`;
          const copyBtn = document.createElement('button');
          copyBtn.type = 'button';
          copyBtn.className = 'btn btn-outline btn-block';
          copyBtn.textContent = 'Скопіювати код';
          copyBtn.addEventListener('click', () => copyText(currentCode, 'Код скопійовано!'));
          codeBtnRow.appendChild(copyBtn);
        } else {
          codeStatus.textContent = 'Згенеруй 6-значний код (діє 48 годин)';
          const genBtn = document.createElement('button');
          genBtn.type = 'button';
          genBtn.className = 'btn btn-secondary btn-block';
          genBtn.textContent = 'Створити код';
          genBtn.addEventListener('click', async () => {
            genBtn.disabled = true;
            try {
              const res = await api.createInvite();
              currentCode = res.code;
              currentExpires = res.expires_at;
              await refreshStatus();
              updateCodeView();
              showToast('Код створено!', 'success');
            } catch (err) {
              showToast(err.message, 'error');
              genBtn.disabled = false;
            }
          });
          codeBtnRow.appendChild(genBtn);
        }
      }
      updateCodeView();
      opt1.append(opt1Title, codeStatus, codeBtnRow);

      // Опція 2: Ввести код друга
      const opt2 = document.createElement('div');
      opt2.className = 'card stack-sm';
      const opt2Title = document.createElement('h3');
      opt2Title.textContent = '2. Ввести код друга';
      const codeInput = document.createElement('input');
      codeInput.type = 'text';
      codeInput.className = 'input';
      codeInput.maxLength = 6;
      codeInput.placeholder = '6-значний код';
      const joinBtn = document.createElement('button');
      joinBtn.type = 'button';
      joinBtn.className = 'btn btn-primary btn-block';
      joinBtn.textContent = 'Приєднатися за кодом';

      joinBtn.addEventListener('click', async () => {
        const val = codeInput.value.trim();
        if (!val) {
          showToast('Введи код друга', 'error');
          return;
        }
        joinBtn.disabled = true;
        try {
          await api.acceptInvite(val);
          showToast('Пару успішно створено! 🎉', 'success');
          close();
          await refreshStatus();
        } catch (err) {
          showToast(err.message, 'error');
          joinBtn.disabled = false;
        }
      });
      opt2.append(opt2Title, codeInput, joinBtn);

      // Опція 3: Запросити посиланням
      const opt3 = document.createElement('div');
      opt3.className = 'card stack-sm';
      const opt3Title = document.createElement('h3');
      opt3Title.textContent = '3. Запросити посиланням';
      const shareBtn = document.createElement('button');
      shareBtn.type = 'button';
      shareBtn.className = 'btn btn-outline btn-block';
      shareBtn.textContent = 'Поділитися посиланням';

      shareBtn.addEventListener('click', async () => {
        shareBtn.disabled = true;
        try {
          if (!currentCode) {
            const res = await api.createInvite();
            currentCode = res.code;
            currentExpires = res.expires_at;
            await refreshStatus();
            updateCodeView();
          }
          const inviteUrl = `${window.location.origin}/?invite=${encodeURIComponent(currentCode)}`;
          if (navigator.share) {
            await navigator.share({
              title: 'Gym Streak — Запрошення в пару',
              text: 'Давай тримати спільний вогник у залі!',
              url: inviteUrl
            });
          } else {
            await copyText(inviteUrl, 'Посилання скопійовано!');
          }
        } catch (err) {
          if (err.name !== 'AbortError') {
            showToast(err.message || 'Не вдалося поділитися посиланням', 'error');
          }
        } finally {
          shareBtn.disabled = false;
        }
      });
      opt3.append(opt3Title, shareBtn);

      bodyEl.append(opt1, opt2, opt3);
    }
  });
}

export function renderPairScreen(container) {
  container.replaceChildren();

  const pStatus = state.pairStatus || { has_pair: false };
  const myStatus = state.myStatus;

  // ВИПАДОК 1: Немає активної пари
  if (!pStatus.has_pair) {
    // Банер: Відновлювана пара (лише для того, хто вийшов)
    if (pStatus.restorable_pair) {
      const rp = pStatus.restorable_pair;
      const banner = document.createElement('div');
      banner.className = 'banner banner-warning';

      const bText = document.createElement('p');
      bText.textContent = `Ви вийшли з пари. Відновити до ${formatLocalDateTime(rp.restorable_until)}`;

      const restoreBtn = document.createElement('button');
      restoreBtn.type = 'button';
      restoreBtn.className = 'btn btn-primary btn-block';
      restoreBtn.textContent = 'Відновити пару';

      restoreBtn.addEventListener('click', () => {
        showConfirm({
          title: 'Відновити пару?',
          message: `Твій спільний streak (${rp.shared_streak_at_leave} тиж.) з ${rp.partner_display_name} буде відновлено.`,
          cancelText: 'Скасувати',
          confirmText: 'Відновити',
          onConfirm: async () => {
            try {
              await api.restorePair();
              showToast('Пару успішно відновлено!', 'success');
              await refreshStatus();
            } catch (err) {
              showToast(err.message, 'error');
            }
          }
        });
      });

      banner.append(bText, restoreBtn);
      container.appendChild(banner);
    }

    // Банер: Партнер вийшов (БЕЗ кнопки відновлення)
    if (pStatus.partner_left_pair) {
      const pl = pStatus.partner_left_pair;
      const banner = document.createElement('div');
      banner.className = 'banner banner-info';
      const bText = document.createElement('p');
      bText.textContent = `${pl.partner_display_name} вийшов(ла) з пари`;
      banner.appendChild(bText);
      container.appendChild(banner);
    }

    // Сцена з персонажем під CSS-дощем + кнопка «Додати пару»
    const sceneCard = document.createElement('section');
    sceneCard.className = 'card card-centered';

    const scene = document.createElement('div');
    scene.className = 'pair-scene';
    scene.style.width = '100%';

    const rainLayer = document.createElement('div');
    rainLayer.className = 'rain-layer';
    for (let i = 0; i < 9; i++) {
      const drop = document.createElement('span');
      drop.className = 'rain-drop';
      rainLayer.appendChild(drop);
    }

    const lonelyChar = renderCharacter({ state: 'dead', size: 'md' });
    const lonelyCaption = document.createElement('small');
    lonelyCaption.textContent = 'Персонаж сумує наодинці під дощем...';

    scene.append(rainLayer, lonelyChar, lonelyCaption);

    const addPairBtn = document.createElement('button');
    addPairBtn.type = 'button';
    addPairBtn.className = 'btn btn-primary btn-block';
    addPairBtn.textContent = 'Додати пару';
    addPairBtn.addEventListener('click', openAddPairDialog);

    sceneCard.append(scene, addPairBtn);
    container.appendChild(sceneCard);
    return;
  }

  // ВИПАДОК 2: Активна пара
  const partner = pStatus.partner || {};

  const activeSceneCard = document.createElement('section');
  activeSceneCard.className = 'card card-centered';

  const scene = document.createElement('div');
  scene.className = 'pair-scene';
  scene.style.width = '100%';

  const charsRow = document.createElement('div');
  charsRow.className = 'pair-characters-row';
  charsRow.append(
    renderCharacter({ state: myStatus?.flame_state || 'growing', size: 'sm' }),
    renderCharacter({ state: partner.flame_state || 'growing', size: 'sm' })
  );
  scene.appendChild(charsRow);

  const sharedRow = document.createElement('div');
  sharedRow.className = 'streak-header';
  sharedRow.append(
    renderFlame(pStatus.pair_flame_state || 'growing', 'sm'),
    Object.assign(document.createElement('span'), {
      className: 'streak-count-text',
      textContent: String(pStatus.shared_streak ?? 0)
    })
  );

  const summaryText = document.createElement('p');
  summaryText.textContent = pStatus.summary_text || '';

  const pairStateBadge = document.createElement('span');
  pairStateBadge.className = 'badge';
  pairStateBadge.textContent = pStatus.pair_state_label || '';

  activeSceneCard.append(scene, sharedRow, summaryText, pairStateBadge);

  // Картка партнера (білий список get_pair_status)
  const partnerCard = document.createElement('section');
  partnerCard.className = 'card';

  const pTitle = document.createElement('h2');
  pTitle.textContent = partner.display_name || 'Партнер';

  const pStats = document.createElement('div');
  pStats.className = 'stack-sm';

  const rowState = document.createElement('p');
  rowState.textContent = `Стан: ${STATE_LABELS[partner.flame_state] || STATE_LABELS.dead}`;

  const rowWeek = document.createElement('p');
  rowWeek.textContent = `Цього тижня: ${partner.days_done ?? 0} / ${partner.goal ?? 3} дн.`;

  const rowStreak = document.createElement('p');
  rowStreak.textContent = `Особистий streak: ${partner.streak_weeks ?? 0} тиж.`;

  pStats.append(rowState, rowWeek, rowStreak);
  partnerCard.append(pTitle, pStats);

  // Заглушки майбутніх фіч
  const placeholdersCard = document.createElement('section');
  placeholdersCard.className = 'card stack-sm';
  ['Рівень: скоро', 'Досягнення: скоро', 'Кастомізація сцени: скоро'].forEach((label) => {
    const item = document.createElement('div');
    item.className = 'badge';
    item.textContent = label;
    placeholdersCard.appendChild(item);
  });

  // Небезпечна зона (вихід із пари у 2 кроки)
  const dangerDetails = document.createElement('details');
  dangerDetails.className = 'danger-details';
  const summary = document.createElement('summary');
  summary.textContent = 'Небезпечна зона';

  const leaveBtn = document.createElement('button');
  leaveBtn.type = 'button';
  leaveBtn.className = 'btn btn-danger-secondary btn-block';
  leaveBtn.style.marginTop = 'var(--space-12)';
  leaveBtn.textContent = 'Вийти з пари';

  leaveBtn.addEventListener('click', async () => {
    const partnerName = partner.display_name || 'Партнер';
    const sharedWeeks = pStatus.shared_streak ?? 0;

    // Крок 1
    const step1 = await showConfirm({
      title: 'Вийти з пари?',
      message: `Ти втратиш спільний streak: ${sharedWeeks} тиж. разом з ${partnerName}. Протягом 24 годин ти зможеш відновити пару, якщо ніхто з вас не створить нову.`,
      cancelText: 'Залишитись у парі',
      confirmText: 'Продовжити вихід',
      danger: true
    });

    if (!step1) return;

    // Крок 2: holdToConfirm (3 с) або ввід імені партнера
    await showConfirm({
      title: 'Остаточне підтвердження',
      message: `Підтвердь вихід із пари з ${partnerName}.`,
      cancelText: 'Скасувати',
      confirmText: 'Вийти з пари',
      danger: true,
      requireText: partnerName,
      holdToConfirm: true,
      allowEitherHoldOrText: true,
      onConfirm: async () => {
        try {
          await api.leavePair();
          showToast('Ви вийшли з пари. Доступне відновлення протягом 24 год.', 'info');
          await refreshStatus();
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    });
  });

  dangerDetails.append(summary, leaveBtn);
  container.append(activeSceneCard, partnerCard, placeholdersCard, dangerDetails);
}