import { $foodEventPanel } from '../utils/dom.js';
import { FOOD_EVENTS, eventText } from '../systems/event.js';
import { restartWithFoodEvent } from '../systems/session.js';
import { state } from '../core/state.js';
import { currentLang, onLanguageChange } from '../i18n.js';

const EVENT_COLORS = ['#ffd24a', '#ff6d45', '#54dd62', '#46b7ff', '#d66bff', '#f6e8cf'];
const l = (zh, en) => currentLang() === 'en' ? en : zh;

function makeBtn({ key, name, q, color, className = '', onClick }) {
  const btn = document.createElement('button');
  btn.className = `etp-btn ${className}`.trim();
  btn.innerHTML =
    `<span class="key">${key}</span>` +
    `<span class="name">${name}</span>` +
    `<span class="q">${q}</span>`;
  if (color) btn.querySelector('.key').style.background = color;
  btn.addEventListener('click', onClick);
  return btn;
}

function startTestRun(eventId) {
  $foodEventPanel.classList.add('hidden');
  restartWithFoodEvent(eventId);
}

function setHint() {
  const hint = $foodEventPanel.querySelector('.etp-hint');
  if (hint) hint.textContent = l('开局事件控制台 · 按 K 关闭 · 点击后立即重开', 'Opening Incident Console · Press K to close · Click to restart');
}

function updateStatus() {
  const el = $foodEventPanel.querySelector('.food-event-status');
  if (!el) return;
  el.textContent = l('当前：', 'Current: ') + (state.activeFoodEvent
    ? `${state.activeFoodEvent.no}《${eventText(state.activeFoodEvent, 'title')}》`
    : l('无开局事件', 'No opening incident'));
}

function buildFoodEventPanel() {
  setHint();
  const box = $foodEventPanel.querySelector('.etp-btns');
  box.innerHTML = '';
  const status = document.createElement('div');
  status.className = 'food-event-status etp-section';
  box.appendChild(status);
  box.appendChild(makeBtn({
    key: '?',
    name: l('随机今日事件重开', 'Restart With Random Incident'),
    q: l('随机', 'random'),
    color: '#f2c06a',
    className: 'primary',
    onClick: () => startTestRun('random'),
  }));
  box.appendChild(makeBtn({
    key: '0',
    name: l('无事件重开', 'Restart Clean'),
    q: l('干净', 'clean'),
    color: '#8a8a9a',
    className: 'no-event',
    onClick: () => startTestRun(null),
  }));
  const title = document.createElement('div');
  title.className = 'etp-section';
  title.textContent = l('指定食品安全事件', 'Pick Food Safety Incident');
  box.appendChild(title);
  FOOD_EVENTS.slice().sort((a, b) => String(a.no).localeCompare(String(b.no))).forEach((ev, i) => {
    box.appendChild(makeBtn({
      key: ev.no,
      name: eventText(ev, 'title'),
      q: eventText(ev, 'effectName'),
      color: EVENT_COLORS[i % EVENT_COLORS.length],
      onClick: () => startTestRun(ev.id),
    }));
  });
  updateStatus();
}

function toggleFoodEventPanel(force) {
  const show = force !== undefined ? force : $foodEventPanel.classList.contains('hidden');
  $foodEventPanel.classList.toggle('hidden', !show);
  if (show) buildFoodEventPanel();
}

buildFoodEventPanel();
onLanguageChange(buildFoodEventPanel);
export { toggleFoodEventPanel };
