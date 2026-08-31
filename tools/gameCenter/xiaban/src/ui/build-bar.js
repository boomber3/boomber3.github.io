// 道具栏（底部居中）：本局 Build 的方形卡片 + icon，品质色区分
// 增量渲染：仅新增道具卡弹入（从下方上升），已有卡片原位保留
import { state } from '../core/state.js';
import { ITEMS, ITEM_QUALITY } from '../systems/build.js';

const $buildBar = document.getElementById('buildBar');

function keyOf(b) { return b.id + '|' + b.quality; }

function updateBadge(card, n) {
  const old = card.querySelector('.bb-count');
  if (n > 1) {
    if (old) old.textContent = 'x' + n;
    else {
      const badge = document.createElement('span');
      badge.className = 'bb-count';
      badge.textContent = 'x' + n;
      card.appendChild(badge);
    }
  } else if (old) {
    old.remove();
  }
}

// 渲染道具栏：合并相同 (id, quality) 计数，每项一张品质色方形卡
function renderBuildBar() {
  const counts = {};
  for (const b of state.build) counts[keyOf(b)] = (counts[keyOf(b)] || 0) + 1;
  const cards = new Map();
  $buildBar.querySelectorAll('.bb-item').forEach(el => cards.set(el.dataset.key, el));
  // 移除已消失的道具
  for (const [key, el] of cards) {
    if (!(key in counts)) { el.remove(); cards.delete(key); }
  }
  // 更新 / 新增
  for (const [key, n] of Object.entries(counts)) {
    const [id, quality] = key.split('|');
    const it = ITEMS.find(i => i.id === id);
    if (!it) continue;
    const q = ITEM_QUALITY[quality] || ITEM_QUALITY.normal;
    let card = cards.get(key);
    if (card) {
      updateBadge(card, n);
      continue;
    }
    card = document.createElement('div');
    card.className = 'bb-item bb-new';
    card.dataset.key = key;
    card.style.background = q.color;
    card.title = it.name + ' · ' + q.name;
    card.innerHTML = '<img class="bb-ic" src="' + it.icon + '" alt="">';
    updateBadge(card, n);
    $buildBar.appendChild(card);
  }
}

export { renderBuildBar };