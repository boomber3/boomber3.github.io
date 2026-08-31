// 模块化重构：由 paper-theater-runner.html 拆出
import { CONFIG } from '../config.js';
import { state } from '../core/state.js';
import { applyCurrentEventMultipliers } from './event.js';
import { currentLang } from '../i18n.js';

const ITEM_QUALITY = {
  normal: { key: 'normal', name: '普通', color: '#9fb0c0', text: '#3a5266', mul: 1.0, width: 0.40, weight: 0.50 },
  fine:   { key: 'fine',   name: '优质', color: '#5fd0a0', text: '#1d5c44', mul: 1.6, width: 0.27, weight: 0.35 },
  rare:   { key: 'rare',   name: '罕见', color: '#e8b54a', text: '#7a5200', mul: 2.5, width: 0.16, weight: 0.15 },
};

// ---------- 升级道具池（通过升级 QTE 获得，单局 Build 主要来源） ----------
const ITEMS = [
  // ============ 基础强化型 ============
  {
    id: 'zhixie', name: '止泻药', icon: 'assets/items/zhixie.png', type: '基础强化型',
    flavor: '「说明书上说，一天最多三次。」',
    effect: '降低每次正常放屁后产生的窜稀概率增长。',
    qDesc: { normal: '小量降低窜稀概率增长', fine: '中量降低窜稀概率增长', rare: '大量降低窜稀概率增长' },
    repeat: '效果继续叠加，但存在边际递减。',
    build: '稳定 / 高频放屁',
    apply: { riskIncMul: 0.75 }
  },
  {
    id: 'cheese', name: '一大块奶酪', icon: 'assets/items/cheese.png', type: '基础强化型',
    flavor: '「大自然的软木塞。」',
    effect: '获得时立即降低当前已经积累的窜稀概率。',
    qDesc: { normal: '小量降低当前窜稀概率', fine: '中量降低当前窜稀概率', rare: '大量降低当前窜稀概率' },
    repeat: '每次获得时立即生效，喷射概率最低降至基础下限。',
    build: '稳定 / 风险控制',
    apply: { cheeseReduce: 0.02 }
  },
  {
    id: 'protein', name: '蛋白粉', icon: 'assets/items/protein.png', type: '基础强化型',
    flavor: '「30克蛋白质。没人提过屁的事。」',
    effect: '提高所有屁道具已有的喷气力度。',
    qDesc: { normal: '小量提高喷气力度', fine: '中量提高喷气力度', rare: '大量提高喷气力度' },
    repeat: '横向推进加成继续叠加。',
    build: '横向推进 / 高速移动',
    apply: { hForce: 1.09 }
  },
  {
    id: 'helium', name: '氦气气球', icon: 'assets/items/helium.png', type: '基础强化型',
    flavor: '「警告：请勿吸入。也没说不能从另一头出来。」',
    effect: '提高所有屁道具已有的喷气高度。',
    qDesc: { normal: '小量提高喷气高度', fine: '中量提高喷气高度', rare: '大量提高喷气高度' },
    repeat: '纵向推进加成继续叠加。',
    build: '纵向推进 / 滞空',
    apply: { vForce: 1.1 }
  },
  // ============ 特殊机制型 ============
  {
    id: 'capsule', name: '缓释排气胶囊', icon: 'assets/items/capsule.png', type: '特殊机制型',
    flavor: '「一次服用，持续释放。」',
    effect: '正常执行屁道具后，短暂延迟追加一次额外排气推进。',
    qDesc: { normal: '追加1次弱排气', fine: '追加1次标准排气', rare: '追加1次强力排气' },
    repeat: '每多持有1个，追加排气次数增加。',
    build: '多段排气 / 连环屁',
    apply: { capsulePower: 1 }
  },
  {
    id: 'kaiselu', name: '开塞露', icon: 'assets/items/kaiselu.png', type: '特殊机制型 / 双刃剑型',
    flavor: '「请在必要的时候使用。」',
    effect: 'QTE命中「好」或「极好」品质时提高本次屁道具已有的推进效果；本次正常放屁结束后额外增加窜稀概率。',
    qDesc: { normal: '小量强化高品质屁，增加窜稀概率', fine: '中量强化高品质屁，增加窜稀概率', rare: '大量强化高品质屁，增加窜稀概率' },
    repeat: '推进强化与额外风险增长继续叠加。',
    build: '高品质 / 高风险 / 爆发推进',
    apply: { kaiSaiLu: 1.1 }
  },
  {
    id: 'nasa', name: 'NASA级吸收内衬', icon: 'assets/items/nasa.png', type: '特殊机制型 / 容错型',
    flavor: '「意外发生了，但事故没有。」',
    effect: '发生喷射事故时，有概率免疫窜稀伤害（不消耗喷射容量）。',
    qDesc: { normal: '较低概率免疫窜稀伤害', fine: '中等概率免疫窜稀伤害', rare: '较高概率免疫窜稀伤害' },
    repeat: '触发概率继续提高，但存在上限。',
    build: '喷射容错 / 高风险',
    apply: { absorbChance: 0.25 }
  },
  {
    id: 'booster', name: '蓄气增压阀', icon: 'assets/items/booster.png', type: '特殊机制型',
    flavor: '「只要别漏，一切都会越来越顺。」',
    effect: '每次正常完成放屁且未发生喷射事故时获得1层「增压」，每层提高后续屁道具的喷气力度；事故后清空。',
    qDesc: { normal: '每层小量提高喷气力度', fine: '每层中量提高喷气力度', rare: '每层大量提高喷气力度' },
    repeat: '每层提供的推进效果继续提高。',
    build: '连续成功 / 横向推进 / 高风险',
    apply: { boostHF: 0.03 }
  },
  {
    id: 'tank', name: '高压气罐', icon: 'assets/items/tank.png', type: '特殊机制型',
    flavor: '「压力总得有个出口。」',
    effect: '每次正常完成放屁后获得1层「蓄压」。下一次QTE获得「好」或「极好」品质屁道具时，消耗全部蓄压强化该屁道具的推进效果。',
    qDesc: { normal: '每层小量强化高品质屁', fine: '每层中量强化高品质屁', rare: '每层大量强化高品质屁' },
    repeat: '每层提供的推进强化继续提高。',
    build: '蓄压 / 高品质 / 爆发推进',
    apply: { chargeHF: 0.06 }
  },
  {
    id: 'gauge', name: '压力表', icon: 'assets/items/gauge.png', type: '特殊机制型',
    flavor: '「红色区域通常不是装饰。」',
    effect: '当前窜稀概率达到高风险状态后，提高所有屁道具已有的喷气力度。',
    qDesc: { normal: '高风险时小量提高喷气力度', fine: '高风险时中量提高喷气力度', rare: '高风险时大量提高喷气力度' },
    repeat: '高风险状态下的推进加成继续叠加。',
    build: '高风险 / 横向推进 / 赌博',
    apply: { highRiskHF: 1.1 }
  },
  {
    id: 'lowvalve', name: '低压阀', icon: 'assets/items/lowvalve.png', type: '特殊机制型',
    flavor: '「压力小的时候，什么都好说。」',
    effect: '当前窜稀概率处于低风险状态时，正常放屁产生的窜稀概率增长进一步降低。',
    qDesc: { normal: '低风险时小量降低窜稀概率增长', fine: '低风险时中量降低窜稀概率增长', rare: '低风险时大量降低窜稀概率增长' },
    repeat: '低风险状态下的减免继续提高。',
    build: '低风险 / 稳定 / 高频放屁',
    apply: { lowRiskReduce: 0.85 }
  },
  {
    id: 'relief', name: '压力释放阀', icon: 'assets/items/relief.png', type: '特殊机制型',
    flavor: '「出了事，至少压力没了。」',
    effect: '每次发生普通喷射事故后，额外降低当前窜稀概率。',
    qDesc: { normal: '小量额外降低窜稀概率', fine: '中量额外降低窜稀概率', rare: '大量额外降低窜稀概率' },
    repeat: '喷射事故后的风险释放效果继续提高。',
    build: '风险循环 / 喷射容错',
    apply: { riskRelease: 0.02 }
  },
  {
    id: 'metronome', name: '节拍器', icon: 'assets/items/metronome.png', type: '特殊机制型',
    flavor: '「保持节奏。尤其是下面的。」',
    effect: '连续命中相同品质的QTE区域时获得1层「节奏」，每层提高屁道具已有的喷气力度；命中其他品质后清空。',
    qDesc: { normal: '每层小量提高喷气力度', fine: '每层中量提高喷气力度', rare: '每层大量提高喷气力度' },
    repeat: '每层提供的收益继续提高。',
    build: 'QTE技术 / 连续操作 / 推进',
    apply: { rhythmHF: 0.04 }
  },
  {
    id: 'manual', name: '安全操作手册', icon: 'assets/items/manual.png', type: '特殊机制型',
    flavor: '「严格按照操作流程，理论上不会出事。」',
    effect: '连续命中「一般」品质区域时获得1层「规范操作」，每层降低后续正常放屁产生的窜稀概率增长；命中其他品质后清空。',
    qDesc: { normal: '每层小量降低窜稀概率增长', fine: '每层中量降低窜稀概率增长', rare: '每层大量降低窜稀概率增长' },
    repeat: '每层提供的风险减免继续提高。',
    build: '一般品质 / 稳定 / 高频放屁',
    apply: { safeReduce: 0.12 }
  },
  // ============ 双刃剑型 ============
  {
    id: 'xplug', name: 'X塞', icon: 'assets/items/xplug.png', type: '双刃剑型',
    flavor: '「至少出口暂时堵住了。」',
    effect: '大幅降低每次正常放屁产生的窜稀概率增长，但同时降低所有屁道具已有的喷气力度。',
    qDesc: { normal: '中量降低窜稀概率增长', fine: '大量降低窜稀概率增长', rare: '极大量降低窜稀概率增长' },
    repeat: '风险降低与横向推进削弱均继续叠加。',
    build: '稳定 / 高频放屁 / 低速',
    apply: { riskIncMul: 0.55, hForce: 0.88 }
  },
  {
    id: 'coffee', name: '黑咖啡', icon: 'assets/items/coffee.png', type: '双刃剑型',
    flavor: '「提神醒脑，也包括你的肠子。」',
    effect: '提高角色基础奔跑速度，同时提高放屁QTE Bar的上下移动速度。',
    qDesc: { normal: '小量提高奔跑速度', fine: '中量提高奔跑速度', rare: '大量提高奔跑速度' },
    repeat: '奔跑速度与QTE Bar移动速度继续提高，QTE Bar速度存在上限。',
    build: '极速 / QTE技术 / 高风险',
    apply: { speedMul: 1.15, qteMul: 0.85 }
  },
  {
    id: 'fountain', name: '喷泉喷头', icon: 'assets/items/fountain.png', type: '双刃剑型',
    flavor: '「安装方向可能有点问题。」',
    effect: '提高所有屁道具已有的喷气高度，同时降低已有的喷气力度。',
    qDesc: { normal: '中量提高喷气高度', fine: '大量提高喷气高度', rare: '极大量提高喷气高度' },
    repeat: '纵向强化与横向削弱继续叠加。',
    build: '飞天 / 滞空 / 多段排气',
    apply: { vForce: 1.25, hForce: 0.9 }
  },
  {
    id: 'powder', name: '婴儿爽身粉', icon: 'assets/items/powder.png', type: '双刃剑型',
    flavor: '「干爽、舒适、请勿深究原理。」',
    effect: '扩大放屁QTE中「好」与「极好」区域的判定宽度，同时压缩「一般」区域。',
    qDesc: { normal: '小量扩大高品质判定区域', fine: '中量扩大', rare: '大量扩大' },
    repeat: '区域调整效果继续叠加，但所有品质区域均保留最小判定宽度。',
    build: '高品质 / QTE / 赌博',
    apply: { qteAreaMul: 1.15 }
  },
];

// ---------- 一次性道具池（不进入升级池，无品质，获得后立即生效） ----------
const ONETIME_ITEMS = [
  {
    id: 'underwear', name: '备用内裤', icon: 'assets/items/underwear.png', type: '一次性道具 / 恢复型',
    flavor: '「第二次机会。至少对这条裤子来说。」',
    effect: '获得后立即回复 1 点喷射容量，不能超过当前喷射容量上限。',
    oneTime: 'lives',
  },
  {
    id: 'diaper', name: '成人纸尿裤', icon: 'assets/items/diaper.png', type: '一次性道具 / 保护型',
    flavor: '「至少这次还有这东西帮你兜着。」',
    effect: '获得 1 次临时保护。下一次窜稀事故由纸尿裤抵消，不消耗喷射容量。',
    oneTime: 'protect',
  },
];

const QUALITY_EN = {
  normal: 'Common',
  fine: 'Good',
  rare: 'Rare',
};

const ITEM_EN = {
  zhixie: {
    name: 'Anti-Rumble Pills',
    type: 'Basic / Stability',
    flavor: '"The label says three a day max."',
    effect: 'Reduces how much blowout chance rises after a clean fart.',
    qDesc: { normal: 'Slightly slows blowout buildup', fine: 'Moderately slows blowout buildup', rare: 'Greatly slows blowout buildup' },
    repeat: 'Stacks with diminishing returns.',
  },
  cheese: {
    name: 'Big Block of Cheese',
    type: 'Basic / Risk Control',
    flavor: '"Nature\'s soft cork."',
    effect: 'Immediately lowers your current built-up blowout chance.',
    qDesc: { normal: 'Slightly lowers current blowout chance', fine: 'Moderately lowers current blowout chance', rare: 'Greatly lowers current blowout chance' },
    repeat: 'Triggers each time you get it. Risk cannot drop below the base floor.',
  },
  protein: {
    name: 'Protein Powder',
    type: 'Basic / Thrust',
    flavor: '"30 grams of protein. Nobody mentioned the gas."',
    effect: 'Increases the thrust of all fart items you already have.',
    qDesc: { normal: 'Slightly boosts thrust', fine: 'Moderately boosts thrust', rare: 'Greatly boosts thrust' },
    repeat: 'Horizontal thrust bonus keeps stacking.',
  },
  helium: {
    name: 'Helium Balloon',
    type: 'Basic / Air Time',
    flavor: '"Warning: do not inhale. Nobody said anything about the other end."',
    effect: 'Increases lift from all fart items you already have.',
    qDesc: { normal: 'Slightly boosts lift', fine: 'Moderately boosts lift', rare: 'Greatly boosts lift' },
    repeat: 'Vertical lift bonus keeps stacking.',
  },
  capsule: {
    name: 'Slow-Release Gas Capsule',
    type: 'Special / Combo Farts',
    flavor: '"One dose. Extended release."',
    effect: 'After a clean fart item resolves, adds a delayed extra push.',
    qDesc: { normal: 'Adds 1 weak follow-up puff', fine: 'Adds 1 standard follow-up puff', rare: 'Adds 1 strong follow-up puff' },
    repeat: 'More copies add more follow-up puffs.',
  },
  kaiselu: {
    name: 'Emergency Laxative',
    type: 'Special / Double-Edged',
    flavor: '"Use only when necessary."',
    effect: 'Good or great QTE hits boost this fart item, but add extra blowout buildup afterward.',
    qDesc: { normal: 'Small boost to good hits, with extra risk', fine: 'Medium boost to good hits, with extra risk', rare: 'Large boost to good hits, with extra risk' },
    repeat: 'Both boost and added risk keep stacking.',
  },
  nasa: {
    name: 'NASA-Grade Absorbent Briefs',
    type: 'Special / Safety Net',
    flavor: '"Something happened. Technically, an incident did not."',
    effect: 'Has a chance to block blowout damage without spending capacity.',
    qDesc: { normal: 'Low chance to block blowout damage', fine: 'Medium chance to block blowout damage', rare: 'High chance to block blowout damage' },
    repeat: 'Block chance increases, up to a cap.',
  },
  booster: {
    name: 'Pressure Booster Valve',
    type: 'Special / Streak',
    flavor: '"As long as it does not leak, everything gets smoother."',
    effect: 'Clean fart completions build Pressure stacks. Each stack improves later thrust. Incidents clear stacks.',
    qDesc: { normal: 'Small thrust per stack', fine: 'Medium thrust per stack', rare: 'Large thrust per stack' },
    repeat: 'Each stack gives stronger thrust.',
  },
  tank: {
    name: 'High-Pressure Gas Tank',
    type: 'Special / Charged Hit',
    flavor: '"Pressure always wants an exit."',
    effect: 'Clean fart completions build Charge. Your next good or great QTE spends all Charge to boost that item.',
    qDesc: { normal: 'Small boost per Charge stack', fine: 'Medium boost per Charge stack', rare: 'Large boost per Charge stack' },
    repeat: 'Charge boost keeps improving.',
  },
  gauge: {
    name: 'Pressure Gauge',
    type: 'Special / High Risk',
    flavor: '"The red zone is usually not decorative."',
    effect: 'When blowout chance is high, boosts the thrust of all fart items you already have.',
    qDesc: { normal: 'Small thrust boost at high risk', fine: 'Medium thrust boost at high risk', rare: 'Large thrust boost at high risk' },
    repeat: 'High-risk thrust bonus keeps stacking.',
  },
  lowvalve: {
    name: 'Low-Pressure Valve',
    type: 'Special / Low Risk',
    flavor: '"When pressure is low, everything feels negotiable."',
    effect: 'At low blowout chance, clean farts raise risk even less.',
    qDesc: { normal: 'Small risk reduction at low risk', fine: 'Medium risk reduction at low risk', rare: 'Large risk reduction at low risk' },
    repeat: 'Low-risk mitigation keeps improving.',
  },
  relief: {
    name: 'Pressure Relief Valve',
    type: 'Special / Recovery',
    flavor: '"If things go wrong, at least the pressure is gone."',
    effect: 'After a normal blowout incident, lowers current blowout chance extra.',
    qDesc: { normal: 'Small extra risk release after incidents', fine: 'Medium extra risk release after incidents', rare: 'Large extra risk release after incidents' },
    repeat: 'Incident recovery keeps improving.',
  },
  metronome: {
    name: 'Metronome',
    type: 'Special / Rhythm',
    flavor: '"Keep the beat. Especially down there."',
    effect: 'Consecutive hits on the same QTE quality build Rhythm stacks that improve thrust. A different quality clears them.',
    qDesc: { normal: 'Small thrust per Rhythm stack', fine: 'Medium thrust per Rhythm stack', rare: 'Large thrust per Rhythm stack' },
    repeat: 'Rhythm value keeps improving.',
  },
  manual: {
    name: 'Food-Safety Manual',
    type: 'Special / Standard Procedure',
    flavor: '"Follow the procedure and, in theory, nothing bad happens."',
    effect: 'Consecutive Common hits build Procedure stacks. Each stack reduces later blowout buildup. Other qualities clear them.',
    qDesc: { normal: 'Small risk reduction per stack', fine: 'Medium risk reduction per stack', rare: 'Large risk reduction per stack' },
    repeat: 'Risk mitigation per stack keeps improving.',
  },
  xplug: {
    name: 'X-Plug',
    type: 'Double-Edged',
    flavor: '"At least the exit is blocked. For now."',
    effect: 'Greatly reduces blowout buildup, but also weakens existing thrust.',
    qDesc: { normal: 'Medium blowout buildup reduction', fine: 'Large blowout buildup reduction', rare: 'Huge blowout buildup reduction' },
    repeat: 'Both safety and thrust penalty stack.',
  },
  coffee: {
    name: 'Black Coffee',
    type: 'Double-Edged',
    flavor: '"Wakes up your brain. Also your gut."',
    effect: 'Raises base running speed, but speeds up the fart QTE bar too.',
    qDesc: { normal: 'Small run-speed boost', fine: 'Medium run-speed boost', rare: 'Large run-speed boost' },
    repeat: 'Run speed and QTE speed keep rising, with a QTE speed cap.',
  },
  fountain: {
    name: 'Fountain Nozzle',
    type: 'Double-Edged',
    flavor: '"Installation direction may be questionable."',
    effect: 'Greatly improves lift from existing fart items, but weakens thrust.',
    qDesc: { normal: 'Medium lift boost', fine: 'Large lift boost', rare: 'Huge lift boost' },
    repeat: 'Lift bonus and thrust penalty stack.',
  },
  powder: {
    name: 'Baby Powder',
    type: 'Double-Edged',
    flavor: '"Dry, comfy, and best not investigated too deeply."',
    effect: 'Widens Good and Great zones on the fart QTE, while shrinking Common zones.',
    qDesc: { normal: 'Slightly widens high-quality zones', fine: 'Moderately widens high-quality zones', rare: 'Greatly widens high-quality zones' },
    repeat: 'Zone changes stack, while all qualities keep a minimum width.',
  },
  underwear: {
    name: 'Spare Underwear',
    type: 'One-Time / Recovery',
    flavor: '"A second chance. At least for these pants."',
    effect: 'Instantly restores 1 capacity, without exceeding your current capacity limit.',
  },
  diaper: {
    name: 'Adult Diaper',
    type: 'One-Time / Protection',
    flavor: '"For once, someone planned ahead."',
    effect: 'Gain 1 temporary protection. The next blowout is absorbed without spending capacity.',
  },
};

for (const item of [...ITEMS, ...ONETIME_ITEMS]) {
  if (ITEM_EN[item.id]) item.en = ITEM_EN[item.id];
}

function itemText(item, field) {
  return item?.en && currentLang() === 'en' ? item.en[field] : item?.[field];
}

function itemQDesc(item, qualityKey) {
  if (item?.en && currentLang() === 'en') return item.en.qDesc?.[qualityKey] || item.en.effect || '';
  return item?.qDesc?.[qualityKey] || item?.effect || '';
}

function qualityName(quality) {
  const key = typeof quality === 'string' ? quality : quality?.key;
  if (currentLang() === 'en') return QUALITY_EN[key] || quality?.name || key;
  return typeof quality === 'string' ? ITEM_QUALITY[quality]?.name : quality?.name;
}

// 加区字段（直接累加；概率/系数类保留小数）
const ADD_KEYS = ['pushCount', 'capacity', 'absorbChance', 'riskRelease', 'boostHF', 'chargeHF', 'rhythmHF', 'safeReduce'];
// 汇总本局 Build 效果（品质感知：乘区用 (v-1)*mul 偏移公式，加区累加）
function buildEffects() {
  state.eff = {
    riskIncMul: 1, pushCount: 0, speedMul: 1, qteMul: 1, capacity: 0, gutMul: 1,
    hForce: 1, vForce: 1, riskRelease: 0, lowRiskReduce: 1, highRiskHF: 1,
    absorbChance: 0, kaiSaiLu: 1, qteAreaMul: 1, boostHF: 0, chargeHF: 0,
    rhythmHF: 0, safeReduce: 0,
  };
  state.capsuleList = [];
  for (const e of state.build) {
    const it = ITEMS.find(i => i.id === e.id);
    if (!it) continue;
    const q = ITEM_QUALITY[e.quality];
    const qm = q ? q.mul : 1;
    for (const [k, v] of Object.entries(it.apply)) {
      if (k === 'capsulePower') { state.capsuleList.push(e.quality); continue; }
      if (k === 'cheeseReduce') continue;                 // 奶酪：获得时立即生效，不入汇总
      if (ADD_KEYS.includes(k)) state.eff[k] += Math.round(v * qm * 100) / 100;
      else state.eff[k] *= (1 + (v - 1) * qm);
    }
  }
  // 食品安全今日事件是本局环境效果，Build 每次重算后都要重新叠加。
  applyCurrentEventMultipliers();
  // 安全 clamp（避免负风险/负推进/概率越界）
  state.eff.riskIncMul = Math.max(0.05, state.eff.riskIncMul);
  state.eff.hForce = Math.max(0.3, state.eff.hForce);
  state.eff.vForce = Math.max(0.3, state.eff.vForce);
  state.eff.absorbChance = Math.min(0.9, state.eff.absorbChance);
  state.eff.boostHF = Math.min(0.5, state.eff.boostHF);
  state.eff.chargeHF = Math.min(0.6, state.eff.chargeHF);
  state.eff.rhythmHF = Math.min(0.5, state.eff.rhythmHF);
  state.eff.safeReduce = Math.min(0.8, state.eff.safeReduce);
}

export { ITEMS, ONETIME_ITEMS, ITEM_QUALITY, buildEffects, itemText, itemQDesc, qualityName };
