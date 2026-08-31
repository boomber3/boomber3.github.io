// ============================================================
//  下班狂奔 · 入口装配器（模块化重构版）
//  职责：初始化各系统、绑定输入、加载模型、启动主循环
// ============================================================
import { layoutRenderer, layoutCamera } from './core/engine.js';
import { state } from './core/state.js';
import { $settingsModal, $debug, $eventPage, $eventTestPanel, $foodEventPanel, $propTestPanel, $regionPanel, $collidePanel, $itemPanel, $pauseBtn, $overRestart } from './utils/dom.js';
import { bus } from './utils/bus.js';
import { MODEL_FILES, gltfLoader, modelCache, props, populateProps } from './world/props.js';
import { player } from './world/character.js';
import { camera } from './core/engine.js';
import { ground } from './world/stage.js';
import { REGION_SKY } from './world/sky.js';
import { curtL } from './world/stage.js';
import { doFart, layoutQteMesh, qteLineHc, qteLineZone, qteLayout } from './systems/fart-qte.js';
import { lockUpgradeQte, triggerUpgradeQte, cancelUpgradeQte } from './systems/upgrade-qte.js';
import { startShow, continueFromEvent, settleGame, goHome, toggleRestart } from './systems/session.js';
import { progress } from './systems/growth.js';
import { fartClouds, poops } from './systems/particles.js';
import { toggleEventTestPanel } from './ui/event-test-panel.js';
import { toggleFoodEventPanel } from './ui/food-event-panel.js';
import { togglePropTestPanel } from './ui/prop-test-panel.js';
import { toggleRegionPanel } from './ui/region-panel.js';
import { toggleCollidePanel } from './ui/collide-panel.js';
import { toggleItemPanel } from './ui/build-panel.js';
import { loadElephantModel } from './systems/elephant.js';
import { loadSportsBallModels, sportsBallDebugInfo } from './systems/sports-balls.js';
import { loadSharkModel, sharkDebugInfo } from './systems/sharknado.js';
import { loadFurnitureTextures, furnitureDebugInfo } from './systems/furniture.js';
import { loadMediumRareBurgerModel } from './systems/burger-event.js';
import { loadPlaneModels, spawnDebugPlane, planes } from './world/planes.js';
import { loadAerialModels, spawnDebugAerial, aerials } from './world/aerials.js';
import { loadTrafficModels, loadBreakModels } from './world/breakables.js';
import { loadGooseModel, spawnDebugGoose, geese } from './world/geese.js';
import { getRegionId } from './world/props.js';
import { t } from './i18n.js';

// 副作用导入：启动主循环 / 绑定设置面板 / 构建调参面板
import './core/loop.js';
import './ui/settings.js';
import './ui/debug-panel.js';

// ---------- 窗口缩放：重排渲染器 / 相机 / QTE 判定条 ----------
addEventListener('resize', () => {
  layoutRenderer();
  layoutCamera();
  layoutQteMesh();
});

// ---------- 升级事件装配：成长/破坏经验触发升级 QTE ----------
if (!window.__dontTrustControlsBound) {
window.__dontTrustControlsBound = true;
bus.on('levelup', triggerUpgradeQte);

function canPause() {
  return state.phase === 'opening' || state.phase === 'run' || state.phase === 'dying';
}
function setPaused(paused) {
  if (!canPause()) return;
  state.paused = paused;
  $pauseBtn.classList.toggle('paused', state.paused);
  $pauseBtn.title = state.paused ? t('resume') : t('pause');
  $pauseBtn.setAttribute('aria-label', state.paused ? t('resume') : t('pause'));
}
$pauseBtn.addEventListener('pointerdown', e => e.stopPropagation());
$pauseBtn.addEventListener('click', e => {
  e.preventDefault();
  e.stopPropagation();
  setPaused(!state.paused);
});

// ---------- 管理员门禁：连续输入 zgpnf 解锁全部调试功能（本次会话有效） ----------
const ADMIN_SEQ = ['z', 'g', 'p', 'n', 'f'];
const ADMIN_SEQ_TIMEOUT = 2000;   // 相邻按键间隔超过该毫秒数 → 序列重置
const ADMIN_DEBUG_CODES = ['KeyT', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyZ', 'KeyU', 'KeyY', 'KeyA', 'KeyL'];
let adminSeqIdx = 0;
let adminSeqLastT = 0;
function showAdminUnlocked() {
  const el = document.createElement('div');
  el.textContent = t('adminUnlocked');
  el.style.cssText = 'position:fixed;left:50%;top:40%;transform:translate(-50%,-50%);z-index:60;font-size:28px;font-weight:900;color:#ffd700;text-shadow:3px 3px 0 #000;letter-spacing:3px;background:rgba(20,10,18,.85);padding:14px 30px;border:3px solid #ffd700;pointer-events:none;';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1600);
}

// ---------- 输入 ----------
addEventListener('keydown', e => {
  // 管理员门禁：未解锁时优先匹配 zgpnf 序列；调试键全部无效
  if (!state.adminUnlocked) {
    const k = e.key.toLowerCase();
    if (adminSeqLastT && performance.now() - adminSeqLastT > ADMIN_SEQ_TIMEOUT) { adminSeqIdx = 0; adminSeqLastT = 0; }
    if (k === ADMIN_SEQ[adminSeqIdx]) {
      adminSeqIdx++;
      adminSeqLastT = performance.now();
      if (adminSeqIdx === ADMIN_SEQ.length) {
        adminSeqIdx = 0;
        state.adminUnlocked = true;
        showAdminUnlocked();
      }
      e.preventDefault();
      return;
    }
    adminSeqIdx = 0;
    adminSeqLastT = 0;
    if (ADMIN_SEQ.includes(k)) { e.preventDefault(); return; }          // 序列字符位置不对：消耗并静默重置
    if (ADMIN_DEBUG_CODES.includes(e.code)) { e.preventDefault(); return; }  // 未解锁：调试键无效
  }
  const overlayOpen = !$settingsModal.classList.contains('hidden') || !$debug.classList.contains('hidden') || !$foodEventPanel.classList.contains('hidden') || !$propTestPanel.classList.contains('hidden') || !$regionPanel.classList.contains('hidden') || !$collidePanel.classList.contains('hidden') || !$itemPanel.classList.contains('hidden');
  const testPanelOpen = !$eventTestPanel.classList.contains('hidden');
  if (e.code === 'KeyP') {
    e.preventDefault();
    setPaused(!state.paused);
    return;
  }
  if (e.code === 'Escape') {
    e.preventDefault();
    $settingsModal.classList.add('hidden');
    $debug.classList.add('hidden');
    $eventTestPanel.classList.add('hidden');
    $foodEventPanel.classList.add('hidden');
    $propTestPanel.classList.add('hidden');
    $regionPanel.classList.add('hidden');
    $collidePanel.classList.add('hidden');
    $itemPanel.classList.add('hidden');
    return;
  }
  if (state.paused) return;
  if (overlayOpen && e.code !== 'Escape' && e.code !== 'KeyT' && e.code !== 'KeyZ' && e.code !== 'KeyU' && e.code !== 'KeyY' && e.code !== 'KeyO' && e.code !== 'KeyA' && e.code !== 'KeyF' && e.code !== 'KeyG' && e.code !== 'KeyH' && e.code !== 'KeyJ' && e.code !== 'KeyS' && e.code !== 'KeyK') return;
  // Z：调试生成一架飞机（相机前方视野内，方便测试）
  if (e.code === 'KeyZ') { e.preventDefault(); console.log('[Z] 触发生成测试飞机'); spawnDebugPlane(); return; }
  if (e.code === 'KeyU') { e.preventDefault(); spawnDebugAerial('ufo'); return; }
  if (e.code === 'KeyY') { e.preventDefault(); spawnDebugAerial('balloon'); return; }
  if (e.code === 'KeyO') { e.preventDefault(); spawnDebugGoose(); return; }
  // A：切换左上角 HUD 内容（玩家判定视图 ↔ 测试窜稀概率）
  if (e.code === 'KeyA') {
    e.preventDefault();
    state.hudDebug = !state.hudDebug;
    console.log('[A] HUD 切换为', state.hudDebug ? '窜稀概率（测试）' : '当前判定（玩家）');
    return;
  }
  // 事件测试面板打开时：仅放行 关闭(D)/Esc，其余忽略防误触
  if (testPanelOpen && e.code !== 'Escape' && e.code !== 'KeyD') return;
  // 升级道具 QTE 进行中：空格/上锁定当前段，其余输入屏蔽（含调试键）
  if (state.upgradeQteActive) {
    if (state.phase !== 'run') {
      cancelUpgradeQte();
      return;
    }
    if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); lockUpgradeQte(); }
    return;
  }
  if (e.code === 'Space' || e.code === 'ArrowUp') {
    e.preventDefault();
    if (!$eventPage.classList.contains('hidden')) continueFromEvent();
    else if (state.phase === 'over') toggleRestart();         // 结算：空格直接重新开始
    else if (state.phase === 'title') startShow();
    else doFart();                                // 空格 = 放屁 QTE
  }
  // 调参面板开关
  if (e.code === 'KeyT') {
    e.preventDefault();
    $debug.classList.toggle('hidden');
  }
  // 事件测试面板开关
  if (e.code === 'KeyD') {
    e.preventDefault();
    toggleEventTestPanel();
  }
  // 背景模型测试面板开关
  if (e.code === 'KeyF') {
    e.preventDefault();
    togglePropTestPanel();
  }
  // 地区切换面板开关
  if (e.code === 'KeyG') {
    e.preventDefault();
    toggleRegionPanel();
  }
  // 可碰撞物体调试台开关
  if (e.code === 'KeyH') {
    e.preventDefault();
    toggleCollidePanel();
  }
  // 道具调试台开关
  if (e.code === 'KeyJ') {
    e.preventDefault();
    toggleItemPanel();
  }
  // 开局食品事件控制台开关
  if (e.code === 'KeyK') {
    e.preventDefault();
    toggleFoodEventPanel();
  }
  // L：测试用快速死亡，方便跳过本局检查下一局今日事件。
  if (e.code === 'KeyL' && (state.phase === 'opening' || state.phase === 'run')) {
    e.preventDefault();
    settleGame(false);
  }
});
addEventListener('pointerdown', e => {
  if (e.target instanceof Element && e.target.closest('#pauseBtn, #settingsBtn, #settingsModal, #confirmModal, #debugPanel, #eventTestPanel, #foodEventPanel, #propTestPanel, #regionPanel, #collidePanel, #itemPanel')) return;
  if (state.paused) return;
  if (state.upgradeQteActive) {
    if (state.phase !== 'run') cancelUpgradeQte();
    else lockUpgradeQte();
    return;
  }   // 升级道具 QTE：点击锁定当前段
  else if (!$eventPage.classList.contains('hidden')) {
    continueFromEvent();   // 事件页弹出后，点击任意区域都开始游戏
    return;
  }
  else if (state.phase === 'over') {
    if (e.target === $overRestart) toggleRestart();      // 重新开始
    else goHome();                                       // 点按钮/空白：回到主页
    return;
  }
  else if (state.phase === 'title') startShow();
  else doFart();                 // 点击 = 放屁 QTE
});
}

// ---------- 加载 3D 中景模型 → 铺满舞台（加载失败则保持无中景，不影响运行） ----------
loadElephantModel();   // 预加载大象模型（放屁事件喷出物）
loadSportsBallModels(); // 预加载四种球模型（体育用品大甩卖）
loadSharkModel();      // 预加载鲨鱼模型（鲨卷风）
loadFurnitureTextures();
loadMediumRareBurgerModel();
loadPlaneModels();     // 预加载飞机模型（大/小，天空可交互物体）
loadAerialModels();    // 预加载 UFO / 热气球（天空可碰撞物体）
loadTrafficModels();   // 预加载路上/路边可破坏交通物
loadBreakModels();     // 预加载纸片外观替换模型（kenney 车件 GLB）
loadGooseModel();
Promise.all(MODEL_FILES.map(async name => {
  try {
    const g = await gltfLoader.loadAsync('models_city/' + name + '.glb');
    modelCache[name] = g.scene;
  } catch (e) { console.warn('模型加载失败:', name, e); }
})).then(() => {
  populateProps();
}).catch(e => {
  console.warn('模型加载异常', e);
  populateProps();
});
populateProps();

// ---------- 调试钩子（外部 evaluate 观测） ----------
window.__dbg = () => ({
  phase: state.phase,
  paused: state.paused,
  dist: Math.floor(state.dist),
  speed: +state.speed.toFixed(2),
  farts: state.farts,
  qte: +state.qte.toFixed(2),          // 判定线偏移 -0.5~+0.5（0=线指条中间）
  qteRound: state.qteRound,
  qteRoundSpeedMul: +state.qteRoundSpeedMul.toFixed(2),
  qteLineHc: +qteLineHc().toFixed(2),
  qteZone: qteLineZone(),
  qteZoneName: (qteLayout[qteLineZone()] || {}).label,
  qteResolving: state.qteResolving,
  qteJudgement: state.qteJudgement,
  qteOutcome: state.qteOutcome,
  recentOutcomeT: +state.recentOutcomeT.toFixed(2),
  rocketFart: state.rocketFart,
  cameraFollowX: +state.cameraFollowX.toFixed(2),
  cameraFollowY: +state.camY.toFixed(2),
  cumRisk: +state.cumRisk.toFixed(2),
  fartPush: +state.fartPush.toFixed(2),
  jumpY: +state.jumpY.toFixed(2),
  playerX: +player.position.x.toFixed(2),
  camX: +camera.position.x.toFixed(2),
  groundX: +ground.position.x.toFixed(1),
  skyX: +REGION_SKY.town.sky.position.x.toFixed(1),
  propX: props.find(p => p.alive) ? +props.find(p => p.alive).mesh.position.x.toFixed(1) : null,
  dyingT: +state.dyingT.toFixed(2),
  curtainL: +curtL.position.x.toFixed(1),
  clouds: fartClouds.filter(c => c.life > 0).length,
  poops: poops.filter(p => p.life > 0).length,
  models: Object.keys(modelCache).length,
  props: props.filter(p => p.alive).length,
  planes: planes.map(p => ({
    kind: p.kind,
    active: p.active,
    falling: p.falling,
    x: p.mesh ? +p.mesh.position.x.toFixed(1) : null,
    y: p.mesh ? +p.mesh.position.y.toFixed(1) : null,
  })),
  aerials: aerials.map(a => ({
    kind: a.kind,
    active: a.active,
    falling: a.falling,
    x: a.mesh ? +a.mesh.position.x.toFixed(1) : null,
    y: a.mesh ? +a.mesh.position.y.toFixed(1) : null,
  })),
  geese: geese.map(g => ({
    active: g.active,
    x: g.mesh ? +g.mesh.position.x.toFixed(1) : null,
    z: g.mesh ? +g.mesh.position.z.toFixed(1) : null,
  })),
  region: getRegionId(state.dist),
  foodEvent: state.activeFoodEvent ? state.activeFoodEvent.id : null,
  foodEventTitle: state.activeFoodEvent ? state.activeFoodEvent.title : null,
  heavyGravityMul: state.heavyGravityMul,
  heavyLandingBoostT: +state.heavyLandingBoostT.toFixed(2),
  hForce: +state.eff.hForce.toFixed(2),
  vForce: +state.eff.vForce.toFixed(2),
  exhaustExp: progress.exhaustExp,
  stateExp: state.exhaustExp,
  bodyLevel: progress.bodyLevel,
  build: state.build.length,
  sportsBalls: sportsBallDebugInfo(),
  sharks: sharkDebugInfo(),
  furniture: furnitureDebugInfo(),
});
