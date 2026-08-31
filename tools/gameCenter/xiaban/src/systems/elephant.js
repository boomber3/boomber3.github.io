// 大象喷射：作为大型重物抛出，落地两次震屏后继续滚出画面。
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { scene, camera } from '../core/engine.js';
import { state, GRAVITY, addShake } from '../core/state.js';
import { playSplat } from './audio.js';

let model = null;
let modelLoading = false;
let modelReady = false;
const elephants = [];
const loader = new GLTFLoader();
const ELEPHANT_R = 1.95;
const ELEPHANT_SCALE = 1.28;
const SPAWN_DUR = 0.45;

function loadElephantModel() {
  if (modelLoading || modelReady) return;
  modelLoading = true;
  loader.load('assets/elephant.glb', gltf => {
    const obj = gltf.scene;
    obj.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
    model = obj;
    modelReady = true;
  }, undefined, e => { modelLoading = false; console.warn('elephant model load failed', e); });
}

function spawnElephant(px, py) {
  if (!modelReady) { loadElephantModel(); return; }
  const inst = model.clone(true);
  inst.position.y = -ELEPHANT_R;
  const roll = new THREE.Group();
  roll.add(inst);
  roll.scale.setScalar(0);
  const g = new THREE.Group();
  g.position.set(px - 0.45, py + 0.35, 0.12);
  g.add(roll);
  scene.add(g);
  elephants.push({
    g, roll,
    spawnT: 0,
    life: 9.5,
    visualScale: ELEPHANT_SCALE,
    vx: -(8.5 + Math.random() * 3.8) + Math.min(3.5, state.launchVx * 0.16),
    vy: 6.8 + Math.random() * 1.4,
    grounded: false,
    hitCount: 0,
  });
}

function updateElephants(dt) {
  for (let i = elephants.length - 1; i >= 0; i--) {
    const e = elephants[i];
    e.life -= dt;
    if (e.life <= 0 || e.g.position.x < camera.position.x - 28) {
      scene.remove(e.g);
      elephants.splice(i, 1);
      continue;
    }
    e.spawnT += dt;
    if (e.spawnT < SPAWN_DUR) {
      const k = Math.min(1, e.spawnT / SPAWN_DUR);
      e.roll.scale.setScalar((1 - Math.pow(1 - k, 3)) * e.visualScale);
    } else {
      e.roll.scale.setScalar(e.visualScale);
    }
    e.g.position.x += e.vx * dt;
    if (!e.grounded) e.vy -= GRAVITY * 0.82 * dt;
    e.g.position.y += e.vy * dt;
    const r = ELEPHANT_R * e.visualScale;
    const bottomY = e.g.position.y - r;
    if (bottomY <= 0 && e.vy < 0) {
      e.g.position.y = r;
      e.hitCount++;
      if (e.hitCount === 1) {
        e.vy = 7.6 + Math.random() * 1.2;
        e.vx *= 0.78;
        e.roll.rotation.z += (Math.random() - 0.5) * 0.45;
        addShake(1.05, -0.08, -0.42);
        playSplat();
      } else if (e.hitCount === 2) {
        e.vy = 0;
        e.grounded = true;
        e.vx *= 0.62;
        addShake(0.65, -0.04, -0.28);
        playSplat();
      } else {
        e.vy = 0;
        e.grounded = true;
      }
    }
    if (e.grounded) e.vx *= Math.max(0, 1 - 1.8 * dt);
    e.roll.rotation.z += (e.vx / Math.max(0.1, ELEPHANT_R * e.visualScale)) * dt;
  }
}

export { loadElephantModel, spawnElephant, updateElephants, elephants };
