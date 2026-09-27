// effects.js — 状態効果・スキル効果解決

const STATUS_DEFINITIONS = {
  breath: { name: '呼吸', category: 'buff', maxPower: 99, maxCount: 99, defaultPower: 0, defaultCount: 0 },
  bleed: { name: '出血', category: 'debuff', maxPower: 99, maxCount: 99, defaultPower: 0, defaultCount: 0 },
  sinking: { name: '沈潜', category: 'debuff', maxPower: 99, maxCount: 99, defaultPower: 0, defaultCount: 0 },
  blood_feast: { name: '血宴強化', category: 'buff', maxPower: 99, maxCount: 1, defaultPower: 5, defaultCount: 0 }
};

function getStatus(player, statusId) {
  if (!gameState[player].statuses) gameState[player].statuses = {};
  return gameState[player].statuses[statusId] || null;
}
function ensureStatus(player, statusId) {
  if (!gameState[player].statuses) gameState[player].statuses = {};
  const def = STATUS_DEFINITIONS[statusId];
  if (!def) return null;
  if (!gameState[player].statuses[statusId]) {
    gameState[player].statuses[statusId] = { id: statusId, name: def.name, category: def.category, power: def.defaultPower, count: def.defaultCount };
  }
  return gameState[player].statuses[statusId];
}
function clampStatusValue(value, max) { return Math.max(0, Math.min(max, value)); }
function normalizeStatus(statusId, status) {
  const def = STATUS_DEFINITIONS[statusId];
  if (!def || !status) return;
  status.power = clampStatusValue(status.power, def.maxPower);
  status.count = clampStatusValue(status.count, def.maxCount);
  if (statusId === 'breath') {
    if (status.count > 0) status.power = Math.max(1, status.power);
    else status.power = 0;
  }
}
function changeStatusCount(player, statusId, delta) {
  const status = ensureStatus(player, statusId);
  if (!status) return null;
  const before = status.count;
  status.count = clampStatusValue(status.count + delta, STATUS_DEFINITIONS[statusId].maxCount);
  normalizeStatus(statusId, status);
  return { status, before, after: status.count };
}
function changeStatusPower(player, statusId, delta) {
  const status = ensureStatus(player, statusId);
  if (!status) return null;
  const before = status.power;
  status.power = clampStatusValue(status.power + delta, STATUS_DEFINITIONS[statusId].maxPower);
  normalizeStatus(statusId, status);
  return { status, before, after: status.power };
}
function expireStatusIfEmpty(player, statusId) {
  const status = getStatus(player, statusId);
  if (!status) return;
  normalizeStatus(statusId, status);
  if (status.count <= 0 && status.power <= 0) delete gameState[player].statuses[statusId];
}
function processStatusTurnEnd(player) {
  const statuses = gameState[player].statuses || {};
  Object.keys(statuses).forEach(statusId => {
    const status = statuses[statusId];
    if (!status) return;
    if (statusId === 'breath' && status.count > 0) {
      status.count = Math.max(0, status.count - 1);
      normalizeStatus(statusId, status);
      if (status.count <= 0) delete statuses[statusId];
      else log(`[状態減衰] ${playerLabel(player)}の「${status.name}」: 回数 ${status.count}`);
    } else if (statusId === 'blood_feast' && status.count > 0) {
      delete statuses[statusId];
      log(`[状態減衰] ${playerLabel(player)}の「${status.name}」が終了`);
    }
  });
}
function consumeStatusCount(player, statusId) {
  const status = getStatus(player, statusId);
  if (!status || status.count <= 0) return false;
  status.count = Math.max(0, status.count - 1);
  normalizeStatus(statusId, status);
  if (status.count <= 0 && statusId !== 'breath') delete gameState[player].statuses[statusId];
  return true;
}

function changeSanity(player, delta, reason = '') {
  const p = gameState[player];
  const before = p.sanity;
  p.sanity = Math.max(p.minSanity, Math.min(p.maxSanity, p.sanity + delta));
  if (p.sanity !== before) {
    const sign = delta >= 0 ? '+' : '';
    log(`[精神] ${playerLabel(player)} ${before}→${p.sanity} (${sign}${delta}${reason ? `: ${reason}` : ''})`);
  }
  return { before, after: p.sanity };
}

function getHeadsChance(player) {
  const sanity = gameState[player].sanity || 0;
  return Math.max(5, Math.min(95, 50 + sanity));
}

function triggerBleedOnAttackRoll(player) {
  const status = getStatus(player, 'bleed');
  if (!status || status.count <= 0 || status.power <= 0) return false;
  const damage = status.power;
  status.count = Math.max(0, status.count - 1);
  normalizeStatus('bleed', status);
  const p = gameState[player];
  const beforeHp = p.hp;
  p.hp = Math.max(0, p.hp - damage);
  log(`[状態ダメージ] ${playerLabel(player)}の「出血」: HP ${beforeHp}→${p.hp}（-${damage}） / 残り回数: ${status.count}`);
  emitHook('onDamage', { target: player, diceType: 'bleed', amount: damage, attacker: null });
  if (status.count <= 0) delete gameState[player].statuses.bleed;
  return true;
}

function markSinkingTarget(sourcePlayer, targetPlayer) {
  if (!gameState[sourcePlayer]) return;
  if (!gameState[sourcePlayer].sinkingMarkedTargets) gameState[sourcePlayer].sinkingMarkedTargets = {};
  gameState[sourcePlayer].sinkingMarkedTargets[targetPlayer] = true;
}

function triggerSinkingOnAttackReceived(target) {
  const status = getStatus(target, 'sinking');
  if (!status || status.count <= 0 || status.power <= 0) return false;
  const amount = status.power;
  changeSanity(target, -amount, '沈潜');
  status.count = Math.max(0, status.count - 1);
  normalizeStatus('sinking', status);
  log(`[状態効果] ${playerLabel(target)}の「沈潜」発動: 精神 ${gameState[target].sanity + amount}→${gameState[target].sanity}（-${amount}） / 残り回数: ${status.count}`);
  if (status.count <= 0) {
    delete gameState[target].statuses.sinking;
    log(`[状態解除] ${playerLabel(target)}の「沈潜」が解除されました`);
  }
  return true;
}

function consumeSinkingCount(target, count) {
  const status = getStatus(target, 'sinking');
  if (!status || status.count <= 0 || count <= 0) return { consumed: 0, power: 0 };
  const consumed = Math.min(count, status.count);
  const total = status.power * consumed;
  status.count -= consumed;
  normalizeStatus('sinking', status);
  if (status.count <= 0) {
    delete gameState[target].statuses.sinking;
    log(`[状態解除] ${playerLabel(target)}の「沈潜」が解除されました`);
  }
  return { consumed, power: total };
}

function getHitStatusTarget(player, effect) { return effect?.target === 'opponent' ? opponentOf(player) : player; }

function formatStatusEffectText(effect) {
  if (!effect) return '';
  const name = STATUS_DEFINITIONS[effect.id]?.name || effect.id;
  const suffix = effect.target === 'opponent' ? 'を与える' : 'を得る';
  const parts = [];
  if (effect.power) parts.push(`${name}威力${effect.power}${suffix}`);
  if (effect.count) parts.push(`${name}回数${effect.count}${suffix}`);
  return parts.join(' ');
}

function applyOnUseEffects(player, card) {
  if (!card?.onUse) return;
  if (card.onUse.light) {
    const p = gameState[player];
    const before = p.light;
    p.light = Math.min(p.maxLight, p.light + card.onUse.light);
    log(`[使用時] ${playerLabel(player)}の「${card.name}」: 光 ${before}→${p.light}`);
  }
  if (card.onUse.status) {
    const effect = card.onUse.status;
    const target = getHitStatusTarget(player, effect);
    if (effect.count) {
      const r = changeStatusCount(target, effect.id, effect.count);
      log(`[使用時] ${playerLabel(player)}の「${card.name}」: ${playerLabel(target)}の${STATUS_DEFINITIONS[effect.id]?.name || effect.id}回数 ${r.before}→${r.after}`);
    }
    if (effect.power) {
      const r = changeStatusPower(target, effect.id, effect.power);
      log(`[使用時] ${playerLabel(player)}の「${card.name}」: ${playerLabel(target)}の${STATUS_DEFINITIONS[effect.id]?.name || effect.id}威力 ${r.before}→${r.after}`);
    }
  }
  if (card.onUse.special === 'bloodletting_light') {
    const target = opponentOf(player);
    const bleed = getStatus(target, 'bleed');
    if (bleed?.power >= 3) {
      const p = gameState[player];
      const before = p.light;
      p.light = Math.min(p.maxLight, p.light + 2);
      log(`[使用時] ${playerLabel(player)}の「${card.name}」: ${playerLabel(target)}の出血威力が3以上のため光 ${before}→${p.light}`);
    }
  }
}

function triggerOnHit(player, card, target = null, coin = null, slot = null, extra = {}) {
  if (!card) return;
  // flipCoin() の結果オブジェクトには威力・表裏などだけを持たせ、
  // 実際のコイン固有効果はカードの coins[index] から解決する。
  // 以前は coin.onHit を直接参照していたため、実戦時のコイン結果に効果が載らず、
  // 出血・沈潜・呼吸などのコイン固有On Hitデバフが発動しない不具合があった。
  const coinDefinition = (Number.isInteger(coin?.index) && card?.coins) ? card.coins[coin.index] : null;
  const coinOnHit = coinDefinition?.onHit;
  const effectSource = (coinOnHit && Object.keys(coinOnHit).length) ? coinOnHit : (card.onHit || null);
  const resolvedTarget = target || opponentOf(player);
  const ctx = {
    player, card, coin, target: resolvedTarget, slot,
    bleedBonus: 0, sinkingCountBonus: 0,
    bleedEffect: !!(effectSource?.status?.id === 'bleed' && effectSource.status.target === 'opponent'),
    sinkingEffect: !!(effectSource?.status?.id === 'sinking' && effectSource.status.target === 'opponent'),
    ...extra
  };
  if (ctx.sinkingEffect) markSinkingTarget(player, resolvedTarget);
  emitHook('onHit', ctx);

  const applyStatusEffect = (effect) => {
    if (!effect) return;
    const statusTarget = getHitStatusTarget(player, effect);
    let bonus = 0;
    if (effect.id === 'bleed' && effect.target === 'opponent') {
      bonus += ctx.bleedBonus || 0;
      if (slot?.bloodPactFirstPage) {
        const hitCount = gameState[player].bloodPactFirstPageHitCount || 0;
        bonus += 0;
        if (effect.count == null) {
          const extraCount = hitCount === 0 ? 2 : 1;
          const r = changeStatusCount(statusTarget, 'bleed', extraCount);
          log(`[的中] ${playerLabel(player)}の「${card.name}」: ${playerLabel(statusTarget)}に出血回数${extraCount}（血の掟: 最初のページ） ${r.before}→${r.after}`);
        }
        gameState[player].bloodPactFirstPageHitCount = hitCount + 1;
      }
    }
    if (effect.id === 'sinking' && effect.target === 'opponent') bonus += ctx.sinkingCountBonus || 0;

    if (effect.power) {
      const amount = effect.power + (effect.id === 'bleed' && effect.target === 'opponent' ? (ctx.bleedBonus || 0) : 0);
      const r = changeStatusPower(statusTarget, effect.id, amount);
      log(`[的中] ${playerLabel(player)}の「${card.name}」: ${playerLabel(statusTarget)}の${STATUS_DEFINITIONS[effect.id]?.name || effect.id}威力 ${r.before}→${r.after}${ctx.bleedBonus ? `（血の掟+${ctx.bleedBonus}）` : ''}`);
    }
    if (effect.count) {
      const amount = effect.count + bonus;
      const r = changeStatusCount(statusTarget, effect.id, amount);
      log(`[的中] ${playerLabel(player)}の「${card.name}」: ${playerLabel(statusTarget)}の${STATUS_DEFINITIONS[effect.id]?.name || effect.id}回数 ${r.before}→${r.after}`);
    }
  };

  if (effectSource?.status) applyStatusEffect(effectSource.status);

  if (ctx.sinkingCountBonus) {
    const r = changeStatusCount(resolvedTarget, 'sinking', ctx.sinkingCountBonus);
    log(`[的中] ${playerLabel(player)}の「${card.name}」: ${playerLabel(resolvedTarget)}に沈潜回数${ctx.sinkingCountBonus}（沈む思考） ${r.before}→${r.after}`);
  }

  if (effectSource?.draw) {
    for (let i = 0; i < effectSource.draw; i++) drawCard(player);
    log(`[的中] ${playerLabel(player)}の「${card.name}」: ${effectSource.draw}枚ドロー`);
  }
  if (effectSource?.special === 'blood_festival') {
    const bleed = getStatus(resolvedTarget, 'bleed');
    if (bleed?.power >= 3) { drawCard(player); log(`[的中] ${playerLabel(player)}の「${card.name}」: 出血威力3以上のため追加で1枚ドロー`); }
  }
  if (effectSource?.special === 'blood_feast') {
    const bleed = getStatus(resolvedTarget, 'bleed');
    if (bleed?.power >= 3) {
      const s = ensureStatus(player, 'blood_feast');
      s.power = 5; s.count = 1; normalizeStatus('blood_feast', s);
      log(`[的中] ${playerLabel(player)}の「${card.name}」: この幕のダメージ+5`);
    }
  }
  if (effectSource?.special === 'abyss_draw_if_5') {
    const sinking = getStatus(resolvedTarget, 'sinking');
    if (sinking?.power >= 5) { for (let i = 0; i < 3; i++) drawCard(player); log(`[的中] ${playerLabel(player)}の「${card.name}」: 沈潜威力5以上のため3枚ドロー`); }
  }
}

function applySkillClashWinEffects(player, card, target) {
  const source = card?.onClashWin;
  if (!source) return;
  if (source.status) {
    const effect = source.status;
    const targetPlayer = getHitStatusTarget(player, effect);
    if (effect.id === 'sinking' && effect.target === 'opponent') markSinkingTarget(player, targetPlayer);
    if (effect.power) changeStatusPower(targetPlayer, effect.id, effect.power);
    if (effect.count) changeStatusCount(targetPlayer, effect.id, effect.count);
    log(`[マッチ勝利] ${playerLabel(player)}の「${card.name}」: ${playerLabel(targetPlayer)}に${formatStatusEffectText(effect)}`);
  }
  if (source.special === 'dusk_draw_if_stagger_half') {
    if (gameState[target].stagger <= gameState[target].maxStagger / 2) {
      drawCard(player); log(`[マッチ勝利] ${playerLabel(player)}の「${card.name}」: 相手の混乱耐性が半分以下のため1枚ドロー`);
    }
  }
  if (source.special === 'rain_consume_sinking_if_3') {
    const sinking = getStatus(target, 'sinking');
    if (sinking?.count >= 3) { consumeSinkingCount(target, 1); log(`[マッチ勝利] ${playerLabel(player)}の「${card.name}」: 沈潜回数を1消費`); }
  }
}

function getStatusTooltip(status) {
  if (!status) return '';
  if (status.id === 'breath') return `クリティカル確率: ${status.power}%<br>残り回数: ${status.count}<br>クリティカル時、ダメージ1.5倍。幕終了時またはクリティカル発動時に回数-1。最大値: 威力99 / 回数99。`;
  if (status.id === 'bleed') return `攻撃コインを振るたび、威力分のダメージを受ける。発動時に回数-1。最大値: 威力99 / 回数99。`;
  if (status.id === 'sinking') return `沈潜X / 回数Y。攻撃を受けたとき精神をX減少し、回数を1減少。最大値: 威力99 / 回数99。`;
  if (status.id === 'blood_feast') return `この幕、ダメージ+${status.power}。幕終了時に解除。`;
  return `${status.name}<br>威力: ${status.power}<br>回数: ${status.count}`;
}

function getSkillHitEffectTexts(card, coin) {
  const source = coin?.onHit || card?.onHit || null;
  if (!source) return [];
  const texts = [];
  if (source.status) { const t = formatStatusEffectText(source.status); if (t) texts.push(`【的中】${t}`); }
  if (source.special === 'blood_festival') texts.push('【的中】相手の出血威力が3以上なら、追加で1枚引く');
  if (source.special === 'blood_feast') texts.push('【的中】相手の出血威力が3以上なら、この幕のダメージ+5');
  if (source.special === 'sunken_memory_reuse') texts.push('【的中】相手の沈潜威力が4以上なら、このコインを最大3回まで再使用');
  if (source.special === 'abyss_draw_if_5') texts.push('【的中】相手の沈潜威力が5以上なら、3枚引く');
  if (source.special === 'underwater_consume_sinking') texts.push('【的中】相手の沈潜回数を最大3消費し、解除した沈潜威力×回数だけ威力増加');
  return texts;
}

// 旧UI/イベント名との互換エイリアス
function getDiceHitEffectTexts(card, dice) { return getSkillHitEffectTexts(card, dice); }
function getDiceHitEffectHtml(card, dice) {
  const texts = getSkillHitEffectTexts(card, dice);
  if (!texts.length) return '';
  return `<div class="dice-hit-effects">${texts.map(t => `<div>${t}</div>`).join('')}</div>`;
}
