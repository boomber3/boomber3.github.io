import { getJSON, setJSON } from './utils/storage.js';

const SETTINGS_KEY = 'poop-run-settings';

const dict = {
  zh: {
    debugHint: '调参控制台 · 按 T 关闭 · 拖动滑块实时生效',
    debugMin: '下限',
    debugMax: '上限',
    settings: '设置',
    pause: '暂停',
    resume: '继续',
    volume: '声音大小',
    language: '语言',
    chinese: '中文',
    english: 'English',
    clearSave: '清空存档',
    endGame: '直接窜稀谢幕',
    close: '关闭',
    chanceLabel: '下一次窜稀概率',
    judgeLabel: '下一个屁',
    adminUnlocked: '管理员模式已解锁',
    upgradeTitle: '升级！选择一件道具',
    upgradeQteTitle: '升级！命中一个道具',
    eventRecord: '事件记录',
    titleMain: '不要相信任何一个P',
    titleBubble: '憋住！快跑！！',
    titleStart: '—— 点 击 开 幕 ——',
    titleTip: '空格 / 点击 放屁 · 憋得越久越危险',
    eventTip: '按空格 / 点击四周空白处开始',
    finalTitle: '失 禁 谢 幕',
    finalEn: 'FLATULENCE FINALE',
    finalDayLabel: '当前 Day',
    finalDistLabel: '本次距离',
    finalBestLabel: '历史最佳',
    finalFartsLabel: '成功放屁',
    finalFartsUnit: '次',
    finalExhaustLabel: '获得排气里程',
    finalEventsLabel: '食品事件',
    finalEventsUnit: '个',
    finalBuildLabel: '装备 Build',
    overHome: '—— 回 到 主 页 ——',
    overRestart: '—— 重 新 开 始 ——',
    noBuild: '无',
    lifeTip: '还能憋得住！剩余 {left}/{max}',
    clearTitle: '清空存档',
    clearMsg: '确定要清空所有成长数据吗？\n\n身体等级、排气经验、道具属性将全部归零，重新从第 1 天开始。',
    clearYes: '清空',
    endTitle: '直接谢幕',
    endMsg: '确定要直接窜稀结束本局吗？',
    endYes: '窜稀谢幕',
    confirm: '确认',
    ok: '确定',
    cancel: '取消',
    qteRound: '第 {round} / {total} 往返 · {speed}x',
    qteRoundWithLabel: '第 {round} / {total} 往返 · {speed}x · {label}',
    eventTitle: '今日事件 {no}《{title}》',
    qteLabel_bad: '糟糕',
    qteLabel_ok: '一般',
    qteLabel_good: '优秀',
    qteLabel_great: '完美',
    judge_perfect: '完美',
    judge_good: '优秀',
    judge_ok: '一般',
    judge_bad: '糟糕',
    linkWords: ['并且', '但是', '居然', '果然', '于是', '结果', '没想到', '偏偏', '然而', '紧接着', '谁知', '哗啦'],
    outcome_diarrhea: '串稀！',
    outcome_tripleFart: '三连空屁！',
    outcome_firework: '腚上花火！',
    outcome_smallFart: '小放一点！',
    outcome_blast: '原地崩飞！',
    outcome_fart: '普通放屁！',
    outcome_airTriple: '空中三连屁！',
    outcome_cornGun: '玉米加农炮！',
    outcome_dragonFruit: '火龙果屁！',
    outcome_goodbye: '明天再见！',
    outcome_rainbow: '彩虹屁！',
    outcome_bootySpin: '大腚转转转！',
    outcome_danmakuFart: '弹屏屁！',
    outcome_fartExeCrash: 'Fart.exe 未响应！',
    outcome_ikeaFart: '疯狂宜家屁！',
    outcome_rocket: '火箭喷屁！',
    outcome_bigFart: '超级大屁！',
    outcome_elephant: '怎么塞入的？',
    outcome_catScream: '猫咪大叫！',
    outcome_doubleBarrel: '双管猎枪！',
    outcome_cometImpact: '彗星撞地球！',
    outcome_sportsSale: '体育用品大甩卖！',
    outcome_sharknado: '鲨卷风！',
    outcome_verticalRocket: '垂直火箭！',
    outcome_laserUp: '激光升天！',
    outcome_fruitSalad: '水果沙拉！',
    outcome_twoStageRocket: '屁式二级火箭！',
  },
  en: {
    debugHint: 'Tuning Console · Press T to close · Sliders apply instantly',
    debugMin: 'Min',
    debugMax: 'Max',
    settings: 'SETTINGS',
    pause: 'Pause',
    resume: 'Resume',
    volume: 'Volume',
    language: 'Language',
    chinese: '中文',
    english: 'English',
    clearSave: 'Clear Save',
    endGame: 'End Run Now',
    close: 'Close',
    chanceLabel: 'Next Blowout Chance',
    judgeLabel: 'Next Fart',
    adminUnlocked: 'Admin Mode Unlocked',
    upgradeTitle: 'Level Up! Pick One',
    upgradeQteTitle: 'Level Up! Hit One Item',
    eventRecord: 'Case File',
    titleMain: 'Do Not Trust Any Fart',
    titleBubble: 'Hold it! Run!!',
    titleStart: '-- CLICK TO START --',
    titleTip: 'Space / Click to fart · Holding it gets risky',
    eventTip: 'Press Space / click empty space to start',
    finalTitle: 'BLOWOUT FINALE',
    finalEn: 'PANTS: COMPROMISED',
    finalDayLabel: 'Day',
    finalDistLabel: 'Distance',
    finalBestLabel: 'Best',
    finalFartsLabel: 'Clean Farts',
    finalFartsUnit: '',
    finalExhaustLabel: 'Exhaust XP',
    finalEventsLabel: 'Food Incident',
    finalEventsUnit: '',
    finalBuildLabel: 'Gear Build',
    overHome: '-- HOME --',
    overRestart: '-- RUN IT BACK --',
    noBuild: 'None',
    lifeTip: 'Still holding on! {left}/{max} left',
    clearTitle: 'Clear Save',
    clearMsg: 'Wipe all growth data?\n\nBody level, exhaust XP, and item upgrades will reset. Back to Day 1.',
    clearYes: 'Clear',
    endTitle: 'End Run',
    endMsg: 'Force the grand blowout and end this run?',
    endYes: 'Let It Rip',
    confirm: 'Confirm',
    ok: 'OK',
    cancel: 'Cancel',
    qteRound: 'Lap {round}/{total} · {speed}x',
    qteRoundWithLabel: 'Lap {round}/{total} · {speed}x · {label}',
    eventTitle: 'Today\'s Incident {no}: {title}',
    qteLabel_bad: 'Bad',
    qteLabel_ok: 'Okay',
    qteLabel_good: 'Great',
    qteLabel_great: 'Perfect',
    judge_perfect: 'Perfect',
    judge_good: 'Great',
    judge_ok: 'Okay',
    judge_bad: 'Bad',
    linkWords: ['and', 'but', 'somehow', 'of course', 'so', 'then', 'against all odds', 'naturally', 'however', 'right after', 'turns out', 'splash'],
    outcome_diarrhea: 'Blowout!',
    outcome_tripleFart: 'Triple Blank!',
    outcome_firework: 'Butt Fireworks!',
    outcome_smallFart: 'Tiny Puff!',
    outcome_blast: 'Ground Blast!',
    outcome_fart: 'Clean Fart!',
    outcome_airTriple: 'Air Triple!',
    outcome_cornGun: 'Corn Cannon!',
    outcome_dragonFruit: 'Dragonfruit Fart!',
    outcome_goodbye: 'See You Tomorrow!',
    outcome_rainbow: 'Rainbow Fart!',
    outcome_bootySpin: 'Butt Spin!',
    outcome_danmakuFart: 'Bullet-Text Fart!',
    outcome_fartExeCrash: 'Fart.exe Is Not Responding!',
    outcome_ikeaFart: 'IKEA Panic Fart!',
    outcome_rocket: 'Rocket Fart!',
    outcome_bigFart: 'Mega Fart!',
    outcome_elephant: 'How Did That Fit?',
    outcome_catScream: 'Cat Scream!',
    outcome_doubleBarrel: 'Double Barrel!',
    outcome_cometImpact: 'Comet Impact!',
    outcome_sportsSale: 'Sporting Goods Sale!',
    outcome_sharknado: 'Sharknado!',
    outcome_verticalRocket: 'Vertical Rocket!',
    outcome_laserUp: 'Laser Launch!',
    outcome_fruitSalad: 'Fruit Salad!',
    outcome_twoStageRocket: 'Two-Stage Fart Rocket!',
  },
};

// 检测浏览器默认语言：主要语言为英文 → 'en'，否则 'zh'
function detectBrowserLang() {
  const candidates = navigator.languages && navigator.languages.length
    ? navigator.languages
    : [navigator.language || 'zh'];
  for (const l of candidates) {
    if (typeof l === 'string' && l.toLowerCase().replace('_', '-').startsWith('en')) return 'en';
  }
  return 'zh';
}

// 已手动设置过语言 → 尊重用户选择；否则跟随浏览器默认语言
const savedLang = getJSON(SETTINGS_KEY, {})?.language;
let lang = normalizeLang(savedLang || detectBrowserLang());
const listeners = new Set();

function normalizeLang(value) {
  return value === 'en' ? 'en' : 'zh';
}

function currentLang() {
  return lang;
}

function t(key, vars = {}) {
  const text = (dict[lang] && dict[lang][key]) || dict.zh[key] || key;
  return text.replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? '');
}

function localizeField(source, field) {
  if (!source) return '';
  if (lang !== 'zh' && source[lang] && source[lang][field] !== undefined) return source[lang][field];
  return source[field] ?? '';
}

function tList(key) {
  const value = (dict[lang] && dict[lang][key]) || dict.zh[key] || [];
  return Array.isArray(value) ? value : [String(value)];
}

function setLanguage(nextLang) {
  const next = normalizeLang(nextLang);
  if (next === lang) return;
  lang = next;
  const settings = getJSON(SETTINGS_KEY, {}) || {};
  settings.language = lang;
  setJSON(SETTINGS_KEY, settings);
  applyLanguage();
  listeners.forEach(fn => fn(lang));
}

function applyLanguage(root = document) {
  root.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  root.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.dataset.i18nTitle);
  });
  root.querySelectorAll('[data-i18n-aria]').forEach(el => {
    el.setAttribute('aria-label', t(el.dataset.i18nAria));
  });
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
}

function onLanguageChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export { currentLang, t, tList, localizeField, setLanguage, applyLanguage, onLanguageChange };
