// 模块化重构：由 paper-theater-runner.html 拆出
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { scene } from '../core/engine.js';
import { CONFIG } from '../config.js';
import { state } from '../core/state.js';

// ---------- 舞台物件：游标生成（恒定密度 + 边缘翻页入场） ----------
const PROP_EDGE = 12;   // 屏幕右缘外的道具生成线

// 3D 中景布景：按地区分子目录（models_city/town|city|wild）
const MODEL_FILES = [
  // 乡镇
  'town/town-house-a', 'town/town-house-b', 'town/town-house-c',
  'town/detail-awning', 'town/detail-parasol-a',
  // 城市
  'city/building-a', 'city/building-b', 'city/building-skyscraper-a',
  'city/traffic-01',
  // 野外
  'wild/mini-forest/building-platform', 'wild/mini-forest/tree-high', 'wild/mini-forest/tree',
  'wild/mini-forest/rocks-ramp', 'wild/platformer/tree-pine-small', 'wild/platformer/tree-snow',
];
const gltfLoader = new GLTFLoader();
const modelCache = {};
const MID_KINDS = [
  // 乡镇（矮房 + 街边小店）
  { region: 'town', model: 'town/town-house-a',      h: 1.5, z: -6.0, ry: -1.2708 },
  { region: 'town', model: 'town/town-house-b',      h: 1.5, z: -6.5, ry: -1.4708 },
  { region: 'town', model: 'town/town-house-c',      h: 1.5, z: -5.8, ry: -1.0708 },
  { region: 'town', model: 'town/detail-awning',     h: 1.5, z: -4.8, ry: 0.0 },
  { region: 'town', model: 'town/detail-parasol-a',  h: 1.2, z: -5.2, ry: 0.4 },
  // 城市（高楼 + 交通标志）
  { region: 'city', model: 'city/building-skyscraper-a', h: 16.5, z: -9.5, ry: 0.0 },
  { region: 'city', model: 'city/building-a',            h: 4.27, z: -8.9, ry: 0.3 },
  { region: 'city', model: 'city/building-b',            h: 3.8, z: -8.1, ry: 0.0 },
  { region: 'city', model: 'city/traffic-01',            h: 1.4, z: -4.5, ry: 0.0 },
  // 野外（森林植物）
  { region: 'wild', model: 'wild/mini-forest/building-platform', h: 0.83, z: -6.0, ry: 0.3 },
  { region: 'wild', model: 'wild/mini-forest/tree-high',          h: 4.0, z: -6.5, ry: 0.1 },
  { region: 'wild', model: 'wild/mini-forest/tree',               h: 3.0, z: -6.0, ry: 0.2 },
  { region: 'wild', model: 'wild/mini-forest/rocks-ramp',         h: 1.2, z: -5.5, ry: 0.2 },
  { region: 'wild', model: 'wild/platformer/tree-pine-small',     h: 1.8, z: -5.5, ry: 0.1 },
  { region: 'wild', model: 'wild/platformer/tree-snow',           h: 3.5, z: -6.5, ry: 0.2 },
];
// 从缓存克隆一个实例：缩放至目标高度、底部对齐 y=0（翻页转轴落在地面）
function makePropInstance(kind) {
  const src = modelCache[kind.model];
  if (!src) return null;
  const inst = src.clone();                       // 共享几何/材质，省内存
  const box = new THREE.Box3().setFromObject(inst);
  const size = box.getSize(new THREE.Vector3());
  if (size.y < 1e-4) return null;
  const s = kind.h / size.y;
  inst.scale.setScalar(s);
  const box2 = new THREE.Box3().setFromObject(inst);
  inst.position.y += -box2.min.y;                 // 底部对齐地面
  return inst;
}
const props = [];
// 地区模型池：根据累计距离返回当前地区（含边界渐变混合）的 model 名数组
function getRegionKinds(dist) {
  const R = CONFIG.regions;
  const order = R.order;
  const total = order.reduce((s, id) => s + R[id].dist, 0);
  const cycle = ((dist % total) + total) % total;
  let acc = 0;
  for (let i = 0; i < order.length; i++) {
    const id = order[i];
    const d = R[id].dist;
    if (cycle < acc + d) {
      const inRegion = cycle - acc;
      if (inRegion > d - R.fade) {           // 本地区末尾 fade 米：混合下一地区（渐变过渡）
        return R[id].kinds.concat(R[order[(i + 1) % order.length]].kinds);
      }
      return R[id].kinds;
    }
    acc += d;
  }
  return R[order[0]].kinds;
}
// 从当前地区 kinds 池随机选一个 MID_KINDS 条目
function pickRegionKind() {
  const names = getRegionKinds(state.dist);
  const name = names[(Math.random() * names.length) | 0];
  return MID_KINDS.find(k => k.model === name) || MID_KINDS[0];
}
// 当前地区 id（边界渐变区返回 'town+city' 混合标识，调试用）
function getRegionId(dist) {
  const R = CONFIG.regions;
  const order = R.order;
  const total = order.reduce((s, id) => s + R[id].dist, 0);
  const cycle = ((dist % total) + total) % total;
  let acc = 0;
  for (let i = 0; i < order.length; i++) {
    const id = order[i];
    const d = R[id].dist;
    if (cycle < acc + d) {
      const inRegion = cycle - acc;
      if (inRegion > d - R.fade) return order[i] + '+' + order[(i + 1) % order.length];
      return id;
    }
    acc += d;
  }
  return order[0];
}
function placeProp(p, x, pop) {
  const k = pickRegionKind();                // 按地区选模型（替代全局随机）
  if (p.mesh) scene.remove(p.mesh);               // 回收旧的
  const inst = makePropInstance(k);
  if (!inst) return;
  p.mesh = inst;
  p.kind = k;
  p.mesh.position.set(x, 0, k.z + Math.random() * 1.2);
  p.mesh.rotation.y = k.ry + (Math.random() - 0.5) * 0.4;
  scene.add(p.mesh);
  p.alive = true; p.mesh.visible = true;
  if (pop) { p.pop = { t: 0, dur: 0.65 }; p.mesh.rotation.x = -1.35; }
  else { p.pop = null; p.mesh.rotation.x = 0; }
}
// 生成线位置放入共享 state（主循环跨模块读写）
state.propCursor = 32;
// 模型加载完成后：铺满初始中景（保留翻页立起动画）
function populateProps() {
  for (let i = 0; i < 26; i++) {
    if (i >= props.length) props.push({ mesh: null, kind: null, pop: null, alive: false });
    placeProp(props[i], -12 + i * 2.6 + Math.random() * 1.8, false);
  }
}
// 新局重置：生成线回到起点（由 session.resetWorldForNewRun 调用）
function resetPropCursor() { state.propCursor = 32; }
// 调试：在指定位置生成指定 kind 的背景模型（F 面板用，相机前方测试）
function spawnPropAt(kind, x) {
  const inst = makePropInstance(kind);
  if (!inst) return null;
  inst.position.set(x, 0, kind.z + Math.random() * 1.2);
  inst.rotation.y = kind.ry + (Math.random() - 0.5) * 0.4;
  scene.add(inst);
  return inst;
}
// 地区切换面板：原地重新放置所有背景模型（用当前地区模型池）
function refreshProps() {
  for (const p of props) {
    if (!p.alive || !p.mesh) continue;
    const x = p.mesh.position.x;
    placeProp(p, x, false);
  }
}


export { MODEL_FILES, gltfLoader, modelCache, props, MID_KINDS, placeProp, populateProps, PROP_EDGE, resetPropCursor, spawnPropAt, getRegionKinds, getRegionId, refreshProps };
