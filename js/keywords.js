// keywords.js — 説明文中のキーワード（状態異常・バフ・専用の状態）にツールチップを付ける
//
// kw(text) で、プレーンテキスト中のキーワードを <span class="kw-tip"> に置き換える。
//   - PC: マウスを乗せると title のツールチップで説明を表示
//   - スマホ: タップで説明を開閉（クリックはカード選択などに伝わらない）
// 説明は KEYWORD_DESCS（日本語）を優先し、なければ STATUS_DEFINITIONS の日本語の desc を使う。
// 新しい状態を追加したら、STATUS_DEFINITIONS に日本語の desc を書けば自動で対象になる。

const KEYWORD_DESCS = {
  '呼吸': 'クリティカル確率が威力×5%（20で100%）。クリティカル時ダメージ1.2倍。クリティカル発動時と幕終了時に回数-1。',
  '出血': '攻撃コインを振るたび、威力分のダメージを受けて回数-1。',
  '沈潜': '攻撃を受けたとき、威力分だけ精神力が減り回数-1。',
  '破裂': '攻撃を受けたとき、威力分の固定ダメージを受けて回数-1。',
  '振動': '振動爆発を受けると、威力分だけ次の混乱閾値が上がる。',
  '充電': 'スキルで消費して効果を強化するリソース。上限は通常10（W社のスーツで20）。幕終了時に1減少。',
  '麻痺': '回数分のコインの威力が0になる。',
  '脆弱': '受けるダメージが1につき10%増加（この幕）。',
  '保護': '受けるダメージが1につき10%減少（この幕）。',
  '迅速': '速度が数値分上がる。',
  '束縛': '速度が数値分下がる。',
  '威力増加': 'スキルの最終威力+数値（この幕）。',
  '威力減少': 'スキルの最終威力-数値（この幕）。',
  '攻撃威力増加': '攻撃スキルの最終威力+数値（この幕）。',
  '攻撃威力減少': '攻撃スキルの最終威力-数値（この幕）。',
  'マッチ威力増加': 'マッチ時の威力+数値（この幕）。',
  'マッチ威力減少': 'マッチ時の威力-数値（この幕）。',
  '与ダメージ増加': '与えるダメージが1につき10%増加（この幕）。',
  '斬撃脆弱': '斬撃スキルから受けるダメージが1につき10%増加（この幕）。',
  '斬撃威力増加': '斬撃スキルの最終威力+数値。',
  '斬撃ダメージ増加': '斬撃スキルの与ダメージが1につき10%増加（この幕）。',
  '憂鬱脆弱': '憂鬱属性のスキルから受けるダメージが1につき10%増加（この幕）。',
  '破壊不能コイン': 'マッチに負けても失われず、敗北後も攻撃する。',
  '侵蝕': '精神力が低いとE.G.Oが侵蝕スキルに変わる。敵味方識別不可で、対象がランダムになる。',
  '敵味方識別不可': '対象がランダムに決まる（自分のダイスを狙うこともある）。'
};

// 他のページの説明から参照されるページ（追撃専用の「骨断」など）も、ページ性能をツールチップで出す。
// 対象: デッキに入らないページ（hidden）、追撃元（onClashLoseFollowUp を持つページ）、tooltipRef: true のページ
function getCardTooltipText(card) {
  const type = { attack: '攻撃', defense: '防御', evade: '回避', counter: '反撃', counter_clash: 'マッチ可能反撃' }[card.skillType] || card.skillType;
  const atk = { slash: '斬撃', pierce: '貫通', blunt: '打撃' }[card.attackType] || '';
  const cp = card.coinCount ? `基礎${card.basePower} / コイン${card.coinPower >= 0 ? '+' : ''}${card.coinPower} ×${card.coinCount}` : '';
  return `【ページ】${card.name}（コスト${card.cost}・${type}${atk ? `（${atk}）` : ''}${cp ? `・${cp}` : ''}）: ${card.effect || '効果なし'}`;
}
function getReferencedCards() {
  const ids = new Set();
  CARD_DATABASE.forEach(c => {
    if (c.hidden || c.tooltipRef) ids.add(c.id);
    if (c.onClashLoseFollowUp) { ids.add(c.id); ids.add(c.onClashLoseFollowUp); }
  });
  return CARD_DATABASE.filter(c => ids.has(c.id));
}

let _kwRegex = null, _kwMap = null;
function buildKeywordIndex() {
  _kwMap = { ...KEYWORD_DESCS };
  getReferencedCards().forEach(c => { if (!_kwMap[c.name]) _kwMap[c.name] = getCardTooltipText(c); });
  Object.values(STATUS_DEFINITIONS).forEach(def => {
    if (!def?.name || _kwMap[def.name]) return;
    if (def.desc && /[ぁ-んァ-ヶ一-龠]/.test(def.desc)) _kwMap[def.name] = def.desc;
  });
  const names = Object.keys(_kwMap).filter(n => /[ぁ-んァ-ヶ一-龠]/.test(n)).sort((a, b) => b.length - a.length);
  const esc = n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  _kwRegex = new RegExp(names.map(esc).join('|'), 'g');
}
function escapeAttr(t) { return String(t).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
// depth: 説明の中のキーワードにも1段だけツールチップを付ける（例: 恨の宿った鞘 → その説明中の「骨断」）
function kw(text, depth = 0, exclude = null) {
  if (!text) return text || '';
  if (!_kwRegex) buildKeywordIndex();
  return String(text).replace(_kwRegex, m => {
    if (m === exclude) return m; // 自分自身の説明の中では自分にリンクしない
    const desc = _kwMap[m];
    const body = depth < 1 ? kw(desc, depth + 1, m) : desc;
    return `<span class="kw-tip" role="button" tabindex="0" title="${escapeAttr(desc)}" onclick="toggleKwTip(this,event)">${m}<span class="kw-tip-text">${body}</span></span>`;
  });
}
function toggleKwTip(el, event) {
  if (event) { event.stopPropagation(); event.preventDefault(); }
  el.classList.toggle('open');
}
