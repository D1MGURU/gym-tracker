const MAX_TOASTS = 3;
const ERROR_DURATION_MS = 6000;
const DEFAULT_DURATION_MS = 3500;

export function showToast(message, type = 'info', durationMs) {
  const root = document.getElementById('toast-root');
  if (!root) return;

  while (root.children.length >= MAX_TOASTS) {
    root.firstElementChild.remove();
  }

  const isError = type === 'error';
  const effectiveDuration =
    typeof durationMs === 'number'
      ? durationMs
      : isError
      ? ERROR_DURATION_MS
      : DEFAULT_DURATION_MS;

  const item = document.createElement('div');
  item.className = `toast-item toast-${type}`;
  item.setAttribute('role', isError ? 'alert' : 'status');
  item.textContent = String(message ?? '');

  root.appendChild(item);

  setTimeout(() => {
    item.remove();
  }, effectiveDuration);
}
