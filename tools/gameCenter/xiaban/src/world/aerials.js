import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { scene, camera } from '../core/engine.js';
import { CONFIG } from '../config.js';
import { state, addShake } from '../core/state.js';
import { gainBreakXp } from '../systems/growth.js';
import { playPlaneExplode } from '../systems/audio.js';
import { bits } from './breakables.js';
import { player } from './character.js';

const loader = new FBXLoader();
const texLoader = new THREE.TextureLoader();
const models = {};
const ready = { ufo: false, balloon: false };
const aerials = [];
let modelsLoaded = false;

const SPECS = {
  ufo: {
    url: 'models_city/air/ufo/source/UFO.fbx',
    texture: 'models_city/air/ufo/textures/Texture_Ufo.png',
    h: 1.25,
    z: -4.8,
    halfH: 0.5,
    hitX: 1.15,
    hitY: 0.85,
    fallGravity: 13,
    speedMul: 1.18,
  },
  balloon: {
    url: 'models_city/air/hot-air-balloon/source/hot_air_balloon.fbx',
    texture: 'models_city/air/hot-air-balloon/textures/hot_air_balloon_blue_vertical_albedo.png',
    h: 2.7,
    z: -5.5,
    halfH: 1.25,
    hitX: 1.25,
    hitY: 1.55,
    fallGravity: 10,
    speedMul: 0.76,
  },
};

for (let i = 0; i < CONFIG.aerials.count; i++) {
  aerials.push({ mesh: null, inst: null, kind: 'ufo', speed: 0, y: 0, phase: 0, active: false, falling: false, vy: 0, spinV: 0 });
}

function applyTexture(root, texturePath) {
  const tex = texLoader.load(texturePath);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.flipY = true;
  root.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = false;
    o.receiveShadow = false;
    o.material = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
  });
}

function normalizeModel(root, spec) {
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  if (size.y > 1e-4) {
    const s = spec.h / size.y;
    root.scale.setScalar(s);
  }
  const box2 = new THREE.Box3().setFromObject(root);
  const center = box2.getCenter(new THREE.Vector3());
  root.position.sub(center);
}

function loadAerialModels() {
  if (modelsLoaded) return;
  modelsLoaded = true;
  for (const [kind, spec] of Object.entries(SPECS)) {
    loader.load(spec.url, obj => {
      applyTexture(obj, spec.texture);
      normalizeModel(obj, spec);
      models[kind] = obj;
      ready[kind] = true;
      console.log('[aerial] loaded', kind);
    }, undefined, e => console.warn('[aerial] load failed', kind, e));
  }
}

function pickKind() {
  const wantUfo = Math.random() < CONFIG.aerials.ufoChance;
  if (wantUfo && ready.ufo) return 'ufo';
  if (!wantUfo && ready.balloon) return 'balloon';
  if (ready.ufo) return 'ufo';
  if (ready.balloon) return 'balloon';
  return null;
}

function spawnAerial(a, x, forceKind = null) {
  const kind = forceKind && ready[forceKind] ? forceKind : pickKind();
  if (!kind) return;
  const spec = SPECS[kind];
  if (a.mesh) scene.remove(a.mesh);
  const inst = models[kind].clone(true);
  const g = new THREE.Group();
  g.add(inst);
  a.mesh = g;
  a.inst = inst;
  a.kind = kind;
  a.speed = (CONFIG.aerials.speedMin + Math.random() * (CONFIG.aerials.speedMax - CONFIG.aerials.speedMin)) * spec.speedMul;
  const layer = CONFIG.aerials[kind] || { yMin: 5.3, yMax: 8.7 };
  a.y = layer.yMin + Math.random() * (layer.yMax - layer.yMin);
  a.phase = Math.random() * 7;
  a.falling = false;
  a.vy = 0;
  a.spinV = 0;
  g.position.set(x !== undefined ? x : camera.position.x + 16 + Math.random() * 24, a.y, spec.z);
  g.rotation.y = kind === 'ufo' ? Math.PI * 0.18 : -Math.PI * 0.12;
  g.visible = true;
  scene.add(g);
  a.active = true;
}

function spawnDebugAerial(kind = 'ufo') {
  if (!ready.ufo || !ready.balloon) loadAerialModels();
  if (!ready[kind]) {
    console.warn('[aerial] model not ready:', kind);
    return;
  }
  const a = aerials.find(q => !q.active) || aerials[0];
  spawnAerial(a, camera.position.x + 4, kind);
}

function smashAerial(a) {
  const spec = SPECS[a.kind];
  const bx = a.mesh.position.x;
  const by = a.mesh.position.y;
  a.falling = true;
  a.vy = a.kind === 'balloon' ? -0.4 : 0.8 + Math.random();
  a.spinV = (Math.random() - 0.5) * (a.kind === 'balloon' ? 5 : 10);
  for (let i = 0; i < (a.kind === 'balloon' ? 10 : 8); i++) {
    const bit = bits.find(q => q.life <= 0);
    if (!bit) break;
    bit.mesh.visible = true;
    bit.mesh.position.set(bx + (Math.random() - 0.5) * 0.65, by + (Math.random() - 0.5) * 0.35, spec.z + 0.2);
    bit.vx = (Math.random() - 0.5) * 4.2;
    bit.vy = 0.8 + Math.random() * 2.6;
    bit.life = 0.75 + Math.random() * 0.5;
    bit.spin = (Math.random() - 0.5) * 20;
    bit.mesh.scale.setScalar(0.5 + Math.random() * 0.65);
  }
  playPlaneExplode();
  addShake(a.kind === 'balloon' ? 0.25 : 0.32, 0, 0.14);
  gainBreakXp(10);   // 热气球/UFO：超低频高空，经验最高
}

function updateAerials(dt, t) {
  if (ready.ufo || ready.balloon) {
    for (const a of aerials) {
      if (!a.active && !a.falling) spawnAerial(a);
    }
  }
  for (const a of aerials) {
    if (!a.active || !a.mesh) continue;
    const spec = SPECS[a.kind];
    if (a.falling) {
      a.vy -= spec.fallGravity * dt;
      a.mesh.position.y += a.vy * dt;
      a.mesh.position.x -= a.speed * 0.35 * dt;
      a.mesh.rotation.z += a.spinV * dt;
      a.mesh.rotation.x += a.spinV * 0.45 * dt;
      if (a.mesh.position.y <= spec.halfH) {
        a.active = false;
        a.mesh.visible = false;
        scene.remove(a.mesh);
        spawnAerial(a);
      }
      continue;
    }
    a.mesh.position.x -= a.speed * dt;
    a.mesh.position.y = a.y + Math.sin(t * 0.9 + a.phase) * (a.kind === 'balloon' ? 0.22 : 0.16);
    a.mesh.rotation.z = Math.sin(t * 1.7 + a.phase) * (a.kind === 'balloon' ? 0.035 : 0.055);
    if (a.kind === 'ufo') a.inst.rotation.y += dt * 0.55;
    if (Math.abs(a.mesh.position.x - player.position.x) < spec.hitX &&
        Math.abs(a.mesh.position.y - (player.position.y + 0.6)) < spec.hitY) {
      smashAerial(a);
    }
    if (a.mesh.position.x < camera.position.x - 16) spawnAerial(a);
  }
}

export { aerials, loadAerialModels, spawnAerial, spawnDebugAerial, updateAerials };
