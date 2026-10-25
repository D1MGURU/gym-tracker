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
    if (!root) return resolve(false);

    let isBusy = false;
    let holdTimer = null;
    let holdCompleted = false;

    const backdrop = document.createElement('div');
    backdrop.className = 'dialog-backdrop';

    const box = document.createElement('div');
    box.className = 'dialog-box';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');

    const titleEl = document.createElement('h2');
    titleEl.textContent = title;
    box.appendChild(titleEl);

    if (message) {
      const msgEl = document.createElement('p');
      msgEl.textContent = message;
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

    // Безпечна дія (залишитись / скасувати) — візуально ГОЛОВНА
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-primary btn-block';
    cancelBtn.textContent = cancelText;

    // Підтвердження (другорядна червона для danger)
    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = danger
      ? 'btn btn-danger-secondary btn-block'
      : 'btn btn-secondary btn-block';

    const confirmLabel = document.createElement('span');
    confirmLabel.textContent = holdToConfirm ? `${confirmText} (утримуй 3 с)` : confirmText;
    confirmBtn.appendChild(confirmLabel);

    let progressBar = null;
    if (holdToConfirm) {
      progressBar = document.createElement('span');
      progressBar.className = 'btn-hold-progress';
      confirmBtn.appendChild(progressBar);
    }

    function isTextMatched() {
      if (!requireText || !textInput) return true;
      return textInput.value.trim() === requireText;
    }

    function updateConfirmState() {
      if (isBusy) {
        confirmBtn.disabled = true;
        cancelBtn.disabled = true;
        return;
      }
      if (requireText && !holdToConfirm) {
        confirmBtn.disabled = !isTextMatched();
      }
    }

    if (textInput) {
      textInput.addEventListener('input', () => {
        if (allowEitherHoldOrText && isTextMatched()) {
          confirmLabel.textContent = confirmText;
        }
        updateConfirmState();
      });
    }

    function cleanup(result) {
      if (holdTimer) clearTimeout(holdTimer);
      window.removeEventListener('keydown', onKeyDown);
      backdrop.remove();
      resolve(result);
    }

    async function executeConfirm() {
      if (isBusy) return;
      if (requireText && !holdToConfirm && !isTextMatched()) return;
      if (allowEitherHoldOrText && !holdCompleted && !isTextMatched()) return;

      isBusy = true;
      confirmBtn.disabled = true;
      cancelBtn.disabled = true;
      confirmLabel.textContent = 'Зачекай...';

      try {
        if (typeof onConfirm === 'function') {
          await onConfirm();
        }
        cleanup(true);
      } catch (err) {
        isBusy = false;
        cleanup(false);
        throw err;
      }
    }

    // Логіка утримання 3 секунди (holdToConfirm)
    if (holdToConfirm) {
      const startHold = (e) => {
        if (isBusy) return;
        if (allowEitherHoldOrText && isTextMatched()) return;
        if (requireText && !allowEitherHoldOrText && !isTextMatched()) return;
        e.preventDefault();

        holdCompleted = false;
        if (progressBar) {
          progressBar.style.transitionDuration = 'var(--duration-hold)';
          progressBar.style.width = '100%';
        }

        holdTimer = setTimeout(() => {
          holdCompleted = true;
          executeConfirm();
        }, 3000);
      };

      const cancelHold = () => {
        if (holdCompleted || isBusy) return;
        if (holdTimer) {
          clearTimeout(holdTimer);
          holdTimer = null;
        }
        if (progressBar) {
          progressBar.style.transitionDuration = 'var(--duration-fast)';
          progressBar.style.width = '0%';
        }
      };

      confirmBtn.addEventListener('pointerdown', startHold);
      confirmBtn.addEventListener('pointerup', cancelHold);
      confirmBtn.addEventListener('pointerleave', cancelHold);
      confirmBtn.addEventListener('pointercancel', cancelHold);

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

    // Клік на фон закриває лише НЕ-danger діалоги
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop && !danger && !isBusy) {
        cleanup(false);
      }
    });

    function onKeyDown(e) {
      if (e.key === 'Escape' && !isBusy) {
        cleanup(false);
      }
    }

    window.addEventListener('keydown', onKeyDown);

    actions.append(cancelBtn, confirmBtn);
    box.appendChild(actions);
    backdrop.appendChild(box);
    root.appendChild(backdrop);

    updateConfirmState();
    // Фокус завжди на безпечній кнопці
    cancelBtn.focus();
  });
}

// Допоміжний діалог з довільним DOM-вмістом (для «Додати пару»)
export function showCustomDialog({ title, renderBody }) {
  const root = document.getElementById('dialog-root');
  if (!root) return;

  const backdrop = document.createElement('div');
  backdrop.className = 'dialog-backdrop';

  const box = document.createElement('div');
  box.className = 'dialog-box';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');

  const header = document.createElement('div');
  header.className = 'row-between';

  const titleEl = document.createElement('h2');
  titleEl.textContent = title;

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'btn btn-outline';
  closeBtn.textContent = 'Закрити';

  function close() {
    window.removeEventListener('keydown', onKey);
    backdrop.remove();
  }

  function onKey(e) {
    if (e.key === 'Escape') close();
  }

  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });
  window.addEventListener('keydown', onKey);

  header.append(titleEl, closeBtn);
  box.appendChild(header);

  const bodyEl = document.createElement('div');
  bodyEl.className = 'stack-md';
  renderBody(bodyEl, close);
  box.appendChild(bodyEl);

  backdrop.appendChild(box);
  root.appendChild(backdrop);
  closeBtn.focus();
}