// 模块化重构：由 paper-theater-runner.html 拆出
import { CONFIG } from '../config.js';
import { $expFill, $expBar } from '../utils/dom.js';
import { getJSON, setJSON } from '../utils/storage.js';
import { state } from '../core/state.js';
import { bus } from '../utils/bus.js';

// ---------- 局外成长（localStorage 跨局保存） ----------
const PROGRESS_KEY = 'poop-run-progress';
function loadProgress() {
  try {
    const p = getJSON(PROGRESS_KEY, null);
    if (p) {
      return {
        days: p.days || 0,
        bestDist: p.bestDist || 0,
        exhaustExp: 0,        // 等级经验每局重置，不跨局累计
        bodyLevel: 0,
      };
    }
  } catch (e) {}
  return { days: 0, bestDist: 0, exhaustExp: 0, bodyLevel: 0 };
}
function saveProgress() {
  try { setJSON(PROGRESS_KEY, progress); } catch (e) {}
}
let progress = loadProgress();

// 升级门槛：首级 expBase，之后按 expBase + expGrowth × lv^expPow（亚线性，后期增速放缓）
function expNeeded(lv) { return CONFIG.qte.expBase + CONFIG.qte.expGrowth * Math.pow(lv, CONFIG.qte.expPow); }
// 由累计经验反解当前等级 + 本等级内进度
function expToLevel(exp) {
  let lv = 0;
  while (exp >= expNeeded(lv) && lv < 999) { exp -= expNeeded(lv); lv++; }
  return { lv, cur: exp, need: expNeeded(lv) };
}
progress.bodyLevel = expToLevel(progress.exhaustExp).lv;
// 经验条强调动画：弹跳缩放 + 闪白（满格获取经验时也播放）
function playExpFeedback() {
  const track = $expBar.querySelector('.exp-track');
  if (track) {
    track.classList.remove('exp-pop', 'exp-flash');
    void track.offsetWidth;
    track.classList.add('exp-pop', 'exp-flash');
    track.addEventListener('animationend', () => track.classList.remove('exp-pop', 'exp-flash'), { once: true });
  }
}
// 获得破坏经验（共享排气经验升级），xp 传入该物体经验值
// 有未获取的升级（排队中/道具 QTE 进行中）→ 本次经验不进入下一阶段累计（满格），但仍播经验增长动画
function gainBreakXp(xp = CONFIG.breakables.xp) {
  if (state.upgradeQtePending > 0 || state.upgradeQteActive) {
    playExpFeedback();
    return;
  }
  const { lv: lvNow } = expToLevel(progress.exhaustExp);
  progress.exhaustExp += xp;
  const et = expToLevel(progress.exhaustExp);
  progress.bodyLevel = et.lv;
  if (et.lv > lvNow) bus.emit('levelup');
  updateExpUI();
  playExpFeedback();
}
// 排气经验升级进度条：从中间向两侧填充（scaleX 以中心为原点）
// 有未获取的升级（排队中 / 道具 QTE 进行中）→ 保持满格，获得道具后恢复下一级进度
function updateExpUI() {
  const et = expToLevel(progress.exhaustExp);
  const pendingUpgrade = state.upgradeQtePending > 0 || state.upgradeQteActive;
  $expFill.style.transform = 'scaleX(' + (pendingUpgrade ? 1 : et.cur / et.need) + ')';
}
updateExpUI();

export { PROGRESS_KEY, progress, expNeeded, expToLevel, saveProgress, updateExpUI, gainBreakXp };
