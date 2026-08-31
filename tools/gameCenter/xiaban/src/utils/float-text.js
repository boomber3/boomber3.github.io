// 模块化重构：由 paper-theater-runner.html 拆出
import { worldToScreen } from '../core/camera.js';
import { playExpPickup } from '../systems/audio.js';

// 数字飘字层（+N 经验飘字）
const floatLayer = document.createElement('div');
floatLayer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:15;';
document.body.appendChild(floatLayer);
const floatTexts = [];
for (let i = 0; i < 8; i++) {
  const el = document.createElement('div');
  el.style.cssText = [
    'position:absolute;',
    'font-family:"ChillBitmap","Courier New",monospace;font-weight:bold;',
    'color:#ffe08a;',
    'font-size:60px;',
    'text-shadow:6px 6px 0 #1a0e18;',
    'opacity:0;',
    'transform:translate(-50%,-50%);',
    'transition:opacity .35s;',
  ].join('');
  floatLayer.appendChild(el);
  floatTexts.push({ el, life: 0, x: 0, y: 0 });
}
function spawnFloatText(x, y, text) {
  const ft = floatTexts.find(f => f.life <= 0);
  if (!ft) return;
  ft.life = 0.9;
  ft.x = x; ft.y = y;
  ft.el.textContent = text;
  ft.el.style.left = x + 'px';
  ft.el.style.top = (y - 440) + 'px';   // 整体上移，避免偏低遮挡
  ft.el.style.opacity = 1;
  playExpPickup();
}

export { floatTexts, spawnFloatText };