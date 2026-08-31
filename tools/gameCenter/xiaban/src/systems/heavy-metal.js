import * as THREE from 'three';
import { scene } from '../core/engine.js';
import { state } from '../core/state.js';

const dustMat = new THREE.MeshBasicMaterial({ color: '#756f66', transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide, fog: true });
const sparkMat = new THREE.MeshBasicMaterial({ color: '#ffb02e', transparent: true, opacity: 1, depthWrite: false, side: THREE.DoubleSide, fog: true });

const impactBits = [];
for (let i = 0; i < 80; i++) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.09), (i % 4 === 0 ? sparkMat : dustMat).clone());
  mesh.visible = false;
  scene.add(mesh);
  impactBits.push({ mesh, life: 0, maxLife: 1, vx: 0, vy: 0, spin: 0, spark: i % 4 === 0 });
}
const frictionSparks = [];
for (let i = 0; i < 90; i++) {
  const mat = new THREE.MeshBasicMaterial({
    color: i % 3 === 0 ? '#fff0a8' : i % 3 === 1 ? '#ffb02e' : '#ff5a20',
    transparent: true,
    opacity: 1,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.055, 0.14), mat);
  mesh.renderOrder = 66;
  mesh.visible = false;
  scene.add(mesh);
  frictionSparks.push({ mesh, life: 0, maxLife: 1, vx: 0, vy: 0, spin: 0 });
}

function spawnFrictionSpark(x, y, fallSpeed) {
  const p = frictionSparks.find(item => item.life <= 0);
  if (!p) return;
  const k = Math.min(1, Math.max(0, (fallSpeed - 8) / 20));
  p.life = p.maxLife = 0.16 + Math.random() * 0.18 + k * 0.1;
  p.mesh.visible = true;
  p.mesh.position.set(
    x + (Math.random() - 0.5) * (0.48 + k * 0.35),
    y + 0.25 + Math.random() * 0.86,
    0.2 + (Math.random() - 0.5) * 0.08
  );
  p.vx = (Math.random() - 0.5) * (1.2 + k * 2.8) - 0.25;
  p.vy = 2.4 + fallSpeed * (0.26 + k * 0.1) + Math.random() * 1.4;
  p.spin = (Math.random() - 0.5) * 26;
  p.mesh.rotation.z = -0.12 + (Math.random() - 0.5) * 0.55;
  p.mesh.scale.set(0.75 + k * 1.2, 0.8 + k * 2.2, 1);
  p.mesh.material.opacity = 0.55 + k * 0.45;
}

function spawnHeavyLandingFx(x, impact) {
  const k = Math.min(1.8, Math.max(0, (impact - 6) / 14));
  const count = Math.min(34, Math.round(8 + k * 15));
  let spawned = 0;
  for (const p of impactBits) {
    if (p.life > 0) continue;
    if (spawned++ >= count) break;
    const side = Math.random() < 0.5 ? -1 : 1;
    const spark = p.spark && impact > 10;
    p.life = p.maxLife = spark ? 0.28 + Math.random() * 0.18 : 0.38 + Math.random() * 0.28;
    p.mesh.visible = true;
    p.mesh.position.set(x + (Math.random() - 0.5) * 0.42, 0.06 + Math.random() * 0.08, spark ? 0.19 : 0.13);
    p.vx = side * (1.4 + Math.random() * 3.1) * (0.55 + k);
    p.vy = (spark ? 1.9 : 0.7) + Math.random() * (spark ? 2.4 : 1.2) + k * 0.35;
    p.spin = (Math.random() - 0.5) * 16;
    p.mesh.rotation.z = Math.random() * 6.28;
    p.mesh.scale.setScalar((spark ? 0.55 : 0.8) + Math.random() * 0.8 + k * 0.22);
    p.mesh.material.opacity = 1;
  }
}

function updateHeavyMetalFx(dt, player) {
  const active = state.activeFoodEvent?.id === 'flintWater02';
  const vy = state.fartFlying ? state.launchVy : state.jumpVy;
  if (active && state.phase === 'run' && !state.onGround && vy < -5) {
    const fallSpeed = -vy;
    const rate = Math.min(0.95, (fallSpeed - 4) / 18);
    if (fallSpeed > 8 && Math.random() < rate * 0.55) spawnFrictionSpark(player.position.x, state.jumpY, fallSpeed);
    if (fallSpeed > 15 && Math.random() < rate * 0.45) spawnFrictionSpark(player.position.x, state.jumpY, fallSpeed);
    if (fallSpeed > 22 && Math.random() < rate * 0.35) spawnFrictionSpark(player.position.x, state.jumpY, fallSpeed);
  }

  for (const p of impactBits) {
    if (p.life <= 0) continue;
    p.life -= dt;
    p.vy -= 8.5 * dt;
    p.mesh.position.x += p.vx * dt;
    p.mesh.position.y += p.vy * dt;
    p.mesh.rotation.z += p.spin * dt;
    p.mesh.material.opacity = Math.max(0, p.life / p.maxLife);
    if (p.mesh.position.y <= 0.02 && p.vy < 0) {
      p.mesh.position.y = 0.02;
      p.vy = 0;
      p.vx *= Math.max(0, 1 - 8 * dt);
    }
    if (p.life <= 0) p.mesh.visible = false;
  }
  for (const p of frictionSparks) {
    if (p.life <= 0) continue;
    p.life -= dt;
    p.mesh.position.x += p.vx * dt;
    p.mesh.position.y += p.vy * dt;
    p.mesh.rotation.z += p.spin * dt;
    p.mesh.scale.multiplyScalar(Math.max(0, 1 - dt * 1.9));
    p.mesh.material.opacity = Math.max(0, (p.life / p.maxLife) * 0.95);
    if (p.life <= 0) p.mesh.visible = false;
  }
}

export { spawnHeavyLandingFx, updateHeavyMetalFx };
