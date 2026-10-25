const VALID_STATES = ['goal_met', 'growing', 'at_risk', 'dead', 'frozen'];
const VALID_SIZES = ['sm', 'md', 'lg'];
const SVG_NS = 'http://www.w3.org/2000/svg';

export function renderCharacter({
  animal = 'blob',
  state = 'growing',
  accessories = [],
  size = 'md'
} = {}) {
  const safeState = VALID_STATES.includes(state) ? state : 'growing';
  const safeSize = VALID_SIZES.includes(size) ? size : 'md';

  const wrap = document.createElement('div');
  wrap.className = `character-wrap character-${safeSize} character-state-${safeState}`;
  wrap.dataset.animal = String(animal);
  wrap.dataset.state = safeState;

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 120 120');
  svg.setAttribute('class', 'character-svg');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Персонаж');

  // Тіло персонажа (кругла заглушка)
  const body = document.createElementNS(SVG_NS, 'circle');
  body.setAttribute('cx', '60');
  body.setAttribute('cy', '66');
  body.setAttribute('r', '42');
  body.setAttribute('class', 'char-body');
  svg.appendChild(body);

  // Очі
  const leftEye = document.createElementNS(SVG_NS, 'circle');
  leftEye.setAttribute('cx', '45');
  leftEye.setAttribute('cy', '58');
  leftEye.setAttribute('r', '9');
  leftEye.setAttribute('class', 'char-eye');

  const rightEye = document.createElementNS(SVG_NS, 'circle');
  rightEye.setAttribute('cx', '75');
  rightEye.setAttribute('cy', '58');
  rightEye.setAttribute('r', '9');
  rightEye.setAttribute('class', 'char-eye');

  const leftPupil = document.createElementNS(SVG_NS, 'circle');
  leftPupil.setAttribute('cx', '45');
  leftPupil.setAttribute('cy', safeState === 'dead' ? '61' : '58');
  leftPupil.setAttribute('r', safeState === 'dead' ? '2' : '4');
  leftPupil.setAttribute('class', 'char-pupil');

  const rightPupil = document.createElementNS(SVG_NS, 'circle');
  rightPupil.setAttribute('cx', '75');
  rightPupil.setAttribute('cy', safeState === 'dead' ? '61' : '58');
  rightPupil.setAttribute('r', safeState === 'dead' ? '2' : '4');
  rightPupil.setAttribute('class', 'char-pupil');

  svg.append(leftEye, rightEye, leftPupil, rightPupil);

  // Слоти під майбутні аксесуари (голова, очі, шия, лапа)
  const slots = ['head', 'eyes', 'neck', 'paw'];
  for (const slotName of slots) {
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('data-slot', slotName);
    if (Array.isArray(accessories) && accessories.includes(slotName)) {
      g.setAttribute('data-equipped', 'true');
    }
    svg.appendChild(g);
  }

  wrap.appendChild(svg);
  return wrap;
}