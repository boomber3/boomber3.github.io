// 模块化重构：由 paper-theater-runner.html 拆出
import * as THREE from 'three';

// ---------- 纸纹 & 纹理工厂 ----------
function paperTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  // 纸张颗粒：稀疏噪点，让色块不那么"数字"
  const n = (w * h) / 240;
  for (let i = 0; i < n; i++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.045)' : 'rgba(255,255,255,0.05)';
    g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
// 纸片材质：cutout 硬边（无透明排序问题）+ 双面（翻页时能看到背面）
function paperMat(tex) {
  return new THREE.MeshBasicMaterial({
    map: tex, transparent: false, alphaTest: 0.35,
    side: THREE.DoubleSide, fog: true,
  });
}

export { paperTexture, paperMat, roundRect };
