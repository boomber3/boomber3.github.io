import * as THREE from 'three';
import { scene, camera } from '../core/engine.js';
import { CONFIG } from '../config.js';
import { paperTexture, paperMat } from './textures.js';
import { bits } from './breakables.js';
import { addShake } from '../core/state.js';
import { gainBreakXp } from '../systems/growth.js';
import { playBirdScreech } from '../systems/audio.js';

const birdTex = paperTexture(64, 32, (g, w, h) => {
  g.fillStyle = '#3a2a20';
  g.beginPath(); g.ellipse(w * 0.42, h * 0.55, 11, 6, -0.2, 0, 7); g.fill();
  g.beginPath(); g.moveTo(7, h * 0.5); g.lineTo(2, h * 0.34); g.lineTo(2, h * 0.62); g.closePath(); g.fill();
  g.beginPath(); g.arc(w * 0.62, h * 0.47, 4, 0, 7); g.fill();
  g.fillStyle = '#e8a840';
  g.beginPath(); g.moveTo(w * 0.66, h * 0.47); g.lineTo(w * 0.74, h * 0.43); g.lineTo(w * 0.66, h * 0.51); g.closePath(); g.fill();
  g.fillStyle = '#2a1c14';
  g.beginPath(); g.moveTo(w * 0.38, h * 0.55); g.lineTo(w * 0.29, h * 0.84); g.lineTo(w * 0.49, h * 0.62); g.closePath(); g.fill();
});

const birdGeo = new THREE.PlaneGeometry(0.85, 0.42);

const birds = [];
for (let i = 0; i < CONFIG.birds.count + 1; i++) {
  const mesh = makeFallbackBird();
  mesh.visible = false;
  scene.add(mesh);
  birds.push({ mesh, speed: 0, y: 0, phase: Math.random() * 7, active: false });
}

function makeFallbackBird() {
  return new THREE.Mesh(birdGeo, paperMat(birdTex));
}

function loadBirdModel() {}

function spawnBird(b) {
  b.active = true;
  b.mesh.visible = true;
  b.speed = CONFIG.birds.speedMin + Math.random() * (CONFIG.birds.speedMax - CONFIG.birds.speedMin);
  b.y = CONFIG.birds.yMin + Math.random() * (CONFIG.birds.yMax - CONFIG.birds.yMin);
  b.phase = Math.random() * 7;
  b.mesh.position.set(camera.position.x + 14 + Math.random() * 18, b.y, -3.5);
  b.mesh.scale.setScalar(0.86 + Math.random() * 0.34);
  b.mesh.rotation.y = 0;
}

for (const b of birds) spawnBird(b);

function smashBird(b) {
  const bx = b.mesh.position.x;
  const by = b.mesh.position.y;
  b.active = false;
  b.mesh.visible = false;
  for (let i = 0; i < 6; i++) {
    const bit = bits.find(q => q.life <= 0);
    if (!bit) break;
    bit.mesh.visible = true;
    bit.mesh.position.set(bx + (Math.random() - 0.5) * 0.3, by, -3);
    bit.vx = (Math.random() - 0.5) * 3;
    bit.vy = 1 + Math.random() * 2;
    bit.life = 0.7 + Math.random() * 0.4;
    bit.spin = (Math.random() - 0.5) * 18;
    bit.mesh.scale.setScalar(0.6 + Math.random() * 0.5);
  }
  playBirdScreech();
  addShake(0.2, 0, 0.1);
  gainBreakXp(2);   // 飞鸟：经验低
  spawnBird(b);
}

function spawnDebugBird() {
  let b = birds.find(q => !q.active);
  if (!b) {
    b = birds[0];
    if (b.mesh) b.mesh.visible = false;
  }
  spawnBird(b);
  b.mesh.position.x = camera.position.x + 6;
  return b;
}

export { birds, spawnBird, smashBird, spawnDebugBird, loadBirdModel };
