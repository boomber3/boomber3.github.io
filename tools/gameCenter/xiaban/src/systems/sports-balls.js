import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { scene, camera } from '../core/engine.js';
import { state } from '../core/state.js';

const BALL_FILES = [
  { id: 'basketball', file: 'basketball.glb', scale: 0.42, color: '#d86b24' },
  { id: 'soccer', file: 'soccer_ball.glb', scale: 0.44, color: '#f6f1e8' },
  { id: 'tennis', file: 'tennis_ball.glb', scale: 0.30, color: '#b9f044' },
  { id: 'football', file: 'american_football.glb', scale: 0.50, color: '#8b4f2d' },
];
const loader = new GLTFLoader();
const templates = {};
const ready = {};
const sportsBalls = [];
let loading = false;

function prepModel(root, cfg) {
  const g = new THREE.Group();
  const model = root.clone(true);
  model.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = false;
    o.receiveShadow = false;
    if (!o.material || !o.material.map) {
      o.material = new THREE.MeshLambertMaterial({ color: cfg.color });
    }
  });
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  const maxSide = Math.max(size.x, size.y, size.z) || 1;
  model.position.sub(center);
  model.scale.setScalar(cfg.scale / maxSide);
  g.add(model);
  return g;
}

function loadSportsBallModels() {
  if (loading) return;
  loading = true;
  for (const cfg of BALL_FILES) {
    ready[cfg.id] = false;
    loader.load(
      `assets/sports-balls/${cfg.file}`,
      gltf => {
        templates[cfg.id] = prepModel(gltf.scene, cfg);
        ready[cfg.id] = true;
        console.log('[sports] 球模型加载成功:', cfg.id);
      },
      undefined,
      e => console.warn('[sports] 球模型加载失败:', cfg.id, e)
    );
  }
}

function makeBall(kind) {
  const cfg = BALL_FILES.find(b => b.id === kind) || BALL_FILES[0];
  const src = templates[cfg.id];
  if (!src) return null;
  const mesh = src.clone(true);
  mesh.visible = false;
  scene.add(mesh);
  return {
    kind: cfg.id,
    mesh,
    life: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    spinX: 0,
    spinY: 0,
    spinZ: 0,
    radius: cfg.scale * 0.5,
  };
}

function spawnSportsBall(x, y) {
  const cfg = BALL_FILES[(Math.random() * BALL_FILES.length) | 0];
  let ball = sportsBalls.find(b => b.life <= 0 && b.kind === cfg.id);
  if (!ball) {
    if (sportsBalls.length >= 240) return false;
    ball = makeBall(cfg.id);
    if (!ball) return false;
    sportsBalls.push(ball);
  }
  ball.mesh.visible = true;
  ball.mesh.position.set(
    x - 0.38 + (Math.random() - 0.5) * 0.48,
    y + (Math.random() - 0.5) * 0.72,
    0.05 + (Math.random() - 0.5) * 0.9
  );
  ball.vx = -(3.2 + Math.random() * 7.0);
  ball.vy = -1.2 + Math.random() * 7.4;
  ball.vz = (Math.random() - 0.5) * 5.2;
  ball.spinX = (Math.random() - 0.5) * 18;
  ball.spinY = (Math.random() - 0.5) * 22;
  ball.spinZ = (Math.random() - 0.5) * 26;
  ball.life = 3.2 + Math.random() * 1.2;
  return true;
}

function spawnSportsBallBurst(x, y, n) {
  const count = Math.max(1, Math.round(n * (state.specialAmountMul || 1)));
  for (let i = 0; i < count; i++) spawnSportsBall(x, y);
}

function updateSportsBalls(dt) {
  for (const b of sportsBalls) {
    if (b.life <= 0) continue;
    b.life -= dt;
    b.vy -= 12 * dt;
    b.mesh.position.x += b.vx * dt;
    b.mesh.position.y += b.vy * dt;
    b.mesh.position.z += b.vz * dt;
    b.mesh.rotation.x += b.spinX * dt;
    b.mesh.rotation.y += b.spinY * dt;
    b.mesh.rotation.z += b.spinZ * dt;
    if (b.mesh.position.y <= b.radius && b.vy < 0) {
      b.mesh.position.y = b.radius;
      b.vy = -b.vy * (0.42 + Math.random() * 0.18);
      b.vx *= 0.82;
      b.vz *= 0.78;
      b.spinX *= 0.88;
      b.spinY *= 0.88;
      b.spinZ *= 0.88;
    }
    if (b.mesh.position.x < camera.position.x - 18 || b.life <= 0) {
      b.life = 0;
      b.mesh.visible = false;
    }
  }
}

function sportsBallDebugInfo() {
  return {
    loaded: BALL_FILES.filter(b => ready[b.id]).length,
    active: sportsBalls.filter(b => b.life > 0).length,
  };
}

export { loadSportsBallModels, spawnSportsBallBurst, updateSportsBalls, sportsBallDebugInfo };
