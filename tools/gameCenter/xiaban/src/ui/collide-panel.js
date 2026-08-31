import { $collidePanel } from '../utils/dom.js';
import { camera } from '../core/engine.js';
import { spawnDebugBreakable } from '../world/breakables.js';
import { spawnDebugBird } from '../world/birds.js';
import { spawnDebugPlane } from '../world/planes.js';
import { spawnDebugAerial } from '../world/aerials.js';
import { spawnDebugGoose } from '../world/geese.js';
import { currentLang, onLanguageChange } from '../i18n.js';

const l = (zh, en) => currentLang() === 'en' ? en : zh;
const breakNames = () => [
  l('木箱', 'Crate'),
  l('木桶', 'Barrel'),
  l('石柱', 'Stone Pillar'),
  l('雕像', 'Statue'),
];

function makeBtn(key, name, fn, q = '') {
  const btn = document.createElement('button');
  btn.className = 'etp-btn';
  btn.innerHTML = `<span class="key">${key}</span><span class="name">${name}</span>${q ? `<span class="q">${q}</span>` : ''}`;
  btn.addEventListener('click', fn);
  return btn;
}

function buildCollidePanel() {
  const hint = $collidePanel.querySelector('.etp-hint');
  if (hint) hint.textContent = l('可碰撞物体测试 · 按 H 关闭', 'Collision Test · Press H to close');
  const box = $collidePanel.querySelector('.etp-btns');
  box.innerHTML = '';
  breakNames().forEach((name, k) => {
    box.appendChild(makeBtn('箱', `${name}${l('（可破坏）', ' (breakable)')}`, () => spawnDebugBreakable(camera.position.x + 4, k)));
  });
  box.appendChild(makeBtn('灯', l('随机交通物', 'Random Traffic Prop'), () => spawnDebugBreakable(camera.position.x + 4, 'traffic'), l('路上/路边可撞', 'road/curb can break')));
  box.appendChild(makeBtn('鸟', l('鸟（撞到惊飞）', 'Bird (startles away)'), () => spawnDebugBird()));
  box.appendChild(makeBtn('机', l('飞机（撞到击落）', 'Plane (shoot down)'), () => spawnDebugPlane(), l('原 Z 键', 'old Z key')));
  box.appendChild(makeBtn('U', 'UFO', () => spawnDebugAerial('ufo'), l('U 键', 'U key')));
  box.appendChild(makeBtn('Y', l('热气球', 'Hot Air Balloon'), () => spawnDebugAerial('balloon'), l('Y 键', 'Y key')));
  box.appendChild(makeBtn('O', l('大鹅（撞成羽毛）', 'Goose (feathers)'), () => spawnDebugGoose(), l('O 键', 'O key')));
}

function toggleCollidePanel(force) {
  const show = force !== undefined ? force : $collidePanel.classList.contains('hidden');
  $collidePanel.classList.toggle('hidden', !show);
  if (show) buildCollidePanel();
}

buildCollidePanel();
onLanguageChange(buildCollidePanel);
export { toggleCollidePanel };
