import { $itemPanel } from '../utils/dom.js';
import { ITEMS, ONETIME_ITEMS, ITEM_QUALITY, buildEffects, itemText, qualityName } from '../systems/build.js';
import { state } from '../core/state.js';
import { CONFIG } from '../config.js';
import { renderBuildBar } from './build-bar.js';
import { syncQteSpeed } from '../systems/fart-qte.js';
import { updateLivesUI, renderDiaperBar } from './hud.js';
import { currentLang, onLanguageChange } from '../i18n.js';

const l = (zh, en) => currentLang() === 'en' ? en : zh;

function pickQuality() {
  const qs = Object.values(ITEM_QUALITY);
  const total = qs.reduce((s, q) => s + q.weight, 0);
  let r = Math.random() * total;
  for (const q of qs) { r -= q.weight; if (r <= 0) return q.key; }
  return 'normal';
}

function updateStatus() {
  const el = $itemPanel.querySelector('.itm-status');
  if (!el) return;
  el.innerHTML = `${l('Build：', 'Build: ')}` + (state.build.length
    ? state.build.map(b => {
        const it = ITEMS.find(i => i.id === b.id);
        const q = ITEM_QUALITY[b.quality];
        return it ? `<img class="st-ic" src="${it.icon}" alt="">${qualityName(q)}` : '?';
      }).join(' ')
    : l('无', 'None')) + ` · ${l('保护次数：', 'Protects: ')}${state.protects}`;
}

function applyOneTime(o) {
  if (o.oneTime === 'lives') {
    const cap = CONFIG.run.lives + state.eff.capacity;
    if (state.lives < cap) { state.lives++; updateLivesUI(); }
  } else if (o.oneTime === 'protect') {
    state.protects++;
    renderDiaperBar();
  }
  updateStatus();
}

function addItem(id) {
  const oneTime = ONETIME_ITEMS.find(i => i.id === id);
  if (oneTime) { applyOneTime(oneTime); return; }
  const quality = pickQuality();
  state.build.push({ id, quality });
  buildEffects();
  renderBuildBar();
  if (id === 'cheese') {
    const it = ITEMS.find(i => i.id === id);
    state.cumRisk = Math.max(0, state.cumRisk - (it.apply.cheeseReduce || 0) * ITEM_QUALITY[quality].mul);
  }
  syncQteSpeed();
  updateStatus();
}

function makeBtn(icon, name, fn) {
  const btn = document.createElement('button');
  btn.className = 'etp-btn';
  btn.innerHTML = `<span class="key"><img src="${icon}" alt=""></span><span class="name">${name}</span>`;
  btn.addEventListener('click', fn);
  return btn;
}

function addSection(box, name) {
  const title = document.createElement('div');
  title.className = 'etp-section';
  title.textContent = name;
  box.appendChild(title);
}

function buildItemPanel() {
  const hint = $itemPanel.querySelector('.etp-hint');
  if (hint) hint.textContent = l('道具调试 · 按 J 关闭 · 点击添加随机品质', 'Item Debug · Press J to close · Click to add random quality');
  const box = $itemPanel.querySelector('.etp-btns');
  box.innerHTML = '';
  const st = document.createElement('div');
  st.className = 'itm-status etp-section';
  box.appendChild(st);
  addSection(box, l('升级道具（随机品质）', 'Upgrade Items (random quality)'));
  for (const it of ITEMS) {
    box.appendChild(makeBtn(it.icon, itemText(it, 'name'), () => addItem(it.id)));
  }
  addSection(box, l('一次性道具（立即生效）', 'One-shot Items (instant)'));
  for (const o of ONETIME_ITEMS) {
    box.appendChild(makeBtn(o.icon, itemText(o, 'name'), () => applyOneTime(o)));
  }
  updateStatus();
}

function toggleItemPanel(force) {
  const show = force !== undefined ? force : $itemPanel.classList.contains('hidden');
  $itemPanel.classList.toggle('hidden', !show);
  if (show) buildItemPanel();
}

buildItemPanel();
onLanguageChange(buildItemPanel);
export { toggleItemPanel };
