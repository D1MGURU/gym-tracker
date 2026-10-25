import { api } from './api.js';
import {
  state,
  subscribe,
  refreshStatus,
  savePendingInvite,
  consumePendingInvite
} from './state.js';
import { renderAuthScreen, renderNameOnboarding } from './screens/auth.js';
import { renderHomeScreen, cleanupHomeScreen } from './screens/home.js';
import { renderPairScreen } from './screens/pair.js';
import { renderCharacterScreen } from './screens/character-screen.js';
import { renderProfileScreen } from './screens/profile.js';
import { showConfirm } from './ui/dialogs.js';
import { showToast } from './ui/toast.js';

const VALID_TABS = ['home', 'pair', 'character', 'profile'];

const authMount = document.getElementById('auth-mount');
const appMount = document.getElementById('app-mount');
const screenContainer = document.getElementById('screen-container');
const navTabs = document.querySelectorAll('.nav-tab');

// 1. Ініціалізація збереженої теми
try {
  const savedTheme = localStorage.getItem('gym_theme');
  if (savedTheme === 'light' || savedTheme === 'dark') {
    document.documentElement.setAttribute('data-theme', savedTheme);
  }
} catch (_) {}

// 2. Перехоплення параметра ?invite=КОД при завантаженні
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

function renderActiveScreen() {
  if (!state.user || !state.myStatus) return;

  // Якщо ім'я ще не задане — показуємо екран знайомства
  if (!state.myStatus.display_name) {
    appMount.classList.add('hidden');
    authMount.classList.remove('hidden');
    renderNameOnboarding(authMount, () => {
      checkPendingInviteDialog();
    });
    return;
  }

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
  if (!state.user || !state.myStatus?.display_name) return;
  const code = consumePendingInvite();
  if (!code) return;

  await showConfirm({
    title: 'Прийняти запрошення в пару?',
    message: `Ви відкрили посилання-запрошення з кодом ${code}. Приєднатися до пари?`,
    cancelText: 'Відхилити',
    confirmText: 'Прийняти запрошення',
    onConfirm: async () => {
      try {
        await api.acceptInvite(code);
        showToast('Пару успішно створено! 🎉', 'success');
        window.location.hash = '#pair';
        await refreshStatus();
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
  });
}

// Оновлення даних при перемиканні вкладок
window.addEventListener('hashchange', async () => {
  if (!state.user) return;
  renderActiveScreen();
  try {
    await refreshStatus();
  } catch (err) {
    console.error(err);
  }
});

// Підписка на зміни стану
subscribe(() => {
  renderActiveScreen();
});

// Слухач авторизації Supabase
api.onAuthStateChange(async (_event, session) => {
  if (session && session.user) {
    state.user = session.user;
    try {
      const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Kyiv';
      await api.setMyTimezone(browserTz);
      await refreshStatus();
      await checkPendingInviteDialog();
    } catch (err) {
      showToast(err.message, 'error');
    }
  } else {
    state.user = null;
    state.myStatus = null;
    state.pairStatus = null;
    cleanupHomeScreen();
    appMount.classList.add('hidden');
    authMount.classList.remove('hidden');
    renderAuthScreen(authMount);
  }
});