import { api } from './api.js';

export const STATE_LABELS = {
  goal_met: 'Ціль виконано 🔥',
  growing: 'Росте 📈',
  at_risk: 'Під загрозою ⚠️',
  dead: 'Спить 💤',
  frozen: 'Заморожено ❄️'
};

export const state = {
  user: null,
  myStatus: null,
  pairStatus: null,
  serverTimeOffsetMs: 0,
  currentTab: 'home',
  listeners: new Set()
};

export function subscribe(fn) {
  state.listeners.add(fn);
  return () => state.listeners.delete(fn);
}

export function notify() {
  for (const fn of state.listeners) {
    fn(state);
  }
}

export async function refreshStatus() {
  if (!state.user) return;
  const [myStatus, pairStatus] = await Promise.all([
    api.getMyStatus(),
    api.getPairStatus()
  ]);
  state.myStatus = myStatus;
  state.pairStatus = pairStatus || { has_pair: false };

  if (myStatus?.virtual_now) {
    state.serverTimeOffsetMs = new Date(myStatus.virtual_now).getTime() - Date.now();
  }
  notify();
}

export function getVirtualNowMs() {
  return Date.now() + state.serverTimeOffsetMs;
}

export function savePendingInvite(code) {
  try {
    if (code) {
      sessionStorage.setItem('gym_pending_invite', code.trim().toUpperCase());
    }
  } catch (_) {}
}

export function consumePendingInvite() {
  try {
    const code = sessionStorage.getItem('gym_pending_invite');
    if (code) sessionStorage.removeItem('gym_pending_invite');
    return code;
  } catch (_) {
    return null;
  }
}