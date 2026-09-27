// battle.js — Limbus風のSkill/Coin戦闘エンジン

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function drawCard(p) {
  const player = gameState[p];
  if (player.deck.length === 0) {
    if (player.discard.length === 0) return;
    player.deck = shuffle([...player.discard]);
    player.discard = [];
  }
  player.hand.push(player.deck.pop());
}

function setupCharacter(p, core, egoIds = {}) {
  const state = gameState[p];
  state.core = core;
  state.hp = core.hp; state.maxHp = core.hp;
  state.stagger = core.stagger; state.maxStagger = core.stagger;
  state.isStaggered = false; state.staggerSkipDone = false;
  state.sanity = 0; state.minSanity = -45; state.maxSanity = 45;
  state.maxLight = core.maxLight; state.light = core.maxLight;
  state.egoResources = { wrath:0, lust:0, sloth:0, gluttony:0, gloom:0, pride:0, envy:0 };
  state.equippedEgos = EGO_RISK_LEVELS.map(risk => egoIds[risk]).filter(Boolean).map(id => EGO_DATABASE.find(e => e.id === id)).filter(Boolean);
  state.usedEgosThisTurn = [];
  state.pendingStatuses = {};
  state.activeEgoPassives = [];
  const initialZayin = state.equippedEgos.find(e => e.risk === 'ZAYIN');
  state.sinRes = { ...(initialZayin?.sinRes || { wrath:1, lust:1, sloth:1, gluttony:1, gloom:1, pride:1, envy:1 }) };
  state.hand = []; state.discard = []; state.slots = []; state.statuses = {};
  state.bloodPactFirstPageAvailable = true; state.bloodPactFirstPageHitCount = 0;
  state.sinkingPactUses = 0; state.sinkingMarkedTargets = {};
  state.sinkingThinkingFirstPageAvailable = true; state.sinkingThinkingHitCount = 0;
  state.defenseStock = []; state.counterSkills = [];

  document.getElementById(`${p}-title`).innerText = `${playerLabel(p)} (${core.name})`;
  document.getElementById(`${p}-passive-box`).innerHTML = `パッシブ: <span class="tooltip-target">${core.passiveName}<span class="tooltip-text">${core.passiveDesc}</span></span>`;
  updateResDisplay(p);
}

function startBattle() {
  initBattleAnimation();
  document.getElementById('builder-screen').classList.remove('active');
  document.getElementById('battle-screen').classList.add('active');
  document.getElementById('result-modal').style.display = 'none';

  const p1CoreId = selectedP1CoreIds[Math.floor(Math.random() * selectedP1CoreIds.length)];
  const p2CoreId = selectedP2CoreIds[Math.floor(Math.random() * selectedP2CoreIds.length)];
  setupCharacter('p1', CORE_PAGES.find(c => c.id === p1CoreId), selectedP1EgoIds);
  setupCharacter('p2', CORE_PAGES.find(c => c.id === p2CoreId), selectedP2EgoIds);

  gameState.p1.deck = shuffle([...decks.p1.map(id => CARD_DATABASE.find(c => c.id === id)).filter(Boolean)]);
  gameState.p2.deck = shuffle([...decks.p2.map(id => CARD_DATABASE.find(c => c.id === id)).filter(Boolean)]);
  for (let i = 0; i < 4; i++) { drawCard('p1'); drawCard('p2'); }
  gameState.round = 0;
  document.getElementById('log').innerHTML = '';
  startNewRound();
}

function startNewRound() {
  selectedHandCard = null; selectedTargetSlot = null; gameState.round += 1;
  startRoundLogBlock(gameState.round);

  ['p1', 'p2'].forEach(p => {
    const player = gameState[p];
    player.bloodPactFirstPageAvailable = true;
    player.bloodPactFirstPageHitCount = 0;
    player.sinkingPactUses = 0;
    player.sinkingThinkingFirstPageAvailable = true;
    player.sinkingThinkingHitCount = 0;
    player.usedEgosThisTurn = [];
    applyPendingStatuses(p);
    if (player.isStaggered && player.staggerSkipDone) {
      player.isStaggered = false; player.staggerSkipDone = false; player.stagger = player.maxStagger;
      log(`[復帰] ${playerLabel(p)}が混乱状態から回復しました！`);
      updateResDisplay(p);
    } else if (player.isStaggered) {
      player.staggerSkipDone = true; log(`[混乱] ${playerLabel(p)}はこの幕、行動不能です。`);
    }
    if (player.core.onTurnStart) player.core.onTurnStart(p);
    emitHook('onTurnStart', { player: p });
  });

  ['p1', 'p2'].forEach(p => {
    const player = gameState[p];
    player.slots = []; player.defenseStock = []; player.counterSkills = [];
    if (!player.isStaggered) {
      for (let i = 0; i < player.core.speedDiceCount; i++) {
        player.slots.push({
          id: i, owner: p,
          speed: Math.max(1, Math.floor(Math.random() * (player.core.speedMax - player.core.speedMin + 1)) + player.core.speedMin + getSpeedStatusModifier(p)),
          card: null, targetSlot: null, resolved: false
        });
      }
    }
  });
  ['p1', 'p2'].forEach(p => {
    gameState[p].slots.sort((a, b) => b.speed - a.speed || a.id - b.id);
    gameState[p].slots.forEach((slot, i) => slot.id = i);
  });
  gameState.planningQueue = [...gameState.p1.slots, ...gameState.p2.slots].sort((a, b) => b.speed - a.speed || (a.owner === 'p1' ? -1 : 1));
  gameState.currentQueueIndex = 0;
  updateUI();
  processNextPlanningStep();
}

function playCardToSlot(player, slot, card, targetSlot) {
  if (card?.isEgo) {
    if (!gameState[player].equippedEgos?.some(e => e.id === card.egoId)) {
      log(`[E.G.O] ${playerLabel(player)}の装備E.G.Oではありません。`);
      return false;
    }
    if (gameState[player].usedEgosThisTurn?.includes(card.egoId)) {
      log(`[E.G.O] ${playerLabel(player)}はこの幕に「${card.name}」をすでに使用しています。`);
      return false;
    }
    if (!canPayEgoResource(player, card.resourceCost)) {
      log(`[E.G.O] ${playerLabel(player)}は罪悪資源不足で「${card.name}」を使用できません。`);
      return false;
    }
    payEgoResource(player, card.resourceCost);
    changeSanity(player, -card.sanityCost, `E.G.O「${card.name}」`);
    gameState[player].usedEgosThisTurn.push(card.egoId);
    gameState[player].activeEgoPassives = [...new Set([...(gameState[player].activeEgoPassives || []), card.egoId])];
    gameState[player].sinRes = { ...(card.sinRes || gameState[player].sinRes) };
    updateResDisplay(player);
    log(`[E.G.O] ${playerLabel(player)}の罪悪耐性が「${card.name}」に切り替わりました。`);
  }
  slot.card = card; slot.targetSlot = targetSlot || null;
  slot.bloodPactFirstPage = markFirstUsedPage(player, card);
  slot.sinkingThinkingFirstPage = markFirstSinkingThinkingPage(player);
  gameState[player].light -= card.cost;
  const hIdx = gameState[player].hand.indexOf(card);
  if (hIdx !== -1) gameState[player].hand.splice(hIdx, 1);
  if (!card?.isEgo) gameState[player].discard.push(card);
  applyOnUseEffects(player, card);
  emitHook('onCardUse', { player, card, slot });
}

function processNextPlanningStep() {
  selectedHandCard = null; selectedTargetSlot = null;
  if (gameState.currentQueueIndex >= gameState.planningQueue.length) {
    document.getElementById('planning-info').innerText = '全ての速度ダイス行動が設定されました。「幕を進める」を押してください。';
    document.getElementById('action-btn').innerText = '幕を進める (全戦闘開始)';
    document.getElementById('action-btn').disabled = false;
    renderHand(); updateUI(); return;
  }
  const currentSlot = getCurrentPlanningSlot();
  updateUI();
  if (currentSlot.owner === 'p2') {
    chooseP2Action(currentSlot); gameState.currentQueueIndex++; processNextPlanningStep();
  } else {
    updatePlanningPrompt(); renderHand();
  }
}

function confirmCurrentSlotAction() {
  const currentSlot = getCurrentPlanningSlot();
  if (currentSlot && currentSlot.owner === 'p1') {
    if (selectedHandCard) {
      const p2HasDice = gameState.p2.slots.length > 0 && !gameState.p2.isStaggered;
      if (p2HasDice && !selectedTargetSlot) { alert('マッチ対象の速度ダイスをクリックしてください。'); return; }
      if (playCardToSlot('p1', currentSlot, selectedHandCard, selectedTargetSlot) === false) return;
    }
    selectedHandCard = null; selectedTargetSlot = null;
    gameState.currentQueueIndex++; processNextPlanningStep();
  } else executeFullTurn();
}

function getSkillAttackType(skillOrCoin) { return skillOrCoin?.attackType || skillOrCoin?.type || ''; }
function getCoinPowerBonus(player, skill) {
  if (!skill || !gameState[player]?.core) return 0;
  let bonus = 0;
  if (skill.attackType === 'slash' && gameState[player].core.slashBonus) bonus += gameState[player].core.slashBonus;
  if (skill.sinkingPowerPer4) {
    const target = opponentOf(player), sinking = getStatus(target, 'sinking');
    if (sinking?.power > 0) bonus += Math.floor(sinking.power / 4) * skill.sinkingPowerPer4;
  }
  if (skill.coinPowerBonus) bonus += skill.coinPowerBonus;
  return bonus;
}
function getCoinPowerBonusReason(player, skill) {
  const reasons = [];
  if (skill?.attackType === 'slash' && gameState[player]?.core?.slashBonus) reasons.push(gameState[player].core.passiveName || '斬撃威力補正');
  if (skill?.sinkingPowerPer4) {
    const s = getStatus(opponentOf(player), 'sinking');
    const n = s ? Math.floor((s.power || 0) / 4) : 0;
    if (n > 0) reasons.push(`相手の沈潜威力4ごとに+${skill.sinkingPowerPer4}`);
  }
  return reasons.join('、');
}

function flipCoin(player, skill, coinIndex, includeSkillBonus = true) {
  const chance = getHeadsChance(player);
  const heads = Math.random() * 100 < chance;
  const rawCoinPower = skill.coinPower || 0;
  const effectiveCoinPower = getEffectiveCoinPower(player, skill, rawCoinPower);
  const positive = rawCoinPower >= 0;
  const paralyze = getStatus(player, 'paralyze');
  const paralyzed = !!(paralyze?.count > 0);
  let power = (skill.basePower || 0) + getSkillBasePowerBonus(player);
  if (heads && !paralyzed) power += effectiveCoinPower;
  if (paralyzed) {
    power = 0;
    paralyze.count = Math.max(0, paralyze.count - 1);
    if (paralyze.count <= 0) delete gameState[player].statuses.paralyze;
  }
  let bonus = 0;
  if (includeSkillBonus) {
    bonus = getCoinPowerBonus(player, skill);
    power += bonus;
  }
  power += getSkillFinalPowerModifier(player, skill);
  if (gameState[player].core?.powerAlwaysZero) {
    power = 0;
    bonus = 0;
  }
  return { index: coinIndex, heads, side: heads ? '表' : '裏', chance, power, bonus, positive, paralyzed };
}

function rollSkillForClash(player, skill, remainingCoins, opponentPlayer = null, opponentSkill = null) {
  const results = [];
  const basePower = (skill.basePower || 0) + getSkillBasePowerBonus(player);
  let power = basePower;
  const effectiveCoinPower = getEffectiveCoinPower(player, skill, skill.coinPower || 0);
  for (let i = 0; i < remainingCoins; i++) {
    const c = flipCoin(player, skill, i, false);
    results.push(c);
    if (c.heads && !c.paralyzed) power += effectiveCoinPower;
  }
  power += getCoinPowerBonus(player, skill);
  power += getSkillFinalPowerModifier(player, skill);
  power += getClashPowerModifier(player);
  if (opponentPlayer && opponentSkill) {
    const levelDiff = getSkillCombatLevel(player, skill) - getSkillCombatLevel(opponentPlayer, opponentSkill);
    if (levelDiff > 0) power += Math.floor(levelDiff / 3);
  }
  if (gameState[player].core?.powerAlwaysZero) power = 0;
  return { power, coins: results };
}

function logCoinRoll(player, skill, coinResult, context = '') {
  const bonusText = coinResult.bonus ? ` / +${coinResult.bonus}${getCoinPowerBonusReason(player, skill) ? `:${getCoinPowerBonusReason(player, skill)}` : ''}` : '';
  log(`[コイン] ${playerLabel(player)}「${skill.name}」 ${coinResult.index + 1}/${skill.coinCount || 1}: ${coinResult.side} (${coinResult.power}, 表${Math.round(coinResult.chance)}%)${bonusText}${context ? ` ${context}` : ''}`);
}

async function executeFullTurn() {
  log('=== 幕の戦闘開始 ===');
  const allSlots = [...gameState.p1.slots, ...gameState.p2.slots];
  allSlots.forEach(s => { s.resolved = false; s.defenseStocked = false; s.counterUsed = false; s.counterRegistered = false; });
  ['p1', 'p2'].forEach(p => { gameState[p].defenseStock = []; gameState[p].counterSkills = []; });
  allSlots.forEach(slot => { if (slot.card && !gameState[slot.owner].isStaggered) registerCounterSkills(slot); });
  allSlots.sort((a, b) => b.speed - a.speed || (a.owner === 'p1' ? -1 : 1));

  for (const slot of allSlots) {
    if (slot.resolved) continue;
    if (gameState[slot.owner].isStaggered) { slot.resolved = true; if (slot.card) log(`[キャンセル] ${playerLabel(slot.owner)}は混乱のため「${slot.card.name}」を実行できません。`); continue; }
    if (!slot.card) { slot.resolved = true; continue; }
    const target = slot.targetSlot;
    // 攻撃同士は相互指定でマッチ。防御/回避は自分から相手の行動を
    // 指定していれば、その相手がこちらを指定し返していなくてもマッチする。
    // 以前は全スキルを「相互指定必須」にしていたため、昏がり等が
    // 一方的に防御待機へ回り、マッチ演出まで到達しないケースがあった。
    const canClash = target && target.card && !target.resolved && !gameState[target.owner].isStaggered &&
      (target.targetSlot === slot || isDefenseSkill(slot.card) || isDefenseSkill(target.card));
    if (canClash) {
      await resolveClash(slot, target);
      slot.resolved = true; target.resolved = true;
    } else {
      await resolveOneSided(slot); slot.resolved = true;
    }
  }

  hideBattleAnimation();
  ['p1', 'p2'].forEach(p => {
    gameState[p].light = Math.min(gameState[p].maxLight, gameState[p].light + 1);
    processStatusTurnEnd(p); drawCard(p);
  });
  ['p1', 'p2'].forEach(p => emitHook('onTurnEnd', { player: p }));
  updateUI();
  if (!checkGameEnd()) {
    ['p1', 'p2'].forEach(p => { gameState[p].defenseStock = []; gameState[p].counterSkills = []; });
    startNewRound();
  }
}

function isDefenseSkill(skill) { return ['defense', 'evade'].includes(skill?.skillType); }
function isCounterSkill(skill) { return skill?.skillType === 'counter'; }
function hasClashableCounter(card) { return !!card?.legacyDice?.some(d => d.type === 'counter_clash'); }

function stockUnusedDefenseCoins(slot, usedCount = 0) {
  if (!slot?.card || slot.defenseStocked || !isDefenseSkill(slot.card)) return;
  const remaining = Math.max(0, (slot.card.coinCount || 0) - usedCount);
  for (let i = 0; i < remaining; i++) {
    gameState[slot.owner].defenseStock.push({ skill: slot.card, slot, coinIndex: i, active: true });
  }
  slot.defenseStocked = true;
}
function registerCounterSkills(slot) {
  if (!slot?.card || slot.counterRegistered) return;
  if (isCounterSkill(slot.card)) {
    gameState[slot.owner].counterSkills.push({ slot, skill: slot.card, used: false });
    slot.counterRegistered = true;
    return;
  }
  if (slot.card.counterDice?.length) {
    gameState[slot.owner].counterSkills.push({ slot, dice: slot.card.counterDice, used: false });
    slot.counterRegistered = true;
  }
}

function getClashSanityGain(clashCount) {
  // Limbusの標準的な基礎値: 勝利 +10、1回目を超えるクラッシュ回数ごとに20%増加。
  return Math.floor(10 * (1 + 0.20 * Math.max(0, clashCount - 1)));
}
async function resolveClash(slotA, slotB) {
  const pA = slotA.owner, pB = slotB.owner, skillA = slotA.card, skillB = slotB.card;
  if (hasClashableCounter(skillA) || hasClashableCounter(skillB)) {
    return resolveLegacyClashableCounter(slotA, slotB);
  }
  logClashSummary(slotA, slotB);
  generateEgoResourceForSkill(pA, skillA, slotA);
  generateEgoResourceForSkill(pB, skillB, slotB);
  emitHook('onClashStart', { playerA: pA, playerB: pB, cardA: skillA, cardB: skillB });
  let remA = skillA.coinCount || 0, remB = skillB.coinCount || 0;
  let guard = 0;
  let clashCount = 0;
  let clashWinner = null;
  let clashLoser = null;

  while (remA > 0 && remB > 0 && guard++ < 50) {
    clashCount++;
    const rollA = rollSkillForClash(pA, skillA, remA);
    const rollB = rollSkillForClash(pB, skillB, remB);
    rollA.coins.forEach(c => logCoinRoll(pA, skillA, c, '（マッチ判定）'));
    rollB.coins.forEach(c => logCoinRoll(pB, skillB, c, '（マッチ判定）'));
    log(`[マッチ] ${playerLabel(pA)}「${skillA.name}」 ${rollA.power} vs ${playerLabel(pB)}「${skillB.name}」 ${rollB.power}`);
    emitHook('onClashRoll', { playerA: pA, playerB: pB, skillA, skillB, rollA, rollB, clashCount });
    await animateClashRoll({ round: clashCount, left: animSideFromSkill(pA, skillA, rollA.power, rollA.coins, remA), right: animSideFromSkill(pB, skillB, rollB.power, rollB.coins, remB) });
    if (rollA.power > rollB.power) {
      remB--; clashWinner = pA; clashLoser = pB;
      log(`[マッチ勝利] ${playerLabel(pA)}が勝利。${playerLabel(pB)}のコインを1枚失う。残り ${remA} vs ${remB}`);
    } else if (rollB.power > rollA.power) {
      remA--; clashWinner = pB; clashLoser = pA;
      log(`[マッチ勝利] ${playerLabel(pB)}が勝利。${playerLabel(pA)}のコインを1枚失う。残り ${remA} vs ${remB}`);
    } else {
      remA--; remB--;
      clashWinner = null; clashLoser = null;
      log(`[マッチ引き分け] 両者のコインを1枚失う。残り ${remA} vs ${remB}`);
    }
    await animateClashResult({
      winner: clashWinner ? playerLabel(clashWinner) : null,
      left: animSideFromSkill(pA, skillA, rollA.power, rollA.coins, remA, clashWinner===pA?'WIN':'LOSE'),
      right: animSideFromSkill(pB, skillB, rollB.power, rollB.coins, remB, clashWinner===pB?'WIN':'LOSE')
    });
  }

  // 標準的なプレイアブル側の精神変動として、マッチ決着時に勝者へ1回だけ加算。
  // ここでは特殊な敵固有の「マッチ敗北で精神減少」はまだ共通システム化しない。
  if (clashWinner) {
    const gain = getClashSanityGain(clashCount);
    log(`[精神変動] マッチ${clashCount}回: 勝者+${gain}`);
    changeSanity(clashWinner, gain, `マッチ勝利(${clashCount}回)`);
  }

  if (remA > 0) {
    log(`[マッチ決着] ${playerLabel(pA)}「${skillA.name}」の残存コイン${remA}枚で攻撃/効果を実行。`);
    applySkillClashWinEffects(pA, skillA, pB);
    await executeWinningSkillCoins(pA, skillA, pB, remA, slotA, true);
  } else if (remB > 0) {
    log(`[マッチ決着] ${playerLabel(pB)}「${skillB.name}」の残存コイン${remB}枚で攻撃/効果を実行。`);
    applySkillClashWinEffects(pB, skillB, pA);
    await executeWinningSkillCoins(pB, skillB, pA, remB, slotB, true);
  }
  if (isDefenseSkill(skillA)) stockUnusedDefenseCoins(slotA, Math.max(0, remA));
  if (isDefenseSkill(skillB)) stockUnusedDefenseCoins(slotB, Math.max(0, remB));
}

async function executeWinningSkillCoins(attacker, skill, defender, coinCount, slot, fromClash = false) {
  generateEgoResourceForSkill(attacker, skill, slot);
  if (skill.skillType === 'defense' || skill.skillType === 'evade') {
    if (fromClash) {
      if (skill.skillType === 'evade') {
        changeSanity(attacker, 0, '');
        log(`[回避] ${playerLabel(attacker)}の「${skill.name}」がマッチに勝利。`);
        recoverStagger(attacker, skill.basePower || 0);
      } else {
        log(`[防御] ${playerLabel(attacker)}の「${skill.name}」がマッチに勝利。`);
      }
    }
    return;
  }
  for (let i = 0; i < coinCount; i++) {
    const beforeHp = gameState[defender].hp;
    await animateOneSided({ attacker: playerLabel(attacker), defender: playerLabel(defender), left: animSideFromSkill(attacker, skill, '－', [], coinCount-i), right: animSideFromSkill(defender, skill, '－', [], 0) });
    executeAttackCoin(attacker, skill, defender, i, slot, fromClash);
    const damage = Math.max(0, beforeHp - gameState[defender].hp);
    await animateHit({ attacker: playerLabel(attacker), defender: playerLabel(defender), damage, effects: 'コイン効果 / On Hit', left: { ...animSideFromSkill(attacker, skill, damage, [], coinCount-i-1), resultText: `${damage}ダメージ` }, right: { ...animSideFromSkill(defender, skill, gameState[defender].hp, [], 0), resultText: `残り${gameState[defender].hp}` } });
    if (gameState[defender].hp <= 0) break;
  }
}

async function resolveOneSided(slot) {
  const attacker = slot.owner, defender = slot.targetSlot ? slot.targetSlot.owner : opponentOf(attacker);
  log(`[一方攻撃] ${playerLabel(attacker)}速度(${slot.speed}) [${slot.card.name}] → ${slot.targetSlot ? slotLabel(slot.targetSlot) : `${playerLabel(defender)}本体`}`);
  if (slot.card.skillType === 'counter_clash') { log(`[マッチ可能反撃] 「${slot.card.name}」は相手からマッチされた場合のみ使用。`); return; }
  if (isCounterSkill(slot.card)) { log(`[反撃待機] 「${slot.card.name}」を反撃として待機。`); return; }
  if (isDefenseSkill(slot.card)) {
    // 一方の防御は幕終了までストックし、後続攻撃を受ける。
    stockUnusedDefenseCoins(slot, 0); return;
  }
  const attackCoinCount = slot.card.coinCount || 0;
  generateEgoResourceForSkill(attacker, slot.card, slot);
  for (let i = 0; i < attackCoinCount; i++) {
    await animateOneSided({ attacker: playerLabel(attacker), defender: playerLabel(defender), left: animSideFromSkill(attacker, slot.card, '－', [], attackCoinCount-i), right: { player: defender, name: playerLabel(defender), skill: gameState[defender].slots?.find(s => s?.resolved === false)?.card || null, power:'－', modifier:'防御判定待ち', coins:[], remaining:0 } });
    const beforeHp = gameState[defender].hp;
    const defense = gameState[defender].defenseStock.find(e => e.active);
    if (defense) {
      resolveDefenseAgainstAttack(attacker, slot.card, defender, defense, i, slot);
      if (gameState[defender].hp <= 0) break;
    } else {
      executeAttackCoin(attacker, slot.card, defender, i, slot, false);
    }
    const damage = Math.max(0, beforeHp - gameState[defender].hp);
    await animateHit({ attacker: playerLabel(attacker), defender: playerLabel(defender), damage, effects: defense ? '防御/回避判定' : 'On Hit', left: { ...animSideFromSkill(attacker, slot.card, damage, [], attackCoinCount-i-1), resultText: `${damage}ダメージ` }, right: { player: defender, skill: defense?.skill || null, name: playerLabel(defender), power: gameState[defender].hp, modifier: defense ? '防御処理済み' : '', coins:[], remaining:0, resultText: `残り${gameState[defender].hp}` } });
    if (gameState[defender].hp <= 0) break;
  }
}

function resolveDefenseAgainstAttack(attacker, attackSkill, defender, defense, index, attackerSlot = null) {
  const dSkill = defense.skill;
  generateEgoResourceForSkill(defender, dSkill, defense.slot);
  const clashAttack = rollSkillForClash(attacker, attackSkill, 1, defender, dSkill);
  const clashDefense = rollSkillForClash(defender, dSkill, 1, attacker, attackSkill);
  const rA = clashAttack.power, rD = clashDefense.power;
  log(`[守備] ${playerLabel(defender)}「${dSkill.name}」 ${rD} vs ${playerLabel(attacker)}「${attackSkill.name}」 ${rA}`);
  if (rD >= rA) {
    defense.active = false;
    if (dSkill.skillType === 'evade') {
      log(`[回避成功] ${playerLabel(defender)}の「${dSkill.name}」が攻撃コインを回避。`);
      recoverStagger(defender, rD);
      applySkillClashWinEffects(defender, dSkill, attacker);
      return;
    }
    const prevented = Math.max(0, rD - rA);
    log(`[防御成功] ${playerLabel(defender)}がダメージを${prevented}軽減。`);
    if (rD === rA) triggerSinkingOnAttackReceived(defender);
    return;
  }
  defense.active = false;
  const damage = Math.max(0, rA - rD);
  executeAttackDamage(attacker, attackSkill, defender, damage, index, attackerSlot, null, true);
}

function executeAttackCoin(attacker, skill, defender, coinIndex, slot, fromClash) {
  const coin = flipCoin(attacker, skill, coinIndex);
  triggerBleedOnAttackRoll(attacker);
  let power = coin.power;
  const source = coinIndex < (skill.coins?.length || 0) ? skill.coins[coinIndex] : {};
  const onHit = source?.onHit || skill.onHit || null;
  if (onHit?.special === 'underwater_consume_sinking') {
    const consumed = consumeSinkingCount(defender, 3);
    if (consumed.consumed > 0) { power += consumed.power; log(`[的中] ${playerLabel(attacker)}の「${skill.name}」: 沈潜${consumed.consumed}回を解除し、威力+${consumed.power}`); }
  }
  logCoinRoll(attacker, skill, { ...coin, power }, fromClash ? '（マッチ後攻撃）' : '（一方攻撃）');
  executeAttackDamage(attacker, skill, defender, power, coinIndex, slot, coin, false);
}

function executeAttackDamage(attacker, skill, defender, amount, coinIndex, slot, coin, preventedByDefense) {
  // 攻撃が実際にダメージを通した場合は、防御を挟んだ攻撃でもOn Hitを発火させる。
  // 一方、防御成功でダメージが0ならこの関数自体を通らないため、デバフは発生しない。
  // 特殊なダメージ補正で0ダメージの攻撃についても、明示的な攻撃コインとしてはOn Hitを発火させる。
  if (amount > 0) {
    applyDamage(defender, skill.attackType, amount, attacker, { isEgo: !!skill.isEgo, sin: skill.sin });
    if (gameState[defender].hp < 0) gameState[defender].hp = 0;
  }
  if (amount > 0) triggerOnHit(attacker, skill, defender, coin, slot);
  const source = coin?.index != null ? (skill.coins?.[coin.index]?.onHit || skill.onHit) : null;
  if (source?.special === 'sunken_memory_reuse') {
    const sinking = getStatus(defender, 'sinking');
    const reuseCount = slot?._sunkenReuseCount || 0;
    if (reuseCount < 3 && sinking?.power >= 4 && gameState[defender].hp > 0) {
      if (!slot) return;
      slot._sunkenReuseCount = reuseCount + 1;
      log(`[再使用 ${reuseCount + 1}/3] ${playerLabel(attacker)}の「${skill.name}」を再使用。`);
      executeAttackCoin(attacker, skill, defender, coinIndex, slot, false);
    }
  }
}

function resolveLegacyClashableCounter(slotA, slotB) {
  const hasA = hasClashableCounter(slotA.card), hasB = hasClashableCounter(slotB.card);
  if (hasA && hasB) { log(`[マッチ可能反撃] 両者が同時に待機しているため不発。`); return; }
  const counterSlot = hasA ? slotA : slotB, attackSlot = hasA ? slotB : slotA;
  const counterOwner = counterSlot.owner, attacker = attackSlot.owner;
  const counter = counterSlot.card.legacyDice.find(d => d.type === 'counter_clash');
  const attackSkill = attackSlot.card;
  const attackCoin = flipCoin(attacker, attackSkill, 0);
  const rAttack = attackCoin.power;
  const rCounter = rollLegacyCounter(counterOwner, counter);
  log(`[マッチ可能反撃] ${playerLabel(counterOwner)}(${rCounter}) vs ${playerLabel(attacker)}(${rAttack})`);
  if (rCounter > rAttack) {
    applyDamage(attacker, counter.attackType, rCounter, counterOwner, { suppressCounter: true });
    triggerOnHit(counterOwner, counterSlot.card, attacker, counter, counterSlot);
    log(`[マッチ可能反撃成功] ${playerLabel(counterOwner)}が勝利。`);
  } else {
    applyDamage(counterOwner, attackSkill.attackType, Math.max(0, rAttack - rCounter), attacker);
    log(`[マッチ可能反撃失敗] ${playerLabel(attacker)}が勝利。`);
  }
}
function rollLegacyCounter(player, dice) { return Math.floor(Math.random() * (dice.max - dice.min + 1)) + dice.min + (gameState[player].core?.slashBonus && dice.attackType === 'slash' ? gameState[player].core.slashBonus : 0); }

function applyDamage(target, attackType, amount, attacker, options = {}) {
  const p = gameState[target];
  if (attacker && isAttackType(attackType)) triggerSinkingOnAttackReceived(target);
  const feast = attacker ? getStatus(attacker, 'blood_feast') : null;
  if (feast?.count > 0 && feast.power > 0 && amount > 0) { amount += feast.power; log(`[血宴強化] ${playerLabel(attacker)}のダメージ +${feast.power}`); }
  const critical = tryBreathCritical(attacker, amount); amount = critical.amount;
  const sin = options.sin || null;
  const resistance = getResistanceWithDown(target, attackType, sin);
  const sinResistance = options.isEgo ? (p.sinRes?.[sin] ?? 1.0) : 1.0;
  const mult = p.isStaggered ? 2.0 : resistance;
  const outputMult = attacker ? getDamageOutputMultiplier(attacker, attackType, sin) : 1;
  const takenMult = getDamageTakenMultiplier(target, attackType, sin);
  const finalDmg = Math.floor(Math.max(0, amount) * mult * sinResistance * outputMult * takenMult);
  p.hp = Math.max(0, p.hp - finalDmg);
  log(`[ダメージ補正] ${playerLabel(target)}: ${amount} → ${finalDmg}（${p.isStaggered ? '混乱中補正 ×2.0' : `耐性(${attackType}) ×${resistance}`}${options.isEgo ? ` / 罪悪耐性(${getSinLabel(sin)}) ×${sinResistance}` : ''} / 与ダメ×${outputMult.toFixed(2)} / 被ダメ×${takenMult.toFixed(2)}）`);
  emitHook('onDamage', { target, diceType: attackType, amount: finalDmg, attacker });
  if (!p.isStaggered) {
    p.stagger = Math.max(0, p.stagger - finalDmg);
    if (p.stagger <= 0) { p.isStaggered = true; p.staggerSkipDone = false; log(`⚡⚡ [混乱] ${playerLabel(target)}が混乱状態になりました！ ⚡⚡`); updateResDisplay(target); }
  }
  if (!options.suppressCounter && p.hp > 0 && !p.isStaggered && finalDmg > 0) triggerNormalCounter(target, attacker, finalDmg);
}
function tryBreathCritical(attacker, amount) {
  if (!attacker || amount <= 0) return { amount, critical: false };
  const status = getStatus(attacker, 'breath');
  if (!status || status.count <= 0 || status.power <= 0) return { amount, critical: false };
  const chance = Math.min(99, Math.max(0, status.power));
  if (Math.random() * 100 >= chance) return { amount, critical: false };
  const criticalAmount = Math.floor(amount * 1.5); consumeStatusCount(attacker, 'breath');
  log(`[クリティカル] ${playerLabel(attacker)}の「呼吸」が発動！ ${amount} → ${criticalAmount}`);
  return { amount: criticalAmount, critical: true };
}
function triggerNormalCounter(target, attacker, damage) {
  if (!damage || damage <= 0) return;
  const p = gameState[target], pending = p.counterSkills.find(c => !c.used);
  if (!pending) return;
  pending.used = true; pending.slot.counterUsed = true;
  if (pending.skill) {
    const skill = pending.skill;
    generateEgoResourceForSkill(target, skill, pending.slot);
    log(`[反撃] ${playerLabel(target)}が「${skill.name}」の反撃！`);
    for (let i = 0; i < (skill.coinCount || 0); i++) {
      const coin = flipCoin(target, skill, i);
      triggerBleedOnAttackRoll(target);
      logCoinRoll(target, skill, coin, '（反撃）');
      executeAttackDamage(target, skill, attacker, coin.power, i, pending.slot, coin, false);
      if (gameState[attacker].hp <= 0) break;
    }
    return;
  }
  // 旧式の反撃ダイスは、マッチ可能反撃とは別に互換用として残す。
  if (pending.dice?.length) {
    generateEgoResourceForSkill(target, pending.slot.card, pending.slot);
    log(`[反撃] ${playerLabel(target)}が反撃！`);
    pending.dice.forEach(dice => {
      const r = rollLegacyCounter(target, dice);
      log(`[反撃] ${playerLabel(target)} ${r} → ${playerLabel(attacker)}`);
      applyDamage(attacker, dice.attackType || 'blunt', r, target, { suppressCounter: true });
      triggerOnHit(target, pending.slot.card, attacker, dice, pending.slot);
    });
  }
}
function applyStaggerOnly(target, amount) {
  const p = gameState[target]; if (p.isStaggered) return;
  p.stagger = Math.max(0, p.stagger - Math.floor(amount));
  if (p.stagger <= 0) { p.isStaggered = true; p.staggerSkipDone = false; log(`⚡⚡ [混乱] ${playerLabel(target)}が混乱状態になりました！ ⚡⚡`); updateResDisplay(target); }
}
function recoverStagger(player, amount) {
  const p = gameState[player];
  if (!p.isStaggered) { p.stagger = Math.min(p.maxStagger, p.stagger + Math.max(0, amount)); log(`[回復] ${playerLabel(player)}の混乱耐性が${amount}回復`); }
}
function markFirstUsedPage(player) {
  if (gameState[player].core?.id !== 'core_4' || !gameState[player].bloodPactFirstPageAvailable) return false;
  gameState[player].bloodPactFirstPageAvailable = false; return true;
}
function markFirstSinkingThinkingPage(player) {
  if (gameState[player].core?.id !== 'core_6' || !gameState[player].sinkingThinkingFirstPageAvailable) return false;
  gameState[player].sinkingThinkingFirstPageAvailable = false; return true;
}
function getDicePowerBonus(player, dice) { return getCoinPowerBonus(player, { attackType: dice?.attackType || dice?.type }); }
function getDicePowerBonusReason(player, dice) { return getCoinPowerBonusReason(player, { attackType: dice?.attackType || dice?.type }); }
function rollDice(min, max, bonus = 0) { return Math.floor(Math.random() * (max - min + 1)) + min + bonus; }

function surrender() { if (confirm('降参しますか？')) { gameState.p1.hp = 0; checkGameEnd(); } }
function syncResultLog() { const s = document.getElementById('log'), t = document.getElementById('result-log'); if (s && t) { t.innerHTML = s.innerHTML; t.scrollTop = t.scrollHeight; } }
function checkGameEnd() {
  const modal = document.getElementById('result-modal'), title = document.getElementById('result-title');
  if (gameState.p2.hp <= 0) { title.innerText = 'VICTORY'; title.className = 'result-title win'; syncResultLog(); modal.style.display = 'flex'; emitHook('onMatchWin', { player: 'p1' }); emitHook('onMatchLose', { player: 'p2' }); return true; }
  if (gameState.p1.hp <= 0) { title.innerText = 'DEFEAT'; title.className = 'result-title lose'; syncResultLog(); modal.style.display = 'flex'; emitHook('onMatchWin', { player: 'p2' }); emitHook('onMatchLose', { player: 'p1' }); return true; }
  return false;
}
function retryGame() { gameState.round = 0; document.getElementById('battle-screen').classList.remove('active'); document.getElementById('builder-screen').classList.add('active'); document.getElementById('result-modal').style.display = 'none'; document.getElementById('log').innerHTML = '--- 戦闘開始 ---'; }
