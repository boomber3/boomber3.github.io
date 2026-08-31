import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { scene, camera } from '../core/engine.js';
import { CONFIG } from '../config.js';
import { state, addShake } from '../core/state.js';
import { paperTexture, paperMat } from './textures.js';
import { gainBreakXp } from '../systems/growth.js';
import { playSmash } from '../systems/audio.js';

const breakTexs = [
  paperTexture(64, 64, (g, w, h) => {
    g.fillStyle = '#a56a38'; g.fillRect(4, 4, 56, 56);
    g.strokeStyle = '#6e4220'; g.lineWidth = 4;
    g.strokeRect(4, 4, 56, 56);
    g.beginPath(); g.moveTo(4, 4); g.lineTo(60, 60); g.moveTo(60, 4); g.lineTo(4, 60); g.stroke();
  }),
  paperTexture(64, 64, (g, w, h) => {
    g.fillStyle = '#9a6a3c'; g.beginPath(); g.ellipse(32, 34, 26, 30, 0, 0, 7); g.fill();
    g.strokeStyle = '#6e4220'; g.lineWidth = 4;
    g.beginPath(); g.ellipse(32, 34, 26, 30, 0, 0, 7); g.stroke();
    g.beginPath(); g.ellipse(32, 20, 24, 8, 0, 0, 7); g.stroke();
    g.beginPath(); g.ellipse(32, 48, 24, 8, 0, 0, 7); g.stroke();
  }),
  paperTexture(64, 64, (g, w, h) => {
    g.fillStyle = '#9a9a9a'; g.fillRect(20, 6, 24, 54);
    g.fillStyle = '#b8b8b8'; g.fillRect(14, 2, 36, 10);
    g.fillStyle = '#888'; g.fillRect(14, 54, 36, 8);
  }),
  paperTexture(64, 64, (g, w, h) => {
    g.fillStyle = '#8a8a8a'; g.fillRect(28, 18, 8, 22);
    g.fillStyle = '#a8a8a8'; g.beginPath(); g.arc(32, 12, 10, 0, 7); g.fill();
    g.fillStyle = '#7a7a7a'; g.fillRect(18, 40, 28, 18);
  }),
];

const breakGeo = new THREE.PlaneGeometry(1.0, 1.0);
const trafficLoader = new FBXLoader();
const trafficModels = {};
let trafficLoadStarted = false;

// 纸片外观替换：kenney_car-kit 低模车件（GLB，4 种，对应原纸片 kind 0~3）
const BREAK_MODEL_FILES = [
  { id: 'box', targetH: 0.95, hitRange: 0.85 },
  { id: 'cone', targetH: 0.9, hitRange: 0.8 },
  { id: 'debris-tire', targetH: 0.75, hitRange: 0.75 },
  { id: 'kart-ooli', targetH: 0.85, hitRange: 0.85 },
];
const breakModels = {};   // id -> 已加载并归一化的模型（克隆源）
const gltfLoader = new GLTFLoader();
let breakModelLoadStarted = false;
const BREAK_MODEL_BASE = 'assets/breakables/';
function loadBreakModels() {
  if (breakModelLoadStarted) return;
  breakModelLoadStarted = true;
  BREAK_MODEL_FILES.forEach((m, index) => {
    gltfLoader.load(BREAK_MODEL_BASE + m.id + '.glb', gltf => {
      const obj = gltf.scene;
      obj.traverse(o => {
        if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; }
      });
      const box = new THREE.Box3().setFromObject(obj);
      const size = box.getSize(new THREE.Vector3());
      if (size.y > 1e-4) obj.scale.setScalar(m.targetH / size.y);
      const box2 = new THREE.Box3().setFromObject(obj);
      obj.position.y -= box2.min.y;   // 底部对齐地面
      const box3 = new THREE.Box3().setFromObject(obj);
      const center = box3.getCenter(new THREE.Vector3());
      obj.position.x -= center.x;
      obj.position.z -= center.z;
      breakModels[m.id] = obj;
      // 替换场上已有同 kind 的纸片 mesh
      for (const b of breakables) {
        if (b.active && b.asset === 'paper' && b.kind === index) replacePaperMesh(b);
      }
    }, undefined, e => console.warn('[break] GLB 加载失败:', m.id, e));
  });
}
// 纸片 kind 0~3 对应的模型 id
const BREAK_KIND_IDS = BREAK_MODEL_FILES.map(m => m.id);
function breakBaseY(kind) {
  return breakModels[BREAK_KIND_IDS[kind]] ? 0 : CONFIG.breakables.y;
}
function breakHitRange(kind) {
  return (BREAK_MODEL_FILES[kind] && BREAK_MODEL_FILES[kind].hitRange) || CONFIG.breakables.range;
}
// 用新 mesh 替换场上指定纸片（模型异步加载完成后调用）
function replacePaperMesh(b) {
  const src = breakModels[BREAK_KIND_IDS[b.kind]];
  if (!src) return;
  const old = b.mesh;
  const x = old ? old.position.x : camera.position.x + 12;
  scene.remove(old);
  const c = src.clone();
  c.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  b.mesh = c;
  b.mesh.position.set(x, 0, 0.5);
  b.mesh.rotation.y = Math.random() * Math.PI * 2;
  b.mesh.rotation.x = b.pop ? -1.35 : 0;
  b.mesh.visible = true;
  scene.add(b.mesh);
}

const TRAFFIC_KINDS = [
  { id: 'traffic_01', h: 1.65, hitRange: 0.92, xp: 5 },
  { id: 'traffic_02', h: 1.72, hitRange: 0.92, xp: 5 },
  { id: 'traffic_03', h: 1.72, hitRange: 0.92, xp: 5 },
  { id: 'traffic_04', h: 1.72, hitRange: 0.92, xp: 5 },
  { id: 'traffic_05', h: 1.2, hitRange: 0.86, xp: 4 },
  { id: 'traffic_06', h: 1.15, hitRange: 0.86, xp: 4 },
  { id: 'traffic_07', h: 1.25, hitRange: 0.9, xp: 4 },
  { id: 'traffic_08', h: 1.35, hitRange: 0.9, xp: 4 },
  { id: 'traffic_09', h: 1.35, hitRange: 0.9, xp: 4 },
  { id: 'traffic_10', h: 1.1, hitRange: 0.82, xp: 4 },
  { id: 'traffic_11', h: 0.75, hitRange: 0.72, xp: 3 },
  { id: 'traffic_12', h: 0.78, hitRange: 0.72, xp: 3 },
  { id: 'traffic_13', h: 0.8, hitRange: 0.72, xp: 3 },
  { id: 'traffic_14', h: 0.8, hitRange: 0.72, xp: 3 },
  { id: 'traffic_15', h: 0.9, hitRange: 0.75, xp: 3 },
  { id: 'traffic_18', h: 1.2, hitRange: 0.86, xp: 4 },
  { id: 'traffic_19', h: 1.2, hitRange: 0.86, xp: 4 },
];

const TRAFFIC_LAYERS = [
  { id: 'road', z: 0.42, destructible: true, scaleMul: 2.0 },
  { id: 'curb', z: -0.62, destructible: true, scaleMul: 2.0 },
  { id: 'back', z: -2.35, destructible: false, scaleMul: 1.18 },
];

const breakables = [];
for (let i = 0; i < 12; i++) {
  const m = new THREE.Mesh(breakGeo, paperMat(breakTexs[i % breakTexs.length]));
  m.visible = false;
  scene.add(m);
  breakables.push({ mesh: m, active: false, kind: 0, asset: 'paper', layer: 'road', destructible: true, hitRange: CONFIG.breakables.range });
}

state.breakCursor = 30;

function loadTrafficModels() {
  if (trafficLoadStarted) return;
  trafficLoadStarted = true;
  for (const kind of TRAFFIC_KINDS) {
    trafficLoader.load(`assets/traffic/${kind.id}.fbx`, obj => {
      obj.traverse(o => {
        if (!o.isMesh) return;
        o.castShadow = false;
        o.receiveShadow = false;
        if (o.material?.color) o.material.color.multiplyScalar(1.08);
      });
      const box = new THREE.Box3().setFromObject(obj);
      const size = box.getSize(new THREE.Vector3());
      if (size.y > 1e-4) obj.scale.setScalar(kind.h / size.y);
      const box2 = new THREE.Box3().setFromObject(obj);
      obj.position.y -= box2.min.y;
      const box3 = new THREE.Box3().setFromObject(obj);
      const center = box3.getCenter(new THREE.Vector3());
      obj.position.x -= center.x;
      obj.position.z -= center.z;
      trafficModels[kind.id] = obj;
    }, undefined, e => console.warn('[traffic] load failed', kind.id, e));
  }
}

function createPaperBreakable(kind) {
  const src = breakModels[BREAK_KIND_IDS[kind]];
  if (src) {
    const c = src.clone();
    c.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
    return c;
  }
  return new THREE.Mesh(breakGeo, paperMat(breakTexs[kind]));   // 模型未加载完时 fallback 平面
}

function pickTrafficLayer() {
  const r = Math.random();
  const roadCut = CONFIG.breakables.trafficRoadChance;
  const curbCut = roadCut + CONFIG.breakables.trafficCurbChance;
  if (r < roadCut) return TRAFFIC_LAYERS[0];
  if (r < curbCut) return TRAFFIC_LAYERS[1];
  return TRAFFIC_LAYERS[2];
}

function placeTrafficBreakable(b, x) {
  const available = TRAFFIC_KINDS.filter(k => trafficModels[k.id]);
  if (!available.length) return false;
  const kind = available[(Math.random() * available.length) | 0];
  const layer = pickTrafficLayer();
  if (b.mesh) scene.remove(b.mesh);
  const inst = trafficModels[kind.id].clone(true);
  inst.scale.multiplyScalar(layer.scaleMul);
  b.mesh = inst;
  b.asset = 'traffic';
  b.kind = kind.id;
  b.xp = kind.xp || CONFIG.breakables.xp;
  b.layer = layer.id;
  b.destructible = layer.destructible;
  b.hitRange = kind.hitRange * (layer.destructible ? layer.scaleMul : 1);
  b.mesh.position.set(x, 0, layer.z);
  b.mesh.rotation.y = (Math.random() - 0.5) * 0.35;
  b.mesh.visible = true;
  b.pop = layer.destructible ? { t: 0, dur: 0.55 } : null;
  b.mesh.rotation.x = b.pop ? -1.15 : 0;
  scene.add(b.mesh);
  b.active = true;
  return true;
}

function placeBreakable(b, x) {
  b.active = true;
  if (Math.random() < CONFIG.breakables.trafficChance && placeTrafficBreakable(b, x)) return;
  b.kind = (Math.random() * breakTexs.length) | 0;
  if (b.mesh) scene.remove(b.mesh);
  b.mesh = createPaperBreakable(b.kind);
  b.asset = 'paper';
  b.layer = 'road';
  b.destructible = true;
  b.xp = CONFIG.breakables.xp;
  b.hitRange = breakHitRange(b.kind);
  b.mesh.position.set(x, breakBaseY(b.kind), 0.5);
  b.mesh.rotation.y = Math.random() * Math.PI * 2;
  b.mesh.visible = true;
  b.pop = { t: 0, dur: 0.65 };
  b.mesh.rotation.x = -1.35;
  scene.add(b.mesh);
}

const bitTex = paperTexture(16, 16, (g, w, h) => {
  g.fillStyle = '#8a5a30'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#5e3a20'; g.fillRect(0, 0, w, 3);
});
const bitGeo = new THREE.PlaneGeometry(0.15, 0.15);
const bits = [];
for (let i = 0; i < 40; i++) {
  const m = new THREE.Mesh(bitGeo, paperMat(bitTex));
  m.visible = false;
  scene.add(m);
  bits.push({ mesh: m, life: 0, vx: 0, vy: 0, spin: 0 });
}

function smashBreakable(b) {
  if (!b.destructible) return;
  b.active = false;
  b.mesh.visible = false;
  const bx = b.mesh.position.x;
  const by = b.mesh.position.y + (b.asset === 'traffic' ? 0.7 : 0);
  for (let i = 0; i < (b.asset === 'traffic' ? 10 : 8); i++) {
    const bit = bits.find(q => q.life <= 0);
    if (!bit) break;
    bit.mesh.visible = true;
    bit.mesh.position.set(bx + (Math.random() - 0.5) * 0.48, by + 0.35, b.mesh.position.z + 0.05);
    bit.vx = (Math.random() - 0.5) * 3.8;
    bit.vy = 1.4 + Math.random() * 2.7;
    bit.life = 0.75 + Math.random() * 0.55;
    bit.spin = (Math.random() - 0.5) * 22;
    bit.mesh.scale.setScalar(0.72 + Math.random() * 0.78);
  }
  playSmash();
  addShake(0.3, 0, -0.1);
  gainBreakXp(b.xp || CONFIG.breakables.xp);
}

function resetBreakCursor() { state.breakCursor = 30; }

function spawnDebugBreakable(x, kind) {
  const b = breakables.find(q => !q.active);
  if (!b) return null;
  if (kind === 'traffic') {
    loadTrafficModels();
    return placeTrafficBreakable(b, x) ? b : null;
  }
  if (kind !== undefined && breakTexs[kind]) {
    b.active = true;
    b.kind = kind;
    if (b.mesh) scene.remove(b.mesh);
    b.mesh = createPaperBreakable(kind);
    b.asset = 'paper';
    b.layer = 'road';
    b.destructible = true;
    b.xp = CONFIG.breakables.xp;
    b.hitRange = breakHitRange(kind);
    b.mesh.position.set(x, breakBaseY(kind), 0.5);
    b.mesh.rotation.y = Math.random() * Math.PI * 2;
    b.mesh.visible = true;
    b.pop = { t: 0, dur: 0.65 };
    b.mesh.rotation.x = -1.35;
    scene.add(b.mesh);
    return b;
  }
  placeBreakable(b, x);
  return b;
}

export { breakables, placeBreakable, smashBreakable, bits, resetBreakCursor, spawnDebugBreakable, loadTrafficModels, loadBreakModels };
