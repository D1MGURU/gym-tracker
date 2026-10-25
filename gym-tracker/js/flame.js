const VALID_STATES = ['goal_met', 'growing', 'at_risk', 'dead', 'frozen'];
const VALID_SIZES = ['sm', 'md', 'lg'];

export function renderFlame(flameState = 'dead', size = 'sm') {
  const safeState = VALID_STATES.includes(flameState) ? flameState : 'dead';
  const safeSize = VALID_SIZES.includes(size) ? size : 'sm';

  const span = document.createElement('span');
  span.className = `flame-component flame-${safeState} flame-${safeSize}`;
  span.dataset.state = safeState;
  span.setAttribute('aria-hidden', 'true');
  span.textContent = '🔥';
  return span;
}