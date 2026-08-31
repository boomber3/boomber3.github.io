// 模块化重构：由 paper-theater-runner.html 拆出
import { CONFIG } from '../config.js';
import { state, addShake } from '../core/state.js';
import { $upgradeQte, $uqBar, $uqPointer, $uqTimer } from '../utils/dom.js';
import { ITEMS, ITEM_QUALITY, buildEffects, itemText, itemQDesc, qualityName } from './build.js';
import { saveProgress, updateExpUI } from './growth.js';
import { playFart } from './audio.js';
import { syncQteSpeed } from './fart-qte.js';
import { renderBuildBar } from '../ui/build-bar.js';
import { burstUIConfetti } from '../ui/confetti.js';

// ---------- 升级道具 QTE（横向三段 Bar + 指针扫动 + 品质层） ----------
// 升级后进入子弹时间并触发：随机生成 3 个(道具+独立品质)结果，占 Bar 左/中/右三区；
// 指针左右扫动，空格/点击锁定所在段 → 立即获得该(道具,品质)。
// 品质越高：效果越强 + 判定区越窄。同名道具可重复获得，不同品质同名可共存叠加 → 形成本局 Build。
const UPGRADE_QTE_AUTOLOCK = 10;   // 超过该秒数未按键 → 自动锁定当前段（防卡死）
function canUpgradeQteRun() {
  return state.phase === 'run' && !state.shitting && !state.buildup;
}
function cancelUpgradeQte() {
  state.upgradeQteActive = false;
  state.upgradeQte = null;
  state.upgradeQteInputLockT = 0;
  hideUpgradeQte();
  updateExpUI();   // 取消后刷新经验条（若无排队升级则恢复下一级进度）
}
function rollQuality() {
  const qs = Object.values(ITEM_QUALITY);
  const total = qs.reduce((s, q) => s + q.weight, 0);
  let r = Math.random() * total;
  for (const q of qs) { r -= q.weight; if (r <= 0) return q; }
  return qs[0];
}
function triggerUpgradeQte() {
  if (state.upgradeQteActive) return;            // 防止一次升级叠多次
  if (state.phase !== 'run') return;
  // 只在静止缓冲期弹出；非静止期先排队，等下次静止期
  if (state.qteStaticT > 0 && !state.qteStaticConsumed) {
    startUpgradeQte();
    state.qteStaticConsumed = true;
  } else {
    state.upgradeQtePending++;
  }
}
// 实际弹出升级道具 QTE（仅由静止缓冲期触发调用）
function startUpgradeQte() {
  if (state.upgradeQteActive) return;
  // 3 个独立 offer：道具随机（可重复），品质独立抽取；宽度归一化占满整条 Bar
  const drawn = [0, 1, 2].map(() => ({ item: ITEMS[(Math.random() * ITEMS.length) | 0], quality: rollQuality() }));
  const sum = drawn.reduce((s, d) => s + d.quality.width, 0) || 1;
  let acc = 0;
  const offers = drawn.map(d => {
    const w = d.quality.width / sum;
    const o = { item: d.item, quality: d.quality.key, x0: acc, x1: acc + w };
    acc += w;
    return o;
  });
  state.upgradeQte = { offers, pos: 0, dir: 1, speed: 1.1, autoT: 0, lastIdx: -1 };
  state.upgradeQteActive = true;
  state.upgradeQteInputLockT = 0.2;   // 开局 0.2s 输入拦截：刚弹出瞬间忽略锁定输入，防误触
  addShake(0.25);   // 升级：轻震
  showUpgradeQte(offers);
  saveProgress();
}
// 指针用真实时间扫动（子弹时间里世界变慢、准星正常），到端折返；超时自动锁定
function updateUpgradeQte(rawDt) {
  if (!canUpgradeQteRun()) {
    if (state.upgradeQteActive || state.upgradeQte) cancelUpgradeQte();
    return;
  }
  const u = state.upgradeQte;
  if (!u) return;
  if (state.upgradeQteInputLockT > 0) state.upgradeQteInputLockT = Math.max(0, state.upgradeQteInputLockT - rawDt);   // 拦截倒计时递减
  u.pos += u.dir * u.speed * rawDt;
  if (u.pos >= 1) { u.pos = 1; u.dir = -1; }
  else if (u.pos <= 0) { u.pos = 0; u.dir = 1; }
  u.autoT += rawDt;
  // 倒计时条：居中从两侧向中心收缩，颜色从绿渐变到红（时间越少越红）
  if ($uqTimer) {
    const k = Math.max(0, 1 - u.autoT / UPGRADE_QTE_AUTOLOCK);
    $uqTimer.style.transform = `scaleX(${k})`;
    $uqTimer.style.background = `hsl(${k * 120}, 80%, 52%)`;
  }
  if ($uqPointer) $uqPointer.style.left = (u.pos * 100) + '%';
  const idx = u.offers.findIndex(o => u.pos >= o.x0 && u.pos <= o.x1);
  if (idx !== u.lastIdx) setUqHighlight(idx);   // 指针进入新段 → 切换高亮
  if (u.autoT >= UPGRADE_QTE_AUTOLOCK) lockUpgradeQte();
}
// 切换高亮：指针当前所在的道具卡加亮（信息本身已内嵌在每张卡内）
function setUqHighlight(idx) {
  const u = state.upgradeQte;
  if (!u || idx < 0) return;
  if (u.lastIdx === idx) return;
  u.lastIdx = idx;
  const segs = $uqBar.querySelectorAll('.uq-seg');
  segs.forEach((el, i) => el.classList.toggle('hl', i === idx));
  // 光标扫入：弹跳 juice（动画结束移除类，避免再次进入不重放）
  const cur = segs[idx];
  if (cur) {
    cur.classList.remove('bb-hl-pop');
    void cur.offsetWidth;
    cur.classList.add('bb-hl-pop');
    cur.addEventListener('animationend', () => cur.classList.remove('bb-hl-pop'), { once: true });
  }
}
// 锁定：取指针所在段 → 获得该(道具,品质)，播选中动画后延迟关闭子弹时间
function lockUpgradeQte() {
  if (!state.upgradeQteActive) return;
  if (!canUpgradeQteRun()) {
    cancelUpgradeQte();
    return;
  }
  if (state.upgradeQteInputLockT > 0) return;   // 开局 0.2s 输入拦截：忽略锁定输入，防误触
  const u = state.upgradeQte;
  const seg = u.offers.find(o => u.pos >= o.x0 && u.pos <= o.x1) || u.offers[0];
  state.upgradeQteActive = false;
  state.upgradeQte = null;
  // 选中的卡片播放大 + 金光动画，动画结束后再缓出关闭弹窗
  const segEls = $uqBar.querySelectorAll('.uq-seg');
  const curEl = segEls[u.offers.indexOf(seg)];
  if (curEl) curEl.classList.add('bb-lock');
  // UI 层彩带：从选中卡片中心爆发（强化奖励感）
  const r = curEl ? curEl.getBoundingClientRect() : null;
  burstUIConfetti(r ? r.left + r.width / 2 : innerWidth / 2, r ? r.top + r.height / 2 : innerHeight / 2, 30, 1.1);
  setTimeout(() => {
    if (!canUpgradeQteRun()) {
      cancelUpgradeQte();
      return;
    }
    hideUpgradeQte();
    state.build.push({ id: seg.item.id, quality: seg.quality });
    buildEffects();
    renderBuildBar();
    updateExpUI();   // 获得道具后刷新经验条 → 恢复下一级进度
    // 一大块奶酪：获得时立即降低当前喷射概率
    if (seg.item.id === 'cheese') {
      const it = ITEMS.find(i => i.id === seg.item.id);
      const qm = ITEM_QUALITY[seg.quality].mul;
      state.cumRisk = Math.max(0, state.cumRisk - (it.apply.cheeseReduce || 0) * qm);
    }
    syncQteSpeed();
    playFart(1.1);
  }, 450);
}
// 显示/隐藏升级 QTE：三段道具卡由 offer 动态生成（宽度=品质判定区，信息内嵌），指针初始在左端
function showUpgradeQte(offers) {
  $uqBar.querySelectorAll('.uq-seg').forEach(el => el.remove());
  offers.forEach(o => {
    const q = ITEM_QUALITY[o.quality];
    const it = o.item;
    const seg = document.createElement('div');
    seg.className = 'uq-seg';
    seg.style.left = (o.x0 * 100) + '%';
    seg.style.width = ((o.x1 - o.x0) * 100) + '%';
    seg.style.background = q.color;
    seg.innerHTML =
      `<div class="uq-icon"><img src="${it.icon}" alt=""></div>` +
      `<div class="uq-name" style="color:${q.text}">${itemText(it, 'name')} <span class="uq-q" style="background:${q.text}">${qualityName(q)}</span></div>` +
      (itemQDesc(it, q.key) ? `<div class="uq-effect">${itemQDesc(it, q.key)}</div>` : '') +
      (itemText(it, 'flavor') ? `<div class="uq-flavor">${itemText(it, 'flavor')}</div>` : '');
    $uqBar.appendChild(seg);
  });
  $uqPointer.style.left = '0%';
  $upgradeQte.classList.remove('hidden');
  // QTE 条 juice 弹入：加动画类，播完移除避免下次残留
  $uqBar.classList.remove('bb-pop');
  void $uqBar.offsetWidth;   // 强制 reflow 重启动画
  $uqBar.classList.add('bb-pop');
  if (state.upgradeQte) state.upgradeQte.lastIdx = -1;
  setUqHighlight(0);   // 初始：指针在左端 → 第 1 张卡高亮
}
function hideUpgradeQte() {
  $upgradeQte.classList.add('hidden');
}

export { triggerUpgradeQte, startUpgradeQte, updateUpgradeQte, lockUpgradeQte, cancelUpgradeQte, hideUpgradeQte, showUpgradeQte };
