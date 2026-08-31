// 模块化重构：由 paper-theater-runner.html 拆出
import * as THREE from 'three';
import { camera, camDist, CAM_X, CAM_Y, CAM_Z, LOOK_Y } from './engine.js';
import { player } from '../world/character.js';
import { state } from './state.js';

let cameraTraceT = 0;
if (typeof window.__cameraTrace === 'undefined') window.__cameraTrace = true;
const DEG = Math.PI / 180;
function ease01(k) {
  k = Math.max(0, Math.min(1, k));
  return k * k * (3 - 2 * k);
}
function mushroomMaxRoll(seconds) {
  const ramp = Math.min(1, Math.max(0, seconds - 8) / 26);
  return (10 + ramp * 10) * DEG;
}
function pickMushroomTarget() {
  const elapsed = state.mushroomT;
  const maxRoll = mushroomMaxRoll(elapsed);
  state.mushroomDir *= Math.random() < 0.82 ? -1 : 1;
  const minRoll = Math.min(maxRoll, (8 + Math.min(1, elapsed / 18) * 2) * DEG);
  const magnitude = minRoll + Math.random() * Math.max(0, maxRoll - minRoll);
  return state.mushroomDir * magnitude;
}
function updateMushroomWorldRoll(dt, t) {
  if (state.activeFoodEvent?.id !== 'wildMushroom11' || (state.phase !== 'run' && state.phase !== 'dying')) {
    state.mushroomRoll += (0 - state.mushroomRoll) * Math.min(1, dt * 6);
    state.mushroomPhase = 'calm';
    state.mushroomPhaseT = 0;
    return;
  }

  state.mushroomT += dt;
  state.mushroomPhaseT += dt;

  if (state.mushroomPhase === 'calm') {
    state.mushroomRoll += (0 - state.mushroomRoll) * Math.min(1, dt * 3.2);
    if (state.mushroomPhaseT >= state.mushroomPhaseDur) {
      state.mushroomPhase = 'tilt';
      state.mushroomPhaseT = 0;
      state.mushroomRollFrom = state.mushroomRoll;
      state.mushroomRollTarget = pickMushroomTarget();
      const span = Math.abs(state.mushroomRollTarget - state.mushroomRollFrom);
      state.mushroomPhaseDur = 2.0 + Math.min(0.9, span * 1.2) + Math.random() * 0.55;
    }
  } else if (state.mushroomPhase === 'tilt') {
    const k = ease01(state.mushroomPhaseT / state.mushroomPhaseDur);
    state.mushroomRoll = state.mushroomRollFrom + (state.mushroomRollTarget - state.mushroomRollFrom) * k;
    if (state.mushroomPhaseT >= state.mushroomPhaseDur) {
      state.mushroomPhase = 'hold';
      state.mushroomPhaseT = 0;
      state.mushroomPhaseDur = 0.7 + Math.random() * 0.75;
    }
  } else if (state.mushroomPhase === 'hold') {
    const drift = Math.sin(t * 0.95) * Math.min(0.7 * DEG, Math.abs(state.mushroomRollTarget) * 0.04);
    state.mushroomRoll += (state.mushroomRollTarget + drift - state.mushroomRoll) * Math.min(1, dt * 1.2);
    if (state.mushroomPhaseT >= state.mushroomPhaseDur) {
      state.mushroomPhase = 'return';
      state.mushroomPhaseT = 0;
      state.mushroomRollFrom = state.mushroomRoll;
      state.mushroomRollTarget = 0;
      const span = Math.abs(state.mushroomRollTarget - state.mushroomRollFrom);
      state.mushroomPhaseDur = 2.0 + Math.min(0.75, span * 1.25) + Math.random() * 0.6;
    }
  } else {
    const k = ease01(state.mushroomPhaseT / state.mushroomPhaseDur);
    state.mushroomRoll = state.mushroomRollFrom * (1 - k);
    if (state.mushroomPhaseT >= state.mushroomPhaseDur) {
      state.mushroomRoll = 0;
      state.mushroomPhase = 'calm';
      state.mushroomPhaseT = 0;
      state.mushroomPhaseDur = 3.8 + Math.random() * 2.4;
    }
  }
}
function worldToScreen(wx, wy) {
  const distZ = CAM_Z * camDist;
  const vh = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * distZ;
  const vw = vh * camera.aspect;
  return {
    x: ((wx - camera.position.x) / vw + 0.5) * innerWidth,
    y: (0.5 - (wy - camera.position.y) / vh) * innerHeight,
  };
}
function rollAwareCameraCorrection(localX, localY) {
  const r = state.activeFoodEvent?.id === 'wildMushroom11' ? state.mushroomRoll || 0 : 0;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return {
    x: localX * c - localY * s,
    y: localX * s + localY * c,
  };
}

function getPlayerScreenBounds() {
  const box = new THREE.Box3().setFromObject(player);
  if (box.isEmpty()) return null;
  const points = [];
  for (const x of [box.min.x, box.max.x]) {
    for (const y of [box.min.y, box.max.y]) {
      for (const z of [box.min.z, box.max.z]) {
        const p = new THREE.Vector3(x, y, z).project(camera);
        points.push(p);
      }
    }
  }
  const minX = Math.min(...points.map(p => p.x));
  const maxX = Math.max(...points.map(p => p.x));
  const minY = Math.min(...points.map(p => p.y));
  const maxY = Math.max(...points.map(p => p.y));
  return {
    left: Math.round((minX + 1) * 0.5 * innerWidth),
    right: Math.round((maxX + 1) * 0.5 * innerWidth),
    top: Math.round((1 - maxY) * 0.5 * innerHeight),
    bottom: Math.round((1 - minY) * 0.5 * innerHeight),
    ndc: {
      left: +minX.toFixed(3), right: +maxX.toFixed(3),
      top: +maxY.toFixed(3), bottom: +minY.toFixed(3),
    },
  };
}

const CAMERA_DEAD_ZONE = {
  safeLeft: 0.05, safeRight: 0.95, safeTop: 0.05, safeBottom: 0.95,
  top: 0.28,
  bottom: 0.70,
  horizontalSmooth: 8,
  horizontalBoostSmooth: 12,
  verticalSmooth: 8,
  flightVerticalSmooth: 9,  // 飞行中垂直平滑跟随系数（绕开死区，避免高速上升闪移）
};

function setCameraPose(followX, followY, jx, jy, t) {
  camera.position.set(
    CAM_X + followX + jx,
    CAM_Y * camDist + followY + jy,
    CAM_Z * camDist
  );
  const lookY = LOOK_Y + followY;
  camera.lookAt(CAM_X + followX, lookY, 0);
  camera.rotation.z += Math.sin(t * 0.13) * 0.004 + state.mushroomRoll;
  return lookY;
}

function updateCameraFollow(dt, jx, jy, t) {
  updateMushroomWorldRoll(dt, t);
  if (state.phase !== 'run' && state.phase !== 'dying') {
    state.cameraFollowX = player.position.x + 2;
    state.camY = 0;
    state.cameraFollowReady = false;
  } else {
    if (!state.cameraFollowReady) {
      state.cameraFollowX = player.position.x + 2;
      state.camY = 0;
      state.cameraFollowReady = true;
    }
    const targetFollowX = player.position.x + 2;
    const boosted = state.fartFlying || state.fartBoost > 0;
    const horizontalAlpha = 1 - Math.exp(-
      (boosted ? CAMERA_DEAD_ZONE.horizontalBoostSmooth : CAMERA_DEAD_ZONE.horizontalSmooth) * dt);
    // 水平方向取消死区，持续平滑追踪角色，同时保留左侧构图偏移。
    state.cameraFollowX += (targetFollowX - state.cameraFollowX) * horizontalAlpha;

    // 先用当前镜头投影完整角色，再根据越过垂直死区或水平安全边界的像素距离计算修正量。
    setCameraPose(state.cameraFollowX, state.camY, jx, jy, t);
    camera.updateMatrixWorld(true);
    const bounds = getPlayerScreenBounds();
    if (bounds) {
      const zone = {
        top: innerHeight * CAMERA_DEAD_ZONE.top,
        bottom: innerHeight * CAMERA_DEAD_ZONE.bottom,
      };
      const safe = {
        left: innerWidth * CAMERA_DEAD_ZONE.safeLeft,
        right: innerWidth * CAMERA_DEAD_ZONE.safeRight,
        top: innerHeight * CAMERA_DEAD_ZONE.safeTop,
        bottom: innerHeight * CAMERA_DEAD_ZONE.safeBottom,
      };
      const viewDistance = Math.max(0.1, camera.position.z - player.position.z);
      const viewHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * viewDistance;
      const pxPerWorldX = innerWidth / (viewHeight * camera.aspect);
      const pxPerWorldY = innerHeight / viewHeight;

      const flying = state.blastFlying || state.fartFlying;
      if (flying) {
        // 飞行中（崩飞/火箭/大屁/失禁）：基于玩家屏幕中心位置的平滑垂直跟随，
        // 绕开死区+急修逻辑，避免高速上升时镜头一帧暴移（闪移）。
        const targetFrac = 0.5;            // 让角色大致保持在屏幕中部
        const targetXFrac = 0.38;
        const playerScreenCenterX = (bounds.left + bounds.right) / 2;
        const playerScreenCenterY = (bounds.top + bounds.bottom) / 2;
        const localX = (playerScreenCenterX - targetXFrac * innerWidth) / pxPerWorldX;
        const localY = (targetFrac * innerHeight - playerScreenCenterY) / pxPerWorldY;
        const fix = rollAwareCameraCorrection(localX, localY);
        const rollPower = Math.min(1, Math.abs(state.mushroomRoll || 0) / Math.PI);
        const flightAlpha = 1 - Math.exp(-(CAMERA_DEAD_ZONE.flightVerticalSmooth + rollPower * 8) * dt);
        state.cameraFollowX += fix.x * flightAlpha;
        state.camY += fix.y * flightAlpha;
      } else {
        let overflowX = 0, overflowY = 0;
        if (bounds.left < safe.left) overflowX = bounds.left - safe.left;
        else if (bounds.right > safe.right) overflowX = bounds.right - safe.right;
        if (bounds.top < zone.top) overflowY = bounds.top - zone.top;
        else if (bounds.bottom > zone.bottom) overflowY = bounds.bottom - zone.bottom;

        const correction = rollAwareCameraCorrection(
          overflowX / pxPerWorldX,
          -overflowY / pxPerWorldY
        );
        const emergency = bounds.left < safe.left || bounds.right > safe.right ||
          bounds.top < safe.top || bounds.bottom > safe.bottom;

        if (emergency) {
          // 接近屏幕边缘时立即校正，保证角色不会继续出屏。
          state.cameraFollowX += correction.x * 1.1;
          state.camY += correction.y * 1.1;
        } else {
          const alpha = 1 - Math.exp(-CAMERA_DEAD_ZONE.verticalSmooth * dt);
          state.cameraFollowX += correction.x * alpha;
          state.camY += correction.y * alpha;
        }
      }
    }
  }
  return setCameraPose(state.cameraFollowX, state.camY, jx, jy, t);
}

function traceCamera(dt, lookY) {
  if (!window.__cameraTrace || (!state.fartFlying && state.phase !== 'dying')) return;
  cameraTraceT -= dt;
  if (cameraTraceT > 0) return;
  cameraTraceT = 0.2;
  camera.updateMatrixWorld(true);
  const screen = getPlayerScreenBounds();
  if (!screen) return;
  const margin = 8;
  const inFrame = screen.left >= margin && screen.right <= innerWidth - margin &&
    screen.top >= margin && screen.bottom <= innerHeight - margin;
  const payload = {
    phase: state.phase,
    fartFlying: state.fartFlying,
    jumpY: +state.jumpY.toFixed(3),
    playerY: +player.position.y.toFixed(3),
    camY: +state.camY.toFixed(3),
    cameraY: +camera.position.y.toFixed(3),
    lookY: +lookY.toFixed(3),
    cameraZ: +camera.position.z.toFixed(3),
    camDist: +camDist.toFixed(3),
    screen,
    viewport: { width: innerWidth, height: innerHeight },
    inFrame,
  };
  (inFrame ? console.log : console.warn)('[camera-trace]', payload);
}

export { worldToScreen, getPlayerScreenBounds, setCameraPose, updateCameraFollow, traceCamera };
