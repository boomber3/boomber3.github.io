import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { scene, camera } from '../core/engine.js';
import { CONFIG } from '../config.js';
import { state, addShake } from '../core/state.js';
import { player } from './character.js';
import { paperTexture, paperMat } from './textures.js';
import { gainBreakXp } from '../systems/growth.js';
import { playBirdScreech, playSmash } from '../systems/audio.js';

const loader = new GLTFLoader();
let gooseModel = null;
let modelRequested = false;

const featherTex = paperTexture(32, 32, (g, w, h) => {
  g.fillStyle = '#f7f4e8';
  g.beginPath();
  g.ellipse(w * 0.5, h * 0.48, w * 0.18, h * 0.4, 0.35, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#b8b1a0';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(w * 0.42, h * 0.17);
  g.lineTo(w * 0.58, h * 0.84);
  g.stroke();
});
const featherMat = paperMat(featherTex);
featherMat.transparent = true;
const featherGeo = new THREE.PlaneGeometry(0.18, 0.18);
const feathers = [];
for (let i = 0; i < 42; i++) {
  const mesh = new THREE.Mesh(featherGeo, featherMat.clone());
  mesh.visible = false;
  scene.add(mesh);
  feathers.push({ mesh, life: 0, maxLife: 0, vx: 0, vy: 0, drift: 0, spin: 0 });
}

const geese = [];
for (let i = 0; i < CONFIG.geese.count; i++) {
  geese.push({ mesh: null, inst: null, active: false, baseX: 0, speed: 0, phase: Math.random() * 7, dir: 1, squawkT: 0 });
}
state.gooseCursor = 24;

function normalizeGoose(root) {
  root.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = false;
    o.receiveShadow = false;
  });
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  if (size.y > 1e-4) root.scale.setScalar(CONFIG.geese.h / size.y);
  const box2 = new THREE.Box3().setFromObject(root);
  root.position.y -= box2.min.y;
  const box3 = new THREE.Box3().setFromObject(root);
  const center = box3.getCenter(new THREE.Vector3());
  root.position.x -= center.x;
  root.position.z -= center.z;
}

function loadGooseModel() {
  if (modelRequested) return;
  modelRequested = true;
  loader.load('assets/goose_low_poly.glb', gltf => {
    gooseModel = gltf.scene;
    normalizeGoose(gooseModel);
  }, undefined, e => console.warn('[goose] model load failed', e));
}

function spawnGoose(g, x = camera.position.x + 14 + Math.random() * 10) {
  if (!gooseModel) return false;
  if (g.mesh) scene.remove(g.mesh);
  const inst = gooseModel.clone(true);
  const group = new THREE.Group();
  group.add(inst);
  g.mesh = group;
  g.inst = inst;
  g.active = true;
  g.baseX = x;
  g.speed = CONFIG.geese.speedMin + Math.random() * (CONFIG.geese.speedMax - CONFIG.geese.speedMin);
  g.phase = Math.random() * Math.PI * 2;
  g.dir = Math.random() < 0.5 ? -1 : 1;
  group.position.set(x, 0, 0.38);
  group.rotation.y = g.dir > 0 ? -Math.PI * 0.5 : Math.PI * 0.5;
  group.visible = true;
  scene.add(group);
  return true;
}

function resetGooseCursor() {
  state.gooseCursor = 24;
}

function spawnDebugGoose() {
  loadGooseModel();
  const g = geese.find(item => !item.active) || geese[0];
  return spawnGoose(g, camera.position.x + 4);
}

function spawnFeathers(x, y, z) {
  for (let i = 0; i < 18; i++) {
    const f = feathers.find(item => item.life <= 0);
    if (!f) return;
    f.maxLife = 0.65 + Math.random() * 0.55;
    f.life = f.maxLife;
    f.mesh.visible = true;
    f.mesh.position.set(x + (Math.random() - 0.5) * 0.45, y + 0.45 + Math.random() * 0.45, z + (Math.random() - 0.5) * 0.08);
    f.vx = (Math.random() - 0.5) * 3.4;
    f.vy = 1.2 + Math.random() * 2.4;
    f.drift = (Math.random() - 0.5) * 1.8;
    f.spin = (Math.random() - 0.5) * 18;
    f.mesh.scale.setScalar(0.8 + Math.random() * 1.2);
    f.mesh.rotation.z = Math.random() * Math.PI * 2;
    f.mesh.material.opacity = 1;
  }
}

function smashGoose(g) {
  if (!g.active || !g.mesh) return;
  const x = g.mesh.position.x;
  const y = g.mesh.position.y;
  const z = g.mesh.position.z;
  g.active = false;
  g.mesh.visible = false;
  scene.remove(g.mesh);
  spawnFeathers(x, y, z);
  playBirdScreech();
  playSmash();
  addShake(0.22, 0, -0.08);
  gainBreakXp();
}

function updateGooseFeathers(dt) {
  for (const f of feathers) {
    if (f.life <= 0) continue;
    f.life -= dt;
    f.vy -= 4.8 * dt;
    f.mesh.position.x += (f.vx + Math.sin(f.life * 10) * f.drift) * dt;
    f.mesh.position.y += f.vy * dt;
    f.mesh.rotation.z += f.spin * dt;
    f.mesh.material.opacity = Math.max(0, f.life / f.maxLife);
    if (f.life <= 0 || f.mesh.position.y < 0) {
      f.life = 0;
      f.mesh.visible = false;
      f.mesh.material.opacity = 0;
    }
  }
}

function updateGeese(dt, t, dxP = 0) {
  updateGooseFeathers(dt);
  if (!gooseModel) return;
  state.gooseCursor -= dxP;
  if (state.gooseCursor < 9) {
    const free = geese.find(g => !g.active);
    if (free) {
      spawnGoose(free, camera.position.x + 12 + Math.random() * 7);
      state.gooseCursor = 9 + CONFIG.geese.gap + Math.random() * CONFIG.geese.gap;
    } else {
      state.gooseCursor += 5;
    }
  }
  for (const g of geese) {
    if (!g.active || !g.mesh) continue;
    const walk = Math.sin(t * g.speed + g.phase) * CONFIG.geese.walkRange;
    const nextX = g.baseX + walk;
    const dx = nextX - g.mesh.position.x;
    g.mesh.position.x = nextX;
    g.mesh.rotation.y = dx >= 0 ? -Math.PI * 0.5 : Math.PI * 0.5;
    g.mesh.rotation.z = Math.sin(t * g.speed * 4 + g.phase) * 0.035;
    if (Math.abs(g.mesh.position.x - player.position.x) < CONFIG.geese.hitRange &&
        Math.abs(g.mesh.position.z - 0.38) < 0.8 &&
        player.position.y < 0.8) {
      smashGoose(g);
      continue;
    }
    if (g.mesh.position.x < camera.position.x - 10) {
      g.active = false;
      g.mesh.visible = false;
      scene.remove(g.mesh);
    }
  }
}

loadGooseModel();

export { geese, loadGooseModel, spawnGoose, spawnDebugGoose, updateGeese, resetGooseCursor };
