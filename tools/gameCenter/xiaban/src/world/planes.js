// 3D 飞机（与纸片鸟共存）：从右往左飞，玩家放屁起飞够得着时击落坠落 + 碎片 + 经验
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { scene, camera } from '../core/engine.js';
import { CONFIG } from '../config.js';
import { state, addShake } from '../core/state.js';
import { gainBreakXp } from '../systems/growth.js';
import { playPlaneExplode } from '../systems/audio.js';
import { bits } from './breakables.js';
import { player } from './character.js';

const loader = new GLTFLoader();
const models = {};
const modelReady = { small: false, big: false };
const planes = [];
let modelsLoaded = false;
const HALF_H = { big: 1.25, small: 0.75 };   // 半高（落地检测：中心降到半高即触地）

// 加载大/小飞机模型（GLB 已烘焙：目标高度、几何中心对齐、机头朝 -x）
function loadPlaneModels() {
  if (modelsLoaded) return;
  modelsLoaded = true;
  loader.load('assets/small-plane.glb', g => { models.small = g.scene; modelReady.small = true; console.log('[plane] 小飞机加载成功'); }, undefined, e => console.warn('[plane] 小飞机加载失败', e));
  loader.load('assets/big-plane.glb', g => { models.big = g.scene; modelReady.big = true; console.log('[plane] 大飞机加载成功'); }, undefined, e => console.warn('[plane] 大飞机加载失败', e));
}
// 初始化飞机池
for (let i = 0; i < CONFIG.planes.count; i++) {
  planes.push({ mesh: null, kind: 'small', speed: 0, y: 0, phase: 0, active: false, falling: false, vy: 0, spinV: 0 });
}
function spawnPlane(p, x) {
  if (!modelReady.small || !modelReady.big) return;
  p.kind = Math.random() < CONFIG.planes.bigChance ? 'big' : 'small';   // 大/小随机
  if (p.mesh) { scene.remove(p.mesh); }
  const inst = models[p.kind].clone(true);
  inst.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  // wrapper group：运动/摇摆作用于容器，模型(inst)保持烘焙机头朝向，避免欧拉角组合自转
  const g = new THREE.Group();
  g.add(inst);
  p.mesh = g;
  p.inst = inst;
  p.speed = CONFIG.planes.speedMin + Math.random() * (CONFIG.planes.speedMax - CONFIG.planes.speedMin);
  const layer = CONFIG.planes[p.kind] || { yMin: 10.2, yMax: 13.2 };
  p.y = layer.yMin + Math.random() * (layer.yMax - layer.yMin);
  p.phase = Math.random() * 7;
  p.falling = false; p.vy = 0;
  g.position.set(x !== undefined ? x : camera.position.x + 16 + Math.random() * 20, p.y, -4.2);
  g.visible = true;
  scene.add(g);
  p.active = true;
}
// 调试：Z 在相机前方视野内生成一架飞机（立即可见）
function spawnDebugPlane() {
  console.log('[plane] spawnDebugPlane 调用，模型就绪:', modelReady.small, modelReady.big, 'phase:', state.phase);
  if (!modelReady.small || !modelReady.big) {
    loadPlaneModels();
    console.warn('[plane] 模型未就绪，已触发加载（请稍后重试按 Z）');
    return;
  }
  const p = planes.find(q => !q.active) || planes[0];
  if (p.mesh) scene.remove(p.mesh);
  spawnPlane(p, camera.position.x + 3);
  console.log('[plane] 已生成 kind=' + p.kind + ' x=' + p.mesh.position.x.toFixed(1) + ' y=' + p.mesh.position.y.toFixed(1) + ' z=' + p.mesh.position.z.toFixed(1) + ' active=' + p.active + ' camera.x=' + camera.position.x.toFixed(1));
}
// 击落：碎片 + 爆炸音 + 震屏 + 经验，随后坠落
function smashPlane(p) {
  const bx = p.mesh.position.x, by = p.mesh.position.y;
  p.falling = true;
  p.vy = 1 + Math.random() * 1.5;
  p.spinV = (Math.random() - 0.5) * 12;
  for (let i = 0; i < 8; i++) {
    const bit = bits.find(q => q.life <= 0);
    if (!bit) break;
    bit.mesh.visible = true;
    bit.mesh.position.set(bx + (Math.random() - 0.5) * 0.5, by, -4);
    bit.vx = (Math.random() - 0.5) * 4;
    bit.vy = 1 + Math.random() * 2.5;
    bit.life = 0.8 + Math.random() * 0.4;
    bit.spin = (Math.random() - 0.5) * 20;
    bit.mesh.scale.setScalar(0.6 + Math.random() * 0.5);
  }
  playPlaneExplode();
  addShake(0.35, 0, 0.15);
  gainBreakXp(8);   // 飞机：很高频，经验更高
}
function updatePlanes(dt, t) {
  // 模型就绪后补生成未激活的飞机（防加载完成前 beginRun 时漏生成导致飞机不出现）
  if (modelReady.small && modelReady.big) {
    for (const p of planes) {
      if (!p.active && !p.falling) spawnPlane(p);
    }
  }
  for (const p of planes) {
    if (!p.active) continue;
    if (p.falling) {
      // 击落坠落：下坠 + 翻滚
      p.vy -= 14 * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.x -= p.speed * 0.3 * dt;
      p.mesh.rotation.z += p.spinV * dt;
      p.mesh.rotation.x += p.spinV * dt;
      if (p.mesh.position.y <= HALF_H[p.kind]) {
        p.active = false; p.mesh.visible = false; scene.remove(p.mesh);
        spawnPlane(p);   // 落地重生
      }
    } else {
      p.mesh.position.x -= p.speed * dt;
      p.mesh.position.y = p.y + Math.sin(t * 1.2 + p.phase) * 0.3;
      p.mesh.rotation.z = Math.sin(t * 2.5 + p.phase) * 0.06;   // 容器轻微摇摆，模型朝向不变
      // 撞飞机：仅玩家放屁起飞（跳得高）够得着 → 击落坠落 + 经验
      if (Math.abs(p.mesh.position.x - player.position.x) < 1.2 &&
          Math.abs(p.mesh.position.y - (player.position.y + 0.6)) < 1.3) {
        smashPlane(p);
      }
      if (p.mesh.position.x < camera.position.x - 16) spawnPlane(p);
    }
  }
}

export { planes, spawnPlane, spawnDebugPlane, updatePlanes, loadPlaneModels };
