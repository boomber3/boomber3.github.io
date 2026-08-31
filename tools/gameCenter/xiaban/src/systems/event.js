import { state } from '../core/state.js';
import { setCharacterScale, setCharacterTint } from '../world/character.js';
import { currentLang } from '../i18n.js';

const FOOD_EVENTS = [
  {
    id: 'protein01',
    no: '01',
    title: '蛋白质含量非常优秀',
    effectName: '高蛋白反应',
    effects: {},
    experience:
      '今日经历：早餐的牛奶正在打折。包装上写着：高蛋白 · 高营养 · 严格检测。你看不懂检测报告，但它有三个对勾。你喝了两杯。',
    record:
      '事件记录：20XX 年，某地区大量婴幼儿因食用受污染乳制品出现泌尿系统异常。调查发现，部分乳制品中被人为加入一种工业化合物，使其在特定蛋白质检测方式下表现出更高的数值。',
  },
  {
    id: 'pomegranateJuice06',
    no: '06',
    title: '100% Pomegranate Juice',
    effectName: '100%混合果汁',
    scale: 0.7,
    effects: {
      qteSpeedMul: 0.85,
    },
    experience:
      '今日经历：你买了一瓶写着“100% Pomegranate Juice”的石榴汁。瓶身红得很真诚，配料表小得很含蓄。你喝完才发现舌头上什么颜色都有。',
    record:
      '事件记录：20XX 年，部分标称高比例或纯果汁的产品被检测出与标签不符，实际可能掺入其他果汁、色素或甜味成分。复杂供应链与模糊标签让消费者很难判断饮品真实成分。',
  },
  {
    id: 'flintWater02',
    no: '02',
    title: '放一会儿就好了',
    effectName: '重金属反应',
    effects: {
      heavyGravityMul: 1.5,
    },
    experience:
      '今日经历：今天的自来水有一点金属味。你上网搜了一下，第一个回答：“正常，放一会儿就好了。”你放了两分钟。味道还在。你喝了。',
    record:
      '事件记录：20XX年，某城市更换公共供水来源后，由于水处理措施不足，供水系统中的管道发生腐蚀，污染物进入居民饮用水。大量居民在问题被正式确认前已经持续接触污染水源。',
  },
  {
    id: 'secretSlop08',
    no: '08',
    title: '秘制糊糊',
    effectName: '肠道失控',
    effects: {},
    experience:
      '今日经历：路边摊老板从一口你看不见底的大桶里舀出一勺糊状物。你问：“这是什么？”老板说了一串你没听懂的名字，然后给你竖了个大拇指。沟通非常成功。你要了大份。',
    record:
      '事件记录：某地区对街头即食食品进行抽样调查后发现，部分食品及其调味水存在较高程度的微生物污染。未经处理的水源、长时间常温存放、器具清洁不足以及反复徒手接触，都可能增加食品受到污染的风险。相关调查曾在部分样本中检出大肠杆菌、沙门氏菌等微生物。',
  },
  {
    id: 'sprayPackage09',
    no: '09',
    title: '喷射套餐',
    effectName: '喷射战士',
    effects: {
      sprayAmountMul: 2,
      specialAmountMul: 2,
      incidentSprayMul: 2,
      incidentLaunchMul: 1.5,
      initialRisk: 0.18,
    },
    experience:
      '今日经历：中午不知道吃什么，你点开外卖软件。汉堡、炸鸡、可乐，价格便宜得令人无法拒绝。评论区有人留下四个字：“喷射战士。”你觉得网友总喜欢夸大其词。你点了双人套餐。一个人吃。',
    record:
      '事件记录：20XX 年，某连锁快餐品牌的个别门店被曝光存在食品加工操作不规范及后厨卫生问题，包括食材掉落地面后继续使用、工作人员操作不规范，以及在食品加工区域进行不当清洁操作等。事件曝光后，涉事门店停业整改，相关监管部门对品牌总部进行约谈并开展检查。',
  },
  {
    id: 'mediumRareBurger10',
    no: '10',
    title: 'Medium Rare Burger',
    effectName: '火候正好',
    effects: {
      mediumRareBurger: true,
    },
    experience:
      '今日经历：你点了一个汉堡。店员问你要几分熟。你想起美食节目里的人总说：“真正的牛肉不能煎太老。”你点点头。你觉得自己很懂牛肉。',
    record:
      '事件记录：19XX年，某地区多个州暴发严重的食源性疾病疫情。调查最终将病例与一家快餐连锁店销售的汉堡联系起来，受污染的碎牛肉以及烹饪温度不足被认为是事件的重要因素。超过700人患病，其中多数为儿童，最终造成4名儿童死亡。事件之后，美国进一步加强了针对碎牛肉和餐饮烹饪温度的食品安全监管。',
  },
  {
    id: 'wildMushroom11',
    no: '11',
    title: '野生蘑菇，应该能吃',
    effectName: '蘑菇时间',
    effects: {
      vForce: 1.25,
    },
    experience:
      '今日经历：路边长着几朵颜色非常漂亮的蘑菇。你拍照识图。软件说：“疑似可食用，准确率87%。”87%已经很高了。你吃了。',
    record:
      '事件记录：部分野生蘑菇含有能够影响中枢神经系统的活性成分，摄入后可能出现视觉、空间感知及意识状态异常。部分地区也长期存在因误食野生蘑菇导致中毒的案例。',
  },
  {
    id: 'falseCod07',
    no: '07',
    title: '此鳕鱼非鳕鱼',
    effectName: '油性反应',
    effects: {
      launchMul: 1.24,
      speedPushMul: 1.18,
      glideMul: 1.35,
      riskIncMul: 1.65,
    },
    experience:
      '今日经历：你点了一份香煎鳕鱼。肉质雪白、口感油润，价格还只有别家的三分之一。你从来没吃过真正的鳕鱼，所以它当然就是鳕鱼。',
    record:
      '事件记录：20XX 年，某地区陆续有消费者在食用标称“鳕鱼”的产品后出现油性排泄等胃肠道症状。调查发现，部分相关产品实际为富含蜡酯的其他鱼类。由于人体难以消化这些蜡酯，食用后可能出现油性腹泻。此后当地针对相关鱼种的命名及标签问题发布了专门指引。',
  },
  {
    id: 'freshFish03',
    no: '03',
    title: '今日鲜鱼',
    effectName: '重金属膨胀',
    tintMode: 'rainbow',
    scale: 1.38,
    effects: {
      hForce: 1.42,
      vForce: 1.42,
      speedMul: 0.72,
    },
    experience:
      '今日经历：老板说：“今天刚到的，新鲜得很。”你问是哪里来的。老板说：“海里。”无懈可击。你点了大份。',
    record:
      '事件记录：19XX 年，某沿海工业区长期向附近水域排放含重金属的废水。污染物进入水生生态系统，并在鱼类和贝类体内富集。长期食用当地水产品的居民随后出现严重神经系统疾病。',
  },
  {
    id: 'gooseLegAunt05',
    no: '05',
    title: '鹅腿阿姨，鸭腿本人',
    effectName: '绿色腌料',
    tint: '#58d84a',
    effects: {
      hForce: 0.55,
      vForce: 1.85,
      speedPushMul: 0.62,
    },
    experience:
      '今日经历：下班路上，你买了一只很火的烤鹅腿。附近的人都叫摊主“鹅腿阿姨”。\n\n你咬了一口用蔬菜汁腌制的鹅腿。很好吃。就是……有点像鸭。',
    record:
      '事件记录：20XX 年，某地一名长期以售卖烤制禽腿闻名的摊主，被消费者质疑实际使用了另一种禽类原料。摊主表示，早期确实使用过原称呼对应的食材，但后来供货变化，旧称呼一直沿用。相关部门随后介入核查。',
  },
];

let pendingEvent = null;

const EVENT_EN = {
  protein01: {
    title: 'Very Impressive Protein Numbers',
    effectName: 'Protein Reaction',
    experience: 'Today: Breakfast milk was on sale. The carton promised high protein, high nutrition, and strict testing. You could not read the report, but it had three check marks. You drank two cartons.',
    record: 'Case file: In the 20XXs, many infants in one region developed urinary problems after consuming contaminated dairy products. Investigators found that an industrial compound had been added to some products to fake higher protein readings under certain tests.',
  },
  pomegranateJuice06: {
    title: '100% Pomegranate Juice',
    effectName: '100% Mixed Juice',
    experience: 'Today: You bought a bottle that said "100% Pomegranate Juice." The label looked very honest and the ingredient list looked very shy. By the end, your tongue had seen every color.',
    record: 'Case file: Some products marketed as high-percentage or pure juice were later found to contain other juices, coloring, or sweeteners. Complicated supply chains and fuzzy labels made the real contents hard to judge.',
  },
  flintWater02: {
    title: 'Just Let It Sit for a Bit',
    effectName: 'Heavy Metal Reaction',
    experience: 'Today: The tap water tasted a little metallic. You searched online. The first answer said, "Totally normal. Let it sit for a bit." You waited two minutes. It still tasted weird. You drank it.',
    record: 'Case file: In the 20XXs, a city changed its public water source. Inadequate treatment corroded the pipes, allowing contaminants to enter residents\' drinking water. Many people had already been exposed before the problem was officially confirmed.',
  },
  secretSlop08: {
    title: 'Secret Street Slop',
    effectName: 'Gut Desync',
    experience: 'Today: A street vendor scooped something from a bucket you could not see the bottom of. You asked what it was. He said several words you did not understand and gave you a thumbs-up. Communication: perfect. You ordered the large.',
    record: 'Case file: Street-food sampling in one region found high microbial contamination in some ready-to-eat foods and sauces. Untreated water, long room-temperature storage, poor utensil cleaning, and repeated bare-hand contact can all raise risk.',
  },
  sprayPackage09: {
    title: 'The Spray Combo',
    effectName: 'Spray Warrior',
    experience: 'Today: You could not decide on lunch, so you opened a delivery app. Burgers, fried chicken, soda: too cheap to resist. One review said, "absolute bathroom warfare." You assumed people were being dramatic. You ordered the meal for two. For one.',
    record: 'Case file: In the 20XXs, individual stores of a fast-food chain were reported for poor food-handling and kitchen hygiene, including dropped ingredients, improper work practices, and unsafe cleaning behavior. Regulators later questioned the brand and inspected related operations.',
  },
  mediumRareBurger10: {
    title: 'Medium Rare Burger',
    effectName: 'Cooked Just Right',
    experience: 'Today: You ordered a burger. The cashier asked how you wanted it cooked. You remembered every food show saying real beef should never be overdone. You nodded. You felt like a beef expert.',
    record: 'Case file: In 19XX, a severe foodborne illness outbreak across multiple states was linked to hamburgers sold by a fast-food chain. Contaminated ground beef and insufficient cooking temperature were key factors. More than 700 people became ill, many of them children, and four children died. Afterward, U.S. food-safety rules for ground beef and restaurant cooking temperatures were strengthened.',
  },
  wildMushroom11: {
    title: 'Wild Mushrooms, Probably Fine',
    effectName: 'Mushroom Time',
    experience: 'Today: Some very pretty mushrooms were growing by the road. You used an image-recognition app. It said "possibly edible, 87% confidence." 87% is basically science. You ate them.',
    record: 'Case file: Some wild mushrooms contain active compounds that affect the central nervous system. Ingestion can alter vision, spatial perception, and consciousness. Many regions also have long histories of poisoning caused by mistaken mushroom identification.',
  },
  falseCod07: {
    title: 'This Cod Is Not Cod',
    effectName: 'Oily Reaction',
    experience: 'Today: You ordered pan-fried cod. Snow-white flesh, rich texture, and one third the usual price. You have never had real cod before, so naturally this was cod.',
    record: 'Case file: In the 20XXs, consumers in one region reported oily discharge and other gastrointestinal symptoms after eating products labeled as cod. Investigations found some products were actually wax-ester-rich fish that humans digest poorly.',
  },
  freshFish03: {
    title: 'Fresh Fish Today',
    effectName: 'Heavy Metal Belly',
    experience: 'Today: The boss said, "Arrived this morning. Very fresh." You asked where it came from. He said, "The sea." Airtight logic. You ordered the large.',
    record: 'Case file: In 19XX, an industrial coastal area discharged heavy-metal wastewater into nearby waters for years. Pollutants entered aquatic ecosystems and accumulated in fish and shellfish. Residents who regularly ate local seafood later developed severe neurological disease.',
  },
  gooseLegAunt05: {
    title: 'Auntie Goose Leg, Allegedly Goose',
    effectName: 'Green Marinade',
    experience: 'Today: On your way home, you bought a wildly popular roasted goose leg. Everyone nearby called the vendor "Goose Leg Auntie."\n\nYou took a bite of the vegetable-juice-marinated leg. Delicious. Just... surprisingly duck-shaped.',
    record: 'Case file: In the 20XXs, a well-known poultry-leg vendor was questioned by consumers over whether a different bird was being used. The vendor said the original ingredient had been used early on, but supply changed while the old name stuck. Local authorities later investigated.',
  },
};

for (const ev of FOOD_EVENTS) {
  if (EVENT_EN[ev.id]) ev.en = EVENT_EN[ev.id];
}

function eventText(ev, field) {
  return ev?.en && currentLang() === 'en' ? ev.en[field] : ev?.[field];
}

function drawEvent() {
  pendingEvent = FOOD_EVENTS[(Math.random() * FOOD_EVENTS.length) | 0];
  return pendingEvent;
}
function getFoodEventById(id) {
  return FOOD_EVENTS.find(ev => ev.id === id) || null;
}
function setPendingEventById(id) {
  pendingEvent = id ? getFoodEventById(id) : null;
  return pendingEvent;
}

function resetEventEffects() {
  state.activeFoodEvent = null;
  state.fartPower = 1;
  state.launchMul = 1;
  state.qteSpeedMul = 1;
  state.sprayAmountMul = 1;
  state.specialAmountMul = 1;
  state.incidentSprayMul = 1;
  state.incidentLaunchMul = 1;
  state.heavyGravityMul = 1;
  state.heavyLandingBoostT = 0;
  state.heavyLandingSquashT = 0;
  state.heavyLandingSquashPower = 0;
  state.juiceFartId = null;
  state.juiceFartColor = null;
  state.juiceFartH = 1;
  state.juiceFartV = 1;
  state.juiceFartRisk = 1;
  state.juiceFartFx = 1;
  state.pendingMediumRareZone = null;
  state.mushroomT = 0;
  state.mushroomRoll = 0;
  state.mushroomRollFrom = 0;
  state.mushroomRollTarget = 0;
  state.mushroomPhase = 'calm';
  state.mushroomPhaseT = 0;
  state.mushroomPhaseDur = 4;
  state.mushroomDir = 1;
  state.proteinQteT = 0;
  state.proteinBloatScale = 1;
  state.proteinBloatPower = 1;
  state.proteinDeflateT = 0;
  state.proteinLeakT = 0;
  state.slopTurnVel = 0;
  state.slopTurnT = 0;
  state.slopTrailT = 0;
  state.falseCodOilT = 0;
  state.falseCodSlipAngle = 0;
  state.falseCodSlipVel = 0;
  setCharacterScale(1);
  setCharacterTint(null);
}

function applyCurrentEventMultipliers() {
  const ev = state.activeFoodEvent;
  if (!ev) return;
  const effects = ev.effects || {};
  state.eff.hForce *= effects.hForce || 1;
  state.eff.vForce *= effects.vForce || 1;
  state.eff.riskIncMul *= effects.riskIncMul || 1;
  state.eff.speedMul *= effects.speedMul || 1;
  state.eff.qteMul *= effects.qteMul || 1;
  state.eff.capacity += effects.capacity || 0;
}

function applyEventEffects() {
  resetEventEffects();
  const ev = pendingEvent;
  if (!ev) return;
  state.activeFoodEvent = ev;
  state.fartPower *= ev.effects?.fartPower || 1;
  state.launchMul *= ev.effects?.launchMul || 1;
  state.qteSpeedMul *= ev.effects?.qteSpeedMul || 1;
  state.sprayAmountMul = ev.effects?.sprayAmountMul || 1;
  state.specialAmountMul = ev.effects?.specialAmountMul || state.sprayAmountMul || 1;
  state.incidentSprayMul = ev.effects?.incidentSprayMul || 1;
  state.incidentLaunchMul = ev.effects?.incidentLaunchMul || 1;
  state.heavyGravityMul = ev.effects?.heavyGravityMul || 1;
  applyCurrentEventMultipliers();
  if (ev.scale) setCharacterScale(ev.scale);
  if (ev.tint) setCharacterTint(ev.tint);
}

function clearCurrentEvent() {
  pendingEvent = null;
  resetEventEffects();
}

export { FOOD_EVENTS, pendingEvent, drawEvent, getFoodEventById, setPendingEventById, applyEventEffects, applyCurrentEventMultipliers, clearCurrentEvent, eventText };
