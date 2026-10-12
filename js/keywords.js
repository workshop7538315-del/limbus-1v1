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

let _kwRegex = null, _kwMap = null;
function buildKeywordIndex() {
  _kwMap = { ...KEYWORD_DESCS };
  Object.values(STATUS_DEFINITIONS).forEach(def => {
    if (!def?.name || _kwMap[def.name]) return;
    if (def.desc && /[ぁ-んァ-ヶ一-龠]/.test(def.desc)) _kwMap[def.name] = def.desc;
  });
  const names = Object.keys(_kwMap).filter(n => /[ぁ-んァ-ヶ一-龠]/.test(n)).sort((a, b) => b.length - a.length);
  const esc = n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  _kwRegex = new RegExp(names.map(esc).join('|'), 'g');
}
function escapeAttr(t) { return String(t).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
function kw(text) {
  if (!text) return text || '';
  if (!_kwRegex) buildKeywordIndex();
  return String(text).replace(_kwRegex, m => `<span class="kw-tip" role="button" tabindex="0" title="${escapeAttr(_kwMap[m])}" onclick="toggleKwTip(this,event)">${m}<span class="kw-tip-text">${_kwMap[m]}</span></span>`);
}
function toggleKwTip(el, event) {
  if (event) { event.stopPropagation(); event.preventDefault(); }
  el.classList.toggle('open');
}
