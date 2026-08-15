const authPanel = document.querySelector('#auth-panel');
const authTabs = document.querySelectorAll('.auth-tab');
const authTitle = document.querySelector('#auth-title');
const authDescription = document.querySelector('#auth-description');
const authSubmit = document.querySelector('#auth-submit');
const nameField = document.querySelector('.name-field');
const passwordInput = document.querySelector('.password-field input');
const localAuth = document.querySelector('#local-auth');
const clerkAuth = document.querySelector('#clerk-auth');

function setMode(mode) {
  const signIn = mode === 'sign-in';
  document.title = signIn ? 'Sign in to CourseMaster' : 'Join CourseMaster';
  authTabs.forEach((tab) => {
    const active = tab.dataset.mode === mode;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
  });
  nameField.hidden = signIn;
  passwordInput.autocomplete = signIn ? 'current-password' : 'new-password';
  authTitle.textContent = signIn ? 'Welcome back' : 'Create your free account';
  authDescription.textContent = signIn
    ? 'Pick up your learning path exactly where you left off.'
    : 'Keep every learning path, practice result, and small win in one place.';
  authSubmit.innerHTML = signIn ? 'Sign in to CourseMaster <span>→</span>' : 'Create my account <span>→</span>';
  document.querySelector('#auth-switch').innerHTML = signIn
    ? 'New to CourseMaster? <button type="button" data-switch-mode="sign-up">Join free</button>'
    : 'Already learning with us? <button type="button" data-switch-mode="sign-in">Sign in instead</button>';
}

function currentMode() {
  return window.location.hash === '#sign-in' ? 'sign-in' : 'sign-up';
}

authTabs.forEach((tab) => tab.addEventListener('click', () => {
  window.location.hash = tab.dataset.mode;
}));

window.addEventListener('hashchange', () => setMode(currentMode()));
document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-switch-mode]');
  if (button) window.location.hash = button.dataset.switchMode;
});

document.querySelector('.password-toggle').addEventListener('click', (event) => {
  const shown = passwordInput.type === 'text';
  passwordInput.type = shown ? 'password' : 'text';
  event.currentTarget.textContent = shown ? 'Show' : 'Hide';
});

document.querySelector('#auth-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const button = authSubmit;
  button.innerHTML = 'Authentication will open with Clerk <span>→</span>';
  button.disabled = true;
  setTimeout(() => {
    button.disabled = false;
    setMode(currentMode());
  }, 1400);
});

async function mountClerk() {
  const publishableKey = window.COURSEMASTER_CLERK_PUBLISHABLE_KEY;
  if (!publishableKey) return;

  try {
    const script = document.createElement('script');
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.setAttribute('data-clerk-publishable-key', publishableKey);
    script.src = 'https://cdn.jsdelivr.net/npm/@clerk/clerk-js@5/dist/clerk.browser.js';
    document.head.append(script);
    await new Promise((resolve, reject) => { script.onload = resolve; script.onerror = reject; });
    await window.Clerk.load();
    authPanel.classList.add('clerk-live');
    const mount = () => {
      clerkAuth.innerHTML = '';
      if (currentMode() === 'sign-in') {
        window.Clerk.mountSignIn(clerkAuth, { signUpUrl: '#sign-up', afterSignInUrl: 'index.html' });
      } else {
        window.Clerk.mountSignUp(clerkAuth, { signInUrl: '#sign-in', afterSignUpUrl: 'index.html' });
      }
    };
    mount();
    window.addEventListener('hashchange', mount);
  } catch {
    localAuth.insertAdjacentHTML('afterbegin', '<p class="clerk-status">Clerk could not load, so the local preview is still available.</p>');
  }
}

setMode(currentMode());
mountClerk();
