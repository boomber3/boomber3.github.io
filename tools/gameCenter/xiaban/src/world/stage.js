// 模块化重构：由 paper-theater-runner.html 拆出
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { scene, camera } from '../core/engine.js';
import { paperTexture, paperMat, roundRect } from './textures.js';

// ---------- 中景布景素材（树 / 屋 / 灌木） ----------
const treePineTex = paperTexture(128, 256, (g, w, h) => {
  g.fillStyle = '#6b4a34'; g.fillRect(w / 2 - 9, h - 66, 18, 66);   // 树干
  const tiers = [[0.86, 62], [0.66, 128], [0.46, 190]];             // 三层树冠
  g.fillStyle = '#4f7d52';
  for (const [k, y] of tiers) {
    g.beginPath();
    g.moveTo(w / 2, y - 78);
    g.lineTo(w / 2 - w * k / 2, y);
    g.lineTo(w / 2 + w * k / 2, y);
    g.closePath(); g.fill();
  }
  g.fillStyle = '#5f9262';                                           // 受光面
  g.beginPath(); g.moveTo(w / 2, 48); g.lineTo(w * 0.62, 116); g.lineTo(w * 0.38, 116); g.closePath(); g.fill();
});
const treeRoundTex = paperTexture(160, 224, (g, w, h) => {
  g.fillStyle = '#6b4a34'; g.fillRect(w / 2 - 8, h - 58, 16, 58);
  g.fillStyle = '#7fae6e';
  g.beginPath(); g.arc(w / 2, h - 118, 62, 0, 7); g.fill();
  g.fillStyle = '#8fbd7c';
  g.beginPath(); g.arc(w / 2 - 24, h - 138, 34, 0, 7); g.fill();
  g.fillStyle = '#e8a0b0';                                           // 小花
  [[-30, -20], [18, -34], [34, 6], [-6, 18]].forEach(([dx, dy]) => {
    g.beginPath(); g.arc(w / 2 + dx, h - 118 + dy, 7, 0, 7); g.fill();
  });
});
const houseTex = paperTexture(192, 192, (g, w, h) => {
  g.fillStyle = '#efdcb8';
  roundRect(g, 30, 86, 132, 96, 4); g.fill();
  g.fillStyle = '#c0563f';
  g.beginPath(); g.moveTo(14, 90); g.lineTo(96, 18); g.lineTo(178, 90); g.closePath(); g.fill();
  g.fillStyle = '#a8462f';
  g.beginPath(); g.moveTo(96, 18); g.lineTo(178, 90); g.lineTo(150, 90); g.closePath(); g.fill();
  g.fillStyle = '#7a5a3a';
  roundRect(g, 80, 118, 32, 64, 3); g.fill();                        // 门
  g.fillStyle = '#ffe2a8';
  roundRect(g, 44, 108, 26, 26, 2); g.fill();                        // 窗
  g.fillStyle = '#8a5a3b';
  g.fillRect(30, 176, 132, 7);
});
const bushTex = paperTexture(128, 96, (g, w, h) => {
  g.fillStyle = '#5f8f5a';
  [[36, h - 30, 28], [70, h - 38, 34], [100, h - 28, 24]].forEach(([x, y, r]) => {
    g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  });
});

// 前景剪影大草（深色，快速掠过）
const fgGrassTex = paperTexture(128, 160, (g, w, h) => {
  g.fillStyle = '#2e4a38';
  const blades = [[26, 60, 40, 26], [52, 40, 66, 52], [80, 52, 50, 34], [104, 68, 30, 20]];
  for (const [x, yTop, len, sway] of blades) {
    g.beginPath();
    g.moveTo(x - 9, h);
    g.quadraticCurveTo(x - sway, h - yTop, x + 4, h - yTop - len);
    g.quadraticCurveTo(x + sway * 0.6, h - yTop, x + 9, h);
    g.closePath(); g.fill();
  }
});

// ---------- 舞台台面 ----------
const groundTex = paperTexture(512, 256, (g, w, h) => {
  g.fillStyle = '#d9a87c'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#c9956a'; g.fillRect(0, h * 0.34, w, h * 0.3);       // 小径
  g.fillStyle = '#e0b68c'; g.fillRect(0, h * 0.42, w, h * 0.14);
  for (let i = 0; i < 90; i++) {                                       // 碎石
    g.fillStyle = Math.random() < 0.5 ? '#c08a5f' : '#e6bd92';
    const r = 2 + Math.random() * 4;
    g.beginPath(); g.arc(Math.random() * w, Math.random() * h, r, 0, 7); g.fill();
  }
  g.fillStyle = '#8fae6a';                                             // 远侧草点
  for (let i = 0; i < 26; i++) {
    const x = Math.random() * w, y = h * 0.06 + Math.random() * h * 0.22;
    g.fillRect(x, y, 3, 6); g.fillRect(x + 5, y + 3, 3, 5);
  }
});
const GROUND_LEN = 220, GROUND_REPEAT = 52, TEX_WORLD_LEN = GROUND_LEN / GROUND_REPEAT;
groundTex.wrapS = THREE.RepeatWrapping;
groundTex.repeat.set(GROUND_REPEAT, 1);
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(GROUND_LEN, 16),
  new THREE.MeshBasicMaterial({ map: groundTex })
);
ground.rotation.x = -Math.PI / 2;
ground.position.set(0, 0, -4.8);       // 台面 z ∈ [-12.8, 3.2]
scene.add(ground);

// 台面前缘立面（舞台厚度感）
const edgeTex = paperTexture(256, 64, (g, w, h) => {
  g.fillStyle = '#8a5a3b'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#7a4e32';
  for (let i = 0; i < 40; i++) g.fillRect(Math.random() * w, Math.random() * h, 8, 3);
  g.fillStyle = '#9c6a45'; g.fillRect(0, 0, w, 9);
});
edgeTex.wrapS = THREE.RepeatWrapping;
edgeTex.wrapT = THREE.RepeatWrapping;
edgeTex.repeat.set(44, 8);
const edge = new THREE.Mesh(
  new THREE.PlaneGeometry(GROUND_LEN, 12),
  new THREE.MeshBasicMaterial({ map: edgeTex })
);
edge.position.set(0, -6, 3.21);   // 台面前缘向下延伸（顶部贴台面 y=0，下缘 -12），摄像机下移不露空白
scene.add(edge);

// 前景剪影草（台唇处，快速掠过 → 最强视差层）
const fgGrassGeo = new THREE.PlaneGeometry(0.8, 1.0); fgGrassGeo.translate(0, 0.5, 0);
const fgGrassMat = paperMat(fgGrassTex);
const fgGrasses = [];
for (let i = 0; i < 18; i++) {
  const m = new THREE.Mesh(fgGrassGeo, fgGrassMat);
  m.scale.setScalar(0.8 + Math.random() * 0.7);
  m.position.set(-9 + i * 2.1 + Math.random() * 2, -0.15, 2.4 + Math.random() * 0.7);
  scene.add(m);
  fgGrasses.push(m);
}
// 前景植物模型（Kenney 花/草 GLB）：加载完成后替换纸片草
const plantLoader = new GLTFLoader();
const plantModels = {};
let plantLoaded = false;
function checkPlantsReady() {
  if (plantLoaded) return;
  if (plantModels.flowersTall && plantModels.flowers && plantModels.grass) {
    plantLoaded = true;
    rebuildFgGrasses();
  }
}
function loadFgPlants() {
  if (plantLoaded) return;
  plantLoader.load('assets/plants/flowers-tall.glb', g => { plantModels.flowersTall = g.scene; checkPlantsReady(); }, undefined, () => {});
  plantLoader.load('assets/plants/flowers.glb', g => { plantModels.flowers = g.scene; checkPlantsReady(); }, undefined, () => {});
  plantLoader.load('assets/plants/grass.glb', g => { plantModels.grass = g.scene; checkPlantsReady(); }, undefined, () => {});
}
// 用 3D 模型替换纸片前景草：草密花疏（草 80% / 花 15% / 高花 5%），z 前后错落
function rebuildFgGrasses() {
  for (const m of fgGrasses) scene.remove(m);
  fgGrasses.length = 0;
  for (let i = 0; i < 40; i++) {
    const roll = Math.random();
    const src = roll < 0.8 ? plantModels.grass : roll < 0.95 ? plantModels.flowers : plantModels.flowersTall;
    const inst = src.clone(true);
    inst.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
    inst.scale.setScalar(0.9 + Math.random() * 0.9);
    inst.rotation.y = Math.random() * Math.PI * 2;                 // 随机朝向（旋转抖动）
    inst.rotation.z = (Math.random() - 0.5) * 0.25;                // 轻微倾斜，避免笔直整齐
    const box = new THREE.Box3().setFromObject(inst);
    inst.position.set(-9 + i * 1.0 + Math.random() * 2, -box.min.y, 1.0 + Math.random() * 1.9);   // z 前后错落，不在一条线
    scene.add(inst);
    fgGrasses.push(inst);
  }
}
// 调试：在相机前方生成一个前景植物（F 面板模型测试用）
function spawnFgPlant(name) {
  const src = plantModels[name] || plantModels.flowers;
  if (!src) return null;
  const inst = src.clone(true);
  inst.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  inst.scale.setScalar(0.9 + Math.random() * 0.9);
  inst.rotation.y = Math.random() * Math.PI * 2;                 // 随机朝向（旋转抖动）
  inst.rotation.z = (Math.random() - 0.5) * 0.25;                // 轻微倾斜
  const box = new THREE.Box3().setFromObject(inst);
  inst.position.set(camera.position.x + 5, -box.min.y, 1.0 + Math.random() * 1.9);   // 相机前方台唇处（z 前后错落�?
  scene.add(inst);
  return inst;
}
loadFgPlants();
// ---------- 幕布（超宽，保证竖屏也盖满） ----------
const curtainTexL = paperTexture(256, 512, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, w, 0);
  gr.addColorStop(0, '#a8232e'); gr.addColorStop(0.5, '#7c1620'); gr.addColorStop(1, '#a8232e');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(0,0,0,0.18)';
  for (let i = 0; i < 6; i++) g.fillRect(i * w / 6 + 8, 0, 6, h);
  g.fillStyle = '#c9a24a'; g.fillRect(0, h - 26, w, 10);
});
curtainTexL.wrapS = THREE.RepeatWrapping;
curtainTexL.repeat.set(3, 1);
const curtL = new THREE.Mesh(new THREE.PlaneGeometry(40, 40),
  new THREE.MeshBasicMaterial({ map: curtainTexL, fog: false, side: THREE.DoubleSide }));
curtL.position.set(-20, 5.5, 6.5);
const curtR = new THREE.Mesh(new THREE.PlaneGeometry(40, 40),
  new THREE.MeshBasicMaterial({ map: curtainTexL, fog: false, side: THREE.DoubleSide }));
curtR.position.set(20, 5.5, 6.5);
curtR.scale.x = -1;   // 镜像，褶皱对仗
scene.add(curtL, curtR);
const CURT_SLIDE = 34;

export { ground, groundTex, edge, curtL, curtR, CURT_SLIDE, fgGrasses, TEX_WORLD_LEN, spawnFgPlant };
