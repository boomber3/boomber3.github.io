import { PROGRESS_KEY } from '../systems/growth.js';
import { getJSON, setJSON, removeJSON } from '../utils/storage.js';
import { $settingsModal, $settingsBtn, $clearSaveBtn, $closeSettingsBtn, $endGameBtn, $volumeSlider, $volumeVal, $volumeMinus, $volumePlus, $volumeSteps, $langZhBtn, $langEnBtn, $confirmModal, $confirmTitle, $confirmMsg, $confirmYes, $confirmNo } from '../utils/dom.js';
import { setVolume } from '../systems/audio.js';
import { state } from '../core/state.js';
import { applyLanguage, currentLang, setLanguage, t } from '../i18n.js';

const SETTINGS_KEY = 'poop-run-settings';
let settings = { volume: 1, language: currentLang() };
try {
  const s = getJSON(SETTINGS_KEY, null);
  if (s) settings = { volume: 1, language: currentLang(), ...s };
} catch (e) {}

function saveSettings() {
  try { setJSON(SETTINGS_KEY, settings); } catch (e) {}
}

function volumeStep() {
  return Math.max(0, Math.min(10, Math.round(settings.volume * 10)));
}

function setVolumeStep(step) {
  settings.volume = Math.max(0, Math.min(10, step)) / 10;
  applyVolume();
  saveSettings();
}

function buildVolumeSteps() {
  if (!$volumeSteps || $volumeSteps.children.length) return;
  for (let i = 0; i < 10; i++) {
    const cell = document.createElement('span');
    cell.className = 'sm-cell';
    $volumeSteps.appendChild(cell);
  }
}

function applyVolume() {
  setVolume(settings.volume);
  if ($volumeSlider) $volumeSlider.value = Math.round(settings.volume * 100);
  if ($volumeVal) $volumeVal.textContent = `${volumeStep()}/10`;
  if ($volumeSteps) {
    [...$volumeSteps.children].forEach((cell, i) => {
      cell.classList.toggle('on', i < volumeStep());
    });
  }
}

function updateLanguageButtons() {
  const lang = currentLang();
  if ($langZhBtn) $langZhBtn.classList.toggle('on', lang === 'zh');
  if ($langEnBtn) $langEnBtn.classList.toggle('on', lang === 'en');
}

buildVolumeSteps();
applyVolume();
applyLanguage();
updateLanguageButtons();

if ($volumeSlider) {
  $volumeSlider.addEventListener('input', () => {
    setVolumeStep(Math.round(Number($volumeSlider.value) / 10));
  });
}
if ($volumeMinus) $volumeMinus.addEventListener('click', () => setVolumeStep(volumeStep() - 1));
if ($volumePlus) $volumePlus.addEventListener('click', () => setVolumeStep(volumeStep() + 1));
if ($langZhBtn) $langZhBtn.addEventListener('click', () => {
  settings.language = 'zh';
  setLanguage('zh');
  updateLanguageButtons();
});
if ($langEnBtn) $langEnBtn.addEventListener('click', () => {
  settings.language = 'en';
  setLanguage('en');
  updateLanguageButtons();
});

$settingsBtn.addEventListener('click', () => {
  $settingsModal.classList.remove('hidden');
  applyVolume();
  applyLanguage();
  updateLanguageButtons();
});

$closeSettingsBtn.addEventListener('click', () => $settingsModal.classList.add('hidden'));
$settingsModal.addEventListener('click', e => { if (e.target === $settingsModal) $settingsModal.classList.add('hidden'); });
addEventListener('keydown', e => { if (e.code === 'Escape') $settingsModal.classList.add('hidden'); });

function gameConfirm({ title = t('confirm'), msg = '', yesText = t('ok') } = {}) {
  return new Promise(resolve => {
    $confirmTitle.textContent = title;
    $confirmMsg.textContent = msg;
    $confirmYes.textContent = yesText;
    $confirmNo.textContent = t('cancel');
    $confirmModal.classList.remove('hidden');
    const done = ok => {
      $confirmModal.classList.add('hidden');
      $confirmYes.removeEventListener('click', onYes);
      $confirmNo.removeEventListener('click', onNo);
      $confirmModal.removeEventListener('click', onOverlay);
      resolve(ok);
    };
    const onYes = () => done(true);
    const onNo = () => done(false);
    const onOverlay = e => { if (e.target === $confirmModal) done(false); };
    $confirmYes.addEventListener('click', onYes);
    $confirmNo.addEventListener('click', onNo);
    $confirmModal.addEventListener('click', onOverlay);
  });
}

$clearSaveBtn.addEventListener('click', async () => {
  const ok = await gameConfirm({
    title: t('clearTitle'),
    msg: t('clearMsg'),
    yesText: t('clearYes'),
  });
  if (!ok) return;
  try { removeJSON(PROGRESS_KEY); } catch (e) {}
  location.reload();
});

$endGameBtn.addEventListener('click', async () => {
  const ok = await gameConfirm({
    title: t('endTitle'),
    msg: t('endMsg'),
    yesText: t('endYes'),
  });
  if (!ok) return;
  $settingsModal.classList.add('hidden');
  state.paused = false;
  if (state.phase === 'dying' || state.phase === 'over') return;
  if (state.phase === 'run') {
    state.lives = 1;
    state.shitting = false;
    state.fartFlying = false;
    state.buildup = false;
    const { doIncident } = await import('../systems/fart-qte.js');
    doIncident();
  } else {
    const { settleGame } = await import('../systems/session.js');
    settleGame(false);
  }
});
