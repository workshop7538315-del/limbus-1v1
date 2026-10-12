# 開発状況メモ（AI間の引き継ぎ用）

最終更新: 2026-10-12（Claude）

このファイルは「説明」と「実装」の対応を記録するためのもの。
機能を追加・変更したら、該当する行を更新すること。

## 1. 実装済み（コードで動作を確認済み）

| 機能 | 主な場所 | 備考 |
|---|---|---|
| コイン判定・マッチ | battle.js `resolveClash` / `rollSkillForClash` / `flipCoin` | マッチ用威力と攻撃威力は別計算 |
| 一方攻撃・防御ストック | battle.js `resolveOneSided` / `resolveDefenseAgainstAttack` | |
| マッチ可能反撃 | battle.js `resolveLegacyClashableCounter` | 同期処理のまま。非同期化しないこと |
| 精神力・表率 | effects.js `changeSanity` / `getHeadsChance` | 表率 = 50 + 精神力（5〜95%） |
| 出血・沈潜・呼吸 | effects.js | |
| HP混乱閾値 | battle.js `checkStaggerThresholds` / `adjustNextStaggerThreshold` | 閾値は1つだけ（複数閾値は未対応） |
| E.G.O資源・共鳴 | effects.js `generateEgoResourceForSkill` / `getResonanceCounts` | |
| E.G.O使用・侵蝕 | battle.js `playCardToSlot` / `applyEgoCorrosionAtTurnStart` | |
| E.G.Oパッシブ | effects.js `queueEgoPassive` → `processEgoTurnStart` | 使用した幕の次の幕から有効 |

## 2. 1対1向けの簡略化（原作と異なる箇所）

- 烏瞰図「全味方に迅速3」→ 使用者本人のみ。
- 盾持ち兵士のパッシブ「混乱耐性3回復」→ 幕開始時に次の混乱閾値を3下げる。
- 昏がりのドロー条件「相手の混乱耐性が半分以下」→ 相手のHPが最大HPの半分以下。
- 振動爆発 → 次の混乱閾値を「振動威力×倍率」HP分上げる。原作の正確な換算式は未確認。
- 混乱閾値の初期値 → 旧データの「混乱耐性 / HP」比から計算。

## 3. 未実装

### パニック

次の3つは別物として扱うこと。

- **パニックタイプのデータ** … 追加済み（`CORE_PAGES[].panicType`）。
- **効果の説明文** … 追加済み（`PANIC_TYPE_DEFS`）。ただし「味方へ」など、1対1では成立しない文言が残っている。
- **戦闘中の処理** … **未実装**。`panicType` を参照しているのは表示用のコードだけ。

設計時の注意:

- 混乱（`isStaggered`）とは別の状態として持つ。
- 説明文は、実装する効果と同時に書き直す。
- 「過ぎし日」が使うため、パニックタイプを変更できる設計にする。例: `gameState[p].panicTypeOverride`。

### その他の未実装

- 「過ぎし日」（イシュメール）のE.G.O。
- P2のAIによるE.G.Oの使用。
- 複数の混乱閾値。

## 4. 仕様の判断待ち（コードは未変更）

- **防御・回避のマッチ成立条件**
  - コードの挙動: どちらか一方が防御・回避なら、どちらが指定してもマッチが成立する（`executeFullTurn` の `canClash`）。
  - 資料の記述: 防御・回避側が指定した場合のみ成立する。
- **マッチ可能反撃（身構える）**
  - 相互に指定していないとマッチにならず、攻撃されただけでは不発になる。
- **両者が同時にHP0になった場合**
  - P2の判定が先に行われるため「VICTORY」と表示される。

## 5. 確認方法

- **構文チェック:** `node --check js/*.js`
- **ブラウザでの確認:** ヘッドレスChromium（Playwright）で index.html を file:// から開く。
  - 戦闘開始、手札とE.G.Oカードの表示、詳細の開閉、ランダムなデッキでの自動対戦を確認する。
  - アニメーション待ちは `battleAnim.active = false` で省略する。
- **注意:** ソースを読んだだけでは、ブラウザ上の動作確認をしたことにはならない。

## 6. 過去の事故

- ec902f4 で、js/ui.js の4関数が削除された。
  - 対象: `updateResDisplay` / `updatePlanningPrompt` / `selectTargetSlot` / `makeEgoCard`
  - 結果: 戦闘を開始できない状態になっていた（a03fa34 で復元）。
- ui.js を大きく書き換えたあとは、次のコマンドの出力で関数が消えていないか比較すること:
  `grep -o "function [A-Za-z0-9_]*" js/*.js | sort`
