// rupture.js — 破裂・速度差を使う人格（黒獣-卯）向けの処理
//
// 状態:
//   rupture         破裂（effects.js）。攻撃を受けたとき威力分の固定ダメージ、回数-1。
//   strider_mao     疾走【卯】（最大3）。幕終了時に次の幕の迅速5を得て1減少。
//   deathrite_haste 死儀【迅速】（3で付与、付与中は再付与不可）。速度10以上の相手の攻撃で破裂が発動するたび
//                   1減少し破裂回数+1。0になると破裂威力分の暴食ダメージを受けて消える。
//
// スキルのデータで使うフィールド（data.js）:
//   speedFasterCoinPower: { diff, bonus }  対象より diff 以上速ければコイン威力+bonus
//   speedDiffCoinPowerPer2: N              対象より速ければ、速度差2ごとにコイン威力+1（最大N）
//   targetRuptureCoinPower: [{ min, bonus }] 対象の破裂威力が min 以上ならコイン威力+bonus
//   speedRuptureDamage: { max }            対象より速ければ与ダメージ+(速度差×対象の破裂威力)%（最大max）
//   unopposedRuptureCount: N               一方攻撃のとき、攻撃開始時に対象へ破裂回数+N
//   onExecute: { strider: N }              攻撃開始時に疾走【卯】+N
//   コインの onHit:
//     reuseAtSpeed: S        自分の速度がS以上ならこのコインを1回再使用（スキルにつき1回）
//     speedDamageBonus: { speed, bonus } 自分の速度がspeed以上なら与ダメージ+bonus
//     selfHasteNext: N       次の幕に迅速+N（1幕2回まで）
//     special 'deathrite' / 'deathrite_on_reuse' 死儀【迅速】を付与（後者は再使用時のみ）
//
// 速度は「使用した速度ダイスの値」、対象速度は「指定した相手の速度ダイスの値」（なければ相手の最速ダイス）。

function getSlotSpeedInfo(slot, targetSlot) {
  const speed = slot?.speed || 0;
  let targetSpeed = targetSlot?.speed;
  if (targetSpeed == null && slot) {
    const enemy = gameState[opponentOf(slot.owner)];
    targetSpeed = enemy?.slots?.length ? Math.max(...enemy.slots.map(s => s.speed || 0)) : 0;
  }
  const diff = speed - (targetSpeed || 0);
  return { speed, targetSpeed: targetSpeed || 0, diff, faster: diff > 0 };
}
function getExecSpeed(player) { return gameState[player]?.execBonus?.speedInfo?.speed || 0; }

// prepareSkillExecution（charge.js）から呼ばれる。速度差・破裂に応じたコイン威力など。
function prepareSpeedRuptureExecution(player, skill, bonus, slot, targetSlot, unopposed) {
  const info = getSlotSpeedInfo(slot, targetSlot);
  bonus.speedInfo = info;
  const target = targetSlot?.owner || opponentOf(player);
  const rup = getStatus(target, 'rupture')?.power || 0;
  const parts = [];
  if (skill.speedFasterCoinPower && info.diff >= skill.speedFasterCoinPower.diff) { bonus.coinPower += skill.speedFasterCoinPower.bonus; parts.push(`速度差${info.diff}`); }
  if (skill.speedDiffCoinPowerPer2 && info.faster) { const b = Math.min(skill.speedDiffCoinPowerPer2, Math.floor(info.diff / 2)); if (b > 0) { bonus.coinPower += b; parts.push(`速度差${info.diff}: +${b}`); } }
  (skill.targetRuptureCoinPower || []).forEach(t => { if (rup >= t.min) { bonus.coinPower += t.bonus; parts.push(`相手の破裂${rup}`); } });
  if (parts.length) log(`[速度] 「${skill.name}」: コイン威力+${bonus.coinPower}（${parts.join('、')}）`);
  if (skill.onExecute?.strider) addStrider(player, skill.onExecute.strider);
  if (unopposed && skill.unopposedRuptureCount) {
    const r = changeStatusCount(target, 'rupture', skill.unopposedRuptureCount);
    log(`[一方攻撃] 「${skill.name}」: ${playerLabel(target)}の破裂回数 ${r.before}→${r.after}`);
  }
}

function addStrider(player, n) {
  const s = ensureStatus(player, 'strider_mao');
  const before = s.count || 0;
  s.count = Math.min(STATUS_DEFINITIONS.strider_mao.maxCount, before + n);
  log(`[疾走【卯】] ${playerLabel(player)} ${before}→${s.count}`);
}
// 幕終了時（processStatusTurnEnd から）
function processStriderTurnEnd(player, status) {
  addStatusNextTurn(player, 'haste', 5, 1);
  status.count -= 1;
  log(`[疾走【卯】] ${playerLabel(player)}は次の幕に迅速5を得る（残り${status.count}）`);
  if (status.count <= 0) delete gameState[player].statuses.strider_mao;
}
// 黒獣化[卯]: 疾走【卯】1につき与ダメージ+5%（最大15%）
function getStriderDamageBonus(player) {
  const core = gameState[player]?.core;
  if (!core?.striderDamagePer) return 0;
  return Math.min(core.striderDamageMax || 0.15, (getStatus(player, 'strider_mao')?.count || 0) * core.striderDamagePer);
}
// 速度差×破裂威力（%）の与ダメージ補正
function getSpeedRuptureDamageBonus(attacker, target, skill) {
  if (!skill?.speedRuptureDamage) return 0;
  const info = gameState[attacker]?.execBonus?.speedInfo;
  if (!info?.faster) return 0;
  const rup = getStatus(target, 'rupture')?.power || 0;
  return Math.min(skill.speedRuptureDamage.max, info.diff * rup / 100);
}

function applyDeathrite(target) {
  if (getStatus(target, 'deathrite_haste')?.count > 0) return; // 付与中は再付与不可
  const s = ensureStatus(target, 'deathrite_haste');
  s.count = 3;
  log(`[死儀【迅速】] ${playerLabel(target)}に付与（3）`);
}
// 破裂が発動したとき（effects.js triggerRupture の後）。attackerSpeed: 攻撃側の速度
function onRuptureTriggered(target, attackerSpeed) {
  const d = getStatus(target, 'deathrite_haste');
  if (!d || d.count <= 0 || attackerSpeed < 10) return;
  d.count -= 1;
  const r = changeStatusCount(target, 'rupture', 1);
  log(`[死儀【迅速】] ${playerLabel(target)}: 残り${d.count}、破裂回数 ${r.before}→${r.after}`);
  if (d.count <= 0) {
    delete gameState[target].statuses.deathrite_haste;
    const dmg = getStatus(target, 'rupture')?.power || 0;
    if (dmg > 0) {
      const p = gameState[target];
      const before = p.hp;
      p.hp = Math.max(0, p.hp - applyLethalGuard(target, dmg));
      log(`[死儀【迅速】] ${playerLabel(target)}は暴食ダメージ ${dmg}（HP ${before}→${p.hp}）`);
      if (!p.isStaggered && !p.staggerImmune) checkStaggerThresholds(target);
    }
  }
}
// 刺殺: 次の幕に迅速（1幕2回まで）
function gainSelfHasteNext(player, n) {
  const p = gameState[player];
  if (p.selfHasteRound !== gameState.round) { p.selfHasteRound = gameState.round; p.selfHasteCount = 0; }
  if (p.selfHasteCount >= 2) return;
  p.selfHasteCount++;
  addStatusNextTurn(player, 'haste', n, 1);
  log(`[迅速] ${playerLabel(player)}は次の幕に迅速${n}を得る`);
}
