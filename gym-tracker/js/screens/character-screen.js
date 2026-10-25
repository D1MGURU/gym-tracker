import { state, STATE_LABELS } from '../state.js';
import { renderCharacter } from '../character.js';

export function renderCharacterScreen(container) {
  container.replaceChildren();

  const s = state.myStatus;
  const charState = s?.flame_state || 'growing';

  const card = document.createElement('section');
  card.className = 'card card-centered';

  const title = document.createElement('h2');
  title.textContent = 'Мій персонаж';

  const charEl = renderCharacter({ state: charState, size: 'lg' });

  const stateBadge = document.createElement('span');
  stateBadge.className = 'badge';
  stateBadge.textContent = STATE_LABELS[charState] || STATE_LABELS.dead;

  const placeholderCard = document.createElement('section');
  placeholderCard.className = 'card card-centered';
  const placeholderText = document.createElement('p');
  placeholderText.textContent = 'Вибір тварини й гардероб: скоро';
  placeholderCard.appendChild(placeholderText);

  card.append(title, charEl, stateBadge);
  container.append(card, placeholderCard);
}