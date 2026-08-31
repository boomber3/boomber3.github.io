// 模块化重构：由 paper-theater-runner.html 拆出
import { CONFIG } from '../config.js';
import { state, setPrevPlayerX } from '../core/state.js';
import { $title, $over, $eventPage, $evTitle, $evExp, $evRecord, $qte, $qteCanvas, $hud, $distBig, $expBar, $livesBar, $hint, $finalDay, $finalDist, $finalBest, $finalFarts, $finalExhaust, $finalEvents, $finalBuild, $overTitle, $overEn, $buildBar, $buildTooltip } from '../utils/dom.js';
import { progress, saveProgress, updateExpUI } from './growth.js';
import { buildEffects, ITEMS, ITEM_QUALITY, itemText, itemQDesc, qualityName } from './build.js';
import { hideUpgradeQte } from './upgrade-qte.js';
import { renderBuildBar } from '../ui/build-bar.js';
import { drawEvent, pendingEvent, setPendingEventById, applyEventEffects, clearCurrentEvent, eventText } from './event.js';
import { applyLanguage, onLanguageChange, t } from '../i18n.js';
import { resetQteSession, generateQteLayout } from './fart-qte.js';
import { groundTex } from '../world/stage.js';
import { REGION_SKY, clouds } from '../world/sky.js';
import { fgGrasses } from '../world/stage.js';
import { populateProps, resetPropCursor } from '../world/props.js';
import { resetBreakCursor } from '../world/breakables.js';
import { spawnBird, birds } from '../world/birds.js';
import { spawnPlane, planes } from '../world/planes.js';
import { spawnAerial, aerials } from '../world/aerials.js';
import { spawnGoose, geese, resetGooseCursor } from '../world/geese.js';
import { breakables } from '../world/breakables.js';
import { player, spinPivot, torsoPivot, legL, legR, armL, armR, head } from '../world/character.js';

// 新局重置场景：道具/草/云/加速道具重新铺满相机周围（真跑架构）
function resetWorldForNewRun() {
  populateProps();
  for (let i = 0; i < fgGrasses.length; i++) {
    fgGrasses[i].position.x = -9 + i * 3.4 + Math.random() * 2;
    fgGrasses[i].position.z = 1.0 + Math.random() * 1.9;   // y 保持各自基准（纸片草/模型），z 前后错落
  }
  for (let i = 0; i < clouds.length; i++) {
    clouds[i].mesh.position.set(-28 + i * 14 + Math.random() * 8, 6.5 + Math.random() * 4, -36 - Math.random() * 8);
  }
  for (const b of breakables) { b.active = false; b.mesh.visible = false; }
  for (const b of birds) spawnBird(b);
  for (const p of planes) spawnPlane(p);
  for (const a of aerials) spawnAerial(a);
  for (const g of geese) {
    if (g.mesh) {
      g.active = false;
      g.mesh.visible = false;
    }
    spawnGoose(g);
  }
  resetPropCursor();
  resetBreakCursor();
  resetGooseCursor();
}
// 清掉开局重力炸飞残留的内联样式（opacity/定位），否则回主页时 title/事件卡元素仍不可见
function resetScatteredEls() {
  const els = [
    $title.querySelector('.card'),
    $title.querySelector('.cb-banner'),
    $title.querySelector('.sfx-boom'),
    $title.querySelector('.sfx-pow'),
    $title.querySelector('.sfx-whoosh'),
    $title.querySelector('.cb-badge'),
    $title.querySelector('.cb-bubble'),
    $title.querySelector('.cb-footer'),
    $eventPage.querySelector('.card'),
  ].filter(Boolean);
  for (const el of els) {
    for (const prop of ['position', 'left', 'top', 'width', 'height', 'margin', 'zIndex', 'opacity', 'transform']) {
      el.style[prop] = '';
    }
  }
}
// 回到主页（结算面板点击）：显示标题页，等待玩家再次点击开幕
// 重新开始：回主页并重新抽取今日事件，弹出事件页等待玩家按下开始
function toggleRestart() {
  if (state.phase !== 'over') return;
  goHome();
  startShow();
}
function goHome() {
  if (startingGame || state.phase === 'opening' || state.phase === 'run' || state.phase === 'dying') return;
  state.phase = 'title';
  resetScatteredEls();
  state.paused = false;
  state.upgradeQteActive = false;
  state.upgradeQte = null;
  hideUpgradeQte();
  $over.classList.add('hidden');
  $eventPage.classList.add('hidden');
  $eventPage.classList.remove('open');
  $title.classList.remove('hidden');
  const card = $title.querySelector('.card');
  if (card) { card.classList.remove('fly'); void card.offsetWidth; }
  $qte.classList.remove('on');
  $qteCanvas.classList.remove('on');
  $expBar.classList.remove('on');
  $distBig.classList.remove('on');
  $livesBar.classList.remove('on');
  $buildBar.classList.remove('on');
  $hud.classList.remove('on');   // 隐藏左上角"下一个屁"卡片
}
function startShow() {
  if (state.phase === 'dying') return;
  if (startingGame || state.phase === 'opening' || state.phase === 'run') return;   // 防重复触发
  $over.classList.add('hidden');
  // 撞飞主卡片（今日事件出现时飞出），背景小元素保留
  const card = $title.querySelector('.card');
  if (card) {
    card.classList.remove('fly');
    void card.offsetWidth;
    card.classList.add('fly');
  }
  // 非首次奔跑（教学局后）：抽一个今日食品事件，撞飞后事件卡在中央上滑出现，title 小元素保留
  if (progress.days > 0) {
    drawEvent();
    setTimeout(() => {
      showPendingEventPage({ open: true });   // 撞飞后事件卡上滑到原主卡位置
    }, 180);
    return;
  }
  // 首局（无事件）：撞飞后隐藏 title（含小元素），开跑
  setTimeout(() => {
    $title.classList.add('hidden');
    beginRun();
  }, 320);
}
function showPendingEventPage({ open = false } = {}) {
  if (!pendingEvent) return false;
  $evTitle.textContent = t('eventTitle', { no: pendingEvent.no, title: eventText(pendingEvent, 'title') });
  $evExp.textContent = eventText(pendingEvent, 'experience');
  $evRecord.textContent = eventText(pendingEvent, 'record');
  $eventPage.classList.remove('hidden');
  $eventPage.classList.toggle('open', open);
  return true;
}
// 重力四散炸开：所有元素同时带重力自然掉出画面（不落地反弹）
function scatterGravity(els, onDone) {
  let remaining = 0;
  const H = innerHeight;
  els.forEach(el => {
    const rect = el.getBoundingClientRect();
    const baseX = rect.left, baseY = rect.top, w = rect.width, h = rect.height;
    el.style.position = 'fixed';
    el.style.left = baseX + 'px';
    el.style.top = baseY + 'px';
    el.style.width = w + 'px';
    el.style.height = h + 'px';
    el.style.margin = '0';
    el.style.zIndex = '25';
    let x = 0, y = 0;
    const vx = (Math.random() * 2 - 1) * 520;       // 横向初速（四散）
    let vy = -160 - Math.random() * 260;            // 向上初速（先炸开再下落）
    let rot = (Math.random() * 2 - 1) * 30;
    const vrot = (Math.random() * 2 - 1) * 360;     // 角速度
    const G = 1500;                                 // 重力加速度 px/s²
    let last = performance.now();
    remaining++;
    (function step(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      vy += G * dt;
      x += vx * dt; y += vy * dt;
      rot += vrot * dt;
      el.style.transform = `rotate(${rot}deg)`;
      el.style.left = (baseX + x) + 'px';
      el.style.top = (baseY + y) + 'px';
      // 掉出画面（含四周）即停止并隐藏
      if (baseY + y > H + 120 || baseX + x < -160 || baseX + x > innerWidth + 160) {
        el.style.opacity = 0;
        remaining--;
        if (remaining <= 0 && onDone) onDone();
        return;
      }
      requestAnimationFrame(step);
    })(last);
  });
}

let startingGame = false;   // 游戏开始进行中标志（防 continueFromEvent 重复触发）
function continueFromEvent() {
  if (startingGame) return;
  startingGame = true;
  // 游戏开始：所有元素（title 全部 + 事件卡）同时重力四散炸开，自然掉出画面
  const els = [
    $title.querySelector('.card'),
    $title.querySelector('.cb-banner'),
    $title.querySelector('.sfx-boom'),
    $title.querySelector('.sfx-pow'),
    $title.querySelector('.sfx-whoosh'),
    $title.querySelector('.cb-badge'),
    $title.querySelector('.cb-bubble'),
    $title.querySelector('.cb-footer'),
    $eventPage.querySelector('.card'),
  ].filter(Boolean);
  scatterGravity(els, () => {
    $eventPage.classList.add('hidden');
    $eventPage.classList.remove('open');
    $title.classList.add('hidden');
    startingGame = false;
    beginRun();
  });
}
function restartWithFoodEvent(eventId = null, { showPage = false } = {}) {
  startingGame = false;
  $title.classList.add('hidden');
  $over.classList.add('hidden');
  $eventPage.classList.add('hidden');
  $eventPage.classList.remove('open');
  if (eventId === 'random') drawEvent();
  else setPendingEventById(eventId);
  if (showPage && showPendingEventPage({ open: true })) return;
  beginRun({ force: true });
}
function beginRun({ force = false } = {}) {
  if (!force && (state.phase === 'opening' || state.phase === 'run' || state.phase === 'dying')) return;   // 防重复：避免幕布二次拉开
  state.phase = 'opening';
  state.paused = false;
  state.phaseT = 0;
  state.dist = 0;
  state.speed = 0;
  state.targetSpeed = CONFIG.run.base;
  state.farts = 0;
  state.exhaustExp = 0;
  progress.exhaustExp = 0;   // 等级经验每局重置（不跨局累计，局内重新升级）
  progress.bodyLevel = 0;
  updateExpUI();
  state.build = [];                             // 单局 Build 清空（本局重新构筑）
  renderBuildBar();
  state.upgradeQteActive = false;               // 兜底：升级 QTE 关闭
  state.upgradeQte = null;
  hideUpgradeQte();
  buildEffects();
  applyEventEffects();
  state.lives = CONFIG.run.lives + state.eff.capacity;   // 喷射容量 = 基础 + 道具
  resetQteSession({ clearFeedback: true });
  state.qteStaticT = 0; state.qteStaticConsumed = false; state.upgradeQtePending = 0;   // 新局重置静止缓冲/升级排队
  generateQteLayout();   // 新一局初始布局（随机/固定）
  state.cumRisk = 0;
  if (state.activeFoodEvent?.effects?.initialRisk) {
    state.cumRisk = Math.min(CONFIG.qte.cumRiskCap, state.activeFoodEvent.effects.initialRisk);
  }
  state.boostStacks = 0; state.chargeStacks = 0; state.rhythmStacks = 0;
  state.safeStacks = 0; state.lastQteQuality = null; state.consumeCharge = 0;
  state.protects = 0; state.capsuleList = [];
  state.spinEndT = 0; state.capsuleQueue = []; state.capsuleDelayT = 0; state.capsuleActive = false; state.capsuleFartFlying = false;
  state.lastFartT = -99;
  state.livesDrop = null;   // 重置屎条掉落动画
  state.fartFxScaleMul = 1;
  state.fartFxDurationMul = 1;
  state.rocketFart = false;
  state.rocketFx = false;
  state.verticalRocket = false; state.verticalRocketT = 0;
  state.spinRolling = false; state.spinRollingT = 0; state.bootyPuffT = 0;
  state.sportsSale = false; state.sportsSaleT = 0; state.sportsSaleEmitT = 0;
  state.sharknado = false; state.sharknadoT = 0; state.sharknadoEmitT = 0;
  state.ikeaFart = false; state.ikeaFartT = 0; state.ikeaFartEmitT = 0;
  state.timeStopped = false; state.catScreamBoost = false; state.catScreamBoostT = 0; state.shotgunSpinV = 0;
  state.cometImpact = false; state.cometPhase = 'idle'; state.cometT = 0; state.cometFireT = 0; state.cometHit = false;
  state.jumpY = 0; state.jumpVy = 0; state.onGround = true;
  state.fartFlying = false; state.fartFlyT = 0; state.shitting = false; state.shitT = 0; state.blastFlying = false;
  state.buildup = false; state.buildupT = 0; state.pendingSpeed = 0;
  state.dyingBounce = 0; state.dyingRest = 0; state.dyingPhase = 'fly';
  state.coyote = 0; state.buffer = 0;
  state.shake = 0;
  state.camY = 0;
  state.cameraFollowX = 0;
  state.cameraFollowReady = false;
  player.position.set(-6.5, 0, 0);   // 真跑：新局从开场位出发
  player.visible = true;
  // 重置角色姿态（防上一局死亡翻滚/瘫软残留）
  player.rotation.set(0, 0, 0);
  spinPivot.rotation.z = 0;
  torsoPivot.rotation.set(0, 0, 0);
  torsoPivot.position.y = 0.62;
  legL.rotation.set(0, 0, 0);
  legR.rotation.set(0, 0, 0);
  armL.rotation.set(0, 0, 0);
  armR.rotation.set(0, 0, 0);
  head.rotation.set(0, 0, 0);
  setPrevPlayerX(-6.5);
  groundTex.offset.x = 0;           // 背景纹理重置（无限循环）
  for (const g of Object.values(REGION_SKY)) {
    g.far.tex.offset.x = 0;
    g.near.tex.offset.x = 0;
  }
  resetWorldForNewRun();            // 场景流式重置：道具/草/云铺满相机周围
  $over.classList.add('hidden');
}
// 最后一次失禁飞行结束（自然落地）→ 结算
function onIncidentEnd() {
  if (state.phase !== 'dying') return;
  settleGame(false);                        // 命用完 → 结算
}
function renderFinalBuild() {
  $finalBuild.textContent = '';
  if (state.build.length) {
    const counts = {};
    for (const b of state.build) {
      const key = b.id + '|' + b.quality;
      counts[key] = (counts[key] || 0) + 1;
    }
    for (const [key, n] of Object.entries(counts)) {
      const [id, quality] = key.split('|');
      const it = ITEMS.find(i => i.id === id);
      if (!it) continue;
      const q = ITEM_QUALITY[quality] || ITEM_QUALITY.normal;
      const el = document.createElement('div');
      el.className = 'fb-item';
      el.style.background = q.color;
      el.dataset.tooltipName = `${itemText(it, 'name')} · ${qualityName(q)}${n > 1 ? ` x${n}` : ''}`;
      el.dataset.tooltipEffect = itemQDesc(it, q.key);
      el.dataset.tooltipFlavor = [itemText(it, 'effect'), itemText(it, 'flavor'), itemText(it, 'repeat')].filter(Boolean).join('\n');
      el.innerHTML = '<img src="' + it.icon + '" alt="">' + (n > 1 ? '<span class="fb-count">x' + n + '</span>' : '');
      $finalBuild.appendChild(el);
    }
  } else {
    $finalBuild.textContent = t('noBuild');
  }
}

// 结算：失禁(win=false) 或 到家(win=true)，记录 Day，展示本局数据
function settleGame(win) {
  if (state.phase !== 'dying' && state.phase !== 'run') return;
  state.upgradeQteActive = false;                // 兜底：升级 QTE 未结算时结束 → 关闭防卡死
  state.upgradeQte = null;
  hideUpgradeQte();
  progress.days += 1;                            // Day 累计
  progress.bestDist = Math.max(progress.bestDist || 0, Math.floor(state.dist));   // 记录历史最长距离
  saveProgress();
  state.phase = 'over';
  state.paused = false;
  state.phaseT = 0;
  $finalDay.textContent = progress.days;
  $finalDist.textContent = Math.floor(state.dist);
  $finalBest.textContent = progress.bestDist;
  $finalFarts.textContent = state.farts;
  $finalExhaust.textContent = state.exhaustExp;
  $finalEvents.textContent = pendingEvent ? 1 : 0;
  applyLanguage();
  renderFinalBuild();
  $overTitle.textContent = t('finalTitle');        // 无尽跑酷：跑到底力竭失禁为止
  $overEn.textContent = t('finalEn');
  $qte.classList.remove('on');
  $expBar.classList.remove('on');
  $distBig.classList.remove('on');
  $livesBar.classList.remove('on');
  $buildBar.classList.remove('on');
  $qteCanvas.classList.remove('on');
  $hud.classList.remove('on');   // 隐藏左上角"下一个屁"卡片
  clearCurrentEvent();
  setTimeout(() => $over.classList.remove('hidden'), 750);   // 等幕布合拢动画
}

function moveBuildTooltip(e) {
  const pad = 14;
  const rect = $buildTooltip.getBoundingClientRect();
  let x = e.clientX + 16;
  let y = e.clientY + 16;
  if (x + rect.width > innerWidth - pad) x = e.clientX - rect.width - 16;
  if (y + rect.height > innerHeight - pad) y = e.clientY - rect.height - 16;
  $buildTooltip.style.left = Math.max(pad, x) + 'px';
  $buildTooltip.style.top = Math.max(pad, y) + 'px';
}
function showBuildTooltip(el, e) {
  if (!$buildTooltip || !el) return;
  const esc = s => (s || '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  $buildTooltip.innerHTML =
    `<div class="bt-name">${esc(el.dataset.tooltipName)}</div>` +
    `<div class="bt-effect">${esc(el.dataset.tooltipEffect).replace(/\n/g, '<br>')}</div>` +
    `<div class="bt-flavor">${esc(el.dataset.tooltipFlavor).replace(/\n/g, '<br>')}</div>`;
  $buildTooltip.classList.add('on');
  moveBuildTooltip(e);
}
function hideBuildTooltip() {
  if ($buildTooltip) $buildTooltip.classList.remove('on');
}
$finalBuild.addEventListener('pointerover', e => {
  const item = e.target instanceof Element ? e.target.closest('.fb-item') : null;
  if (item) showBuildTooltip(item, e);
});
$finalBuild.addEventListener('pointermove', e => {
  if ($buildTooltip?.classList.contains('on')) moveBuildTooltip(e);
});
$finalBuild.addEventListener('pointerout', e => {
  if (!(e.relatedTarget instanceof Element) || !e.relatedTarget.closest('.fb-item')) hideBuildTooltip();
});

onLanguageChange(() => {
  applyLanguage();
  if (!$eventPage.classList.contains('hidden')) showPendingEventPage({ open: $eventPage.classList.contains('open') });
  if (state.phase === 'over') {
    renderFinalBuild();
    $overTitle.textContent = t('finalTitle');
    $overEn.textContent = t('finalEn');
  }
});

export { startShow, continueFromEvent, beginRun, restartWithFoodEvent, settleGame, onIncidentEnd, goHome, toggleRestart };
