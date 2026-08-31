// 模块化重构：由 paper-theater-runner.html 拆出
import * as THREE from 'three';
import { scene } from '../core/engine.js';
import { CONFIG } from '../config.js';
import { paperTexture, paperMat, roundRect } from './textures.js';
import { state } from '../core/state.js';

// ---------- 纸片角色（关节木偶） ----------
const P = {
  torso: paperTexture(128, 160, (g, w, h) => {      // 银行职员西装躯干（侧身朝右）
    g.fillStyle = '#3b4a63';                        // 深蓝西装
    roundRect(g, 22, 30, 84, 118, 14); g.fill();
    g.fillStyle = '#32405a';                        // 背部阴影
    roundRect(g, 22, 30, 32, 118, 12); g.fill();
    g.fillStyle = '#f4f0e6';                        // 白衬衫领口（V 形）
    g.beginPath(); g.moveTo(58, 34); g.lineTo(74, 64); g.lineTo(52, 64); g.closePath(); g.fill();
    g.fillStyle = '#8c2f2f';                        // 深红领带
    g.beginPath(); g.moveTo(64, 44); g.lineTo(70, 88); g.lineTo(60, 96); g.lineTo(56, 80); g.closePath(); g.fill();
    g.fillStyle = '#27334a';                        // 口袋
    roundRect(g, 40, 98, 30, 6, 2); g.fill();
    g.fillStyle = '#c9a24a';                        // 金色纽扣
    g.beginPath(); g.arc(62, 76, 2.5, 0, 7); g.fill();
    g.beginPath(); g.arc(62, 98, 2.5, 0, 7); g.fill();
  }),
  head: paperTexture(128, 128, (g, w, h) => {       // 头（中年银行职员，发际线后退 + 金丝眼镜 + 冷汗）
    g.fillStyle = '#ffe0c2';
    g.beginPath(); g.arc(64, 64, 44, 0, 7); g.fill();
    g.fillStyle = '#3a2e26';                        // 背头（发际线明显后退）
    g.beginPath(); g.arc(64, 48, 44, Math.PI * 1.0, Math.PI * 2.0); g.fill();
    g.fillStyle = '#2e2620';                        // 侧面鬓角
    g.beginPath(); g.arc(90, 58, 16, Math.PI * 0.6, Math.PI * 1.4); g.fill();
    g.fillStyle = '#2a1a12';                        // 眼睛
    g.beginPath(); g.arc(84, 62, 5, 0, 7); g.fill();
    g.strokeStyle = '#c9a24a'; g.lineWidth = 2;     // 金丝眼镜
    g.beginPath(); g.arc(84, 62, 10, 0, 7); g.stroke();
    g.beginPath(); g.moveTo(94, 60); g.lineTo(101, 57); g.stroke();
    g.fillStyle = '#7fb2d8';                        // 冷汗珠（紧张）
    g.beginPath(); g.arc(58, 50, 4, 0, 7); g.fill();
    g.fillStyle = '#e89a7a';                        // 腮红
    g.beginPath(); g.arc(74, 80, 7, 0, 7); g.fill();
    g.strokeStyle = '#c96a4a'; g.lineWidth = 3;     // 抿紧的嘴
    g.beginPath(); g.arc(88, 78, 6, 0.15, 1.05); g.stroke();
  }),
  arm: paperTexture(64, 128, (g, w, h) => {         // 西装袖 + 手
    g.fillStyle = '#3b4a63';
    roundRect(g, 16, 8, 30, 96, 14); g.fill();
    g.fillStyle = '#32405a';
    roundRect(g, 16, 8, 14, 96, 10); g.fill();
    g.fillStyle = '#ffe0c2';
    g.beginPath(); g.arc(32, 106, 12, 0, 7); g.fill();
  }),
  leg: paperTexture(64, 128, (g, w, h) => {         // 深灰西裤 + 黑皮鞋
    g.fillStyle = '#2c2c38';
    roundRect(g, 18, 6, 28, 96, 10); g.fill();
    g.fillStyle = '#1a1a22';                        // 皮鞋
    roundRect(g, 12, 92, 40, 22, 6); g.fill();
    g.fillStyle = '#33333f';                        // 皮鞋高光
    roundRect(g, 14, 94, 20, 6, 3); g.fill();
  }),
};
function limbMesh(tex, w, h) {   // 关节在顶端的四肢面片
  const geo = new THREE.PlaneGeometry(w, h);
  geo.translate(0, -h / 2, 0);
  return new THREE.Mesh(geo, paperMat(tex));
}
const player = new THREE.Group();
player.position.set(-6.5, 0, 0);   // 开幕时从画面左侧滑入到 -2
scene.add(player);

// 大腚转转转：角色整体旋转容器。spinPivot 原点=角色中心（y≈0.7），bodyLayer 抵消偏移保持视觉位置不变。
// 旋转 spinPivot 即绕角色中心旋转（player 原点仍为底部，位置逻辑不受影响）
const spinPivot = new THREE.Group();
spinPivot.position.y = 0.7;
player.add(spinPivot);
const bodyLayer = new THREE.Group();
bodyLayer.position.y = -0.7;
spinPivot.add(bodyLayer);

const torsoPivot = new THREE.Group();
torsoPivot.position.y = 0.62;
bodyLayer.add(torsoPivot);

const torso = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.65), paperMat(P.torso));
torso.position.y = 0.34;
torsoPivot.add(torso);

const head = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), paperMat(P.head));
head.position.y = 0.86;
torsoPivot.add(head);

const armL = limbMesh(P.arm, 0.15, 0.5); armL.position.set(-0.02, 0.56, -0.02);
const armR = limbMesh(P.arm, 0.15, 0.5); armR.position.set(0.02, 0.56, 0.02);
torsoPivot.add(armL, armR);
const legL = limbMesh(P.leg, 0.18, 0.62); legL.position.set(-0.08, 0.62, -0.02);
const legR = limbMesh(P.leg, 0.18, 0.62); legR.position.set(0.08, 0.62, 0.02);
bodyLayer.add(legL, legR);
const characterTintMeshes = [torso, head, armL, armR, legL, legR];

function setCharacterTint(color) {
  for (const mesh of characterTintMeshes) {
    if (!mesh.material?.color) continue;
    mesh.material.color.set(color || '#ffffff');
  }
}
function setCharacterScale(scale = 1, yScale = scale) {
  spinPivot.scale.set(scale || 1, yScale || scale || 1, 1);
}
function updateCharacterMutation(t) {
  if (state.activeFoodEvent?.tintMode !== 'rainbow') return;
  for (let i = 0; i < characterTintMeshes.length; i++) {
    const mesh = characterTintMeshes[i];
    if (!mesh.material?.color) continue;
    mesh.material.color.setHSL((t * 0.22 + i * 0.13) % 1, 0.88, 0.58);
  }
}

// 火箭喷屁火焰：纸片风格的橙黄火舌，挂在角色臀部后方并持续脉动。
const rocketFlameTex = paperTexture(128, 64, (g, w, h) => {
  g.fillStyle = 'rgba(255, 118, 34, 0.96)';
  g.beginPath();
  g.moveTo(116, 32); g.lineTo(91, 9); g.lineTo(70, 22); g.lineTo(42, 14);
  g.lineTo(54, 32); g.lineTo(38, 50); g.lineTo(72, 42); g.lineTo(94, 55);
  g.closePath(); g.fill();
  g.fillStyle = '#ffd84f';
  g.beginPath();
  g.moveTo(115, 32); g.lineTo(92, 20); g.lineTo(72, 28); g.lineTo(61, 25);
  g.lineTo(69, 34); g.lineTo(59, 42); g.lineTo(83, 38); g.lineTo(96, 45);
  g.closePath(); g.fill();
  g.fillStyle = '#fff4b0';
  g.beginPath();
  g.moveTo(113, 32); g.lineTo(91, 27); g.lineTo(76, 32); g.lineTo(91, 37); g.closePath(); g.fill();
});
const rocketFlameMat = new THREE.MeshBasicMaterial({
  map: rocketFlameTex, transparent: true, depthWrite: false,
  side: THREE.DoubleSide, fog: false,
});
const rocketFlame = new THREE.Group();
rocketFlame.position.set(-0.44, 0.48, 0.16);
rocketFlame.visible = false;
const rocketFlameOuter = new THREE.Mesh(new THREE.PlaneGeometry(1.18, 0.58), rocketFlameMat);
const rocketFlameCore = new THREE.Mesh(new THREE.PlaneGeometry(0.82, 0.38), rocketFlameMat);
rocketFlameCore.position.set(0.12, 0, 0.01);
rocketFlame.add(rocketFlameOuter, rocketFlameCore);
bodyLayer.add(rocketFlame);
const rocketFlameParticleGeo = new THREE.PlaneGeometry(0.34, 0.18);
const rocketFlameParticles = [];
for (let i = 0; i < 48; i++) {
  const mat = rocketFlameMat.clone();
  mat.opacity = 0;
  const mesh = new THREE.Mesh(rocketFlameParticleGeo, mat);
  mesh.visible = false;
  scene.add(mesh);
  rocketFlameParticles.push({ mesh, life: 0, maxLife: 0, vx: 0, vy: 0, spin: 0 });
}

function spawnRocketFlameParticle() {
  const p = rocketFlameParticles.find(item => item.life <= 0);
  if (!p) return;
  p.maxLife = 0.28 + Math.random() * 0.24;
  p.life = p.maxLife;
  p.mesh.visible = true;
  p.mesh.position.set(
    player.position.x - 0.72 - Math.random() * 0.24,
    player.position.y + 0.48 + (Math.random() - 0.5) * 0.24,
    0.17
  );
  p.vx = -1.6 - Math.random() * 2.6;
  p.vy = (Math.random() - 0.5) * 1.8;
  p.spin = (Math.random() - 0.5) * 14;
  p.mesh.scale.setScalar(0.9 + Math.random() * 0.8);
  p.mesh.rotation.z = Math.random() * 6;
  p.mesh.material.opacity = 1;
}

function updateRocketFlameParticles(dt) {
  const active = state.phase === 'run' && state.rocketFart && state.fartFlying;
  if (active) {
    spawnRocketFlameParticle();
    if (Math.random() < 0.95) spawnRocketFlameParticle();
  }
  for (const p of rocketFlameParticles) {
    if (p.life <= 0) continue;
    p.life -= dt;
    p.mesh.position.x += p.vx * dt;
    p.mesh.position.y += p.vy * dt;
    p.mesh.rotation.z += p.spin * dt;
    p.mesh.scale.multiplyScalar(1 - dt * 1.4);
    p.mesh.material.opacity = Math.max(0, p.life / p.maxLife);
    if (p.life <= 0) {
      p.mesh.visible = false;
      p.mesh.material.opacity = 0;
    }
  }
}

function updateRocketFlame(t) {
  const active = state.phase === 'run' && state.rocketFart && state.fartFlying;
  rocketFlame.visible = active;
  if (!active) return;
  const pulse = (Math.sin(t * 34) + 1) * 0.5;
  rocketFlame.position.x = -0.44 - pulse * 0.1;
  rocketFlame.rotation.z = (pulse - 0.5) * 0.16;
  rocketFlame.scale.set(1 + pulse * 0.22, 1 - pulse * 0.1, 1);
  rocketFlameCore.scale.set(0.9 + pulse * 0.24, 1.05 - pulse * 0.12, 1);
}

// （终点房子已删除：无尽跑酷无终点）

export { player, spinPivot, torsoPivot, legL, legR, armL, armR, head, setCharacterTint, setCharacterScale, updateCharacterMutation, updateRocketFlame, updateRocketFlameParticles };
