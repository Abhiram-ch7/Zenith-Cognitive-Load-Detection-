// Zenith — Onboarding & Greeting Flow
const { ipcRenderer } = require('electron');

let userName = '';

function getTimeGreeting() {
  return 'Hey';
}

const tips = [
  '💡 Press Ctrl+Shift+Z to toggle Zenith anytime',
  '🎯 Try the breathing exercise when feeling stressed',
  '🎵 Soothing music can help you focus better',
  '🧘 Take micro-breaks every 25 minutes for best results',
  '🔒 All your data stays local — 100% private',
];

async function initScreenFlow() {
  const onboarded = await ipcRenderer.invoke('store-get', 'onboardingComplete');
  userName = await ipcRenderer.invoke('store-get', 'userName') || '';
  const theme = await ipcRenderer.invoke('store-get', 'theme') || 'dark';
  document.body.dataset.theme = theme;

  if (!onboarded || !userName) {
    showOnboarding();
  } else {
    showGreeting();
  }
}

function showOnboarding() {
  document.getElementById('screen-onboarding').style.display = 'flex';
  document.getElementById('screen-greeting').style.display = 'none';
  document.getElementById('screen-app').style.display = 'none';

  const input = document.getElementById('input-name');
  const btn = document.getElementById('btn-get-started');

  input.addEventListener('input', () => {
    const v = input.value.trim();
    btn.disabled = v.length < 1;
  });

  btn.addEventListener('click', async () => {
    const name = input.value.trim();
    if (!name) return;
    userName = name;
    await ipcRenderer.invoke('store-set', 'userName', name);
    await ipcRenderer.invoke('store-set', 'onboardingComplete', true);
    
    const screen = document.getElementById('screen-onboarding');
    screen.style.animation = 'screen-exit 0.4s ease forwards';
    setTimeout(() => {
      screen.style.display = 'none';
      showGreeting();
    }, 380);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !btn.disabled) btn.click();
  });
}

async function showGreeting() {
  document.getElementById('screen-onboarding').style.display = 'none';
  const greetScreen = document.getElementById('screen-greeting');
  greetScreen.style.display = 'flex';
  greetScreen.style.animation = 'fadeIn 0.6s ease';
  document.getElementById('screen-app').style.display = 'none';

  document.getElementById('greeting-time-label').textContent = getTimeGreeting();
  document.getElementById('greeting-user').textContent = userName;
  document.getElementById('greeting-tip').innerHTML = tips[Math.floor(Math.random() * tips.length)];

  const sessions = await ipcRenderer.invoke('store-get', 'sessionsCount') || 0;
  const mins = await ipcRenderer.invoke('store-get', 'totalMinutes') || 0;
  const intv = await ipcRenderer.invoke('store-get', 'interventionsCompleted') || 0;
  document.getElementById('stat-sessions').textContent = sessions;
  document.getElementById('stat-minutes').textContent = mins;
  document.getElementById('stat-interventions').textContent = intv;

  if (sessions > 1) {
    document.getElementById('greeting-subtitle').textContent = 'Welcome back! Ready for a focused session?';
  }

  document.getElementById('btn-start-session').addEventListener('click', () => {
    greetScreen.style.animation = 'screen-exit 0.35s ease forwards';
    setTimeout(() => {
      greetScreen.style.display = 'none';
      launchMainApp();
    }, 340);
  });

  // Auto-launch after 2 seconds
  setTimeout(() => {
    if (greetScreen.style.display !== 'none') {
      document.getElementById('btn-start-session').click();
    }
  }, 2000);
}

function launchMainApp() {
  const appScreen = document.getElementById('screen-app');
  appScreen.style.display = 'flex';
  appScreen.style.animation = 'fadeIn 0.5s ease';

  const userEl = document.getElementById('titlebar-user');
  if (userEl) userEl.textContent = userName;

  const nameInput = document.getElementById('setting-name');
  if (nameInput) nameInput.value = userName;

  if (typeof window.onAppReady === 'function') window.onAppReady(userName);
}

function getUserName() { return userName; }

module.exports = { initScreenFlow, getUserName, launchMainApp };
