import { $propTestPanel } from '../utils/dom.js';
import { MID_KINDS, spawnPropAt } from '../world/props.js';
import { spawnFgPlant } from '../world/stage.js';
import { camera } from '../core/engine.js';
import { currentLang, onLanguageChange } from '../i18n.js';

const l = (zh, en) => currentLang() === 'en' ? en : zh;
const regionName = id => ({
  town: l('乡镇', 'Town'),
  city: l('城市', 'City'),
  wild: l('野外', 'Wild'),
}[id] || id);
const FG_PLANTS = [
  { id: 'flowersTall', zh: '高花', en: 'Tall Flowers' },
  { id: 'flowers', zh: '花', en: 'Flowers' },
  { id: 'grass', zh: '草', en: 'Grass' },
];

function makeBtn(icon, name, fn) {
  const btn = document.createElement('button');
  btn.className = 'etp-btn';
  btn.innerHTML = `<span class="dot" style="background:${icon}"></span><span class="name">${name}</span>`;
  btn.addEventListener('click', fn);
  return btn;
}

function addSection(box, name) {
  const title = document.createElement('div');
  title.className = 'etp-section';
  title.textContent = name;
  box.appendChild(title);
}

function buildModelTestPanel() {
  const hint = $propTestPanel.querySelector('.etp-hint');
  if (hint) hint.textContent = l('模型测试 · 按 F 关闭', 'Model Test · Press F to close');
  const box = $propTestPanel.querySelector('.etp-btns');
  box.innerHTML = '';
  addSection(box, l('前景植物', 'Foreground Plants'));
  for (const p of FG_PLANTS) {
    box.appendChild(makeBtn('#6b966b', currentLang() === 'en' ? p.en : p.zh, () => spawnFgPlant(p.id)));
  }
  const groups = {};
  for (const kind of MID_KINDS) {
    const r = kind.region || 'other';
    (groups[r] = groups[r] || []).push(kind);
  }
  for (const [region, kinds] of Object.entries(groups)) {
    addSection(box, `${regionName(region)} ${l('背景', 'Background')}`);
    for (const kind of kinds) {
      const short = kind.model.split('/').pop();
      box.appendChild(makeBtn('#c9a24a', `${short} (h${kind.h})`, () => spawnPropAt(kind, camera.position.x + 5)));
    }
  }
}

function togglePropTestPanel(force) {
  const show = force !== undefined ? force : $propTestPanel.classList.contains('hidden');
  $propTestPanel.classList.toggle('hidden', !show);
  if (show) buildModelTestPanel();
}

buildModelTestPanel();
onLanguageChange(buildModelTestPanel);
export { togglePropTestPanel };
