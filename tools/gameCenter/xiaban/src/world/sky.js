// 模块化重构：由 paper-theater-runner.html 拆出
import * as THREE from 'three';
import { scene } from '../core/engine.js';
import { paperTexture, paperMat } from './textures.js';

// ---------- 天空 & 远景（按地区 3 套，交界处交叉淡化） ----------
// 天空渐变配色
const SKY_COLORS = {
  town: ['#8a6a9e', '#ffb98a', '#ffe9c4', '#f0c8a0', '#d8a878'],   // 暮霭紫→橙→奶油（现状）
  city: ['#5a6b80', '#8fa6bc', '#d8e2ea', '#c8d4e0', '#b0bfce'],   // 灰蓝都市
  wild: ['#7fa87f', '#b8d8a8', '#e6f2d8', '#d0e4c0', '#b8d0a8'],   // 森林绿
};
function makeSky(colors) {
  const tex = paperTexture(64, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0.00, colors[0]);
    gr.addColorStop(0.13, colors[1]);
    gr.addColorStop(0.375, colors[2]);
    gr.addColorStop(0.55, colors[3]);
    gr.addColorStop(1.00, colors[4]);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(220, 240),
    new THREE.MeshBasicMaterial({ map: tex, fog: false, transparent: true, depthWrite: false })
  );
  m.position.set(0, -30, -60);
  m.material.opacity = 0;
  scene.add(m);
  return m;
}
// 山体纹理（base 主色 / dark 暗面）
function mountainTex(base, dark) {
  return paperTexture(1024, 512, (g, w, h) => {
    const hTop = h * 0.5;
    g.fillStyle = base;
    g.beginPath(); g.moveTo(0, h);
    const peaks = 7;
    for (let i = 0; i <= peaks; i++) {
      const px = (i / peaks) * w;
      const py = hTop - 60 - Math.abs(Math.sin(i * 2.3 + peaks)) * 130 - (i % 2) * 25;
      if (i === 0) g.lineTo(px, py); else g.quadraticCurveTo(px - w / peaks / 2, py + 40, px, py);
    }
    g.lineTo(w, h); g.closePath(); g.fill();
    g.fillStyle = dark;
    g.beginPath(); g.moveTo(w * 0.3, hTop);
    g.lineTo(w * 0.52, hTop - 175); g.lineTo(w * 0.66, hTop - 120); g.lineTo(w * 0.8, hTop);
    g.closePath(); g.fill();
    g.fillStyle = dark;
    g.beginPath(); g.moveTo(0, h);
    const peaks2 = 9;
    for (let i = 0; i <= peaks2; i++) {
      const px = (i / peaks2) * w;
      const py = h * 0.70 - Math.abs(Math.sin(i * 1.7 + 1.3)) * (h * 0.16) - (i % 2) * (h * 0.03);
      if (i === 0) g.lineTo(px, py); else g.quadraticCurveTo(px - w / peaks2 / 2, py + h * 0.05, px, py);
    }
    g.lineTo(w, h); g.closePath(); g.fill();
  });
}
function makeMountains(z, y, height, base, dark, texWorldLen) {
  const t = mountainTex(base, dark);
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.set(220 / texWorldLen, 1);
  t.needsUpdate = true;
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(220, height),
    new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.3, fog: true, side: THREE.DoubleSide, depthWrite: false })
  );
  m.position.set(0, y, z);
  m.material.opacity = 0;
  scene.add(m);
  return { mesh: m, tex: t, texWorldLen };
}
// 三套地区背景
const REGION_SKY = {
  town: {
    sky: makeSky(SKY_COLORS.town),
    far: makeMountains(-44, -0.5, 34, '#e5a9b4', '#d699a8', 52),
    near: makeMountains(-34, -1.5, 30, '#c98fa4', '#b97e96', 46),
  },
  city: {
    sky: makeSky(SKY_COLORS.city),
    far: makeMountains(-44, -0.5, 34, '#8fa4b8', '#7a8fa8', 52),
    near: makeMountains(-34, -1.5, 30, '#7a8fa8', '#6b7f99', 46),
  },
  wild: {
    sky: makeSky(SKY_COLORS.wild),
    far: makeMountains(-44, -0.5, 34, '#7fa87f', '#6b966b', 52),
    near: makeMountains(-34, -1.5, 30, '#6b966b', '#5a855a', 46),
  },
};

// 太阳（光晕盘，不受雾影响）
const sunTex = paperTexture(256, 256, (g, w, h) => {
  const cx = w / 2, cy = h / 2;
  const halo = g.createRadialGradient(cx, cy, 10, cx, cy, w / 2);
  halo.addColorStop(0, 'rgba(255,236,190,0.95)');
  halo.addColorStop(0.35, 'rgba(255,210,140,0.55)');
  halo.addColorStop(1, 'rgba(255,200,130,0)');
  g.fillStyle = halo; g.fillRect(0, 0, w, h);
  g.fillStyle = '#ffe2a8';
  g.beginPath(); g.arc(cx, cy, 46, 0, 7); g.fill();
});
const sun = new THREE.Mesh(
  new THREE.PlaneGeometry(11, 11),
  new THREE.MeshBasicMaterial({ map: sunTex, transparent: true, depthWrite: false, fog: false })
);
sun.position.set(7.5, 9.5, -56);
scene.add(sun);

// 云（实体纸片，自漂 + 世界推进）
const cloudTex = paperTexture(256, 128, (g, w, h) => {
  g.fillStyle = '#fff2e2';
  const lobes = [[70, 78, 34], [118, 62, 44], [172, 76, 36], [214, 86, 26], [104, 92, 30], [160, 94, 28]];
  for (const [x, y, r] of lobes) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
  g.fillStyle = '#ffdec6';
  g.beginPath(); g.arc(118, 100, 42, 0, Math.PI); g.fill();
});
const clouds = [];
for (let i = 0; i < 5; i++) {
  const s = 2.2 + Math.random() * 2.4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s * 0.5), paperMat(cloudTex));
  m.position.set(-28 + i * 14 + Math.random() * 8, 6.5 + Math.random() * 4, -36 - Math.random() * 8);
  scene.add(m);
  clouds.push({ mesh: m, drift: 0.25 + Math.random() * 0.3 });
}

export { REGION_SKY, sun, clouds };