import { api } from './api.js';
import {
  state,
  subscribe,
  refreshStatus,
  resetStateOnLogout,
  savePendingInvite,
  peekPendingInvite,
  clearPendingInvite
} from './state.js';
import { renderAuthScreen, renderNameOnboarding } from './screens/auth.js';
import { renderHomeScreen, cleanupHomeScreen } from './screens/home.js';
import { renderPairScreen } from './screens/pair.js';
import { renderCharacterScreen } from './screens/character-screen.js';
import { renderProfileScreen } from './screens/profile.js';
import { showConfirm, closeAllDialogs } from './ui/dialogs.js';
import { showToast } from './ui/toast.js';

const VALID_TABS = ['home', 'pair', 'character', 'profile'];
const SILENT_REFRESH_COOLDOWN_MS = 30 * 1000;
const SILENT_ERROR_TOAST_COOLDOWN_MS = 60 * 1000;

const authMount = document.getElementById('auth-mount');
const appMount = document.getElementById('app-mount');
const screenContainer = document.getElementById('screen-container');
const navTabs = document.querySelectorAll('.nav-tab');

let initializedUserId = null;
let initializingUserId = null;
let onboardingMounted = false;
let inviteDialogOpen = false;
let lastSilentErrorToastAt = 0;

try {
  const savedTheme = localStorage.getItem('gym_theme');
  if (savedTheme === 'light' || savedTheme === 'dark') {
    document.documentElement.setAttribute('data-theme', savedTheme);
  }
} catch (_) {}

(function captureInviteFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const inviteCode = params.get('invite');
  if (inviteCode) {
    savePendingInvite(inviteCode);
    const cleanUrl = window.location.pathname + window.location.hash;
    window.history.replaceState({}, document.title, cleanUrl);
  }
})();

function getSavedTab() {
  try {
    const t = localStorage.getItem('gym_last_tab');
    return VALID_TABS.includes(t) ? t : 'home';
  } catch (_) {
    return 'home';
  }
}

function saveTab(tab) {
  try {
    localStorage.setItem('gym_last_tab', tab);
  } catch (_) {}
}

function resolveCurrentTab() {
  const rawHash = window.location.hash.replace('#', '').trim();
  if (VALID_TABS.includes(rawHash)) {
    return rawHash;
  }
  return getSavedTab();
}

function updateNavAria(activeTab) {
  navTabs.forEach((link) => {
    if (link.dataset.tab === activeTab) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });
}

function isScreenInputFocused() {
  const active = document.activeElement;
  if (!active || !screenContainer.contains(active)) return false;
  const tag = active.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || active.isContentEditable;
}

function isAnyDialogOpen() {
  return document.body.classList.contains('dialog-open');
}

function renderLoadingCard() {
  onboardingMounted = false;
  appMount.classList.add('hidden');
  authMount.classList.remove('hidden');
  authMount.replaceChildren();

  const card = document.createElement('section');
  card.className = 'card card-centered status-card';
  card.setAttribute('role', 'status');

  const spinner = document.createElement('div');
  spinner.className = 'loading-spinner';
  spinner.setAttribute('aria-hidden', 'true');

  const text = document.createElement('p');
  text.textContent = 'Завантаження…';

  card.append(spinner, text);
  authMount.appendChild(card);
}

function renderLoadErrorCard(errorMessage) {
  onboardingMounted = false;
  appMount.classList.add('hidden');
  authMount.classList.remove('hidden');
  authMount.replaceChildren();

  const card = document.createElement('section');
  card.className = 'card card-centered status-card';

  const title = document.createElement('h2');
  title.textContent = 'Не вдалося завантажити';

  const msg = document.createElement('p');
  msg.textContent = errorMessage || 'Перевір підключення до інтернету та спробуй ще раз.';

  const retryBtn = document.createElement('button');
  retryBtn.type = 'button';
  retryBtn.className = 'btn btn-primary btn-block';
  retryBtn.textContent = 'Спробувати ще раз';

  retryBtn.addEventListener('click', () => {
    if (!state.user) return;
    initializedUserId = null;
    initializeUserSession(state.user);
  });

  card.append(title, msg, retryBtn);
  authMount.appendChild(card);
}

function renderActiveScreen() {
  if (!state.user) return;

  if (!state.myStatus) {
    if (state.loadError) {
      renderLoadErrorCard(state.loadError);
    } else {
      renderLoadingCard();
    }
    return;
  }

  if (!state.myStatus.display_name) {
    appMount.classList.add('hidden');
    authMount.classList.remove('hidden');
    if (!onboardingMounted) {
      onboardingMounted = true;
      renderNameOnboarding(authMount, () => {
        onboardingMounted = false;
        renderActiveScreen();
        checkPendingInviteDialog();
      });
    }
    return;
  }

  onboardingMounted = false;
  authMount.classList.add('hidden');
  appMount.classList.remove('hidden');

  const tab = resolveCurrentTab();
  state.currentTab = tab;
  saveTab(tab);
  updateNavAria(tab);

  if (tab !== 'home') {
    cleanupHomeScreen();
  }

  switch (tab) {
    case 'pair':
      renderPairScreen(screenContainer);
      break;
    case 'character':
      renderCharacterScreen(screenContainer);
      break;
    case 'profile':
      renderProfileScreen(screenContainer);
      break;
    case 'home':
    default:
      renderHomeScreen(screenContainer);
      break;
  }
}

async function checkPendingInviteDialog() {
  if (!state.user || !state.myStatus?.display_name || inviteDialogOpen) return;
  const code = peekPendingInvite();
  if (!code) return;

  inviteDialogOpen = true;
  try {
    let message = `Ви відкрили посилання-запрошення з кодом ${code}. Приєднатися до пари?`;
    const rp = state.pairStatus?.restorable_pair;
    if (rp) {
      const partnerName = rp.partner_display_name || 'Партнер';
      const weeks = rp.shared_streak_at_leave ?? 0;
      message += ` Прийнявши запрошення, ти втратиш можливість відновити пару з ${partnerName} (спільний streak: ${weeks} тиж.).`;
    }

    const accepted = await showConfirm({
      title: 'Прийняти запрошення в пару?',
      message,
      cancelText: 'Відхилити',
      confirmText: 'Прийняти запрошення',
      onConfirm: () => api.acceptInvite(code)
    });

    clearPendingInvite();

    if (accepted) {
      showToast('Пару успішно створено! 🎉', 'success');
      window.location.hash = '#pair';
      await refreshStatus();
    }
  } finally {
    inviteDialogOpen = false;
  }
}

async function initializeUserSession(user) {
  if (!user) return;
  const targetUserId = user.id;

  if (initializingUserId === targetUserId) return;
  initializingUserId = targetUserId;

  if (!state.myStatus) {
    renderLoadingCard();
  }

  try {
    const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Kyiv';
    await api.setMyTimezone(browserTz).catch(() => {});

    if (state.user?.id !== targetUserId) return;

    await refreshStatus();
    if (state.user?.id !== targetUserId) return;

    initializedUserId = targetUserId;
    await checkPendingInviteDialog();
  } catch (err) {
    if (state.user?.id === targetUserId) {
      renderLoadErrorCard(err?.message || 'Не вдалося завантажити дані');
    }
  } finally {
    if (initializingUserId === targetUserId) {
      initializingUserId = null;
    }
  }
}

function handleSession(session) {
  if (session && session.user) {
    const newUserId = session.user.id;
    const isSameUser =
      initializedUserId === newUserId &&
      state.myStatus &&
      !state.loadError;

    if (state.user && state.user.id !== newUserId) {
      resetStateOnLogout();
      closeAllDialogs();
      initializedUserId = null;
      initializingUserId = null;
      onboardingMounted = false;
      inviteDialogOpen = false;
    }

    state.user = session.user;

    if (isSameUser) {
      return;
    }

    initializeUserSession(session.user);
  } else {
    initializedUserId = null;
    initializingUserId = null;
    onboardingMounted = false;
    inviteDialogOpen = false;
    resetStateOnLogout();
    cleanupHomeScreen();
    closeAllDialogs();
    appMount.classList.add('hidden');
    authMount.classList.remove('hidden');
    renderAuthScreen(authMount);
  }
}

async function triggerBackgroundRefresh() {
  if (!state.user || !initializedUserId) return;
  if (Date.now() - state.lastRefreshAt <= SILENT_REFRESH_COOLDOWN_MS) return;

  try {
    await refreshStatus({ silent: true });
  } catch (_) {
    const now = Date.now();
    if (now - lastSilentErrorToastAt > SILENT_ERROR_TOAST_COOLDOWN_MS) {
      lastSilentErrorToastAt = now;
      showToast('Не вдалося оновити дані', 'error');
    }
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    triggerBackgroundRefresh();
  }
});

window.addEventListener('online', () => {
  triggerBackgroundRefresh();
});

window.addEventListener('hashchange', () => {
  if (!state.user) return;
  renderActiveScreen();
  if (state.myStatus) {
    refreshStatus({ silent: true }).catch((err) => {
      showToast(err?.message || 'Не вдалося оновити дані', 'error');
    });
  }
});

subscribe((_st, meta = {}) => {
  if (meta.silent && (isScreenInputFocused() || isAnyDialogOpen())) {
    return;
  }
  renderActiveScreen();
});

api.onAuthStateChange((_event, session) => {
  setTimeout(() => handleSession(session), 0);
});
