// 模块化重构：由 paper-theater-runner.html 拆出
import { CONFIG } from '../config.js';

// ---------- 状态 & 输入 ----------
const state = {
  phase: 'title',      // title → opening → run → dying → over
  paused: false,
  phaseT: 0,
  dist: 0,
  speed: 0,
  targetSpeed: 0,
  jumpY: 0, jumpVy: 0, onGround: true,
  fartFlying: false,     // 放屁起飞中（复刻失禁飞行，保持 run）
  blastFlying: false,    // 原地崩飞中（垂直大力、水平不加速）
  noFartParticles: false, // 本次放屁不产生屁云粒子（大象事件：只喷出物，无烟雾）
  fartGravityMul: 1,     // 本次放屁飞行重力倍率（玉米加农炮低重力平地飞行）
  rocketFx: false,       // 垂直火箭：飞行期间持续喷火尾迹
  verticalRocket: false, // 垂直火箭：持续渐变推力进行中
  verticalRocketT: 0,    // 垂直火箭持续推力计时
  spinRolling: false,    // 大腚转转转：角色持续旋转 + 持续喷屁
  spinRollingT: 0,
  spinEndT: 0,           // 大腚转转转收尾计时：旋转渐停回正期间屏蔽 QTE
  bootyPuffT: 0,       // 大腚转转转横向加速计时
  sportsSale: false,     // 体育用品大甩卖：持续喷球 + 纵向推进
  sportsSaleT: 0,        // 体育用品大甩卖持续计时
  sportsSaleEmitT: 0,    // 喷球节奏累计
  sharknado: false,      // 鲨卷风：多段喷鲨鱼 + 旋转气流
  sharknadoT: 0,         // 鲨卷风持续计时
  sharknadoEmitT: 0,     // 喷鲨鱼节奏累计
  ikeaFart: false,       // 疯狂宜家屁：家具爆喷 + 屏幕内堆积
  ikeaFartT: 0,          // 家具爆喷持续计时
  ikeaFartEmitT: 0,      // 喷家具节奏累计
  timeStopped: false,    // 猫咪大叫：短暂冻结整个游戏世界
  catScreamBoost: false,
  catScreamBoostT: 0,
  shotgunSpinV: 0,
  cometImpact: false,    // 彗星撞地球：超高空升起、停顿、俯冲撞地
  cometPhase: 'idle',
  cometT: 0,
  cometFireT: 0,
  cometHit: false,
  firework: false,       // 腚上花火：原地不动连续放烟花
  fireworkT: 0,          // 花火时长计时
  fartFlyT: 0,           // 放屁起飞计时（持续喷屁密度随时间递减）
  buildup: false,        // 放屁酝酿中（按键后减速捂屁股走，等揭晓）
  buildupT: 0,           // 酝酿计时
pendingSpeed: 0,       // 按屁前速度快照（原地崩飞需保留酝酿减速前的水平速度）
  qteLayoutDirty: false, // 拍停后置位：下一次恢复扫动时重新生成布局
  shitting: false,       // 原地窜稀中（不飞，喷屎后扣命继续）
  shitT: 0,              // 原地窜稀计时
  coyote: 0, buffer: 0,
  phaseRun: 0,
  shake: 0,            // 通用震动强度
  shakeX: 0,           // 水平方向性震动（放屁后坐向后为负）
  shakeY: 0,           // 垂直方向性震动（落地冲击向下为负）
  camY: 0,
  farts: 0,            // 本局成功放屁次数
  exhaustExp: 0,       // 本局排气里程经验
  lives: 5,            // 喷射容量（串稀生命值，道具可+）
  livesDrop: null,     // 底端正在掉落的节（{index, t} 掉落动画）
  build: [],           // 本局道具 Build：[{id, quality}]（可重复/不同品质共存，单局清除）
  eff: { riskIncMul: 1, pushCount: 0, speedMul: 1, qteMul: 1, capacity: 0, gutMul: 1,
         hForce: 1, vForce: 1, riskRelease: 0, lowRiskReduce: 1, highRiskHF: 1,
         absorbChance: 0, kaiSaiLu: 1, qteAreaMul: 1, boostHF: 0, chargeHF: 0,
         rhythmHF: 0, safeReduce: 0 },   // 道具效果汇总（新道具系统扩展）
  capsuleList: [],     // 缓释排气胶囊追加排气列表：['normal'|'fine'|'rare']（各胶囊各自力度）
  capsuleQueue: [],    // 已排队的缓释追加排气力度，等当前屁完整落地后逐段释放
  capsuleDelayT: 0,
  capsuleActive: false, // 缓释排气胶囊序列进行中（其落地不触发 QTE 静止缓冲）
  capsuleFartFlying: false, // 胶囊追加排气飞行中（仅此期间 QTE 判定条扫动且可放屁）
  boostStacks: 0,      // 蓄气增压阀：连续成功层数（事故清空，每层提高横向推进）
  chargeStacks: 0,     // 高压气罐：蓄压层数（好/极好屁消耗强化）
  rhythmStacks: 0,     // 节拍器：连续同品质层数
  safeStacks: 0,       // 安全操作手册：连续一般品质层数
  lastQteQuality: null, // 上一次 QTE 命中品质质量 t（节拍器/手册判断）
  consumeCharge: 0,    // 本次屁消耗的蓄压层数（高压气罐）
  protects: 0,         // 一次性事故保护次数（成人纸尿裤）
  upgradeQteActive: false, // 升级道具 QTE 进行中（子弹时间）
  upgradeQte: null,       // { offers:[{item,quality,x0,x1}], pos, dir, speed, autoT }
  upgradeQteInputLockT: 0, // 升级道具 QTE 开局输入拦截倒计时（秒）：0.2s 内忽略锁定输入，防误触
  cameraFollowX: 0,     // 屏幕死区方案的水平镜头跟随目标
  cameraFollowReady: false,
  qte: 0,              // 判定线相对条中心的偏移 -0.5~+0.5（0=线指条中间）
  qteDir: 1,           // 线扫动方向：+1 往 +0.5（右端）扫 / -1 往 -0.5（左端）扫
  qteStaticT: 0,       // 每次 QTE 开始前的静止缓冲：判定线暂停此秒数再扫动（间隔用）
  qteStaticConsumed: false, // 本次静止缓冲期是否已弹出过升级道具 QTE（每次静止期弹一个）
  upgradeQtePending: 0,     // 排队等待弹出的升级道具 QTE 数量（非静止期升级先排队）
  adminUnlocked: false,     // 管理员门禁：连续输入 zgpnf 解锁（本次会话有效）
  diarrheaChance: 0,   // 本次按键对应的实际窜稀概率（0~1，酝酿期生命条抖动强度依据）
  hudDebug: false,     // 左上角 HUD：false=玩家判定视图（当前 QTE 所指判定段） / true=测试窜稀概率
  qteSpeed: CONFIG.qte.speed, // 当前滑动速度（基础速度 × 往返提速）
  qteRound: 0,         // 已完成往返数（满 rounds 次强制最坏）
  qteRoundSpeedMul: 1,
  qteResolving: false,
  qteJudgement: 'idle',
  qteOutcome: null,
  pendingJudgeT: 0,
  pendingMediumRareZone: null,
  recentOutcomeT: 0,
  rocketFart: false,
  fartFxScaleMul: 1,
  fartFxDurationMul: 1,
  cumRisk: 0,          // 累积事故风险（每次放屁提高，连放更快）
  lastFartT: -99,      // 上次放屁的时刻（连放惩罚判定）
  fartPower: 1,        // 放屁冲力倍率（事件/道具）
  launchMul: 1,        // 失禁喷射距离倍率
  qteSpeedMul: 1,      // QTE 指针速度倍率
  sprayAmountMul: 1,   // 喷射套餐：屁气粒子数量倍率
  specialAmountMul: 1, // 喷射套餐：特殊喷出物数量倍率
  incidentSprayMul: 1, // 喷射套餐：事故喷出物数量倍率
  incidentLaunchMul: 1,// 喷射套餐：最终事故推进倍率
  juiceFartId: null,    // 100%混合果汁：本次屁随机混入的果汁颜色
  juiceFartColor: null,
  juiceFartH: 1,
  juiceFartV: 1,
  juiceFartRisk: 1,
  juiceFartFx: 1,
  mushroomT: 0,         // 野生蘑菇：本局空间感异常累计时间
  mushroomRoll: 0,      // 野生蘑菇：当前世界视觉旋转角
  mushroomRollFrom: 0,  // 野生蘑菇：本段过渡起点
  mushroomRollTarget: 0,// 野生蘑菇：本段过渡目标
  mushroomPhase: 'calm',// 野生蘑菇：calm/tilt/hold/return
  mushroomPhaseT: 0,    // 野生蘑菇：当前段计时
  mushroomPhaseDur: 4,  // 野生蘑菇：当前段时长
  mushroomDir: 1,       // 野生蘑菇：下一次倾斜方向
  activeFoodEvent: null, // 当前局食品安全事件（本局结束清除）
  proteinQteT: 0,       // 蛋白质含量非常优秀：本次 QTE 憋气膨胀时间
  proteinBloatScale: 1, // 蛋白质含量非常优秀：当前视觉膨胀倍率
  proteinBloatPower: 1, // 蛋白质含量非常优秀：按下时锁定的本次推进倍率
  proteinDeflateT: 0,   // 蛋白质含量非常优秀：判定后漏气回缩计时
  proteinLeakT: 0,      // 蛋白质含量非常优秀：漏气粒子节奏
  slopTurnVel: 0,       // 秘制糊糊：持续喷射方向漂移速度
  slopTurnT: 0,         // 秘制糊糊：持续喷射漂移计时
  slopTrailT: 0,        // 秘制糊糊：弯曲屁气尾迹节奏
  falseCodOilT: 0,     // 此鳕鱼非鳕鱼：跑步漏油节奏
  falseCodSlipAngle: 0, // 此鳕鱼非鳕鱼：仅视觉打滑旋转角
  falseCodSlipVel: 0,  // 此鳕鱼非鳕鱼：仅视觉打滑角速度
  fartPush: 0,         // 放屁冲刺姿态计时（前倾蹬地）
  fartBoost: 0,        // 放屁持续推力（目标速度加成，渐弱）
  dyingT: 0,           // 失禁起飞计时
  dyingPhase: 'fly',   // 最后一次失禁阶段：fly（飞出/翻滚/弹跳）→ rest（倒下静止）
  dyingBounce: 0,      // 落地弹跳次数（最后一次失禁）
  dyingRest: 0,        // 倒下静止计时（谢幕前）
  launchVx: 0,         // 失禁水平冲出速度（沿行进方向）
  launchVy: 0,         // 失禁垂直速度
  heavyGravityMul: 1,
  heavyLandingBoostT: 0,
  heavyLandingSquashT: 0,
  heavyLandingSquashPower: 0,
};
const GRAVITY = 26, JUMP_V = 8.6;
let prevPlayerX = -2;   // 上一帧角色 x，用于背景纹理按角色位移滚动（需在 beginRun 前声明）
// 触发屏幕震动：强度 + 方向性偏移（方向性震动短促有力，通用震动持续衰减）
function addShake(amt, dirX = 0, dirY = 0) {
  state.shake = Math.max(state.shake, amt);
  state.shakeX += dirX;
  state.shakeY += dirY;
}
// ESM import 绑定只读：跨模块更新 prevPlayerX 需经 setter
function setPrevPlayerX(v) { prevPlayerX = v; }

export { state, GRAVITY, JUMP_V, prevPlayerX, addShake, setPrevPlayerX };
