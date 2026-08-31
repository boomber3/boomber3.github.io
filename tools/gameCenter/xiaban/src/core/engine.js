// 模块化重构：由 paper-theater-runner.html 拆出
import * as THREE from 'three';

/* ============================================================
   纸片剧场跑步场景 —— three.js
   核心思路：
   - 所有纸片是立在舞台上的面片（XY 平面，面向观众）
   - 用真实 Z 轴纵深分层，透视相机自动产生正确的视差
   - 角色原地跑，世界向 -X 推进，物件越过身后即回收循环
   - 道具在屏幕右缘外"翻页立起"入场（像布景被摆上舞台）
   - 纸片偶关节动画全部绕 Z 轴（纸平面内摆动），剪纸木偶感
   ============================================================ */

// ---------- 基础 ----------
// 游戏画面像素化：渲染到低分辨率 buffer，CSS 最近邻放大成大像素块；DOM UI 不受影响。
// QTE 判定条为场景 mesh（CanvasTexture 贴图），随主画面一起低分辨率渲染 → 被同一像素化链处理。
const PIXEL_SCALE = 5;   // 每像素块约占 5 个屏幕像素（调大 = 像素块更大更粗）
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.domElement.id = 'gameCanvas';
renderer.outputColorSpace = THREE.SRGBColorSpace;
function layoutRenderer() {
  const w = Math.max(160, Math.floor(innerWidth / PIXEL_SCALE));
  const h = Math.max(90, Math.floor(innerHeight / PIXEL_SCALE));
  renderer.setPixelRatio(1);
  renderer.setSize(w, h, false);   // false：不改 CSS 尺寸，canvas 保持全屏由 CSS 放大
}
layoutRenderer();
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(new THREE.Color('#ffd9ac'), 24, 80);   // 远景融入天色 → 空气透视
scene.background = new THREE.Color('#ffd9ac');  // 兜底：未被几何覆盖的方向显示地平线暖色，避免飞高时露出暗虚空

// 灯光：暖色主光 + 天光，让 3D 模型有体积感（纸片用 MeshBasicMaterial 不受影响）
scene.add(new THREE.AmbientLight(0xfff0dc, 0.85));
const keyLight = new THREE.DirectionalLight(0xffd9a0, 1.7);
keyLight.position.set(-4, 9, 6);
scene.add(keyLight);
const fillLight = new THREE.DirectionalLight(0xc9b0e8, 0.45);
fillLight.position.set(5, 3, 4);
scene.add(fillLight);

const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 160);
// 正对剧场：相机与注视点同 X（零偏航，观众席正对舞台的观剧视角）
// 屏幕中心放在角色前方 2m（CAM_X = 角色x[-2] + 2），角色落在左侧三分之一，右侧留反应空间
const CAM_X = 0;
const CAM_Y = 2.4;
const CAM_Z = 9.8;
const LOOK_Y = 1.35;

let camDist = 1;
function layoutCamera() {
  // 横版设计：竖屏时把相机拉远，保证水平视野（角色前方留出反应空间）不被裁掉
  const aspect = innerWidth / innerHeight;
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
  camDist = aspect >= 1.7 ? 1 : 1 + (1.7 / aspect - 1) * 0.9;
}
layoutCamera();

export { renderer, scene, camera, camDist, layoutRenderer, layoutCamera, CAM_X, CAM_Y, CAM_Z, LOOK_Y };
