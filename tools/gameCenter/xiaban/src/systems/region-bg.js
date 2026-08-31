// 地区背景：按地区进度交叉淡化天空/远山/近山，并插值雾色/背景色/地面色调
import * as THREE from 'three';
import { scene } from '../core/engine.js';
import { REGION_SKY } from '../world/sky.js';
import { ground } from '../world/stage.js';
import { CONFIG } from '../config.js';

// 各地区主题：雾色 / 背景色 / 地面 tint
const THEMES = {
  town: { fog: 0xffd9ac, bg: 0xffd9ac, ground: 0xffffff },
  city: { fog: 0xc8d4e0, bg: 0xc8d4e0, ground: 0x9aa8b5 },
  wild: { fog: 0xd8e8c8, bg: 0xd8e8c8, ground: 0x8fae6a },
};
const _c1 = new THREE.Color(), _c2 = new THREE.Color();

// 地区交叉淡化比例：返回 { from, to, t }（边界 fade 区内 from→to 插值）
function regionBlend(dist) {
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
      if (inRegion > d - R.fade) {
        const t = Math.min(1, (inRegion - (d - R.fade)) / R.fade);
        return { from: id, to: order[(i + 1) % order.length], t };
      }
      return { from: id, to: null, t: 0 };
    }
    acc += d;
  }
  return { from: order[0], to: null, t: 0 };
}
function setGroupOpacity(g, op) {
  g.sky.material.opacity = op;
  g.far.mesh.material.opacity = op;
  g.near.mesh.material.opacity = op;
}
function hexLerp(a, b, t, out) {
  out.setHex(a).lerp(_c2.setHex(b), t);
}
function updateRegionBackground(dist) {
  const b = regionBlend(dist);
  const order = CONFIG.regions.order;
  for (const id of order) {
    let op = b.from === id ? 1 : 0;
    if (b.to && b.to === id) op = b.t;
    else if (b.from === id && b.to) op = 1 - b.t;
    setGroupOpacity(REGION_SKY[id], op);
  }
  const from = THEMES[b.from] || THEMES[order[0]];
  const to = b.to ? (THEMES[b.to] || from) : from;
  const t = b.t;
  hexLerp(from.fog, to.fog, t, scene.fog.color);
  hexLerp(from.bg, to.bg, t, scene.background);
  hexLerp(from.ground, to.ground, t, ground.material.color);
}

export { updateRegionBackground, regionBlend };