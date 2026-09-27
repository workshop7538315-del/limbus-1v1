// effects.js — 状態効果・スキル効果解決

const STATUS_DEFINITIONS = {
  breath: { name: '呼吸', category: 'buff', maxPower: 99, maxCount: 99, defaultPower: 0, defaultCount: 0 },
  bleed: { name: '出血', category: 'debuff', maxPower: 99, maxCount: 99, defaultPower: 0, defaultCount: 0 },
  sinking: { name: '沈潜', category: 'debuff', maxPower: 99, maxCount: 99, defaultPower: 0, defaultCount: 0 },
  blood_feast: { name: '血宴強化', category: 'buff', maxPower: 99, maxCount: 1, defaultPower: 5, defaultCount: 0 },
  haste: { name: '迅速', category: 'buff', maxPower: 99, maxCount: 10, defaultPower: 0, defaultCount: 0 },
  bind: { name: '束縛', category: 'debuff', maxPower: 99, maxCount: 10, defaultPower: 0, defaultCount: 0 },
  attack_power_down: { name: '攻撃威力減少', category: 'debuff', maxPower: 99, maxCount: 10, defaultPower: 0, defaultCount: 0 },
  protection: { name: '保護', category: 'buff', maxPower: 99, maxCount: 10, defaultPower: 0, defaultCount: 0 }
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
  charge:['充電','Resource for Charge skills; lose 1 Count at turn end','buff']
};
Object.entries(BASIC_STATUS_DEFS).forEach(([id,[name,desc,category]])=>{
  STATUS_DEFINITIONS[id]={ name, category, maxPower:99, maxCount:99, defaultPower:0, defaultCount:0, desc };
});
const VALUE_FROM_COUNT_STATUS_IDS = new Set([
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
VALUE_FROM_COUNT_STATUS_IDS.forEach(id => {
  if (STATUS_DEFINITIONS[id]) STATUS_DEFINITIONS[id].valueFromCount = true;
});
const DAMAGE_TYPES = ['slash','pierce','blunt'];
const STATUS_SINS = ['wrath','lust','sloth','gluttony','gloom','pride','envy'];
DAMAGE_TYPES.forEach(t=>{
  STATUS_DEFINITIONS[`${t}_damage_up`] = {name:`${t}ダメージ増加`,category:'buff',maxPower:10,maxCount:10,defaultPower:0,defaultCount:0,desc:`Deal +(X*10)% damage with ${t} skills this turn`};
  STATUS_DEFINITIONS[`${t}_damage_down`] = {name:`${t}ダメージ減少`,category:'debuff',maxPower:10,maxCount:10,defaultPower:0,defaultCount:0,desc:`Deal -(X*10)% damage with ${t} skills this turn`};
  STATUS_DEFINITIONS[`${t}_power_up`] = {name:`${t}威力増加`,category:'buff',maxPower:99,maxCount:1,defaultPower:0,defaultCount:0,desc:`${t} Skill Final Power +X for this turn`};
  STATUS_DEFINITIONS[`${t}_power_down`] = {name:`${t}威力減少`,category:'debuff',maxPower:99,maxCount:1,defaultPower:0,defaultCount:0,desc:`${t} Skill Final Power -X for this turn`};
  STATUS_DEFINITIONS[`${t}_fragility`] = {name:`${t}脆弱`,category:'debuff',maxPower:10,maxCount:10,defaultPower:0,defaultCount:0,desc:`Take +(X*10)% damage from ${t} skills this turn`};
  STATUS_DEFINITIONS[`${t}_protection`] = {name:`${t}保護`,category:'buff',maxPower:10,maxCount:10,defaultPower:0,defaultCount:0,desc:`Take -(X*10)% damage from ${t} skills this turn`};
  STATUS_DEFINITIONS[`${t}_resist_down`] = {name:`${t}耐性減少`,category:'debuff',maxPower:20,maxCount:20,defaultPower:0,defaultCount:0,desc:`Increase ${t} Resistance by 0.1 per Count`};
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
  if (statusId === 'breath') {
    if (status.count > 0) status.power = Math.max(1, status.power);
    else status.power = 0;
  }
  if (statusId === 'poise' && status.count <= 0) status.power = 0;
}
function changeStatusCount(player, statusId, delta) {
  const status = ensureStatus(player, statusId);
  if (!status) return null;
  const before = status.count;
  status.count = clampStatusValue(status.count + delta, STATUS_DEFINITIONS[statusId].maxCount);
  normalizeStatus(statusId, status);
  return { status, before, after: status.count };
}
function changeStatusPower(player, statusId, delta) {
  const status = ensureStatus(player, statusId);
  if (!status) return null;
  const before = status.power;
  status.power = clampStatusValue(status.power + delta, STATUS_DEFINITIONS[statusId].maxPower);
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
  return cp;
}
function getOffenseLevel(player, skill) {
  const base=gameState[player]?.core?.offenseLevel || 0;
  return base + (gameState[player]?.core?.offenseLevelBonus || 0) + getActiveStatusPower(player,'offense_level_up') - getActiveStatusPower(player,'offense_level_down');
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
  const h=getStatus(player,'haste'), b=getStatus(player,'bind');
  return (h?.count>0 ? h.power : 0) - (b?.count>0 ? b.power : 0);
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
  p.hp = Math.max(0, p.hp - damage);
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
  emitHook('onHit', ctx);

  const applyStatusEffect = (effect) => {
    if (!effect) return;
    const statusTarget = getHitStatusTarget(player, effect);
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

    if (effect.power) {
      const amount = effect.power + (effect.id === 'bleed' && effect.target === 'opponent' ? (ctx.bleedBonus || 0) : 0);
      const r = changeStatusPower(statusTarget, effect.id, amount);
      log(`[的中] ${playerLabel(player)}の「${card.name}」: ${playerLabel(statusTarget)}の${STATUS_DEFINITIONS[effect.id]?.name || effect.id}威力 ${r.before}→${r.after}${ctx.bleedBonus ? `（血の掟+${ctx.bleedBonus}）` : ''}`);
    }
    if (effect.count) {
      const amount = effect.count + bonus;
      const r = changeStatusCount(statusTarget, effect.id, amount);
      log(`[的中] ${playerLabel(player)}の「${card.name}」: ${playerLabel(statusTarget)}の${STATUS_DEFINITIONS[effect.id]?.name || effect.id}回数 ${r.before}→${r.after}`);
    }
  };

  if (effectSource?.status) applyStatusEffect(effectSource.status);

  if (ctx.sinkingCountBonus) {
    const r = changeStatusCount(resolvedTarget, 'sinking', ctx.sinkingCountBonus);
    log(`[的中] ${playerLabel(player)}の「${card.name}」: ${playerLabel(resolvedTarget)}に沈潜回数${ctx.sinkingCountBonus}（沈む思考） ${r.before}→${r.after}`);
  }

  if (effectSource?.draw) {
    for (let i = 0; i < effectSource.draw; i++) drawCard(player);
    log(`[的中] ${playerLabel(player)}の「${card.name}」: ${effectSource.draw}枚ドロー`);
  }
  if (effectSource?.special === 'ego_crows_eye') {
    const enemy=resolvedTarget;
    addCombatStatus(enemy,'attack_power_down',2,1);
    addStatusNextTurn(enemy,'bind',2,1);
    ['p1','p2'].forEach(a=>addStatusNextTurn(a,'haste',3,1));
    log(`[E.G.O] Crow's Eye View: ${playerLabel(enemy)}へ攻撃威力減少2、この幕終了後に束縛2。次幕に味方全員迅速3。`);
  }
  if (effectSource?.special === 'ego_chains_others') {
    addStatusNextTurn(resolvedTarget,'bind',5,1);
    addStatusNextTurn(resolvedTarget,'attack_power_down',4,1);
    addStatusNextTurn(player,'bind',3,1);
    addStatusNextTurn(player,'attack_power_down',3,1);
    addStatusNextTurn(player,'protection',2,1);
    log(`[E.G.O] Chains of Others: 次幕に相手へ束縛5・攻撃威力減少4、自分へ束縛3・攻撃威力減少3・保護2。`);
  }
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
  if (effectSource?.special === 'abyss_draw_if_5') {
    const sinking = getStatus(resolvedTarget, 'sinking');
    if (sinking?.power >= 5) { for (let i = 0; i < 3; i++) drawCard(player); log(`[的中] ${playerLabel(player)}の「${card.name}」: 沈潜威力5以上のため3枚ドロー`); }
  }
}

function applySkillClashWinEffects(player, card, target) {
  const source = card?.onClashWin;
  if (!source) return;
  if (source.status) {
    const effect = source.status;
    const targetPlayer = getHitStatusTarget(player, effect);
    if (effect.id === 'sinking' && effect.target === 'opponent') markSinkingTarget(player, targetPlayer);
    if (effect.power) changeStatusPower(targetPlayer, effect.id, effect.power);
    if (effect.count) changeStatusCount(targetPlayer, effect.id, effect.count);
    log(`[マッチ勝利] ${playerLabel(player)}の「${card.name}」: ${playerLabel(targetPlayer)}に${formatStatusEffectText(effect)}`);
  }
  if (source.special === 'dusk_draw_if_stagger_half') {
    if (gameState[target].stagger <= gameState[target].maxStagger / 2) {
      drawCard(player); log(`[マッチ勝利] ${playerLabel(player)}の「${card.name}」: 相手の混乱耐性が半分以下のため1枚ドロー`);
    }
  }
  if (source.special === 'rain_consume_sinking_if_3') {
    const sinking = getStatus(target, 'sinking');
    if (sinking?.count >= 3) { consumeSinkingCount(target, 1); log(`[マッチ勝利] ${playerLabel(player)}の「${card.name}」: 沈潜回数を1消費`); }
  }
}

function getStatusTooltip(status) {
  if (!status) return '';
  if (status.id === 'breath') return `クリティカル確率: ${status.power}%<br>残り回数: ${status.count}<br>クリティカル時、ダメージ1.5倍。幕終了時またはクリティカル発動時に回数-1。最大値: 威力99 / 回数99。`;
  if (status.id === 'bleed') return `攻撃コインを振るたび、威力分のダメージを受ける。発動時に回数-1。最大値: 威力99 / 回数99。`;
  if (status.id === 'sinking') return `沈潜X / 回数Y。攻撃を受けたとき精神をX減少し、回数を1減少。最大値: 威力99 / 回数99。`;
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
  if (source.status) { const t = formatStatusEffectText(source.status); if (t) texts.push(`【的中】${t}`); }
  if (source.special === 'blood_festival') texts.push('【的中】相手の出血威力が3以上なら、追加で1枚引く');
  if (source.special === 'blood_feast') texts.push('【的中】相手の出血威力が3以上なら、この幕のダメージ+5');
  if (source.special === 'sunken_memory_reuse') texts.push('【的中】相手の沈潜威力が4以上なら、このコインを最大3回まで再使用');
  if (source.special === 'abyss_draw_if_5') texts.push('【的中】相手の沈潜威力が5以上なら、3枚引く');
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
