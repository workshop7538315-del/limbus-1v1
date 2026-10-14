// liu.js — リウ協会（火傷）の人格 core_12 と、そのスキル（card_54〜61）の処理
//
// 参考:
//   LCB「リウ協会南部4課 部長 ロージャ」（Liu Assoc. South Section 4 Director Rodion、limbuscompany.wiki.gg）のスキル・パッシブ
//   LoR「リウ協会南部1課」（libraryofruina.wiki.gg/wiki/Liu_Association_Section_1）のバトルページ・パッシブ
// 火傷はLCB方式（威力/回数、幕終了時に威力分の固定ダメージ・回数-1。teth_egos.js processBurnTurnEnd）。
// 1対1向けの調整:
//   - 「他の2体に火傷」等の拡散は、相手1人への追加付与に置き換え。
//   - 「味方のうち〜」は使用者本人。感情レベル（LoR）は存在しないため、感情レベル条件の効果は省略。
//   - 「ピンポイント電撃戦」4枚目の固定ダメージの上限は、HP規模（LCB約260 → このゲーム約80）に合わせ 30 → 10 に縮小。
//
// スキルのデータで使うフィールド（data.js）:
//   burnCoinPowerPer: { per, max }          対象の火傷威力 per ごとにコイン威力+1（最大max）
//   burnCoinPowerAt: { min, bonus }         対象の火傷威力が min 以上ならコイン威力+bonus
//   burnCountDamageAt: { min, bonus }       対象の火傷回数が min 以上なら与ダメージ+bonus
//   onUse.special: 'liu_draw_copies'        次の幕の開始時、デッキにある同名スキルを全て引く（LoR 一点刺突）
//   onUse.special: 'liu_violent_flame'      この幕、バトルページで与える火傷+1（LoR 猛炎）
//   コインの onHit.special:
//     'liu_combust'      対象の火傷回数が6以上なら、追加で火傷3を与える
//     'liu_blitz_finish' 対象の火傷威力分（最大10）の憤怒の固定ダメージを与え、対象の火傷回数-2
// 人格:
//   burnPassion: true    与ダメージ+対象の火傷威力6ごとに10%（最大30%）。戦闘開始時、相手の火傷が6以上なら憤怒ダメージ増加1・攻撃威力増加1
//   furiousFire: 2       幕開始時、手札のスキルをランダムに2枚選び、その幕のあいだ与える火傷を2倍にする（LoR 天を裂く烈火）

function getLiuSkillPrepare(player, skill, bonus) {
  if (!skill) return;
  const target = opponentOf(player);
  const burn = getStatus(target, 'burn');
  const pot = fullPowerValue(burn?.power), cnt = fullPowerValue(burn?.count);
  const parts = [];
  if (skill.burnCoinPowerPer) {
    const b = Math.min(skill.burnCoinPowerPer.max, Math.floor(pot / skill.burnCoinPowerPer.per));
    if (b > 0) { bonus.coinPower += b; parts.push(`コイン威力+${b}`); }
  }
  if (skill.burnCoinPowerAt && pot >= skill.burnCoinPowerAt.min) { bonus.coinPower += skill.burnCoinPowerAt.bonus; parts.push(`コイン威力+${skill.burnCoinPowerAt.bonus}`); }
  if (skill.burnCountDamageAt && cnt >= skill.burnCountDamageAt.min) { bonus.damageBonus = (bonus.damageBonus || 0) + skill.burnCountDamageAt.bonus; parts.push(`与ダメージ+${Math.round(skill.burnCountDamageAt.bonus * 100)}%`); }
  if (parts.length) log(`[火傷] 「${skill.name}」: 相手の火傷（威力${pot}・回数${cnt}）で${parts.join('、')}`);
  // 天を裂く烈火で選ばれたスキル（同名が複数あれば1枚分）
  const p = gameState[player];
  if (p.furiousFire?.[skill.id] > 0 && !skill.isEgo) {
    p.furiousFire[skill.id]--;
    bonus.doubleBurn = true;
    log(`[天を裂く烈火] 「${skill.name}」: この攻撃で与える火傷が2倍`);
  }
}

// 的中時の火傷付与量の補正（effects.js triggerOnHit の applyStatusEffect から）
function adjustLiuBurnEffect(player, effect, card) {
  if (effect?.id !== 'burn' || effect.target !== 'opponent') return effect;
  let power = effect.power || 0, count = effect.count || 0;
  if (getActiveStatusPower(player, 'violent_flame') > 0 && !card?.isEgo) { if (power) power += 1; else count += 1; }
  if (getExecBonus(player, card, 'doubleBurn')) { power *= 2; count *= 2; }
  return { ...effect, power: power || undefined, count: count || undefined };
}

// コインの特殊効果（effects.js triggerOnHit から）
function applyLiuHitSpecial(player, card, target, special) {
  if (special === 'liu_combust') {
    if ((getStatus(target, 'burn')?.count || 0) >= 6) {
      const r = changeStatusPower(target, 'burn', 3);
      log(`[的中] 「${card.name}」: 相手の火傷回数6以上のため火傷3 ${r.before}→${r.after}（原作の他2体への付与を相手に置き換え）`);
    }
  }
  if (special === 'liu_blitz_finish') {
    const burn = getStatus(target, 'burn');
    const dmg = Math.min(10, burn?.power || 0);
    if (dmg > 0) {
      const t = gameState[target];
      const before = t.hp;
      const hp = applyLethalGuard(target, dmg);
      t.hp = Math.max(0, t.hp - hp);
      onHpDamageTaken(target, hp);
      log(`[的中] 「${card.name}」: 火傷威力分の憤怒固定ダメージ ${dmg}（HP ${before}→${t.hp}）`);
      if (!t.isStaggered && !t.staggerImmune && t.hp > 0) checkStaggerThresholds(target);
    }
    if (burn) {
      burn.count = Math.max(0, burn.count - 2);
      if (burn.count <= 0) delete gameState[target].statuses.burn;
      log(`[的中] 「${card.name}」: ${playerLabel(target)}の火傷回数-2`);
    }
  }
}

// 使用時（effects.js applyOnUseEffects から）
function applyLiuOnUse(player, card) {
  const sp = card?.onUse?.special;
  const p = gameState[player];
  if (sp === 'liu_draw_copies') {
    p.drawCopiesNext = p.drawCopiesNext || [];
    if (!p.drawCopiesNext.includes(card.id)) p.drawCopiesNext.push(card.id);
    log(`[使用時] 「${card.name}」: 次の幕の開始時、デッキの「${card.name}」を全て引く`);
  }
  if (sp === 'liu_violent_flame') {
    addCombatStatus(player, 'violent_flame', 1, 1);
    log(`[使用時] 「${card.name}」: この幕、スキルで与える火傷+1`);
  }
}

// 幕開始時（battle.js startNewRound から。手札はこの時点で確定している）
function processLiuTurnStart(player) {
  const p = gameState[player];
  if (p.drawCopiesNext?.length) {
    p.drawCopiesNext.forEach(id => {
      const copies = p.deck.filter(c => c.id === id);
      if (!copies.length) return;
      p.deck = p.deck.filter(c => c.id !== id);
      p.hand.push(...copies);
      log(`[一点刺突] ${playerLabel(player)}はデッキの「${copies[0].name}」${copies.length}枚を引いた`);
    });
    p.drawCopiesNext = [];
  }
  p.furiousFire = {};
  const n = p.core?.furiousFire || 0;
  if (n > 0 && p.hand.length) {
    const pool = [...p.hand];
    const picked = [];
    for (let i = 0; i < n && pool.length; i++) picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    picked.forEach(c => { p.furiousFire[c.id] = (p.furiousFire[c.id] || 0) + 1; });
    log(`[天を裂く烈火] ${playerLabel(player)}: 「${picked.map(c => c.name).join('」「')}」がこの幕、与える火傷2倍`);
  }
}

// 戦闘開始時（effects.js processCoreCombatStart から）
function processLiuCombatStart(player) {
  const core = gameState[player]?.core;
  if (!core?.burnPassion) return;
  const enemy = opponentOf(player);
  if (fullPowerValue(getStatus(enemy, 'burn')?.power) >= 6) {
    addCombatStatus(player, 'wrath_damage_up', 1, 1);
    addCombatStatus(player, 'attack_power_up', 1, 1);
    log(`[熱き情熱] ${playerLabel(player)}: 相手の火傷6以上 → 憤怒ダメージ増加1・攻撃威力増加1`);
  }
}

// 与ダメージ補正（battle.js applyDamage から）
function getLiuDamageBonus(attacker, target) {
  if (!gameState[attacker]?.core?.burnPassion) return 0;
  return Math.min(0.3, Math.floor(fullPowerValue(getStatus(target, 'burn')?.power) / 6) * 0.1);
}

// 手札の表示用（ui.js）: 天を裂く烈火で選ばれているか
function isFuriousFireCard(player, card) { return (gameState[player]?.furiousFire?.[card?.id] || 0) > 0; }
