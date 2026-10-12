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
| 士気低下・パニック | js/panic.js、定義は data.js `PANIC_TYPE_DEFS` | 混乱とは別状態。-30で士気低下、-45でパニック |
| パニックタイプ変更 | panic.js `setPanicTypeOverride` | 邸宅の木霊で使用 |
| E.G.O「過ぎし日」 | data.js `ego_bygone_days`、effects.js `applyBygoneDaysHit` ほか | 招聘されざる者・呪い・邸宅の木霊・パッシブ含む |
| マッチ可能反撃の待機 | battle.js `executeFullTurn` | 待機中のスロットを攻撃で指定するとマッチ |

## 2. 1対1向けの簡略化（原作と異なる箇所）

- 烏瞰図「全味方に迅速3」→ 使用者本人のみ。
- 盾持ち兵士のパッシブ「混乱耐性3回復」→ 幕開始時に次の混乱閾値を3下げる。
- 昏がりのドロー条件「相手の混乱耐性が半分以下」→ 相手のHPが最大HPの半分以下。
- 振動爆発 → 次の混乱閾値を「振動威力×倍率」HP分上げる。原作の正確な換算式は未確認。
- 混乱閾値の初期値 → 旧データの「混乱耐性 / HP」比から計算。
- 士気低下は原作では確率発生だが、確率が未確認のため -30 以下なら毎幕発生。
- パニックタイプの「味方への効果」（徘徊の精神力ダメージ等）は1対1では省略。徘徊・自殺の逃走/死亡は敗北扱い。
- 過ぎし日: 「4以上の共鳴」は憂鬱共鳴の発生で代用、味方回復は自分のみ（侵蝕は省略）、攻撃の重さは省略。
- 出血・沈潜等は、威力のみ付与されたら回数1、回数のみなら威力1（原作準拠）。

## 3. 未実装

### 未実装・今後の候補

- P2のAIによるE.G.Oの使用。
- 複数の混乱閾値。
- コアページのパニックタイプは仮の割り当て（資料10.1）。
- マッチ可能反撃「身構える」の「勝ち続ける限り同じマッチ内で再使用」は未実装（1回判定のみ）。
- ドンキE.G.Oパッシブの共鳴補正は `min(0.07, 共鳴数×0.01)`（10%単位）で、実質 +0.1%/共鳴。意図の確認が必要。

## 4. 仕様の判断待ち

（2026-10-12 に下記を資料どおりに決定・実装済み）
- 防御/回避のマッチは、防御/回避側が指定した場合のみ成立。
- マッチ可能反撃は、待機中のスロットを攻撃で指定すると発動。
- 両者同時にHP0なら DRAW。

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
