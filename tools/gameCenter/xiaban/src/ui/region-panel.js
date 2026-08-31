import { $regionPanel } from '../utils/dom.js';
import { CONFIG } from '../config.js';
import { state } from '../core/state.js';
import { getRegionId, refreshProps } from '../world/props.js';
import { currentLang, onLanguageChange } from '../i18n.js';

const l = (zh, en) => currentLang() === 'en' ? en : zh;
const regionName = id => ({
  town: l('乡镇', 'Town'),
  city: l('城市', 'City'),
  wild: l('野外', 'Wild'),
}[id] || id);

function regionDistStart(id) {
  const R = CONFIG.regions;
  let acc = 0;
  for (const rid of R.order) {
    if (rid === id) return acc + 5;
    acc += R[rid].dist;
  }
  return 5;
}

function updateCur() {
  const el = $regionPanel.querySelector('.rgn-cur');
  if (el) el.textContent = l('当前地区：', 'Current Region: ') + regionName(getRegionId(state.dist));
}

function buildRegionPanel() {
  const hint = $regionPanel.querySelector('.etp-hint');
  if (hint) hint.textContent = l('地区切换 · 按 G 关闭', 'Region Switch · Press G to close');
  const box = $regionPanel.querySelector('.etp-btns');
  box.innerHTML = '';
  const cur = document.createElement('div');
  cur.className = 'rgn-cur etp-section';
  box.appendChild(cur);
  for (const id of CONFIG.regions.order) {
    const btn = document.createElement('button');
    btn.className = 'etp-btn';
    btn.innerHTML = `<span class="key">→</span><span class="name">${regionName(id)}</span><span class="q">${CONFIG.regions[id].dist}m</span>`;
    btn.addEventListener('click', () => {
      state.dist = regionDistStart(id);
      refreshProps();
      updateCur();
    });
    box.appendChild(btn);
  }
  updateCur();
}

function toggleRegionPanel(force) {
  const show = force !== undefined ? force : $regionPanel.classList.contains('hidden');
  $regionPanel.classList.toggle('hidden', !show);
  if (show) buildRegionPanel();
}

buildRegionPanel();
onLanguageChange(buildRegionPanel);
export { toggleRegionPanel };
