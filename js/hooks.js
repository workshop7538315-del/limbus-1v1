// hooks.js — パッシブ拡張用フック基盤 (emitHook)

// ============================================================
// 拡張フック基盤 (原作再現要素を今後追加するための土台)
// ------------------------------------------------------------
// 既存の戦闘処理は一切変更せず、各処理の要所で emitHook() を
// 呼び出すことで、コアページ／カード側にパッシブを「データとして」
// 追加できるようにするためのものです。何もパッシブが定義されて
// いない場合は完全に何もしない（既存挙動に影響しない）関数です。
//
// 【使い方（今後の追加例）】
// コアページに passives 配列を追加すると、対応するイベント発生時に
// effect(player, ctx) が呼び出されます。（player: 'p1' or 'p2'）
//   passives: [
//     { trigger: 'onMatchWin', effect: (p, ctx) => { ... パワー+1 など ... } },
//     { trigger: 'onTurnStart', effect: (p, ctx) => { ... 光を1回復 など ... } }
//   ]
// カード側にも同様に passives 配列を追加すれば、
// そのカードが関わるイベント(ctx.card === そのカード)発生時に発動します。
// （将来的にE.G.O専用パッシブなどへの利用を想定）
//
// 状態異常は player.statuses に自由に追加していく想定です。
// 現時点では statuses は空オブジェクトのまま、何も読み書きしていません。
//
// 【現在発火しているイベント一覧】
//   onTurnStart  : 幕開始時                      (startNewRound)
//   onCardUse    : カードをスロットにセットした時   (playCardToSlot)
//   onClashStart : マッチ開始時         (resolveClash)
//   onClashRoll  : マッチ中の各コイン判定時        (resolveClash)
//   onDamage     : 実ダメージが確定した時           (applyDamage)
//   onHit        : 攻撃コインが的中した時           (triggerOnHit)
//   onTurnEnd    : 幕の全スロット解決が終わった時     (executeFullTurn)
//   onMatchWin   : 試合に勝利した時                 (checkGameEnd)
//   onMatchLose  : 試合に敗北した時                 (checkGameEnd)
//
// 既存の core.onTurnStart（コアページの直接関数によるパッシブ）は
// そのまま動作し、このフック基盤とは独立して併存します。
// ============================================================
function emitHook(hookName, ctx) {
  ctx = ctx || {};
  let targets = [];
  if (ctx.playerA || ctx.playerB) {
    targets = [ctx.playerA, ctx.playerB].filter(Boolean);
  } else if (ctx.player) {
    targets = [ctx.player];
  } else if (ctx.winner) {
    targets = [ctx.winner];
  } else if (ctx.attacker) {
    targets = [ctx.attacker];
  }

  targets.forEach(p => {
    const state = gameState[p];
    if (!state || !state.core || !state.core.passives) return;
    state.core.passives.forEach(passive => {
      if (passive.trigger === hookName) passive.effect(p, ctx);
    });
  });
  if (ctx.card && ctx.card.passives) {
    ctx.card.passives.forEach(passive => {
      if (passive.trigger === hookName) {
        passive.effect(ctx.player || ctx.winner || ctx.attacker, ctx);
      }
    });
  }
}
