// UI 层彩带效果：选中道具时从卡片中心向四周爆发（像素风硬边小方块 + 细条）
const layer = document.createElement('div');
layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:35;overflow:hidden;';
document.body.appendChild(layer);

const COLORS = ['#ffd98a', '#e8a0b0', '#8fbd7c', '#f6e8cf', '#7ab8ff', '#ff9d5c'];

// 从屏幕坐标 (x, y) 爆发 n 片彩带，向四周飞散 + 重力坠落 + 旋转
function burstUIConfetti(x, y, n = 24, power = 1) {
  for (let i = 0; i < n; i++) {
    const p = document.createElement('div');
    const w = 8 + Math.random() * 8;
    const h = 4 + Math.random() * 6;
    const color = COLORS[(Math.random() * COLORS.length) | 0];
    p.style.cssText = [
      'position:absolute;left:' + x + 'px;top:' + y + 'px;',
      'width:' + w + 'px;height:' + h + 'px;',
      'background:' + color + ';',
      'border:2px solid #1a0e18;',
      'box-shadow:2px 2px 0 rgba(20,8,16,.35);',
      'pointer-events:none;',
    ].join('');
    // 随机散开角度 + 力度 + 旋转方向
    const ang = Math.random() * Math.PI * 2;
    const dist = (60 + Math.random() * 180) * power;
    const dx = Math.cos(ang) * dist;
    const dy = Math.sin(ang) * dist - 90;          // 略向上扬再下坠
    const rot = (Math.random() - 0.5) * 720;
    p.animate([
      { transform: 'translate(-50%,-50%) translate(0,0) rotate(0)', opacity: 1 },
      { transform: 'translate(-50%,-50%) translate(' + dx + 'px,' + dy + 'px) rotate(' + rot + 'deg)', opacity: 1, offset: .6 },
      { transform: 'translate(-50%,-50%) translate(' + dx * 1.2 + 'px,' + (dy + 120) + 'px) rotate(' + rot * 1.4 + 'deg)', opacity: 0 },
    ], { duration: 800 + Math.random() * 500, easing: 'cubic-bezier(.2,.7,.4,1)' }).onfinish = () => p.remove();
    layer.appendChild(p);
  }
}

export { burstUIConfetti };