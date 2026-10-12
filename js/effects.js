// effects.js — 状態効果・スキル効果解決

const STATUS_DEFINITIONS = {
  breath: { name: '呼吸', category: 'buff', maxPower: 99, maxCount: 99, defaultPower: 0, defaultCount: 0 },
  bleed: { name: '出血', category: 'debuff', maxPower: 99, maxCount: 99, defaultPower: 0, defaultCount: 0 },
  tremor: { name: '振動', category: 'debuff', maxPower: 99, maxCount: 99, defaultPower: 0, defaultCount: 0, desc: '振動爆発を受けたとき、振動威力分だけ混乱閾値を上昇。幕終了時Count-1' },
  rupture: { name: '破裂', category: 'debuff', maxPower: 99, maxCount: 99, defaultPower: 0, defaultCount: 0, desc: '攻撃を受けたとき威力分の固定ダメージ。発動ごとにCount-1' },
  sinking: { name: '沈潜', category: 'debuff', maxPower: 99, maxCount: 99, defaultPower: 0, defaultCount: 0 },
  blood_feast: { name: '血宴強化', category: 'buff', maxPower: 99, maxCount: 1, defaultPower: 5, defaultCount: 0 },
  haste: { name: '迅速', category: 'buff', maxPower: 99, maxCount: 10, defaultPower: 0, defaultCount: 0, desc: 'Speed +X for this turn' },
  bind: { name: '束縛', category: 'debuff', maxPower: 99, maxCount: 10, defaultPower: 0, defaultCount: 0, desc: 'Speed -X for this turn' },
  attack_power_down: { name: '攻撃威力減少', category: 'debuff', maxPower: 99, maxCount: 10, defaultPower: 0, defaultCount: 0, desc: 'Attack Skill Final Power -X for this turn' },
  protection: { name: '保護', category: 'buff', maxPower: 99, maxCount: 10, defaultPower: 0, defaultCount: 0, desc: 'Take -(X*10)% damage this turn' },
  // 以下は E.G.O「過ぎし日」で使用（回数=スタック数）
  uninvited: { name: '招聘されざる者', category: 'debuff', maxPower: 0, maxCount: 2, defaultPower: 0, defaultCount: 0, valueFromCount: true, desc: '自分の沈潜威力1につき被ダメージ+0.5%（最大10%）。幕終了時に1減少。（最大2）' },
  curse: { name: '呪い', category: 'debuff', maxPower: 0, maxCount: 99, defaultPower: 0, defaultCount: 0, valueFromCount: true, desc: '幕終了時、次の幕に攻撃威力減少1・防御威力減少1・攻撃レベル減少2・防御レベル減少2のうちランダムに1つを受ける。回数-1。' },
  // 着影揮刀（blade_lineage.js）
  drink_fallen: { name: '追慕酒', category: 'buff', maxPower: 0, maxCount: 99, defaultPower: 0, defaultCount: 0, valueFromCount: true, desc: '幕開始時に呼吸威力+1/スタック（キムサッガのページは+2）。クリティカルダメージ+3%/スタック（最大15%）。呼吸を得るスキルのマッチ威力+1。致死ダメージで全消費し1スタックにつき最大HPの25%で復帰。幕終了時に1減少。' },
  resentful_scabbard: { name: '恨の宿った鞘', category: 'buff', maxPower: 0, maxCount: 1, defaultPower: 0, defaultCount: 0, valueFromCount: true, desc: '体力ダメージを受けると結ばれゆくしこりを得る。自分のスキルで得る/与える状態の威力・回数+2。「肉斬」使用中は体力が10未満に下がらず（1幕1回）マッチ威力-(呼吸威力÷2)。「骨断」使用時に呼吸4を得る。' },
  growing_resentment: { name: '結ばれゆくしこり', category: 'buff', maxPower: 0, maxCount: 999, defaultPower: 0, defaultCount: 0, valueFromCount: true, desc: '「骨断」の最終威力+(数値÷100)（最大6）。「肉斬」「骨断」の最後のコイン的中時、与ダメージ+(数値÷10)%して消滅。' },
  resentment: { name: '怨恨', category: 'buff', maxPower: 0, maxCount: 1, defaultPower: 0, defaultCount: 0, valueFromCount: true, desc: 'この幕、与えたダメージの10%を回復。' },
  // 黒獣-卯（rupture.js）
  strider_mao: { name: '脚力【卯】', category: 'buff', maxPower: 0, maxCount: 3, defaultPower: 0, defaultCount: 0, valueFromCount: true, desc: '幕終了時、次の幕に迅速5を得て1減少。（最大3）' },
  deathrite_haste: { name: '呪殺【迅速】', category: 'debuff', maxPower: 0, maxCount: 3, defaultPower: 0, defaultCount: 0, valueFromCount: true, desc: '速度10以上の相手の攻撃で破裂が発動するたび1減少し破裂回数+1。0になると破裂威力分の暴食ダメージを受けて消える。付与中は再付与されない。' },
  echoes_of_manor: { name: '邸宅の木霊', category: 'debuff', maxPower: 0, maxCount: 99, defaultPower: 0, defaultCount: 0, valueFromCount: true, desc: '沈潜の威力か回数を得るたび50%で沈潜回数+1。パニックタイプが「邸宅の木霊」になる。幕終了時に1減少。付与時は値を上書き。' },
  // 四本目のマッチの火・一生シチュー（teth_egos.js）
  burn: { name: '火傷', category: 'debuff', maxPower: 99, maxCount: 99, defaultPower: 0, defaultCount: 0, desc: '幕終了時、威力分の固定ダメージを受け、回数-1。' },
  blazing: { name: '燃え盛る', category: 'buff', maxPower: 0, maxCount: 2, defaultPower: 0, defaultCount: 0, valueFromCount: true, desc: '次の幕の終わりまで: 速度+1。その幕で最初に使う基本攻撃スキルの最終威力+2。そのスキルの的中ごとに最大HPの2%を失う（最大10%、混乱しない・HP1未満にならない）。' }
};

const BASIC_STATUS_IDS = [
  'attack_power_up','attack_power_down','defense_power_up','defense_power_down',
  'clash_power_up','clash_power_down','power_up','power_down','base_power_up',
  'offense_level_up','offense_level_down','defense_level_up','defense_level_down',
  'plus_coin_boost','plus_coin_drop','minus_coin_boost','minus_coin_drop',
  'multiply_coin_boost','multiply_coin_drop','damage_up','damage_down','fragile',
  'hp_healing_boost','hp_healing_down','ego_resource_amp',
  'slash_damage_up','pierce_damage_up','blunt_damage_up',
  'wrath_damage_up','lust_damage_up','sloth_damage_up','gluttony_damage_up','gloom_damage_up','pride_damage_up','envy_damage_up',
  'slash_damage_down','pierce_damage_down','blunt_damage_down',
  'wrath_damage_down','lust_damage_down','sloth_damage_down','gluttony_damage_down','gloom_damage_down','pride_damage_down','envy_damage_down',
  'slash_power_up','pierce_power_up','blunt_power_up',
  'wrath_power_up','lust_power_up','sloth_power_up','gluttony_power_up','gloom_power_up','pride_power_up','envy_power_up',
  'slash_power_down','pierce_power_down','blunt_power_down',
  'wrath_power_down','lust_power_down','sloth_power_down','gluttony_power_down','gloom_power_down','pride_power_down','envy_power_down',
  'slash_fragility','pierce_fragility','blunt_fragility',
  'wrath_fragility','lust_fragility','sloth_fragility','gluttony_fragility','gloom_fragility','pride_fragility','envy_fragility',
  'slash_protection','pierce_protection','blunt_protection',
  'wrath_protection','lust_protection','sloth_protection','gluttony_protection','gloom_protection','pride_protection','envy_protection',
  'slash_resist_down','pierce_resist_down','blunt_resist_down',
  'wrath_resist_down','lust_resist_down','sloth_resist_down','gluttony_resist_down','gloom_resist_down','pride_resist_down','envy_resist_down',
  'paralyze','poise','charge'
];

const BASIC_STATUS_DEFS = {
  attack_power_up:['攻撃威力増加','Attack Skill Final Power +X','buff'],
  attack_power_down:['攻撃威力減少','Attack Skill Final Power -X','debuff'],
  defense_power_up:['防御威力増加','Defense Skill Final Power +X','buff'],
  defense_power_down:['防御威力減少','Defense Skill Final Power -X','debuff'],
  clash_power_up:['マッチ威力増加','Clash Power +X','buff'],
  clash_power_down:['マッチ威力減少','Clash Power -X','debuff'],
  power_up:['威力増加','Skill Final Power +X','buff'],
  power_down:['威力減少','Skill Final Power -X','debuff'],
  base_power_up:['基礎威力増加','Skill Base Power +X','buff'],
  offense_level_up:['攻撃レベル増加','Offense Level +X','buff'],
  offense_level_down:['攻撃レベル減少','Offense Level -X','debuff'],
  defense_level_up:['防御レベル増加','Defense Level +X','buff'],
  defense_level_down:['防御レベル減少','Defense Level -X','debuff'],
  plus_coin_boost:['プラスコイン強化','Plus Coin Power +X','buff'],
  plus_coin_drop:['プラスコイン減少','Plus Coin Power -X','debuff'],
  minus_coin_boost:['マイナスコイン強化','Minus Coin Power +X','buff'],
  minus_coin_drop:['マイナスコイン減少','Minus Coin Power -X','debuff'],
  multiply_coin_boost:['乗算コイン強化','Multiply Coin Power +X','buff'],
  multiply_coin_drop:['乗算コイン減少','Multiply Coin Power -X','debuff'],
  damage_up:['与ダメージ増加','Deal +10% damage per Stack','buff'],
  damage_down:['与ダメージ減少','Deal -10% damage per Stack','debuff'],
  fragile:['脆弱','Take +10% damage per Stack','debuff'],
  hp_healing_boost:['HP回復量増加','Heal +10% per Stack','buff'],
  hp_healing_down:['HP回復量減少','Heal -10% per Stack','debuff'],
  ego_resource_amp:['E.G.O資源増幅','Gain additional E.G.O Resources when using skills','buff'],
  paralyze:['麻痺','Fix X Coin(s) to 0','debuff'],
  poise:['呼吸準備','Critical chance +5% per Potency for the next Count hits','buff'],
  charge:['充電','充電X。スキルで消費して効果を強化するリソース。幕終了時に1減少。','buff']
};
Object.entries(BASIC_STATUS_DEFS).forEach(([id,[name,desc,category]])=>{
  STATUS_DEFINITIONS[id]={ name, category, maxPower:99, maxCount:99, defaultPower:0, defaultCount:0, desc };
});
const VALUE_FROM_COUNT_STATUS_IDS = new Set([
  'charge',   // 充電: 回数=充電量（charge.js）
  'paralyze', // 麻痺: 回数=0にするコインの枚数（flipCoin が1枚ごとに1消費）
  'haste','bind','attack_power_up','attack_power_down','defense_power_up','defense_power_down',
  'clash_power_up','clash_power_down','power_up','power_down','base_power_up',
  'offense_level_up','offense_level_down','defense_level_up','defense_level_down',
  'plus_coin_boost','plus_coin_drop','minus_coin_boost','minus_coin_drop',
  'multiply_coin_boost','multiply_coin_drop','damage_up','damage_down','fragile',
  'hp_healing_boost','hp_healing_down','ego_resource_amp','protection',
  'slash_damage_up','pierce_damage_up','blunt_damage_up','slash_damage_down','pierce_damage_down','blunt_damage_down',
  'slash_power_up','pierce_power_up','blunt_power_up','slash_power_down','pierce_power_down','blunt_power_down',
  'slash_fragility','pierce_fragility','blunt_fragility','slash_protection','pierce_protection','blunt_protection',
  'slash_resist_down','pierce_resist_down','blunt_resist_down',
  'wrath_damage_up','lust_damage_up','sloth_damage_up','gluttony_damage_up','gloom_damage_up','pride_damage_up','envy_damage_up',
  'wrath_damage_down','lust_damage_down','sloth_damage_down','gluttony_damage_down','gloom_damage_down','pride_damage_down','envy_damage_down',
  'wrath_power_up','lust_power_up','sloth_power_up','gluttony_power_up','gloom_power_up','pride_power_up','envy_power_up',
  'wrath_power_down','lust_power_down','sloth_power_down','gluttony_power_down','gloom_power_down','pride_power_down','envy_power_down',
  'wrath_fragility','lust_fragility','sloth_fragility','gluttony_fragility','gloom_fragility','pride_fragility','envy_fragility',
  'wrath_protection','lust_protection','sloth_protection','gluttony_protection','gloom_protection','pride_protection','envy_protection',
  'wrath_resist_down','lust_resist_down','sloth_resist_down','gluttony_resist_down','gloom_resist_down','pride_resist_down','envy_resist_down'
]);
const DAMAGE_TYPES = ['slash','pierce','blunt'];
const DAMAGE_TYPE_LABELS = { slash: '斬撃', pierce: '貫通', blunt: '打撃' };
const STATUS_SINS = ['wrath','lust','sloth','gluttony','gloom','pride','envy'];
DAMAGE_TYPES.forEach(t=>{
  const tl = DAMAGE_TYPE_LABELS[t];
  STATUS_DEFINITIONS[`${t}_damage_up`] = {name:`${tl}ダメージ増加`,category:'buff',maxPower:10,maxCount:10,defaultPower:0,defaultCount:0,desc:`Deal +(X*10)% damage with ${t} skills this turn`};
  STATUS_DEFINITIONS[`${t}_damage_down`] = {name:`${tl}ダメージ減少`,category:'debuff',maxPower:10,maxCount:10,defaultPower:0,defaultCount:0,desc:`Deal -(X*10)% damage with ${t} skills this turn`};
  STATUS_DEFINITIONS[`${t}_power_up`] = {name:`${tl}威力増加`,category:'buff',maxPower:99,maxCount:1,defaultPower:0,defaultCount:0,desc:`${t} Skill Final Power +X for this turn`};
  STATUS_DEFINITIONS[`${t}_power_down`] = {name:`${tl}威力減少`,category:'debuff',maxPower:99,maxCount:1,defaultPower:0,defaultCount:0,desc:`${t} Skill Final Power -X for this turn`};
  STATUS_DEFINITIONS[`${t}_fragility`] = {name:`${tl}脆弱`,category:'debuff',maxPower:10,maxCount:10,defaultPower:0,defaultCount:0,desc:`Take +(X*10)% damage from ${t} skills this turn`};
  STATUS_DEFINITIONS[`${t}_protection`] = {name:`${tl}保護`,category:'buff',maxPower:10,maxCount:10,defaultPower:0,defaultCount:0,desc:`Take -(X*10)% damage from ${t} skills this turn`};
  STATUS_DEFINITIONS[`${t}_resist_down`] = {name:`${tl}耐性減少`,category:'debuff',maxPower:20,maxCount:20,defaultPower:0,defaultCount:0,desc:`Increase ${t} Resistance by 0.1 per Count`};
});
STATUS_SINS.forEach(s=>{
  const label = typeof SIN_LABELS!=='undefined' ? SIN_LABELS[s] : s;
  STATUS_DEFINITIONS[`${s}_damage_up`] = {name:`${label}ダメージ増加`,category:'buff',maxPower:10,maxCount:10,defaultPower:0,defaultCount:0,desc:`Deal +(X*10)% damage with ${label} skills this turn`};
  STATUS_DEFINITIONS[`${s}_damage_down`] = {name:`${label}ダメージ減少`,category:'debuff',maxPower:10,maxCount:10,defaultPower:0,defaultCount:0,desc:`Deal -(X*10)% damage with ${label} skills this turn`};
  STATUS_DEFINITIONS[`${s}_power_up`] = {name:`${label}威力増加`,category:'buff',maxPower:99,maxCount:1,defaultPower:0,defaultCount:0,desc:`${label} Skill Final Power +X for this turn`};
  STATUS_DEFINITIONS[`${s}_power_down`] = {name:`${label}威力減少`,category:'debuff',maxPower:99,maxCount:1,defaultPower:0,defaultCount:0,desc:`${label} Skill Final Power -X for this turn`};
  STATUS_DEFINITIONS[`${s}_fragility`] = {name:`${label}脆弱`,category:'debuff',maxPower:10,maxCount:10,defaultPower:0,defaultCount:0,desc:`Take +(X*10)% damage from ${label} skills this turn`};
  STATUS_DEFINITIONS[`${s}_protection`] = {name:`${label}保護`,category:'buff',maxPower:10,maxCount:10,defaultPower:0,defaultCount:0,desc:`Take -(X*10)% damage from ${label} skills this turn`};
  STATUS_DEFINITIONS[`${s}_resist_down`] = {name:`${label}耐性減少`,category:'debuff',maxPower:20,maxCount:20,defaultPower:0,defaultCount:0,desc:`Increase ${label} Resistance by 0.1 per Count`};
});

// 注意: 攻撃タイプ別・罪悪属性別の定義（下のループ）より後に適用すること。
// 以前はループより前に適用していたため、「斬撃脆弱」「斬撃威力増加」等が上書きされて
// valueFromCount を失い、効果量が常に0になっていた。
VALUE_FROM_COUNT_STATUS_IDS.forEach(id => {
  if (STATUS_DEFINITIONS[id]) STATUS_DEFINITIONS[id].valueFromCount = true;
});

function getStatus(player, statusId) {
  if (!gameState[player].statuses) gameState[player].statuses = {};
  return gameState[player].statuses[statusId] || null;
}
function ensureStatus(player, statusId) {
  if (!gameState[player].statuses) gameState[player].statuses = {};
  const def = STATUS_DEFINITIONS[statusId];
  if (!def) return null;
  if (!gameState[player].statuses[statusId]) {
    gameState[player].statuses[statusId] = { id: statusId, name: def.name, category: def.category, power: def.defaultPower, count: def.defaultCount };
  }
  return gameState[player].statuses[statusId];
}
function clampStatusValue(value, max) { return Math.max(0, Math.min(max, value)); }
function normalizeStatus(statusId, status) {
  const def = STATUS_DEFINITIONS[statusId];
  if (!def || !status) return;
  status.power = clampStatusValue(status.power, def.maxPower);
  status.count = clampStatusValue(status.count, def.maxCount);
  // 呼吸は回数0で消える（威力も0）。回数だけ付与した場合の威力1補完は changeStatusCount の autoFill が担当。
  if (statusId === 'breath' && status.count <= 0) status.power = 0;
  if (statusId === 'poise' && status.count <= 0) status.power = 0;
}
// 威力と回数を両方持つ状態異常。原作では、威力だけを付与されて回数が0なら回数1、
// 回数だけを付与されて威力が0なら威力1になる（威力と回数を同時に付与する効果では補完しない）。以前はこの補完がなく、
// 「出血威力2」等の威力のみ付与するカードが回数0のまま一度も発動しない不具合があった。
const POTENCY_COUNT_STATUS_IDS = new Set(['bleed', 'sinking', 'tremor', 'rupture', 'breath', 'burn']);
function changeStatusCount(player, statusId, delta, autoFill = true) {
  const status = ensureStatus(player, statusId);
  if (!status) return null;
  const before = status.count;
  status.count = clampStatusValue(status.count + delta, statusId === 'charge' ? getChargeCap(player) : STATUS_DEFINITIONS[statusId].maxCount);
  if (autoFill && delta > 0 && POTENCY_COUNT_STATUS_IDS.has(statusId) && status.power <= 0) status.power = 1;
  normalizeStatus(statusId, status);
  return { status, before, after: status.count };
}
function changeStatusPower(player, statusId, delta, autoFill = true) {
  const status = ensureStatus(player, statusId);
  if (!status) return null;
  const before = status.power;
  status.power = clampStatusValue(status.power + delta, STATUS_DEFINITIONS[statusId].maxPower);
  if (autoFill && delta > 0 && POTENCY_COUNT_STATUS_IDS.has(statusId) && status.count <= 0) status.count = 1;
  normalizeStatus(statusId, status);
  return { status, before, after: status.power };
}
function expireStatusIfEmpty(player, statusId) {
  const status = getStatus(player, statusId);
  if (!status) return;
  normalizeStatus(statusId, status);
  if (status.count <= 0 && status.power <= 0) delete gameState[player].statuses[statusId];
}
function generateEgoResourceForSkill(player, skill, slot = null) {
  if (!skill?.sin || skill?.isEgo || skill?.skillType === 'counter_clash') return;
  if (slot && slot.egoResourceGenerated) return;
  const amount = 1 + getActiveStatusPower(player,'ego_resource_amp');
  addEgoResource(player, skill.sin, amount);
  if (slot) slot.egoResourceGenerated = true;
}
function addEgoResource(player, sin, amount = 1) {
  const p = gameState[player];
  if (!p.egoResources || !SIN_TYPES.includes(sin)) return;
  const before = p.egoResources[sin] || 0;
  p.egoResources[sin] = Math.min(MAX_EGO_RESOURCE, before + amount);
  log(`[罪悪資源] ${playerLabel(player)}の${getSinLabel(sin)} ${before}→${p.egoResources[sin]}`);
}
function canPayEgoResource(player, cost) {
  return Object.entries(cost || {}).every(([sin,n]) => (gameState[player].egoResources?.[sin] || 0) >= n);
}
function payEgoResource(player, cost) {
  if (!canPayEgoResource(player,cost)) return false;
  Object.entries(cost || {}).forEach(([sin,n]) => gameState[player].egoResources[sin] = Math.max(0,(gameState[player].egoResources[sin]||0)-n));
  return true;
}
function getActiveStatusPower(player, id) {
  const s = getStatus(player, id);
  if (!s || s.count <= 0) return 0;
  return STATUS_DEFINITIONS[id]?.valueFromCount ? (s.count || 0) : (s.power || 0);
}
function addCombatStatus(player, statusId, amount = 1, duration = 1) {
  const s = ensureStatus(player, statusId);
  if (!s) return null;
  const def = STATUS_DEFINITIONS[statusId];
  const beforePower=s.power||0, beforeCount=s.count||0;
  if (def.valueFromCount) {
    s.count=clampStatusValue(beforeCount+amount, def.maxCount);
  } else {
    s.power=clampStatusValue(beforePower+amount, def.maxPower);
    s.count=Math.max(0, Math.min(def.maxCount, Math.max(beforeCount, duration)));
  }
  return {status:s,beforePower,beforeCount};
}
function getResonanceCounts(player) {
  const counts = Object.fromEntries(SIN_TYPES.map(s => [s, 0]));
  const slots = gameState[player]?.slots || [];
  slots.forEach(slot => { const sin = slot?.card?.sin; if (sin && SIN_TYPES.includes(sin)) counts[sin]++; });
  return counts;
}
function getResonanceCount(player, sin) { return getResonanceCounts(player)[sin] || 0; }
function hasResonance(player, sin) { return getResonanceCount(player, sin) >= 2; }
function getResonanceInfo(player) { const counts = getResonanceCounts(player); return { counts, active: SIN_TYPES.filter(s => counts[s] >= 2) }; }

function getSkillFinalPowerModifier(player, skill) {
  if (!skill) return 0;
  let m = getActiveStatusPower(player,'power_up') - getActiveStatusPower(player,'power_down');
  if (skill.skillType === 'attack' || skill.skillType === 'counter') m += getActiveStatusPower(player,'attack_power_up') - getActiveStatusPower(player,'attack_power_down');
  if (skill.skillType === 'defense' || skill.skillType === 'evade') m += getActiveStatusPower(player,'defense_power_up') - getActiveStatusPower(player,'defense_power_down');
  if (skill.attackType) {
    m += getActiveStatusPower(player,skill.attackType+'_power_up') - getActiveStatusPower(player,skill.attackType+'_power_down');
  }
  if (skill.sin) m += getActiveStatusPower(player,skill.sin+'_power_up') - getActiveStatusPower(player,skill.sin+'_power_down');
  return m;
}
function getSkillBasePowerBonus(player) {
  return getActiveStatusPower(player,'base_power_up');
}
function getClashPowerModifier(player) {
  return getActiveStatusPower(player,'clash_power_up') - getActiveStatusPower(player,'clash_power_down');
}
function getEffectiveCoinPower(player, skill, coinPower) {
  let cp=coinPower||0;
  const positive=cp>=0;
  const id=positive ? 'plus_coin_boost' : 'minus_coin_boost';
  const down=positive ? 'plus_coin_drop' : 'minus_coin_drop';
  cp += getActiveStatusPower(player,id) - getActiveStatusPower(player,down);
  cp += getBreathCoinPowerBonus(player, skill);
  cp += getChargeCoinPowerBonus(player, skill) + getExecBonus(player, skill, 'coinPower');
  return cp;
}
// 呼吸（LCBのPoise）威力に応じたコイン威力ボーナス。
//   skill.breathCoinBonus = { min: 5, bonus: 1 } … 自分の呼吸威力が min 以上ならコイン威力+bonus
//   core.breathCoinPowerPer5 = N               … 呼吸威力5ごとにコイン威力+1（最大N）
function getBreathCoinPowerBonus(player, skill) {
  const breath = getStatus(player, 'breath');
  const potency = (breath && breath.count > 0) ? (breath.power || 0) : 0;
  if (potency <= 0) return 0;
  let bonus = 0;
  const sb = skill?.breathCoinBonus;
  if (sb && potency >= sb.min) bonus += sb.bonus;
  const core = gameState[player]?.core;
  if (core?.breathCoinPowerPer5) bonus += Math.min(core.breathCoinPowerPer5, Math.floor(potency / 5));
  if (core?.breathCoinThreshold && potency >= core.breathCoinThreshold.min && (skill?.skillType === 'attack' || skill?.skillType === 'counter')) bonus += core.breathCoinThreshold.bonus;
  return bonus;
}
function getOffenseLevel(player, skill) {
  const base=gameState[player]?.core?.offenseLevel || 0;
  return base + (gameState[player]?.core?.offenseLevelBonus || 0) + (gameState[player]?.egoPassiveOffenseBonus || 0) + getActiveStatusPower(player,'offense_level_up') - getActiveStatusPower(player,'offense_level_down');
}
function getDefenseLevel(player, skill) {
  const base=gameState[player]?.core?.defenseLevel || 0;
  return base + (gameState[player]?.core?.defenseLevelBonus || 0) + getActiveStatusPower(player,'defense_level_up') - getActiveStatusPower(player,'defense_level_down');
}
function getSkillCombatLevel(player, skill) {
  return (skill?.skillType === 'defense' || skill?.skillType === 'evade') ? getDefenseLevel(player,skill) : getOffenseLevel(player,skill);
}
function getDamageOutputMultiplier(player, attackType, sin) {
  let bonus = getActiveStatusPower(player,'damage_up') - getActiveStatusPower(player,'damage_down');
  if (sin === 'envy' && gameState[player]?.activeEgoPassives?.includes('ego_don_scissors_passive')) {
    // 嫉妬スキルの与ダメージ+10%、嫉妬共鳴が発生していればさらに+5%（bonus は10%単位）。
    // 旧実装の 1.10 と共鳴数×0.01 は、実質 +11% と +0.1%/共鳴 になっていたため修正。
    bonus += 1.0;
    if (hasResonance(player, 'envy')) bonus += 0.5;
  }
  if (attackType) bonus += getActiveStatusPower(player,attackType+'_damage_up') - getActiveStatusPower(player,attackType+'_damage_down');
  if (sin) bonus += getActiveStatusPower(player,sin+'_damage_up') - getActiveStatusPower(player,sin+'_damage_down');
  return Math.max(0, 1 + 0.1 * bonus);
}
function getDamageTakenMultiplier(player, attackType, sin) {
  let bonus = getActiveStatusPower(player,'fragile') - getActiveStatusPower(player,'protection');
  if (attackType) {
    bonus += getActiveStatusPower(player,attackType+'_fragility') - getActiveStatusPower(player,attackType+'_protection');
  }
  if (sin) {
    bonus += getActiveStatusPower(player,sin+'_fragility') - getActiveStatusPower(player,sin+'_protection');
  }
  // 招聘されざる者: 自分の沈潜威力1につき +0.5%（最大10%）。bonus は10%単位なので 0.05/威力、最大1.0
  if (getActiveStatusPower(player,'uninvited') > 0) {
    bonus += Math.min(1, 0.05 * (getStatus(player,'sinking')?.power || 0));
  }
  return Math.max(0, 1 + 0.1 * bonus);
}
function getResistanceWithDown(player, attackType, sin) {
  const core=gameState[player]?.core;
  const base=core?.res?.[attackType] ?? 1;
  let add = attackType ? getActiveStatusPower(player,attackType+'_resist_down') : 0;
  add += sin ? getActiveStatusPower(player,sin+'_resist_down') : 0;
  return base + 0.1 * add;
}

function getSpeedStatusModifier(player) {
  return getActiveStatusPower(player,'haste') - getActiveStatusPower(player,'bind') + (getActiveStatusPower(player,'blazing') > 0 ? 1 : 0);
}
function getEffectiveSkillPowerModifier(player) { return getSkillFinalPowerModifier(player, { skillType:'attack' }); }
function getProtectionMultiplier(player) { return getDamageTakenMultiplier(player); }
function addStatusNextTurn(player, statusId, amount = 1, duration = 1) {
  const p=gameState[player];
  if (!p.pendingStatuses) p.pendingStatuses = {};
  const existing=p.pendingStatuses[statusId] || { amount:0, duration:0 };
  existing.amount = Math.min(99, existing.amount + amount);
  existing.duration = Math.max(existing.duration, duration);
  p.pendingStatuses[statusId] = existing;
  return existing;
}
function applyPendingStatuses(player) {
  const p=gameState[player];
  const pending=p.pendingStatuses || {};
  Object.entries(pending).forEach(([statusId, data])=>{
    const applied=addCombatStatus(player,statusId,data.amount,data.duration);
    if(applied){
      log(`[次幕] ${playerLabel(player)}の「${applied.status.name}」 ${data.amount}を付与。`);
    }
  });
  p.pendingStatuses = {};
}
function processStatusTurnEnd(player) {
  const statuses = gameState[player].statuses || {};
  Object.keys(statuses).forEach(statusId => {
    const status = statuses[statusId];
    if (!status) return;
    if (statusId === 'breath' && status.count > 0) {
      status.count = Math.max(0, status.count - 1);
      normalizeStatus(statusId, status);
      if (status.count <= 0) delete statuses[statusId];
      else log(`[状態減衰] ${playerLabel(player)}の「${status.name}」: 回数 ${status.count}`);
    } else if (['haste','bind','attack_power_down','protection'].includes(statusId) && status.count > 0) {
      delete statuses[statusId];
      log(`[状態減衰] ${playerLabel(player)}の「${status.name}」が終了`);
    } else if (statusId === 'charge' && status.count > 0) {
      status.count = Math.max(0, status.count - 1);
      if (status.count <= 0) delete statuses[statusId];
      else log(`[状態減衰] ${playerLabel(player)}の「${status.name}」: 回数 ${status.count}`);
    } else if (BASIC_STATUS_IDS.includes(statusId) && statusId !== 'poise' && statusId !== 'charge' && status.count > 0) {
      delete statuses[statusId];
      log(`[状態減衰] ${playerLabel(player)}の「${status.name}」が終了`);
    } else if (statusId === 'blood_feast' && status.count > 0) {
      delete statuses[statusId];
      log(`[状態減衰] ${playerLabel(player)}の「${status.name}」が終了`);
    } else if (statusId === 'curse' && status.count > 0) {
      const options = [['attack_power_down',1],['defense_power_down',1],['offense_level_down',2],['defense_level_down',2]];
      const [id, amount] = options[Math.floor(Math.random() * options.length)];
      addStatusNextTurn(player, id, amount, 1);
      log(`[呪い] ${playerLabel(player)}は次の幕に「${STATUS_DEFINITIONS[id].name}」${amount}を受ける。`);
      status.count -= 1;
      if (status.count <= 0) delete statuses[statusId];
    } else if ((statusId === 'drink_fallen' || statusId === 'resentment' || statusId === 'resentful_scabbard') && status.count > 0) {
      status.count -= 1;
      if (status.count <= 0) delete statuses[statusId];
      else log(`[状態減衰] ${playerLabel(player)}の「${status.name}」: ${status.count}`);
    } else if (statusId === 'burn' && status.count > 0) {
      processBurnTurnEnd(player, status);
    } else if (statusId === 'blazing' && status.count > 0) {
      status.count -= 1;
      if (status.count <= 0) { delete statuses[statusId]; log(`[状態減衰] ${playerLabel(player)}の「${status.name}」が終了`); }
    } else if (statusId === 'strider_mao' && status.count > 0) {
      processStriderTurnEnd(player, status);
    } else if ((statusId === 'uninvited' || statusId === 'echoes_of_manor') && status.count > 0) {
      status.count -= 1;
      if (status.count <= 0) {
        delete statuses[statusId];
        log(`[状態減衰] ${playerLabel(player)}の「${status.name}」が終了`);
        if (statusId === 'echoes_of_manor') setPanicTypeOverride(player, null, '邸宅の木霊が終了');
      } else log(`[状態減衰] ${playerLabel(player)}の「${status.name}」: ${status.count}`);
    }
  });
}
function consumeStatusCount(player, statusId) {
  const status = getStatus(player, statusId);
  if (!status || status.count <= 0) return false;
  status.count = Math.max(0, status.count - 1);
  normalizeStatus(statusId, status);
  if (status.count <= 0 && statusId !== 'breath') delete gameState[player].statuses[statusId];
  return true;
}

function changeSanity(player, delta, reason = '') {
  const p = gameState[player];
  const before = p.sanity;
  p.sanity = Math.max(p.minSanity, Math.min(p.maxSanity, p.sanity + delta));
  if (p.sanity !== before) {
    const sign = delta >= 0 ? '+' : '';
    log(`[精神] ${playerLabel(player)} ${before}→${p.sanity} (${sign}${delta}${reason ? `: ${reason}` : ''})`);
  }
  return { before, after: p.sanity };
}

function getHeadsChance(player) {
  const sanity = gameState[player].sanity || 0;
  return Math.max(5, Math.min(95, 50 + sanity));
}

function triggerBleedOnAttackRoll(player) {
  const status = getStatus(player, 'bleed');
  if (!status || status.count <= 0 || status.power <= 0) return false;
  const damage = status.power;
  status.count = Math.max(0, status.count - 1);
  normalizeStatus('bleed', status);
  const p = gameState[player];
  const beforeHp = p.hp;
  const bleedHp = applyLethalGuard(player, damage);
  p.hp = Math.max(0, p.hp - bleedHp);
  onHpDamageTaken(player, bleedHp);
  log(`[状態ダメージ] ${playerLabel(player)}の「出血」: HP ${beforeHp}→${p.hp}（-${damage}） / 残り回数: ${status.count}`);
  emitHook('onDamage', { target: player, diceType: 'bleed', amount: damage, attacker: null });
  if (status.count <= 0) delete gameState[player].statuses.bleed;
  return true;
}

function markSinkingTarget(sourcePlayer, targetPlayer) {
  if (!gameState[sourcePlayer]) return;
  if (!gameState[sourcePlayer].sinkingMarkedTargets) gameState[sourcePlayer].sinkingMarkedTargets = {};
  gameState[sourcePlayer].sinkingMarkedTargets[targetPlayer] = true;
}

function triggerSinkingOnAttackReceived(target) {
  const status = getStatus(target, 'sinking');
  if (!status || status.count <= 0 || status.power <= 0) return false;
  const amount = status.power;
  changeSanity(target, -amount, '沈潜');
  status.count = Math.max(0, status.count - 1);
  normalizeStatus('sinking', status);
  log(`[状態効果] ${playerLabel(target)}の「沈潜」発動: 精神 ${gameState[target].sanity + amount}→${gameState[target].sanity}（-${amount}） / 残り回数: ${status.count}`);
  if (status.count <= 0) {
    delete gameState[target].statuses.sinking;
    log(`[状態解除] ${playerLabel(target)}の「沈潜」が解除されました`);
  }
  return true;
}

function consumeSinkingCount(target, count) {
  const status = getStatus(target, 'sinking');
  if (!status || status.count <= 0 || count <= 0) return { consumed: 0, power: 0 };
  const consumed = Math.min(count, status.count);
  const total = status.power * consumed;
  status.count -= consumed;
  normalizeStatus('sinking', status);
  if (status.count <= 0) {
    delete gameState[target].statuses.sinking;
    log(`[状態解除] ${playerLabel(target)}の「沈潜」が解除されました`);
  }
  return { consumed, power: total };
}

function getHitStatusTarget(player, effect) { return effect?.target === 'opponent' ? opponentOf(player) : player; }

function formatStatusEffectText(effect) {
  if (!effect) return '';
  const name = STATUS_DEFINITIONS[effect.id]?.name || effect.id;
  const suffix = effect.target === 'opponent' ? 'を与える' : 'を得る';
  const parts = [];
  if (effect.power) parts.push(`${name}威力${effect.power}${suffix}`);
  if (effect.count) parts.push(`${name}回数${effect.count}${suffix}`);
  return parts.join(' ');
}

function applyOnUseEffects(player, card) {
  if (!card?.onUse) return;
  if (card.onUse.light) {
    const p = gameState[player];
    const before = p.light;
    p.light = Math.min(p.maxLight, p.light + card.onUse.light);
    log(`[使用時] ${playerLabel(player)}の「${card.name}」: 光 ${before}→${p.light}`);
  }
  if (card.onUse.status) {
    const effect = card.onUse.status;
    const target = getHitStatusTarget(player, effect);
    if (effect.count) {
      const r = changeStatusCount(target, effect.id, effect.count);
      log(`[使用時] ${playerLabel(player)}の「${card.name}」: ${playerLabel(target)}の${STATUS_DEFINITIONS[effect.id]?.name || effect.id}回数 ${r.before}→${r.after}`);
    }
    if (effect.power) {
      const r = changeStatusPower(target, effect.id, effect.power);
      log(`[使用時] ${playerLabel(player)}の「${card.name}」: ${playerLabel(target)}の${STATUS_DEFINITIONS[effect.id]?.name || effect.id}威力 ${r.before}→${r.after}`);
    }
  }
  (card.onUse.statuses || []).forEach(effect => {
    const target = getHitStatusTarget(player, effect);
    const gb = getOwnStatusGainBonus(player); // 恨の宿った鞘
    if (effect.count) changeStatusCount(target, effect.id, effect.count + gb, !effect.power);
    if (effect.power) changeStatusPower(target, effect.id, effect.power + gb, !effect.count);
    log(`[使用時] ${playerLabel(player)}の「${card.name}」: ${formatStatusEffectText(effect)}`);
  });
  (card.onUse.nextTurnStatuses || []).forEach(st => {
    addStatusNextTurn(player, st.id, st.amount, 1);
    log(`[使用時] ${playerLabel(player)}の「${card.name}」: 次の幕に「${STATUS_DEFINITIONS[st.id]?.name || st.id}」${st.amount}`);
  });
  if (card.onUse.special === 'consume_charge_draw') {
    if (getCharge(player) >= card.onUse.chargeCost) {
      consumeCharge(player, card.onUse.chargeCost, `「${card.name}」`);
      for (let i = 0; i < card.onUse.draw; i++) drawCard(player);
      log(`[使用時] ${playerLabel(player)}の「${card.name}」: ${card.onUse.draw}枚引く`);
    }
  }
  if (card.onUse.special === 'overcharge') {
    gainCharge(player, getChargeCap(player), `「${card.name}」`);
    gameState[player].skipNextTurn = true;
    log(`[使用時] ${playerLabel(player)}の「${card.name}」: 次の幕は行動できない`);
  }
  if (card.onUse.special === 'slash_power_up_2turns') {
    addCombatStatus(player, 'slash_power_up', 1, 1); addStatusNextTurn(player, 'slash_power_up', 1, 1);
    log(`[使用時] ${playerLabel(player)}の「${card.name}」: 斬撃威力増加1（この幕と次の幕）`);
  }
  if (card.onUse.special === 'bloodletting_light') {
    const target = opponentOf(player);
    const bleed = getStatus(target, 'bleed');
    if (bleed?.power >= 3) {
      const p = gameState[player];
      const before = p.light;
      p.light = Math.min(p.maxLight, p.light + 2);
      log(`[使用時] ${playerLabel(player)}の「${card.name}」: ${playerLabel(target)}の出血威力が3以上のため光 ${before}→${p.light}`);
    }
  }
}

function addTremor(player, potency = 1, count = 1) { return addCombatStatus(player, 'tremor', potency, count); }
function addRupture(player, potency = 1, count = 1) { return addCombatStatus(player, 'rupture', potency, count); }
function triggerTremorBurst(player, multiplier = 1) {
  // 旧実装は存在しない p.stagger を加算していたため、HP閾値方式の共通処理に置き換え。
  // 上昇量は従来どおり「振動威力×倍率」のHP値（原作の正確な換算式は未確認）。
  const p = gameState[player], s = getStatus(player, 'tremor');
  if (!s || s.count <= 0 || s.power <= 0) return 0;
  const stagger = Math.floor(s.power * multiplier);
  s.count = Math.max(0, s.count - 1);
  if (s.count <= 0) delete p.statuses.tremor;
  log(`[振動爆発] ${playerLabel(player)} 混乱閾値+${stagger}`);
  adjustNextStaggerThreshold(player, stagger, '振動爆発');
  return stagger;
}
function triggerRupture(player) {
  const s = getStatus(player, 'rupture');
  if (!s || s.count <= 0 || s.power <= 0) return 0;
  const dmg = s.power;
  s.count = Math.max(0, s.count - 1);
  if (s.count <= 0) delete gameState[player].statuses.rupture;
  const p = gameState[player];
  const before = p.hp;
  const rupHp = applyLethalGuard(player, dmg);
  p.hp = Math.max(0, p.hp - rupHp);
  onHpDamageTaken(player, rupHp);
  log(`[破裂] ${playerLabel(player)} 固定ダメージ ${dmg}（HP ${before}→${p.hp}）`);
  if (!p.isStaggered && !p.staggerImmune) checkStaggerThresholds(player);
  return dmg;
}

function triggerOnHit(player, card, target = null, coin = null, slot = null, extra = {}) {
  if (!card) return;
  // flipCoin() の結果オブジェクトには威力・表裏などだけを持たせ、
  // 実際のコイン固有効果はカードの coins[index] から解決する。
  // 以前は coin.onHit を直接参照していたため、実戦時のコイン結果に効果が載らず、
  // 出血・沈潜・呼吸などのコイン固有On Hitデバフが発動しない不具合があった。
  const coinDefinition = (Number.isInteger(coin?.index) && card?.coins) ? card.coins[coin.index] : null;
  const coinOnHit = coinDefinition?.onHit;
  const effectSource = (coinOnHit && Object.keys(coinOnHit).length) ? coinOnHit : (card.onHit || null);
  const resolvedTarget = target || opponentOf(player);
  const ctx = {
    player, card, coin, target: resolvedTarget, slot,
    bleedBonus: 0, sinkingCountBonus: 0,
    bleedEffect: !!(effectSource?.status?.id === 'bleed' && effectSource.status.target === 'opponent'),
    sinkingEffect: !!(effectSource?.status?.id === 'sinking' && effectSource.status.target === 'opponent'),
    ...extra
  };
  if (ctx.sinkingEffect) markSinkingTarget(player, resolvedTarget);
  // 破裂はこの的中で発動させてから、このコインの効果を付与する（付与した破裂は次の的中から発動）。
  // 以前は付与の後に発動していたため、付与した直後の同じ的中で発動していた。
  if (triggerRupture(resolvedTarget) > 0) onRuptureTriggered(resolvedTarget, slot?.speed || 0);
  emitHook('onHit', ctx);

  const applyStatusEffect = (effect) => {
    if (!effect) return;
    if (effect.requireHeads && !coin?.heads) return; // 「表で的中時」の効果
    if (effect.requireUncracked && slot?._coinCracked) return; // 「破損せず的中時」（破壊不能コインのマッチ敗北後の攻撃では発動しない）
    if (effect.requireCharge && getCharge(player) < effect.requireCharge) return; // 充電N以上のときだけ
    if (effect.maxCharge != null && getCharge(player) > effect.maxCharge) return; // 充電N以下のときだけ
    const gb = getOwnStatusGainBonus(player); // 恨の宿った鞘（追慕パッシブ最大効果）
    if (gb) effect = { ...effect, power: effect.power ? effect.power + gb : effect.power, count: effect.count ? effect.count + gb : effect.count };
    // 「相手に与える」効果は実際に的中した対象へ（敵味方識別不可で自分を攻撃した場合は自分）
    const statusTarget = effect.target === 'opponent' ? resolvedTarget : player;
    let bonus = 0;
    if (effect.id === 'bleed' && effect.target === 'opponent') {
      bonus += ctx.bleedBonus || 0;
      if (slot?.bloodPactFirstPage) {
        const hitCount = gameState[player].bloodPactFirstPageHitCount || 0;
        bonus += 0;
        if (effect.count == null) {
          const extraCount = hitCount === 0 ? 2 : 1;
          const r = changeStatusCount(statusTarget, 'bleed', extraCount);
          log(`[的中] ${playerLabel(player)}の「${card.name}」: ${playerLabel(statusTarget)}に出血回数${extraCount}（血の掟: 最初のページ） ${r.before}→${r.after}`);
        }
        gameState[player].bloodPactFirstPageHitCount = hitCount + 1;
      }
    }
    if (effect.id === 'sinking' && effect.target === 'opponent') bonus += ctx.sinkingCountBonus || 0;

    // 回数→威力の順（呼吸は回数0だと威力が0に正規化されるため）
    if (effect.count) {
      const amount = effect.count + bonus;
      const r = changeStatusCount(statusTarget, effect.id, amount, !effect.power);
      log(`[的中] ${playerLabel(player)}の「${card.name}」: ${playerLabel(statusTarget)}の${STATUS_DEFINITIONS[effect.id]?.name || effect.id}回数 ${r.before}→${r.after}`);
    }
    if (effect.power) {
      const amount = effect.power + (effect.id === 'bleed' && effect.target === 'opponent' ? (ctx.bleedBonus || 0) : 0);
      const r = changeStatusPower(statusTarget, effect.id, amount, !effect.count);
      log(`[的中] ${playerLabel(player)}の「${card.name}」: ${playerLabel(statusTarget)}の${STATUS_DEFINITIONS[effect.id]?.name || effect.id}威力 ${r.before}→${r.after}${ctx.bleedBonus ? `（血の掟+${ctx.bleedBonus}）` : ''}`);
    }
    if (effect.id === 'sinking' && (effect.power || effect.count)) rollEchoesSinkingBonus(statusTarget);
  };

  if (effectSource?.status) applyStatusEffect(effectSource.status);
  (effectSource?.statuses || []).forEach(applyStatusEffect); // 1コインに複数の状態効果
  // 表で的中: 最後のコインの与ダメージ+X（さらば！）
  if (effectSource?.finalCoinBonusOnHeads && coin?.heads && slot) slot._finalCoinBonus = (slot._finalCoinBonus || 0) + effectSource.finalCoinBonusOnHeads;
  if (effectSource?.special === 'claim_bones_last') {
    changeStatusPower(resolvedTarget, 'bleed', 3);
    addStatusNextTurn(resolvedTarget, 'paralyze', 5, 1);
    log(`[的中] ${playerLabel(player)}の「${card.name}」: ${playerLabel(resolvedTarget)}に出血3、次の幕に麻痺5。`);
  }

  if (ctx.sinkingCountBonus) {
    const r = changeStatusCount(resolvedTarget, 'sinking', ctx.sinkingCountBonus);
    log(`[的中] ${playerLabel(player)}の「${card.name}」: ${playerLabel(resolvedTarget)}に沈潜回数${ctx.sinkingCountBonus}（沈む思考） ${r.before}→${r.after}`);
  }

  if (effectSource?.light) restoreLight(player, effectSource.light, `「${card.name}」的中`);
  if (effectSource?.draw) {
    for (let i = 0; i < effectSource.draw; i++) drawCard(player);
    log(`[的中] ${playerLabel(player)}の「${card.name}」: ${effectSource.draw}枚ドロー`);
  }
  if (effectSource?.special === 'ego_crows_eye') {
    const enemy=resolvedTarget;
    addCombatStatus(enemy,'attack_power_down',2,1);
    addStatusNextTurn(enemy,'bind',2,1);
    // 原作の「全味方に迅速3」は、1対1では使用者本人のみを対象とする（簡略化）。
    addStatusNextTurn(player,'haste',3,1);
    log(`[E.G.O] 烏瞰図: ${playerLabel(enemy)}へ攻撃威力減少2、次幕に束縛2。次幕に${playerLabel(player)}へ迅速3。`);
  }
  if (effectSource?.special === 'ego_don_scissors_hit') {
    addStatusNextTurn(resolvedTarget, 'power_down', 1, 1);
    addCombatStatus(resolvedTarget, 'bleed', 4, 1);
    log('[E.G.O] 私はチョキを出すね、そっちは？: 次幕に威力減少1、出血4。');
  }
  if (effectSource?.special === 'ego_don_scissors_corrosion_hit') {
    addStatusNextTurn(resolvedTarget, 'power_down', slot?._donCorrosionLoss ? 2 : 1, 1);
    addCombatStatus(resolvedTarget, 'bleed', 6, 1);
    log('[E.G.O侵蝕] 私はチョキを出すね、そっちは？: 次幕に威力減少1、出血6。');
  }
  if (effectSource?.special === 'ego_chains_others') {
    addStatusNextTurn(resolvedTarget,'bind',5,1);
    addStatusNextTurn(resolvedTarget,'attack_power_down',4,1);
    addStatusNextTurn(player,'bind',3,1);
    addStatusNextTurn(player,'attack_power_down',3,1);
    addStatusNextTurn(player,'protection',2,1);
    log(`[E.G.O] Chains of Others: 次幕に相手へ束縛5・攻撃威力減少4、自分へ束縛3・攻撃威力減少3・保護2。`);
  }
  if (effectSource?.special === 'ego_bygone_days_hit' || effectSource?.special === 'ego_bygone_days_corrosion_hit') {
    applyBygoneDaysHit(player, resolvedTarget, effectSource.special === 'ego_bygone_days_corrosion_hit');
  }
  applyInterloperReception(player, resolvedTarget);
  tethEgoOnHit(player, card); // 燃え盛る（teth_egos.js）
  if (effectSource?.special === 'blood_festival') {
    const bleed = getStatus(resolvedTarget, 'bleed');
    if (bleed?.power >= 3) { drawCard(player); log(`[的中] ${playerLabel(player)}の「${card.name}」: 出血威力3以上のため追加で1枚ドロー`); }
  }
  if (effectSource?.special === 'blood_feast') {
    const bleed = getStatus(resolvedTarget, 'bleed');
    if (bleed?.power >= 3) {
      const s = ensureStatus(player, 'blood_feast');
      s.power = 5; s.count = 1; normalizeStatus('blood_feast', s);
      log(`[的中] ${playerLabel(player)}の「${card.name}」: この幕のダメージ+5`);
    }
  }
  if (effectSource?.special === 'tremor_burst') triggerTremorBurst(resolvedTarget, effectSource.multiplier || 1);
  if (effectSource?.special === 'rupture_trigger' && triggerRupture(resolvedTarget) > 0) onRuptureTriggered(resolvedTarget, slot?.speed || 0);
  if (effectSource?.special === 'deathrite' || (effectSource?.special === 'deathrite_on_reuse' && slot?._reusedCoins?.[coin?.index])) applyDeathrite(resolvedTarget);
  if (effectSource?.selfHasteNext) gainSelfHasteNext(player, effectSource.selfHasteNext);
  if (effectSource?.special === 'abyss_draw_if_5') {
    const sinking = getStatus(resolvedTarget, 'sinking');
    if (sinking?.power >= 5) { for (let i = 0; i < 3; i++) drawCard(player); log(`[的中] ${playerLabel(player)}の「${card.name}」: 沈潜威力5以上のため3枚ドロー`); }
  }
}

// ===== E.G.O「過ぎし日」関連（データは data.js の ego_bygone_days）=====
// 邸宅の木霊: 沈潜の威力か回数を得るたび、50%で沈潜回数+1。
function rollEchoesSinkingBonus(target) {
  if (getActiveStatusPower(target, 'echoes_of_manor') <= 0) return;
  if (Math.random() >= 0.5) return;
  const r = changeStatusCount(target, 'sinking', 1);
  log(`[邸宅の木霊] ${playerLabel(target)}の沈潜回数+1 ${r.before}→${r.after}`);
}
// 「4以上の共鳴」等は、1対1（速度ダイス最大2）では憂鬱共鳴の発生で代用する。
function isBygoneGloomResonance(player) { return hasResonance(player, 'gloom'); }
function applyBygoneDaysHit(player, target, isCorrosion) {
  const name = isCorrosion ? '過ぎし日（侵蝕）' : '過ぎし日';
  if (isCorrosion) changeStatusCount(target, 'sinking', 2);
  else changeStatusPower(target, 'sinking', 3);
  rollEchoesSinkingBonus(target);
  addCombatStatus(target, 'curse', isCorrosion ? 1 : 2, 1);
  const un = ensureStatus(target, 'uninvited');
  un.count = Math.min(STATUS_DEFINITIONS.uninvited.maxCount, (un.count || 0) + 2);
  const parts = [isCorrosion ? '沈潜回数2' : '沈潜威力3', `呪い${isCorrosion ? 1 : 2}`, '招聘されざる者2'];
  if (isBygoneGloomResonance(player)) { addCombatStatus(target, 'gloom_fragility', 1, 1); parts.push('憂鬱脆弱1'); }
  if (isCorrosion) {
    // 付与時は値を上書き
    const ec = ensureStatus(target, 'echoes_of_manor'); ec.count = 2;
    setPanicTypeOverride(target, '邸宅の木霊', '邸宅の木霊');
    parts.push('邸宅の木霊2');
  }
  log(`[E.G.O] ${name}: ${playerLabel(target)}に${parts.join('・')}。`);
}
// E.G.Oパッシブ「招かざる客の出迎え」: 招聘されざる者を持つ相手に的中→自分の精神力+5（1幕1回）。
// 原作は「精神力が最も低い味方1人」だが、1対1では自分。
function applyInterloperReception(player, target) {
  const p = gameState[player];
  if (!p?.activeEgoPassives?.includes('ego_bygone_days_passive')) return;
  if (target === player || getActiveStatusPower(target, 'uninvited') <= 0) return;
  if (p.interloperUsedRound === gameState.round) return;
  p.interloperUsedRound = gameState.round;
  changeSanity(player, 5, '招かざる客の出迎え');
}
// スキルの攻撃前/攻撃終了時の処理。攻撃（一方攻撃・マッチ勝利後の攻撃）を行うときだけ呼ばれる。
function applyEgoBeforeAttack(attacker, skill) {
  tethEgoBeforeAttack(attacker, skill); // 四本目のマッチの火・一生シチュー（teth_egos.js）
  if (skill?.beforeAttack === 'ego_bygone_days_corrosion') {
    const p = gameState[attacker];
    const loss = Math.floor(p.maxHp * 0.10);
    const before = p.hp;
    p.hp = Math.max(1, p.hp - loss); // この減少では混乱判定をしない（checkStaggerThresholdsを呼ばない）
    log(`[E.G.O侵蝕] 過ぎし日: ${playerLabel(attacker)}は攻撃前にHPを失う ${before}→${p.hp}`);
  }
}
function applyEgoAttackEnd(attacker, skill, defender) {
  bladesingerAttackEnd(attacker, skill);
  tethEgoAttackEnd(attacker, skill);
  if (skill?.attackEnd === 'ego_bygone_days') {
    const p = gameState[attacker];
    const sinking = getStatus(defender, 'sinking');
    const sinkTotal = sinking ? (sinking.power || 0) + (sinking.count || 0) : 0;
    let heal = Math.min(Math.floor(p.maxHp * 0.20), Math.floor(p.maxHp * 0.10) + Math.floor(sinkTotal / 3));
    if (isBygoneGloomResonance(attacker)) heal += Math.floor(p.maxHp * 0.10);
    const before = p.hp;
    p.hp = Math.min(p.maxHp, p.hp + heal);
    log(`[E.G.O] 過ぎし日: 攻撃終了、${playerLabel(attacker)}のHP ${before}→${p.hp}（+${heal}）`);
  }
}

// ===== 烏瞰図・他人の鎖のE.G.Oパッシブ =====
function hasEgoPassive(player, id) { return !!gameState[player]?.activeEgoPassives?.includes(id); }
// 沈黙: 相手の弱点で攻撃したとき与ダメージ+20%（倍率で返す）
function getEgoPassiveDamageMultiplier(attacker, target, attackType, sin) {
  if (!hasEgoPassive(attacker, 'ego_crows_eye_view_passive')) return 1;
  const typeWeak = getResistanceWithDown(target, attackType, sin) > 1;
  const sinWeak = !!sin && (gameState[target].sinRes?.[sin] ?? 1) > 1;
  return (typeWeak || sinWeak) ? 1.2 : 1;
}
// 沈黙: 被弾時、次の幕に束縛3（1幕に1回）
function onEgoPassiveHit(target, attacker) {
  const p = gameState[target];
  if (!attacker || !hasEgoPassive(target, 'ego_crows_eye_view_passive')) return;
  if (p.silenceUsedRound === gameState.round) return;
  p.silenceUsedRound = gameState.round;
  addStatusNextTurn(target, 'bind', 3, 1);
  log(`[E.G.Oパッシブ] 沈黙: ${playerLabel(target)}は次の幕に束縛3を得る。`);
}
// 判断拒否: 戦闘開始時、相手のスキル2つ以上に指定されていれば保護3
// コアページの戦闘開始時パッシブ（W社職員(槍)「急速充電」）
function processCoreCombatStart(player) {
  const core = gameState[player]?.core;
  if (core?.combatStartCharge) {
    const n = hasResonance(player, 'gloom') ? core.combatStartCharge.gloomResonance : core.combatStartCharge.base;
    gainCharge(player, n, '急速充電');
  }
}
function processEgoPassivesCombatStart(player) {
  if (!hasEgoPassive(player, 'ego_chains_of_others_passive')) return;
  const enemy = opponentOf(player);
  const n = gameState[enemy].slots.filter(s => s.card && s.targetSlot?.owner === player).length;
  if (n >= 2) {
    addCombatStatus(player, 'protection', 3, 1);
    log(`[E.G.Oパッシブ] 判断拒否: ${playerLabel(player)}は${n}つのスキルに指定され、保護3を得る。`);
  }
}

// E.G.Oパッシブは使用（または侵蝕）した幕ではなく、次の幕から有効にする。
// ここで pendingEgoPassives に積み、processEgoTurnStart で activeEgoPassives へ移す。
// すでに有効なパッシブは重複して積まない。
function queueEgoPassive(player, passiveId) {
  const p = gameState[player];
  if (!passiveId || !p) return;
  if (!p.pendingEgoPassives) p.pendingEgoPassives = [];
  if (p.activeEgoPassives?.includes(passiveId) || p.pendingEgoPassives.includes(passiveId)) return;
  p.pendingEgoPassives.push(passiveId);
  log('[E.G.Oパッシブ] '+playerLabel(player)+'のE.G.Oパッシブは次の幕から有効になります。');
}

function processEgoTurnStart(player) {
  const p = gameState[player];
  if (p.pendingEgoPassives?.length) {
    p.activeEgoPassives = [...new Set([...(p.activeEgoPassives || []), ...p.pendingEgoPassives])];
    p.pendingEgoPassives = [];
    log('[E.G.Oパッシブ] '+playerLabel(player)+'のE.G.Oパッシブが発動。');
  }
  tethEgoTurnStart(player); // 貪る釜（teth_egos.js）
  if (p.activeEgoPassives?.includes('ego_don_scissors_passive')) {
    p.egoPassiveOffenseBonus = Math.min(3, Math.floor((p.cumulativeDamageTaken || 0) / 20));
    if (p.egoPassiveOffenseBonus > 0) log('[E.G.Oパッシブ] '+playerLabel(player)+'の攻撃レベル+'+p.egoPassiveOffenseBonus+'（累積被ダメージ/20）');
  } else p.egoPassiveOffenseBonus = 0;
}

function restoreLight(player, amount, reason) {
  const p = gameState[player];
  const before = p.light;
  p.light = Math.min(p.maxLight, p.light + amount);
  log(`[光] ${playerLabel(player)}の光 ${before}→${p.light}（${reason}）`);
}
function applySkillClashWinEffects(player, card, target) {
  tethEgoClashWin(player, card, target); // 残り火（teth_egos.js）
  const source = card?.onClashWin;
  if (!source) return;
  if (source.light) restoreLight(player, source.light, `「${card.name}」マッチ勝利`);
  if (source.status) {
    const effect = source.status;
    const targetPlayer = getHitStatusTarget(player, effect);
    if (effect.id === 'sinking' && effect.target === 'opponent') markSinkingTarget(player, targetPlayer);
    // 回数→威力の順（呼吸は回数0だと威力が0に正規化されるため）。恨の宿った鞘で+2
    const gb = getOwnStatusGainBonus(player);
    if (effect.count) changeStatusCount(targetPlayer, effect.id, effect.count + gb, !effect.power);
    if (effect.power) changeStatusPower(targetPlayer, effect.id, effect.power + gb, !effect.count);
    if (effect.id === 'sinking') rollEchoesSinkingBonus(targetPlayer);
    log(`[マッチ勝利] ${playerLabel(player)}の「${card.name}」: ${playerLabel(targetPlayer)}に${formatStatusEffectText(effect)}`);
  }
  if (source.special === 'dusk_draw_if_stagger_half') {
    // 旧条件「相手の混乱耐性が半分以下」は参照先(stagger/maxStagger)が消えて常に不成立だった。
    // HP閾値方式に合わせ「相手のHPが最大HPの半分以下」に置き換えた簡略化。
    const t = gameState[target];
    if (t.maxHp > 0 && t.hp <= t.maxHp / 2) {
      drawCard(player); log(`[マッチ勝利] ${playerLabel(player)}の「${card.name}」: 相手のHPが半分以下のため1枚ドロー`);
    }
  }
  if (source.special === 'slash_power_up_2turns') {
    addCombatStatus(player, 'slash_power_up', 1, 1); addStatusNextTurn(player, 'slash_power_up', 1, 1);
    log(`[マッチ勝利] ${playerLabel(player)}の「${card.name}」: 斬撃威力増加1（この幕と次の幕）`);
  }
  if (source.special === 'rain_consume_sinking_if_3') {
    const sinking = getStatus(target, 'sinking');
    if (sinking?.count >= 3) { consumeSinkingCount(target, 1); log(`[マッチ勝利] ${playerLabel(player)}の「${card.name}」: 沈潜回数を1消費`); }
  }
}

function getStatusTooltip(status) {
  if (!status) return '';
  if (status.id === 'breath') return `クリティカル確率: ${Math.min(100, status.power * 5)}%（威力×5%）<br>残り回数: ${status.count}<br>クリティカル時、ダメージ1.2倍（スキルの効果で増加）。幕終了時またはクリティカル発動時に回数-1。最大値: 威力99 / 回数99。`;
  if (status.id === 'bleed') return `攻撃コインを振るたび、威力分のダメージを受ける。発動時に回数-1。最大値: 威力99 / 回数99。`;
  if (status.id === 'tremor') return `振動${status.power} / Count${status.count}。振動爆発時、振動威力分だけ混乱閾値を上昇。幕終了時Count-1。`;
  if (status.id === 'rupture') return `破裂${status.power} / Count${status.count}。攻撃を受けたとき固定ダメージ${status.power}を与え、Count-1。`;
  if (status.id === 'sinking') return `沈潜X / 回数Y。攻撃を受けたとき精神をX減少し、回数を1減少。最大値: 威力99 / 回数99。`;
  if (status.id === 'charge') return `充電 ${status.count}。スキルで消費して効果を強化するリソース。幕終了時に1減少。`;
  if (status.id === 'blood_feast') return `この幕、ダメージ+${status.power}。幕終了時に解除。`;
  const def = STATUS_DEFINITIONS[status.id];
  if (def?.desc) {
    const value = def.valueFromCount ? status.count : status.power;
    return def.desc.replaceAll('X', String(value)).replaceAll('Y', String(status.count));
  }
  return `${status.name}<br>威力: ${status.power}<br>回数: ${status.count}`;
}

function getSkillHitEffectTexts(card, coin) {
  const source = coin?.onHit || card?.onHit || null;
  if (!source) return [];
  const texts = [];
  [source.status, ...(source.statuses || [])].filter(Boolean).forEach(st => { const t = formatStatusEffectText(st); if (t) texts.push(`${st.requireHeads ? '【表で的中】' : st.requireUncracked ? '【破損せず的中】' : '【的中】'}${st.requireCharge ? `充電${st.requireCharge}以上なら` : ''}${t}`); });
  if (source.light) texts.push(`【的中】光を${source.light}回復`);
  if (source.lowHpDamageBonus) texts.push(`【的中】相手のHPが${Math.round(source.lowHpDamageBonus.below*100)}%未満なら与ダメージ+${Math.round(source.lowHpDamageBonus.bonus*100)}%`);
  if (source.finalCoinBonusOnHeads) texts.push(`【表で的中】最後のコインの与ダメージ+${Math.round(source.finalCoinBonusOnHeads * 100)}%`);
  if (source.critDamageBonus) texts.push(`【クリティカル】ダメージ+${Math.round(source.critDamageBonus * 100)}%`);
  if (source.reuseAtSpeed) texts.push(`【的中】自分の速度が${source.reuseAtSpeed}以上ならこのコインを1回再使用`);
  if (source.speedDamageBonus) texts.push(`【的中】自分の速度が${source.speedDamageBonus.speed}以上なら与ダメージ+${Math.round(source.speedDamageBonus.bonus*100)}%`);
  if (source.selfHasteNext) texts.push(`【的中】次の幕に迅速${source.selfHasteNext}を得る（1幕2回まで）`);
  if (source.special === 'deathrite') texts.push('【的中】呪殺【迅速】を与える');
  if (source.special === 'deathrite_on_reuse') texts.push('【再使用時の的中】呪殺【迅速】を与える');
  if (source.special === 'claim_bones_last') texts.push('【的中】出血3・次の幕に麻痺5を与える');
  if (source.special === 'blood_festival') texts.push('【的中】相手の出血威力が3以上なら、追加で1枚引く');
  if (source.special === 'blood_feast') texts.push('【的中】相手の出血威力が3以上なら、この幕のダメージ+5');
  if (source.special === 'sunken_memory_reuse') texts.push('【的中】相手の沈潜威力が4以上なら、このコインを最大3回まで再使用');
  if (source.special === 'abyss_draw_if_5') texts.push('【的中】相手の沈潜威力が5以上なら、3枚引く');
  if (source.special === 'ego_bygone_days_hit') texts.push('【的中】沈潜威力3・呪い2・招聘されざる者2（憂鬱共鳴時: 憂鬱脆弱1）');
  if (source.special === 'ego_bygone_days_corrosion_hit') texts.push('【的中】沈潜回数2・呪い1・招聘されざる者2・邸宅の木霊2（憂鬱共鳴時: 憂鬱脆弱1）');
  if (source.special === 'underwater_consume_sinking') texts.push('【的中】相手の沈潜回数を最大3消費し、解除した沈潜威力×回数だけ威力増加');
  return texts;
}

// 旧UI/イベント名との互換エイリアス
function getDiceHitEffectTexts(card, dice) { return getSkillHitEffectTexts(card, dice); }
function getDiceHitEffectHtml(card, dice) {
  const texts = getSkillHitEffectTexts(card, dice);
  if (!texts.length) return '';
  return `<div class="dice-hit-effects">${texts.map(t => `<div>${t}</div>`).join('')}</div>`;
}
