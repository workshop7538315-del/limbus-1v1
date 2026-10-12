// blade_lineage.js — E.G.O「着影揮刀」（ムルソー / HE / 傲慢）と関連状態
//
// 参考: LCB「着影揮刀」（Shadow-vested Bladesinger）。wikiの個別ページが取得できず、攻略サイトの記載をもとにしている。
// 1対1向けの調整:
//   - 「味方」への効果（呼吸回数付与・精神力回復・剣契の味方への付与）は使用者本人へ置き換えるか省略。
//   - 「味方の死亡で弔い酒」は1対1では起きないため省略。
//   - 怨嗟の鞘・積もる怨嗟・本国流剣術-真髄（味方の剣契が前提の効果）は省略。
//
// 状態:
//   drink_fallen 弔い酒: 幕開始時に呼吸威力+1/スタック（キムサッガのページなら+2）。クリティカルダメージ+3%/スタック（最大15%）。
//                呼吸を得る効果を持つ通常スキルのマッチ威力+1。幕終了時に1減少。
//                HPが0になる致死ダメージを受けたとき、全て消費して1スタックにつき最大HPの25%で復帰。
//   resentment   怨恨: パッシブ「刃先の酒滴」で、幕開始時に弔い酒があれば得る。その幕、速度+2、与えたダメージの10%回復。

function getDrinkStacks(player) { return getStatus(player, 'drink_fallen')?.count || 0; }
function hasBladesingerPassive(player) { return !!gameState[player]?.activeEgoPassives?.includes('ego_bladesinger_passive'); }

// 幕開始時（startNewRound、速度ダイス生成より前）
function processDrinkTurnStart(player) {
  const n = getDrinkStacks(player);
  if (n <= 0) return;
  const per = gameState[player].core?.id === 'core_8' ? 2 : 1;
  const r = changeStatusPower(player, 'breath', n * per);
  log(`[弔い酒] ${playerLabel(player)}の呼吸威力 ${r.before}→${r.after}`);
  if (hasBladesingerPassive(player)) {
    addCombatStatus(player, 'resentment', 1, 1);
    addCombatStatus(player, 'haste', 2, 1);
    log(`[刃先の酒滴] ${playerLabel(player)}は怨恨状態（この幕 速度+2、与ダメージの10%回復）`);
  }
}
// クリティカルダメージ追加（battle.js getCritDamageBonus から）
function getDrinkCritBonus(player) { return Math.min(0.15, getDrinkStacks(player) * 0.03); }
// 呼吸を得る効果を持つ通常スキルのマッチ威力+1
function getDrinkClashBonus(player, skill) {
  if (getDrinkStacks(player) <= 0 || skill?.isEgo) return 0;
  return skill?.tags?.includes('breath') ? 1 : 0;
}
// 致死ダメージ時の復帰（battle.js applyLethalGuard から）。復帰したら true
function tryDrinkRevive(player, hpDamage) {
  const p = gameState[player];
  const n = getDrinkStacks(player);
  if (n <= 0 || hpDamage < p.hp) return false;
  delete p.statuses.drink_fallen;
  const heal = Math.min(p.maxHp, Math.floor(p.maxHp * 0.25 * n));
  p.hp = heal;
  log(`[弔い酒] ${playerLabel(player)}は弔い酒${n}を消費してHP${heal}で復帰！`);
  return true;
}
// 怨恨: 与えたダメージの10%回復（battle.js applyDamage から）
function applyResentmentHeal(attacker, hpDamage) {
  if (!attacker || hpDamage <= 0 || getActiveStatusPower(attacker, 'resentment') <= 0) return;
  const p = gameState[attacker];
  const heal = Math.floor(hpDamage * 0.1);
  if (heal <= 0) return;
  const before = p.hp;
  p.hp = Math.min(p.maxHp, p.hp + heal);
  log(`[怨恨] ${playerLabel(attacker)}のHP ${before}→${p.hp}`);
}

// 着影揮刀の攻撃前（prepareSkillExecution から）。呼吸威力4ごとにマッチ威力+1・与ダメージ+10%（最大5）。
// 弔い酒があれば主対象への与ダメージ+100%（キムサッガのページなら+200%）。
function prepareBladesinger(player, skill, bonus) {
  if (!skill?.bladesinger) return;
  const potency = getStatus(player, 'breath')?.power || 0;
  const stacks = Math.min(5, Math.floor(potency / 4));
  bonus.clashPower = (bonus.clashPower || 0) + stacks;
  bonus.damageBonus = (bonus.damageBonus || 0) + stacks * 0.1;
  if (getDrinkStacks(player) > 0) bonus.damageBonus += gameState[player].core?.id === 'core_8' ? 2 : 1;
  log(`[着影揮刀] ${playerLabel(player)}: 呼吸${potency} → マッチ威力+${stacks}、与ダメージ+${Math.round(bonus.damageBonus * 100)}%`);
  if (skill.bladesinger === 'corrosion') {
    ['p1', 'p2'].forEach(p => {
      changeStatusCount(p, 'breath', 4);
      addCombatStatus(p, 'slash_damage_up', 1, 1);
      addCombatStatus(p, 'slash_fragility', 1, 1);
    });
    log('[着影揮刀・侵蝕] 敵味方全員が呼吸回数4・斬撃ダメージ増加1・斬撃脆弱1を得る。');
  }
}
// 着影揮刀の攻撃終了時: 弔い酒4を得る
function bladesingerAttackEnd(player, skill) {
  if (skill?.attackEnd !== 'ego_bladesinger') return;
  const s = ensureStatus(player, 'drink_fallen');
  s.count = Math.min(STATUS_DEFINITIONS.drink_fallen.maxCount, (s.count || 0) + 4);
  log(`[着影揮刀] ${playerLabel(player)}は弔い酒4を得る（${s.count}）`);
}
// E.G.Oの資源コスト（キムサッガのページでの初回使用は傲慢3のみ）
function getEgoResourceCost(player, ego) {
  const p = gameState[player];
  const id = ego.egoId || ego.id;
  if (ego.firstUseCost && p.core?.id === ego.firstUseCost.coreId && !p.egoUsedOnce?.[id]) return ego.firstUseCost.cost;
  return ego.resourceCost;
}
