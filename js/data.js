// data.js — コアページ・バトルページ（Skill）・表示ヘルパー


// 罪悪属性: スキル情報・E.G.O資源の生成・共鳴判定・E.G.O使用時の罪悪耐性に使用している。
// 割り当て方針: 出血=色欲、沈潜=憂鬱を固定し、それ以外はページの性質から仮設定。
// 迅速な斬撃=憤怒 / 防御体勢=怠惰 / 強烈な一撃=憤怒 / 身のこなし=嫉妬 / 牽制突き=嫉妬
// 深呼吸=怠惰 / 戦略的思考=傲慢 / 反撃姿勢=傲慢 / 身構える=傲慢 / 堅牢な盾=怠惰
// ルミーズ=暴食 / 黒雲会は色欲を軸に憤怒・傲慢へ分散
// 雨天事務所は憂鬱を軸に傲慢・怠惰へ分散

const SIN_LABELS = {
  wrath: '憤怒',
  lust: '色欲',
  sloth: '怠惰',
  gluttony: '暴食',
  gloom: '憂鬱',
  pride: '傲慢',
  envy: '嫉妬'
};

// パニックタイプ定義（処理は js/panic.js）。
// 原作: limbuscompany.wiki.gg/wiki/Sanity の Panic Types 表。
//   士気低下(lowMorale): 幕開始時に精神力 -30 以下
//   パニック(panic)    : 幕開始時に精神力 -45
// 1対1では「味方」が存在しないため、味方への精神力ダメージ等は省略している（desc に明記）。
// フィールド:
//   desc          表示用の説明（実際の処理と一致させること）
//   statuses      幕開始時に得る状態 [{ id, amount }]
//   noAction      その幕は行動しない（速度ダイスなし）
//   noActionFirst 最初の士気低下時のみ行動しない
//   indiscriminate / indiscriminateFirst 敵味方識別不可（対象をランダム化）
//   headsDamageBonus 表のコインで的中したとき与ダメージ +10%×値
//   duration      パニックが続く幕数（未指定なら1幕で精神力0に回復）
//   onExpire      duration 経過時の結果: 'flee'（逃走）/ 'death'（死亡）→ いずれも敗北扱い
//   discardRandom 幕開始時に手札をランダムに捨てる枚数
const PANIC_TYPE_DEFS = {
  'パニック': {
    en: 'Panic',
    lowMorale: { desc: 'なし。' },
    panic: { desc: 'この幕、行動しない。', noAction: true }
  },
  '萎縮': {
    en: 'Atrophied',
    lowMorale: { desc: '幕開始時、攻撃威力減少2を得る。', statuses: [{ id: 'attack_power_down', amount: 2 }] },
    panic: { desc: '幕開始時、攻撃威力減少4を得る。', statuses: [{ id: 'attack_power_down', amount: 4 }] }
  },
  '憤怒': {
    en: 'Agitated',
    lowMorale: { desc: '幕開始時、与ダメージ増加1・脆弱2を得る。', statuses: [{ id: 'damage_up', amount: 1 }, { id: 'fragile', amount: 2 }] },
    panic: { desc: '幕開始時、与ダメージ増加2・脆弱5を得る。', statuses: [{ id: 'damage_up', amount: 2 }, { id: 'fragile', amount: 5 }] }
  },
  '徘徊': {
    en: 'Wandering',
    lowMorale: { desc: 'なし（原作は味方へ精神力2ダメージ。1対1では味方がいないため省略）。' },
    // このゲーム独自の効果（原作の徘徊は「味方へ精神力ダメージ・3幕後に逃走」）。2026-10-12 指示により変更。
    panic: { desc: '幕開始時、手札をランダムに1枚失う。（このゲーム独自の効果）', discardRandom: 1 }
  },
  '自殺': {
    en: 'Suicidal',
    lowMorale: { desc: '最初の士気低下時、その幕は行動しない。', noActionFirst: true },
    panic: { desc: '3幕の間行動しない。その後の幕開始時に死亡（敗北）。（原作の全味方精神力-10は省略）', noAction: true, duration: 3, onExpire: 'death' }
  },
  '狂人': {
    en: 'Maddened',
    lowMorale: { desc: '最初の士気低下時、その幕は敵味方識別不可。', indiscriminateFirst: true },
    panic: { desc: '敵味方識別不可。幕開始時、マッチ威力増加1・与ダメージ増加2を得る。', indiscriminate: true, statuses: [{ id: 'clash_power_up', amount: 1 }, { id: 'damage_up', amount: 2 }] }
  },
  '邸宅の木霊': {
    en: 'Echoes of the Manor',
    lowMorale: { desc: '幕開始時、マッチ威力減少1を得る。表のコインで的中したとき与ダメージ+10%。', statuses: [{ id: 'clash_power_down', amount: 1 }], headsDamageBonus: 1 },
    panic: { desc: '幕開始時、マッチ威力減少2・与ダメージ増加1を得る。（原作の他の味方への邸宅の木霊付与は省略）', statuses: [{ id: 'clash_power_down', amount: 2 }, { id: 'damage_up', amount: 1 }] }
  }
};
function getPanicTypeEffect(type) {
  const def = PANIC_TYPE_DEFS[type];
  if (!def) return '効果未設定';
  return `士気低下(精神-30以下): ${def.lowMorale.desc} / パニック(精神-45): ${def.panic.desc}`;
}

function getResText(val) {
  if (val <= 0.5) return { text: '耐性', class: 'res-05' };
  if (val <= 1.0) return { text: '普通', class: 'res-10' };
  return { text: '弱点', class: 'res-15' };
}

const CORE_PAGES = [
  {
    id: 'core_1', name: '見習い司書のページ',
    level: 1, hp: 80, stagger: 40, maxLight: 4, speedDiceCount: 2, speedMin: 2, speedMax: 6,
    res: { slash: 1.0, pierce: 1.0, blunt: 1.0 },
    passiveName: '二刀流 & 予備光線',
    panicType: 'パニック',
    passiveDesc: '速度ダイス数:2。光の最大値が1増加する(最大4)。'
  },
  {
    id: 'core_2', name: '裏路地の暗殺者のページ',
    level: 1, hp: 70, stagger: 35, maxLight: 3, speedDiceCount: 2, speedMin: 3, speedMax: 7,
    res: { slash: 0.5, pierce: 1.0, blunt: 1.5 },
    passiveName: '疾風 & 鋭い刃',
    panicType: '萎縮',
    passiveDesc: '速度ダイス数:2。全ての斬撃コインの威力+1。',
    slashBonus: 1
  },
  {
    id: 'core_3', name: '盾持ち兵士のページ',
    level: 1, hp: 100, stagger: 50, maxLight: 3, speedDiceCount: 1, speedMin: 1, speedMax: 3,
    res: { slash: 1.0, pierce: 0.5, blunt: 0.5 },
    passiveName: '重装 & 態勢再整頓',
    panicType: '憤怒',
    // 旧仕様「混乱耐性を3回復」はHP閾値方式では存在しないため、
    // 「次の混乱閾値を3下げる（混乱しにくくなる）」に置き換えた簡略化。
    passiveDesc: '速度ダイス数:1。幕の開始時、次の混乱閾値を3下げる（混乱しにくくなる）。',
    onTurnStart: (p) => {
      if (!gameState[p].isStaggered) adjustNextStaggerThreshold(p, -3, '態勢再整頓');
    }
  },
  {
    id: 'core_4', name: '黒雲会の組員のページ',
    level: 1, hp: 75, stagger: 38, maxLight: 3, speedDiceCount: 2, speedMin: 2, speedMax: 6,
    res: { slash: 1.0, pierce: 1.0, blunt: 1.5 },
    passiveName: '血の掟',
    panicType: '狂人',
    passiveDesc: '自分がバトルページによって出血を付与するとき出血威力+1。幕の最初のページは的中時、最初の1回に出血回数2、以降は1。',
    passives: [
      {
        trigger: 'onHit',
        effect: (p, ctx) => {
          if (!ctx || !ctx.card || !ctx.target || !ctx.bleedEffect) return;
          ctx.bleedBonus = (ctx.bleedBonus || 0) + 1;
        }
      }
    ]
  },
  {
    id: 'core_5', name: 'サンドバッグ',
    level: 1, hp: 999, stagger: 999, maxLight: 3, speedDiceCount: 1, speedMin: 1, speedMax: 3,
    res: { slash: 0.0, pierce: 0.0, blunt: 0.0 },
    passiveName: 'サンドバッグ',
    panicType: 'パニック',
    passiveDesc: '自身のすべてのコインの威力が常に0になる。',
    powerAlwaysZero: true
  },
  {
    id: 'core_6', name: '雨天事務所フィクサーのページ',
    level: 1, hp: 75, stagger: 40, maxLight: 3, speedDiceCount: 2, speedMin: 3, speedMax: 7,
    res: { slash: 1.0, pierce: 1.0, blunt: 1.5 },
    passiveName: '沈む思考',
    panicType: '徘徊',
    passiveDesc: 'その幕の最初のバトルページのみ、最初の的中時に沈潜回数2、2回目以降の的中時は1。',
    passives: [
      {
        trigger: 'onHit',
        effect: (p, ctx) => {
          if (!ctx || !ctx.target || !ctx.card || !ctx.slot) return;
          if (gameState[p].core?.id !== 'core_6') return;
          if (!ctx.slot.sinkingThinkingFirstPage) return;
          if (!ctx.sinkingEffect) return;
          if (!gameState[p].sinkingMarkedTargets?.[ctx.target]) return;
          const count = gameState[p].sinkingThinkingHitCount || 0;
          ctx.sinkingCountBonus = (ctx.sinkingCountBonus || 0) + (count === 0 ? 2 : 1);
          gameState[p].sinkingThinkingHitCount = count + 1;
        }
      }
    ]
  },
  // ===== 剣契（Blade Lineage）=====
  // 参考: LCB 剣契殺手イサン / 剣契殺手ドンキホーテ / 剣契師範ムルソー（limbuscompany.wiki.gg）。
  // 呼吸 = LCBの Poise（クリティカル率 威力×5%、クリティカル1.2倍）。数値はこのゲームのHP規模に合わせて縮小。
  {
    id: 'core_7', name: '剣契の殺手のページ',
    level: 1, hp: 75, stagger: 38, maxLight: 3, speedDiceCount: 2, speedMin: 3, speedMax: 7,
    res: { slash: 0.5, pierce: 1.5, blunt: 1.0 },
    passiveName: '呼吸を整える & 鋭利な一撃',
    panicType: 'パニック',
    // LCB 剣契殺手イサン「Poised」: マッチ勝利時に呼吸1、呼吸5ごとにコイン威力+1（最大+3）
    // LoR「剣契の殺手」キーページ（HP77・貫通弱点）の「鋭利な一撃」
    passiveDesc: '呼吸を整える: マッチ勝利時、呼吸威力1を得る。自分の呼吸威力5ごとに、全スキルのコイン威力+1（最大+3）。鋭利な一撃: 斬撃の攻撃が的中するたび、次の幕に相手へ出血1。',
    // LoR「鋭利な一撃（Razor Strike）」: 斬撃の攻撃が的中すると、次の幕に相手へ出血1
    passives: [{ trigger: 'onHit', effect: (p, ctx) => {
      if (ctx?.card?.attackType !== 'slash' || !ctx.target || ctx.target === p) return;
      addStatusNextTurn(ctx.target, 'bleed', 1, 1);
    } }],
    clashWinBreath: 1,
    breathCoinPowerPer5: 3
  },
  {
    id: 'core_8', name: 'キムサッガのページ',
    level: 1, hp: 100, stagger: 50, maxLight: 4, speedDiceCount: 2, speedMin: 3, speedMax: 6,
    res: { slash: 0.5, pierce: 1.0, blunt: 1.5 },
    passiveName: '不屈 & 本国流剣術 & 一撃 & 鋭利な一撃',
    // 2026-10-12: LCB 剣契師範ムルソー（HP259）に合わせて上方修正。黒獣-卯と同格の想定。
    panicType: 'パニック',
    // LoR「キムサッガ」キーページ（Bamboo-hatted Kim）＋LCB 剣契師範ムルソー。
    // 不屈: LoRは致死時に被ダメージ軽減。LCB本国流剣術の「致死ダメージを1回無効」と統合し、HP1で耐える効果とした。
    // LoR「鋭利な一撃（Razor Strike）」: 斬撃の攻撃が的中すると、次の幕に相手へ出血1
    passives: [{ trigger: 'onHit', effect: (p, ctx) => {
      if (ctx?.card?.attackType !== 'slash' || !ctx.target || ctx.target === p) return;
      addStatusNextTurn(ctx.target, 'bleed', 1, 1);
    } }],
    singularStrike: true,
    // LCB 剣契師範ムルソー「Swordplay of the Homeland」: 1遭遇に1回、致死ダメージを無効化しその幕はHP1未満にならない。
    // 呼吸5以上でのコイン威力・クリティカル強化は「呼吸威力5以上で攻撃スキルのコイン威力+1」に簡略化。
    passiveDesc: '不屈: 1試合に1回、致死ダメージを受けてもHP1で耐え、その幕はHPが1未満にならない。本国流剣術: 自分の呼吸威力が5以上のとき、攻撃スキルのコイン威力+1。一撃: コイン1枚のスキル（反撃以外）はマッチ威力+2。鋭利な一撃: 斬撃の攻撃が的中するたび、次の幕に相手へ出血1。',
    lethalGuardOnce: true,
    breathCoinThreshold: { min: 5, bonus: 1 }
  },
  // ===== W社（WARP整理班）=====
  // 参考: LCB「W社3級整理要員(刀) 良秀」「W社3級整理要員(双剣) ドンキホーテ」（limbuscompany.wiki.gg）、
  //       LoR「WARP整理班」。充電の上限はLoRの仕様（通常10、W社のスーツで20）に合わせた。
  // 1対1では「敵撃破時」の効果が決着と同時になるため、マッチ勝利時などに置き換えている。サポートパッシブは採用しない。
  {
    id: 'core_9', name: 'W社3級整理要員(刀)のページ',
    level: 1, hp: 75, stagger: 38, maxLight: 3, speedDiceCount: 2, speedMin: 3, speedMax: 6,
    res: { slash: 0.5, pierce: 1.0, blunt: 1.5 },
    passiveName: 'W社のスーツ & 次元屈折刃 - Type: Blade Mk7',
    panicType: 'パニック',
    // LCB 良秀「次元屈折刃 - Type: Blade Mk7」: 敵撃破時に充電+3（1幕3回）→ マッチ勝利時に充電+3（1幕2回）
    passiveDesc: 'W社のスーツ: 充電の上限が20になる（通常10）。次元屈折刃 - Type: Blade Mk7: マッチ勝利時、充電+3（1幕に2回まで）。（原作は敵撃破時）',
    chargeCap: 20,
    clashWinCharge: { amount: 3, perRound: 2, name: '次元屈折刃 - Type: Blade Mk7' }
  },
  {
    id: 'core_10', name: 'W社3級整理要員(双剣)のページ',
    level: 1, hp: 80, stagger: 40, maxLight: 3, speedDiceCount: 2, speedMin: 3, speedMax: 6,
    res: { slash: 1.0, pierce: 0.5, blunt: 1.5 },
    passiveName: 'W社のスーツ & 急速充電',
    panicType: 'パニック',
    // LCB ドンキホーテ「急速充電」: 戦闘開始時、憂鬱共鳴/3 の充電 → 戦闘開始時に充電+1、憂鬱共鳴があれば+2
    passiveDesc: 'W社のスーツ: 充電の上限が20になる（通常10）。急速充電: 戦闘開始時、充電+1（憂鬱共鳴が発生していれば+2）。',
    chargeCap: 20,
    combatStartCharge: { base: 1, gloomResonance: 2 }
  },
  // ===== 黒獣-卯（破裂）=====
  // 参考: LCB「黒獣-卯 ウーティス」（Heishou Pack - Mao Branch Outis、limbuscompany.wiki.gg）。
  // 速度差と破裂で火力を伸ばす人格。既存のコアページより一段強い想定（HP・速度・数値を高めに設定）。
  // サポートパッシブは採用しない。処理: js/rupture.js
  {
    id: 'core_11', name: '黒獣-卯のページ',
    level: 1, hp: 95, stagger: 47, maxLight: 4, speedDiceCount: 2, speedMin: 4, speedMax: 7,
    res: { slash: 0.5, pierce: 1.0, blunt: 1.5 },
    passiveName: '黒獣化[卯]',
    panicType: 'パニック',
    passiveDesc: '黒獣化[卯]: 脚力【卯】1につき与ダメージ+5%（最大15%）。脚力【卯】は幕終了時に次の幕の迅速5を得て1減少する。',
    striderDamagePer: 0.05, striderDamageMax: 0.15
  }
];

function skill(id, name, cost, type, attackType, sin, basePower, coinPower, coinCount, effect, coins, extra = {}) {
  const tags = new Set();
  if (attackType) tags.add(attackType);
  if (type === 'defense') tags.add('block');
  if (type === 'evade') tags.add('evade');
  if (type === 'counter') tags.add('counter');
  if (type === 'counter_clash') tags.add('counter_clash');
  const allCoinData = coins || Array.from({ length: coinCount }, () => ({}));
  allCoinData.forEach(coin => {
    const onHit = coin?.onHit;
    if (onHit?.draw) tags.add('draw');
    if (onHit?.status?.id) tags.add(onHit.status.id);
    (onHit?.statuses || []).forEach(st => st?.id && tags.add(st.id));
    if (onHit?.special === 'claim_bones_last') { tags.add('bleed'); tags.add('paralyze'); }
    if (onHit?.special === 'blood_festival' || onHit?.special === 'blood_feast') tags.add('bleed');
    if (onHit?.special === 'sunken_memory_reuse' || onHit?.special === 'abyss_draw_if_5' || onHit?.special === 'underwater_consume_sinking') tags.add('sinking');
  });
  if (effect?.includes('光')) tags.add('light');
  if (effect?.includes('ドロー') || effect?.includes('引く')) tags.add('draw');
  if (extra?.onUse?.status?.id) tags.add(extra.onUse.status.id);
  (extra?.onUse?.statuses || []).forEach(st => st?.id && tags.add(st.id));
  if (extra?.onUse?.special === 'bloodletting_light') tags.add('bleed');
  if (extra?.onUse?.special === 'consume_charge_draw') { tags.add('charge'); tags.add('draw'); }
  if (extra?.onUse?.special === 'overcharge') tags.add('charge');
  if (extra?.onClashWin?.status?.id) tags.add(extra.onClashWin.status.id);
  if (extra?.onClashWin?.special === 'rain_consume_sinking_if_3' || extra?.sinkingPowerPer4) tags.add('sinking');
  if (extra?.counterDice?.length) tags.add('counter');
  if (extra?.onExecute?.charge || extra?.chargeConsume || extra?.chargePowerUp || extra?.chargeCoinPowerTiers || extra?.chargeDamageTiers || extra?.chargeBasePowerPer5) tags.add('charge');
  if (extra?.onClashWin?.status?.id) tags.add(extra.onClashWin.status.id);
  if (extra?.legacyDice?.some(d => d.type === 'counter_clash')) tags.add('counter_clash');

  if ([...tags].some(t => t.endsWith('_fragility'))) tags.add('fragile');
  if (extra?.onHit?.status?.id) tags.add(extra.onHit.status.id);
  return {
    id, name, cost, skillType: type, attackType, sin,
    basePower, coinPower, coinCount,
    effect: effect || '',
    coins: allCoinData,
    tags: [...tags],
    ...extra
  };
}

const CARD_DATABASE = [
  skill('card_1', '迅速な斬撃', 1, 'attack', 'slash', 'wrath', 4, 2, 2, '', [{}, {}]),
  skill('card_2', '防御体勢', 1, 'defense', null, 'sloth', 4, 2, 2, '防御スキルとして使用する。', [{}, {}]),
  skill('card_3', '強烈な一撃', 2, 'attack', 'blunt', 'wrath', 6, 3, 2, '', [{}, {}]),
  // card_4: 旧「回避成功時に混乱耐性回復」はHP閾値方式では無効（recoverStagger は何もしない）ため説明から削除。
  skill('card_4', '身のこなしかわし', 0, 'evade', null, 'envy', 4, 2, 2, '回避スキルとして使用する。', [{}, {}]),
  skill('card_5', '牽制突き', 0, 'attack', 'pierce', 'envy', 3, 2, 2, '', [{}, {}]),
  skill('card_6', '深呼吸', 0, 'defense', null, 'sloth', 3, 1, 1, '使用時: 光1回復。', [{ }], { onUse: { light: 1 } }),
  skill('card_7', '戦略的思考', 1, 'attack', 'slash', 'pride', 4, 3, 1, '的中時: 1ドロー。', [{ onHit: { draw: 1 } }]),
  skill('card_8', '反撃姿勢', 1, 'counter', 'slash', 'pride', 4, 6, 1, '攻撃を受けたとき、このコインで反撃する。', [{ }]),
  skill('card_9', '身構える', 2, 'counter_clash', 'blunt', 'pride', 0, 0, 0, '一方攻撃を行わず、マッチ可能反撃として待機。勝ち続ける限り同じマッチ内で再使用。', [], {
    legacyDice: [{ type: 'counter_clash', attackType: 'blunt', min: 6, max: 10 }]
  }),
  skill('card_10', '堅牢な盾', 3, 'defense', null, 'sloth', 4, 2, 3, '防御コインは使用されなければ幕終了までストック。', [{}, {}, {}]),
  skill('card_11', 'ルミーズ', 1, 'attack', 'pierce', 'gluttony', 4, 2, 2, '使用時: 呼吸回数を3増加。的中時: 呼吸威力2。', [{ onHit: { status: { id: 'breath', power: 2 } } }, { onHit: { status: { id: 'breath', power: 2 } } }], { onUse: { status: { id: 'breath', count: 3 } } }),
  skill('card_12', '切り裂く', 1, 'attack', 'slash', 'lust', 2, 3, 2, '的中時: 出血威力2。', [{ onHit: { status: { id: 'bleed', power: 2, target: 'opponent' } } }, { onHit: { status: { id: 'bleed', power: 2, target: 'opponent' } } }]),
  skill('card_13', '血に濡れた刃', 1, 'attack', 'slash', 'lust', 3, 2, 2, '的中時: 出血威力2。', [{ onHit: { status: { id: 'bleed', power: 2, target: 'opponent' } } }, { onHit: { status: { id: 'bleed', power: 2, target: 'opponent' } } }]),
  skill('card_14', '裂傷', 2, 'attack', 'pierce', 'wrath', 4, 2, 3, '的中時: 1枚目と2枚目は出血威力2、3枚目は出血回数2。', [
    { onHit: { status: { id: 'bleed', power: 2, target: 'opponent' } } },
    { onHit: { status: { id: 'bleed', power: 2, target: 'opponent' } } },
    { onHit: { status: { id: 'bleed', count: 2, target: 'opponent' } } }
  ]),
  skill('card_15', '血祭り', 2, 'attack', 'slash', 'wrath', 3, 2, 2, '1枚目: 的中時、出血回数2。出血威力3以上なら1枚ドロー。2枚目: 出血威力1。', [
    { onHit: { status: { id: 'bleed', count: 2, target: 'opponent' }, special: 'blood_festival' } },
    { onHit: { status: { id: 'bleed', power: 1, target: 'opponent' } } }
  ]),
  skill('card_16', '流血', 3, 'attack', 'pierce', 'lust', 4, 2, 2, '使用時: 相手の出血威力が3以上なら光2回復。', [
    { onHit: { status: { id: 'bleed', power: 3, target: 'opponent' } } },
    { onHit: { status: { id: 'bleed', power: 2, target: 'opponent' } } }
  ], { onUse: { special: 'bloodletting_light' } }),
  skill('card_17', '血の宴', 3, 'attack', 'slash', 'pride', 3, 2, 2, '的中時: 相手の出血威力が3以上なら、この幕のダメージ+5。', [
    { onHit: { status: { id: 'bleed', power: 2, target: 'opponent' }, special: 'blood_feast' } },
    { onHit: { status: { id: 'bleed', power: 2, target: 'opponent' } } }
  ]),
  skill('card_18', '昏がり', 0, 'evade', null, 'gloom', 3, 2, 1, '使用時: 光1回復。マッチ勝利時: 沈潜回数2。相手のHPが半分以下なら1枚引く。', [{}], { onUse: { light: 1 }, onClashWin: { status: { id: 'sinking', count: 2, target: 'opponent' }, special: 'dusk_draw_if_stagger_half' } }),
  skill('card_19', '水底へ', 1, 'attack', 'pierce', 'gloom', 3, 2, 1, '的中時: 沈潜威力2。', [{ onHit: { status: { id: 'sinking', power: 2, target: 'opponent' } } }]),
  skill('card_20', '濡れた手紙', 1, 'attack', 'pierce', 'gloom', 2, 2, 2, '的中時: 沈潜威力2。', [{ onHit: { status: { id: 'sinking', power: 2, target: 'opponent' } } }, { onHit: { status: { id: 'sinking', power: 2, target: 'opponent' } } }]),
  skill('card_21', '深く沈める', 2, 'attack', 'pierce', 'pride', 4, 2, 2, '的中時: 1枚目は沈潜威力3/回数2、2枚目は威力2/回数1。', [
    { onHit: { status: { id: 'sinking', power: 3, count: 2, target: 'opponent' } } },
    { onHit: { status: { id: 'sinking', power: 2, count: 1, target: 'opponent' } } }
  ]),
  skill('card_22', '憂鬱な雨', 2, 'evade', null, 'gloom', 5, 3, 1, 'マッチ勝利時: 相手の沈潜回数が3以上なら1消費。相手の沈潜威力4につき威力+1。', [{}], { sinkingPowerPer4: 1, onClashWin: { special: 'rain_consume_sinking_if_3' } }),
  skill('card_23', '沈む記憶', 2, 'attack', 'pierce', 'sloth', 4, 3, 2, '1枚目: 的中時、沈潜威力2。2枚目: 相手の沈潜威力4以上なら最大3回まで再使用。', [
    { onHit: { status: { id: 'sinking', power: 2, target: 'opponent' } } },
    { onHit: { special: 'sunken_memory_reuse' } }
  ]),
  skill('card_24', '沈潜', 3, 'attack', 'pierce', 'gloom', 5, 2, 2, '的中時: 沈潜威力4 / 3。', [
    { onHit: { status: { id: 'sinking', power: 4, target: 'opponent' } } },
    { onHit: { status: { id: 'sinking', power: 3, target: 'opponent' } } }
  ]),
  skill('card_25', '底なしの憂鬱', 3, 'attack', 'pierce', 'sloth', 5, 2, 3, '1枚目: 沈潜威力3/回数2。2枚目: 相手の沈潜威力5以上なら3枚ドロー。', [
    { onHit: { status: { id: 'sinking', power: 3, count: 2, target: 'opponent' } } },
    { onHit: { special: 'abyss_draw_if_5' } },
    {}
  ]),
  skill('card_26', '水面下', 2, 'attack', 'pierce', 'pride', 10, 5, 1, '的中時: 相手の沈潜回数を最大3消費し、解除した沈潜威力×回数だけこのコインの威力を増加。', [
    { onHit: { special: 'underwater_consume_sinking' } }
  ]),
  // ===== 剣契（Blade Lineage）=====
  // 元スキル（LCB）を [ ] に記載。呼吸は自分に付与（target 省略 = 自分）。
  // [Draw of the Sword] 剣契殺手ドンキホーテ/師範ムルソー S1
  // LoR版: コスト0・使用時光1回復・斬撃3～6。数値はLCB 剣契師範ムルソー S1（斬撃 3 +4 ×2）
  skill('card_27', '抜剣', 1, 'attack', 'slash', 'pride', 3, 4, 2, '使用時: 光1回復。呼吸威力2・呼吸回数1を得る。各コイン的中時: 呼吸威力1を得る。自分の呼吸威力5以上でコイン威力+1。', [
    { onHit: { status: { id: 'breath', power: 1 } } },
    { onHit: { status: { id: 'breath', power: 1 } } }
  ], { onUse: { light: 1, statuses: [{ id: 'breath', power: 2, count: 1 }] }, breathCoinBonus: { min: 5, bonus: 1 } }),
  // [Striker's Stance] 剣契殺手イサン S1
  skill('card_28', '撃勢', 1, 'attack', 'slash', 'pride', 3, 2, 3, '使用時: 呼吸威力2を得る。各コイン的中時: 呼吸威力1を得る。', [
    { onHit: { status: { id: 'breath', power: 1 } } },
    { onHit: { status: { id: 'breath', power: 1 } } },
    { onHit: { status: { id: 'breath', power: 1 } } }
  ], { onUse: { statuses: [{ id: 'breath', power: 2 }] } }),
  // [Heel Turn] 剣契殺手イサン S2
  skill('card_29', 'ひんねじる', 1, 'attack', 'slash', 'wrath', 5, 1, 2, 'マッチ勝利時: 呼吸威力2・呼吸回数1を得る。', [{}, {}], {
    onClashWin: { status: { id: 'breath', power: 2, count: 1 } }
  }),
  // [Flank Thrust] 剣契殺手イサン S3
  skill('card_30', '異面賛刺', 2, 'attack', 'slash', 'envy', 6, 3, 1, '表で的中時: 呼吸威力2を得る。クリティカル時ダメージ+70%。', [
    { onHit: { status: { id: 'breath', power: 2, requireHeads: true }, critDamageBonus: 0.7 } }
  ]),
  // [Acupuncture] 剣契師範ムルソー S2（斬撃 3 +5 ×3）
  skill('card_31', '刺法', 2, 'attack', 'slash', 'pride', 3, 5, 3, '使用時: 呼吸威力3を得る。マッチ勝利時: 斬撃威力増加1（この幕と次の幕）・光1回復。1枚目的中時: 呼吸威力3を得る。3枚目: クリティカル時ダメージ+60%。自分の呼吸威力7以上でコイン威力+1。', [
    { onHit: { status: { id: 'breath', power: 3 } } },
    {},
    { onHit: { critDamageBonus: 0.6 } }
  ], { onUse: { statuses: [{ id: 'breath', power: 3 }] }, onClashWin: { special: 'slash_power_up_2turns', light: 1 }, breathCoinBonus: { min: 7, bonus: 1 } }), // 光回復はLoR版のマッチ勝利効果
  // [Blade Arc] 剣契殺手ドンキホーテ S2
  skill('card_32', '剣軌', 1, 'attack', 'slash', 'envy', 4, 2, 2, '使用時: 呼吸威力2を得る。1枚目的中時: 呼吸威力2を得る。2枚目的中時: 呼吸回数2を得る。自分の呼吸威力7以上でコイン威力+1。', [
    { onHit: { status: { id: 'breath', power: 2 } } },
    { onHit: { status: { id: 'breath', count: 2 } } }
  ], { onUse: { statuses: [{ id: 'breath', power: 2 }] }, breathCoinBonus: { min: 7, bonus: 1 } }),
  // [Fare Thee Well!] 剣契殺手ドンキホーテ S3（味方への付与は自分に置き換え）
  skill('card_33', 'さらば！', 3, 'attack', 'slash', 'sloth', 4, 2, 3, '使用時: 呼吸威力5を得る。1・2枚目が表で的中するたび、最後のコインの与ダメージ+10%。3枚目: クリティカル時ダメージ+30%、的中時に呼吸回数2を得る。自分の呼吸威力10以上でコイン威力+1。', [
    { onHit: { finalCoinBonusOnHeads: 0.1 } },
    { onHit: { finalCoinBonusOnHeads: 0.1 } },
    { onHit: { status: { id: 'breath', count: 2 }, critDamageBonus: 0.3 } }
  ], { onUse: { statuses: [{ id: 'breath', power: 5 }] }, breathCoinBonus: { min: 10, bonus: 1 } }),
  // [Overthrow] 剣契師範ムルソー 防御スキル（反撃、斬撃 8 +10 ×1）
  skill('card_34', '殺主', 2, 'counter', 'slash', 'envy', 8, 10, 1, '使用時: 斬撃威力増加1（この幕と次の幕）。攻撃を受けたとき反撃。的中時: 呼吸威力2を得る。失ったHP1%につき与ダメージ+0.5%（最大25%）。', [
    { onHit: { status: { id: 'breath', power: 2 } } }
  ], { onUse: { special: 'slash_power_up_2turns' }, missingHpDamage: true }),
  // [Yield My Flesh] 剣契師範ムルソー S3（斬撃 20 -8 ×1。マイナスコイン。LoRから続く技。挑発値は省略）
  skill('card_35', '肉斬', 2, 'attack', 'slash', 'wrath', 20, -8, 1, 'このスキルが終わるまでダメージで混乱しない。マッチ勝利時: 呼吸威力5を得る。マッチ敗北時: 攻撃を受けた後「骨断」を使用。クリティカル時ダメージ+30%、さらに自分の呼吸威力1につき+3%（最大75%）。失ったHP1%につき与ダメージ+0.5%（最大25%）。', [{}], {
    onClashWin: { status: { id: 'breath', power: 5 } },
    onClashLoseFollowUp: 'card_36', scabbardSkill: 'yield',
    noStaggerDuringSkill: true, critDamageBonus: 0.3, critPerBreath: { per: 0.03, max: 0.75 }, missingHpDamage: true
  }),
  // [To Claim Their Bones] 剣契師範ムルソー 防御スキル2。「肉斬」のマッチ敗北時にのみ使用（デッキには入らない）。
  // 原作の「単一対象なら与ダメージ+100%」は1対1では常に発動し強すぎるため省略。
  skill('card_36', '骨断', 0, 'attack', 'slash', 'pride', 4, 4, 4, '「肉斬」のマッチ敗北時にのみ使用。このスキルが終わるまで混乱しない。クリティカル時ダメージ+30%、さらに自分の呼吸威力1につき+2%（最大50%）。失ったHP1%につき与ダメージ+0.5%（最大25%）。4枚目的中時: 出血3・次の幕に麻痺5を与える。', [
    {}, {}, {}, { onHit: { special: 'claim_bones_last' } }
  ], { hidden: true, scabbardSkill: 'claim', noStaggerDuringSkill: true, critDamageBonus: 0.3, critPerBreath: { per: 0.02, max: 0.5 }, missingHpDamage: true }),
  // [LoR: Slay] 斬撃3～8（マッチ勝利で力1）・斬撃3～6（的中で光1回復）。力（攻撃威力+）は攻撃威力増加1（この幕）に置き換え。
  skill('card_37', '処断', 2, 'attack', 'slash', 'wrath', 4, 2, 2, 'マッチ勝利時: 攻撃威力増加1を得る（この幕）。2枚目的中時: 光1回復。', [
    {},
    { onHit: { light: 1 } }
  ], { onClashWin: { status: { id: 'attack_power_up', count: 1 } } }),
  // ===== W社（WARP整理班）=====
  // [LCB 良秀 S1: エネルギー循環（E.C.）] ＋ LoR「エネルギー循環」（充電3回復、的中で光1回復）
  skill('card_38', 'エネルギー循環', 1, 'attack', 'slash', 'lust', 3, 2, 3, '使用時: 充電+3。1枚目的中時: 光1回復・充電+2。2枚目的中時: 充電+2。充電10以上で与ダメージ+10%、15以上でさらに+10%。', [
    { onHit: { light: 1, status: { id: 'charge', count: 2 } } },
    { onHit: { status: { id: 'charge', count: 2 } } },
    {}
  ], { onUse: { statuses: [{ id: 'charge', count: 3 }] }, chargeDamageTiers: [{ min: 10, bonus: 0.1 }, { min: 15, bonus: 0.1 }] }),
  // [LCB 良秀 S2: 跳躍（Leap）] ＋ LoR「跳躍」（充電3を消費して2枚ドロー）。敵撃破時の迅速は1対1では省略
  skill('card_39', '跳躍', 2, 'attack', 'slash', 'pride', 4, 2, 2, '使用時: 充電3を消費して2枚引く。攻撃開始時: 充電+7。充電10以上でコイン威力+1、15以上でさらに+1。1枚目的中時: 充電10以上なら斬撃脆弱2を与える。2枚目: 相手のHPが30%未満なら与ダメージ+30%。', [
    { onHit: { status: { id: 'slash_fragility', count: 2, target: 'opponent', requireCharge: 10 } } },
    { onHit: { lowHpDamageBonus: { below: 0.3, bonus: 0.3 } } }
  ], { onUse: { special: 'consume_charge_draw', chargeCost: 3, draw: 2 }, onExecute: { charge: 7 }, chargeCoinPowerTiers: [{ min: 10, bonus: 1 }, { min: 15, bonus: 1 }] }),
  // [LCB 良秀 S3: 次元空切（D.D.E.D.R.）]（敵撃破時の充電障壁は1対1では省略）
  skill('card_40', '次元空切', 3, 'attack', 'slash', 'envy', 3, 1, 4, '攻撃開始時: 充電15を消費してコイン威力+3。充電7～14なら全て消費し、不足1につき最大HPの3%を失って同じ効果。1～3枚目が表で的中するたび、最後のコインの与ダメージ+10%。', [
    { onHit: { finalCoinBonusOnHeads: 0.1 } },
    { onHit: { finalCoinBonusOnHeads: 0.1 } },
    { onHit: { finalCoinBonusOnHeads: 0.1 } },
    {}
  ], { chargeConsume: { amount: 15, coinPower: 3, partialMin: 7, partialHpPer: 0.03 } }),
  // [LCB 良秀 防御: 充電回避]
  skill('card_41', '充電回避', 1, 'evade', null, 'lust', 4, 3, 1, '充電5ごとに基礎威力+1（最大+3）。', [{}], { chargeBasePowerPer5: 3 }),
  // [LCB ドンキホーテ S1: 切断（Rip）]（破裂は不採用）
  skill('card_42', '切断', 1, 'attack', 'slash', 'sloth', 4, 3, 1, '表で的中時: 充電+4。充電5以上でコイン威力+2。', [
    { onHit: { status: { id: 'charge', count: 4, requireHeads: true } } }
  ], { chargeCoinPowerTiers: [{ min: 5, bonus: 2 }] }),
  // [LCB ドンキホーテ S2: 跳躍裂き（Leap）]
  skill('card_43', '跳躍裂き', 2, 'attack', 'pierce', 'gloom', 3, 2, 3, '1・2枚目的中時: 充電+3。3枚目が表で的中時: 脆弱2を与える。充電7以上でコイン威力+1。', [
    { onHit: { status: { id: 'charge', count: 3 } } },
    { onHit: { status: { id: 'charge', count: 3 } } },
    { onHit: { status: { id: 'fragile', count: 2, target: 'opponent', requireHeads: true } } }
  ], { chargeCoinPowerTiers: [{ min: 7, bonus: 1 }] }),
  // [LCB ドンキホーテ S3: 空間切断（Rip Space）]（破裂は脆弱に置き換え）
  skill('card_44', '空間切断', 3, 'attack', 'slash', 'envy', 2, 2, 5, '攻撃開始時: 充電10を消費してコイン威力+2。足りなければ最大HPの20%を失う。表で的中するたび脆弱1を与える。', [
    { onHit: { status: { id: 'fragile', count: 1, target: 'opponent', requireHeads: true } } },
    { onHit: { status: { id: 'fragile', count: 1, target: 'opponent', requireHeads: true } } },
    { onHit: { status: { id: 'fragile', count: 1, target: 'opponent', requireHeads: true } } },
    { onHit: { status: { id: 'fragile', count: 1, target: 'opponent', requireHeads: true } } },
    { onHit: { status: { id: 'fragile', count: 1, target: 'opponent', requireHeads: true } } }
  ], { chargeConsume: { amount: 10, coinPower: 2, lackHpLoss: 0.2 } }),
  // ----- LoR「WARP整理班」のページ（効果はLoR、ダイスはこのゲーム向けに設定）-----
  // [LoR: 過充電(3)] 強力なページ。充電を最大まで獲得するかわりに次の幕は行動不能
  skill('card_46', '過充電', 3, 'attack', 'slash', 'wrath', 6, 3, 2, '使用時: 充電を上限まで獲得する。次の幕、行動できない。', [{}, {}], { onUse: { special: 'overcharge' } }),
  // [LoR: 次元の狭間(2)] 充電を6回復
  skill('card_47', '次元の狭間', 2, 'attack', 'pierce', 'gluttony', 4, 2, 2, '使用時: 充電+6。', [{}, {}], { onUse: { statuses: [{ id: 'charge', count: 6 }] } }),
  // [LoR: 波動(3)] 強めのページ。充電を3消費し威力3増加
  skill('card_48', '波動', 3, 'attack', 'blunt', 'gloom', 5, 2, 2, '攻撃開始時: 充電3を消費し、このページの最終威力+3。', [{}, {}], { chargeConsume: { amount: 3, finalPower: 3 } }),
  // [LoR: 遡行(1)] 充電を4回復
  skill('card_49', '遡行', 1, 'evade', null, 'sloth', 4, 2, 1, '使用時: 充電+4。', [{}], { onUse: { statuses: [{ id: 'charge', count: 4 }] } }),
  // ===== 黒獣-卯（破裂）: LCB 黒獣-卯 ウーティスのスキル =====
  // [S1: 瞬歩（Blinkstep）] ＋ リソース回復（光）
  skill('card_50', '瞬歩', 1, 'attack', 'slash', 'gluttony', 4, 3, 2, '使用時: 光1回復。対象より速度が3以上速ければコイン威力+1。攻撃開始時、対象の破裂威力が4以上ならコイン威力+1。1枚目的中時: 破裂1を与える。2枚目的中時: 破裂1を与え、自分の速度が10以上ならこのコインを1回再使用。', [
    { onHit: { status: { id: 'rupture', power: 1, target: 'opponent' } } },
    { onHit: { status: { id: 'rupture', power: 1, target: 'opponent' }, reuseAtSpeed: 10 } }
  ], { onUse: { light: 1 }, speedFasterCoinPower: { diff: 3, bonus: 1 }, targetRuptureCoinPower: [{ min: 4, bonus: 1 }] }),
  // [S2: 刺殺（Perforating Kill）] ＋ リソース回復（光・ドロー）
  skill('card_51', '刺殺', 2, 'attack', 'pierce', 'gluttony', 4, 6, 2, '対象より速度が3以上速ければコイン威力+1。攻撃開始時、対象の破裂威力が4以上ならコイン威力+1。一方攻撃なら対象に破裂回数+1。1枚目的中時: 破裂回数+1を与え、次の幕に迅速1を得る（1幕2回まで）、光1回復。2枚目的中時: 破裂回数+1を与え、1枚引く。自分の速度が10以上なら2枚目の与ダメージ+30%。', [
    { onHit: { status: { id: 'rupture', count: 1, target: 'opponent' }, selfHasteNext: 1, light: 1 } },
    { onHit: { status: { id: 'rupture', count: 1, target: 'opponent' }, speedDamageBonus: { speed: 10, bonus: 0.3 }, draw: 1 } }
  ], { speedFasterCoinPower: { diff: 3, bonus: 1 }, targetRuptureCoinPower: [{ min: 4, bonus: 1 }], unopposedRuptureCount: 1 }),
  // [S3: 刻呪殺剣（Cursewrit Butcherblade）]
  skill('card_52', '刻呪殺剣', 3, 'attack', 'slash', 'gluttony', 5, 4, 3, '攻撃開始時: 脚力【卯】3を得る。対象より速ければ速度差2ごとにコイン威力+1（最大+2）、与ダメージ+(速度差×対象の破裂威力)%（最大50%）。対象の破裂威力が15以上ならコイン威力+1。一方攻撃なら対象に破裂回数+2。1枚目的中時: 破裂1・呪殺【迅速】を与える。2枚目的中時: 破裂1を与える。3枚目的中時: 破裂1を与え、自分の速度が10以上ならこのコインを1回再使用（再使用時は呪殺【迅速】も与える）。', [
    { onHit: { status: { id: 'rupture', power: 1, target: 'opponent' }, special: 'deathrite' } },
    { onHit: { status: { id: 'rupture', power: 1, target: 'opponent' } } },
    { onHit: { status: { id: 'rupture', power: 1, target: 'opponent' }, reuseAtSpeed: 10, special: 'deathrite_on_reuse' } }
  ], { onExecute: { strider: 3 }, speedDiffCoinPowerPer2: 2, speedRuptureDamage: { max: 0.5 }, targetRuptureCoinPower: [{ min: 15, bonus: 1 }], unopposedRuptureCount: 2 }),
  // [防御: 部分黒獣化（Partial Heishou Mutation）] マッチ可能反撃
  // コイン方式のマッチ可能反撃（legacyDice の useCoins: true で、ダイスではなくコイン判定を使う）
  skill('card_53', '部分黒獣化', 1, 'counter_clash', 'slash', 'gluttony', 5, 7, 1, '使用時: 脚力【卯】3を得る。マッチ可能反撃として待機し、攻撃してきた相手とマッチする。対象より速ければ速度差2ごとに威力+1（最大+2）。的中時: 破裂回数+1を与える。', [{}], {
    legacyDice: [{ type: 'counter_clash', attackType: 'slash', useCoins: true, speedBonusPer2Max: 2 }],
    onUse: { statuses: [{ id: 'strider_mao', count: 3 }] },
    onHit: { status: { id: 'rupture', count: 1, target: 'opponent' } }
  })
];

const EGO_DATABASE = [
  {
    id: 'ego_crows_eye_view', name: '烏瞰図', sinner: 'Yi Sang', risk: 'ZAYIN',
    sin: 'sloth', sinRes: { wrath:1, lust:1, sloth:0.75, gluttony:1, gloom:2, pride:1, envy:2 }, attackType: 'pierce', skillType: 'attack', cost: 0,
    basePower: 18, coinPower: 6, coinCount: 1, sanityCost: 10,
    resourceCost: { wrath: 1, sloth: 3 },
    effect: 'E.G.O: 精神-10。的中時、相手に攻撃威力減少2。次の幕、自分に迅速3、相手に束縛2を付与。',
    coins: [{ onHit: { special: 'ego_crows_eye' } }],
    // 原作パッシブ「Silence」（wiki: Crow's Eye View Yi Sang）。処理: effects.js applyEgoPassiveDamageBonus / onEgoPassiveHit
    egoPassiveId: 'ego_crows_eye_view_passive',
    egoPassiveDesc: '沈黙: 被弾時、次の幕に束縛3を得る（1幕に1回）。相手の弱点（攻撃タイプまたは罪悪属性の耐性が×1を超える）で攻撃したとき与ダメージ+20%。'
  },
  {
    id: 'ego_chains_of_others', name: '他人の鎖', sinner: 'Meursault', risk: 'ZAYIN',
    sin: 'pride', sinRes: { wrath:1, lust:2, sloth:1, gluttony:2, gloom:2, pride:0.75, envy:1 }, attackType: 'blunt', skillType: 'attack', cost: 0,
    basePower: 19, coinPower: 3, coinCount: 1, sanityCost: 10,
    resourceCost: { sloth: 1, gloom: 1, envy: 2 },
    effect: 'E.G.O: 精神-10。的中時、相手に次の幕の束縛5・攻撃威力減少4、自分に次の幕の束縛3・攻撃威力減少3・保護2。',
    coins: [{ onHit: { special: 'ego_chains_others' } }],
    // 原作パッシブ「Refusal to Judge」（wiki: Chains of Others Meursault）は「3つ以上のスキルに指定されたら保護3」。
    // 1対1では相手の速度ダイスが最大2つのため「2つ以上」に置き換え。処理: effects.js processEgoPassivesCombatStart
    egoPassiveId: 'ego_chains_of_others_passive',
    egoPassiveDesc: '判断拒否: 戦闘開始時、相手のスキル2つ以上に指定されていれば保護3を得る（原作は3つ以上）。'
  },
  {
    id: 'ego_don_scissors', name: '私はチョキを出すね、そっちは？', sinner: 'Don Quixote', risk: 'ZAYIN',
    sin: 'envy', sinRes: { wrath:1, lust:1, sloth:2, gluttony:1, gloom:2, pride:1, envy:0.75 },
    attackType: 'slash', skillType: 'attack', cost: 0, basePower: 12, coinPower: 12, coinCount: 1, sanityCost: 20,
    resourceCost: { envy: 5 },
    effect: '嫉妬5。マッチ勝利後: 自分のHPを回復し、精神力5回復。マッチ敗北: バリアを得て、この攻撃のダメージを大幅強化。',
    coins: [{ unbreakable: true, onHit: { status: { id: 'power_down', count: 1, target: 'opponent' }, special: 'ego_don_scissors_hit' } }],
    egoPassiveId: 'ego_don_scissors_passive',
    egoPassiveDesc: '嫉妬スキルの与ダメージ+10%（嫉妬共鳴発生時はさらに+5%）。累積被ダメージ20ごとに攻撃レベル+1（最大3）。',
    corrosionSanityCost: 20,
    corrosion: {
      basePower: 4, coinPower: 4, coinCount: 3, attackType: 'slash', skillType: 'attack', indiscriminate: true,
      resourceCost: { envy: 5 },
      effect: '侵蝕: 敵味方識別不可。ランダム対象。共鳴発生時に最終威力+1。マッチ勝利で与ダメージ+100%、敗北でバリア。',
      coins: [
        { unbreakable: true, onHit: { status: { id: 'power_down', count: 1, target: 'opponent' } } },
        { unbreakable: true, onHit: { status: { id: 'power_down', count: 1, target: 'opponent' } } },
        { unbreakable: true, onHit: { status: { id: 'power_down', count: 1, target: 'opponent' }, special: 'ego_don_scissors_corrosion_hit' } }
      ]
    }
  },
  // 過ぎし日（Bygone Days）: 原作 limbuscompany.wiki.gg/wiki/Bygone_Days_Ishmael（Tier IV）。
  // 1対1向けの簡略化:
  //   - 「4以上の共鳴」「3以上の憂鬱共鳴」→ 速度ダイスが最大2つのため「憂鬱の共鳴が発生（2以上）」に置き換え
  //   - 覚醒の「HPの低い味方2人を回復」→ 使用者本人を回復
  //   - 侵蝕の「他の味方3人を回復」→ 他の味方がいないため省略（HP10%消費のみ）
  //   - 攻撃の重さ（Atk Weight）はこのゲームに無いため省略
  //   - 招聘されざる者の「死亡時に他の味方へ伝播」は、1対1では死亡=決着のため省略
  // 処理: effects.js（ego_bygone_days_* の special、applyEgoBeforeAttack / applyEgoAttackEnd）
  {
    id: 'ego_bygone_days', name: '過ぎし日', sinner: 'Ishmael', risk: 'TETH',
    sin: 'gloom', sinRes: { wrath:1, lust:1, sloth:1, gluttony:2, gloom:0.5, pride:1, envy:2 },
    attackType: 'slash', skillType: 'attack', cost: 0, basePower: 17, coinPower: 9, coinCount: 1, sanityCost: 20,
    resourceCost: { lust: 2, sloth: 1, gloom: 3 },
    effect: '的中時: 沈潜威力3・呪い2・招聘されざる者2を付与。憂鬱共鳴時、憂鬱脆弱1も付与。攻撃終了時: 自分のHPを最大HPの10%＋相手の沈潜(威力+回数)の1/3回復（最大20%）。憂鬱共鳴時さらに10%回復。',
    coins: [{ onHit: { special: 'ego_bygone_days_hit' } }],
    attackEnd: 'ego_bygone_days',
    egoPassiveId: 'ego_bygone_days_passive',
    egoPassiveDesc: '招かざる客の出迎え: 招聘されざる者を持つ相手に的中したとき、自分の精神力を5回復（1幕に1回）。',
    corrosionSanityCost: 20,
    corrosion: {
      basePower: 28, coinPower: -10, coinCount: 1, attackType: 'slash', skillType: 'attack', indiscriminate: true,
      resourceCost: { lust: 2, sloth: 1, gloom: 3 },
      effect: '侵蝕: 敵味方識別不可。攻撃前に最大HPの10%を失う（この減少では混乱しない）。的中時: 沈潜回数2・呪い1・招聘されざる者2・邸宅の木霊2を付与。憂鬱共鳴時、憂鬱脆弱1も付与。（原作の味方回復は1対1では省略）',
      coins: [{ onHit: { special: 'ego_bygone_days_corrosion_hit' } }],
      beforeAttack: 'ego_bygone_days_corrosion'
    }
  },
  // 着影揮刀（Shadow-vested Bladesinger）: 原作 HE / 傲慢。処理: js/blade_lineage.js
  // 精神力の消費量・罪悪耐性は資料で確認できなかったため仮の値（精神-20、傲慢×0.75、ほかは×1）。
  {
    id: 'ego_bladesinger', name: '着影揮刀', sinner: 'Meursault', risk: 'HE',
    sin: 'pride', sinRes: { wrath:1, lust:1, sloth:1, gluttony:1, gloom:1, pride:0.75, envy:1 },
    attackType: 'slash', skillType: 'attack', cost: 0, basePower: 12, coinPower: 4, coinCount: 2, sanityCost: 20,
    resourceCost: { pride: 4, wrath: 1, envy: 1 },
    firstUseCost: { coreId: 'core_8', cost: { pride: 3 } },
    effect: '攻撃前: 自分の呼吸威力4ごとにマッチ威力+1・与ダメージ+10%（最大5）。追慕酒があれば与ダメージ+100%（キムサッガのページなら+200%）。1枚目的中時: 出血4を与え、呼吸回数4を得る。2枚目的中時: 出血回数2を与え、呼吸回数4を得る。攻撃終了時: 追慕酒4を得る。キムサッガのページでの初回使用は資源が傲慢3のみ。',
    coins: [
      { onHit: { statuses: [{ id: 'bleed', power: 4, target: 'opponent' }, { id: 'breath', count: 4 }] } },
      { onHit: { statuses: [{ id: 'bleed', count: 2, target: 'opponent' }, { id: 'breath', count: 4 }] } }
    ],
    bladesinger: 'awakening',
    attackEnd: 'ego_bladesinger',
    egoPassiveId: 'ego_bladesinger_passive',
    egoPassiveAlwaysFor: 'core_8',
    egoPassiveDesc: '剣先にしたたる酒滴: 幕開始時に追慕酒があれば怨恨を得る（その幕 速度+2、与えたダメージの10%回復）。キムサッガのページなら追加で恨の宿った鞘を得る。キムサッガのページなら装備しているだけで常に有効（それ以外は使用した次の幕から）。',
    corrosionSanityCost: 20,
    corrosion: {
      basePower: 13, coinPower: -2, coinCount: 4, attackType: 'slash', skillType: 'attack', indiscriminate: true,
      resourceCost: { pride: 4, wrath: 1, envy: 1 },
      effect: '侵蝕: 敵味方識別不可。攻撃前: 呼吸威力4ごとにマッチ威力+1・与ダメージ+10%（最大5）、敵味方全員が呼吸回数4・斬撃ダメージ増加1・斬撃脆弱1を得る。破壊不能コイン。1～3枚目的中時: 出血1。4枚目的中時: 出血回数2。',
      coins: [
        { unbreakable: true, onHit: { status: { id: 'bleed', power: 1, target: 'opponent' } } },
        { unbreakable: true, onHit: { status: { id: 'bleed', power: 1, target: 'opponent' } } },
        { unbreakable: true, onHit: { status: { id: 'bleed', power: 1, target: 'opponent' } } },
        { unbreakable: true, onHit: { status: { id: 'bleed', count: 2, target: 'opponent' } } }
      ],
      bladesinger: 'corrosion'
    }
  }
];

function getSinLabel(sin) { return SIN_LABELS[sin] || sin || '未設定'; }
