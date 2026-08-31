import { CONFIG } from '../config.js';
import { $debug } from '../utils/dom.js';
import { syncQteSpeed } from '../systems/fart-qte.js';
import { currentLang, onLanguageChange, t } from '../i18n.js';

const text = (zh, en) => ({ zh, en });
const local = value => typeof value === 'string' ? value : value[currentLang()] || value.zh;

const TUNE = {
  qte: {
    label: text('放屁 QTE', 'Fart QTE'),
    params: {
      speed:         { label: text('指针速度', 'Pointer Speed'), min: 0.05, max: 0.5, step: 0.01 },
      speedMin:      { label: text('速度下限', 'Speed Floor'), min: 0.05, max: 0.3, step: 0.01 },
      speedSlow:     { label: text('底部速度倍率', 'Bottom Speed'), min: 0.1, max: 1.5, step: 0.05 },
      speedFast:     { label: text('顶部速度倍率', 'Top Speed'), min: 1, max: 4, step: 0.1 },
      speedCurveExp: { label: text('速度曲线指数', 'Speed Curve'), min: 0.5, max: 5, step: 0.1 },
      normalInc:     { label: text('单次风险累积', 'Risk Per Fart'), min: 0, max: 0.02, step: 0.0005 },
      riskFactor:    { label: text('窜稀风险系数', 'Blowout Risk'), min: 0, max: 50, step: 1 },
      rapidInc:      { label: text('连放风险累积', 'Spam Risk'), min: 0, max: 0.03, step: 0.001 },
      rapidWindow:   { label: text('连放判定窗口', 'Spam Window'), min: 0.5, max: 3, step: 0.1 },
      cumRiskCap:    { label: text('累积风险上限', 'Risk Cap'), min: 0, max: 0.3, step: 0.01 },
      holdAt:        { label: text('憋屁减速起点', 'Hold Slow Start'), min: 0, max: 1, step: 0.05 },
      holdSlope:     { label: text('憋屁减速斜率', 'Hold Slow Slope'), min: 0, max: 3, step: 0.1 },
      poolK:         { label: text('抽取陡峭度', 'Roll Sharpness'), min: 0, max: 8, step: 0.5 },
      layoutMode:    { label: text('布局 0固定/1随机', 'Layout 0/1'), min: 0, max: 1, step: 1 },
      speedRoundMul: { label: text('每往返提速', 'Lap Speed Up'), min: 1, max: 2, step: 0.05 },
      expBase:       { label: text('首级所需排气', 'XP Base'), min: 1, max: 40, step: 1 },
      expGrowth:     { label: text('每级额外基础', 'XP Growth'), min: 0, max: 10, step: 0.5 },
      expPow:        { label: text('升级曲线幂', 'XP Curve'), min: 0.3, max: 2, step: 0.05 },
    },
  },
  fart: {
    label: text('放屁推力', 'Fart Thrust'),
    params: {
      power:    { label: text('单次冲力', 'Push Power'), min: 0, max: 3, step: 0.05 },
      boost:    { label: text('推力时长', 'Boost Time'), min: 0, max: 2, step: 0.05 },
      boostMul: { label: text('推力加成', 'Boost Mult'), min: 1, max: 12, step: 0.5 },
      speedCap: { label: text('速度上限', 'Speed Cap'), min: 5, max: 20, step: 0.5 },
    },
  },
  run: {
    label: text('奔跑 / 终点', 'Run / Finish'),
    params: {
      base:   { label: text('基础速度', 'Base Speed'), min: 2, max: 10, step: 0.1 },
      max:    { label: text('自然上限', 'Natural Cap'), min: 4, max: 15, step: 0.1 },
      ramp:   { label: text('加速速率', 'Ramp Rate'), min: 0, max: 0.2, step: 0.005 },
      smooth: { label: text('平滑系数', 'Smoothing'), min: 0.5, max: 5, step: 0.1 },
      lives:  { label: text('喷射容量', 'Capacity'), min: 1, max: 10, step: 1 },
    },
  },
  launch: {
    label: text('失禁喷射', 'Blowout Launch'),
    params: {
      vx:            { label: text('一段水平推力', 'Stage 1 X'), min: 2, max: 15, step: 0.5 },
      vy:            { label: text('一段垂直推力', 'Stage 1 Y'), min: 3, max: 18, step: 0.5 },
      vx2:           { label: text('二段水平推力', 'Stage 2 X'), min: 0, max: 10, step: 0.5 },
      vy2:           { label: text('二段垂直推力', 'Stage 2 Y'), min: 0, max: 10, step: 0.5 },
      delay1:        { label: text('一段延时(ms)', 'Stage 1 Delay'), min: 100, max: 1500, step: 10 },
      delay2:        { label: text('二段延时(ms)', 'Stage 2 Delay'), min: 100, max: 2000, step: 10 },
      gravityMul:    { label: text('重力倍率', 'Gravity Mult'), min: 0.3, max: 1.5, step: 0.05 },
      landT:         { label: text('落地判定时间', 'Landing Time'), min: 0.2, max: 2, step: 0.1 },
      flyDrag:       { label: text('水平衰减率', 'Air Drag'), min: 0.1, max: 3, step: 0.1 },
      bounceElastic: { label: text('弹力系数', 'Bounce'), min: 0.1, max: 0.9, step: 0.05 },
      bounceStop:    { label: text('停止速度', 'Stop Speed'), min: 0.1, max: 2, step: 0.1 },
      restTime:      { label: text('静止谢幕时长', 'Curtain Wait'), min: 0.5, max: 6, step: 0.1 },
    },
  },
  fartFx: {
    label: text('屁云特效', 'Fart FX'),
    params: {
      scaleMul: { label: text('粒子大小', 'Particle Size'), min: 0.3, max: 8, step: 0.1 },
      count:    { label: text('粒子数量', 'Particle Count'), min: 1, max: 30, step: 1 },
      contRate: { label: text('持续喷屁速率', 'Trail Rate'), min: 0, max: 60, step: 1 },
    },
  },
  poopFx: {
    label: text('屎特效', 'Poop FX'),
    params: {
      burst:      { label: text('初始喷屎数', 'Burst Count'), min: 5, max: 120, step: 1 },
      burstScale: { label: text('初始大小', 'Burst Size'), min: 0, max: 5, step: 0.1, arr: true },
      contRate:   { label: text('持续拉取速率', 'Stream Rate'), min: 0, max: 80, step: 1 },
      contScale:  { label: text('持续大小', 'Stream Size'), min: 0, max: 5, step: 0.1, arr: true },
    },
  },
  shake: {
    label: text('屏幕震动', 'Screen Shake'),
    params: {
      amp:      { label: text('抖动幅度', 'Shake Amp'), min: 0, max: 0.5, step: 0.01 },
      decay:    { label: text('衰减速率', 'Shake Decay'), min: 0.5, max: 6, step: 0.1 },
      dirAmp:   { label: text('方向震动幅度', 'Directional Amp'), min: 0, max: 1.5, step: 0.05 },
      dirDecay: { label: text('方向衰减', 'Directional Decay'), min: 0.5, max: 8, step: 0.1 },
    },
  },
  birds: {
    label: text('飞鸟', 'Birds'),
    params: {
      count:    { label: text('飞鸟数量', 'Bird Count'), min: 1, max: 6, step: 1 },
      speedMin: { label: text('最慢速度', 'Min Speed'), min: 0.5, max: 3, step: 0.1 },
      speedMax: { label: text('最快速度', 'Max Speed'), min: 1, max: 5, step: 0.1 },
      yMin:     { label: text('最低高度', 'Min Height'), min: 0.5, max: 4, step: 0.1 },
      yMax:     { label: text('最高高度', 'Max Height'), min: 1, max: 5, step: 0.1 },
    },
  },
  breakables: {
    label: text('可破坏物', 'Breakables'),
    params: {
      gap:   { label: text('间隔基准', 'Gap Base'), min: 1, max: 20, step: 1 },
      xp:    { label: text('经验值', 'XP Value'), min: 1, max: 10, step: 1 },
      range: { label: text('触发范围', 'Hit Range'), min: 0.4, max: 2.5, step: 0.1 },
      y:     { label: text('位置高度', 'Height'), min: 0.2, max: 1.5, step: 0.05 },
    },
  },
};

function fmtTune(v) {
  const r = Math.round(v * 1000) / 1000;
  return String(r);
}

function makeSliderRow(label, min, max, step, val, onSet) {
  const row = document.createElement('label');
  row.className = 'dbg-row';
  const name = document.createElement('span');
  name.className = 'dbg-name';
  name.textContent = label;
  const valEl = document.createElement('span');
  valEl.className = 'dbg-val';
  valEl.textContent = fmtTune(val);
  const input = document.createElement('input');
  input.type = 'range';
  input.min = min;
  input.max = max;
  input.step = step;
  input.value = val;
  input.addEventListener('input', () => {
    const v = Number(input.value);
    valEl.textContent = fmtTune(v);
    onSet(v);
  });
  row.append(name, valEl, input);
  return row;
}

function buildDebugPanel() {
  $debug.innerHTML = '';
  const hint = document.createElement('div');
  hint.className = 'dbg-hint';
  hint.textContent = t('debugHint');
  $debug.appendChild(hint);

  for (const [key, cfg] of Object.entries(TUNE)) {
    const group = CONFIG[key];
    if (!group) continue;
    const gdiv = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'dbg-title';
    title.textContent = local(cfg.label);
    gdiv.appendChild(title);
    for (const [k, pc] of Object.entries(cfg.params)) {
      if (pc.arr) {
        const raw = group[k];
        if (!Array.isArray(raw)) continue;
        for (let i = 0; i < 2; i++) {
          const suffix = i === 0 ? t('debugMin') : t('debugMax');
          gdiv.appendChild(makeSliderRow(`${local(pc.label)} ${suffix}`, pc.min, pc.max, pc.step, raw[i], v => { group[k][i] = v; }));
        }
      } else {
        gdiv.appendChild(makeSliderRow(local(pc.label), pc.min, pc.max, pc.step, group[k], v => {
          group[k] = v;
          if (key === 'qte' && k === 'speed') syncQteSpeed();
        }));
      }
    }
    $debug.appendChild(gdiv);
  }
}

buildDebugPanel();
onLanguageChange(buildDebugPanel);
