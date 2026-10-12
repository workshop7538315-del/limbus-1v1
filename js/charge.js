// charge.js — 充電（Charge）リソースと、スキル実行時（On Use）の処理
//
// 充電は状態 'charge'（回数=充電量）として statuses に保持する。
//   - LoR: 充電は最大10まで貯まるリソース（特定のスーツで20）。
//   - LCB: 充電は回数で管理し、スキルで消費して効果を強化。幕終了時に1減少（effects.js processStatusTurnEnd）。
//   このゲームでは「上限は core.chargeCap（未指定なら10）」「幕終了時に1減少」とした。
//
// スキルのデータで使うフィールド（data.js）:
//   onExecute: { charge: N }                 実行時（攻撃開始時）に充電+N
//   chargeConsume: { amount, coinPower, partialMin, partialHpPer, lackHpLoss }
//        実行時に充電を amount 消費してコイン威力+coinPower（finalPower なら最終威力+）。
//        partialMin 以上 amount 未満なら全消費し、不足1につき最大HPの partialHpPer を失って同じ効果（良秀 D.D.E.D.R.）。
//        lackHpLoss: 足りなければ最大HPのこの割合を失う（効果なし。ドンキ 空間裂き）。
//   chargePowerUp: { amount, powerUp }     実行時に充電を amount 消費し、この幕「威力増加 powerUp」を得る
//   chargeCoinPowerTiers: [{ min, bonus }]  充電が min 以上ならコイン威力+bonus（累積）
//   chargeDamageTiers: [{ min, bonus }]     充電が min 以上なら与ダメージ+bonus（0.1 = +10%、累積）
//   chargeBasePowerPer5: N                  充電5ごとに基礎威力+1（最大N）
//   コインの onHit.status に requireCharge: N を付けると、充電N以上のときだけ付与
//
// 「実行時」の処理は、LCBの On Use（スキルを使う瞬間）に合わせ、マッチ開始時・一方攻撃開始時に行う。
// 既存の onUse（速度ダイスにセットした時点で発動）とは別のタイミング。

function getChargeCap(player) { return gameState[player]?.core?.chargeCap || 10; }
function getCharge(player) { return getStatus(player, 'charge')?.count || 0; }
function gainCharge(player, amount, reason = '') {
  if (!amount) return 0;
  const before = getCharge(player);
  const after = Math.min(getChargeCap(player), before + amount);
  const s = ensureStatus(player, 'charge');
  s.count = after; s.power = 0;
  if (after <= 0) delete gameState[player].statuses.charge;
  log(`[充電] ${playerLabel(player)} ${before}→${after}/${getChargeCap(player)}${reason ? `（${reason}）` : ''}`);
  return after - before;
}
function consumeCharge(player, amount, reason = '') {
  const before = getCharge(player);
  const used = Math.min(before, amount);
  if (used <= 0) return 0;
  const s = getStatus(player, 'charge');
  s.count = before - used;
  if (s.count <= 0) delete gameState[player].statuses.charge;
  log(`[充電消費] ${playerLabel(player)} ${before}→${before - used}${reason ? `（${reason}）` : ''}`);
  return used;
}
function getChargeCoinPowerBonus(player, skill) {
  if (!skill?.chargeCoinPowerTiers) return 0;
  const c = getCharge(player);
  return skill.chargeCoinPowerTiers.reduce((sum, t) => sum + (c >= t.min ? t.bonus : 0), 0);
}
function getChargeDamageBonus(player, skill) {
  if (!skill?.chargeDamageTiers) return 0;
  const c = getCharge(player);
  return skill.chargeDamageTiers.reduce((sum, t) => sum + (c >= t.min ? t.bonus : 0), 0);
}
function getChargeBasePowerBonus(player, skill) {
  if (!skill?.chargeBasePowerPer5) return 0;
  return Math.min(skill.chargeBasePowerPer5, Math.floor(getCharge(player) / 5));
}
function loseHpFromSkill(player, ratio, reason) {
  const p = gameState[player];
  const loss = Math.floor(p.maxHp * ratio);
  if (loss <= 0) return;
  const before = p.hp;
  p.hp = Math.max(1, p.hp - loss); // 自分のスキルの代償では倒れない
  log(`[代償] ${playerLabel(player)}のHP ${before}→${p.hp}（${reason}）`);
}

// ===== スキル実行時のボーナス =====
// 実行中のスキルにだけ効くコイン威力・最終威力の補正を gameState[p].execBonus に置く。
function prepareSkillExecution(player, skill) {
  const p = gameState[player];
  const bonus = { skill, coinPower: 0, finalPower: 0 };
  p.execBonus = bonus;
  if (!skill) return;
  if (skill.onExecute?.charge) gainCharge(player, skill.onExecute.charge, `「${skill.name}」`);
  const cc = skill.chargeConsume;
  if (cc) {
    const c = getCharge(player);
    if (c >= cc.amount) {
      consumeCharge(player, cc.amount, `「${skill.name}」`);
      bonus.coinPower += cc.coinPower || 0;
      bonus.finalPower += cc.finalPower || 0;
      log(`[充電] 「${skill.name}」: 充電${cc.amount}消費で${cc.coinPower ? `コイン威力+${cc.coinPower}` : ''}${cc.finalPower ? `最終威力+${cc.finalPower}` : ''}`);
    } else if (cc.partialMin && c >= cc.partialMin) {
      const used = consumeCharge(player, c, `「${skill.name}」`);
      loseHpFromSkill(player, (cc.amount - used) * (cc.partialHpPer || 0), `充電不足分 ${cc.amount - used}`);
      bonus.coinPower += cc.coinPower;
      log(`[充電] 「${skill.name}」: 不足分をHPで補いコイン威力+${cc.coinPower}`);
    } else if (cc.lackHpLoss) {
      loseHpFromSkill(player, cc.lackHpLoss, `「${skill.name}」充電不足`);
    }
  }
  const cp = skill.chargePowerUp;
  if (cp && getCharge(player) >= cp.amount) {
    consumeCharge(player, cp.amount, `「${skill.name}」`);
    addCombatStatus(player, 'power_up', cp.powerUp, 1);
    log(`[充電] 「${skill.name}」: この幕、威力増加${cp.powerUp}を得る`);
  }
  // core.firstSkillPowerUp: その幕で最初に使う攻撃スキルの最終威力+N（現在このフィールドを持つコアページはない）
  if (p.core?.firstSkillPowerUp && p.firstSkillPowerUpRound !== gameState.round && skill.skillType === 'attack') {
    p.firstSkillPowerUpRound = gameState.round;
    bonus.finalPower += p.core.firstSkillPowerUp;
    log(`[パッシブ] ${playerLabel(player)}: この幕最初のスキル「${skill.name}」の最終威力+${p.core.firstSkillPowerUp}`);
  }
}
function finishSkillExecution(player) { if (gameState[player]) gameState[player].execBonus = null; }
function getExecBonus(player, skill, key) {
  const b = gameState[player]?.execBonus;
  return (b && b.skill === skill) ? (b[key] || 0) : 0;
}
