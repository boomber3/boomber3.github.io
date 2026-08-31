import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { scene, camera } from '../core/engine.js';
import { state } from '../core/state.js';
import { player } from '../world/character.js';

const loader = new GLTFLoader();
const sharks = [];
let template = null;
let loading = false;
let loaded = false;
let loadFailed = false;
const pendingBursts = [];

function fallbackShark() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.16, 0.72, 4, 8),
    new THREE.MeshLambertMaterial({ color: '#6f8893' })
  );
  body.rotation.z = Math.PI * 0.5;
  const belly = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.09, 0.42, 4, 8),
    new THREE.MeshLambertMaterial({ color: '#d9edf2' })
  );
  belly.rotation.z = Math.PI * 0.5;
  belly.position.y = -0.06;
  belly.position.z = 0.02;
  const nose = new THREE.Mesh(
    new THREE.ConeGeometry(0.16, 0.28, 12),
    new THREE.MeshLambertMaterial({ color: '#6f8893' })
  );
  nose.rotation.z = -Math.PI * 0.5;
  nose.position.x = -0.5;
  const tail = new THREE.Mesh(
    new THREE.ConeGeometry(0.18, 0.26, 3),
    new THREE.MeshLambertMaterial({ color: '#526973' })
  );
  tail.rotation.z = Math.PI * 0.5;
  tail.position.x = 0.55;
  tail.scale.y = 1.25;
  const fin = new THREE.Mesh(
    new THREE.ConeGeometry(0.12, 0.28, 3),
    new THREE.MeshLambertMaterial({ color: '#526973' })
  );
  fin.rotation.x = Math.PI;
  fin.position.set(0, 0.18, 0);
  g.add(body, belly, nose, tail, fin);
  return g;
}

function prepShark(root) {
  const g = new THREE.Group();
  const model = root.clone(true);
  model.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = false;
    o.receiveShadow = false;
    o.material = new THREE.MeshBasicMaterial({ color: '#7f9aa6' });
  });
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  const maxSide = Math.max(size.x, size.y, size.z) || 1;
  model.position.sub(center);
  model.scale.setScalar(1.55 / maxSide);
  g.add(model);
  return g;
}

function loadSharkModel() {
  if (loading) return;
  loading = true;
  loader.load(
    'assets/sharknado/shark.glb',
    gltf => {
      template = prepShark(gltf.scene);
      loaded = true;
      console.log('[sharknado] 鲨鱼 GLB 模型加载成功');
      flushPendingBursts();
    },
    undefined,
    e => {
      loadFailed = true;
      template = fallbackShark();
      console.warn('[sharknado] 鲨鱼 GLB 模型加载失败，使用备用造型', e);
      flushPendingBursts();
    }
  );
}

function makeShark() {
  if (!template) {
    loadSharkModel();
    return null;
  }
  const mesh = template.clone(true);
  mesh.visible = false;
  scene.add(mesh);
  return {
    mesh,
    life: 0,
    age: 0,
    lane: 0,
    vx: 0,
    vy: 0,
    swirl: 0,
    swirlSpeed: 0,
    swirlRadius: 0,
    orbitT: 0,
    heightBand: 0,
    heightPhase: 0,
    heightSpeed: 0,
    verticalAmp: 0,
    wobblePhase: 0,
    wobbleSpeed: 0,
    driftBack: 0,
    spinX: 0,
    spinY: 0,
    spinZ: 0,
  };
}

function tintShark(mesh) {
  const g = 0.46 + Math.random() * 0.26;
  mesh.traverse(o => {
    if (!o.isMesh) return;
    o.material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(g * 0.9, g * 1.02, g * 1.08),
    });
  });
}

function spawnShark(x, y, burst = 1) {
  let s = sharks.find(q => q.life <= 0);
  if (!s) {
    if (sharks.length >= 72) return false;
    s = makeShark();
    if (!s) return false;
    sharks.push(s);
  }
  s.mesh.visible = true;
  tintShark(s.mesh);
  s.swirl = Math.random() * Math.PI * 2;
  const tornadoDir = Math.random() < 0.9 ? -1 : 1;
  s.swirlSpeed = (7.4 + Math.random() * 5.6) * tornadoDir;
  s.age = 0;
  s.lane = Math.random();
  s.orbitT = 3.35 + Math.random() * 1.2;
  s.heightBand = Math.pow(Math.random(), 0.62);
  s.swirlRadius = 0.36 + Math.pow(s.heightBand, 1.35) * (1.25 + Math.random() * 0.95) + Math.random() * 0.24;
  s.heightPhase = Math.random() * Math.PI * 2;
  s.heightSpeed = 3.2 + Math.random() * 4.0;
  s.verticalAmp = 0.24 + Math.random() * 0.72;
  s.wobblePhase = Math.random() * Math.PI * 2;
  s.wobbleSpeed = 2.5 + Math.random() * 4.0;
  s.driftBack = 0.15 + Math.random() * 0.75;
  s.mesh.position.set(
    x + Math.sin(s.swirl) * s.swirlRadius,
    y + 0.18 + s.heightBand * 4.4 + Math.sin(s.heightPhase) * s.verticalAmp,
    Math.cos(s.swirl) * s.swirlRadius
  );
  s.vx = -(2.4 + Math.random() * 3.6) * burst;
  s.vy = (-0.6 + Math.random() * 2.8) * burst;
  s.spinX = (Math.random() - 0.5) * 22;
  s.spinY = (Math.random() - 0.5) * 28;
  s.spinZ = (Math.random() - 0.5) * 32;
  s.life = 4.25 + Math.random() * 1.1;
  const sc = 0.78 + Math.random() * 0.55;
  s.mesh.scale.setScalar(sc);
  s.mesh.rotation.set(
    Math.random() * Math.PI * 2,
    Math.random() * Math.PI * 2,
    Math.random() * Math.PI * 2
  );
  return true;
}

function spawnSharkBurst(x, y, n, burst = 1) {
  if (!template) {
    loadSharkModel();
    pendingBursts.push({ x, y, n, burst });
    return;
  }
  const count = Math.max(1, Math.round(n * (state.specialAmountMul || 1)));
  for (let i = 0; i < count; i++) spawnShark(x, y, burst);
}

function flushPendingBursts() {
  while (pendingBursts.length) {
    const b = pendingBursts.shift();
    spawnSharkBurst(b.x, b.y, b.n, b.burst);
  }
}

function updateSharks(dt) {
  for (const s of sharks) {
    if (s.life <= 0) continue;
    s.age += dt;
    s.life -= dt;
    s.swirl += s.swirlSpeed * dt;
    if (s.age < s.orbitT && state.sharknado) {
      const lift = Math.min(1, state.sharknadoT / 1.35);
      const axisX = player.position.x + Math.sin(state.sharknadoT * 2.25) * 0.08;
      const axisZ = 0;
      const centerY = Math.max(2.35, state.jumpY + 0.92);
      const baseY = Math.max(0.36, centerY - (2.1 + lift * 0.35));
      const desiredTop = Math.max(baseY + 4.9, centerY + 2.65 + lift * 0.45);
      const columnH = Math.max(4.45, desiredTop - baseY);
      const coneSpread = 0.48 + Math.pow(s.heightBand, 1.35) * 1.25;
      const bodyClearance = 0.18 + Math.sin(s.lane * 13.7) * 0.08;
      const wobble = 1 + Math.sin(s.wobblePhase + s.age * s.wobbleSpeed) * 0.24;
      const r = (s.swirlRadius + bodyClearance) * coneSpread * (0.82 + lift * 0.3) * wobble;
      const bob = Math.sin(s.heightPhase + s.age * s.heightSpeed) * s.verticalAmp;
      const churn = Math.sin(s.swirl * 1.7 + s.lane * 6.28) * 0.3;
      s.mesh.position.x = axisX + Math.sin(s.swirl) * r;
      s.mesh.position.y = Math.min(desiredTop + 0.24, Math.max(0.35, baseY + s.heightBand * columnH + bob + churn));
      s.mesh.position.z = axisZ + Math.cos(s.swirl) * r * 0.88;
      s.mesh.rotation.x += (s.spinX + Math.sin(s.swirl * 1.4) * 7) * dt;
      s.mesh.rotation.y += (s.swirlSpeed * 0.85 + s.spinY * 0.35) * dt;
      s.mesh.rotation.z += (s.spinZ + Math.sin(s.age * 8 + s.lane) * 11) * dt;
    } else {
      s.vy -= 8.5 * dt;
      s.mesh.position.x += s.vx * dt;
      s.mesh.position.y += s.vy * dt + Math.sin(s.swirl) * s.swirlRadius * dt * 3;
      s.mesh.position.z = Math.cos(s.swirl) * s.swirlRadius;
      s.mesh.rotation.x += s.spinX * dt;
      s.mesh.rotation.y += s.spinY * dt;
      s.mesh.rotation.z += s.spinZ * dt;
    }
    if (s.mesh.position.y <= 0.35 && s.vy < 0) {
      s.mesh.position.y = 0.35;
      s.vy = -s.vy * 0.28;
      s.vx *= 0.78;
    }
    if (s.life <= 0 || s.mesh.position.x < camera.position.x - 22) {
      s.life = 0;
      s.mesh.visible = false;
    }
  }
}

function sharkDebugInfo() {
  return { loaded, loadFailed, active: sharks.filter(s => s.life > 0).length };
}

export { loadSharkModel, spawnSharkBurst, updateSharks, sharkDebugInfo };
