export function showToast(message, type = 'info', durationMs = 3500) {
  const root = document.getElementById('toast-root');
  if (!root) return;

  const item = document.createElement('div');
  item.className = `toast-item toast-${type}`;
  item.textContent = String(message || '');

  root.appendChild(item);

  setTimeout(() => {
    item.remove();
  }, durationMs);
}