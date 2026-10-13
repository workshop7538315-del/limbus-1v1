// tremor.js — 振動の人格「20区ユロージヴィ」（core_13、card_62〜65）と E.G.O「低い鳴き声」（ホンル / TETH / 怠惰）
//
// 参考（limbuscompany.wiki.gg）:
//   District 20 Yurodivy Hong Lu（同期4）／ Cavernous Wailing Hong Lu（解析IV。ページ上の最高段階）
// このゲームの振動: 振動爆発で「次の混乱閾値（HP）」が振動威力分上がる（effects.js triggerTremorBurst）。
// 1対1向けの調整:
//   - ユロージヴィが自分に貯める「振動」は回数で数える（自分には回数だけを得るため。「自分の振動6以上」「振動10を消費」は回数）。
//     相手の「振動6以上」は相手の振動威力で判定。
//   - 「振幅もつれ（Amplitude Entanglement）」「振幅変換（Amplitude Conversion）」は、どちらも相手の振動を「振動 - 残響」に変える処理として実装（重ね合わせは省略）。
//   - 「待って?!」のバリア上限は HP規模（LCB 214 → 75）に合わせ 13 → 5 に縮小。
//   - 低い鳴き声の「最も高い共鳴が4以上」は、1対1では「共鳴が発生している（2以上）」に置き換え。
//   - サポートパッシブは採用しない。
//   - 原作では味方が振動回数を供給するが、1対1では相手の振動回数がすぐ尽きて振動爆発がほぼ起きない。
//     そのため「自分の振動回数+N」の効果で、相手にも振動回数+Nを与える（1対1向けの追加。推理開始・変形杖術）。
//
// 振動 - 残響（tremor.variant = 'reverb'）: 振動爆発のたび、振動威力分の怠惰の固定ダメージを受ける。

function getTremor(player) { return getStatus(player, 'tremor'); }
function getTremorPotency(player) { return getTremor(player)?.power || 0; }
function getTremorCount(player) { return getTremor(player)?.count || 0; }

// 振動の種類を「残響」に変える（威力・回数はそのまま）
function convertTremorReverb(target, reason = '') {
  const s = getTremor(target);
  if (!s || s.count <= 0) return false;
  s.variant = 'reverb'; s.name = '振動 - 残響';
  log(`[振幅変換] ${playerLabel(target)}の振動が「振動 - 残響」になった${reason ? `（${reason}）` : ''}`);
  return true;
}

// 振動爆発（発生させた側 source を記録する版）。既存の 'tremor_burst' コイン効果もここを通す。
function tremorBurstBy(source, target, multiplier = 1, skill = null) {
  const s = getTremor(target);
  if (!s || s.count <= 0 || s.power <= 0) return 0;
  const potency = s.power;
  const reverb = s.variant === 'reverb';
  const raised = triggerTremorBurst(target, multiplier);
  if (reverb) {
    const t = gameState[target];
    const before = t.hp;
    const hp = applyLethalGuard(target, potency);
    t.hp = Math.max(0, t.hp - hp);
    onHpDamageTaken(target, hp);
    log(`[振動 - 残響] ${playerLabel(target)}は怠惰の固定ダメージ${potency}（HP ${before}→${t.hp}）`);
    if (!t.isStaggered && !t.staggerImmune && t.hp > 0) checkStaggerThresholds(target);
  }
  if (!source || source === target) return raised;
  const p = gameState[source];
  if (p.tremorBurstRound !== gameState.round) { p.tremorBurstRound = gameState.round; p.tremorBurstCount = 0; p.vibroweldExtra = 0; p.gloominessCount = 0; }
  p.tremorBurstCount++;
  // 振動溶接変形杖: 振動爆発で、さらに相手の混乱閾値を振動威力分上げる（1幕3回）
  if (p.core?.vibroweld && p.vibroweldExtra < 3) {
    p.vibroweldExtra++;
    adjustNextStaggerThreshold(target, potency, '振動溶接変形杖');
  }
  // 低い鳴き声パッシブ「陰鬱」: 振動爆発を起こすスキルを使ったとき、相手に攻撃レベル減少1・次の幕に防御レベル減少2（1幕3回、スキルにつき1回）
  if (hasEgoPassive(source, 'ego_cavernous_wailing_passive') && p.gloominessCount < 3) {
    const b = p.execBonus;
    if (!b || !b.gloominessDone) {
      if (b) b.gloominessDone = true;
      p.gloominessCount++;
      addCombatStatus(target, 'offense_level_down', 1, 1);
      addStatusNextTurn(target, 'defense_level_down', 2, 1);
      log(`[陰鬱] ${playerLabel(target)}に攻撃レベル減少1、次の幕に防御レベル減少2`);
    }
  }
  return raised;
}

// 実行時（charge.js prepareSkillExecution から）
//   selfTremorCoinPowerAt: { min, bonus }  自分の振動回数が min 以上ならコイン威力+bonus
//   targetTremorClashAt: { min, bonus }    相手の振動威力が min 以上ならマッチ威力+bonus
//   targetTremorClashPer: { per, max }     相手の振動威力 per ごとにマッチ威力+1（最大max）
//   culpritConsume: true                   自分の振動回数が15未満なら10消費してコイン威力+2、15以上なら15消費してコイン威力+3
//   tremorDamage: { base, div, max, resBase, resDiv, resMax }  低い鳴き声: 相手に振動があれば与ダメージ+(base+(威力+回数)/div)%
function prepareTremorSkill(player, skill, bonus) {
  if (!skill) return;
  const enemy = opponentOf(player);
  const selfCount = getTremorCount(player), pot = getTremorPotency(enemy);
  const parts = [];
  const t1 = skill.selfTremorCoinPowerAt;
  if (t1 && selfCount >= t1.min) { bonus.coinPower += t1.bonus; parts.push(`自分の振動回数${selfCount}でコイン威力+${t1.bonus}`); }
  const t2 = skill.targetTremorClashAt;
  if (t2 && pot >= t2.min) { bonus.clashPower = (bonus.clashPower || 0) + t2.bonus; parts.push(`相手の振動${pot}でマッチ威力+${t2.bonus}`); }
  const t3 = skill.targetTremorClashPer;
  if (t3) { const b = Math.min(t3.max, Math.floor(pot / t3.per)); if (b > 0) { bonus.clashPower = (bonus.clashPower || 0) + b; parts.push(`相手の振動${pot}でマッチ威力+${b}`); } }
  if (skill.culpritConsume) {
    const use = selfCount >= 15 ? 15 : (selfCount >= 10 ? 10 : 0);
    if (use > 0) {
      const st = getTremor(player);
      st.count -= use;
      if (st.count <= 0) delete gameState[player].statuses.tremor;
      bonus.tremorConsumed = use;
      bonus.coinPower += use >= 15 ? 3 : 2;
      parts.push(`自分の振動回数${use}を消費してコイン威力+${use >= 15 ? 3 : 2}`);
    } else bonus.tremorConsumed = 0;
  }
  const td = skill.tremorDamage;
  if (td) {
    const s = getTremor(enemy);
    if (s && s.count > 0) {
      const sum = (s.power || 0) + (s.count || 0);
      const res = SIN_TYPES.some(sin => hasResonance(player, sin));
      const dmg = res ? Math.min(td.resMax, (td.resBase + sum / td.resDiv) / 100) : Math.min(td.max, (td.base + sum / td.div) / 100);
      bonus.damageBonus = (bonus.damageBonus || 0) + dmg;
      parts.push(`相手の振動(威力+回数${sum})${res ? '・共鳴あり' : ''}で与ダメージ+${Math.round(dmg * 1000) / 10}%`);
    }
  }
  if (parts.length) log(`[振動] 「${skill.name}」: ${parts.join('、')}`);
}

// コインの特殊効果（effects.js triggerOnHit から）
function applyTremorHitSpecial(player, card, target, special) {
  const consumed = getExecBonus(player, card, 'tremorConsumed');
  switch (special) {
    case 'yuro_burst_if6':
      if (getTremorPotency(target) >= 6) tremorBurstBy(player, target, 1, card);
      break;
    case 'yuro_entangle':
      if (consumed > 0) convertTremorReverb(target, '振幅もつれ');
      break;
    case 'yuro_burst':
      tremorBurstBy(player, target, 1, card);
      break;
    case 'yuro_burst_if_consumed10':
      if (consumed >= 10) tremorBurstBy(player, target, 1, card);
      break;
    case 'yuro_burst_then_self':
      tremorBurstBy(player, target, 1, card);
      if (consumed < 15 && gameState[player].hp > 0) { log(`[振動爆発] 「${card.name}」: 振動の消費が15未満のため、自分にも振動爆発`); tremorBurstBy(null, player, 1, card); }
      break;
    case 'cavernous_convert_burst':
      convertTremorReverb(target, '低い鳴き声');
      tremorBurstBy(player, target, 1, card);
      break;
    case 'cavernous_convert_burst2':
      convertTremorReverb(target, '低い鳴き声');
      tremorBurstBy(player, target, 1, card);
      tremorBurstBy(player, target, 1, card);
      break;
  }
}

// 使用時（effects.js applyOnUseEffects から）
function applyTremorOnUse(player, card) {
  if (card?.onUse?.special !== 'yuro_wait_shield') return;
  const p = gameState[player];
  const n = Math.min(5, 2 * getTremorCount(opponentOf(player)));
  if (n <= 0) return;
  p.shield = (p.shield || 0) + n;
  log(`[使用時] 「${card.name}」: 相手の振動回数×2のバリア+${n}（バリア${p.shield}）`);
}

// 幕終了時（battle.js executeFullTurn から）: 振動溶接変形杖 — この幕の振動爆発の回数だけ、次の幕に与ダメージ増加（最大10＝100%）
function processTremorTurnEnd(player) {
  const p = gameState[player];
  if (!p.core?.vibroweld || p.tremorBurstRound !== gameState.round || !p.tremorBurstCount) return;
  const n = Math.min(10, p.tremorBurstCount);
  addStatusNextTurn(player, 'damage_up', n, 1);
  log(`[振動溶接変形杖] ${playerLabel(player)}: この幕の振動爆発${p.tremorBurstCount}回 → 次の幕に与ダメージ増加${n}`);
}
