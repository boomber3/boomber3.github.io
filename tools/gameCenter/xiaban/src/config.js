// 模块化重构：由 paper-theater-runner.html 拆出
/* ============================================================
   中央配置（数据驱动）：所有可调数值集中于此
   游戏运行时统一读 CONFIG，按 T 可打开实时调参面板修改
   ============================================================ */
const CONFIG = {
  // 放屁 QTE
  qte: {
    speed: 1.3333,       // 基准滑动速度（/秒）：第 1 轮判定线从条一端扫到另一端约 0.75 秒（半程约 0.375 秒）
    speedMin: 0.12,      // 指针速度下限（道具加速后仍留有空间）
    speedSlow: 0.4,      // 速度节奏曲线：底部倍率（<1 慢，初始低压区走得更从容）
    speedFast: 2.0,      // 速度节奏曲线：顶部倍率（>1 快，高概率区逼玩家尽快按）
    speedCurveExp: 2,    // 速度节奏曲线指数（越大慢区越宽、后期越陡）
    cumRiskCap: 0.15,    // 累积风险上限
    normalInc: 0.003,    // 单次风险增长率（受括约肌/道具修正）
    rapidInc: 0.012,     // 连放风险增长率
    rapidWindow: 1.5,    // 连放判定窗口（秒）
    riskFactor: 18,      // 串稀风险系数：cumRisk 越高，串稀权重 ×(1+cumRisk×riskFactor)
    holdAt: 0.7,         // 憋屁减速起始指针位置
    holdSlope: 1.4,      // 憋屁减速斜率
    expBase: 25,         // 首级升级所需排气次数（初期门槛，避免道具太频繁）
    expGrowth: 4,        // 每级额外基础（× lv^expPow 亚线性）
    expPow: 0.75,        // 升级曲线幂（<1 → 后期每级所需经验增速放缓，升级不太慢）
    rounds: 5,           // 最多往返次数：满 5 个完整往返（左→右→左）未按 → 强制最坏结果
    speedRoundMul: 1.25, // 每完成一个往返，滑动速度 ×此值（逐趟加快）
    buildupTime: 1.5,    // 放屁酝酿时长（秒）：按键/揭晓后减速捂屁股走，再真正崩飞
    fireworkDur: 2.0,  // 腚上花火原地时长（秒）
    layoutMode: 1,       // 布局模式：1=随机（每轮洗牌重排） / 0=固定（底→顶 糟糕→一般→一般→优秀→完美）
    layoutPool: [        // 四档品质 5 段池：一般×2（同色同档 t=0.5），宽度占比完美优先；barW = 贝塞尔宽度曲线控制点基准（100 列画布像素，糟糕粗→完美细，段界渐变过渡）
      { q: 'bad',   t: 0.00, label: '糟糕', color: '#E53935', w: 0.22, barW: 70 },
      { q: 'ok',    t: 0.50, label: '一般', color: '#FB8C00', w: 0.16, barW: 50 },
      { q: 'ok',    t: 0.50, label: '一般', color: '#FB8C00', w: 0.16, barW: 50 },
      { q: 'good',  t: 0.75, label: '优秀', color: '#FDD835', w: 0.20, barW: 40 },
      { q: 'great', t: 1.00, label: '完美', color: '#43A047', w: 0.26, barW: 30 },
    ],
    poolK: 3,        // 抽取陡峭度：eff = base * exp(K * quality * (t-0.5))
    pool: [          // 放屁事件池：quality 好度越高，t 越大时被抽中概率越高（永不归零）；color = 结果气泡星芒底色
      { id: 'diarrhea',  label: '串稀！',     baseWeight: 4.5, quality: 0.00, color: '#e23b3b' },
      { id: 'tripleFart', label: '三连空屁！', baseWeight: 3, quality: 0.00, color: '#9e9e9e' },
      { id: 'firework',    label: '腚上花火！', baseWeight: 3, quality: 0.00, color: '#9c27b0' },
      { id: 'smallFart', label: '小放一点！', baseWeight: 4, quality: 0.25, color: '#ff8c42' },
      { id: 'blast',     label: '原地崩飞！', baseWeight: 1, quality: 0.30, color: '#ff6b35' },
      { id: 'fart',      label: '普通放屁！', baseWeight: 5, quality: 0.50, color: '#ffd23f' },
      { id: 'airTriple', label: '空中三连屁！', baseWeight: 3, quality: 0.50, color: '#4fc3f7' },
      { id: 'cornGun',   label: '玉米加农炮！', baseWeight: 3, quality: 0.75, color: '#e8b84b' },
      { id: 'dragonFruit', label: '火龙果屁！', baseWeight: 3, quality: 0.75, color: '#e91e63' },
      { id: 'goodbye',     label: '明天再见！', baseWeight: 3, quality: 0.75, color: '#f0e6d6' },
      { id: 'rainbow',      label: '彩虹屁！', baseWeight: 3, quality: 0.75, color: '#ff8fab' },
      { id: 'bootySpin',    label: '大腚转转转！', baseWeight: 3, quality: 0.75, color: '#ffa726' },
      { id: 'danmakuFart',  label: '弹屏屁！',   baseWeight: 3, quality: 0.75, color: '#4dd0e1' },
      { id: 'fartExeCrash', label: 'Fart.exe 未响应！', baseWeight: 3, quality: 0.75, color: '#0b63f6' },
      { id: 'ikeaFart',     label: '疯狂宜家屁！', baseWeight: 2, quality: 0.85, color: '#1765d1' },
      { id: 'rocket',    label: '火箭喷屁！', baseWeight: 3, quality: 0.85, color: '#2ec4b6' },
      { id: 'bigFart',   label: '超级大屁！', baseWeight: 4, quality: 1.00, color: '#3ad14f' },
      { id: 'elephant',  label: '怎么塞入的？', baseWeight: 3, quality: 1.00, color: '#7a5c3e' },
      { id: 'catScream', label: '猫咪大叫！', baseWeight: 2, quality: 1.00, color: '#f48fb1' },
      { id: 'doubleBarrel', label: '双管猎枪！', baseWeight: 2, quality: 1.00, color: '#8d6e63' },
      { id: 'cometImpact', label: '彗星撞地球！', baseWeight: 2, quality: 1.00, color: '#ff6d00' },
      { id: 'sportsSale', label: '体育用品大甩卖！', baseWeight: 2, quality: 1.00, color: '#1976d2' },
      { id: 'sharknado', label: '鲨卷风！', baseWeight: 2, quality: 1.00, color: '#1565c0' },
      { id: 'verticalRocket', label: '垂直火箭！', baseWeight: 2, quality: 1.00, color: '#ff7043' },
      { id: 'laserUp',        label: '激光升天！', baseWeight: 2, quality: 1.00, color: '#29b6f6' },
      { id: 'fruitSalad',     label: '水果沙拉！', baseWeight: 2, quality: 1.00, color: '#f57f17' },
      { id: 'twoStageRocket', label: '屁式二级火箭！', baseWeight: 2, quality: 1.00, color: '#7e57c2' },
    ],
    linkWords: [   // 三段式播报连接词池：纯随机抽取
      '并且', '但是', '居然', '果然', '于是', '结果', '没想到', '偏偏', '然而', '紧接着', '谁知', '哗啦',
    ],
    rocket: {
      distanceMul: 1.60,
      speedMul: 1.25,
      fxScaleMul: 1.35,
      fxDurationMul: 1.35,
      continuousAccel: 6.0,
      continuousSpeedCap: 22,
      vertical: {          // 垂直火箭：持续渐变推力（点火纵向 → 分离 → 水平加速）
        dur: 2.0,          // 持续时长（秒，覆盖三段）
        vyAccel: 25,       // 纵向加速度峰值（第一段点火）
        vxAccel: 15,       // 横向加速度峰值（第三段加速）
        vyFrac: 0.45,      // 纵向力在前 45%（≈0.9s）衰减到 0
        vxStart: 0.25,     // 横向力从持续期 25% 开始抬升
        vxRamp: 0.5,       // 横向力用 50% 时长抬升到峰值
      },
      bootySpin: {         // 大腚转转转：角色持续旋转 + 持续喷屁向前滚
        dur: 2.0,          // 横向加速时长（秒）
        vxAccel: 14,       // 横向加速度
        r: 0.85,           // 旋转半径（米）
        spinMul: 1.5,      // 旋转角速度系数
      },
    },
    fartForce: {
      big: 1.00,
      regular: 0.75,
      small: 0.50,
      blast: 1.70,   // 原地崩飞：垂直力 ≈ 大屁的 1.7 倍（y 轴速度很大）
      triple: 0.25,  // 三连空屁：每次极低力度（轻微位移）
      airTriple: 0.9,// 空中三连屁：较强力度（升空 + 空中追加）
      fruit: 0.8,     // 火龙果屁 / 明天再见：中高力度（纯视觉梗屁，不过度给收益）
    },
  },
  // 放屁推力
  fart: {
    power: 1.25,         // 单次冲力速度增量
    boost: 0.55,         // 持续推力时长（秒）
    boostMul: 6,         // 推力期间目标速度加成系数
    speedCap: 12.5,      // 速度上限
  },
  // 奔跑
  run: {
    base: 5.2,           // 基础速度
    max: 8.8,            // 自然加速上限
    ramp: 0.045,         // 自然加速速率
    smooth: 2.2,         // 速度平滑系数
    lives: 5,            // 喷射初始容量（串稀生命值，道具可+）
  },
  // 失禁喷射
  launch: {
    vx: 8, vy: 9.5,      // 第一段推力
    vx2: 4, vy2: 3,      // 第二段推力
    finalSpeedMul: 2.8,  // 最后一次失禁的前冲速度倍率（更快更夸张）
    delay1: 430, delay2: 720,   // 推力延时（ms）
    gravityMul: 0.7,     // 喷射阶段重力倍率
    landT: 1.5,          // 落地判定最小飞行时间
    flyDrag: 0.6,        // 水平前冲衰减率（/秒，越小滑行越久越远）
    bounceElastic: 0.5,  // 弹力系数（落地速度保留比例，弹性物理反弹，自然衰减）
    bounceStop: 0.1,     // 反弹速度低于此则停止弹跳
    restTime: 3.0,       // 倒下静止后谢幕时长（秒）
  },
  // 屁云特效
  fartFx: {
    scaleMul: 1.0,       // 屁粒子大小倍率（基础 0.9~2.0 × 此值，与窜稀粒子同尺寸）
    count: 5,            // 每次放屁生成的粒子数（生成时在 ±1 间随机 → 每屁 4~6 粒）
    contRate: 6,         // 起飞持续喷屁速率（开场爆发后飞行中几乎不喷，偶有几粒余韵）
  },
  // 屎特效
  poopFx: {
    burst: 40,           // 失禁初始喷屎数
    burstScale: [0.9, 2.0],    // 初始喷屎大小范围
    contRate: 24,        // 持续拉取速率（每帧 dt×）
    contScale: [0.8, 1.8],     // 持续拉取大小范围
  },
  // 屏幕震动（多档事件触发 + 方向性）
  shake: {
    amp: 0.16,           // 随机抖动幅度系数
    decay: 2.4,          // 通用震动衰减速率
    dirAmp: 0.5,         // 方向性震动幅度系数
    dirDecay: 3.5,       // 方向性震动衰减速率
  },
  // 飞鸟（可碰撞：撞到惊飞 + 经验值）
  birds: {
    count: 3,            // 同时存在的飞鸟数
    speedMin: 1.2, speedMax: 2.6,   // 飞行速度
    yMin: 2.8, yMax: 5.4,           // 飞行高度（较高，仅放屁起飞时够得到）
  },
  // 3D 飞机（与鸟共存：撞到击落坠落 + 经验值）
  planes: {
    count: 2,            // 同时存在的飞机数
    speedMin: 2.2, speedMax: 4.2,   // 飞行速度（略快于鸟）
    small: { yMin: 13.8, yMax: 18.4 },
    big: { yMin: 17.2, yMax: 23.2 },
    bigChance: 0.35,     // 大飞机出现概率（其余为小飞机）
  },
  // 主路可破坏物（碰撞破坏 + 经验值）
  breakables: {
    gap: 3,              // 间隔基准（×2 随机 → 约 3~9 距离一个，约为背景物体密度的 1/3）
    xp: 2,               // 纸片物体破坏经验值（交通物/鸟/飞机按各自 xp）
    range: 1.0,          // 触发范围
    y: 0.55,             // 物体位置高度
    trafficChance: 0.5,  // 刷出 3D 交通物的概率
    trafficRoadChance: 0.45,
    trafficCurbChance: 0.35,
  },
  geese: {
    count: 2,
    gap: 18,
    speedMin: 0.45, speedMax: 0.9,
    walkRange: 1.7,
    hitRange: 0.9,
    h: 0.9,
  },
  // 流式背景地区：玩家按距离循环穿越不同地区，边界渐变过渡
  regions: {
    order: ['town', 'city', 'wild'],             // 地区循环顺序：乡镇 → 城市 → 野外 → …
    fade: 30,                            // 边界过渡区（米）：两侧混合两地区模型，避免突变
    town: {
      dist: 260,                         // 本地区长度（米）
      kinds: [                           // 本地区背景模型（引用 props MID_KINDS 的 model 名）
        'town/town-house-a', 'town/town-house-b', 'town/town-house-c',
        'town/detail-awning', 'town/detail-parasol-a',
      ],
    },
    city: {
      dist: 260,
      kinds: [
        'city/building-a', 'city/building-b', 'city/building-skyscraper-a',
        'city/traffic-01',
      ],
    },
    wild: {
      dist: 260,
      kinds: [
        'wild/mini-forest/building-platform', 'wild/mini-forest/tree-high',
        'wild/mini-forest/tree', 'wild/mini-forest/rocks-ramp',
        'wild/platformer/tree-pine-small', 'wild/platformer/tree-snow',
      ],
    },
  },
  // UFO / 热气球：天空可碰撞物，行为接近飞机，但更慢、更偏装饰
  aerials: {
    count: 2,
    speedMin: 1.0, speedMax: 2.15,
    balloon: { yMin: 7.2, yMax: 11.4 },
    ufo: { yMin: 22.5, yMax: 29.6 },
    ufoChance: 0.48,
  },
};


export { CONFIG };
