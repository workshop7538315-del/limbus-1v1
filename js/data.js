// data.js — コアページ・バトルページ（Skill）・表示ヘルパー


// 罪悪属性は現段階ではスキル情報としてのみ使用。罪悪耐性・資源・共鳴は未実装。
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

function getResText(val) {
  if (val <= 0.5) return { text: '耐性', class: 'res-05' };
  if (val <= 1.0) return { text: '普通', class: 'res-10' };
  return { text: '弱点', class: 'res-15' };
}

const CORE_PAGES = [
  {
    id: 'core_1', name: '見習い司書のページ',
    hp: 80, stagger: 40, maxLight: 4, speedDiceCount: 2, speedMin: 2, speedMax: 6,
    res: { slash: 1.0, pierce: 1.0, blunt: 1.0 },
    passiveName: '二刀流 & 予備光線',
    passiveDesc: '速度ダイス数:2。光の最大値が1増加する(最大4)。'
  },
  {
    id: 'core_2', name: '裏路地の暗殺者のページ',
    hp: 70, stagger: 35, maxLight: 3, speedDiceCount: 2, speedMin: 3, speedMax: 7,
    res: { slash: 0.5, pierce: 1.0, blunt: 1.5 },
    passiveName: '疾風 & 鋭い刃',
    passiveDesc: '速度ダイス数:2。全ての斬撃コインの威力+1。',
    slashBonus: 1
  },
  {
    id: 'core_3', name: '盾持ち兵士のページ',
    hp: 100, stagger: 50, maxLight: 3, speedDiceCount: 1, speedMin: 1, speedMax: 3,
    res: { slash: 1.0, pierce: 0.5, blunt: 0.5 },
    passiveName: '重装 & 態勢再整頓',
    passiveDesc: '速度ダイス数:1。幕の開始時、混乱耐性を3回復する。',
    onTurnStart: (p) => {
      if (!gameState[p].isStaggered) {
        gameState[p].stagger = Math.min(gameState[p].maxStagger, gameState[p].stagger + 3);
        log(`[パッシブ] ${playerLabel(p)}の混乱耐性が3回復！`);
      }
    }
  },
  {
    id: 'core_4', name: '黒雲会の組員のページ',
    hp: 75, stagger: 38, maxLight: 3, speedDiceCount: 2, speedMin: 2, speedMax: 6,
    res: { slash: 1.0, pierce: 1.0, blunt: 1.5 },
    passiveName: '血の掟',
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
    hp: 999, stagger: 999, maxLight: 3, speedDiceCount: 1, speedMin: 1, speedMax: 3,
    res: { slash: 0.0, pierce: 0.0, blunt: 0.0 },
    passiveName: 'サンドバッグ',
    passiveDesc: '自身のすべてのコインの威力が常に0になる。',
    powerAlwaysZero: true
  },
  {
    id: 'core_6', name: '雨天事務所フィクサーのページ',
    hp: 75, stagger: 40, maxLight: 3, speedDiceCount: 2, speedMin: 3, speedMax: 7,
    res: { slash: 1.0, pierce: 1.0, blunt: 1.5 },
    passiveName: '沈む思考',
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
    if (onHit?.special === 'blood_festival' || onHit?.special === 'blood_feast') tags.add('bleed');
    if (onHit?.special === 'sunken_memory_reuse' || onHit?.special === 'abyss_draw_if_5' || onHit?.special === 'underwater_consume_sinking') tags.add('sinking');
  });
  if (effect?.includes('光')) tags.add('light');
  if (effect?.includes('ドロー') || effect?.includes('引く')) tags.add('draw');
  if (extra?.onUse?.status?.id) tags.add(extra.onUse.status.id);
  if (extra?.onUse?.special === 'bloodletting_light') tags.add('bleed');
  if (extra?.onClashWin?.status?.id) tags.add(extra.onClashWin.status.id);
  if (extra?.onClashWin?.special === 'rain_consume_sinking_if_3' || extra?.sinkingPowerPer4) tags.add('sinking');
  if (extra?.counterDice?.length) tags.add('counter');
  if (extra?.legacyDice?.some(d => d.type === 'counter_clash')) tags.add('counter_clash');

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
  skill('card_4', '身のこなしかわし', 0, 'evade', null, 'envy', 4, 2, 2, '回避成功時、混乱耐性を回復する。', [{}, {}]),
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
  skill('card_18', '昏がり', 0, 'evade', null, 'gloom', 3, 2, 1, '使用時: 光1回復。マッチ勝利時: 沈潜回数2。相手の混乱耐性が半分以下なら1枚引く。', [{}], { onUse: { light: 1 }, onClashWin: { status: { id: 'sinking', count: 2, target: 'opponent' }, special: 'dusk_draw_if_stagger_half' } }),
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
  ])
];

const EGO_DATABASE = [
  {
    id: 'ego_crows_eye_view', name: "Crow's Eye View", sinner: 'Yi Sang', risk: 'ZAYIN',
    sin: 'sloth', sinRes: { wrath:1, lust:1, sloth:0.75, gluttony:1, gloom:2, pride:1, envy:2 }, attackType: 'pierce', skillType: 'attack', cost: 0,
    basePower: 18, coinPower: 6, coinCount: 1, sanityCost: 10,
    resourceCost: { wrath: 1, sloth: 3 },
    effect: 'E.G.O: 精神-10。的中時、相手に攻撃威力減少2、この幕の迅速3を全味方、次の幕の束縛2を相手に付与。',
    coins: [{ onHit: { special: 'ego_crows_eye' } }]
  },
  {
    id: 'ego_chains_of_others', name: 'Chains of Others', sinner: 'Meursault', risk: 'ZAYIN',
    sin: 'pride', sinRes: { wrath:1, lust:2, sloth:1, gluttony:2, gloom:2, pride:0.75, envy:1 }, attackType: 'blunt', skillType: 'attack', cost: 0,
    basePower: 19, coinPower: 3, coinCount: 1, sanityCost: 10,
    resourceCost: { sloth: 1, gloom: 1, envy: 2 },
    effect: 'E.G.O: 精神-10。的中時、相手に次の幕の束縛5・攻撃威力減少4、自分に次の幕の束縛3・攻撃威力減少3・保護2。',
    coins: [{ onHit: { special: 'ego_chains_others' } }]
  }
];

function getSinLabel(sin) { return SIN_LABELS[sin] || sin || '未設定'; }
