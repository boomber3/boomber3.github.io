// 模块化重构：由 paper-theater-runner.html 拆出
import * as THREE from 'three';
import { scene } from '../core/engine.js';
import { CONFIG } from '../config.js';
import { paperTexture, paperMat } from '../world/textures.js';
import { state } from '../core/state.js';
import { playFireworkBoom } from './audio.js';

const fartClouds = [];
const fartGeo = new THREE.PlaneGeometry(0.34, 0.34);
function eventCount(n, mul = 1) {
  return Math.max(1, Math.round(n * (mul || 1)));
}
function fartGasCount(n) {
  return eventCount(n, state.sprayAmountMul || 1);
}
function specialSprayCount(n) {
  return eventCount(n, state.specialAmountMul || 1);
}
// 三档浓度的屁云：淡 → 中 → 浓（色更深更显眼）
const fartTexs = ['#e8d9a8', '#d6c088', '#c2a866'].map((fill, i) => paperTexture(96, 96, (g, w, h) => {
  // 淡色"屁"粒子：借用窜稀粒子的椭圆+高光造型，但颜色偏淡的米黄（淡→中→浓）
  g.fillStyle = fill;
  g.beginPath(); g.ellipse(w / 2, h / 2 + 4, 34, 26, 0.4, 0, 7); g.fill();
  g.fillStyle = i === 2 ? 'rgba(180, 150, 95, 0.7)' : 'rgba(245, 232, 185, 0.9)';
  g.beginPath(); g.arc(w / 2 - 11, h / 2 - 9, 12, 0, 7); g.fill();
}));
// 屁云用透明材质（真淡出，不做 cutout 硬边）
const fartMat = tex => new THREE.MeshBasicMaterial({
  map: tex, transparent: true, opacity: 1.0,
  side: THREE.DoubleSide, depthWrite: false, fog: true,
});
for (let i = 0; i < 440; i++) {
  const m = new THREE.Mesh(fartGeo, fartMat(fartTexs[i % 3]));
  m.visible = false;
  scene.add(m);
  fartClouds.push({ mesh: m, life: 0, vx: 0, vy: 0, grow: 1, follow: 1, followDecay: 1 });
}
// 开场爆发的旧式大圆屁云（漂浮跟随，非粒子）
const puffs = [];
const puffTex = paperTexture(96, 96, (g, w, h) => {
  g.fillStyle = '#ead8a8';
  g.beginPath(); g.arc(w / 2, h / 2, 40, 0, 7); g.fill();
  g.fillStyle = 'rgba(255, 255, 255, 0.28)';   // 中心微亮 → 圆云柔和感
  g.beginPath(); g.arc(w / 2, h / 2, 28, 0, 7); g.fill();
});
const dragonPuffTex = paperTexture(96, 96, (g, w, h) => {
  g.fillStyle = '#ff174f';
  g.beginPath(); g.arc(w / 2, h / 2, 40, 0, 7); g.fill();
  g.fillStyle = '#ff4fd8';
  g.beginPath(); g.arc(w / 2 + 4, h / 2 + 3, 30, 0, 7); g.fill();
  g.fillStyle = 'rgba(255, 255, 255, 0.26)';
  g.beginPath(); g.arc(w / 2 - 12, h / 2 - 11, 13, 0, 7); g.fill();
});
const greenMarinadeTex = paperTexture(96, 96, (g, w, h) => {
  g.fillStyle = '#45d943';
  g.beginPath(); g.ellipse(w / 2, h / 2 + 3, 36, 25, -0.22, 0, 7); g.fill();
  g.fillStyle = '#9dff64';
  g.beginPath(); g.ellipse(w / 2 + 4, h / 2 + 5, 25, 16, -0.15, 0, 7); g.fill();
  g.fillStyle = 'rgba(235, 255, 190, 0.62)';
  g.beginPath(); g.arc(w / 2 - 12, h / 2 - 10, 10, 0, 7); g.fill();
});
const oilDropTex = paperTexture(64, 64, (g, w, h) => {
  g.fillStyle = 'rgba(255, 205, 42, 0.92)';
  g.beginPath(); g.ellipse(w / 2, h / 2 + 4, 18, 13, -0.25, 0, 7); g.fill();
  g.fillStyle = 'rgba(255, 244, 120, 0.95)';
  g.beginPath(); g.ellipse(w / 2 - 5, h / 2 - 4, 8, 5, -0.35, 0, 7); g.fill();
  g.fillStyle = 'rgba(206, 124, 18, 0.42)';
  g.beginPath(); g.ellipse(w / 2 + 8, h / 2 + 9, 9, 4, -0.25, 0, 7); g.fill();
});
const juicePalettes = {
  red: ['#ff174f', '#ff4a63', 'rgba(255, 222, 210, 0.48)'],
  yellow: ['#ffe21a', '#ffb800', 'rgba(255, 255, 205, 0.62)'],
  green: ['#31f25f', '#84ff36', 'rgba(229, 255, 200, 0.52)'],
  purple: ['#b42cff', '#ff3fd2', 'rgba(245, 210, 255, 0.52)'],
};
const juiceFartTexs = {};
const juicePuffTexs = {};
for (const [id, colors] of Object.entries(juicePalettes)) {
  juiceFartTexs[id] = paperTexture(96, 96, (g, w, h) => {
    g.fillStyle = colors[0];
    g.beginPath(); g.ellipse(w / 2, h / 2 + 4, 35, 25, -0.28, 0, 7); g.fill();
    g.fillStyle = colors[1];
    g.beginPath(); g.ellipse(w / 2 + 4, h / 2 + 4, 24, 15, -0.18, 0, 7); g.fill();
    g.fillStyle = colors[2];
    g.beginPath(); g.arc(w / 2 - 11, h / 2 - 10, 11, 0, 7); g.fill();
  });
  juicePuffTexs[id] = paperTexture(96, 96, (g, w, h) => {
    g.fillStyle = colors[0];
    g.beginPath(); g.arc(w / 2, h / 2, 40, 0, 7); g.fill();
    g.fillStyle = colors[1];
    g.beginPath(); g.arc(w / 2 + 4, h / 2 + 5, 30, 0, 7); g.fill();
    g.fillStyle = colors[2];
    g.beginPath(); g.arc(w / 2 - 13, h / 2 - 12, 13, 0, 7); g.fill();
  });
}
function currentFartTex() {
  return state.juiceFartId && juiceFartTexs[state.juiceFartId]
    ? juiceFartTexs[state.juiceFartId]
    : fartTexs[(Math.random() * 3) | 0];
}
function currentPuffTex() {
  return state.juiceFartId && juicePuffTexs[state.juiceFartId]
    ? juicePuffTexs[state.juiceFartId]
    : puffTex;
}
for (let i = 0; i < 32; i++) {
  const m = new THREE.Mesh(fartGeo, fartMat(puffTex));
  m.visible = false;
  scene.add(m);
  puffs.push({ mesh: m, life: 0, vx: 0, vy: 0, grow: 1, follow: 1, followDecay: 1, s: 1 });
}
// 屎粒子池（失禁时喷出）—— 超级加倍：池更大、粒更大
const poops = [];
const poopGeo = new THREE.PlaneGeometry(0.2, 0.2);   // 屎粒子基础几何更大
const poopTex = paperTexture(64, 64, (g, w, h) => {
  g.fillStyle = '#7a5230';
  g.beginPath(); g.ellipse(w / 2, h / 2 + 4, 20, 15, 0.4, 0, 7); g.fill();
  g.fillStyle = '#946a40';
  g.beginPath(); g.arc(w / 2 - 6, h / 2 - 6, 9, 0, 7); g.fill();
});
for (let i = 0; i < 360; i++) {
  const m = new THREE.Mesh(poopGeo, paperMat(poopTex));
  m.visible = false;
  scene.add(m);
  poops.push({ mesh: m, life: 0, vx: 0, vy: 0, spin: 0 });
}
// ---------- 玉米粒子池（玉米加农炮连续喷出） ----------
const textureLoader = new THREE.TextureLoader();
const muzzleTextures = ['muzzle-1.png', 'muzzle-2.png', 'muzzle-3.png', 'muzzle-4.png'].map(file => {
  const tex = textureLoader.load(`assets/muzzle-flash/${file}`);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
});
const muzzleFlashes = [];
const muzzleGeo = new THREE.PlaneGeometry(1.15, 0.72);
for (let i = 0; i < 18; i++) {
  const m = new THREE.Mesh(muzzleGeo, new THREE.MeshBasicMaterial({
    map: muzzleTextures[0],
    transparent: true,
    opacity: 1,
    side: THREE.DoubleSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
    blending: THREE.AdditiveBlending,
  }));
  m.renderOrder = 80;
  m.visible = false;
  scene.add(m);
  muzzleFlashes.push({ mesh: m, life: 0, maxLife: 0.24, frame: 0, frameT: 0 });
}
function spawnMuzzleFlash(x, y, dirX = -1, dirY = 0, sizeMul = 1) {
  const f = muzzleFlashes.find(q => q.life <= 0);
  if (!f) return;
  const len = Math.hypot(dirX, dirY) || 1;
  dirX /= len; dirY /= len;
  f.life = f.maxLife = 0.24;
  f.frame = 0;
  f.frameT = 0;
  f.mesh.visible = true;
  f.mesh.material.map = muzzleTextures[0];
  f.mesh.material.opacity = 1;
  f.mesh.position.set(x + dirX * 0.42, y + dirY * 0.42 + 0.02, 0.42);
  f.mesh.rotation.z = Math.atan2(dirY, dirX) - Math.PI + (Math.random() - 0.5) * 0.26;
  f.mesh.scale.set((2.0 + Math.random() * 0.35) * sizeMul, (1.35 + Math.random() * 0.25) * sizeMul, 1);
}
function updateMuzzleFlashes(dt) {
  for (const f of muzzleFlashes) {
    if (f.life <= 0) continue;
    f.life -= dt;
    f.frameT += dt;
    while (f.frameT >= 0.032) {
      f.frameT -= 0.032;
      f.frame = (f.frame + 1) % muzzleTextures.length;
      f.mesh.material.map = muzzleTextures[f.frame];
    }
    f.mesh.material.opacity = Math.max(0, Math.min(1, f.life / (f.maxLife * 0.45)));
    if (f.life <= 0) f.mesh.visible = false;
  }
}
const corns = [];
const cornGeo = new THREE.PlaneGeometry(0.18, 0.32);
const cornTex = paperTexture(24, 32, (g, w, h) => {
  g.fillStyle = '#ffe600';
  g.beginPath(); g.ellipse(w / 2, h / 2, 9, 13, 0, 0, 7); g.fill();
  g.fillStyle = '#fff6c9';
  g.beginPath(); g.arc(w / 2 - 3, h / 2 - 4, 4, 0, 7); g.fill();
});
const cornMat = new THREE.MeshBasicMaterial({ map: cornTex, transparent: true, alphaTest: 0.25, side: THREE.DoubleSide, depthWrite: false, depthTest: false, fog: false });
for (let i = 0; i < 760; i++) {
  const m = new THREE.Mesh(cornGeo, cornMat);
  m.renderOrder = 45;
  m.visible = false;
  scene.add(m);
  corns.push({ mesh: m, life: 0, vx: 0, vy: 0, spin: 0 });
}
function spawnCornBurst(x, y, n, opts = {}) {
  n = specialSprayCount(n);
  const scaleMul = opts.scaleMul || 1;
  const spread = opts.spread || 1;
  const lifeMul = opts.lifeMul || 1;
  const speedMul = opts.speedMul || 1;
  let c = 0;
  for (const p of corns) {
    if (p.life > 0) continue;
    if (c++ >= n) break;
    p.mesh.visible = true;
    p.mesh.position.set(x - 0.35 + (Math.random() - 0.5) * 0.34, y + (Math.random() - 0.5) * 0.42, 0.32);
    p.vx = -(4.4 + Math.random() * 4.0) * speedMul;
    p.vy = (-1.0 + Math.random() * 5.4) * spread;
    p.spin = (Math.random() - 0.5) * 58;
    p.mesh.rotation.z = Math.random() * 6;
    p.life = (1.25 + Math.random() * 0.9) * lifeMul;
    p.mesh.scale.setScalar((1.85 + Math.random() * 1.15) * scaleMul);
  }
}
const dragonSeeds = [];
const seedGeo = new THREE.PlaneGeometry(0.05, 0.07);
const seedTex = paperTexture(16, 20, (g, w, h) => {
  g.fillStyle = '#1c1c1e';
  g.beginPath(); g.ellipse(w / 2, h / 2, 6, 8, 0, 0, 7); g.fill();
  g.fillStyle = '#3a3a3c';
  g.beginPath(); g.arc(w / 2 - 2, h / 2 - 2, 2.4, 0, 7); g.fill();
});
const seedMat = new THREE.MeshBasicMaterial({ map: seedTex, transparent: true, alphaTest: 0.25, side: THREE.DoubleSide, depthWrite: false, depthTest: false, fog: false });
for (let i = 0; i < 560; i++) {
  const m = new THREE.Mesh(seedGeo, seedMat);
  m.renderOrder = 46;
  m.visible = false;
  scene.add(m);
  dragonSeeds.push({ mesh: m, life: 0, vx: 0, vy: 0, spin: 0 });
}
function spawnDragonSeedBurst(x, y, n, opts = {}) {
  n = specialSprayCount(n);
  const scaleMul = opts.scaleMul || 1;
  const spread = opts.spread || 1;
  const lifeMul = opts.lifeMul || 1;
  let c = 0;
  for (const p of dragonSeeds) {
    if (p.life > 0) continue;
    if (c++ >= n) break;
    p.mesh.visible = true;
    p.mesh.position.set(x - 0.35 + (Math.random() - 0.5) * 0.3, y + (Math.random() - 0.5) * 0.5, 0.15);
    p.vx = -(4.0 + Math.random() * 4.6);
    p.vy = (-0.8 + Math.random() * 5.3) * spread;
    p.spin = (Math.random() - 0.5) * 56;
    p.mesh.rotation.z = Math.random() * 6;
    p.life = (1.25 + Math.random() * 0.8) * lifeMul;
    p.mesh.scale.setScalar((1.45 + Math.random() * 0.95) * scaleMul);
  }
}
const mushrooms = [];
const mushGeo = new THREE.PlaneGeometry(0.06, 0.22);
const mushTex = paperTexture(24, 48, (g, w, h) => {
  g.fillStyle = '#fffdf0';
  g.fillRect(w / 2 - 2.5, 8, 5, h - 8);
  g.fillStyle = '#ffe36a';
  g.beginPath(); g.ellipse(w / 2, 7, 9, 6, 0, 0, 7); g.fill();
});
const mushMat = new THREE.MeshBasicMaterial({ map: mushTex, transparent: true, alphaTest: 0.25, side: THREE.DoubleSide, depthWrite: false, depthTest: false, fog: false });
for (let i = 0; i < 380; i++) {
  const m = new THREE.Mesh(mushGeo, mushMat);
  m.renderOrder = 46;
  m.visible = false;
  scene.add(m);
  mushrooms.push({ mesh: m, life: 0, vx: 0, vy: 0, spin: 0 });
}
function spawnMushroomBurst(x, y, n, opts = {}) {
  n = specialSprayCount(n);
  const scaleMul = opts.scaleMul || 1;
  const spread = opts.spread || 1;
  const lifeMul = opts.lifeMul || 1;
  let c = 0;
  for (const p of mushrooms) {
    if (p.life > 0) continue;
    if (c++ >= n) break;
    p.mesh.visible = true;
    p.mesh.position.set(x - 0.35 + (Math.random() - 0.5) * 0.5, y + (Math.random() - 0.5) * 0.55, 0.14);
    p.vx = -(4 + Math.random() * 3.5) * 1.25;
    p.vy = (-0.6 + Math.random() * 5.4) * spread;
    p.spin = (Math.random() - 0.5) * 48;
    p.mesh.rotation.z = Math.random() * 6;
    p.life = (1.9 + Math.random() * 1.1) * lifeMul;
    p.mesh.scale.setScalar((1.55 + Math.random() * 1.0) * scaleMul);
  }
}
const saladChunks = [];
const saladGeo = new THREE.PlaneGeometry(0.16, 0.16);
const saladMats = ['#ff174f', '#00e676', '#00b0ff', '#ffea00', '#ff6d00', '#d500f9', '#76ff03', '#ffffff'].map(color =>
  new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 1, depthWrite: false, depthTest: false, fog: false }));
for (let i = 0; i < 520; i++) {
  const m = new THREE.Mesh(saladGeo, saladMats[i % saladMats.length].clone());
  m.renderOrder = 46;
  m.visible = false;
  scene.add(m);
  saladChunks.push({ mesh: m, life: 0, maxLife: 1, vx: 0, vy: 0, spin: 0 });
}
function spawnSaladChunkBurst(x, y, n, opts = {}) {
  n = specialSprayCount(n);
  const scaleMul = opts.scaleMul || 1;
  const spread = opts.spread || 1;
  const lifeMul = opts.lifeMul || 1;
  let c = 0;
  for (const p of saladChunks) {
    if (p.life > 0) continue;
    if (c++ >= n) break;
    p.mesh.material = saladMats[(c + ((Math.random() * saladMats.length) | 0)) % saladMats.length].clone();
    p.mesh.visible = true;
    p.mesh.position.set(x - 0.3 + (Math.random() - 0.5) * 0.48, y + (Math.random() - 0.5) * 0.62, 0.16);
    p.vx = -(3.8 + Math.random() * 5.4);
    p.vy = (-1.3 + Math.random() * 6.1) * spread;
    p.spin = (Math.random() - 0.5) * 62;
    p.mesh.rotation.z = Math.random() * 6;
    p.life = p.maxLife = (1.7 + Math.random() * 1.0) * lifeMul;
    const sx = (1.35 + Math.random() * 1.25) * scaleMul;
    p.mesh.scale.set(sx, sx * (0.65 + Math.random() * 0.75), 1);
  }
}
function updateSaladChunks(dt) {
  for (const p of saladChunks) {
    if (p.life <= 0) continue;
    p.life -= dt;
    p.vy -= 7.5 * dt;
    p.mesh.position.x += p.vx * dt;
    p.mesh.position.y += p.vy * dt;
    if (p.mesh.position.y <= 0 && p.vy < 0) {
      p.mesh.position.y = 0;
      p.vy = 0;
      p.vx *= (1 - 5 * dt);
      p.life = Math.min(p.life, 0.75);
    }
    p.mesh.rotation.z += p.spin * dt * 1.3;
    p.mesh.rotation.x += p.spin * dt * 0.7;
    p.mesh.material.opacity = Math.max(0, Math.min(1, p.life / 0.8));
    if (p.life <= 0) p.mesh.visible = false;
  }
}
const laserBeams = [];
const laserGeo = new THREE.PlaneGeometry(0.28, 1);
for (let i = 0; i < 2; i++) {
  const m = new THREE.Mesh(laserGeo, new THREE.MeshBasicMaterial({
    color: '#6ff3ff', transparent: true, opacity: 0, side: THREE.DoubleSide,
    depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  }));
  m.visible = false;
  scene.add(m);
  laserBeams.push({ mesh: m, on: false, t: 0, dur: 0 });
}
// 生成激光光柱：从角色底部射向地面，随升空延伸
function spawnLaserBeam(x, dur) {
  const b = laserBeams.find(q => !q.on);
  if (!b) return;
  b.on = true; b.t = dur; b.dur = dur;
  b.mesh.visible = true;
  b.mesh.position.set(x, 0, 0.1);
}
// 更新激光光柱：跟随角色 x，高度=角色底部到地面，渐淡
function updateLaserBeams(dt, x, bottomY) {
  for (const b of laserBeams) {
    if (!b.on) continue;
    b.t -= dt;
    if (b.t <= 0) { b.on = false; b.mesh.visible = false; continue; }
    b.mesh.position.x = x;
    b.mesh.scale.y = Math.max(0.5, bottomY);
    b.mesh.position.y = bottomY / 2;
    b.mesh.material.opacity = Math.min(1, b.t / (b.dur * 0.5)) * 0.9;
  }
}
// ---------- 火箭火焰粒子池（垂直火箭：喷射方向性火焰） ----------
const fireParticles = [];
const fireGeo = new THREE.PlaneGeometry(0.12, 0.18);
const fireTex = paperTexture(24, 32, (g, w, h) => {
  g.fillStyle = '#ff6a00';
  g.beginPath(); g.ellipse(w / 2, h / 2 + 3, 8, 12, 0, 0, 7); g.fill();
  g.fillStyle = '#ffd23f';
  g.beginPath(); g.ellipse(w / 2, h / 2 + 4, 5, 8, 0, 0, 7); g.fill();
  g.fillStyle = '#fff3a7';
  g.beginPath(); g.arc(w / 2, h / 2 + 4, 3, 0, 7); g.fill();
});
const fireMat = new THREE.MeshBasicMaterial({ map: fireTex, transparent: true, opacity: 1, side: THREE.DoubleSide, depthWrite: false, fog: true });
for (let i = 0; i < 120; i++) {
  const m = new THREE.Mesh(fireGeo, fireMat.clone());
  m.visible = false;
  scene.add(m);
  fireParticles.push({ mesh: m, life: 0, maxLife: 1, vx: 0, vy: 0 });
}
// 朝 (dx,dy) 方向喷出火焰粒子
function spawnFireBurst(x, y, dx, dy, n) {
  n = specialSprayCount(n);
  let c = 0;
  for (const p of fireParticles) {
    if (p.life > 0) continue;
    if (c++ >= n) break;
    p.mesh.visible = true;
    p.mesh.position.set(x, y, 0.12);
    p.vx = dx * (3 + Math.random() * 2.5) + (Math.random() - 0.5) * 1.5;
    p.vy = dy * (3 + Math.random() * 2.5) + (Math.random() - 0.5) * 1.5;
    p.life = p.maxLife = 0.35 + Math.random() * 0.3;
    p.mesh.scale.setScalar(0.8 + Math.random() * 0.7);
    p.mesh.rotation.z = Math.random() * 6;
  }
}
// 更新火焰粒子：重力下落 + 热上浮 + 缩小淡出（火焰熄灭感）
function updateFireParticles(dt) {
  for (const p of fireParticles) {
    if (p.life <= 0) continue;
    p.life -= dt;
    p.vy -= 5 * dt;
    p.mesh.position.x += p.vx * dt;
    p.mesh.position.y += p.vy * dt;
    p.mesh.scale.multiplyScalar(1 - dt * 2.4);
    p.mesh.material.opacity = Math.max(0, p.life / p.maxLife);
    if (p.life <= 0) p.mesh.visible = false;
  }
}
// ---------- 彩虹屁粒子池（彩虹屁：彩虹色屁云尾迹，短时间保留形成视觉路径） ----------
const rainbowPuffs = [];
const RAINBOW_COLORS = ['#ff5a5f', '#ffb400', '#39d353', '#29b6f6', '#9c6bff', '#ff69b4'];
const rainTexs = RAINBOW_COLORS.map(c => paperTexture(32, 32, (g, w, h) => {
  g.fillStyle = c;
  g.beginPath(); g.arc(w / 2, h / 2, 14, 0, 7); g.fill();
}));
const rainMat = tex => new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 1, side: THREE.DoubleSide, depthWrite: false, fog: true });
for (let i = 0; i < 160; i++) {
  const m = new THREE.Mesh(fartGeo, rainMat(rainTexs[i % rainTexs.length]));
  m.visible = false;
  scene.add(m);
  rainbowPuffs.push({ mesh: m, life: 0, maxLife: 1, vx: 0, vy: 0, spin: 0 });
}
// 喷彩虹尾迹：一次 n 团彩色半透明屁云，向后 + 上飘，保留数秒
function spawnRainbowPuff(x, y, n) {
  n = fartGasCount(n);
  let c = 0;
  for (const p of rainbowPuffs) {
    if (p.life > 0) continue;
    if (c++ >= n) break;
    p.mesh.visible = true;
    p.mesh.position.set(x - 0.3 + (Math.random() - 0.5) * 0.2, y + (Math.random() - 0.5) * 0.3, 0.12);
    p.vx = -(2 + Math.random() * 2.5);
    p.vy = 0.4 + Math.random() * 2;
    p.spin = (Math.random() - 0.5) * 20;
    p.mesh.rotation.z = Math.random() * 6;
    p.life = p.maxLife = 1.6 + Math.random() * 1.0;
    p.mesh.scale.setScalar(0.9 + Math.random() * 0.9);
  }
}
// 更新彩虹尾迹：上飘 + 重力回落贴地，半透明渐淡（保留形成视觉路径）
function updateRainbowPuffs(dt) {
  for (const p of rainbowPuffs) {
    if (p.life <= 0) continue;
    p.life -= dt;
    p.vy -= 4 * dt;
    p.mesh.position.x += p.vx * dt;
    p.mesh.position.y += p.vy * dt;
    if (p.mesh.position.y <= 0 && p.vy < 0) { p.mesh.position.y = 0; p.vy = 0; p.vx *= (1 - 4 * dt); }
    p.mesh.rotation.z += p.spin * dt;
    p.mesh.material.opacity = Math.max(0, Math.min(1, p.life / (p.maxLife * 0.5))) * 0.8;
    if (p.life <= 0) p.mesh.visible = false;
  }
}
// ---------- 烟花系统（腚上花火：从屁股向上发射，高空连续爆炸） ----------
const FW_COLORS = ['#ff5a5f', '#ffb400', '#39d353', '#29b6f6', '#9c6bff', '#ff69b4', '#ffffff'];
const fwShells = [];
const fwSparks = [];
const shellTex = paperTexture(16, 16, (g, w, h) => { g.fillStyle = '#fff6c9'; g.beginPath(); g.arc(w / 2, h / 2, 6, 0, 7); g.fill(); });
const shellMat = new THREE.MeshBasicMaterial({ map: shellTex, transparent: true, side: THREE.DoubleSide, depthWrite: false, fog: true });
for (let i = 0; i < 12; i++) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.1), shellMat.clone());
  m.visible = false;
  scene.add(m);
  fwShells.push({ mesh: m, on: false, x: 0, y: 0, vy: 0, targetY: 0 });
}
const sparkMats = FW_COLORS.map(c => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 1, side: THREE.DoubleSide, fog: true }));
for (let i = 0; i < 260; i++) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.06), sparkMats[i % sparkMats.length]);
  m.visible = false;
  scene.add(m);
  fwSparks.push({ mesh: m, life: 0, maxLife: 1, vx: 0, vy: 0 });
}
// 从屁股位置向上发射烟花弹
function spawnFireworkRocket(x, y) {
  const s = fwShells.find(q => !q.on);
  if (!s) return;
  s.on = true; s.x = x; s.y = y;
  s.vy = 12 + Math.random() * 3;
  s.targetY = y + (4.5 + Math.random() * 1.5);
  s.mesh.visible = true;
  s.mesh.position.set(x, y, 0.1);
  s.mesh.rotation.z = Math.random() * 6;
}
// 高空爆炸：彩色粒子向四周扩散
function explodeFirework(s) {
  const n = specialSprayCount(24);
  let c = 0;
  for (const p of fwSparks) {
    if (p.life > 0) continue;
    if (c++ >= n) break;
    p.mesh.visible = true;
    p.mesh.position.set(s.x, s.y, 0.1);
    const a = Math.random() * Math.PI * 2;
    const spd = 2 + Math.random() * 4;
    p.vx = Math.cos(a) * spd;
    p.vy = Math.sin(a) * spd * 0.8 + 1;
    p.life = p.maxLife = 0.7 + Math.random() * 0.6;
    p.mesh.material = sparkMats[(Math.random() * sparkMats.length) | 0];
  }
  playFireworkBoom();   // 烟花爆炸音效
}
// 更新烟花：弹体上升 → 高空爆炸 → 彩粒扩散落下
function updateFireworks(dt) {
  for (const s of fwShells) {
    if (!s.on) continue;
    s.vy -= 7 * dt;
    s.y += s.vy * dt;
    s.mesh.position.y = s.y;
    if (s.y >= s.targetY || s.vy <= 0) {
      s.on = false; s.mesh.visible = false;
      explodeFirework(s);
    }
  }
  for (const p of fwSparks) {
    if (p.life <= 0) continue;
    p.life -= dt;
    p.vy -= 6 * dt;
    p.mesh.position.x += p.vx * dt;
    p.mesh.position.y += p.vy * dt;
    p.mesh.material.opacity = Math.max(0, p.life / p.maxLife);
    if (p.life <= 0) { p.mesh.visible = false; p.mesh.material.opacity = 1; }
  }
}
// ---------- 纸屑粒子池 ----------
const confetti = [];
const confettiGeo = new THREE.PlaneGeometry(0.07, 0.1);
const confettiColors = ['#e8a0b0', '#ffd98a', '#8fbd7c', '#f6e8cf', '#d95b43'].map(c =>
  new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide, fog: false }));
for (let i = 0; i < 26; i++) {
  const m = new THREE.Mesh(confettiGeo, confettiColors[i % confettiColors.length]);
  m.visible = false;
  scene.add(m);
  confetti.push({ mesh: m, vx: 0, vy: 0, life: 0 });
}
function burstConfetti(x, y, z, n, power) {
  let c = 0;
  for (const p of confetti) {
    if (p.life > 0) continue;
    if (c++ >= n) break;
    p.mesh.visible = true;
    p.mesh.position.set(x + (Math.random() - 0.5) * 0.3, y + Math.random() * 0.2, z);
    p.vx = (Math.random() - 0.2) * power;
    p.vy = 1.5 + Math.random() * power;
    p.life = 0.9 + Math.random() * 0.5;
    p.mesh.rotation.set(0, 0, Math.random() * 6);
  }
}
// 喷一团屁云（从角色背后喷出；follow=1 时跟玩家同速前进，再慢慢减速被甩后）
// 生成单个屁粒子（供爆发与持续喷射复用）
function spawnOneFartParticleRaw(x, y, z, sizeMul) {
  const cloud = fartClouds.find(p => p.life <= 0);
  if (!cloud) return false;
  cloud.mesh.visible = true;
  // 出生点：同屎粒子（集中在向后 0.35 ±0.15，y/z 固定）
  cloud.mesh.position.set(
    x - 0.35 + (Math.random() - 0.5) * 0.3,
    y,
    z
  );
  cloud.mesh.material = fartMat(currentFartTex());
  cloud.life = (1.4 + Math.random() * 1.0) * state.fartFxDurationMul; // 同窜稀粒子寿命
  cloud.vx = -(2.5 + Math.random() * 2.6);       // 向后喷出（同窜稀）
  cloud.vy = 1.2 + Math.random() * 3.4;          // 向上抛起（同窜稀，重力回落）
  cloud.spin = (Math.random() - 0.5) * 26;       // 旋转（同窜稀）
  cloud.mesh.rotation.z = Math.random() * 6;
  // 大小 = 窜稀粒子 burstScale(0.9~2.0) × 2，受 QTE 程度修正
  const base = (0.9 + Math.random() * 1.1) * CONFIG.fartFx.scaleMul * (sizeMul || 1);
  cloud.mesh.scale.setScalar(base);
  return true;
}
function spawnOneFartParticle(x, y, z, sizeMul) {
  const n = fartGasCount(1);
  let ok = false;
  for (let i = 0; i < n; i++) ok = spawnOneFartParticleRaw(x, y, z, sizeMul) || ok;
  return ok;
}
function spawnGreenFartBits(x, y, z, n = 5, sizeMul = 1) {
  n = fartGasCount(n);
  for (let i = 0; i < n; i++) {
    const cloud = fartClouds.find(p => p.life <= 0);
    if (!cloud) return;
    cloud.mesh.visible = true;
    cloud.mesh.material = fartMat(greenMarinadeTex);
    cloud.mesh.position.set(
      x - 0.36 + (Math.random() - 0.5) * 0.46,
      y + (Math.random() - 0.5) * 0.22,
      z + 0.02
    );
    cloud.life = 1.15 + Math.random() * 0.65;
    cloud.vx = -(1.8 + Math.random() * 2.2);
    cloud.vy = 0.8 + Math.random() * 2.6;
    cloud.spin = (Math.random() - 0.5) * 22;
    cloud.mesh.rotation.z = Math.random() * 6;
    cloud.mesh.scale.setScalar((1.15 + Math.random() * 0.75) * sizeMul);
  }
}
function spawnOilFartBits(x, y, z, n = 7, sizeMul = 1) {
  n = fartGasCount(n);
  for (let i = 0; i < n; i++) {
    const cloud = fartClouds.find(p => p.life <= 0);
    if (!cloud) return;
    cloud.mesh.visible = true;
    cloud.mesh.material = fartMat(oilDropTex);
    cloud.mesh.position.set(
      x - 0.38 + (Math.random() - 0.5) * 0.5,
      y + (Math.random() - 0.5) * 0.3,
      z + 0.03
    );
    cloud.life = 1.45 + Math.random() * 0.85;
    cloud.vx = -(2.8 + Math.random() * 3.1);
    cloud.vy = 0.25 + Math.random() * 2.2;
    cloud.spin = (Math.random() - 0.5) * 34;
    cloud.mesh.rotation.z = Math.random() * 6;
    cloud.mesh.scale.setScalar((0.78 + Math.random() * 0.7) * sizeMul);
  }
}
// 开场爆发：生成一簇旧式大圆屁云（漂浮跟随 + 放大淡出，向后飘出）
function spawnPuffBurst(x, y, z, sizeMul = 1, durationMul = 1) {
  const n = fartGasCount(3 + ((Math.random() * 3) | 0));
  for (let i = 0; i < n; i++) {
    const p = puffs.find(q => q.life <= 0);
    if (!p) return;
    p.mesh.visible = true;
    p.mesh.material = fartMat(currentPuffTex());
    p.mesh.position.set(x - Math.random() * 0.8, y + (Math.random() - 0.5) * 0.6, z);
    p.life = (1.1 + Math.random() * 0.7) * durationMul;
    p.vx = 0;
    p.vy = 0;
    p.follow = 1;
    p.followDecay = 0;
    p.s = (2.2 + Math.random() * 1.2) * 3 * sizeMul;
    p.mesh.scale.setScalar(p.s * 0.55);
    p.grow = 0.12 + Math.random() * 0.06;
    p.mesh.rotation.z = (Math.random() - 0.5) * 1.2;
  }
}
function spawnDragonPuffBurst(x, y, z, sizeMul = 1, durationMul = 1) {
  const n = fartGasCount(5 + ((Math.random() * 4) | 0));
  for (let i = 0; i < n; i++) {
    const p = puffs.find(q => q.life <= 0);
    if (!p) return;
    p.mesh.visible = true;
    p.mesh.material = fartMat(dragonPuffTex);
    p.mesh.position.set(x - 0.25 - Math.random() * 1.05, y + (Math.random() - 0.5) * 0.75, z);
    p.life = (1.55 + Math.random() * 0.85) * durationMul;
    p.vx = -(0.55 + Math.random() * 1.05);
    p.vy = (Math.random() - 0.45) * 0.8;
    p.follow = 0.15;
    p.followDecay = 1.8;
    p.s = (2.4 + Math.random() * 1.3) * sizeMul;
    p.mesh.scale.setScalar(p.s * 0.72);
    p.grow = 0.28 + Math.random() * 0.12;
    p.mesh.rotation.z = (Math.random() - 0.5) * 1.6;
  }
}
// 原地崩飞：屁云从脚下向下喷（被屁从下方顶飞），向下初速 + 放大淡出
function spawnBlastJet(x, y, sizeMul = 1, durationMul = 1) {
  const n = fartGasCount(3 + ((Math.random() * 3) | 0));   // 3~5 朵/簇
  for (let i = 0; i < n; i++) {
    const p = puffs.find(q => q.life <= 0);
    if (!p) return;
    p.mesh.visible = true;
    p.mesh.material = fartMat(currentPuffTex());
    p.mesh.position.set(x + (Math.random() - 0.5) * 0.5, y, 0.12);
    p.life = (1.0 + Math.random() * 0.6) * durationMul;
    p.vx = (Math.random() - 0.5) * 1.2;       // 轻微横向扩散
    p.vy = -(7 + Math.random() * 5);          // 向下猛喷
    p.follow = 1;
    p.followDecay = 0;
    p.s = (2.0 + Math.random() * 1.0) * 3 * sizeMul;
    p.mesh.scale.setScalar(p.s * 0.5);
    p.grow = 0.16 + Math.random() * 0.06;
    p.mesh.rotation.z = (Math.random() - 0.5) * 1.2;
  }
}
function spawnFartCloud(x, y, z, tier, sizeMul) {
  // 大量小粒子构成一团屁：一次生成 count 个粒子（±1 随机波动），位置/速度/大小随机扩散
  const n = Math.max(2, Math.min(30, CONFIG.fartFx.count + ((Math.random() * 3) | 0) - 1));   // 默认 4~6 粒
  for (let i = 0; i < n; i++) {
    if (!spawnOneFartParticle(x, y, z, sizeMul)) return;
  }
}

export { fartClouds, puffs, poops, corns, dragonSeeds, mushrooms, muzzleFlashes, saladChunks, laserBeams, rainbowPuffs, confetti, burstConfetti, spawnOneFartParticle, spawnGreenFartBits, spawnOilFartBits, spawnPuffBurst, spawnDragonPuffBurst, spawnBlastJet, spawnFartCloud, spawnCornBurst, spawnDragonSeedBurst, spawnMushroomBurst, spawnMuzzleFlash, updateMuzzleFlashes, spawnSaladChunkBurst, updateSaladChunks, spawnLaserBeam, updateLaserBeams, spawnFireBurst, updateFireParticles, spawnRainbowPuff, updateRainbowPuffs, spawnFireworkRocket, updateFireworks };
