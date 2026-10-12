// panic.js — 士気低下・パニックの処理
//
// 混乱（isStaggered: HP閾値）とは別の状態。isStaggered をパニックの代わりに使わないこと。
// パニックタイプごとの効果の数値・説明は data.js の PANIC_TYPE_DEFS にある。
//
// 状態（gameState[p]）:
//   panicState        null / 'low_morale' / 'panic'
//   panicTurns        パニックが続いている幕数（1から）
//   panicNoAction     この幕は行動しない（速度ダイスを作らない）
//   panicIndiscriminate この幕は敵味方識別不可
//   lowMoraleTriggered 一度でも士気低下したか（「最初の士気低下時」の判定用）
//   panicTypeOverride パニックタイプの一時変更（null なら core.panicType）
//
// 処理の流れ:
//   幕開始 startNewRound → processPanicTurnStart（速度ダイス生成より前）
//   幕終了 executeFullTurn → processPanicTurnEnd
//
// 原作との違い（簡略化）:
//   - 士気低下は原作では「確率で発生」だが確率が未確認のため、-30以下なら毎幕発生とした。
//   - 精神力-45でも侵蝕スキルを持つE.G.Oを装備していれば、原作どおりパニックではなく侵蝕になる
//     （既存の applyEgoCorrosionAtTurnStart が担当）。
//   - 1幕で終わるパニックは、原作の囚人と同様に幕終了時に精神力を0へ戻す。

const LOW_MORALE_SANITY = -30;
const PANIC_SANITY = -45;

function resetPanicState(player) {
  const p = gameState[player];
  p.panicState = null; p.panicTurns = 0;
  p.panicNoAction = false; p.panicIndiscriminate = false;
  p.lowMoraleTriggered = false; p.panicTypeOverride = null;
}

function getPanicType(player) {
  const p = gameState[player];
  return p?.panicTypeOverride || p?.core?.panicType || 'パニック';
}
function getPanicTypeDef(player) {
  return PANIC_TYPE_DEFS[getPanicType(player)] || PANIC_TYPE_DEFS['パニック'];
}
// 「過ぎし日」の邸宅の木霊などで、パニックタイプを一時的に変更するための入口。
// type に null を渡すと元に戻る。
function setPanicTypeOverride(player, type, reason = '') {
  const p = gameState[player];
  if (!p) return;
  const before = getPanicType(player);
  p.panicTypeOverride = type && PANIC_TYPE_DEFS[type] ? type : null;
  const after = getPanicType(player);
  if (before !== after) log(`[パニックタイプ] ${playerLabel(player)}: ${before}→${after}${reason ? `（${reason}）` : ''}`);
}
function hasCorrosionEgo(player) {
  return !!gameState[player].equippedEgos?.some(e => e.corrosion);
}
function applyPanicStatuses(player, statuses, label) {
  (statuses || []).forEach(s => {
    const r = addCombatStatus(player, s.id, s.amount, 1);
    if (r) log(`[${label}] ${playerLabel(player)}が「${r.status.name}」${s.amount}を得る。`);
  });
}

// 幕開始時の判定。true を返したら、その幕は試合終了（逃走・死亡）。
function processPanicTurnStart(player) {
  const p = gameState[player];
  const typeName = getPanicType(player);
  const def = getPanicTypeDef(player);
  p.panicNoAction = false;
  p.panicIndiscriminate = false;

  // 複数幕続くパニック（徘徊・自殺）の継続
  if (p.panicState === 'panic') {
    p.panicTurns = (p.panicTurns || 1) + 1;
    if (def.panic.duration && p.panicTurns > def.panic.duration) {
      const reason = def.panic.onExpire === 'death' ? '死亡' : '逃走';
      log(`💀 [パニック:${typeName}] ${playerLabel(player)}は${reason}しました。（敗北）`);
      p.hp = 0;
      return true;
    }
  } else if (p.sanity <= PANIC_SANITY) {
    if (hasCorrosionEgo(player)) return false; // 侵蝕が優先（applyEgoCorrosionAtTurnStart）
    p.panicState = 'panic';
    p.panicTurns = 1;
    log(`😱 [パニック] ${playerLabel(player)}がパニック状態になりました！（${typeName}）`);
  } else if (p.sanity <= LOW_MORALE_SANITY) {
    p.panicState = 'low_morale';
    const lm = def.lowMorale;
    const first = !p.lowMoraleTriggered;
    p.lowMoraleTriggered = true;
    log(`[士気低下] ${playerLabel(player)}の士気が低下しています（${typeName}）。`);
    applyPanicStatuses(player, lm.statuses, '士気低下');
    if (lm.noActionFirst && first) { p.panicNoAction = true; log(`[士気低下] ${playerLabel(player)}はこの幕、行動しません。`); }
    if (lm.indiscriminateFirst && first) { p.panicIndiscriminate = true; log(`[士気低下] ${playerLabel(player)}はこの幕、敵味方識別不可。`); }
    return false;
  } else {
    p.panicState = null;
    return false;
  }

  // パニック中の効果（毎幕）
  const pd = def.panic;
  applyPanicStatuses(player, pd.statuses, 'パニック');
  if (pd.noAction) { p.panicNoAction = true; log(`[パニック] ${playerLabel(player)}はこの幕、行動しません。`); }
  if (pd.indiscriminate) p.panicIndiscriminate = true;
  for (let i = 0; i < (pd.discardRandom || 0) && p.hand.length; i++) {
    const card = p.hand.splice(Math.floor(Math.random() * p.hand.length), 1)[0];
    p.discard.push(card);
    log(`[パニック] ${playerLabel(player)}は手札の「${card.name}」を失いました。`);
  }
  if (pd.duration) log(`[パニック] ${playerLabel(player)}: ${p.panicTurns}/${pd.duration}幕目`);
  return false;
}

function processPanicTurnEnd(player) {
  const p = gameState[player];
  if (p.panicState !== 'panic') return;
  const def = getPanicTypeDef(player);
  if (def.panic.duration) return; // 複数幕パニックは精神力-45のまま継続
  p.panicState = null; p.panicTurns = 0;
  p.sanity = 0;
  log(`[パニック終了] ${playerLabel(player)}の精神力が0に戻りました。`);
}

function isPanicIndiscriminate(player) { return !!gameState[player]?.panicIndiscriminate; }

// 表のコインで的中した場合の与ダメージ補正（+10%×値）。士気低下中のみ。
function getPanicHeadsDamageBonus(player) {
  const p = gameState[player];
  if (!p || p.panicState !== 'low_morale') return 0;
  return getPanicTypeDef(player).lowMorale.headsDamageBonus || 0;
}

// 敵味方識別不可: 自分以外の全速度ダイス（自分の他のダイスを含む）からランダムに対象を選ぶ。
function getIndiscriminateTarget(player, ownSlot) {
  const pool = [...gameState.p1.slots, ...gameState.p2.slots].filter(s => s && s !== ownSlot && !gameState[s.owner].isStaggered);
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
}

function getPanicStatusText(player) {
  const p = gameState[player];
  const type = getPanicType(player);
  const def = getPanicTypeDef(player);
  let state = '通常';
  if (p.panicState === 'low_morale') state = '士気低下';
  if (p.panicState === 'panic') state = def.panic.duration ? `パニック ${p.panicTurns}/${def.panic.duration}幕` : 'パニック';
  return { type, state, desc: getPanicTypeEffect(type), overridden: !!p.panicTypeOverride };
}
