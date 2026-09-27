// Limbus風 簡易バトルアニメーション。戦闘結果そのものではなく、既存の処理順を可視化する。
const battleAnim = {
  mode: 'step',
  paused: false,
  resolver: null,
  active: false,
  speed: 650
};

function initBattleAnimation() {
  const el = document.getElementById('battle-animation');
  if (!el) return;
  el.classList.add('hidden');
  battleAnim.active = true;
  setAnimationMode('step');
}

function showBattleAnimation() { const el=document.getElementById('battle-animation'); if(el) el.classList.remove('hidden'); }
function hideBattleAnimation() { const el=document.getElementById('battle-animation'); if(el) el.classList.add('hidden'); }

function setAnimationMode(mode) {
  battleAnim.mode = mode;
  battleAnim.speed = mode === 'fast' ? 240 : mode === 'slow' ? 900 : 0;
  document.querySelectorAll('.battle-anim-mode').forEach(b => b.classList.toggle('selected', b.dataset.mode === mode));
  const label = document.getElementById('battle-animation-mode-label');
  if (label) label.textContent = mode === 'step' ? '1クリック' : mode === 'fast' ? 'オート早め' : 'オートゆっくり';
}

function toggleAnimationPause() {
  battleAnim.paused = !battleAnim.paused;
  const b = document.getElementById('battle-animation-pause');
  if (b) b.textContent = battleAnim.paused ? '▶ 再開' : 'Ⅱ 一時停止';
  if (!battleAnim.paused && battleAnim.resolver && battleAnim.mode !== 'step') {
    const r = battleAnim.resolver; battleAnim.resolver = null; r();
  }
}

function skipAnimationStep() {
  if (battleAnim.resolver) {
    const r = battleAnim.resolver; battleAnim.resolver = null; r();
  }
  battleAnim.mode = 'fast';
  battleAnim.speed = 0;
  battleAnim.paused = false;
  setAnimationMode('fast');
}

function animationContinue() {
  if (battleAnim.resolver) {
    const r = battleAnim.resolver; battleAnim.resolver = null; r();
  }
}

function waitForAnimationStep() {
  if (!battleAnim.active) return Promise.resolve();
  if (battleAnim.mode === 'step') {
    return new Promise(resolve => { battleAnim.resolver = resolve; });
  }
  if (battleAnim.paused) {
    return new Promise(resolve => { battleAnim.resolver = resolve; });
  }
  return new Promise(resolve => setTimeout(resolve, battleAnim.speed));
}

function coinHtml(result, label) {
  if (!result) return `<div class="anim-coin pending">?</div>`;
  const side = result.heads ? '表' : '裏';
  return `<div class="anim-coin ${result.heads ? 'heads' : 'tails'}" title="${label || side}">${result.heads ? '●' : '○'}<small>${side}</small></div>`;
}

function animationStatusHtml(player) {
  if (!player || typeof gameState === 'undefined' || !gameState[player]) return '<div class="anim-status-empty">なし</div>';
  const statuses = gameState[player].statuses || {};
  const entries = Object.values(statuses).filter(Boolean);
  if (!entries.length) return '<div class="anim-status-empty">なし</div>';
  return entries.map(status => {
    const cls = status.category === 'debuff' ? 'debuff' : 'buff';
    return `<span class="anim-status ${cls}">${status.name} ${status.power}/${status.count}</span>`;
  }).join('');
}

function animationSkillEffectHtml(skill) {
  if (!skill) return '<div class="anim-effect-empty">なし</div>';
  const texts = [];
  if (skill.effect) texts.push(skill.effect);
  if (skill.onUse) {
    if (skill.onUse.light) texts.push(`使用時: 光+${skill.onUse.light}`);
    if (skill.onUse.status) {
      const st = skill.onUse.status;
      const name = (typeof STATUS_DEFINITIONS !== 'undefined' && STATUS_DEFINITIONS[st.id]) ? STATUS_DEFINITIONS[st.id].name : st.id;
      if (st.power) texts.push(`使用時: ${name}威力+${st.power}`);
      if (st.count) texts.push(`使用時: ${name}回数+${st.count}`);
    }
  }
  if (skill.onClashWin) {
    const st = skill.onClashWin.status;
    if (st) {
      const name = (typeof STATUS_DEFINITIONS !== 'undefined' && STATUS_DEFINITIONS[st.id]) ? STATUS_DEFINITIONS[st.id].name : st.id;
      if (st.power) texts.push(`マッチ勝利: ${name}威力+${st.power}`);
      if (st.count) texts.push(`マッチ勝利: ${name}回数+${st.count}`);
    }
  }
  const coinTexts = [];
  (skill.coins || []).forEach((coin, index) => {
    const source = coin?.onHit;
    if (!source) return;
    const parts = [];
    if (source.status) {
      const st = source.status;
      const name = (typeof STATUS_DEFINITIONS !== 'undefined' && STATUS_DEFINITIONS[st.id]) ? STATUS_DEFINITIONS[st.id].name : st.id;
      if (st.power) parts.push(`${name}威力+${st.power}`);
      if (st.count) parts.push(`${name}回数+${st.count}`);
    }
    if (source.special === 'blood_festival') parts.push('出血3以上で1ドロー');
    if (source.special === 'blood_feast') parts.push('出血3以上でこの幕ダメージ+5');
    if (source.special === 'sunken_memory_reuse') parts.push('沈潜4以上で再使用');
    if (source.special === 'abyss_draw_if_5') parts.push('沈潜5以上で3ドロー');
    if (source.special === 'underwater_consume_sinking') parts.push('沈潜を最大3消費して威力増加');
    if (parts.length) coinTexts.push(`コイン${index + 1}: ${parts.join(' / ')}`);
  });
  texts.push(...coinTexts);
  const unique = [...new Set(texts.filter(Boolean))];
  if (!unique.length) return '<div class="anim-effect-empty">なし</div>';
  return unique.map(t => `<div class="anim-effect-line">${t}</div>`).join('');
}

function renderAnimationState(data) {
  const title = document.getElementById('battle-animation-title');
  const status = document.getElementById('battle-animation-status');
  const left = document.getElementById('battle-animation-left');
  const right = document.getElementById('battle-animation-right');
  if (!title || !left || !right) return;
  title.textContent = data.title || 'マッチ';
  status.textContent = data.status || '';

  // マッチ画面の左右は常に P1=左 / P2=右に固定する。
  const supplied = [data.left, data.right].filter(Boolean);
  const p1 = supplied.find(side => side.player === 'p1') || supplied[0] || {};
  const p2 = supplied.find(side => side.player === 'p2') || supplied.find(side => side !== p1) || {};

  const makeSide = (side) => {
    const coins = (side.coins || []).map((c,i) => coinHtml(c, `${side.name} コイン${i+1}`)).join('');
    const icon = side.attackType ? `assets/dice_icons/attack_${side.attackType}.png` : 'assets/dice_icons/attack_slash.png';
    return `<div class="anim-side-head"><img src="${icon}" alt=""> <strong>${side.name || '－'}</strong></div>
      <div class="anim-power">${side.power ?? '－'}</div>
      <div class="anim-modifier">${side.modifier || ''}</div>
      <div class="anim-effects"><div class="anim-section-title">追加効果</div>${animationSkillEffectHtml(side.skill)}</div>
      <div class="anim-statuses"><div class="anim-section-title">かかっている効果</div><div class="anim-status-list">${animationStatusHtml(side.player)}</div></div>
      <div class="anim-coins">${coins || '<span class="anim-no-coins">コインなし</span>'}</div>
      <div class="anim-remaining">残り ${side.remaining ?? side.coins?.length ?? 0}枚</div>
      ${side.resultText ? `<div class="anim-result">${side.resultText}</div>` : ''}`;
  };
  left.innerHTML = makeSide(p1);
  right.innerHTML = makeSide(p2);
}

async function animateClashRoll(data) {
  showBattleAnimation();
  renderAnimationState({
    title: `CLASH ${data.round}`,
    status: 'コインを投げる',
    left: { ...data.left, modifier: `基礎 ${data.left.base} + 表 ${data.left.heads}枚 × ${data.left.coinPower}` },
    right: { ...data.right, modifier: `基礎 ${data.right.base} + 表 ${data.right.heads}枚 × ${data.right.coinPower}` }
  });
  await waitForAnimationStep();
}

async function animateClashResult(data) {
  showBattleAnimation();
  renderAnimationState({
    title: data.winner ? `${data.winner} CLASH WIN` : 'CLASH DRAW',
    status: data.winner ? `${data.winner} の勝利。敗者のコインを1枚破壊` : '引き分け。両者のコインを1枚破壊',
    left: { ...data.left, modifier: data.left.result || '' },
    right: { ...data.right, modifier: data.right.result || '' }
  });
  await waitForAnimationStep();
}

async function animateOneSided(data) {
  showBattleAnimation();
  renderAnimationState({
    title: 'ONE-SIDED ATTACK',
    status: `${data.attacker} の残存コインによる一方攻撃`,
    left: data.left,
    right: data.right
  });
  await waitForAnimationStep();
}

async function animateHit(data) {
  showBattleAnimation();
  renderAnimationState({
    title: 'HIT',
    status: `${data.attacker} → ${data.defender}  ${data.damage} damage${data.effects ? ` / ${data.effects}` : ''}`,
    left: data.left,
    right: data.right
  });
  const panel = document.getElementById('battle-animation');
  if (panel) panel.classList.add('hit-flash');
  await waitForAnimationStep();
  if (panel) panel.classList.remove('hit-flash');
}

function animSideFromSkill(player, skill, power, coins, remaining, modifier='') {
  return {
    player,
    skill,
    name: `${playerLabel(player)}「${skill.name}」`,
    power, coins, remaining,
    attackType: skill.attackType,
    modifier,
    base: skill.basePower || 0,
    heads: coins.filter(c => c?.heads).length,
    coinPower: skill.coinPower || 0
  };
}
