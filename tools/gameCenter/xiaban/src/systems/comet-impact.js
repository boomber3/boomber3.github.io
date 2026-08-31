import * as THREE from 'three';
import { scene, camera } from '../core/engine.js';
import { state, GRAVITY, addShake } from '../core/state.js';
import { player } from '../world/character.js';
import { paperTexture } from '../world/textures.js';
import { spawnBlastJet, spawnFireBurst } from './particles.js';
import { playFireworkBoom, playPlaneExplode } from './audio.js';

const flashEl = document.getElementById('cometFlash');
let flashT = 0;
let flashDur = 0;

const flameGeo = new THREE.PlaneGeometry(0.18, 0.26);
const flameTex = paperTexture(32, 48, (g, w, h) => {
  g.fillStyle = 'rgba(255, 68, 0, 0.95)';
  g.beginPath(); g.ellipse(w / 2, h / 2 + 3, 11, 18, -0.2, 0, 7); g.fill();
  g.fillStyle = '#ffce2e';
  g.beginPath(); g.ellipse(w / 2, h / 2 + 5, 7, 12, -0.1, 0, 7); g.fill();
  g.fillStyle = '#fff2a3';
  g.beginPath(); g.arc(w / 2, h / 2 + 4, 4, 0, 7); g.fill();
});
const trail = [];
for (let i = 0; i < 150; i++) {
  const mat = new THREE.MeshBasicMaterial({
    map: flameTex, transparent: true, opacity: 1, side: THREE.DoubleSide,
    depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(flameGeo, mat);
  mesh.renderOrder = 62;
  mesh.visible = false;
  scene.add(mesh);
  trail.push({ mesh, life: 0, maxLife: 1, vx: 0, vy: 0, spin: 0 });
}

const rockGeo = new THREE.PlaneGeometry(1, 1);
const rockTexs = ['#6f746f', '#555b58', '#8b8172', '#474b49'].map((base, i) => paperTexture(96, 96, (g, w, h) => {
  g.fillStyle = base;
  g.beginPath();
  g.moveTo(18, 18 + i * 2);
  g.lineTo(58, 8);
  g.lineTo(83, 32);
  g.lineTo(76, 70);
  g.lineTo(43, 86);
  g.lineTo(12, 63);
  g.closePath();
  g.fill();
  g.fillStyle = i % 2 ? 'rgba(210, 196, 168, 0.32)' : 'rgba(225, 236, 232, 0.34)';
  g.beginPath();
  g.moveTo(24, 23); g.lineTo(57, 14); g.lineTo(49, 38); g.lineTo(20, 43); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(28, 25, 22, 0.34)';
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(28, 55); g.lineTo(53, 48); g.lineTo(67, 60);
  g.moveTo(44, 28); g.lineTo(62, 23);
  g.stroke();
}));
const rockMats = rockTexs.map(tex => new THREE.MeshBasicMaterial({
  map: tex, transparent: true, opacity: 1, side: THREE.DoubleSide,
  depthWrite: false, fog: true,
}));
const rocks = [];
for (let i = 0; i < 180; i++) {
  const mesh = new THREE.Mesh(rockGeo, rockMats[i % rockMats.length].clone());
  mesh.renderOrder = 58 + (i % 8);
  mesh.visible = false;
  scene.add(mesh);
  rocks.push({ mesh, life: 0, maxLife: 1, vx: 0, vy: 0, vz: 0, spin: 0, floor: 0, bounce: 0, settled: false });
}

function spawnCometTrail(x, y, n) {
  let spawned = 0;
  for (const p of trail) {
    if (p.life > 0) continue;
    if (spawned++ >= n) break;
    p.mesh.visible = true;
    p.mesh.position.set(
      x - 0.35 - Math.random() * 1.35,
      y + 0.35 + (Math.random() - 0.5) * 0.85,
      0.22 + (Math.random() - 0.5) * 0.2
    );
    p.vx = -(4.5 + Math.random() * 8.5);
    p.vy = 1.4 + Math.random() * 4.4;
    p.spin = (Math.random() - 0.5) * 18;
    p.life = p.maxLife = 0.42 + Math.random() * 0.38;
    const s = 1.25 + Math.random() * 2.2;
    p.mesh.scale.set(s * (1.1 + Math.random() * 0.65), s, 1);
    p.mesh.rotation.z = -0.45 + (Math.random() - 0.5) * 0.9;
    p.mesh.material.opacity = 1;
  }
}

function triggerCometFlash() {
  flashT = 0;
  flashDur = 0.62;
  if (flashEl) flashEl.style.opacity = '1';
}

function spawnImpactRocks(x) {
  let spawned = 0;
  for (const r of rocks) {
    if (r.life > 0) continue;
    if (spawned++ >= 145) break;
    const a = Math.random() * Math.PI * 2;
    const side = Math.cos(a);
    const up = Math.abs(Math.sin(a));
    const power = 7 + Math.random() * 12;
    r.mesh.visible = true;
    r.mesh.position.set(x + (Math.random() - 0.5) * 1.15, 0.28 + Math.random() * 0.35, (Math.random() - 0.5) * 0.9);
    r.vx = side * power + 3.2 + Math.random() * 5.2;
    r.vy = 4.6 + up * power * 0.68 + Math.random() * 4.2;
    r.vz = (Math.random() - 0.5) * 5.2;
    r.spin = (Math.random() - 0.5) * 24;
    r.bounce = 0;
    r.settled = false;
    const s = 0.28 + Math.random() * 0.78;
    r.floor = s * (0.2 + Math.random() * 0.2) + Math.pow(Math.random(), 1.8) * 1.0;
    r.mesh.scale.set(s * (0.75 + Math.random() * 0.8), s * (0.72 + Math.random() * 0.65), 1);
    r.mesh.rotation.set((Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6, Math.random() * Math.PI * 2);
    r.life = r.maxLife = 7.0 + Math.random() * 1.8;
    r.mesh.material = rockMats[(Math.random() * rockMats.length) | 0].clone();
    r.mesh.material.opacity = 1;
  }
}

function triggerCometImpact(x) {
  triggerCometFlash();
  spawnImpactRocks(x);
  spawnFireBurst(x, 0.7, -1, 0.6, 28);
  spawnFireBurst(x, 0.7, 1, 0.7, 28);
  addShake(1.75, 0.55, -1.05);
  playPlaneExplode();
  playFireworkBoom();
}
function triggerHeavyMeteorRocks(x, impact) {
  const k = Math.min(1, Math.max(0, (impact - 13) / 14));
  const count = Math.round(24 + k * 70);
  let spawned = 0;
  for (const r of rocks) {
    if (r.life > 0) continue;
    if (spawned++ >= count) break;
    const a = Math.random() * Math.PI * 2;
    const side = Math.cos(a);
    const up = Math.abs(Math.sin(a));
    const power = 3.8 + Math.random() * (5.5 + k * 7.5);
    r.mesh.visible = true;
    r.mesh.position.set(x + (Math.random() - 0.5) * (0.7 + k * 0.55), 0.2 + Math.random() * 0.28, (Math.random() - 0.5) * 0.7);
    r.vx = side * power + (1.3 + k * 2.6);
    r.vy = 2.9 + up * power * (0.55 + k * 0.16) + Math.random() * (1.8 + k * 2.5);
    r.vz = (Math.random() - 0.5) * (2.5 + k * 2.1);
    r.spin = (Math.random() - 0.5) * (16 + k * 10);
    r.bounce = 0;
    r.settled = false;
    const s = 0.16 + Math.random() * (0.28 + k * 0.34);
    r.floor = s * (0.16 + Math.random() * 0.16) + Math.pow(Math.random(), 1.9) * 0.45;
    r.mesh.scale.set(s * (0.75 + Math.random() * 0.8), s * (0.72 + Math.random() * 0.65), 1);
    r.mesh.rotation.set((Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6, Math.random() * Math.PI * 2);
    r.life = r.maxLife = 2.8 + k * 2.4 + Math.random() * 1.0;
    r.mesh.material = rockMats[(Math.random() * rockMats.length) | 0].clone();
    r.mesh.material.opacity = 1;
  }
  if (impact > 16) {
    spawnFireBurst(x, 0.55, -1, 0.45, 5 + Math.round(k * 9));
    spawnFireBurst(x, 0.55, 1, 0.45, 5 + Math.round(k * 9));
  }
}

function updateCometFx(dt) {
  if (state.cometImpact && state.cometPhase === 'ascend') {
    state.cometFireT += dt;
    while (state.cometFireT >= 0.055) {
      state.cometFireT -= 0.055;
      spawnBlastJet(player.position.x, state.jumpY + 0.08, 0.82, 0.68);
    }
  }
  if (state.cometImpact && state.cometPhase === 'dive') {
    const speed = Math.hypot(state.launchVx, state.launchVy);
    const fallProgress = Math.max(0, Math.min(1, 1 - state.jumpY / 14.9));
    if (flashEl && flashDur <= 0) flashEl.style.opacity = String(0.08 + fallProgress * fallProgress * 0.62);
    state.cometFireT += dt;
    const interval = Math.max(0.018, 0.07 - speed * 0.0014);
    while (state.cometFireT >= interval) {
      state.cometFireT -= interval;
      spawnCometTrail(player.position.x, state.jumpY + 0.52, 2 + Math.min(8, (speed / 5) | 0));
    }
  } else if (flashEl && flashDur <= 0 && flashEl.style.opacity !== '0') {
    flashEl.style.opacity = '0';
  }
  for (const p of trail) {
    if (p.life <= 0) continue;
    p.life -= dt;
    p.vy -= 2.6 * dt;
    p.mesh.position.x += p.vx * dt;
    p.mesh.position.y += p.vy * dt;
    p.mesh.rotation.z += p.spin * dt;
    p.mesh.scale.multiplyScalar(Math.max(0, 1 - dt * 1.25));
    p.mesh.material.opacity = Math.max(0, p.life / p.maxLife);
    if (p.life <= 0) p.mesh.visible = false;
  }
  for (const r of rocks) {
    if (r.life <= 0) continue;
    r.life -= dt;
    const minX = camera.position.x - 7.4;
    const maxX = camera.position.x + 7.4;
    const maxY = 5.5;
    const minZ = -2.2;
    const maxZ = 2.2;
    if (r.settled) {
      r.mesh.position.x = THREE.MathUtils.clamp(r.mesh.position.x, minX + 0.35, maxX - 0.35);
      r.mesh.position.y = r.floor + Math.sin(r.maxLife * 11 + r.life * 1.6) * 0.012;
      r.mesh.position.z = THREE.MathUtils.clamp(r.mesh.position.z, minZ, maxZ);
      r.mesh.rotation.x *= Math.max(0, 1 - dt * 1.3);
    } else {
      r.vy -= GRAVITY * 0.86 * dt;
      r.mesh.position.x += r.vx * dt;
      r.mesh.position.y += r.vy * dt;
      r.mesh.position.z += r.vz * dt;
      r.mesh.rotation.z += r.spin * dt;
      r.mesh.rotation.x += r.spin * 0.45 * dt;
      if (r.mesh.position.x < minX && r.vx < 0) {
        r.mesh.position.x = minX;
        r.vx = -r.vx * 0.4;
        r.spin *= -0.55;
      } else if (r.mesh.position.x > maxX && r.vx > 0) {
        r.mesh.position.x = maxX;
        r.vx = -r.vx * 0.4;
        r.spin *= -0.55;
      }
      if (r.mesh.position.z < minZ && r.vz < 0) {
        r.mesh.position.z = minZ;
        r.vz = -r.vz * 0.42;
      } else if (r.mesh.position.z > maxZ && r.vz > 0) {
        r.mesh.position.z = maxZ;
        r.vz = -r.vz * 0.42;
      }
      if (r.mesh.position.y > maxY && r.vy > 0) {
        r.mesh.position.y = maxY;
        r.vy = -r.vy * 0.25;
        r.vx *= 0.82;
        r.vz *= 0.82;
      }
      if (r.mesh.position.y <= r.floor && r.vy < 0) {
        r.mesh.position.y = r.floor;
        r.bounce++;
        if (r.bounce >= 2 || Math.abs(r.vy) < 2.4) {
          r.settled = true;
          r.vx = 0;
          r.vy = 0;
          r.vz = 0;
          r.spin = 0;
          r.mesh.rotation.z += (Math.random() - 0.5) * 0.28;
        } else {
          r.vy = -r.vy * 0.28;
          r.vx *= 0.5;
          r.vz *= 0.52;
          r.spin *= 0.52;
        }
        if (r.bounce === 1) addShake(0.18, 0, -0.05);
      }
    }
    if (r.life < 0.8) r.mesh.material.opacity = Math.max(0, r.life / 0.8);
    if (r.life <= 0) r.mesh.visible = false;
  }
  if (flashDur > 0) {
    flashT += dt;
    const hold = 0.08;
    const fade = Math.max(0, 1 - Math.max(0, flashT - hold) / Math.max(0.01, flashDur - hold));
    if (flashEl) flashEl.style.opacity = String(fade);
    if (flashT >= flashDur) {
      flashDur = 0;
      if (flashEl) flashEl.style.opacity = '0';
    }
  }
}

export { triggerCometImpact, triggerHeavyMeteorRocks, updateCometFx };
