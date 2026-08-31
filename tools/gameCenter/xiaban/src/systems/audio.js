// 模块化重构：由 paper-theater-runner.html 拆出
// ---------- WebAudio 合成屁声（零素材） ----------
let AC = null;
let masterGain = null;   // 主音量总线（设置面板音量滑块控制）
function audioCtx() {
  if (!AC) {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = AC.createGain();
    masterGain.gain.value = 1;
    masterGain.connect(AC.destination);
  }
  if (AC.state === 'suspended') AC.resume();
  return AC;
}
// 各音效统一接入主音量总线
function getMasterGain() {
  if (!masterGain) { audioCtx(); }
  return masterGain;
}
function setVolume(v) {   // v ∈ [0,1]
  if (!masterGain) { audioCtx(); }
  masterGain.gain.value = v;
}
// 经典屁声 = 低频锯齿抖动 + 颤音 LFO + 带通滤波 + 短包络
function playFart(power = 1, volMul = 1) {
  try {
    const ac = audioCtx();
    const dur = 0.18 + Math.random() * 0.22 * power;
    const osc = ac.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 72 + Math.random() * 40;
    // 颤音 LFO：频率快速抖动 → "噗噗噗"质感
    const lfo = ac.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 26 + Math.random() * 22;
    const lfoGain = ac.createGain();
    lfoGain.gain.value = 34;
    lfo.connect(lfoGain).connect(osc.frequency);
    // 带通：闷掉高频，只留"排气"频段
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 380 + Math.random() * 260;
    bp.Q.value = 1.4;
    // 包络：快速起、抖动衰减（volMul 独立放大音量，不动音色/时长）
    const env = ac.createGain();
    env.gain.setValueAtTime(0.0001, ac.currentTime);
    env.gain.exponentialRampToValueAtTime(0.16 * power * volMul, ac.currentTime + 0.015);
    env.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
    osc.connect(bp).connect(env).connect(getMasterGain());
    osc.start(); lfo.start();
    osc.stop(ac.currentTime + dur + 0.02);
    lfo.stop(ac.currentTime + dur + 0.02);
  } catch (e) { /* 音频被拦截时静默 */ }
}
// 失禁喷射声：更长更低更湿
function playSplat() {
  try {
    const ac = audioCtx();
    const dur = 0.9;
    const osc = ac.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, ac.currentTime);
    osc.frequency.exponentialRampToValueAtTime(38, ac.currentTime + dur);   // 下滑音
    const lfo = ac.createOscillator();
    lfo.type = 'square';
    lfo.frequency.setValueAtTime(38, ac.currentTime);
    lfo.frequency.exponentialRampToValueAtTime(9, ac.currentTime + dur);
    const lfoGain = ac.createGain();
    lfoGain.gain.value = 60;
    lfo.connect(lfoGain).connect(osc.frequency);
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(520, ac.currentTime);
    bp.frequency.exponentialRampToValueAtTime(180, ac.currentTime + dur);
    bp.Q.value = 1.1;
    const env = ac.createGain();
    env.gain.setValueAtTime(0.0001, ac.currentTime);
    env.gain.exponentialRampToValueAtTime(0.3, ac.currentTime + 0.03);
    env.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
    osc.connect(bp).connect(env).connect(getMasterGain());
    osc.start(); lfo.start();
    osc.stop(ac.currentTime + dur + 0.02);
    lfo.stop(ac.currentTime + dur + 0.02);
  } catch (e) { }
}
// 肚子咕噜声（酝酿期待感）
function playGurgle() {
  try {
    const ac = audioCtx();
    const t0 = ac.currentTime;
    for (let k = 0; k < 3; k++) {
      const t = t0 + k * 0.22;
      const osc = ac.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(95 + Math.random() * 25, t);
      osc.frequency.exponentialRampToValueAtTime(58 + Math.random() * 18, t + 0.18);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.12, t + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      osc.connect(g).connect(getMasterGain());
      osc.start(t); osc.stop(t + 0.22);
    }
  } catch (e) {}
}
// 物体碎裂音效（撞可破坏物）
function playSmash() {
  try {
    const ac = audioCtx();
    const t0 = ac.currentTime;
    const dur = 0.22;
    const buf = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ac.createBufferSource();
    src.buffer = buf;
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1800, t0);
    bp.frequency.exponentialRampToValueAtTime(500, t0 + dur);
    bp.Q.value = 1.2;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.35, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(bp).connect(g).connect(getMasterGain());
    src.start(t0);
    const osc = ac.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(180, t0);
    osc.frequency.exponentialRampToValueAtTime(60, t0 + dur);
    const og = ac.createGain();
    og.gain.setValueAtTime(0.16, t0);
    og.gain.exponentialRampToValueAtTime(0.001, t0 + dur * 0.8);
    osc.connect(og).connect(getMasterGain());
    osc.start(t0); osc.stop(t0 + dur);
  } catch (e) {}
}
// 三段式演出音效：前两段（按键结算/关联词）短促弹音，最后一下（放屁结果星芒）翻倍加强
function playQtePop(vol = 0.3, slide = false) {
  try {
    const ac = audioCtx();
    const t0 = ac.currentTime;
    const dur = slide ? 0.14 : 0.08;
    // 主弹音：上扬=确认（按键结算）/ 下滑=悬念（关联词）
    const osc = ac.createOscillator();
    osc.type = 'triangle';
    if (slide) {
      osc.frequency.setValueAtTime(420, t0);
      osc.frequency.exponentialRampToValueAtTime(190, t0 + dur);
    } else {
      osc.frequency.setValueAtTime(680, t0);
      osc.frequency.exponentialRampToValueAtTime(980, t0 + dur);
    }
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(getMasterGain());
    osc.start(t0); osc.stop(t0 + dur + 0.02);
    // 翻倍档（最后一下）：叠加低频重击，增加"嘣"的冲击感
    if (vol >= 0.6) {
      const o2 = ac.createOscillator();
      o2.type = 'sine';
      o2.frequency.setValueAtTime(120, t0);
      o2.frequency.exponentialRampToValueAtTime(48, t0 + 0.18);
      const g2 = ac.createGain();
      g2.gain.setValueAtTime(0.0001, t0);
      g2.gain.exponentialRampToValueAtTime(vol * 0.8, t0 + 0.02);
      g2.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);
      o2.connect(g2).connect(getMasterGain());
      o2.start(t0); o2.stop(t0 + 0.22);
    }
  } catch (e) {}
}
// 烟花爆炸音效（腚上花火：白噪爆裂 + 低音闷响）
function playCatScream() {
  try {
    const ac = audioCtx();
    const t0 = ac.currentTime;
    const dur = 0.78;
    const osc = ac.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1450, t0);
    osc.frequency.exponentialRampToValueAtTime(520, t0 + dur);
    const wobble = ac.createOscillator();
    wobble.type = 'square';
    wobble.frequency.value = 34;
    const wobbleGain = ac.createGain();
    wobbleGain.gain.value = 210;
    wobble.connect(wobbleGain).connect(osc.frequency);
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1850;
    bp.Q.value = 2.1;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.72, t0 + 0.025);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(bp).connect(g).connect(getMasterGain());
    osc.start(t0); wobble.start(t0);
    osc.stop(t0 + dur + 0.03); wobble.stop(t0 + dur + 0.03);
  } catch (e) {}
}
function playShotgunBlast(vol = 1) {
  try {
    const ac = audioCtx();
    const t0 = ac.currentTime;
    const dur = 0.28;
    const buf = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 1.7);
    const src = ac.createBufferSource();
    src.buffer = buf;
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1800, t0);
    lp.frequency.exponentialRampToValueAtTime(420, t0 + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.72 * vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(lp).connect(g).connect(getMasterGain());
    src.start(t0);
    const thump = ac.createOscillator();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(92, t0);
    thump.frequency.exponentialRampToValueAtTime(32, t0 + 0.22);
    const tg = ac.createGain();
    tg.gain.setValueAtTime(0.0001, t0);
    tg.gain.exponentialRampToValueAtTime(0.45 * vol, t0 + 0.012);
    tg.gain.exponentialRampToValueAtTime(0.001, t0 + 0.24);
    thump.connect(tg).connect(getMasterGain());
    thump.start(t0); thump.stop(t0 + 0.25);
  } catch (e) {}
}
function playFireworkBoom() {
  try {
    const ac = audioCtx();
    const t0 = ac.currentTime;
    const dur = 0.45;
    const buf = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ac.createBufferSource();
    src.buffer = buf;
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.8;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.5, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(bp).connect(g).connect(getMasterGain());
    src.start(t0);
    const osc = ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, t0);
    osc.frequency.exponentialRampToValueAtTime(50, t0 + 0.3);
    const og = ac.createGain();
    og.gain.setValueAtTime(0.001, t0);
    og.gain.exponentialRampToValueAtTime(0.5, t0 + 0.02);
    og.gain.exponentialRampToValueAtTime(0.001, t0 + 0.32);
    osc.connect(og).connect(getMasterGain());
    osc.start(t0); osc.stop(t0 + 0.34);
  } catch (e) {}
}
// 飞机爆炸音效（击落：白噪爆裂 + 金属轰鸣下滑）
function playPlaneExplode() {
  try {
    const ac = audioCtx();
    const t0 = ac.currentTime;
    const dur = 0.6;
    const buf = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ac.createBufferSource();
    src.buffer = buf;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1500;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.6, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(lp).connect(g).connect(getMasterGain()); src.start(t0);
    const osc = ac.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, t0);
    osc.frequency.exponentialRampToValueAtTime(40, t0 + 0.5);
    const og = ac.createGain();
    og.gain.setValueAtTime(0.001, t0);
    og.gain.exponentialRampToValueAtTime(0.45, t0 + 0.02);
    og.gain.exponentialRampToValueAtTime(0.001, t0 + 0.55);
    osc.connect(og).connect(getMasterGain()); osc.start(t0); osc.stop(t0 + 0.57);
  } catch (e) {}
}
// 经验拾取音效（清脆上扬叮声）
function playExpPickup() {
  try {
    const ac = audioCtx();
    const t0 = ac.currentTime;
    const osc = ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, t0);
    osc.frequency.exponentialRampToValueAtTime(1760, t0 + 0.12);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
    osc.connect(g).connect(getMasterGain());
    osc.start(t0); osc.stop(t0 + 0.18);
    // 泛音让"叮"更亮
    const osc2 = ac.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1760, t0);
    osc2.frequency.exponentialRampToValueAtTime(3520, t0 + 0.1);
    const g2 = ac.createGain();
    g2.gain.setValueAtTime(0.0001, t0);
    g2.gain.exponentialRampToValueAtTime(0.05, t0 + 0.02);
    g2.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.13);
    osc2.connect(g2).connect(getMasterGain());
    osc2.start(t0); osc2.stop(t0 + 0.15);
  } catch (e) {}
}
// 鸟惊飞音效（短促吱喳 + 翅膀扑棱）
function playBirdScreech() {
  try {
    const ac = audioCtx();
    const t0 = ac.currentTime;
    for (let k = 0; k < 4; k++) {
      const t = t0 + k * 0.07;
      const osc = ac.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1400 + Math.random() * 400, t);
      osc.frequency.exponentialRampToValueAtTime(800, t + 0.06);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.12, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
      osc.connect(g).connect(getMasterGain());
      osc.start(t); osc.stop(t + 0.07);
    }
    const buf = ac.createBuffer(1, ac.sampleRate * 0.12, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.4;
    const src = ac.createBufferSource();
    src.buffer = buf;
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1200;
    bp.Q.value = 2;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.15, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.12);
    src.connect(bp).connect(g).connect(getMasterGain());
    src.start(t0);
  } catch (e) {}
}

export { playFart, playSplat, playGurgle, playSmash, playBirdScreech, playExpPickup, playQtePop, playCatScream, playShotgunBlast, playFireworkBoom, playPlaneExplode, setVolume };
