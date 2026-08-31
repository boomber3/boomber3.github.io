import { CONFIG } from '../config.js';
import { $eventTestPanel } from '../utils/dom.js';
import { debugTriggerQteOutcome } from '../systems/fart-qte.js';
import { triggerUpgradeQte } from '../systems/upgrade-qte.js';
import { currentLang, onLanguageChange, t } from '../i18n.js';

const l = (zh, en) => currentLang() === 'en' ? en : zh;
const qualityText = quality => quality >= 0.85 ? t('judge_perfect') : quality >= 0.6 ? t('judge_good') : quality >= 0.25 ? t('judge_ok') : t('judge_bad');
const outcomeName = ev => t(`outcome_${ev.id}`) || ev.label;

function setHint() {
  const hint = $eventTestPanel.querySelector('.etp-hint');
  if (hint) hint.textContent = l('放屁事件测试 · 按 D 关闭 · 点击触发', 'Fart Event Test · Press D to close · Click to trigger');
}

function buildEventTestPanel() {
  setHint();
  const box = $eventTestPanel.querySelector('.etp-btns');
  box.innerHTML = '';
  for (const ev of CONFIG.qte.pool) {
    const btn = document.createElement('button');
    btn.className = 'etp-btn';
    btn.innerHTML =
      `<span class="dot" style="background:${ev.color}"></span>` +
      `<span class="name">${outcomeName(ev)}</span>` +
      `<span class="q">${qualityText(ev.quality)}</span>`;
    btn.addEventListener('click', () => debugTriggerQteOutcome(ev.id));
    box.appendChild(btn);
  }
  const uq = document.createElement('button');
  uq.className = 'etp-btn primary';
  uq.innerHTML = `<span class="dot" style="background:#c9a24a"></span><span class="name">${t('upgradeQteTitle')}</span><span class="q">${l('触发', 'Trigger')}</span>`;
  uq.addEventListener('click', () => triggerUpgradeQte());
  box.appendChild(uq);
}

function toggleEventTestPanel(force) {
  const show = force !== undefined ? force : $eventTestPanel.classList.contains('hidden');
  $eventTestPanel.classList.toggle('hidden', !show);
  if (show) buildEventTestPanel();
}

buildEventTestPanel();
onLanguageChange(buildEventTestPanel);
export { toggleEventTestPanel };
