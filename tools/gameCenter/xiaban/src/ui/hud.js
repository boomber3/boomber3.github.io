import { CONFIG } from '../config.js';
import { state } from '../core/state.js';
import { $livesBar, $lifeTip, $diaperBar } from '../utils/dom.js';
import { t } from '../i18n.js';

function updateLivesUI() {
  state.livesDrop = { index: state.lives, t: 0 };
}

function renderDiaperBar() {
  if (!$diaperBar) return;
  const n = Math.max(0, state.protects | 0);
  $diaperBar.classList.toggle('on', n > 0);
  if ($diaperBar.dataset.count === String(n)) return;
  $diaperBar.dataset.count = String(n);
  $diaperBar.innerHTML = '';
  for (let i = 0; i < n; i++) {
    const el = document.createElement('div');
    el.className = 'diaper-item';
    el.innerHTML = '<img src="assets/items/diaper.png" alt="">';
    $diaperBar.appendChild(el);
  }
}

function getLifeSegments(count, totalH) {
  const gap = count > 1 ? 1 : 0;
  const usable = Math.max(1, totalH - gap * (count - 1));
  const pattern = [1.28, 0.82, 1.08, 1.38, 0.74, 1.16, 0.9, 1.24, 0.78, 1.04, 1.32, 0.86];
  const weights = Array.from({ length: count }, (_, i) => pattern[i % pattern.length]);
  const total = weights.reduce((sum, n) => sum + n, 0);
  const sizes = weights.map(n => Math.max(3, Math.floor(usable * n / total)));
  let diff = usable - sizes.reduce((sum, n) => sum + n, 0);
  for (let i = 0; diff !== 0 && i < sizes.length * 4; i++) {
    const index = i % sizes.length;
    if (diff > 0) {
      sizes[index]++;
      diff--;
    } else if (sizes[index] > 3) {
      sizes[index]--;
      diff++;
    }
  }
  let y = 0;
  return sizes.map((h, i) => {
    const seg = { y, h };
    y += h + (i === sizes.length - 1 ? 0 : gap);
    return seg;
  });
}

function drawLifeSegment(ctx, x, y, w, h, i, alive, alpha = 1) {
  const midTint = alive ? (i % 2 ? '#7a5230' : '#865d36') : '#2d221d';
  const hiTint = alive ? '#a97a49' : '#46342a';
  const lowTint = alive ? '#553521' : '#211915';
  ctx.globalAlpha = alpha;
  for (let row = 0; row < h; row++) {
    const cap = Math.max(0, 2 - row, 2 - (h - 1 - row));
    const wobbleL = ((row + i * 2) % 5 === 0 && row > 1 && row < h - 2) ? 1 : 0;
    const wobbleR = ((row + i * 3) % 7 === 0 && row > 1 && row < h - 2) ? 1 : 0;
    const left = x + cap + wobbleL;
    const right = x + w - cap - wobbleR;
    if (right <= left) continue;
    ctx.fillStyle = midTint;
    ctx.fillRect(left, y + row, right - left, 1);
    if (alive && row > 1 && row < h - 1) {
      ctx.fillStyle = hiTint;
      ctx.fillRect(left + 1, y + row, 1, 1);
      if ((row + i) % 3 === 0 && right - left > 5) ctx.fillRect(left + 2, y + row, 1, 1);
    }
    if (row > 0 && row < h - 1) {
      ctx.fillStyle = lowTint;
      ctx.fillRect(right - 1, y + row, 1, 1);
    }
  }
  ctx.globalAlpha = 1;
}

function drawLivesBar(dt) {
  const ctx = $livesBar.getContext('2d');
  const W = 10, H = 50;
  const maxLives = CONFIG.run.lives + state.eff.capacity;
  const segments = getLifeSegments(maxLives, H);
  ctx.clearRect(0, 0, W, H);
  renderDiaperBar();
  if (state.livesDrop) {
    state.livesDrop.t += dt;
    if (state.livesDrop.t > 1.2) state.livesDrop = null;
  }
  for (let i = 0; i < maxLives; i++) {
    const seg = segments[i];
    const alive = i < state.lives;
    drawLifeSegment(ctx, 1, seg.y, W - 2, seg.h, i, alive, alive ? 1 : 0.42);
  }
  if (state.livesDrop) {
    const d = state.livesDrop;
    const seg = segments[d.index];
    if (!seg) return;
    const off = Math.min(H, Math.round(d.t * 55));
    drawLifeSegment(ctx, 1, seg.y + off, W - 2, seg.h, d.index, true, Math.max(0, 1 - d.t * 0.9));
  }
}

function showLifeTip(left) {
  const maxLives = CONFIG.run.lives + state.eff.capacity;
  $lifeTip.textContent = t('lifeTip', { left, max: maxLives });
  $lifeTip.style.opacity = 1;
  clearTimeout(showLifeTip._t);
  showLifeTip._t = setTimeout(() => $lifeTip.style.opacity = 0, 1300);
}

export { drawLivesBar, updateLivesUI, showLifeTip, renderDiaperBar };
