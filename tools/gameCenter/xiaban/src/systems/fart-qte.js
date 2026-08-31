// 模块化重构：由 paper-theater-runner.html 拆出
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { state, addShake } from '../core/state.js';
import { camera, scene } from '../core/engine.js';
import { $qte, $qteCanvas, $qtePct, $qteResult, $qrJudge, $qrLink, $qteBurst, $qteBurstWrap, $qbE, $qteFlash, $danmakuLayer, $errorPopupLayer, $settingsModal, $debug, $upgradeQte } from '../utils/dom.js';
import { progress, expToLevel, updateExpUI } from './growth.js';
import { poops, burstConfetti, spawnOneFartParticle, spawnGreenFartBits, spawnOilFartBits, spawnPuffBurst, spawnDragonPuffBurst, spawnBlastJet, spawnCornBurst, spawnDragonSeedBurst, spawnMushroomBurst, spawnMuzzleFlash, spawnSaladChunkBurst, spawnLaserBeam, spawnFireBurst, spawnRainbowPuff, spawnFireworkRocket } from './particles.js';
import { spawnElephant } from './elephant.js';
import { spawnSportsBallBurst } from './sports-balls.js';
import { spawnSharkBurst } from './sharknado.js';
import { spawnFurnitureBurst } from './furniture.js';
import { playFart, playSplat, playGurgle, playQtePop, playCatScream, playShotgunBlast } from './audio.js';
import { updateLivesUI, showLifeTip, renderDiaperBar } from '../ui/hud.js';
import { player } from '../world/character.js';
import { bus } from '../utils/bus.js';
import { t, tList } from '../i18n.js';

const shotgunTexture = new THREE.TextureLoader().load('assets/shotgun/shotgun-left.png');
shotgunTexture.colorSpace = THREE.SRGBColorSpace;
const shotgunMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(1.28, 0.38),
  new THREE.MeshBasicMaterial({ map: shotgunTexture, transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide })
);
shotgunMesh.visible = false;
shotgunMesh.renderOrder = 82;
scene.add(shotgunMesh);

// ---------- 放屁 QTE：5 色条固定 + 判定线左右往返 ----------
let qteLayout = [];   // 当前 QTE 布局：5 段 {q,t,label,color,w,barW,min,max}（每轮重新生成；段内纯色取色见 qteColorAt）
let qteWidthPts = []; // 贝塞尔宽度曲线控制点：{t:段中心条内容坐标, w:品质基准宽}（每次布局同步生成，升序）
const MEDIUM_RARE_QTE_LAYOUT = [
  { q: 'raw', t: 0.12, label: '', color: '#d83a2e', w: 0.25, barW: 34 },
  { q: 'warm', t: 0.5, label: '', color: '#f0c43a', w: 0.20, barW: 42 },
  { q: 'mediumRare', t: 1, label: '', color: '#34b85a', w: 0.10, barW: 24 },
  { q: 'done', t: 0.5, label: '', color: '#f0c43a', w: 0.20, barW: 42 },
  { q: 'burnt', t: 0.12, label: '', color: '#d83a2e', w: 0.25, barW: 34 },
];
function usingMediumRareQte() {
  return state.activeFoodEvent?.id === 'mediumRareBurger10';
}
// 生成布局：random=洗牌重排 5 段；fixed=固定梯度（底→顶 糟糕→一般→一般→优秀→完美）；宽度按权重固定
function generateQteLayout() {
  const pool = (usingMediumRareQte() ? MEDIUM_RARE_QTE_LAYOUT : CONFIG.qte.layoutPool).map(seg => ({ ...seg }));
  // 婴儿爽身粉：扩大 好/完美 判定区，压缩 一般 区（权重等比调整后归一化）
  const am = state.eff.qteAreaMul;
  if (!usingMediumRareQte() && am > 1) {
    const compress = 1 - (am - 1) * 0.5;   // 一般区压缩系数
    for (const seg of pool) {
      if (seg.q === 'good' || seg.q === 'great') seg.w *= am;
      else if (seg.q === 'ok') seg.w *= compress;
    }
    const total = pool.reduce((s, seg) => s + seg.w, 0);
    if (total > 0) pool.forEach(seg => { seg.w /= total; });
  }
  if (!usingMediumRareQte() && CONFIG.qte.layoutMode >= 1) {
    for (let i = pool.length - 1; i > 0; i--) {     // Fisher-Yates 洗牌
      const j = (Math.random() * (i + 1)) | 0;
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
  }
  let acc = 0;
  qteLayout = pool.map(seg => {
    const min = acc;
    acc += seg.w;
    return { ...seg, min, max: acc };
  });
  // 贝塞尔宽度控制点：每段中心取品质基准宽（barW），Catmull-Rom 穿过 → 段界平滑过渡
  qteWidthPts = qteLayout
    .map(seg => ({ t: (seg.min + seg.max) / 2, w: seg.barW }))
    .sort((a, b) => a.t - b.t);
}
// 贝塞尔宽度采样：Catmull-Rom 样条（tension 0.5，等价三次贝塞尔）穿过各段中心控制点 → 平滑曲线轮廓
function qteWidthAt(hc) {
  const pts = qteWidthPts;
  const n = pts.length;
  if (!n) return 8;
  if (hc <= pts[0].t) return pts[0].w;
  if (hc >= pts[n - 1].t) return pts[n - 1].w;
  let i = 0;
  while (i < n - 2 && hc > pts[i + 1].t) i++;
  const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
  const u = (hc - p1.t) / Math.max(0.0001, p2.t - p1.t);
  const u2 = u * u, u3 = u2 * u;
  const w = 0.5 * (2 * p1.w + (-p0.w + p2.w) * u
    + (2 * p0.w - 5 * p1.w + 4 * p2.w - p3.w) * u2
    + (-p0.w + 3 * p1.w - 3 * p2.w + p3.w) * u3);
  return Math.round(Math.min(92, Math.max(16, w)));
}
// 段内纯色：每段直接取本段色，无段间渐变（分段由 drawQteCanvas 的段界像素描边明确切分；帽区由 qteBarColorAt 取端点段色）
function qteColorAt(hc) {
  const i = qteZoneAt(hc);
  return qteLayout[i].color;
}
// 当前布局段定位：条内容高度 → 段索引
function qteZoneAt(t) {
  if (!qteLayout.length) return 0;
  if (t >= 1) return qteLayout.length - 1;
  for (let i = 0; i < qteLayout.length; i++) {
    if (t >= qteLayout[i].min && t < qteLayout[i].max) return i;
  }
  return 0;
}
// 段索引 → 抽取质量 t（决定事件概率）
function qteZoneQuality(t) {
  return qteLayout[qteZoneAt(t)].t;
}
// 判定线（左右往返扫过固定条）当前指向的条内容高度：与 drawQteCanvas 绘制一致（hc = 0.5 - off）
// 注意：off 越大判定线越朝条底部（hc 越小=糟糕），off 越小越朝条顶部（hc 越大=完美）
function qteLineHc() {
  return 0.5 - state.qte;
}
// 判定线当前指向的区域（判定线在条外 → 失误）
function qteLineZone() {
  const hc = qteLineHc();
  if (hc < 0 || hc > 1) return 0;
  return qteZoneAt(hc);
}
// 判定线当前区域质量 t（按键结算用）
function qteLineQuality() {
  return qteLayout[qteLineZone()].t;
}
function qteLineZoneData() {
  return qteLayout[qteLineZone()] || null;
}
function isQteBlocked() {
  return state.paused || state.timeStopped || state.upgradeQteActive || !$settingsModal.classList.contains('hidden') || !$debug.classList.contains('hidden');
}
// 放屁事件池抽取接口：传入质量 t(0~1)，按 baseWeight * exp(K*quality*(t-0.5)) 加权随机。
// t 越大 → 好事件（quality 高）权重指数上升，但任何事件概率永不归零。
// cumRisk（随放屁累积、串稀后重置）会持续抬高串稀权重 → 游玩越久串稀概率缓慢上升。
function drawQteEvent(t, pool = CONFIG.qte.pool) {
  const K = CONFIG.qte.poolK;
  const risk = state.cumRisk;
  const eff = pool.map(ev => {
    let w = ev.baseWeight * Math.exp(K * ev.quality * (t - 0.5));
    if (ev.id === 'diarrhea') w *= (1 + risk * CONFIG.qte.riskFactor);   // 串稀权重随风险累积上升
    return { ev, w };
  });
  const total = eff.reduce((s, e) => s + e.w, 0);
  let roll = Math.random() * total;
  for (const e of eff) {
    roll -= e.w;
    if (roll < 0) return e.ev.id;
  }
  return pool[pool.length - 1].id;
}
function qteOutcomeChance(id, t, pool = CONFIG.qte.pool) {
  const K = CONFIG.qte.poolK;
  const risk = state.cumRisk;
  let target = 0;
  const total = pool.reduce((sum, ev) => {
    let w = ev.baseWeight * Math.exp(K * ev.quality * (t - 0.5));
    if (ev.id === 'diarrhea') w *= (1 + risk * CONFIG.qte.riskFactor);
    if (ev.id === id) target += w;
    return sum + w;
  }, 0);
  return total > 0 ? target / total : 0;
}
function qteOutcomeLabel(id) {
  const ev = CONFIG.qte.pool.find(e => e.id === id);
  return t(`outcome_${id}`) || ev?.label || id;
}
function qteZoneLabel(seg) {
  if (!seg) return '';
  return t(`qteLabel_${seg.q}`) || seg.label || '';
}

// ---------- QTE 判定条：DOM canvas 高清平滑 + 轮次文字 ----------
// 判定条为 DOM canvas 直接显示（绕开 Three.js 管线），1:1 像素平滑渲染（去像素风，主画面像素化由低分辨率 buffer 承担）；
// 竖直放在屏幕左侧：四档品质动态布局 + 贝塞尔曲线轮廓 + 段内纯色与段界像素描边 + 两端胶囊椭圆帽圆角收口 + 固定判定线 + 条整体上下往返。
const QTE_COLS = 100, QTE_ROWS = 816;  // 竖条画布逻辑像素（宽 100 列 = 厚度方向；高 816 行 = 内容区 360 + 双向摆动 360 + 两端帽余量 96）
const QTE_NX = 0.00, QTE_NY = 0.02;  // 轮次文字相对判定条的偏移（判定条本体为场景 mesh）
let qteTex = null;   // QTE 判定条 CanvasTexture（在 $qteCanvas 定义后创建，drawQteCanvas 每帧标记更新）
// 两端胶囊椭圆帽：条顶(hc>1)/条底(hc<0)各加椭圆帽，宽度按椭圆截面公式收拢成圆弧（圆角收口替代平头截断）
const QTE_CAP_H = 48;   // 帽长（画布行数）
const QTE_CONTENT = 360;   // 条内容区行数（1 hc 单位）；画布 = 内容 + 摆动 + 帽余量 → off=±0.5 时条含帽恰好贴画布上下缘，不裁切
const QTE_CAP_N = QTE_CAP_H / QTE_CONTENT;   // 帽长换算为条内容坐标（hc 单位）
const QTE_CENTER = (QTE_ROWS - 1) / 2;   // 画布中心行（固定判定线 / 条中心基准）
function qteBarWAt(hc) {
  if (hc >= 0 && hc <= 1) return qteWidthAt(hc);
  if (hc < 0) {
    const dy = -hc;
    if (dy >= QTE_CAP_N) return 0;
    return Math.round(qteWidthAt(0) * Math.sqrt(Math.max(0, 1 - (dy / QTE_CAP_N) * (dy / QTE_CAP_N))));
  }
  const dy = hc - 1;
  if (dy >= QTE_CAP_N) return 0;
  return Math.round(qteWidthAt(1) * Math.sqrt(Math.max(0, 1 - (dy / QTE_CAP_N) * (dy / QTE_CAP_N))));
}
function qteBarColorAt(hc) {
  if (hc < 0) return qteColorAt(0);
  if (hc > 1) return qteColorAt(1);
  return qteColorAt(hc);
}
function drawQteCanvas() {
  const ctx = $qteCanvas.getContext('2d');
  const W = QTE_COLS, H = QTE_ROWS;
  const off = state.qte;                     // 条相对指针(判定线)的偏移 -0.5~+0.5（0=居中）
  const lr = Math.round(QTE_CENTER);         // 固定判定线行（画布中线）
  const cw = w => (W - w) >> 1;                 // 水平居中起始列（厚度方向居中）
  ctx.clearRect(0, 0, W, H);
  // 条内容随偏移 off 上下平移：hc = (QTE_CENTER - r)/QTE_CONTENT + 0.5 - off
  // 画布高 = 内容 360 + 摆动 360 + 帽余量 96 → off=±0.5 时条(含两端胶囊帽)恰好贴画布上下缘，不裁切。
  // 段内纯色（qteColorAt 直接取本段色）；段界由下方独立循环画深色像素横线切分。
  const EDGE = '#1a0e18';   // 条描边色（与判定线黑边一致，像素化后呈块状描边）
  for (let r = 0; r < H; r++) {
    const hc = (QTE_CENTER - r) / QTE_CONTENT + 0.5 - off;
    if (hc < -QTE_CAP_N || hc > 1 + QTE_CAP_N) continue;
    const w = qteBarWAt(hc);   // 胶囊椭圆帽采样宽度（两端圆弧收口，段界平滑过渡）
    ctx.fillStyle = qteBarColorAt(hc);
    ctx.fillRect(cw(w), r, w, 1);
  }
  // 条外轮廓描边（加粗 8 倍）：左右缘随胶囊帽采样宽度各描 8 列深色（像素块描边，向外扩张，超出画布自动裁切；帽区弧线自动收拢）
  for (let r = 0; r < H; r++) {
    const hc = (QTE_CENTER - r) / QTE_CONTENT + 0.5 - off;
    if (hc < -QTE_CAP_N || hc > 1 + QTE_CAP_N) continue;
    const w = qteBarWAt(hc);
    const x0 = cw(w), x1 = cw(w) + w - 1;
    ctx.fillStyle = EDGE;
    ctx.fillRect(x0 - 7, r, 8, 1);   // 左缘 8 列
    ctx.fillRect(x1, r, 8, 1);       // 右缘 8 列
  }
  // 段界像素描边：每个段界（前 n-1 段的 max）处画 8px 深色横线，横贯条宽（含左右缘描边），明确切分 5 段（随条移动）
  const BOUNDARIES = qteLayout.slice(0, -1).map(seg => seg.max);
  for (const b of BOUNDARIES) {
    const r = Math.round(QTE_CENTER - (b - 0.5) * QTE_CONTENT - off * QTE_CONTENT);
    if (r < 0 || r >= H) continue;
    const w = qteBarWAt(b);
    ctx.fillStyle = EDGE;
    ctx.fillRect(cw(w) - 7, r, w + 14, 8);     // 左描边外 → 右描边外，高 8px
  }

  // 固定判定线：画布中线，黑白描边 + 亮白主线（目标线）；高度 ×6（6 黑 + 6 白 + 6 黑，共 18 行，以 lr 对称）
  ctx.fillStyle = '#1a0e18';
  ctx.fillRect(0, lr - 9, W, 6);
  ctx.fillRect(0, lr + 3, W, 6);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, lr - 3, W, 6);
  if (qteTex) qteTex.needsUpdate = true;   // 离屏画布已更新 → 贴图纹理同步刷新
}
// 判定条屏幕尺寸：还原原版竖条大小（mesh 高 = 原版 barH 并按画布 816/720 计入帽余量）
function qteBarScreenSize() {
  const barH = Math.min(720, innerHeight - 24);   // 原版 mesh 高（内容区 = barH/2 = min(360,(innerHeight-24)/2)）
  const meshH = Math.min(barH * (QTE_ROWS / (QTE_CONTENT * 2)), innerHeight - 8);   // 含帽余量（816/720≈1.13 倍），竖屏超限时压缩
  const meshW = meshH * (QTE_COLS / QTE_ROWS);   // 宽 = 高 × 100/816
  return { meshW, meshH };
}
// 轮次文字：固定在判定条右侧并跟随指针高度；结算后短暂显示结果。
function updateQteLabel() {
  const showingOutcome = state.recentOutcomeT > 0 && state.qteOutcome;
  const mediumRare = usingMediumRareQte();
  $qtePct.textContent = showingOutcome
    ? qteOutcomeLabel(state.qteOutcome)
    : (mediumRare
      ? t('qteRound', { round: Math.min(CONFIG.qte.rounds, state.qteRound + 1), total: CONFIG.qte.rounds, speed: state.qteRoundSpeedMul.toFixed(2) })
      : t('qteRoundWithLabel', { round: Math.min(CONFIG.qte.rounds, state.qteRound + 1), total: CONFIG.qte.rounds, speed: state.qteRoundSpeedMul.toFixed(2), label: qteZoneLabel(qteLayout[qteLineZone()]) }));
  const cx = 0.10 * innerWidth + 16;                 // QTE 槽中心 x（与 layoutQteMesh 一致：左 10% + 16px）
  const cy = ((1 - QTE_NY) / 2) * innerHeight;
  const { meshW } = qteBarScreenSize();
  $qtePct.style.left = (cx + meshW / 2 + 6) + 'px';   // 槽右缘 + 6px gap
  $qtePct.style.top = (cy - 180) + 'px';               // 条内容上端（内容半高 180px）
  $qtePct.style.transform = '';
  $qtePct.style.fontSize = '16px';
  $qtePct.style.color = showingOutcome ? '#fff3a7' : (mediumRare ? '#fff3a7' : qteLayout[qteLineZone()].color);
}
// QTE 结果三段式：横排从左到右 按键结算(纯文字) → 关联词(纯文字) → 放屁结果(星芒)，依次出现、一起收起
// 按键结算品质词（与判定档位映射，沿用具象档位阈值）；关联词按 按键好坏 vs 事件好坏 动态选择。
// 档位词：与判定档位标签一致（糟糕/一般/优秀/完美）
function judgeWord(judgeT) {
  return judgeT >= 0.85 ? t('judge_perfect') : judgeT >= 0.6 ? t('judge_good') : judgeT >= 0.25 ? t('judge_ok') : t('judge_bad');
}
// 关联词：从 CONFIG.qte.linkWords 连接词池纯随机抽取（不再按好坏区分）
function qteLinkWord() {
  const words = tList('linkWords');
  return words[(Math.random() * words.length) | 0];
}
// judgeT 缺省（调试直接触发结果）时按键=事件品质 → 走一致词
let qrTimer1 = null, qrTimer2 = null;   // 三段式出现定时器（连续结算时先清理，防旧回调串台）
// 按键瞬间（resolveQte）：预先填好三段内容，立即弹按键结算，0.6s 后弹关联词；
// 星芒放屁结果等事件真正发生（酝酿结束/揭晓）时再由 showQteBurstPhase 弹出，恰好压中"事件发生"时刻。
function showQteJudge(outcome, judgeT) {
  const ev = CONFIG.qte.pool.find(e => e.id === outcome);
  if (!ev) return;
  clearTimeout(qrTimer1);
  clearTimeout(qrTimer2);
  const jt = (judgeT === undefined || judgeT === null) ? ev.quality : judgeT;
  $qrJudge.textContent = judgeWord(jt);
  $qrLink.textContent = qteLinkWord();   // 连接词纯随机
  $qbE.textContent = qteOutcomeLabel(ev.id);
  $qteBurst.querySelector('.qb-face').style.background = ev.color;
  // 收起旧状态后重触发：先弹按键结算，再定时弹关联词
  $qteResult.classList.remove('on');
  $qrJudge.classList.remove('on');
  $qrLink.classList.remove('on');
  $qteBurstWrap.classList.remove('on');
  void $qteResult.offsetWidth;          // 强制 reflow 重触发动画
  $qteResult.classList.add('on');
  void $qrJudge.offsetWidth;
  $qrJudge.classList.add('on');
  playQtePop(0.3);   // 按键结算弹音
  qrTimer1 = setTimeout(() => {
    void $qrLink.offsetWidth;
    $qrLink.classList.add('on');
    playQtePop(0.3, true);   // 关联词弹音（下滑悬念）
  }, 600);
}
// 事件发生（酝酿结束揭晓 / 调试触发）：弹出星芒放屁结果 + 全屏微闪
function showQteBurstPhase() {
  clearTimeout(qrTimer2);
  $qteBurstWrap.classList.remove('on');
  void $qteBurstWrap.offsetWidth;
  $qteBurstWrap.classList.add('on');
  $qteFlash.classList.remove('on');
  void $qteFlash.offsetWidth;
  $qteFlash.classList.add('on');
  setTimeout(() => $qteFlash.classList.remove('on'), 300);
}
function syncQteSpeed() {
  state.qteRoundSpeedMul = Math.pow(CONFIG.qte.speedRoundMul, state.qteRound);
  state.qteSpeed = CONFIG.qte.speed * state.qteRoundSpeedMul * (state.qteSpeedMul || 1);
}
function resetQteSession({ clearFeedback = false } = {}) {
  state.qte = 0;                 // 线居中（指向条中间）
  state.qteDir = 1;              // 先往 +0.5 扫
  state.qteRound = 0;            // 已完成往返数
  syncQteSpeed();
  state.qteResolving = false;
  if (clearFeedback) {
    state.qteJudgement = 'idle';
    state.qteOutcome = null;
    state.pendingMediumRareZone = null;
    state.recentOutcomeT = 0;
  }
}
// 线滑到端部反向；回扫即完成一个完整往返 → 提速，满 rounds 次强制最坏
function qteBounce() {
  state.qteDir *= -1;
  if (state.qteDir > 0) {          // 到 -0.5 端点折返 = 完成一个完整扫动（提速）
    state.qteRound++;
    syncQteSpeed();
    if (state.qteRound >= CONFIG.qte.rounds) resolveQte('timeout');
  }
}
// 手动放屁 QTE：按下瞬间按判定线当前扫到的位置决定本次结果权重。
function doFart() {
  if (state.phase !== 'run' || (state.fartFlying && !state.capsuleFartFlying) || state.shitting ||
      state.buildup || state.qteResolving || state.spinEndT > 0 ||
      state.qteStaticT > 0 || isQteBlocked()) return;   // 仅胶囊追加排气飞行中可放屁；静止缓冲期按键无效
  resolveQte('key');
}

function resolveQte(judgement) {
  if (state.qteResolving) return;
  state.qteResolving = true;
  state.qteJudgement = judgement;
  state.pendingSpeed = state.speed;   // 快照按屁前速度（原地崩飞需保留，避免被酝酿减速吃掉）
  if (state.activeFoodEvent?.id === 'protein01') {
    state.proteinBloatPower = Math.max(1, Math.min(1.5, state.proteinBloatScale || 1));
  }
  // 超时强制最差区（t=0）；按键按判定线所在区取质量 t → 事件池抽取
  const t = judgement === 'timeout' ? 0 : qteLineQuality();
  state.pendingMediumRareZone = usingMediumRareQte() && judgement !== 'timeout' ? qteLineZoneData()?.q : null;
  state.pendingJudgeT = t;   // 保存按键档位质量，供揭晓时三段式按键结算/关联词使用
  state.diarrheaChance = qteOutcomeChance('diarrhea', t);   // 本次按键实际窜稀概率（酝酿期生命条抖动依据）
  const outcome = drawQteEvent(t);
  state.qteOutcome = outcome;
  // 道具层数：节拍器（连续同品质叠节奏）/ 安全手册（连续一般叠规范）/ 高压气罐（好/极好消耗蓄压）
  if (state.lastQteQuality === t) state.rhythmStacks++;
  else state.rhythmStacks = 0;
  state.lastQteQuality = t;
  if (t === 0.5) state.safeStacks++;
  else state.safeStacks = 0;
  state.consumeCharge = 0;
  if (t >= 0.75 && state.chargeStacks > 0) {
    state.consumeCharge = state.chargeStacks;
    state.chargeStacks = 0;
  }
  const qteSnap = state.qte;   // 拍停位置：下一次 QTE 开始前判定线停留在此
  resetQteSession();
  state.qte = qteSnap;         // 恢复扫动时从拍停位置继续（不回中）
  state.qteLayoutDirty = true; // 下一轮恢复扫动前重新生成布局
  // resetQteSession 重置往返计数，但不能解除当前结算锁或清掉调试反馈。
  state.qteResolving = true;
  state.qteJudgement = judgement;
  state.qteOutcome = outcome;
  // 进入酝酿（准备动画）：冻结指针 + 捂屁股走，约 buildupTime 秒后揭晓并真正崩飞
  // 胶囊追加排气飞行中手动放屁：先终止本次胶囊飞行落地，避免飞行分支遮蔽酝酿（胶囊序列保留，落地后继续）
  if (state.fartFlying) {
    state.fartFlying = false;
    state.capsuleFartFlying = false;
    state.onGround = true;
    state.jumpY = 0;
    state.launchVx = 0;
    state.launchVy = 0;
    state.fartFlyT = 0;
  }
  state.buildup = true;
  state.buildupT = 0;
  playGurgle();
  showQteJudge(outcome, t);   // 按键瞬间：立即弹按键结算，0.6s 后弹关联词（星芒等揭晓/事件发生时再弹）
}

function spawnFoodEventFartBits() {
  if (state.activeFoodEvent?.id === 'gooseLegAunt05') {
    spawnGreenFartBits(player.position.x, state.jumpY + 0.62, 0.16, 4 + ((Math.random() * 3) | 0), 1.1);
  } else if (state.activeFoodEvent?.id === 'falseCod07') {
    spawnOilFartBits(player.position.x, state.jumpY + 0.58, 0.18, 7 + ((Math.random() * 5) | 0), 1.2);
  }
}
const JUICE_VARIANTS = [
  { id: 'red', color: '#ff174f', h: 1.3, v: 1, risk: 1, fx: 1.08 },
  { id: 'yellow', color: '#ffe21a', h: 1, v: 1.4, risk: 1, fx: 1.08 },
  { id: 'green', color: '#31f25f', h: 0.82, v: 0.82, risk: 0.5, fx: 0.95 },
  { id: 'purple', color: '#b42cff', h: 1.2, v: 1.2, risk: 1.5, fx: 1.12 },
];
const JUICE_MIX_OUTCOMES = new Set([
  'fart', 'smallFart', 'bigFart', 'blast', 'rocket',
  'tripleFart', 'airTriple', 'verticalRocket', 'twoStageRocket',
]);
function clearJuiceFart() {
  state.juiceFartId = null;
  state.juiceFartColor = null;
  state.juiceFartH = 1;
  state.juiceFartV = 1;
  state.juiceFartRisk = 1;
  state.juiceFartFx = 1;
}
function chooseJuiceFart(outcome) {
  clearJuiceFart();
  if (state.activeFoodEvent?.id !== 'pomegranateJuice06') return;
  if (!JUICE_MIX_OUTCOMES.has(outcome)) return;
  const pick = JUICE_VARIANTS[(Math.random() * JUICE_VARIANTS.length) | 0];
  state.juiceFartId = pick.id;
  state.juiceFartColor = pick.color;
  state.juiceFartH = pick.h;
  state.juiceFartV = pick.v;
  state.juiceFartRisk = pick.risk;
  state.juiceFartFx = pick.fx;
}
function startProteinDeflate() {
  if (state.activeFoodEvent?.id !== 'protein01') return;
  state.proteinQteT = 0;
  state.proteinBloatPower = Math.max(1, Math.min(1.5, state.proteinBloatPower || state.proteinBloatScale || 1));
  state.proteinDeflateT = Math.max(state.proteinDeflateT, 0.72);
  state.proteinLeakT = 0;
}
const SLOP_CHAOS_OUTCOMES = new Set([
  'bigFart', 'rocket', 'sportsSale', 'cornGun', 'airTriple',
  'dragonFruit', 'goodbye', 'verticalRocket', 'laserUp',
  'fruitSalad', 'twoStageRocket', 'rainbow',
]);
function isSecretSlopChaosActive() {
  return state.activeFoodEvent?.id === 'secretSlop08' && SLOP_CHAOS_OUTCOMES.has(state.qteOutcome);
}
function rotateLaunchVelocity(angle, powerMul = 1) {
  const vx = state.launchVx;
  const vy = state.launchVy;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  state.launchVx = (vx * c - vy * s) * powerMul;
  state.launchVy = (vx * s + vy * c) * powerMul;
}
function applySecretSlopLaunchChaos({ keepSpeed = false, launchVyMul = 1 } = {}) {
  if (!isSecretSlopChaosActive() || keepSpeed || launchVyMul < 0.28) return;
  const verticalBias = Math.min(1, Math.max(0, Math.abs(state.launchVy) / 12));
  const spread = 0.34 + verticalBias * 0.46;
  const angle = (Math.random() - 0.5) * spread * 2;
  rotateLaunchVelocity(angle, 1.25);
  state.slopTurnVel = (Math.random() - 0.5) * 1.35;
  state.slopTurnT = 0;
  state.slopTrailT = 0;
}
function applyQteOutcome(outcome) {
  chooseJuiceFart(outcome);
  spawnFoodEventFartBits();
  if (outcome === 'diarrhea') { startProteinDeflate(); return doIncident(); }
  if (outcome === 'bigFart') return doBigFart();
  if (outcome === 'rocket') return doRocketFart();
  if (outcome === 'sportsSale') return doSportsSale();
  if (outcome === 'sharknado') return doSharknado();
  if (outcome === 'cornGun') return doCornGun();
  if (outcome === 'elephant') return doElephant();
  if (outcome === 'tripleFart') return doTripleFart();
  if (outcome === 'firework') { startProteinDeflate(); return doFirework(); }
  if (outcome === 'airTriple') return doAirTriple();
  if (outcome === 'dragonFruit') return doDragonFruit();
  if (outcome === 'goodbye') return doGoodbye();
  if (outcome === 'verticalRocket') return doVerticalRocket();
  if (outcome === 'laserUp') return doLaserUp();
  if (outcome === 'fruitSalad') return doFruitSalad();
  if (outcome === 'twoStageRocket') return doTwoStageRocket();
  if (outcome === 'catScream') return doCatScream();
  if (outcome === 'doubleBarrel') return doDoubleBarrel();
  if (outcome === 'cometImpact') return doCometImpact();
  if (outcome === 'rainbow') return doRainbow();
  if (outcome === 'bootySpin') return doBootySpin();
  if (outcome === 'danmakuFart') { startProteinDeflate(); return doDanmakuFart(); }
  if (outcome === 'fartExeCrash') return doFartExeCrash();
  if (outcome === 'ikeaFart') return doIkeaFart();
  if (outcome === 'fart') return doRegularFart();
  if (outcome === 'smallFart') return doSmallFart();
  if (outcome === 'blast') return doBlastFart();
  return doSmallFart();
}

function debugTriggerQteOutcome(outcome) {
  if (state.phase !== 'run' || isQteBlocked() || state.fartFlying ||
      state.shitting || state.buildup || state.qteResolving || state.spinEndT > 0) return;
  state.pendingSpeed = state.speed;
  if (state.activeFoodEvent?.id === 'protein01') {
    state.proteinBloatPower = Math.max(1, Math.min(1.5, state.proteinBloatScale || 1));
  }
  const qteSnap = state.qte;   // 调试触发同样停留在拍停位置
  resetQteSession();
  state.qte = qteSnap;
  state.qteLayoutDirty = true;
  state.pendingMediumRareZone = null;
  state.qteJudgement = 'debug';
  state.qteOutcome = outcome;
  state.recentOutcomeT = 2.4;   // 三段式总时长（揭晓时会被覆盖为事件后 1.2s）
  showQteJudge(outcome);   // 按键结算段（judgeT 缺省 → 按键=事件品质，走一致词）
  // 完整准备动作：进入酝酿（捂屁股走），由主循环在 buildupTime 后揭晓并真正放屁
  state.qteResolving = true;
  state.buildup = true;
  state.buildupT = 0;
  playGurgle();
}

// 三档放屁和火箭喷屁共享推进、起飞、粒子、音效与经验逻辑。
function performFartLaunch({ forceMul = 1, distanceMul = 1, speedMul = 1, fxScaleMul = 1, fxDurationMul = 1, rocketFart = false, keepSpeed = false, gravityMul = 1, launchVyMul = 1, noPuff = false, soundMul = 1, preserveHeight = false } = {}) {
  state.farts++;                                // 成功放屁次数
  state.exhaustExp++;                           // 本局排气里程经验 +1
  // 永久成长：排气经验累积 → 每 10 点升 1 级 → 随机强化属性
  const { lv: lvNow } = expToLevel(progress.exhaustExp);
  progress.exhaustExp++;
  const et = expToLevel(progress.exhaustExp);
  progress.bodyLevel = et.lv;
  if (et.lv > lvNow) bus.emit('levelup');
  updateExpUI();                             // 放屁后刷新升级进度条 + 等级面板
  const proteinMul = state.activeFoodEvent?.id === 'protein01' ? Math.max(1, Math.min(1.5, state.proteinBloatPower || 1)) : 1;
  const juiceH = state.juiceFartH || 1;
  const juiceV = state.juiceFartV || 1;
  const juiceFx = state.juiceFartFx || 1;
  const speedPushMul = state.activeFoodEvent?.effects?.speedPushMul || 1;
  const glideMul = state.activeFoodEvent?.effects?.glideMul || 1;
  const origSpeed = keepSpeed ? (state.pendingSpeed || state.speed) : state.speed;  // 原地崩飞用按屁前快照速度
  if (keepSpeed) {
    // 原地崩飞：x 轴保持按屁前的原有速度（酝酿减速前的速度），不额外加速
    state.fartBoost = 0;
    state.speed = origSpeed;     // 还原到按屁前速度，落地后继续以此速度奔跑
  } else {
    // 放屁推进（受肠道容量 / 事件 / 道具修正）
    state.speed = Math.min(CONFIG.fart.speedCap,
      state.speed + (CONFIG.fart.power * state.fartPower * state.eff.gutMul + state.eff.pushCount * 0.8) * forceMul * proteinMul * speedPushMul * juiceH);
    state.fartBoost = CONFIG.fart.boost * forceMul * proteinMul * speedPushMul * glideMul * juiceH;
  }
  state.fartPush = 0.3;
  // 放屁起飞：一次性大推力（被屁崩飞），空中不再二次加速
  // 垂直速度会延长滞空时间，水平倍率除以 speedMul 后保持总前冲距离接近 distanceMul。
  // 原地崩飞：x 轴保持原有速度（launchVx = 放屁前速度），不额外前冲。
  // 道具横向/纵向推进强化（蛋白粉/氦气球/增压/节奏/压力表/开塞露/高压气罐）
  const t = state.pendingJudgeT || 0;
  const hitHigh = t >= 0.75;
  let hMul = state.eff.hForce;
  if (state.eff.boostHF > 0 && state.boostStacks > 0) hMul *= (1 + state.eff.boostHF * state.boostStacks);
  if (state.eff.rhythmHF > 0 && state.rhythmStacks > 0) hMul *= (1 + state.eff.rhythmHF * state.rhythmStacks);
  if (state.eff.highRiskHF > 1 && state.cumRisk >= 0.10) hMul *= state.eff.highRiskHF;
  if (state.eff.kaiSaiLu > 1 && hitHigh) hMul *= state.eff.kaiSaiLu;
  if (state.consumeCharge > 0 && state.eff.chargeHF > 0) hMul *= (1 + state.eff.chargeHF * state.consumeCharge);
  let vMul = state.eff.vForce;
  if (state.eff.kaiSaiLu > 1 && hitHigh) vMul *= state.eff.kaiSaiLu;
  if (state.consumeCharge > 0 && state.eff.chargeHF > 0) vMul *= (1 + state.eff.chargeHF * state.consumeCharge);
  state.launchVx = keepSpeed
    ? origSpeed
    : (CONFIG.launch.vx + CONFIG.launch.vx2) * state.launchMul * forceMul * proteinMul * distanceMul / speedMul;
  if (!keepSpeed) state.launchVx *= hMul * juiceH;   // 横向强化（原地崩飞保持原速不强化）
  state.launchVy = (CONFIG.launch.vy + CONFIG.launch.vy2) * forceMul * proteinMul * speedMul * launchVyMul * vMul * juiceV;
  applySecretSlopLaunchChaos({ keepSpeed, launchVyMul });
  state.fartGravityMul = gravityMul;   // 飞行重力倍率（<1 = 低重力平地滑翔）
  state.rocketFart = rocketFart;
  state.blastFlying = keepSpeed;            // 标记原地崩飞（用于姿态 / 特效）
  state.fartFxScaleMul = fxScaleMul * forceMul * (0.82 + proteinMul * 0.18) * juiceFx;
  state.fartFxDurationMul = fxDurationMul * forceMul * (0.88 + proteinMul * 0.12) * juiceFx;
  state.noFartParticles = noPuff;   // 本屁是否生成屁云粒子（飞行余韵由 loop 读此标记）
  state.onGround = false;
  state.fartFlying = true;
  if (!preserveHeight) { state.fartFlyT = 0; state.jumpY = 0; }   // 空中追加（preserveHeight）保留当前高度
  startProteinDeflate();
  burstConfetti(player.position.x, 0.5, 0.1, 12, 5);
  if (rocketFart) addShake(0.7, -0.35, 0.08);
  else if (keepSpeed) addShake(0.45, 0, -0.1);
  else addShake(Math.min(0.3, 0.1 + forceMul * 0.12), -0.05 * forceMul, 0.035 * launchVyMul);
  const py = state.jumpY + 0.65;   // 发射点：角色臀部高度（身体正中）
  // 开场爆发：崩飞表现分两种（noPuff=true 时不生成屁云，保留推进/音效/震屏）
  if (!noPuff) {
    if (keepSpeed) {
      // 原地崩飞：屁从脚下向下喷（像被屁从下方顶飞）
      spawnBlastJet(player.position.x, 0.08, state.fartFxScaleMul, state.fartFxDurationMul);
      setTimeout(() => spawnBlastJet(player.position.x - 0.15, 0.04, state.fartFxScaleMul, state.fartFxDurationMul), 60);
      setTimeout(() => spawnBlastJet(player.position.x - 0.3, 0.0, state.fartFxScaleMul, state.fartFxDurationMul), 120);
    } else {
      // 普通放屁：旧式大圆屁云喷涌（被崩飞），后续飞行中改用淡色粒子
      spawnPuffBurst(player.position.x, py, 0.12, state.fartFxScaleMul, state.fartFxDurationMul);
      setTimeout(() => spawnPuffBurst(player.position.x - 0.2, py - 0.1, 0.12, state.fartFxScaleMul, state.fartFxDurationMul), 70);
      setTimeout(() => spawnPuffBurst(player.position.x - 0.4, py - 0.2, 0.12, state.fartFxScaleMul, state.fartFxDurationMul), 140);
    }
  }
  playFart(2.05 + state.farts * 0.008, 4 * soundMul);   // 放屁事件音效：音量倍率（空屁调小）
  // 风险积累（受括约肌 / 道具修正，连放惩罚；低压阀/安全手册减免）
  let riskGain = CONFIG.qte.normalInc * state.eff.riskIncMul * (state.juiceFartRisk || 1);
  if (state.activeFoodEvent?.id === 'mediumRareBurger10') {
    const zone = state.pendingMediumRareZone;
    if (zone === 'mediumRare') riskGain = 0;
    else if (zone === 'raw' || zone === 'burnt') riskGain *= 4;
  }
  if (state.eff.lowRiskReduce < 1 && state.cumRisk <= 0.05) riskGain *= state.eff.lowRiskReduce;
  if (state.eff.safeReduce > 0 && state.safeStacks > 0) riskGain *= Math.max(0.05, 1 - state.eff.safeReduce * state.safeStacks);
  state.cumRisk = Math.min(CONFIG.qte.cumRiskCap, state.cumRisk + riskGain);
  // 开塞露：命中好/极好时，放屁结束后额外增加喷射概率
  if (state.eff.kaiSaiLu > 1 && hitHigh) {
    state.cumRisk = Math.min(CONFIG.qte.cumRiskCap, state.cumRisk + CONFIG.qte.normalInc * state.eff.kaiSaiLu * 4);
  }
  // 蓄气增压阀 / 高压气罐：正常完成放屁 → 各累积 1 层
  if (state.eff.boostHF > 0) state.boostStacks = Math.min(50, state.boostStacks + 1);
  if (state.eff.chargeHF > 0) state.chargeStacks = Math.min(50, state.chargeStacks + 1);
  // 缓释排气胶囊：屁完成后延迟追加额外排气（弱/标准/强力，不重复加风险/经验/层数）
  if (state.capsuleList.length) {
    const list = state.capsuleList.slice();
    const powerMap = { normal: 0.35, fine: 0.55, rare: 0.75 };
    state.capsuleQueue.push(...list.map(q => powerMap[q] || 0.35));
    if (state.capsuleDelayT <= 0) state.capsuleDelayT = 0.35;
    state.capsuleActive = true;   // 胶囊序列进行中：落地不触发 QTE 静止缓冲
  }
}
// 缓释排气胶囊追加排气：轻量推进（不触发 QTE/事件/风险/经验/层数累积）
function appendFart(forceMul) {
  if (state.phase !== 'run' || state.shitting) return;
  const baseVx = Math.max(state.speed, state.pendingSpeed || 0);
  const extraVx = (CONFIG.launch.vx + CONFIG.launch.vx2) * state.launchMul * forceMul * 0.55 * state.eff.hForce;
  state.launchVx = baseVx + extraVx;
  state.launchVy = (CONFIG.launch.vy + CONFIG.launch.vy2) * forceMul * 0.55 * state.eff.vForce;
  state.onGround = false;
  state.fartFlying = true;
  state.capsuleFartFlying = true;   // 胶囊追加排气飞行：期间 QTE 判定条扫动且可放屁
  state.fartFlyT = 0;
  spawnPuffBurst(player.position.x, state.jumpY + 0.65, 0.12, state.fartFxScaleMul);
  spawnFoodEventFartBits();
  playFart(0.7, 1.2);
}
function updateCapsuleQueue(dt) {
  if (state.capsuleQueue.length) {
    const settled =
      state.phase === 'run' &&
      state.onGround &&
      !state.fartFlying &&
      !state.shitting &&
      !state.buildup &&
      !state.qteResolving &&
      !state.timeStopped &&
      !state.firework &&
      !state.spinRolling &&
      !state.sportsSale &&
      !state.sharknado &&
      !state.ikeaFart &&
      !state.cometImpact &&
      !state.verticalRocket &&
      !state.rocketFart;
    if (!settled) return;
    state.capsuleDelayT -= dt;
    if (state.capsuleDelayT > 0) return;
    const forceMul = state.capsuleQueue.shift();
    appendFart(forceMul);
    state.capsuleDelayT = state.capsuleQueue.length ? 0.35 : 0;
    return;
  }
  // 胶囊序列全部释放并落地 → 结束标记，恢复 QTE 静止缓冲机制
  if (state.capsuleActive && state.phase === 'run' && state.onGround &&
      !state.fartFlying && !state.shitting && !state.buildup && !state.qteResolving &&
      !state.timeStopped && !state.firework && !state.spinRolling && !state.sportsSale &&
      !state.sharknado && !state.ikeaFart && !state.cometImpact && !state.verticalRocket &&
      !state.rocketFart) {
    state.capsuleActive = false;
  }
}

function doBigFart() { performFartLaunch({ forceMul: CONFIG.qte.fartForce.big }); }
function doRegularFart() { performFartLaunch({ forceMul: CONFIG.qte.fartForce.regular }); }
function doSmallFart() { performFartLaunch({ forceMul: CONFIG.qte.fartForce.small }); }
const DANMAKU_WORDS = [
  '草', '？？？？？', '666', '绷不住了', '寄', '哈哈哈哈哈', '前方高能', '名场面',
  '起猛了', '这也行', '有操作的', '他真的做到了', '别眨眼', '全体起立', '笑出声',
  'wwwwww', '！？', 'すごい', 'は？', 'キター！', '神回', 'それな', '天才か？',
  'LOL', 'LMAO', 'BRUH', 'W', '???', 'LET HIM COOK', 'NO WAY', 'CLIP IT',
  'PEAK', 'HE COOKED', 'WHAT A PLAY', 'ABSOLUTE CINEMA',
];
const DANMAKU_COLORS = ['#fff3a7', '#f6e8cf', '#8ee6ff', '#ff8fab', '#b6ff7a', '#ffd24a'];
function doFlatFartPayout({ soundMul = 1 } = {}) {
  state.farts++;
  state.exhaustExp++;
  const { lv: lvNow } = expToLevel(progress.exhaustExp);
  progress.exhaustExp++;
  const et = expToLevel(progress.exhaustExp);
  progress.bodyLevel = et.lv;
  if (et.lv > lvNow) bus.emit('levelup');
  updateExpUI();
  state.speed = state.pendingSpeed || state.speed;
  state.fartBoost = 0;
  state.fartPush = 0.18;
  spawnPuffBurst(player.position.x, state.jumpY + 0.65, 0.12, 0.75, 0.8);
  playFart(1.15 + state.farts * 0.004, 1.8 * soundMul);
  addShake(0.16, -0.04, 0.04);
  state.cumRisk = Math.min(CONFIG.qte.cumRiskCap,
    state.cumRisk + CONFIG.qte.normalInc * state.eff.riskIncMul);
}
function burstDanmaku() {
  if (state.phase !== 'run') return;
  $danmakuLayer.innerHTML = '';
  const count = 64;
  for (let i = 0; i < count; i++) {
    const dm = document.createElement('div');
    dm.className = 'dm';
    dm.textContent = DANMAKU_WORDS[(Math.random() * DANMAKU_WORDS.length) | 0];
    dm.style.top = `${8 + Math.random() * 82}%`;
    dm.style.fontSize = `${18 + Math.random() * 30}px`;
    dm.style.color = DANMAKU_COLORS[(Math.random() * DANMAKU_COLORS.length) | 0];
    dm.style.animationDelay = `${Math.random() * 0.75}s`;
    dm.style.animationDuration = `${2.8 + Math.random() * 2.2}s`;
    dm.style.zIndex = String((Math.random() * 8) | 0);
    $danmakuLayer.appendChild(dm);
    dm.addEventListener('animationend', () => dm.remove(), { once: true });
  }
  playQtePop(0.6, true);
  addShake(0.35, 0.12, 0.06);
}
function doDanmakuFart() {
  doFlatFartPayout({ soundMul: 0.75 });
  const delay = 500 + Math.random() * 800;
  setTimeout(burstDanmaku, delay);
}
let fartExeCrashTimer = null;
function clearFartExeWindows() {
  if (!$errorPopupLayer) return;
  $errorPopupLayer.innerHTML = '';
}
function burstFartExeWindows() {
  if (state.phase !== 'run' || !$errorPopupLayer) return;
  clearFartExeWindows();
  const count = innerWidth < 720 ? 34 : 48;
  const minX = innerWidth * 0.08;
  const maxX = innerWidth * 0.92;
  const minY = innerHeight * 0.10;
  const maxY = innerHeight * 0.88;
  for (let i = 0; i < count; i++) {
    const win = document.createElement('img');
    win.className = 'err-img';
    win.src = 'assets/ui/fart-exe-error.png';
    win.alt = '';
    const centerBias = Math.random() < 0.34;
    const x = centerBias
      ? innerWidth * 0.5 + (Math.random() - 0.5) * innerWidth * 0.55
      : minX + Math.random() * (maxX - minX);
    const y = centerBias
      ? innerHeight * 0.48 + (Math.random() - 0.5) * innerHeight * 0.5
      : minY + Math.random() * (maxY - minY);
    win.style.left = `${x}px`;
    win.style.top = `${y}px`;
    win.style.zIndex = String(i);
    win.style.setProperty('--popDelay', `${Math.random() * 0.24}s`);
    win.style.setProperty('--fadeDelay', `${3.0 + Math.random() * 0.95}s`);
    win.style.width = `${innerWidth < 720 ? 150 + Math.random() * 130 : 190 + Math.random() * 270}px`;
    $errorPopupLayer.appendChild(win);
    setTimeout(() => win.remove(), 5000 + Math.random() * 360);
  }
  playQtePop(0.72, true);
  addShake(0.42, 0.08, 0.08);
}
function doFartExeCrash() {
  performFartLaunch({ forceMul: 0.8, distanceMul: 0.38, launchVyMul: 1.55, fxScaleMul: 1.05, fxDurationMul: 1.1 });
  clearTimeout(fartExeCrashTimer);
  fartExeCrashTimer = setTimeout(burstFartExeWindows, 680);
}
// 三连空屁：连续 3 次极低力度放屁（噗→噗→噗），每次轻微位移，形成三段式动作
function doTripleFart() {
  const cfg = { forceMul: CONFIG.qte.fartForce.triple, soundMul: 0.45 };   // 低力度 + 空屁小声
  performFartLaunch(cfg);
  setTimeout(() => performFartLaunch(cfg), 150);
  setTimeout(() => performFartLaunch(cfg), 300);
}
// 腚上花火：无推进、原地摔倒趴地，从屁股位置向正上方连续发射烟花（高空爆炸）
function doFirework() {
  state.firework = true;   // 主循环：原地趴倒，约 fireworkDur 秒后恢复奔跑
  state.fireworkT = 0;
  playFart(0.6, 1);   // 放屁声（不推进）
  for (let i = 0; i < 9; i++) {
    setTimeout(() => spawnFireworkRocket(player.position.x, state.jumpY + 0.65), 300 + i * 160);   // 先摔倒趴好再放烟花
  }
}
// 空中三连屁：地面升空 → 空中追加 2 次排气（保留高度），共 3 次较强推进
function doAirTriple() {
  const cfg = { forceMul: CONFIG.qte.fartForce.airTriple, preserveHeight: true };
  performFartLaunch({ forceMul: CONFIG.qte.fartForce.airTriple });   // 地面放屁 → 升空
  setTimeout(() => performFartLaunch(cfg), 600);                     // 空中第 2 次
  setTimeout(() => performFartLaunch(cfg), 1200);                    // 空中第 3 次 → 落地
}
function doRocketFart() {
  performFartLaunch({
    forceMul: CONFIG.qte.fartForce.big,
    rocketFart: true,
    distanceMul: CONFIG.qte.rocket.distanceMul,
    speedMul: CONFIG.qte.rocket.speedMul,
    fxScaleMul: CONFIG.qte.rocket.fxScaleMul,
    fxDurationMul: CONFIG.qte.rocket.fxDurationMul,
  });
  addShake(0.72, -0.36, 0.08);
}
function doSportsSale() {
  state.sportsSale = true;
  state.sportsSaleT = 0;
  state.sportsSaleEmitT = 0;
  state.rocketFx = false;
  performFartLaunch({ forceMul: 0.9, distanceMul: 0.9, launchVyMul: 0.72, fxScaleMul: 1.0, fxDurationMul: 1.05 });
  spawnSportsBallBurst(player.position.x, state.jumpY + 0.55, 10);
}
function doSharknado() {
  state.sharknado = true;
  state.sharknadoT = 0;
  state.sharknadoEmitT = 0;
  state.rocketFx = false;
  performFartLaunch({ forceMul: 0.72, distanceMul: 0.42, launchVyMul: 1.34, gravityMul: 0.46, fxScaleMul: 1.0, fxDurationMul: 1.0, noPuff: true });
  spawnSharkBurst(player.position.x, state.jumpY + 0.85, 18, 0.74);
}
function doCometImpact() {
  state.cometImpact = true;
  state.cometPhase = 'ascend';
  state.cometT = 0;
  state.cometFireT = 0;
  state.cometHit = false;
  state.rocketFx = false;
  state.verticalRocket = false;
  state.sportsSale = false;
  state.sharknado = false;
  state.ikeaFart = false;
  performFartLaunch({ forceMul: 1.0, distanceMul: 0.18, launchVyMul: 2.05, gravityMul: 0.28, fxScaleMul: 1.35, fxDurationMul: 1.3 });
  state.launchVx = Math.max(state.launchVx, 1.6);
  spawnBlastJet(player.position.x, state.jumpY + 0.06, 1.45, 1.15);
  addShake(0.58, 0, 0.24);
}
function doIkeaFart() {
  state.ikeaFart = true;
  state.ikeaFartT = 0;
  state.ikeaFartEmitT = 0;
  state.rocketFx = false;
  performFartLaunch({ forceMul: 0.7, distanceMul: 0.45, launchVyMul: 0.86, gravityMul: 0.78, fxScaleMul: 1.15, fxDurationMul: 0.95, noPuff: true });
  spawnPuffBurst(player.position.x, state.jumpY + 0.65, 0.16, 1.05, 0.8);
  spawnFurnitureBurst(player.position.x, state.jumpY + 0.78, 42, 1.12);
  addShake(0.5, -0.04, 0.08);
}
function doBlastFart() {
  // 原地崩飞：垂直大力、水平保持原速不加速
  performFartLaunch({ forceMul: CONFIG.qte.fartForce.blast, keepSpeed: true });
}
// 玉米加农炮：正常起飞 + 空中约 1s 内每 60ms 连喷小屁云 + 玉米粒，配"噗噗噗"连响
function doCornGun() {
  performFartLaunch({ forceMul: CONFIG.qte.fartForce.regular, distanceMul: 2.15, gravityMul: 0.46, launchVyMul: 0.72, fxScaleMul: 0.8, fxDurationMul: 0.75 });
  for (let i = 0; i < 28; i++) {
    setTimeout(() => {
      const px = player.position.x, py = state.jumpY + 0.62;
      spawnMuzzleFlash(px, py, -1, (Math.random() - 0.5) * 0.45, 1.45);
      spawnOneFartParticle(px, py, 0.12, state.fartFxScaleMul * 0.42);
      spawnCornBurst(px, py, 11 + ((Math.random() * 8) | 0), { scaleMul: 1.75, spread: 1.75, speedMul: 1.25, lifeMul: 1.25 });
      addShake(0.12, -0.025, 0.01);
      playFart(0.4 + Math.random() * 0.25);
    }, i * 44);
  }
}
// 怎么塞入的？：跟超级大屁相当的强推进，起跳时放一次屁云，喷出大象时再放一次
function doElephant() {
  performFartLaunch({ forceMul: CONFIG.qte.fartForce.big, noPuff: true });
  // 起跳瞬间释放一次屁云
  spawnPuffBurst(player.position.x, state.jumpY + 0.65, 0.12, state.fartFxScaleMul, state.fartFxDurationMul);
  // 大象出现时再释放一次屁云（延迟 20ms，与喷出同步）
  setTimeout(() => {
    spawnPuffBurst(player.position.x, state.jumpY + 0.65, 0.15, state.fartFxScaleMul, state.fartFxDurationMul);
    const count = Math.max(1, Math.round(state.specialAmountMul || 1));
    for (let i = 0; i < count; i++) {
      setTimeout(() => spawnElephant(player.position.x - i * 0.26, state.jumpY + 0.65 + i * 0.12), i * 80);
    }
  }, 20);
}
// 火龙果屁：中高推进 + 屁云中持续喷出密集黑色火龙果籽（短暂尾迹）
function doDragonFruit() {
  performFartLaunch({ forceMul: CONFIG.qte.fartForce.fruit, distanceMul: 0.9, gravityMul: 0.58, launchVyMul: 1.34, fxScaleMul: 1.15, fxDurationMul: 1.4, noPuff: true });
  for (let i = 0; i < 16; i++) {
    setTimeout(() => {
      const px = player.position.x, py = state.jumpY + 0.82;
      spawnDragonPuffBurst(px, py, 0.12, 0.95, 1.15);
      spawnDragonSeedBurst(px, py, 14 + ((Math.random() * 8) | 0), { scaleMul: 1.55, spread: 1.65, lifeMul: 1.45 });
    }, 180 + i * 58);
  }
}
// 明天再见：标准偏强推进 + 喷出大量完整金针菇（高速向后，简单物理散落）
function doGoodbye() {
  performFartLaunch({ forceMul: CONFIG.qte.fartForce.fruit, distanceMul: 0.95, gravityMul: 0.6, launchVyMul: 1.42, fxScaleMul: 1.0, fxDurationMul: 1.2 });
  for (let i = 0; i < 19; i++) {
    setTimeout(() => spawnMushroomBurst(player.position.x, state.jumpY + 0.82, 7 + ((Math.random() * 5) | 0), { scaleMul: 1.55, spread: 1.55, lifeMul: 1.35 }), 220 + i * 82);
  }
}
// 垂直火箭：三段式火箭发射（持续力 + 脉冲力结合）
// ① 点火：持续纵向力推离地面（主循环持续力 + 初始推力）
// ② 级间分离：强烈纵向脉冲弹射
// ③ 飞出：持续横向加速 + 强横向脉冲 → 高速飞出
function doVerticalRocket() {
  state.verticalRocket = true;      // 主循环持续渐变力（点火纵向 → 第三段水平）
  state.verticalRocketT = 0;
  state.rocketFx = true;            // 全程持续喷火尾迹
  // ① 点火：初始纵向推力离地
  performFartLaunch({ forceMul: 1.0, launchVyMul: 1.1, distanceMul: 0.4 });
  // ② 级间分离：强烈纵向脉冲（0.8s）
  setTimeout(() => performFartLaunch({ forceMul: 1.0, launchVyMul: 1.6, distanceMul: 0.7, preserveHeight: true }), 800);
  // ③ 飞出：强横向脉冲（1.5s，配合持续横向力加速）
  setTimeout(() => performFartLaunch({ forceMul: 1.0, launchVyMul: 0.5, distanceMul: 2.2, preserveHeight: true }), 1500);
}
// 激光升天：向正下方喷射持续高能激光，极强纵向推进垂直升空，横向低
function doLaserUp() {
  performFartLaunch({ forceMul: 1.0, launchVyMul: 2.0, distanceMul: 0.3 });
  addShake(0.45, 0, -0.26);
  spawnLaserBeam(player.position.x, 0.9);
}
// 水果沙拉：强力推进 + 随机混合喷出火龙果籽/玉米粒/金针菇等食品颗粒
function doFruitSalad() {
  performFartLaunch({ forceMul: 1.0, distanceMul: 1.35, gravityMul: 0.58, launchVyMul: 1.38, fxScaleMul: 1.05, fxDurationMul: 1.35 });
  addShake(0.48, -0.1, 0.1);
  for (let i = 0; i < 26; i++) {
    setTimeout(() => {
      const px = player.position.x, py = state.jumpY + 0.85;
      const roll = Math.random();
      if (roll < 0.24) spawnCornBurst(px, py, 7 + ((Math.random() * 6) | 0), { scaleMul: 1.25, spread: 1.8, lifeMul: 1.35 });
      else if (roll < 0.48) spawnDragonSeedBurst(px, py, 12 + ((Math.random() * 9) | 0), { scaleMul: 1.5, spread: 1.85, lifeMul: 1.45 });
      else if (roll < 0.72) spawnMushroomBurst(px, py, 5 + ((Math.random() * 5) | 0), { scaleMul: 1.35, spread: 1.75, lifeMul: 1.25 });
      else spawnSaladChunkBurst(px, py, 12 + ((Math.random() * 10) | 0), { scaleMul: 1.4, spread: 1.9, lifeMul: 1.4 });
      if (i % 3 === 0) spawnDragonPuffBurst(px, py, 0.12, 0.55, 0.75);
    }, 160 + i * 50);
  }
}
// 屁式二级火箭：第一次强烈推进 → 短暂延迟 → 第二次更强空中喷射（带火焰爆发）
function doTwoStageRocket() {
  performFartLaunch({ forceMul: 1.0, distanceMul: 1.4, launchVyMul: 0.9 });
  addShake(0.58, -0.28, 0.06);
  spawnFireBurst(player.position.x, state.jumpY + 0.65, -1, -0.3, 10);
  setTimeout(() => {
    performFartLaunch({ forceMul: 1.0, distanceMul: 2.0, launchVyMul: 0.8, preserveHeight: true });
    addShake(0.72, -0.38, 0.04);
    spawnFireBurst(player.position.x, state.jumpY + 0.65, -1, -0.1, 14);
  }, 550);
}
function catFace(src, className, removeMs) {
  const layer = document.getElementById('catScreamLayer');
  if (!layer) return null;
  const img = document.createElement('img');
  img.className = `cat-face ${className}`;
  img.src = src;
  img.alt = '';
  layer.appendChild(img);
  setTimeout(() => img.remove(), removeMs);
  return img;
}
function doCatScream() {
  performFartLaunch({ forceMul: 0.9, distanceMul: 0.25, gravityMul: 0.56, launchVyMul: 1.65, fxScaleMul: 0.9, fxDurationMul: 1.0 });
  setTimeout(() => {
    if (state.phase !== 'run') return;
    state.timeStopped = true;
    const layer = document.getElementById('catScreamLayer');
    if (layer) layer.innerHTML = '';
    catFace('assets/cat-scream/cat-quiet.png', 'cat-calm', 920);
    setTimeout(() => catFace('assets/cat-scream/cat-surprise.png', 'cat-warn', 1050), 880);
    setTimeout(() => { if (layer) layer.innerHTML = ''; }, 1880);
    setTimeout(() => catFace('assets/cat-scream/cat-yell.png', 'cat-yell', 2350), 2120);
    setTimeout(() => {
      if (state.phase !== 'run') return;
      state.timeStopped = false;
      state.catScreamBoost = true;
      state.catScreamBoostT = 0;
      state.fartFlying = true;
      state.onGround = false;
      state.noFartParticles = false;
      state.fartGravityMul = 0.72;
      state.launchVx = Math.max(state.launchVx, 26 * state.eff.hForce);
      state.launchVy = Math.max(state.launchVy, 2.6 * state.eff.vForce);
      playCatScream();
      addShake(1.15, -0.65, 0.18);
      spawnDragonPuffBurst(player.position.x, state.jumpY + 0.7, 0.12, 0.7, 0.7);
    }, 2260);
  }, 520);
}
function showShotgun(px, py, angle) {
  shotgunMesh.visible = true;
  shotgunMesh.material.opacity = 1;
  shotgunMesh.position.set(px + Math.cos(angle) * 0.35, py + Math.sin(angle) * 0.22, 0.62);
  shotgunMesh.rotation.z = angle - Math.PI;
  shotgunMesh.scale.setScalar(1.55);
  clearTimeout(showShotgun.hideTimer);
  showShotgun.hideTimer = setTimeout(() => { shotgunMesh.visible = false; }, 260);
}
function shotgunRecoil(angle, power, shotIndex) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const px = player.position.x - 0.18;
  const py = state.jumpY + 0.62;
  showShotgun(px, py, angle);
  spawnMuzzleFlash(px + dx * 0.82, py + dy * 0.46, dx, dy, 1.65 + shotIndex * 0.25);
  spawnFireBurst(px + dx * 0.65, py + dy * 0.38, dx, dy, 12 + shotIndex * 4);
  spawnPuffBurst(px - dx * 0.22, py - dy * 0.14, 0.12, 0.55 + shotIndex * 0.18, 0.65);
  state.fartFlying = true;
  state.onGround = false;
  state.noFartParticles = false;
  state.fartGravityMul = 0.74;
  state.launchVx += -dx * power * state.eff.hForce;
  state.launchVy = Math.max(-2.5, state.launchVy + -dy * power * 0.72 * state.eff.vForce);
  state.shotgunSpinV += (shotIndex === 0 ? 17 : 22) * (Math.random() < 0.5 ? -1 : 1);
  addShake(shotIndex === 0 ? 0.85 : 1.05, -dx * 0.35, -dy * 0.25);
  playShotgunBlast(shotIndex === 0 ? 0.9 : 1.1);
}
function doDoubleBarrel() {
  performFartLaunch({ forceMul: 0.65, distanceMul: 0.18, gravityMul: 0.72, launchVyMul: 0.75, noPuff: true, soundMul: 0.65 });
  const first = Math.PI + Math.random() * (Math.PI / 2);
  setTimeout(() => shotgunRecoil(first, 18 + Math.random() * 4, 0), 90);
  setTimeout(() => {
    const second = Math.random() < 0.7
      ? Math.PI + (Math.random() * 1.55 - 0.25) * Math.PI
      : Math.random() * Math.PI * 2;
    shotgunRecoil(second, 20 + Math.random() * 5, 1);
  }, 520);
}
// 彩虹屁：标准偏强横向推进 + 持续数秒彩虹色屁云尾迹（视觉路径）
function doRainbow() {
  performFartLaunch({ forceMul: CONFIG.qte.fartForce.fruit, gravityMul: 0.82, launchVyMul: 0.82 });
  for (let i = 0; i < 20; i++) {
    setTimeout(() => spawnRainbowPuff(player.position.x, state.jumpY + 0.5, 3 + ((Math.random() * 3) | 0)), i * 70);
  }
}
// 大腚转转转：角色一边持续喷屁一边顺时针持续旋转向前滚动
function doBootySpin() {
  state.spinRolling = true;
  state.spinRollingT = 0;
  state.bootyPuffT = 0;
  performFartLaunch({ forceMul: CONFIG.qte.fartForce.fruit, distanceMul: 1.25, gravityMul: 1.45, launchVyMul: 0.08, fxScaleMul: 0.9, fxDurationMul: 0.95 });
}
function incidentSprayCount(n) {
  return Math.max(1, Math.round(n * (state.incidentSprayMul || 1)));
}
// 原地窜稀演出（喷屎粒子 + 音效 + 震屏，不扣命；withReset 结束回调处理风险/层数重置）
function incidentShow(withReset) {
  state.shitting = true;
  state.shitT = 0;
  state.speed = 0;
  const n = incidentSprayCount(CONFIG.poopFx.burst);
  const [sMin, sMax] = CONFIG.poopFx.burstScale;
  let spawned = 0;
  for (const p of poops) {
    if (p.life > 0) continue;
    if (spawned++ >= n) break;
    p.mesh.visible = true;
    p.mesh.position.set(player.position.x + (Math.random() - 0.5) * 0.9, state.jumpY + 0.45, 0.14);
    p.vx = (Math.random() - 0.5) * 3.4;
    p.vy = 1.2 + Math.random() * 3.4;
    p.life = 1.4 + Math.random() * 1.0;
    p.spin = (Math.random() - 0.5) * 26;
    p.mesh.rotation.z = Math.random() * 6;
    p.mesh.scale.setScalar(sMin + Math.random() * (sMax - sMin));
  }
  playSplat();
  addShake(0.8, 0, -0.1);   // 原地窜稀：中重震（不位移）
  for (let i = 0; i < 3; i++) setTimeout(() => playFart(0.9 + i * 0.3), i * 110);
  if (withReset) {
    setTimeout(() => {
      state.shitting = false;
      addShake(0.3, 0, -0.15);
      state.cumRisk = state.activeFoodEvent?.effects?.initialRisk || 0;   // 喷射后重置串稀概率到本局初始值
      state.boostStacks = 0;                    // 增压清空
      state.chargeStacks = 0;                   // 蓄压清空
      if (state.eff.riskRelease > 0) state.cumRisk = Math.max(0, state.cumRisk - state.eff.riskRelease);   // 压力释放阀：事故后额外释放风险
    }, 1200);
  }
}
// 失禁喷屎：屁 → 屎 → 向前上冲出 → 落地/出屏后结算
function doIncident() {
  if (state.phase !== 'run' || state.fartFlying || state.shitting || state.buildup) return;
  // 事故减免（NASA 吸收内衬概率 / 成人纸尿裤保护）：演出照常，不扣容量、不触发最终事故
  const diaperBlocked = state.protects > 0;
  const avoided = Math.random() < state.eff.absorbChance || (diaperBlocked ? (state.protects--, renderDiaperBar(), true) : false);
  if (avoided) {
    incidentShow(true);
    return;
  }
  // 非最后一次失禁：原地不动窜稀（不飞、不计距离），喷屎约 1.2s 后扣命继续
  if (state.lives > 1) {
    state.lives--;              // 窜稀开始即同步掉一节
    updateLivesUI();            // 屎条底端掉落动画同步开始
    showLifeTip(state.lives);
    incidentShow(true);
    return;
  }
  // 最后一次失禁：同步掉最后一节，保留飞出效果（向前上冲出，距离计入结算）
  state.lives--;
  updateLivesUI();   // 屎条最后一段同步掉落
  state.phase = 'dying';
  state.upgradeQteActive = false;
  state.upgradeQte = null;
  state.upgradeQteInputLockT = 0;
  $upgradeQte.classList.add('hidden');
  $qte.classList.remove('on');
  $qteCanvas.classList.remove('on');
  state.dyingT = 0;
  state.launchVx = 0;
  state.launchVy = 0;
  // 连环屁（酝酿）
  for (let i = 0; i < 3; i++) {
    setTimeout(() => playFart(0.9 + i * 0.3), i * 110);
  }
  // 喷屎粒子（超级加倍：40 粒、更大更猛）
  setTimeout(() => {
    const n = incidentSprayCount(CONFIG.poopFx.burst);
    const [sMin, sMax] = CONFIG.poopFx.burstScale;
    let spawned = 0;
    for (const p of poops) {
      if (p.life > 0) continue;
      if (spawned++ >= n) break;
      p.mesh.visible = true;
      p.mesh.position.set(player.position.x + (Math.random() - 0.5) * 0.9, state.jumpY + 0.45, 0.14);
      p.vx = (Math.random() - 0.5) * 3.4;
      p.vy = 1.2 + Math.random() * 3.4;
      p.life = 1.4 + Math.random() * 1.0;
      p.spin = (Math.random() - 0.5) * 26;
      p.mesh.rotation.z = Math.random() * 6;
      p.mesh.scale.setScalar(sMin + Math.random() * (sMax - sMin));
    }
    playSplat();
    addShake(1.2, 0.3, 0.15);   // 失禁喷射：重震 + 向前上冲
  }, 320);
  // 最后一次失禁：喷射前冲（还原原有推力）→ 空中翻滚 → 落地弹跳 → 泄气躺倒
  state.dyingPhase = 'fly';                        // 从飞出阶段开始（物理/动画统一）
  state.dyingBounce = 0;                           // 重置弹跳/静止
  state.dyingRest = 0;
  setTimeout(() => {
    const incidentMul = state.incidentLaunchMul || 1;
    state.launchVx = CONFIG.launch.vx * state.launchMul * CONFIG.launch.finalSpeedMul * incidentMul;   // 最后一失禁水平前冲更快
    state.launchVy = CONFIG.launch.vy * incidentMul;                                                    // 喷射套餐：事故推进更强
    state.onGround = false;
    burstConfetti(player.position.x, 0.7, 0.1, 12, 5);
    playFart(1.4);
  }, CONFIG.launch.delay1);
  setTimeout(() => {
    const incidentMul = state.incidentLaunchMul || 1;
    state.launchVx += CONFIG.launch.vx2 * state.launchMul * CONFIG.launch.finalSpeedMul * incidentMul;
    state.launchVy += CONFIG.launch.vy2 * incidentMul;
    burstConfetti(player.position.x + 0.3, 1.0, 0.1, 12, 6);
    playFart(1.7);
  }, CONFIG.launch.delay2);
}
// QTE 判定条 mesh：离屏 canvas 作为 CanvasTexture 贴图，mesh 挂相机子节点固定屏幕左侧（HUD 层），
// 随主画面一起渲染到低分辨率 RT → 被后处理链像素化（与主画面像素风格统一）。
qteTex = new THREE.CanvasTexture($qteCanvas);
qteTex.magFilter = THREE.NearestFilter;   // 贴图最近邻采样 → 像素块（同主画面）
qteTex.minFilter = THREE.NearestFilter;
const qteMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(1, 1),
  new THREE.MeshBasicMaterial({ map: qteTex, transparent: true, alphaTest: 0.01, depthTest: false, depthWrite: false, side: THREE.DoubleSide })
);
qteMesh.renderOrder = 10000;        // 分层：renderOrder 升序 → 最大值最后画（最前），QTE 判定条不被家具/粒子遮挡
qteMesh.frustumCulled = false;
qteMesh.onBeforeRender = renderer => renderer.clearDepth();
qteMesh.visible = false;
camera.add(qteMesh);
scene.add(camera);                  // camera 加入 scene，其子对象（qteMesh）才会被渲染
const QTE_MESH_DIST = 5;            // 判定条距相机前方距离（世界单位）
function layoutQteMesh() {
  const d = QTE_MESH_DIST;
  const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * d;   // 相机前方 d 处视锥半高
  const halfW = halfH * camera.aspect;                                     // 半宽随屏幕比例
  const cx = 0.10 * innerWidth + 16;                                  // 槽中心屏幕 x（与 updateQteLabel 一致：左 10% + 16px）
  const ndcX = (cx / innerWidth) * 2 - 1;                                  // → NDC
  qteMesh.position.set(ndcX * halfW, 0, -d);                               // 相机本地坐标：屏幕垂直居中，前方 d
  // 还原原版竖条大小（含帽余量：mesh 高 = 原版 barH × 816/720）
  const { meshW, meshH } = qteBarScreenSize();
  const ndcW = (meshW / innerWidth) * 2;
  const ndcH = (meshH / innerHeight) * 2;
  qteMesh.scale.set(ndcW * halfW, ndcH * halfH, 1);
}
layoutQteMesh();

export { qteLayout, qteLineHc, qteLineZone, qteLineQuality, qteLineZoneData, qteZoneLabel, qteOutcomeLabel, isQteBlocked, drawQteEvent, qteOutcomeChance, generateQteLayout, syncQteSpeed, resetQteSession, qteBounce, doFart, applyQteOutcome, updateCapsuleQueue, debugTriggerQteOutcome, doIncident, qteMesh, drawQteCanvas, updateQteLabel, showQteJudge, showQteBurstPhase, layoutQteMesh };
