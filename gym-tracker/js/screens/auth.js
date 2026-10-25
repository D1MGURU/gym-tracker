import { api } from '../api.js';
import { state, refreshStatus } from '../state.js';
import { renderCharacter } from '../character.js';
import { showToast } from '../ui/toast.js';

export function renderAuthScreen(mountEl) {
  mountEl.replaceChildren();

  const card = document.createElement('section');
  card.className = 'card card-centered';

  card.appendChild(renderCharacter({ state: 'goal_met', size: 'md' }));

  const title = document.createElement('h1');
  title.textContent = 'Gym Streak';

  const sub = document.createElement('p');
  sub.textContent = 'Ходи в зал регулярно та тримай свій вогник';

  const form = document.createElement('div');
  form.className = 'stack-md';
  form.style.width = '100%';

  const emailInput = document.createElement('input');
  emailInput.type = 'email';
  emailInput.className = 'input';
  emailInput.placeholder = 'Email (name@example.com)';

  const passInput = document.createElement('input');
  passInput.type = 'password';
  passInput.className = 'input';
  passInput.placeholder = 'Пароль (мінімум 6 символів)';

  const loginBtn = document.createElement('button');
  loginBtn.type = 'button';
  loginBtn.className = 'btn btn-primary btn-block';
  loginBtn.textContent = 'Увійти';

  const signupBtn = document.createElement('button');
  signupBtn.type = 'button';
  signupBtn.className = 'btn btn-secondary btn-block';
  signupBtn.textContent = 'Зареєструватися';

  async function handleAuth(mode) {
    const email = emailInput.value.trim();
    const password = passInput.value;
    if (!email || password.length < 6) {
      showToast('Введи коректний email та пароль (від 6 символів)', 'error');
      return;
    }

    loginBtn.disabled = true;
    signupBtn.disabled = true;
    try {
      if (mode === 'login') {
        await api.signIn(email, password);
        showToast('З поверненням!', 'success');
      } else {
        await api.signUp(email, password);
        showToast('Акаунт створено!', 'success');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      loginBtn.disabled = false;
      signupBtn.disabled = false;
    }
  }

  loginBtn.addEventListener('click', () => handleAuth('login'));
  signupBtn.addEventListener('click', () => handleAuth('signup'));

  form.append(emailInput, passInput, loginBtn, signupBtn);
  card.append(title, sub, form);
  mountEl.appendChild(card);
}

export function renderNameOnboarding(mountEl, onComplete) {
  mountEl.replaceChildren();

  const card = document.createElement('section');
  card.className = 'card card-centered';

  const title = document.createElement('h2');
  title.textContent = 'Як тебе звати? 👋';

  const sub = document.createElement('p');
  sub.textContent = "Це ім'я бачитиме твій партнер у спільному режимі (до 24 символів)";

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'input';
  input.maxLength = 24;
  input.placeholder = 'Наприклад: Дмитро';

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'btn btn-primary btn-block';
  saveBtn.textContent = "Зберегти ім'я";

  saveBtn.addEventListener('click', async () => {
    const name = input.value.trim();
    if (!name) {
      showToast("Введи своє ім'я", 'error');
      return;
    }
    saveBtn.disabled = true;
    try {
      await api.updateProfileFields(state.user.id, { display_name: name });
      await refreshStatus();
      showToast("Ім'я збережено!", 'success');
      if (typeof onComplete === 'function') onComplete();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      saveBtn.disabled = false;
    }
  });

  card.append(title, sub, input, saveBtn);
  mountEl.appendChild(card);
}