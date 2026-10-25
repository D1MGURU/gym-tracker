import { api } from './api.js';

export const STATE_LABELS = {
  goal_met: 'Ціль виконано 🔥',
  growing: 'Росте 📈',
  at_risk: 'Під загрозою ⚠️',
  dead: 'Спить 💤',
  frozen: 'Заморожено ❄️',
  sad: 'Сумує'
};

const INVITE_STORAGE_KEY = 'gym_pending_invite';
const INVITE_TTL_MS = 48 * 60 * 60 * 1000;

export const state = {
  user: null,
  myStatus: null,
  pairStatus: null,
  serverTimeOffsetMs: 0,
  currentTab: 'home',
  lastRefreshAt: 0,
  loadError: null,
  listeners: new Set()
};

let requestSeq = 0;
let inFlightPromise = null;
let inFlightUserId = null;

export function subscribe(fn) {
  state.listeners.add(fn);
  return () => state.listeners.delete(fn);
}

export function notify(meta = { silent: false }) {
  for (const fn of state.listeners) {
    fn(state, meta);
  }
}

export function resetStateOnLogout() {
  requestSeq += 1;
  inFlightPromise = null;
  inFlightUserId = null;
  state.user = null;
  state.myStatus = null;
  state.pairStatus = null;
  state.serverTimeOffsetMs = 0;
  state.lastRefreshAt = 0;
  state.loadError = null;
}

export async function refreshStatus({ silent = false } = {}) {
  if (!state.user) return null;

  const currentUserId = state.user.id;
  if (inFlightPromise && inFlightUserId === currentUserId) {
    return inFlightPromise;
  }

  const reqId = ++requestSeq;
  inFlightUserId = currentUserId;

  const promise = (async () => {
    try {
      const [myStatus, pairStatus] = await Promise.all([
        api.getMyStatus(),
        api.getPairStatus()
      ]);

      if (reqId !== requestSeq || state.user?.id !== currentUserId) {
        return state.myStatus;
      }

      state.myStatus = myStatus;
      state.pairStatus = pairStatus || { has_pair: false };
      state.lastRefreshAt = Date.now();
      state.loadError = null;

      if (myStatus?.virtual_now) {
        state.serverTimeOffsetMs = new Date(myStatus.virtual_now).getTime() - Date.now();
      }

      notify({ silent });
      return myStatus;
    } catch (err) {
      if (reqId === requestSeq && state.user?.id === currentUserId) {
        state.loadError = err?.message || 'Не вдалося завантажити дані';
        notify({ silent });
      }
      throw err;
    } finally {
      if (reqId === requestSeq) {
        inFlightPromise = null;
        inFlightUserId = null;
      }
    }
  })();

  inFlightPromise = promise;
  return promise;
}

export function getVirtualNowMs() {
  return Date.now() + state.serverTimeOffsetMs;
}

export function savePendingInvite(code) {
  try {
    const clean = String(code ?? '').trim().toUpperCase();
    if (!clean) return;
    const payload = JSON.stringify({ code: clean, ts: Date.now() });
    localStorage.setItem(INVITE_STORAGE_KEY, payload);
  } catch (_) {}
}

export function clearPendingInvite() {
  try {
    localStorage.removeItem(INVITE_STORAGE_KEY);
  } catch (_) {}
}

export function peekPendingInvite() {
  try {
    const raw = localStorage.getItem(INVITE_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    const code = typeof parsed?.code === 'string' ? parsed.code.trim().toUpperCase() : '';
    const ts = Number(parsed?.ts);

    if (!code || !Number.isFinite(ts) || Date.now() - ts > INVITE_TTL_MS) {
      clearPendingInvite();
      return null;
    }

    return code;
  } catch (_) {
    clearPendingInvite();
    return null;
  }
}
