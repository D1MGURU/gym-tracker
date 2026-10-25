import { showToast } from './toast.js';

const HOLD_MS = 3000;
let dialogIdSeq = 0;
const activeDialogCleanups = new Set();

function normalizeText(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('uk');
}

function syncBodyScrollLock() {
  const root = document.getElementById('dialog-root');
  const hasOpenDialogs = Boolean(root && root.querySelector('.dialog-backdrop'));
  document.body.classList.toggle('dialog-open', hasOpenDialogs);
}

function getFocusableElements(container) {
  const nodes = container.querySelectorAll(
    'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [href], [tabindex]:not([tabindex="-1"])'
  );
  return Array.from(nodes).filter((el) => !el.classList.contains('hidden') && el.offsetParent !== null);
}

function trapTabKey(e, container) {
  if (e.key !== 'Tab') return;
  const focusables = getFocusableElements(container);
  if (focusables.length === 0) {
    e.preventDefault();
    return;
  }
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (e.shiftKey) {
    if (document.activeElement === first || !container.contains(document.activeElement)) {
      e.preventDefault();
      last.focus();
    }
  } else if (document.activeElement === last || !container.contains(document.activeElement)) {
    e.preventDefault();
    first.focus();
  }
}

function restorePreviousFocus(previousFocus) {
  if (
    previousFocus &&
    typeof previousFocus.focus === 'function' &&
    document.contains(previousFocus)
  ) {
    try {
      previousFocus.focus();
    } catch (_) {}
  }
}

export function closeAllDialogs() {
  for (const fn of Array.from(activeDialogCleanups)) {
    fn();
  }
  activeDialogCleanups.clear();
  const root = document.getElementById('dialog-root');
  if (root) root.replaceChildren();
  syncBodyScrollLock();
}

export function showConfirm({
  title = 'Підтвердження',
  message = '',
  confirmText = 'Підтвердити',
  cancelText = 'Скасувати',
  danger = false,
  requireText = null,
  requireTextPlaceholder = '',
  holdToConfirm = false,
  allowEitherHoldOrText = false,
  onConfirm = null
} = {}) {
  return new Promise((resolve) => {
    const root = document.getElementById('dialog-root');
    if (!root) {
      resolve(false);
      return;
    }

    const previousFocus = document.activeElement;
    const uid = ++dialogIdSeq;
    const titleId = `dialog-title-${uid}`;
    const descId = `dialog-desc-${uid}`;

    let isBusy = false;
    let holdTimer = null;
    let holdCompleted = false;
    let isKeyHolding = false;
    let closed = false;

    const backdrop = document.createElement('div');
    backdrop.className = 'dialog-backdrop';

    const box = document.createElement('div');
    box.className = 'dialog-box';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-labelledby', titleId);

    const titleEl = document.createElement('h2');
    titleEl.id = titleId;
    titleEl.textContent = title;
    box.appendChild(titleEl);

    if (message) {
      const msgEl = document.createElement('p');
      msgEl.id = descId;
      msgEl.textContent = message;
      box.setAttribute('aria-describedby', descId);
      box.appendChild(msgEl);
    }

    let textInput = null;
    if (requireText) {
      const inputWrap = document.createElement('div');
      inputWrap.className = 'stack-sm';

      const hint = document.createElement('small');
      hint.textContent = allowEitherHoldOrText
        ? `Введи «${requireText}» або утримуй кнопку 3 секунди:`
        : `Для підтвердження введи «${requireText}»:`;

      textInput = document.createElement('input');
      textInput.type = 'text';
      textInput.className = 'input';
      textInput.placeholder = requireTextPlaceholder || requireText;

      inputWrap.append(hint, textInput);
      box.appendChild(inputWrap);
    }

    const actions = document.createElement('div');
    actions.className = 'dialog-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-primary btn-block';
    cancelBtn.textContent = cancelText;

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = danger
      ? 'btn btn-danger-secondary btn-block'
      : 'btn btn-secondary btn-block';

    if (holdToConfirm) {
      confirmBtn.classList.add('btn-hold-target');
      confirmBtn.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    const confirmLabel = document.createElement('span');
    confirmBtn.appendChild(confirmLabel);

    let progressBar = null;
    if (holdToConfirm) {
      progressBar = document.createElement('span');
      progressBar.className = 'btn-hold-progress';
      confirmBtn.appendChild(progressBar);
    }

    function isTextMatched() {
      if (!requireText || !textInput) return true;
      return normalizeText(textInput.value) === normalizeText(requireText);
    }

    function getDefaultConfirmLabel() {
      if (holdToConfirm && !(allowEitherHoldOrText && isTextMatched())) {
        return `${confirmText} (утримуй 3 с)`;
      }
      return confirmText;
    }

    function resetHoldVisual() {
      if (holdTimer) {
        clearTimeout(holdTimer);
        holdTimer = null;
      }
      holdCompleted = false;
      isKeyHolding = false;
      if (progressBar) {
        progressBar.style.transitionDuration = 'var(--duration-fast)';
        progressBar.style.width = '0%';
      }
    }

    function updateConfirmState() {
      confirmLabel.textContent = getDefaultConfirmLabel();
      if (isBusy) {
        confirmBtn.disabled = true;
        cancelBtn.disabled = true;
        if (textInput) textInput.disabled = true;
        return;
      }
      cancelBtn.disabled = false;
      if (textInput) textInput.disabled = false;

      if (requireText && !holdToConfirm) {
        confirmBtn.disabled = !isTextMatched();
      } else {
        confirmBtn.disabled = false;
      }
    }

    if (textInput) {
      textInput.addEventListener('input', () => {
        updateConfirmState();
      });
    }

    function cleanup(result) {
      if (closed) return;
      closed = true;
      resetHoldVisual();
      window.removeEventListener('keydown', onKeyDown);
      activeDialogCleanups.delete(forceClose);
      backdrop.remove();
      syncBodyScrollLock();
      restorePreviousFocus(previousFocus);
      resolve(result);
    }

    function forceClose() {
      cleanup(false);
    }
    activeDialogCleanups.add(forceClose);

    async function executeConfirm() {
      if (isBusy || closed) return;
      if (requireText && !holdToConfirm && !isTextMatched()) return;
      if (allowEitherHoldOrText && !holdCompleted && !isTextMatched()) return;

      isBusy = true;
      confirmBtn.disabled = true;
      cancelBtn.disabled = true;
      if (textInput) textInput.disabled = true;
      confirmLabel.textContent = 'Зачекай...';

      try {
        if (typeof onConfirm === 'function') {
          await onConfirm();
        }
        cleanup(true);
      } catch (err) {
        isBusy = false;
        resetHoldVisual();
        updateConfirmState();
        showToast(err?.message || 'Помилка виконання дії', 'error');
        cancelBtn.focus();
      }
    }

    if (holdToConfirm) {
      const beginHold = () => {
        if (isBusy || closed) return;
        if (allowEitherHoldOrText && isTextMatched()) return;
        if (requireText && !allowEitherHoldOrText && !isTextMatched()) return;

        resetHoldVisual();
        if (progressBar) {
          progressBar.style.transitionDuration = `${HOLD_MS}ms`;
          progressBar.style.width = '100%';
        }

        holdTimer = setTimeout(() => {
          holdCompleted = true;
          executeConfirm();
        }, HOLD_MS);
      };

      const cancelHold = () => {
        if (holdCompleted || isBusy) return;
        resetHoldVisual();
      };

      confirmBtn.addEventListener('pointerdown', (e) => {
        if (e.button !== undefined && e.button !== 0) return;
        if (allowEitherHoldOrText && isTextMatched()) return;
        e.preventDefault();
        beginHold();
      });

      confirmBtn.addEventListener('pointerup', cancelHold);
      confirmBtn.addEventListener('pointerleave', cancelHold);
      confirmBtn.addEventListener('pointercancel', cancelHold);

      confirmBtn.addEventListener('keydown', (e) => {
        if (e.key !== ' ' && e.key !== 'Enter') return;
        if (allowEitherHoldOrText && isTextMatched()) {
          e.preventDefault();
          executeConfirm();
          return;
        }
        if (e.repeat) {
          e.preventDefault();
          return;
        }
        e.preventDefault();
        if (!isKeyHolding) {
          isKeyHolding = true;
          beginHold();
        }
      });

      confirmBtn.addEventListener('keyup', (e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          cancelHold();
        }
      });

      confirmBtn.addEventListener('blur', cancelHold);

      confirmBtn.addEventListener('click', () => {
        if (allowEitherHoldOrText && isTextMatched()) {
          executeConfirm();
        }
      });
    } else {
      confirmBtn.addEventListener('click', () => {
        executeConfirm();
      });
    }

    cancelBtn.addEventListener('click', () => {
      if (!isBusy) cleanup(false);
    });

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop && !danger && !isBusy) {
        cleanup(false);
      }
    });

    function onKeyDown(e) {
      if (e.key === 'Escape' && !isBusy) {
        e.preventDefault();
        cleanup(false);
        return;
      }
      trapTabKey(e, box);
    }

    window.addEventListener('keydown', onKeyDown);

    actions.append(cancelBtn, confirmBtn);
    box.appendChild(actions);
    backdrop.appendChild(box);
    root.appendChild(backdrop);

    syncBodyScrollLock();
    updateConfirmState();
    cancelBtn.focus();
  });
}

export function showCustomDialog({ title, description = '', renderBody }) {
  const root = document.getElementById('dialog-root');
  if (!root) return;

  const previousFocus = document.activeElement;
  const uid = ++dialogIdSeq;
  const titleId = `custom-dialog-title-${uid}`;
  const descId = `custom-dialog-desc-${uid}`;
  let closed = false;

  const backdrop = document.createElement('div');
  backdrop.className = 'dialog-backdrop';

  const box = document.createElement('div');
  box.className = 'dialog-box';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-labelledby', titleId);

  const header = document.createElement('div');
  header.className = 'row-between';

  const titleEl = document.createElement('h2');
  titleEl.id = titleId;
  titleEl.textContent = title;

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'btn btn-primary';
  closeBtn.textContent = 'Закрити';

  function close() {
    if (closed) return;
    closed = true;
    window.removeEventListener('keydown', onKeyDown);
    activeDialogCleanups.delete(close);
    backdrop.remove();
    syncBodyScrollLock();
    restorePreviousFocus(previousFocus);
  }

  activeDialogCleanups.add(close);

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    trapTabKey(e, box);
  }

  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });
  window.addEventListener('keydown', onKeyDown);

  header.append(titleEl, closeBtn);
  box.appendChild(header);

  const bodyEl = document.createElement('div');
  bodyEl.id = descId;
  bodyEl.className = 'stack-md';
  box.setAttribute('aria-describedby', descId);

  if (description) {
    const descEl = document.createElement('p');
    descEl.textContent = description;
    bodyEl.appendChild(descEl);
  }

  if (typeof renderBody === 'function') {
    renderBody(bodyEl, close);
  }

  box.appendChild(bodyEl);
  backdrop.appendChild(box);
  root.appendChild(backdrop);

  syncBodyScrollLock();
  closeBtn.focus();
}
