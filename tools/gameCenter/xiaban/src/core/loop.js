// 模块化重构：由 paper-theater-runner.html 拆出
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { state, GRAVITY, JUMP_V, addShake, prevPlayerX, setPrevPlayerX } from './state.js';
import { renderer, scene, camera } from './engine.js';
import { $qteResult, $qrJudge, $qrLink, $qteBurstWrap, $qteCanvas, $qte, $dist, $distBig, $vign, $chance, $hud, $expBar, $livesBar, $hint, $buildBar, $pauseBtn, $mushroomTripLayer } from '../utils/dom.js';
import { t as uiText } from '../i18n.js';
import { easeInOut, easeOutBack } from '../utils/math.js';
import { floatTexts } from '../utils/float-text.js';
import { ground, groundTex, edge, curtL, curtR, CURT_SLIDE, fgGrasses, TEX_WORLD_LEN } from '../world/stage.js';
import { REGION_SKY, sun, clouds } from '../world/sky.js';
import { props, placeProp, PROP_EDGE } from '../world/props.js';
import { birds, spawnBird, smashBird } from '../world/birds.js';
import { planes, spawnPlane, updatePlanes } from '../world/planes.js';
import { updateAerials } from '../world/aerials.js';
import { updateGeese } from '../world/geese.js';
import { breakables, placeBreakable, smashBreakable, bits } from '../world/breakables.js';
import { player, spinPivot, torsoPivot, legL, legR, armL, armR, head, setCharacterScale, updateRocketFlame, updateRocketFlameParticles, updateCharacterMutation } from '../world/character.js';
import { fartClouds, puffs, poops, corns, dragonSeeds, mushrooms, saladChunks, confetti, spawnOneFartParticle, spawnOilFartBits, updateMuzzleFlashes, updateSaladChunks, updateLaserBeams, updateFireParticles, spawnFireBurst, updateRainbowPuffs, updateFireworks } from '../systems/particles.js';
import { updateElephants } from '../systems/elephant.js';
import { spawnSportsBallBurst, updateSportsBalls } from '../systems/sports-balls.js';
import { spawnSharkBurst, updateSharks } from '../systems/sharknado.js';
import { spawnFurnitureBurst, updateFurniture } from '../systems/furniture.js';
import { triggerCometImpact, triggerHeavyMeteorRocks, updateCometFx } from '../systems/comet-impact.js';
import { updateMediumRareBurger } from '../systems/burger-event.js';
import { spawnHeavyLandingFx, updateHeavyMetalFx } from '../systems/heavy-metal.js';
import { playFart, playSplat } from '../systems/audio.js';
import { isQteBlocked, generateQteLayout, qteBounce, drawQteCanvas, qteMesh, showQteBurstPhase, applyQteOutcome, updateCapsuleQueue, qteLineQuality, qteOutcomeChance, qteOutcomeLabel, qteLineZoneData, qteZoneLabel } from '../systems/fart-qte.js';
import { drawLivesBar } from '../ui/hud.js';
import { updateCameraFollow, traceCamera } from './camera.js';
import { updateUpgradeQte, startUpgradeQte } from '../systems/upgrade-qte.js';
import { updateRegionBackground } from '../systems/region-bg.js';
import { onIncidentEnd } from '../systems/session.js';

// ---------- 主循环 ----------
const clock = new THREE.Clock();
let prevQteCanScan = false;   // 上一帧 QTE 是否可扫动（边沿检测：恢复扫动瞬间启动静止缓冲）

function incidentDripRepeats() {
  const mul = state.incidentSprayMul || 1;
  const guaranteed = Math.max(1, Math.round(mul));
  return { guaranteed, max: guaranteed * 2 };
}
function heavyGravityMul() {
  return state.activeFoodEvent?.id === 'flintWater02' ? (state.heavyGravityMul || 1.5) : 1;
}
function heavyFallGravityMul(vy) {
  return vy < 0 ? heavyGravityMul() : 1;
}
function applyHeavyLandingBoost(impact, airborneBoost = 1) {
  if (state.activeFoodEvent?.id !== 'flintWater02' || impact <= 4.5) return;
  const boost = Math.min(18, Math.max(0, (impact - 4.5) * 0.62 * airborneBoost));
  state.speed = Math.min(CONFIG.fart.speedCap, Math.max(state.speed, 2.5) + boost);
  state.fartPush = Math.max(state.fartPush, Math.min(1.8, 0.28 + boost * 0.08));
  state.heavyLandingBoostT = Math.max(state.heavyLandingBoostT, 0.42);
  state.heavyLandingSquashT = Math.max(state.heavyLandingSquashT, 0.32);
  state.heavyLandingSquashPower = Math.max(state.heavyLandingSquashPower, Math.min(1, impact / 24));
  addShake(Math.min(0.85, 0.12 + impact * 0.035), boost * 0.008, -Math.min(0.32, impact * 0.016));
  spawnHeavyLandingFx(player.position.x, impact);
  if (impact >= 13) triggerHeavyMeteorRocks(player.position.x, impact);
}
function clearJuiceFartState() {
  state.juiceFartId = null;
  state.juiceFartColor = null;
  state.juiceFartH = 1;
  state.juiceFartV = 1;
  state.juiceFartRisk = 1;
  state.juiceFartFx = 1;
}
function updateMushroomTripOverlay(t) {
  const active = state.activeFoodEvent?.id === 'wildMushroom11' && (state.phase === 'run' || state.phase === 'dying');
  if (!active) {
    document.body.classList.remove('mushroom-trip');
    document.body.style.setProperty('--mushroom-trip', '0');
    document.body.style.setProperty('--mushroom-hue', '0');
    if ($mushroomTripLayer) {
      $mushroomTripLayer.style.opacity = '0';
      $mushroomTripLayer.style.setProperty('--trip-strength', '0');
    }
    return;
  }
  const age = Math.max(0, state.mushroomT || 0);
  const build = Math.min(1, age / 70);
  const phasePulse = state.mushroomPhase === 'tilt' || state.mushroomPhase === 'hold' ? 1 : 0.42;
  const rollPower = Math.min(1, Math.abs(state.mushroomRoll || 0) / Math.PI);
  const strength = Math.min(1, 0.16 + build * 0.48 + rollPower * 0.34);
  const breathe = 0.86 + Math.sin(t * 0.62) * 0.10 + Math.sin(t * 0.19 + 1.4) * 0.06;
  const opacity = Math.min(0.46, strength * (0.52 + phasePulse * 0.28) * breathe);
  document.body.classList.add('mushroom-trip');
  document.body.style.setProperty('--mushroom-trip', (0.15 + strength * 0.7).toFixed(3));
  document.body.style.setProperty('--mushroom-hue', String(Math.round(Math.sin(t * 0.23) * 16 + Math.sin(t * 0.07) * 22)));
  if ($mushroomTripLayer) {
    $mushroomTripLayer.style.opacity = opacity.toFixed(3);
    $mushroomTripLayer.style.setProperty('--trip-strength', (0.3 + strength * 0.7).toFixed(3));
  }
}

function animate() {
  requestAnimationFrame(animate);
  let dt = Math.min(clock.getDelta(), 0.033);
  const rawDt = dt;                            // 真实帧时长（升级 QTE 指针用：世界慢、准星正常）
  const t = clock.elapsedTime;
  // 子弹时间：升级道具 QTE 时游戏慢动作（世界/角色/放屁 QTE 同步变慢，指针仍用真实时间扫动）
  if (state.paused) {
    dt = 0;
  } else if (state.upgradeQteActive) {
    dt *= 0.06;
    updateUpgradeQte(rawDt);
  }
  if (!state.paused && state.timeStopped) dt = 0;
  state.phaseT += dt;

  // --- 速度 & 距离 ---
  if (state.phase === 'title' || state.phase === 'over') { state.speed = 0; state.targetSpeed = 0; }
  else {
    if (state.phase === 'run') {
      if (state.shitting) {
        state.targetSpeed = 0;                    // 原地窜稀：急停
      } else if (state.buildup) {
        state.targetSpeed = 2;                    // 酝酿：捂着慢慢走
      } else {
        state.targetSpeed = Math.min(CONFIG.fart.speedCap,
          (CONFIG.run.base + state.phaseT * CONFIG.run.ramp) * state.eff.speedMul);   // 速度受腿力/道具修正
        if (state.fartBoost > 0) state.targetSpeed = Math.min(CONFIG.fart.speedCap, state.targetSpeed + state.fartBoost * CONFIG.fart.boostMul);   // 放屁持续推力
        if (state.qte > CONFIG.qte.holdAt) state.speed *= 1 - (state.qte - CONFIG.qte.holdAt) * CONFIG.qte.holdSlope;   // 憋屁惩罚
      }
    }
    if (state.phase === 'dying') state.targetSpeed = Math.max(0, state.speed - 1.6 * dt);   // 死亡减速
    state.speed += (state.targetSpeed - state.speed) * dt * CONFIG.run.smooth;
    // 距离：起飞用 launchVx 计，原地窜稀不计
    if (state.phase !== 'dying' && !state.fartFlying && !state.shitting) state.dist += state.speed * dt;
  }
  if (state.fartBoost > 0) state.fartBoost -= dt;
  if (state.heavyLandingBoostT > 0) {
    state.heavyLandingBoostT = Math.max(0, state.heavyLandingBoostT - dt);
    state.targetSpeed = Math.max(state.targetSpeed, state.speed);
  }
  if (state.heavyLandingSquashT > 0) {
    state.heavyLandingSquashT = Math.max(0, state.heavyLandingSquashT - dt);
    if (state.heavyLandingSquashT === 0) state.heavyLandingSquashPower = 0;
  }
  if (state.recentOutcomeT > 0) {
    state.recentOutcomeT = Math.max(0, state.recentOutcomeT - dt);
    if (state.recentOutcomeT === 0) {
      // 三段式到点一起收起：按键结算 + 关联词 + 星芒结果
      $qteResult.classList.remove('on');
      $qrJudge.classList.remove('on');
      $qrLink.classList.remove('on');
      $qteBurstWrap.classList.remove('on');
    }
  }
  const sp = state.speed;
  const dxP = player.position.x - prevPlayerX;   // 本帧角色位移：驱动背景滚动与场景流式生成

  // --- 幕布 & 开幕（幕布相对摄像机，真跑架构下跟随镜头） ---
  if (state.phase !== 'title' && state.phase !== 'over') {
    if (state.phase === 'opening') {
      // 开幕：幕布从合拢到全开（只拉一次）
      const k = Math.min(1, state.phaseT / 1.6);
      const e = easeInOut(k);
      curtL.position.x = camera.position.x - 20 - e * CURT_SLIDE;
      curtR.position.x = camera.position.x + 20 + e * CURT_SLIDE;
      // 角色从左侧滑入（用当前 phaseT，在切 run 前完成，避免被重置后的 phaseT 覆盖回起点）
      const k2 = Math.min(1, state.phaseT / 1.2);
      player.position.x = -6.5 + 4.5 * easeInOut(k2);
      if (k >= 1) {
        state.phase = 'run';
        state.phaseT = 0;
        $hud.classList.add('on');
        $distBig.classList.add('on');             // 顶部距离数字
        $expBar.classList.add('on');              // 显示升级进度条（下方）
        $livesBar.classList.add('on');            // 显示右侧生命值屎条
        $buildBar.classList.add('on');            // 显示底部道具栏
        $qte.classList.add('on');                 // 显示放屁 QTE 判定条（贴图 + 轮次文字）
        $qteCanvas.classList.add('on');
        $hint.classList.remove('hidden');
        setTimeout(() => $hint.classList.add('hidden'), 3600);
      }
    } else if (state.phase === 'run') {
      // 奔跑：幕布保持全开，不再重新拉开
      curtL.position.x = camera.position.x - 20 - CURT_SLIDE;
      curtR.position.x = camera.position.x + 20 + CURT_SLIDE;
    } else if (state.phase === 'dying') {
      // 幕布全程保持全开（谢幕统一在 over 阶段收拢，避免重复收幕出现两次谢幕）
      curtL.position.x = camera.position.x - 20 - CURT_SLIDE;
      curtR.position.x = camera.position.x + 20 + CURT_SLIDE;
    }
  } else if (state.phase === 'over') {
    // 谢幕：飞行结束后幕布缓缓合拢，谢幕卡随之弹出
    const k = easeInOut(Math.min(1, state.phaseT / 0.75));
    curtL.position.x = camera.position.x - 20 - CURT_SLIDE * (1 - k);
    curtR.position.x = camera.position.x + 20 + CURT_SLIDE * (1 - k);
  }

  // --- 背景：按角色位移滚动 + 背景板跟随摄像机（真跑：角色前进多少，地面/远山滚多少） ---
  groundTex.offset.x += dxP / TEX_WORLD_LEN;
  for (const g of Object.values(REGION_SKY)) {
    g.far.tex.offset.x += dxP / g.far.texWorldLen;
    g.near.tex.offset.x += dxP / g.near.texWorldLen;
  }
  setPrevPlayerX(player.position.x);
  // 固定宽度的背景板跟随摄像机，避免角色跑远后背景被甩在身后
  ground.position.x = camera.position.x;
  edge.position.x = camera.position.x;
  for (const g of Object.values(REGION_SKY)) {
    g.far.mesh.position.x = camera.position.x;
    g.near.mesh.position.x = camera.position.x;
    g.sky.position.x = camera.position.x;
  }
  updateRegionBackground(state.dist);   // 地区背景交叉淡化 + 雾/背景/地面色调

  // 云：自身漂移 + 相对相机流式回收（角色跑过后移回前方）
  for (const c of clouds) {
    c.mesh.position.x -= c.drift * dt;
    if (c.mesh.position.x < camera.position.x - 34) {
      c.mesh.position.x = camera.position.x + 32 + Math.random() * 14;
    }
  }
  sun.position.x = camera.position.x + 7.5;   // 太阳相对镜头固定（超远背景）
  // 飞鸟：向左飞 + 上下浮动 + 翅膀摆动，撞到惊飞 + 经验
  for (const b of birds) {
    if (!b.active) continue;
    b.mesh.position.x -= b.speed * dt;
    b.mesh.position.y = b.y + Math.sin(t * 1.3 + b.phase) * 0.15;
    b.mesh.rotation.z = Math.sin(t * 3 + b.phase) * 0.35;
    // 撞鸟：仅玩家放屁起飞（跳得高）够得着 → 惊飞 + 经验 + 碎片
    if (Math.abs(b.mesh.position.x - player.position.x) < 1.0 &&
        Math.abs(b.mesh.position.y - (player.position.y + 0.6)) < 1.0) {
      smashBird(b);
    }
    if (b.mesh.position.x < camera.position.x - 14) spawnBird(b);
  }

  // 3D 飞机：向左飞 + 摇摆，撞到击落坠落 + 经验（与鸟共存）
  updatePlanes(dt, t);
  updateAerials(dt, t);
  updateGeese(dt, t, dxP);

  // 中景：流式生成（相机前方固定距离，按角色位移推进生成线）+ 回收（相机后方）+ 翻页立起
  state.propCursor -= dxP;   // 喷射时角色快进，生成线同步快速推进，前方不会空
  if (state.propCursor < PROP_EDGE) {
    const free = props.find(q => !q.alive);
    if (free) { placeProp(free, camera.position.x + PROP_EDGE, true); state.propCursor = PROP_EDGE + 1 + Math.random() * 2; }   // 更密：间隔 1-3 单位
    else state.propCursor += 5;
  }
  for (const p of props) {
    if (!p.alive) continue;
    if (p.pop) {
      p.pop.t += dt;
      const k = Math.min(1, p.pop.t / p.pop.dur);
      p.mesh.rotation.x = -1.35 * (1 - easeOutBack(k));
      if (k >= 1) p.pop = null;
    }
    if (p.mesh.position.x < camera.position.x - 16 - p.kind.h) { p.alive = false; p.mesh.visible = false; }
  }

  // 可破坏物：流式生成 + 玩家碰撞破坏 + 回收
  state.breakCursor -= dxP;
  if (state.breakCursor < 8) {
    const free = breakables.find(c => !c.active);
    if (free) {
      placeBreakable(free, camera.position.x + 12 + Math.random() * 4);
      state.breakCursor = 8 + CONFIG.breakables.gap + Math.random() * (CONFIG.breakables.gap * 2);   // 间隔 3~9 距离
    } else state.breakCursor += 5;
  }
  for (const b of breakables) {
    if (!b.active) continue;
    // 翻页立起动画
    if (b.pop) {
      b.pop.t += dt;
      const k = Math.min(1, b.pop.t / b.pop.dur);
      b.mesh.rotation.x = -1.35 * (1 - easeOutBack(k));
      if (k >= 1) b.pop = null;
    }
    // 仅地面附近（jumpY<0.8）碰到破坏；空中跳起/起飞越过则不破坏
    if (b.destructible &&
        Math.abs(b.mesh.position.x - player.position.x) < (b.hitRange || CONFIG.breakables.range) &&
        player.position.y < 0.8) {
      smashBreakable(b);
    }
    if (b.mesh.position.x < camera.position.x - 8) { b.active = false; b.mesh.visible = false; }
  }

  // 前景草：相对相机流式（落在后方即移到中景~前方，保持地面不空）
  for (const m of fgGrasses) {
    if (m.position.x < camera.position.x - 9) { m.position.x = camera.position.x + 12 + Math.random() * 18; m.position.z = 1.0 + Math.random() * 1.9; }   // 从右缘外滑入，避免视野内 pop-in；z 前后错落
  }

  // --- 放屁 QTE：5 色条固定中间，判定线左右往返；每趟加速，满 rounds 往返未按 → 强制最坏 ---
  // 每次从不可扫动恢复可扫动（放屁结束 → 下次 QTE 开始）时先静止缓冲，再开始扫动
  const QTE_STATIC_T = 1;   // 静止缓冲秒数（两次 QTE 间隔）
  const qteCanScan = state.phase === 'run' && !isQteBlocked() &&
      (!state.fartFlying || state.capsuleFartFlying) &&   // 仅胶囊追加排气飞行中 QTE 照常扫动
      !state.shitting && !state.buildup && !state.qteResolving && state.spinEndT <= 0;
  if (qteCanScan) {
    if (!prevQteCanScan) {
      state.qteStaticConsumed = false;   // 本次静止期重置：可再弹一个升级 QTE
      if (!state.capsuleActive) state.qteStaticT = QTE_STATIC_T;   // 胶囊追加排气落地不重置静止缓冲
    }
    if (state.qteStaticT > 0) {
      state.qteStaticT = Math.max(0, state.qteStaticT - dt);   // 静止缓冲：判定线暂不移动
      // 静止缓冲期内弹出排队中的升级道具 QTE（每次静止期弹一个）
      if (state.upgradeQtePending > 0 && !state.upgradeQteActive && !state.qteStaticConsumed) {
        state.upgradeQtePending--;
        state.qteStaticConsumed = true;
        startUpgradeQte();
      }
    } else {
      if (state.qteLayoutDirty) { generateQteLayout(); state.qteLayoutDirty = false; }   // 静止结束才开始新一轮布局重排
      state.qte += state.qteDir * dt * state.qteSpeed;
      if (state.qte >= 0.5) { state.qte = 0.5; qteBounce(); }
      else if (state.qte <= -0.5) { state.qte = -0.5; qteBounce(); }
    }
  }
  prevQteCanScan = qteCanScan;
  if (state.activeFoodEvent?.id === 'protein01') {
    if (qteCanScan) {
      state.proteinQteT += dt;
      const k = Math.min(1, state.proteinQteT / 2.65);
      const wobble = Math.sin(t * 24) * 0.018 * k + Math.sin(t * 39) * 0.012 * k * k;
      state.proteinBloatScale = 1 + k * 0.72;
      setCharacterScale(1 + k * 1.08 + wobble, state.proteinBloatScale + wobble * 0.35);
    } else if (state.proteinDeflateT > 0) {
      const deflateDur = 0.72;
      state.proteinDeflateT = Math.max(0, state.proteinDeflateT - dt);
      const k = state.proteinDeflateT / deflateDur;
      const power = Math.max(1, Math.min(1.5, state.proteinBloatPower || state.proteinBloatScale || 1));
      const scale = 1 + (power - 1) * k;
      const wobble = Math.sin(t * 34) * 0.02 * k;
      state.proteinBloatScale = scale;
      setCharacterScale(1 + (scale - 1) * 1.5 + wobble, scale + wobble * 0.3);
      state.proteinLeakT -= dt;
      while (state.proteinLeakT <= 0 && state.proteinDeflateT > 0) {
        state.proteinLeakT += 0.055;
        spawnOneFartParticle(player.position.x, player.position.y + 0.52 + Math.random() * 0.12, 0.14, state.fartFxScaleMul * (0.7 + power * 0.18));
      }
      if (state.proteinDeflateT <= 0) {
        state.proteinBloatScale = 1;
        state.proteinLeakT = 0;
        setCharacterScale(1);
      }
    } else if (!state.fartFlying && !state.buildup && !state.shitting) {
      state.proteinQteT = 0;
      state.proteinBloatScale = 1;
      state.proteinBloatPower = 1;
      setCharacterScale(1);
    }
  }
  if (state.fartPush > 0) state.fartPush -= dt;   // 冲刺姿态消退
  const qteOn = $qteCanvas.classList.contains('on');
  qteMesh.visible = qteOn;   // mesh 显隐跟随 .on 状态（离屏 canvas 仅作纹理源）
  if (qteOn) { drawQteCanvas(); }   // 判定条
  const pauseVisible = state.phase === 'opening' || state.phase === 'run' || state.phase === 'dying';
  $pauseBtn.classList.toggle('hidden', !pauseVisible);
  $pauseBtn.classList.toggle('paused', state.paused);
  $pauseBtn.title = state.paused ? uiText('resume') : uiText('pause');
  $pauseBtn.setAttribute('aria-label', state.paused ? uiText('resume') : uiText('pause'));
  drawLivesBar(dt);   // 生命值屎条（含底端掉落动画）
  // 酝酿期（按键→事件揭晓前）：生命条随本次窜稀概率抖动，概率越高幅度越大；其他时刻复位
  if (state.buildup && state.phase === 'run') {
    const chance = state.diarrheaChance || 0;
    const amp = 72 * chance * chance;   // 平方增强：低概率几乎不抖，高概率剧烈晃动
    const dx = (Math.random() * 2 - 1) * amp;
    $livesBar.style.transform = `translateX(${dx}px) translateY(-50%)`;
  } else {
    $livesBar.style.transform = '';
  }
  updateCapsuleQueue(dt);
  // 数字飘字：上浮淡出
  for (const ft of floatTexts) {
    if (ft.life <= 0) continue;
    ft.life -= dt;
    ft.y -= 42 * dt;
    ft.el.style.top = ft.y + 'px';
    if (ft.life < 0.35) ft.el.style.opacity = 0;
    if (ft.life <= 0) ft.el.style.opacity = 0;
  }

  // --- 角色物理 ---
  if (state.phase === 'run') {
    const hForce = state.eff.hForce;
    const vForce = state.eff.vForce;
    // 鲨卷风：独立演出计时。角色可落地继续跑，但鲨鱼旋风会完整转完再向后退去。
    if (state.sharknado) {
      const dur = 5.7;
      const k = Math.min(1, state.sharknadoT / dur);
      if (state.fartFlying) {
        const floatWave = Math.sin(state.sharknadoT * 3.05);
        const targetY = 3.35 + Math.sin(k * Math.PI) * 0.72 + floatWave * 0.52;
        const hoverPull = (targetY - state.jumpY) * (7.6 * (1 - k * 0.24));
        state.launchVx += (2.75 + 2.25 * k) * hForce * dt;
        state.launchVy += (4.2 + hoverPull + floatWave * 0.85) * vForce * dt;
        if (state.jumpY > targetY + 0.28 && state.launchVy > 0) state.launchVy *= 0.52;
        if (k < 0.9 && state.jumpY > 1.0 && state.launchVy < -1.05) state.launchVy = -1.05;
        state.launchVx = Math.min(10.8 * hForce, state.launchVx);
      } else {
        state.speed = Math.min(CONFIG.fart.speedCap, state.speed + (2.4 + k * 1.8) * hForce * dt);
      }
      state.sharknadoEmitT += dt;
      while (state.sharknadoEmitT >= 0.12) {
        state.sharknadoEmitT -= 0.12;
        spawnSharkBurst(player.position.x, state.jumpY + 0.9, 1 + ((Math.random() * 2) | 0), 0.58 + k * 0.16);
      }
      state.sharknadoT += dt;
      if (state.sharknadoT >= dur) state.sharknado = false;
    }
    // 疯狂宜家屁：从角色身上向画面内炸开，随后像娃娃机奖品一样堆在地上。
    if (state.ikeaFart) {
      const dur = 2.45;
      const k = Math.min(1, state.ikeaFartT / dur);
      if (state.fartFlying) {
        const targetY = 1.85 + Math.sin(k * Math.PI) * 0.45;
        const lift = Math.max(0, targetY - state.jumpY) * (3.2 * (1 - k * 0.45));
        state.launchVx += (0.95 + 0.5 * k) * hForce * dt;
        state.launchVy += (1.35 + lift) * vForce * dt;
        if (k < 0.68 && state.jumpY > 0.75 && state.launchVy < -0.35) state.launchVy = -0.35;
        state.launchVx = Math.min(6.6 * hForce, state.launchVx);
      }
      state.ikeaFartEmitT += dt;
      while (state.ikeaFartEmitT >= 0.07) {
        state.ikeaFartEmitT -= 0.07;
        spawnFurnitureBurst(player.position.x, state.jumpY + 0.72, 4 + ((Math.random() * 4) | 0), 1.0 + k * 0.2);
      }
      state.ikeaFartT += dt;
      if (state.ikeaFartT >= dur) state.ikeaFart = false;
    }
    if (state.fartFlying) {
      state.fartFlyT += dt;
      // 放屁起飞：向前上冲出（一次性大推力），落地后恢复奔跑
      if (state.rocketFart) {
        state.launchVx = Math.min(CONFIG.qte.rocket.continuousSpeedCap,
          state.launchVx + CONFIG.qte.rocket.continuousAccel * hForce * dt);
      }
      if (state.catScreamBoost) {
        state.catScreamBoostT += dt;
        state.launchVx = Math.min(34 * hForce, state.launchVx + 18 * hForce * dt);
        if (state.catScreamBoostT >= 1.45) state.catScreamBoost = false;
      }
      if (Math.abs(state.shotgunSpinV) > 0.02) {
        spinPivot.rotation.z += state.shotgunSpinV * dt;
        state.shotgunSpinV *= Math.max(0, 1 - 1.55 * dt);
      }
      if (state.cometImpact) {
        state.cometT += dt;
        if (state.cometPhase === 'ascend') {
          state.launchVx = Math.max(state.launchVx, 1.6 * hForce);
          state.launchVy += (12.2 + Math.max(0, 14.8 - state.jumpY) * 1.18) * vForce * dt;
          spinPivot.rotation.z = Math.sin(state.cometT * 9) * 0.08;
          if (state.jumpY >= 15.0 || state.cometT >= 1.9) {
            state.cometPhase = 'hold';
            state.cometT = 0;
            state.launchVx = 0.65 * hForce;
            state.launchVy = 0;
            spinPivot.rotation.z = -0.28;
          }
        } else if (state.cometPhase === 'hold') {
          state.launchVx = 0.65 * hForce;
          state.launchVy = 0;
          state.jumpY = 14.9 + Math.sin(state.cometT * 6.5) * 0.14;
          spinPivot.rotation.z += (-0.52 - spinPivot.rotation.z) * Math.min(1, dt * 9);
          if (state.cometT >= 0.45) {
            state.cometPhase = 'dive';
            state.cometT = 0;
            state.cometFireT = 0;
            state.fartGravityMul = 0.12;
            state.launchVx = 7.2 * hForce;
            state.launchVy = -4.2 * vForce;
          }
        } else if (state.cometPhase === 'dive') {
          const diveSpeed = Math.min(38, 9 + state.cometT * 21 + Math.max(0, 10 - state.jumpY) * 1.45);
          state.launchVx = diveSpeed * 0.866 * hForce;
          state.launchVy = -diveSpeed * 0.5 * vForce;
          spinPivot.rotation.z += (-0.52 - spinPivot.rotation.z) * Math.min(1, dt * 12);
          addShake(Math.min(0.42, 0.08 + state.cometT * 0.12), 0.02, -0.025);
        }
      }
      const slopChaosOutcome = state.qteOutcome === 'bigFart' || state.qteOutcome === 'rocket' ||
        state.qteOutcome === 'sportsSale' || state.qteOutcome === 'cornGun' ||
        state.qteOutcome === 'airTriple' || state.qteOutcome === 'dragonFruit' ||
        state.qteOutcome === 'goodbye' || state.qteOutcome === 'verticalRocket' ||
        state.qteOutcome === 'laserUp' || state.qteOutcome === 'fruitSalad' ||
        state.qteOutcome === 'twoStageRocket' || state.qteOutcome === 'rainbow';
      const slopContinuous = state.activeFoodEvent?.id === 'secretSlop08' &&
        (state.rocketFart || state.verticalRocket || state.sportsSale) &&
        (state.qteOutcome === 'rocket' || state.qteOutcome === 'verticalRocket' || state.qteOutcome === 'sportsSale');
      if (slopContinuous) {
        state.slopTurnT += dt;
        state.slopTurnVel += (Math.sin(t * 2.7) * 0.65 + Math.sin(t * 5.1 + 1.4) * 0.42) * dt;
        if (Math.random() < dt * 1.25) state.slopTurnVel += (Math.random() - 0.5) * 0.7;
        state.slopTurnVel = Math.max(-1.55, Math.min(1.55, state.slopTurnVel));
        const turn = state.slopTurnVel * dt;
        const vx = state.launchVx;
        const vy = state.launchVy;
        const c = Math.cos(turn);
        const s = Math.sin(turn);
        state.launchVx = vx * c - vy * s;
        state.launchVy = vx * s + vy * c;
        const aim = Math.atan2(state.launchVy, Math.max(0.1, state.launchVx));
        spinPivot.rotation.z += (aim * 0.42 - spinPivot.rotation.z) * Math.min(1, dt * 5.5);
        state.slopTrailT -= dt;
        while (state.slopTrailT <= 0) {
          state.slopTrailT += 0.06;
          spawnOneFartParticle(player.position.x, state.jumpY + 0.58, 0.12, state.fartFxScaleMul * 0.82);
        }
      } else if (state.activeFoodEvent?.id === 'secretSlop08' && slopChaosOutcome) {
        const aim = Math.atan2(state.launchVy, Math.max(0.1, state.launchVx));
        spinPivot.rotation.z += (aim * 0.34 - spinPivot.rotation.z) * Math.min(1, dt * 4.2);
      }
      const dx = state.launchVx * dt;
      player.position.x += dx;
      state.dist += dx;
      if (state.launchVy !== 0) {
        state.launchVy -= GRAVITY * CONFIG.launch.gravityMul * state.fartGravityMul * heavyFallGravityMul(state.launchVy) * dt;
        state.jumpY += state.launchVy * dt;
        if (state.jumpY <= 0) {
          const landingImpact = Math.max(0, -state.launchVy);
          if (state.cometImpact && state.cometPhase === 'dive' && !state.cometHit) {
            state.jumpY = 0;
            state.cometHit = true;
            triggerCometImpact(player.position.x);
            state.fartFlying = false;
            state.capsuleFartFlying = false;
            state.rocketFart = false;
            state.blastFlying = false;
            state.noFartParticles = false;
            state.rocketFx = false;
            state.verticalRocket = false;
            state.sportsSale = false;
            state.ikeaFart = false;
            state.sharknado = false;
            state.cometImpact = false;
            state.cometPhase = 'idle';
            state.cometT = 0;
            state.cometFireT = 0;
            state.fartGravityMul = 1;
            clearJuiceFartState();
            state.launchVx = 0;
            state.launchVy = 0;
            state.onGround = true;
            state.speed = Math.min(CONFIG.fart.speedCap, Math.max(state.speed, 11.5));
            spinPivot.rotation.z = 0;
          } else {
            state.jumpY = 0;
            state.fartFlying = false;
            state.capsuleFartFlying = false;
            state.rocketFart = false;
            state.blastFlying = false;
            state.noFartParticles = false;
            state.rocketFx = false;
            state.verticalRocket = false;
            state.sportsSale = false;
            state.ikeaFart = false;
            state.cometImpact = false;
            state.cometPhase = 'idle';
            state.cometT = 0;
            state.cometFireT = 0;
            state.cometHit = false;
            state.catScreamBoost = false;
            state.catScreamBoostT = 0;
            state.shotgunSpinV = 0;
            clearJuiceFartState();
            if (!state.spinRolling) spinPivot.rotation.z = 0;   // 大腚转转转：落地回正
            state.launchVx = 0; state.launchVy = 0;
            state.onGround = true;
            if (state.activeFoodEvent?.id === 'flintWater02') applyHeavyLandingBoost(landingImpact, 1.35);
            else addShake(0.25, 0, -0.12);   // 起飞落地：轻震
          }
        }
      }
      // 大腚转转转：空中只轻微推，落地后继续贴地滚动和定时喷屁。
      if (state.spinRolling) {
        const B = CONFIG.qte.rocket.bootySpin;
        state.spinRollingT += dt;
        if (state.spinRollingT < B.dur) {
          state.launchVx += B.vxAccel * 0.55 * hForce * dt;
          state.launchVx = Math.min(CONFIG.qte.rocket.continuousSpeedCap, state.launchVx);
        }
        spinPivot.rotation.z -= Math.max(5, state.launchVx / B.r) * B.spinMul * 1.1 * dt;
        state.bootyPuffT -= dt;
        if (state.bootyPuffT <= 0) {
          state.bootyPuffT = 0.12;
          spawnOneFartParticle(player.position.x, Math.max(0.62, state.jumpY + 0.62), 0.12, state.fartFxScaleMul * 0.82);
        }
        if (state.spinRollingT >= B.dur) { state.spinRolling = false; state.spinEndT = 0.5; }
      }
      // 垂直火箭：持续渐变推力（纵向渐减 → 横向渐增），形成连续火箭发射轨迹
      if (state.verticalRocket) {
        const t = state.verticalRocketT;
        const V = CONFIG.qte.rocket.vertical;
        const vertF = Math.max(0, 1 - t / (V.dur * V.vyFrac));                                  // 纵向力：前期强 → 衰减
        const horizF = Math.min(1, Math.max(0, (t - V.dur * V.vxStart) / (V.dur * V.vxRamp)));  // 横向力：中后期抬升
        state.launchVy += V.vyAccel * vertF * vForce * dt;
        state.launchVx += V.vxAccel * horizF * hForce * dt;
        state.launchVx = Math.min(CONFIG.qte.rocket.continuousSpeedCap, state.launchVx);
        state.verticalRocketT += dt;
        if (t >= V.dur) state.verticalRocket = false;
      }
      // 体育用品大甩卖：持续喷出球类，保留旧版“被球一路顶上去”的一半高度。
      if (state.sportsSale) {
        const dur = 2.25;
        const k = Math.min(1, state.sportsSaleT / dur);
        state.launchVy += (8.4 + 16.8 * k) * vForce * dt;
        state.launchVx += 3.8 * hForce * dt;
        state.launchVx = Math.min(16 * hForce, state.launchVx);
        state.sportsSaleEmitT += dt;
        while (state.sportsSaleEmitT >= 0.055) {
          state.sportsSaleEmitT -= 0.055;
          spawnSportsBallBurst(player.position.x, state.jumpY + 0.55, 2 + ((Math.random() * 3) | 0));
          spawnOneFartParticle(player.position.x, state.jumpY + 0.45, 0.12, state.fartFxScaleMul * 0.75);
        }
        state.sportsSaleT += dt;
        if (state.sportsSaleT >= dur) state.sportsSale = false;
      }
      // 垂直火箭：飞行期间持续喷火尾迹（方向 = 推进反方向：上升向下、前进向后）
      if (state.rocketFx) {
        const lvx = state.launchVx, lvy = state.launchVy;
        let dx = 0, dy = -1;
        if (Math.abs(lvx) > 0.1 || Math.abs(lvy) > 0.1) {
          const len = Math.hypot(lvx, lvy) || 1;
          dx = -lvx / len; dy = -lvy / len;
        }
        spawnFireBurst(player.position.x - 0.15, state.jumpY + 0.35, dx, dy, 2);
      }
      // 后续粒子密度大幅降低：开场爆完后几乎不喷，偶有几粒余韵（noFartParticles 时完全不出）
      if (!state.noFartParticles) {
        const density = Math.max(0.05, 1 - state.fartFlyT / 1.2);
        const extraChance = Math.min(0.5, CONFIG.fartFx.contRate / 60 * density);
        for (let k = 0; k < 2; k++) {
          if (Math.random() > extraChance) break;
          spawnOneFartParticle(player.position.x, state.jumpY + 0.65, 0.12, state.fartFxScaleMul);
        }
        if (state.activeFoodEvent?.id === 'falseCod07' && Math.random() < 0.22) {
          spawnOilFartBits(player.position.x, state.jumpY + 0.58, 0.18, 1 + ((Math.random() * 2) | 0), 0.82);
        }
      }
      player.position.y = state.jumpY;
    } else if (state.spinRolling) {
      const B = CONFIG.qte.rocket.bootySpin;
      state.spinRollingT += dt;
      state.speed = Math.min(CONFIG.qte.rocket.continuousSpeedCap, Math.max(state.speed, 7.2) + B.vxAccel * 0.38 * dt);
      player.position.x += state.speed * dt;
      state.dist += state.speed * dt;
      state.jumpY = 0;
      state.onGround = true;
      player.position.y = 0;
      spinPivot.position.y += (0.46 - spinPivot.position.y) * Math.min(1, dt * 10);
      spinPivot.rotation.z -= Math.max(6.5, state.speed / B.r) * B.spinMul * 1.18 * dt;
      state.bootyPuffT -= dt;
      if (state.bootyPuffT <= 0) {
        state.bootyPuffT = 0.12;
        spawnOneFartParticle(player.position.x, 0.52, 0.12, state.fartFxScaleMul * 0.88);
      }
      if (state.spinRollingT >= B.dur) {
        state.spinRolling = false;
        state.bootyPuffT = 0;
        state.spinEndT = 0.5;   // 收尾：旋转渐停回正期间屏蔽 QTE
      }
    } else if (state.shitting) {
      // 原地窜稀：急停 + 持续喷屎，不前进、不计距离
      state.shitT += dt;
      state.speed = Math.max(0, state.speed - 9 * dt);
      const [cMin, cMax] = CONFIG.poopFx.contScale;
      const extraChance = Math.min(0.9, CONFIG.poopFx.contRate / 60);
      const drip = incidentDripRepeats();
      for (let k = 0; k < drip.max; k++) {
        if (k >= drip.guaranteed && Math.random() > extraChance) continue;
        const p = poops.find(q => q.life <= 0);
        if (!p) break;
        p.mesh.visible = true;
        p.mesh.position.set(player.position.x - 0.35 + (Math.random() - 0.5) * 0.3, state.jumpY + 0.35, 0.14);
        p.vx = -(2.5 + Math.random() * 2.6);
        p.vy = -(0.6 + Math.random() * 2.2);
        p.life = 1.2 + Math.random() * 1.0;
        p.spin = (Math.random() - 0.5) * 26;
        p.mesh.rotation.z = Math.random() * 6;
        p.mesh.scale.setScalar(cMin + Math.random() * (cMax - cMin));
      }
      player.position.y = 0;
    } else if (state.buildup) {
      // 酝酿：减速捂着走（紧张等待揭晓）
      state.buildupT += dt;
      state.speed = Math.max(2, state.speed - 5 * dt);
      player.position.x += sp * dt;
      player.position.y = 0;
      if (state.buildupT >= CONFIG.qte.buildupTime) {
        // 揭晓：退出酝酿，真正放屁。按键结算/关联词已在按键瞬间弹出，此时恰好弹出星芒事件名
        state.buildup = false;
        state.recentOutcomeT = 2.2;   // 事件发生后 2.2s（星芒展示 1.2s 后再停留 1s），三段一起收起
        state.qteResolving = false;
        if (state.phase === 'run') {
          showQteBurstPhase();   // 事件发生时刻：弹出星芒放屁结果
          applyQteOutcome(state.qteOutcome);
        }
        else state.qteOutcome = null;
      }
    } else if (state.firework) {
      // 腚上花火：向前摔倒趴地（身体水平、中心降到半高贴地），然后放烟花
      state.fireworkT += dt;
      state.speed = Math.max(0, state.speed - 9 * dt);
      player.position.y = 0;
      spinPivot.rotation.z += (-Math.PI / 2 - spinPivot.rotation.z) * Math.min(1, dt * 8);   // 绕中心转到 -90°：头朝前趴地
      spinPivot.position.y += (0.35 - spinPivot.position.y) * Math.min(1, dt * 8);           // 中心降到半高，身体贴地
      if (state.fireworkT >= CONFIG.qte.fireworkDur) state.firework = false;
    } else {
      // 正常奔跑：角色姿态回正（防花火趴地残留）
      if (state.spinEndT > 0) {
        state.spinEndT -= dt;   // 大腚转转转收尾：旋转渐停回正
        if (state.spinEndT <= 0) { spinPivot.rotation.z = 0; spinPivot.position.y = 0.7; }
      }
      if (spinPivot.rotation.z !== 0 && state.activeFoodEvent?.id !== 'falseCod07') spinPivot.rotation.z += (0 - spinPivot.rotation.z) * Math.min(1, dt * 6);
      if (spinPivot.position.y !== 0.7) spinPivot.position.y += (0.7 - spinPivot.position.y) * Math.min(1, dt * 6);
      state.buffer -= dt;
      if (state.onGround) state.coyote = 0.1; else state.coyote -= dt;
      if (state.buffer > 0 && state.coyote > 0) {
        state.jumpVy = JUMP_V;
        state.onGround = false;
        state.buffer = 0; state.coyote = 0;
        burstConfetti(player.position.x, 0.06, 0.15, 5, 1.6);
      }
      if (!state.onGround) {
        state.jumpVy -= GRAVITY * heavyFallGravityMul(state.jumpVy) * dt;
        state.jumpY += state.jumpVy * dt;
        if (state.jumpY <= 0) {
          const landingImpact = Math.max(0, -state.jumpVy);
          state.jumpY = 0; state.onGround = true;
          burstConfetti(player.position.x, 0.04, 0.15, 6, 2.2);
          applyHeavyLandingBoost(landingImpact, 0.72);
        }
      }
      player.position.y = state.jumpY;
      player.position.x += sp * dt;   // 真跑：角色在场景中前进，摄像机跟随
    }
  } else if (state.phase === 'dying') {
    // 最后一次失禁：喷射前冲 → 空中翻滚 → 落地弹跳 → 泄气躺倒再谢幕
    state.dyingT += dt;
    // 前冲（水平速度随滑行渐弱，落地弹跳时滑行）
    player.position.x += state.launchVx * dt;
    state.dist += state.launchVx * dt;
    state.launchVx *= (1 - CONFIG.launch.flyDrag * dt);   // 前冲渐弱（可调滑行距离）
    if (state.launchVy !== 0 || state.jumpY > 0.01) {
      state.dyingPhase = 'fly';                                    // 空中/弹跳阶段（物理与动画统一）
      state.launchVy -= GRAVITY * CONFIG.launch.gravityMul * dt;   // 垂直抛落
      state.jumpY += state.launchVy * dt;
      if (state.jumpY <= 0 && state.launchVy < 0) {
        state.jumpY = 0;
        const impact = -state.launchVy;                            // 落地速度
        if (impact * CONFIG.launch.bounceElastic > CONFIG.launch.bounceStop) {
          state.launchVy = impact * CONFIG.launch.bounceElastic;   // 弹性反弹：按落地速度 × 弹力系数，自然衰减
          addShake(Math.min(0.6, impact * 0.05), 0, -0.2);         // 冲击随落地速度
          playSplat();
        } else {
          state.launchVy = 0;                                      // 弹力不足 → 停止
        }
      }
      player.position.y = Math.max(0, state.jumpY);
    } else {
      state.dyingPhase = 'rest';                                   // 倒下静止阶段
      state.dyingRest += dt;                                       // 躺倒动画进行中
      if (state.dyingRest > CONFIG.launch.restTime) {
        onIncidentEnd();                                           // 躺倒完成 → 谢幕
      }
    }
    // 持续拉屎：全程每帧必排一粒，额外粒概率由 contRate 控制（越大越密）
    const [cMin, cMax] = CONFIG.poopFx.contScale;
    const extraChance = Math.min(0.9, CONFIG.poopFx.contRate / 60);
    const drip = incidentDripRepeats();
    for (let k = 0; k < drip.max; k++) {
      if (k >= drip.guaranteed && Math.random() > extraChance) continue;   // 额外多排一粒（概率随 contRate）
      const p = poops.find(q => q.life <= 0);
      if (!p) break;
      p.mesh.visible = true;
      p.mesh.position.set(player.position.x - 0.35 + (Math.random() - 0.5) * 0.3, state.jumpY + 0.35, 0.14);
      p.vx = -(2.5 + Math.random() * 2.6);          // 向后排出
      p.vy = -(0.6 + Math.random() * 2.2);          // 向下甩落
      p.life = 1.2 + Math.random() * 1.0;
      p.spin = (Math.random() - 0.5) * 26;
      p.mesh.rotation.z = Math.random() * 6;
      p.mesh.scale.setScalar(cMin + Math.random() * (cMax - cMin));
    }
  }

  const falseCodSkid = state.phase === 'run' && state.activeFoodEvent?.id === 'falseCod07' &&
    !state.fartFlying && !state.spinRolling && !state.shitting && !state.buildup &&
    !state.firework && !state.timeStopped;
  if (falseCodSkid) {
    state.falseCodOilT -= dt;
    while (state.falseCodOilT <= 0) {
      state.falseCodOilT += 0.095 + Math.random() * 0.055;
      spawnOilFartBits(player.position.x, player.position.y + 0.34, 0.18, 2 + ((Math.random() * 3) | 0), 0.72);
    }
  } else {
    state.falseCodOilT = 0;
    state.falseCodSlipVel *= Math.max(0, 1 - dt * 5);
    state.falseCodSlipAngle *= Math.max(0, 1 - dt * 5);
  }

  // --- 跑步关节动画（全部绕 Z：纸平面内摆动） ---
  state.phaseRun += dt * (3.5 + sp * 1.35);
  const s = Math.sin(state.phaseRun);
  if (state.phase === 'dying') {
    if (state.dyingPhase === 'fly') {
      // 空中/弹跳：整体快速翻滚 + 四肢乱甩
      player.rotation.z += dt * 8;
      torsoPivot.rotation.z = Math.sin(state.dyingT * 20) * 0.7;
      torsoPivot.position.y = 0.62;
      legL.rotation.z = Math.sin(state.dyingT * 24) * 1.2;
      legR.rotation.z = -Math.sin(state.dyingT * 24) * 1.2;
      armL.rotation.z = Math.sin(state.dyingT * 28) * 1.4;
      armR.rotation.z = -Math.sin(state.dyingT * 28) * 1.4;
      head.rotation.z = Math.sin(state.dyingT * 30) * 0.4;
      torsoPivot.rotation.x = 0.12;
    } else {
      // 倒下静止：从当前角度沿最短路径丝滑修正到水平躺平 + 四肢瘫软
      const target = Math.PI * 0.5;                                  // 水平侧躺
      const d = ((target - player.rotation.z) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      const dd = d > Math.PI ? d - Math.PI * 2 : d;                  // 最短角度差（避免绕大圈）
      player.rotation.z += dd * Math.min(1, dt * 6);                 // 丝滑过渡
      player.position.y += (0.4 - player.position.y) * Math.min(1, dt * 6);   // 抬高到地面之上，防横躺穿模
      torsoPivot.rotation.z = 0;
      torsoPivot.position.y = 0.5;
      legL.rotation.z = 0.3; legR.rotation.z = -0.3;
      armL.rotation.z = 0.5; armR.rotation.z = 0.4;
      head.rotation.z = 0.2;
      torsoPivot.rotation.x = 0;
    }
  } else if (state.blastFlying) {
    // 原地崩飞：近似直立被向上顶起，四肢自然外张（被屁从下方顶飞）
    torsoPivot.rotation.z = 0.02;
    torsoPivot.position.y = 0.62;
    legL.rotation.z = 0.35; legR.rotation.z = -0.35;
    armL.rotation.z = -0.5; armR.rotation.z = 0.5;
    head.rotation.z = 0;
    torsoPivot.rotation.x = 0;
  } else if (state.fartFlying) {
    // 放屁起飞：前倾 + 四肢微张（起飞冲刺感）
    torsoPivot.rotation.z = -0.18;
    torsoPivot.position.y = 0.62;
    legL.rotation.z = 1.0; legR.rotation.z = -1.0;
    armL.rotation.z = -1.1; armR.rotation.z = 1.1;
    head.rotation.z = 0.05;
    torsoPivot.rotation.x = 0.08;
  } else if (state.buildup) {
    // 酝酿：弓腰 + 双手捂臀 + 紧张小碎步（捂着屁股走）
    const b = state.buildupT;
    torsoPivot.rotation.z = 0.25 + Math.sin(b * 9) * 0.05;
    torsoPivot.position.y = 0.55;
    legL.rotation.z = 0.5 + Math.sin(b * 8) * 0.25; legR.rotation.z = -0.5 - Math.sin(b * 8) * 0.25;
    armL.rotation.z = -1.2 + Math.sin(b * 12) * 0.15; armR.rotation.z = -1.2 - Math.sin(b * 12) * 0.15;   // 双手捂臀
    head.rotation.z = 0.08;
    torsoPivot.rotation.x = 0.05;
  } else if (state.shitting) {
    // 原地窜稀：弯腰蹲下 + 快速抖动（窘迫感）
    torsoPivot.rotation.z = 0.18 + Math.sin(state.shitT * 34) * 0.06;
    torsoPivot.position.y = 0.55;
    legL.rotation.z = 0.45 + Math.sin(state.shitT * 28) * 0.18; legR.rotation.z = -0.45 - Math.sin(state.shitT * 28) * 0.18;
    armL.rotation.z = 0.5; armR.rotation.z = -0.5;
    head.rotation.z = 0;
    torsoPivot.rotation.x = 0;
  } else if (state.firework) {
    // 腚上花火：趴地放烟花，手脚不动（身体被 spinPivot 转成水平趴地）
    torsoPivot.rotation.z = 0;
    torsoPivot.position.y = 0.62;
    legL.rotation.z = 0; legR.rotation.z = 0;
    armL.rotation.z = 0; armR.rotation.z = 0;
    head.rotation.z = 0;
    torsoPivot.rotation.x = 0;
  } else if (state.phase !== 'title' && state.onGround && sp > 0.5) {
    // 放屁冲刺姿态：身体猛前倾、后腿狠蹬、前腿压低（推力可视化）
    const fp = state.fartPush;
    legL.rotation.z = s * 0.95 - fp * 1.7;
    legR.rotation.z = -s * 0.95 - fp * 1.1;
    armL.rotation.z = -s * 0.8 + 0.15 - fp * 0.7;
    armR.rotation.z = s * 0.8 - 0.15 + fp * 1.4;
    torsoPivot.rotation.z = -0.09 + Math.abs(Math.cos(state.phaseRun)) * 0.03 - fp * 0.55;   // 前倾冲刺
    torsoPivot.position.y = 0.62 + Math.abs(s) * 0.045 - fp * 0.07;                          // 压低重心
    head.rotation.z = Math.sin(state.phaseRun * 0.5) * 0.05 - fp * 0.12;
  } else if (!state.onGround) {
    legL.rotation.z = 0.85; legR.rotation.z = -0.55;   // 跳跃定格：跨步舒展
    armL.rotation.z = -1.1; armR.rotation.z = 0.9;
    torsoPivot.rotation.z = -0.14;
  } else {
    const b = Math.sin(t * 2.2) * 0.02;                // 待机呼吸
    legL.rotation.z = legR.rotation.z = 0;
    armL.rotation.z = -0.06 + b; armR.rotation.z = 0.06 - b;
    torsoPivot.rotation.z = b * 0.5;
    torsoPivot.position.y = 0.62 + b;
  }
  if (falseCodSkid) {
    const slipNoise = Math.sin(t * 5.7) * 3.2 + Math.sin(t * 11.3 + 1.9) * 2.3 + Math.sin(t * 17.1 + 0.4) * 1.1;
    state.falseCodSlipVel += slipNoise * dt;
    state.falseCodSlipVel *= Math.max(0, 1 - dt * 1.55);
    if (Math.random() < dt * 2.2) state.falseCodSlipVel += (Math.random() < 0.5 ? -1 : 1) * (2.4 + Math.random() * 2.2);
    state.falseCodSlipVel = Math.max(-6.2, Math.min(6.2, state.falseCodSlipVel));
    state.falseCodSlipAngle += state.falseCodSlipVel * dt;
    state.falseCodSlipAngle += (Math.sin(t * 8.6) * 0.018 + Math.sin(t * 15.4) * 0.01);
    state.falseCodSlipAngle = Math.max(-0.78, Math.min(0.78, state.falseCodSlipAngle));
    spinPivot.rotation.z = state.falseCodSlipAngle;
    spinPivot.position.y = 0.7 + Math.abs(Math.sin(t * 9.5 + state.falseCodSlipAngle)) * 0.06;
    torsoPivot.rotation.z += Math.sin(t * 14.2) * 0.08;
    head.rotation.z += Math.sin(t * 18.5 + 0.7) * 0.12;
  }
  if (state.activeFoodEvent?.id === 'flintWater02' && state.heavyLandingSquashT > 0) {
    const p = state.heavyLandingSquashT / 0.32;
    const wave = Math.sin((1 - p) * Math.PI);
    const squash = (state.heavyLandingSquashPower || 0) * wave;
    spinPivot.scale.x = 1 + squash * 0.22;
    spinPivot.scale.y = 1 - squash * 0.28;
    spinPivot.position.y = 0.7 - squash * 0.08;
  } else if (state.activeFoodEvent?.id === 'flintWater02') {
    spinPivot.scale.x += (1 - spinPivot.scale.x) * Math.min(1, dt * 12);
    spinPivot.scale.y += (1 - spinPivot.scale.y) * Math.min(1, dt * 12);
  }

  player.visible = true;

  // --- 屁云粒子：先跟玩家同速前进（follow=1 不随世界滚），再慢慢减速被甩到身后消散 ---
  for (const c of fartClouds) {
    if (c.life <= 0) continue;
    c.life -= dt;
    c.vy -= 7 * dt;                              // 重力（同窜稀粒子）
    c.mesh.position.x += c.vx * dt;
    c.mesh.position.y += c.vy * dt;
    if (c.mesh.position.y <= 0 && c.vy < 0) {    // 落地贴地滑动（同窜稀）
      c.mesh.position.y = 0;
      c.vy = 0;
      c.vx *= (1 - 6 * dt);
      c.life = Math.min(c.life, 0.5);
    }
    c.mesh.rotation.z += c.spin * dt * 1.6;      // 双轴旋转（同窜稀）
    c.mesh.rotation.x += c.spin * dt * 0.8;
    c.mesh.material.opacity = Math.max(0, Math.min(1, c.life / 0.5));   // 落地后淡出
    if (c.life <= 0) c.mesh.visible = false;
  }
  // --- 开场爆发的旧式屁云：漂浮跟随 + 放大 + 淡出 ---
  for (const c of puffs) {
    if (c.life <= 0) continue;
    c.life -= dt;
    c.follow = Math.max(0, c.follow - c.followDecay * dt);
    c.mesh.position.x -= (sp * (1 - c.follow)) * dt;   // 同速期不后退，减速后随世界被甩后
    c.mesh.position.x += c.vx * dt;
    c.vx *= (1 - 0.9 * dt);                            // 喷出初速慢慢衰减
    c.mesh.position.y += c.vy * dt;
    c.mesh.scale.multiplyScalar(1 + c.grow * dt);
    c.mesh.rotation.z += dt * (Math.random() - 0.5) * 2;
    c.mesh.material.opacity = Math.min(1, c.life / 0.45);   // 保持完全不透明更久再淡出
    if (c.life <= 0) c.mesh.visible = false;
  }

  // --- 屎粒子（落地停驻短暂滑动再消失，拉了一地） ---
  for (const p of poops) {
    if (p.life <= 0) continue;
    p.life -= dt;
    p.vy -= 7 * dt;
    p.mesh.position.x += p.vx * dt;
    p.mesh.position.y += p.vy * dt;
    // 落地：贴地滑动衰减，最多再留 0.5s（快速回收 → 持续拉取不断流）
    if (p.mesh.position.y <= 0 && p.vy < 0) {
      p.mesh.position.y = 0;
      p.vy = 0;
      p.vx *= (1 - 6 * dt);
      p.life = Math.min(p.life, 0.5);
    }
    p.mesh.rotation.z += p.spin * dt * 1.6;
    p.mesh.rotation.x += p.spin * dt * 0.8;
    if (p.life <= 0) { p.mesh.visible = false; }
  }

  // --- 玉米粒子（机关枪喷出：重力回落 → 落地贴地滑动 → 短暂停留后回收） ---
  for (const c of corns) {
    if (c.life <= 0) continue;
    c.life -= dt;
    c.vy -= 7 * dt;
    c.mesh.position.x += c.vx * dt;
    c.mesh.position.y += c.vy * dt;
    if (c.mesh.position.y <= 0 && c.vy < 0) {
      c.mesh.position.y = 0;
      c.vy = 0;
      c.vx *= (1 - 6 * dt);
      c.life = Math.min(c.life, 0.5);
    }
    c.mesh.rotation.z += c.spin * dt * 1.6;
    c.mesh.rotation.x += c.spin * dt * 0.8;
    if (c.life <= 0) c.mesh.visible = false;
  }

  // --- 火龙果籽（屁云尾迹：重力回落 → 贴地滑动 → 回收） ---
  for (const p of dragonSeeds) {
    if (p.life <= 0) continue;
    p.life -= dt;
    p.vy -= 7 * dt;
    p.mesh.position.x += p.vx * dt;
    p.mesh.position.y += p.vy * dt;
    if (p.mesh.position.y <= 0 && p.vy < 0) {
      p.mesh.position.y = 0; p.vy = 0;
      p.vx *= (1 - 6 * dt);
      p.life = Math.min(p.life, 0.5);
    }
    p.mesh.rotation.z += p.spin * dt * 1.6;
    p.mesh.rotation.x += p.spin * dt * 0.8;
    if (p.life <= 0) p.mesh.visible = false;
  }
  // --- 金针菇（高速喷出 → 物理散落：重力回落贴地滑动） ---
  for (const p of mushrooms) {
    if (p.life <= 0) continue;
    p.life -= dt;
    p.vy -= 7 * dt;
    p.mesh.position.x += p.vx * dt;
    p.mesh.position.y += p.vy * dt;
    if (p.mesh.position.y <= 0 && p.vy < 0) {
      p.mesh.position.y = 0; p.vy = 0;
      p.vx *= (1 - 5 * dt);
      p.life = Math.min(p.life, 0.6);
    }
    p.mesh.rotation.z += p.spin * dt * 1.6;
    p.mesh.rotation.x += p.spin * dt * 0.8;
    if (p.life <= 0) p.mesh.visible = false;
  }

  // --- 激光光柱（激光升天：跟随角色，高度=角色底部到地面，随升空延伸） ---
  updateLaserBeams(dt, player.position.x, state.jumpY);
  updateMuzzleFlashes(dt);
  updateSaladChunks(dt);
  // --- 火箭火焰粒子（垂直火箭方向性喷射） ---
  updateFireParticles(dt);
  // --- 彩虹尾迹（彩虹屁：彩色屁云短时间保留形成视觉路径） ---
  updateRainbowPuffs(dt);
  // --- 烟花（腚上花火：弹体上升 → 高空爆炸 → 彩粒扩散） ---
  updateFireworks(dt);
  updateHeavyMetalFx(dt, player);

  // --- 大象（放屁喷出物：继承速度跟行 → 落地弹跳翻滚 → 出屏回收） ---
  updateElephants(dt);
  // --- 体育用品大甩卖：球类物理散射、旋转与下落 ---
  updateSportsBalls(dt);
  // --- 鲨卷风：鲨鱼围绕角色旋转喷发、下落回收 ---
  updateSharks(dt);
  // --- 疯狂宜家屁：家具贴图爆喷、屏幕内堆积 ---
  updateFurniture(dt);
  // --- 彗星撞地球：火焰尾迹、撞地闪白和石块爆散 ---
  updateCometFx(dt);

  // --- 破坏碎片（小方块飞散，落地停驻） ---
  for (const bit of bits) {
    if (bit.life <= 0) continue;
    bit.life -= dt;
    bit.vy -= 7 * dt;
    bit.mesh.position.x += bit.vx * dt;
    bit.mesh.position.y += bit.vy * dt;
    bit.mesh.rotation.z += bit.spin * dt;
    if (bit.mesh.position.y <= 0.15 && bit.vy < 0) {
      bit.mesh.position.y = 0.15;
      bit.vy = 0;
      bit.vx *= (1 - 5 * dt);
    }
    if (bit.life <= 0) bit.mesh.visible = false;
  }

  // --- 纸屑 ---
  for (const p of confetti) {
    if (p.life <= 0) continue;
    p.life -= dt;
    p.vy -= 9 * dt;
    p.mesh.position.x += p.vx * dt;
    p.mesh.position.y += p.vy * dt;
    p.mesh.rotation.z += dt * 9;
    p.mesh.rotation.x += dt * 5;
    if (p.life <= 0 || p.mesh.position.y < -0.2) { p.life = 0; p.mesh.visible = false; }
  }

  updateRocketFlame(t);
  updateRocketFlameParticles(dt);
  updateCharacterMutation(t);
  updateMediumRareBurger(t);
  updateMushroomTripOverlay(t);

  // --- 相机：呼吸微漂 + 跳跃跟随 + 多档震动（通用抖动 + 方向性冲击） ---
  state.shake = Math.max(0, state.shake - dt * CONFIG.shake.decay);
  state.shakeX *= (1 - CONFIG.shake.dirDecay * dt);
  state.shakeY *= (1 - CONFIG.shake.dirDecay * dt);
  const sk = state.shake * state.shake * CONFIG.shake.amp;
  const jx = (Math.random() - 0.5) * sk + state.shakeX * CONFIG.shake.dirAmp;   // 随机抖动 + 水平方向性
  const jy = (Math.random() - 0.5) * sk * 0.8 + state.shakeY * CONFIG.shake.dirAmp;  // 垂直方向性
  const lookY = updateCameraFollow(dt, jx, jy, t);
  traceCamera(dt, lookY);

  // --- HUD ---
  if (state.phase === 'run') {
    $dist.textContent = Math.floor(state.dist);
    $vign.style.opacity = 1;
    if (state.hudDebug) {
      // 测试视图：下一次窜稀概率
      const diarrheaChance = qteOutcomeChance('diarrhea', qteLineQuality());
      $chance.textContent = `${Math.round(diarrheaChance * 100)}%`;
      $chance.style.color = diarrheaChance >= 0.5 ? '#b04030'
        : diarrheaChance >= 0.25 ? '#9a6a24' : '#3d7a3d';
    } else if (state.recentOutcomeT > 0 && state.qteOutcome) {
      // 放屁事件展示期：显示事件名（如 彩虹屁！），下次 QTE 开始后恢复判定段
      $chance.textContent = qteOutcomeLabel(state.qteOutcome);
      $chance.style.color = '#5a4030';
    } else {
      // 平时：实时显示当前 QTE 判定线所指的判定段（完美/优秀/一般/糟糕）
      const seg = qteLineZoneData();
      $chance.textContent = seg ? (qteZoneLabel(seg) || '—') : '—';
      $chance.style.color = seg?.color || '#5a4030';
    }
  } else if (state.phase === 'dying') {
    $vign.style.opacity = 1;
  }

  renderer.render(scene, camera);   // 低分辨率 buffer → CSS 放大像素化（QTE mesh 随场景一起渲染）
}

animate();

export { animate };
