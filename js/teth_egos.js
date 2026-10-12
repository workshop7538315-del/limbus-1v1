// teth_egos.js — TETH E.G.O「四本目のマッチの火」（イサン / 憤怒）・「一生シチュー」（ドンキホーテ / 色欲）と状態「火傷」
//
// 出典: limbuscompany.wiki.gg（4th_Match_Flame_Yi_Sang / Lifetime_Stew_Don_Quixote）の解析V（Threadspin Tier V）の数値をそのまま移植。
// 1対1向けの調整（原作との違い）:
//   - 「全ての対象の火傷」→ 相手1人の火傷威力。「主対象」→ 相手。
//   - 「配置順で味方に〇〇を付与（最大5人）」→ 使用者本人のみ（この幕と次の幕）。
//   - 罪悪資源の上限は99（state.js MAX_EGO_RESOURCE）。資源量に比例する効果は原作どおりの最大値まで伸びる。
//   - 「共鳴数」は、このゲームの共鳴（同じ罪悪のスキルが2つ以上で発生）が発生しているときのその罪悪のスキル数（最大2）。
//   - 攻撃レベル（Offense Level +3）・攻撃の重さ（Atk Weight）・オーバークロックは省略。
//   - 破壊不能コインの「マッチ敗北後はコイン威力が1に固定」は、既存のE.G.Oと同じく省略。
//   - 「攻撃前」の最終威力は、原作どおりマッチには影響せず攻撃（ダメージ）にだけ効く。
//     一生シチューの「火傷・出血4ごとに最終威力+1」はスキル自体の補正なのでマッチにも効く。
//
// 火傷（burn）: 幕終了時、威力分の固定ダメージを受け、回数-1。威力と回数を持つ状態（出血・破裂と同じ扱い）。

const MATCH_FLAME_ID = 'ego_match_flame';
const LIFETIME_STEW_ID = 'ego_lifetime_stew';

function getBurnPotency(player) { return getStatus(player, 'burn')?.power || 0; }
function skillInflictsBurn(skill) {
  return !!skill?.coins?.some(c => [c?.onHit?.status, ...(c?.onHit?.statuses || [])].some(s => s?.id === 'burn'));
}
function getResonanceValue(player, sin) { const n = getResonanceCount(player, sin); return n >= 2 ? n : 0; }

// 幕終了時の火傷ダメージ（processStatusTurnEnd から）
function processBurnTurnEnd(player, status) {
  const dmg = status.power || 0;
  status.count = Math.max(0, (status.count || 0) - 1);
  if (dmg > 0) {
    const p = gameState[player];
    const before = p.hp;
    const hp = applyLethalGuard(player, dmg);
    p.hp = Math.max(0, p.hp - hp);
    onHpDamageTaken(player, hp);
    log(`[火傷] ${playerLabel(player)} 固定ダメージ ${dmg}（HP ${before}→${p.hp}） / 残り回数: ${status.count}`);
    emitHook('onDamage', { target: player, diceType: 'burn', amount: dmg, attacker: null });
    if (!p.isStaggered && !p.staggerImmune && p.hp > 0) checkStaggerThresholds(player);
  }
  if (status.count <= 0) delete gameState[player].statuses.burn;
}

// ===== 実行時（prepareSkillExecution から）=====
function prepareTethEgo(player, skill, bonus) {
  const p = gameState[player];
  const enemy = opponentOf(player);
  // 一生シチュー: 相手の火傷＋出血の威力4ごとに最終威力+1（最大3）
  if (skill?.egoId === LIFETIME_STEW_ID) {
    const total = getBurnPotency(enemy) + (getStatus(enemy, 'bleed')?.power || 0);
    const add = Math.min(3, Math.floor(total / 4));
    if (add > 0) { bonus.finalPower += add; log(`[一生シチュー] 火傷+出血の威力${total} → 最終威力+${add}`); }
  }
  // 火の粉（四本目のマッチの火パッシブ）: 憤怒スキルか火傷を与えるスキルの使用時、相手の火傷の威力か回数が6以上ならマッチ威力+1
  if (hasEgoPassive(player, 'ego_match_flame_passive') && (skill?.sin === 'wrath' || skillInflictsBurn(skill))) {
    const b = getStatus(enemy, 'burn');
    if (b && ((b.power || 0) >= 6 || (b.count || 0) >= 6)) {
      bonus.clashPower = (bonus.clashPower || 0) + 1;
      log(`[火の粉] ${playerLabel(player)}「${skill.name}」: 相手の火傷6以上でマッチ威力+1`);
    }
  }
  // 燃え上がる: この幕で最初に使う基本攻撃スキル（E.G.O以外）の最終威力+2
  if (getStatus(player, 'blazing')?.count > 0 && !skill?.isEgo && skill?.skillType === 'attack' && p.blazingFirstRound !== gameState.round) {
    p.blazingFirstRound = gameState.round;
    bonus.finalPower += 2;
    bonus.blazing = true; bonus.blazingSelfDamage = 0;
    log(`[燃え上がる] ${playerLabel(player)}「${skill.name}」: 最終威力+2（的中ごとに最大HPの2%を失う）`);
  }
}

// ===== 攻撃前（applyEgoBeforeAttack から）=====
function tethEgoBeforeAttack(attacker, skill) {
  const bonus = gameState[attacker]?.execBonus;
  if (!bonus || bonus.skill !== skill) return;
  const enemy = opponentOf(attacker);
  if (skill?.egoId === MATCH_FLAME_ID) {
    const burn = getBurnPotency(enemy);
    const maxPow = skill.isCorrosion ? 6 : 4;
    const perDmg = skill.isCorrosion ? 0.015 : 0.01;
    const maxDmg = skill.isCorrosion ? 0.45 : 0.30;
    const pow = Math.min(maxPow, Math.floor(burn / 6));
    const dmg = Math.min(maxDmg, burn * perDmg);
    bonus.finalPower += pow;
    bonus.damageBonus = (bonus.damageBonus || 0) + dmg;
    log(`[四本目のマッチの火] 相手の火傷${burn} → 最終威力+${pow}・与ダメージ+${Math.round(dmg * 1000) / 10}%`);
  }
  if (skill?.egoId === LIFETIME_STEW_ID) {
    const p = gameState[attacker];
    const lust = p.egoResources?.lust || 0;
    // 色欲資源6つにつき、編成順に味方1名へ次のターンに色欲威力増加1（侵蝕は色欲ダメージ量増加1も）（最大5名）。
    // 1対1では味方は自分だけなので「色欲資源6以上なら自分に次の幕」。
    const allyUnits = Math.min(5, Math.floor(lust / 6));
    const buffText = allyUnits > 0 ? (skill.isCorrosion ? '次の幕に色欲威力増加1・色欲ダメージ量増加1' : '次の幕に色欲威力増加1') : '色欲資源6未満のため付与なし';
    if (allyUnits > 0) {
      addStatusNextTurn(attacker, 'lust_power_up', 1, 1);
      if (skill.isCorrosion) addStatusNextTurn(attacker, 'lust_damage_up', 1, 1);
    }
    let dmg;
    if (!skill.isCorrosion) {
      dmg = Math.min(1.2, lust * 0.06);
      log(`[一生シチュー] 色欲資源${lust}: ${buffText}・与ダメージ+${Math.round(dmg * 100)}%`);
    } else {
      dmg = Math.min(1.0, lust * 0.05);
      const want = Math.min(8, getResonanceValue(attacker, 'lust') * 2);
      const used = Math.min(want, p.egoResources.lust || 0);
      if (used > 0) p.egoResources.lust -= used;
      const extra = Math.min(1.6, used * 0.2);
      log(`[一生シチュー・侵蝕] 色欲資源${lust}: ${buffText}・与ダメージ+${Math.round(dmg * 100)}%、色欲資源${used}消耗 → +${Math.round(extra * 100)}%`);
      dmg += extra;
    }
    bonus.damageBonus = (bonus.damageBonus || 0) + dmg;
  }
}

// ===== 攻撃終了時（applyEgoAttackEnd から）=====
function tethEgoAttackEnd(attacker, skill) {
  if (skill?.egoId !== MATCH_FLAME_ID || !skill.isCorrosion) return;
  const p = gameState[attacker];
  if (p.blazingGainRound === gameState.round) return; // 1幕に1回
  p.blazingGainRound = gameState.round;
  const s = ensureStatus(attacker, 'blazing');
  s.count = 2; // この幕の終了時に1、次の幕の終了時に0（次の幕の終わりまで）
  log(`[四本目のマッチの火・侵蝕] ${playerLabel(attacker)}は燃え上がるを得る（次の幕の終わりまで）`);
}

// 侵蝕のマッチ敗北: 基礎威力-12（executeDonScissorsUnbreakableLoss から）
function tethEgoClashLose(player, skill) {
  if (skill?.egoId !== MATCH_FLAME_ID || !skill.isCorrosion) return;
  const bonus = gameState[player]?.execBonus;
  if (!bonus || bonus.skill !== skill) return;
  bonus.finalPower -= 12;
  log(`[四本目のマッチの火・侵蝕] マッチ敗北: 基礎威力-12`);
}

// ===== マッチ勝利（applySkillClashWinEffects から）=====
// 火の粉: マッチ勝利時、相手に火傷（憤怒の共鳴数×2、最大8）
function tethEgoClashWin(player, skill, target) {
  if (!hasEgoPassive(player, 'ego_match_flame_passive')) return;
  if (skill?.sin !== 'wrath' && !skillInflictsBurn(skill)) return;
  const n = Math.min(8, getResonanceValue(player, 'wrath') * 2);
  if (n <= 0) return;
  const r = changeStatusPower(target, 'burn', n);
  log(`[火の粉] ${playerLabel(player)}: マッチ勝利で${playerLabel(target)}に火傷${n}（${r.before}→${r.after}）`);
}

// ===== 的中時（triggerOnHit から）=====
// 燃え上がる: 対象スキルの的中ごとに最大HPの2%を失う（スキルにつき最大10%）。混乱せず、HP1未満にならない。
function tethEgoOnHit(player, skill) {
  const bonus = gameState[player]?.execBonus;
  if (!bonus?.blazing || bonus.skill !== skill) return;
  const p = gameState[player];
  const cap = Math.floor(p.maxHp * 0.10);
  const loss = Math.min(Math.floor(p.maxHp * 0.02), cap - (bonus.blazingSelfDamage || 0));
  if (loss <= 0) return;
  bonus.blazingSelfDamage = (bonus.blazingSelfDamage || 0) + loss;
  const before = p.hp;
  p.hp = Math.max(1, p.hp - loss);
  log(`[燃え上がる] ${playerLabel(player)}のHP ${before}→${p.hp}`);
}

// ===== 幕開始時（processEgoTurnStart から）=====
// 暴食のるつぼ（一生シチューパッシブ）: 色欲以外の資源1つをランダムに色欲へ変換。色欲が20以上なら代わりに色欲威力増加1。
function tethEgoTurnStart(player) {
  if (!hasEgoPassive(player, 'ego_lifetime_stew_passive')) return;
  const r = gameState[player].egoResources;
  if ((r.lust || 0) >= 20) {
    addCombatStatus(player, 'lust_power_up', 1, 1);
    log(`[暴食のるつぼ] ${playerLabel(player)}: 色欲資源20以上のため色欲威力増加1`);
    return;
  }
  const pool = SIN_TYPES.filter(s => s !== 'lust' && (r[s] || 0) > 0);
  if (!pool.length) return;
  const sin = pool[Math.floor(Math.random() * pool.length)];
  r[sin]--; r.lust = (r.lust || 0) + 1;
  log(`[暴食のるつぼ] ${playerLabel(player)}: ${getSinLabel(sin)}資源1を色欲に変換（色欲${r.lust}）`);
}

// 暴食のるつぼ: 色欲属性の基本攻撃スキル（E.G.O以外）の与ダメージ+色欲資源1につき1%（最大10%）（applyDamage から）
function getTethEgoDamageBonus(attacker, skill) {
  if (!hasEgoPassive(attacker, 'ego_lifetime_stew_passive') || skill?.isEgo || skill?.sin !== 'lust' || skill?.skillType !== 'attack') return 0;
  return Math.min(0.10, (gameState[attacker].egoResources?.lust || 0) * 0.01);
}
