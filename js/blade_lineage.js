// blade_lineage.js — E.G.O「着影揮刀」（ムルソー / HE / 傲慢）と関連状態
//
// 参考: LCB「着影揮刀」（Shadow-vested Bladesinger）。wikiの個別ページが取得できず、攻略サイトの記載をもとにしている。
// 1対1向けの調整:
//   - 「味方」への効果（呼吸回数付与・精神力回復・剣契の味方への付与）は使用者本人へ置き換えるか省略。
//   - 「味方の死亡で追慕酒」は1対1では起きないため省略。
//   - 怨嗟の鞘・積もる怨嗟・本国流剣術-真髄（味方の剣契が前提の効果）は省略。
//
// 状態:
//   drink_fallen 追慕酒: 幕開始時に呼吸威力+1/スタック（人格がキムサッガなら+2）。クリティカルダメージ+3%/スタック（最大15%）。
//                呼吸を得る効果を持つ通常スキルのマッチ威力+1。幕終了時に1減少。
//                HPが0になる致死ダメージを受けたとき、全て消費して1スタックにつき最大HPの25%で復帰。
//   resentment   怨恨: パッシブ「剣先にしたたる酒滴」で、幕開始時に追慕酒があれば得る。その幕、速度+2、与えたダメージの10%回復。

function getDrinkStacks(player) { return getStatus(player, 'drink_fallen')?.count || 0; }
function hasBladesingerPassive(player) { return !!gameState[player]?.activeEgoPassives?.includes('ego_bladesinger_passive'); }

// 幕開始時（startNewRound、速度ダイス生成より前）
function processDrinkTurnStart(player) {
  const n = getDrinkStacks(player);
  if (n <= 0) return;
  const per = gameState[player].core?.id === 'core_8' ? 2 : 1;
  const r = changeStatusPower(player, 'breath', n * per);
  log(`[追慕酒] ${playerLabel(player)}の呼吸威力 ${r.before}→${r.after}`);
  if (hasBladesingerPassive(player)) {
    addCombatStatus(player, 'resentment', 1, 1);
    addCombatStatus(player, 'haste', 2, 1);
    log(`[剣先にしたたる酒滴] ${playerLabel(player)}は怨恨状態（この幕 速度+2、与ダメージの10%回復）`);
    if (gameState[player].core?.id === 'core_8') {
      addCombatStatus(player, 'resentful_scabbard', 1, 1);
      log(`[剣先にしたたる酒滴] ${playerLabel(player)}は恨の宿った鞘を得る`);
    }
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
  log(`[追慕酒] ${playerLabel(player)}は追慕酒${n}を消費してHP${heal}で復帰！`);
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
// 追慕酒があれば主対象への与ダメージ+100%（人格がキムサッガなら+200%）。
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
// 着影揮刀の攻撃終了時: 追慕酒4を得る
function bladesingerAttackEnd(player, skill) {
  if (skill?.attackEnd !== 'ego_bladesinger') return;
  const s = ensureStatus(player, 'drink_fallen');
  s.count = Math.min(STATUS_DEFINITIONS.drink_fallen.maxCount, (s.count || 0) + 4);
  log(`[着影揮刀] ${playerLabel(player)}は追慕酒4を得る（${s.count}）`);
}
// E.G.Oの資源コスト（人格がキムサッガのときの初回使用は傲慢3のみ）
function getEgoResourceCost(player, ego) {
  const p = gameState[player];
  const id = ego.egoId || ego.id;
  if (ego.firstUseCost && p.core?.id === ego.firstUseCost.coreId && !p.egoUsedOnce?.[id]) return ego.firstUseCost.cost;
  return ego.resourceCost;
}

// ===== 恨の宿った鞘・結ばれゆくしこり（キムサッガ＝剣契頭目ムルソー相当）=====
// 恨の宿った鞘: 怨恨状態になるとき、人格がキムサッガなら追加で得る（その幕のみ。追慕酒があれば毎幕得る）。
//   - 自分が体力ダメージを受けると、ダメージ量だけ結ばれゆくしこりを得る（1対1のため「味方」は自分のみ）。
//   - 追慕パッシブが最大効果で発動 → 自分のスキル・コインで得る/与える状態の威力・回数+2。
//   - 傲慢共鳴時の「本国剣 - 真詮伝授」付与は、自分を除く剣契の味方が対象のため1対1では発動しない（省略）。
//   - 「肉斬」使用中: 体力が10未満に下がらない（1幕1回）、マッチ威力-(呼吸威力÷2)。
//   - 「骨断」使用時: 呼吸4を得る。
// 結ばれゆくしこり（最大999）: 「骨断」の最終威力+(数値÷100)（最大6）。
//   「肉斬」「骨断」の最後のコイン的中時、与ダメージ+(数値÷10)%して消滅。

function hasScabbard(player) { return getActiveStatusPower(player, 'resentful_scabbard') > 0; }
function getGrudge(player) { return getStatus(player, 'growing_resentment')?.count || 0; }
// 自分のスキル・コインで得る/与える状態の威力・回数への加算（追慕パッシブ最大効果）
function getOwnStatusGainBonus(player) { return hasScabbard(player) ? 2 : 0; }
// 体力ダメージを受けたとき（applyDamage・出血・破裂から）
function onHpDamageTaken(player, hpDamage) {
  if (hpDamage <= 0 || !hasScabbard(player)) return;
  const s = ensureStatus(player, 'growing_resentment');
  const before = s.count || 0;
  s.count = Math.min(STATUS_DEFINITIONS.growing_resentment.maxCount, before + hpDamage);
  log(`[恨の宿った鞘] ${playerLabel(player)}の結ばれゆくしこり ${before}→${s.count}`);
}
// prepareSkillExecution から（肉斬・骨断）
function prepareScabbardSkill(player, skill, bonus) {
  const p = gameState[player];
  if (skill?.scabbardSkill === 'yield' && hasScabbard(player)) {
    const potency = getStatus(player, 'breath')?.power || 0;
    const down = Math.floor(potency / 2);
    bonus.clashPower = (bonus.clashPower || 0) - down;
    p.yieldHpFloorActive = true;
    log(`[恨の宿った鞘] 「${skill.name}」: 体力が10未満に下がらない（1幕1回）、マッチ威力-${down}`);
  }
  if (skill?.scabbardSkill === 'claim') {
    if (hasScabbard(player)) { const r = changeStatusPower(player, 'breath', 4); log(`[恨の宿った鞘] 「${skill.name}」: 呼吸威力 ${r.before}→${r.after}`); }
    const add = Math.min(6, Math.floor(getGrudge(player) / 100));
    if (add > 0) { bonus.finalPower += add; log(`[結ばれゆくしこり] 「${skill.name}」の最終威力+${add}`); }
  }
}
// 「肉斬」の体力下限（applyLethalGuard から）
function applyYieldHpFloor(player, hpDamage) {
  const p = gameState[player];
  if (!p.yieldHpFloorActive || p.yieldHpFloorRound === gameState.round) return hpDamage;
  if (p.hp - hpDamage < 10 && p.hp >= 10) {
    p.yieldHpFloorRound = gameState.round;
    log(`[恨の宿った鞘] ${playerLabel(player)}の体力は10未満に下がらない`);
    return Math.max(0, p.hp - 10);
  }
  return hpDamage;
}
// 最後のコイン的中時の与ダメージ（applyDamage から）。使ったら consume=true で消滅させる
function getGrudgeFinisherBonus(attacker, skill, coinIndex) {
  if (!skill?.scabbardSkill || !Number.isInteger(coinIndex) || coinIndex !== (skill.coinCount || 1) - 1) return 0;
  return getGrudge(attacker) / 1000;
}
function consumeGrudge(attacker) {
  const n = getGrudge(attacker);
  if (n <= 0) return;
  delete gameState[attacker].statuses.growing_resentment;
  log(`[結ばれゆくしこり] ${playerLabel(attacker)}: 与ダメージ+${(n / 10).toFixed(1)}%で消滅`);
}
