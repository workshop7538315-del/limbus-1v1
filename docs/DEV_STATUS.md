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
| E.G.Oパッシブ | effects.js `queueEgoPassive` → `processEgoTurnStart` | 使用した幕の次の幕から有効。全E.G.Oに設定済み（説明は `egoPassiveDesc`） |
| 士気低下・パニック | js/panic.js、定義は data.js `PANIC_TYPE_DEFS` | 混乱とは別状態。-30で士気低下、-45でパニック |
| パニックタイプ変更 | panic.js `setPanicTypeOverride` | 邸宅の木霊で使用 |
| E.G.O「過ぎし日」 | data.js `ego_bygone_days`、effects.js `applyBygoneDaysHit` ほか | 招聘されざる者・呪い・邸宅の木霊・パッシブ含む |
| 呼吸（=LCBのPoise） | battle.js `tryBreathCritical` / `getCritDamageBonus`、effects.js `getBreathCoinPowerBonus` | クリティカル率 威力×5%、1.2倍＋スキルの追加倍率。回数0で消える |
| 剣契（コアページ core_7/core_8、card_27〜37） | data.js（LCB人格スキル＋LoRの剣契ページ・キーページ） | 肉斬→骨断の追撃（`onClashLoseFollowUp`）、混乱無効（`noStaggerDuringSkill`）、致死耐え（`lethalGuardOnce`） |
| 充電（リソース） | js/charge.js | 上限は core.chargeCap（通常10、W社20）、幕終了時-1。実行時（On Use）処理 `prepareSkillExecution` |
| W社3級整理要員(刀)/(双剣)（core_9/core_10、card_38〜44・46〜49） | data.js | LCB 良秀・ドンキホーテのスキル＋LoR WARP整理班のページ |
| 黒獣-卯（core_11、card_50〜53） | data.js、js/rupture.js | 速度差・破裂・脚力【卯】・呪殺【迅速】・コイン再使用。他より一段強い想定 |
| 破裂 | effects.js `triggerRupture` | 的中時、そのコインの効果より先に発動（付与した破裂は次の的中から） |
| E.G.O「着影揮刀」（HE） | data.js `ego_bladesinger`、js/blade_lineage.js | 弔い酒・怨恨・パッシブ刃先の酒滴（キムサッガで常時有効）・初回コスト軽減 |
| デッキ非表示のページ | `hidden: true` | 骨断（追撃専用） |
| マッチ可能反撃の待機 | battle.js `executeFullTurn` | 待機中のスロットを攻撃で指定するとマッチ |

## 2. 1対1向けの簡略化（原作と異なる箇所）

- 烏瞰図「全味方に迅速3」→ 使用者本人のみ。
- 盾持ち兵士のパッシブ「混乱耐性3回復」→ 幕開始時に次の混乱閾値を3下げる。
- 昏がりのドロー条件「相手の混乱耐性が半分以下」→ 相手のHPが最大HPの半分以下。
- 振動爆発 → 次の混乱閾値を「振動威力×倍率」HP分上げる。原作の正確な換算式は未確認。
- 混乱閾値の初期値 → 旧データの「混乱耐性 / HP」比から計算。
- 士気低下は原作では確率発生だが、確率が未確認のため -30 以下なら毎幕発生。
- パニックタイプの「味方への効果」は1対1では省略。自殺の死亡は敗北扱い。
- 徘徊のパニックは独自効果「幕開始時に手札をランダムに1枚失う」（原作の逃走は不採用）。
- ドンキE.G.Oパッシブ: 嫉妬スキルの与ダメージ+10%、嫉妬共鳴発生時はさらに+5%。
- 過ぎし日: 「4以上の共鳴」は憂鬱共鳴の発生で代用、味方回復は自分のみ（侵蝕は省略）、攻撃の重さは省略。
- 他人の鎖のパッシブ「3つ以上のスキルに指定」→「2つ以上」（相手の速度ダイスが最大2つのため）。
- 呼吸: 以前は「威力=クリティカル率%、1.5倍」だったが、LCBのPoiseに合わせ「威力×5%、1.2倍」に変更（剣契のクリティカル追加倍率前提）。
- 剣契: 原作の味方への呼吸付与は自分に置き換え。挑発値・攻撃の重さは省略。骨断の「単一対象+100%」は1対1で常時発動になるため省略。
- 充電: LoRは上限10（W社のスーツで20）のリソース、LCBは幕終了時に1減少。両方を採用。
- W社: 「敵撃破時」の効果は1対1では決着と同時になるため、マッチ勝利時などに置き換え。破裂は不採用（脆弱に置き換え）。
- LoR WARP整理班のページ（過充電・次元の狭間・波動・遡行）は効果のみLoR準拠（ユーザー提供）。ダイスはこのゲーム向けに設定。
- LCBとLoRで同名の「エネルギー循環」「跳躍」は1枚に統合（LoRの効果を追加）。
- 黒獣-卯: サポートパッシブ不採用。「10以上の速度」は速度ダイスの値で判定（脚力【卯】の迅速5で到達）。瞬歩・刺殺に光回復・ドローを追加（このゲーム独自）。
- キムサッガ・剣契師範由来のページ（抜剣・刺法・肉斬・殺主・骨断）はLCB 剣契師範ムルソーの基礎/コイン威力をそのまま使用（2026-10-12）。
- 着影揮刀: wiki個別ページが取得できず攻略サイトの記載を参照。精神力消費20・罪悪耐性は仮。味方前提の効果（怨嗟の鞘・積もる怨嗟・真髄・味方への付与/回復）は省略または自分に置き換え。
- 麻痺は回数=0にするコインの枚数（valueFromCount）。
- 出血・沈潜等は、威力のみ付与されたら回数1、回数のみなら威力1（原作準拠）。

## 3. 未実装

### 未実装・今後の候補

- P2のAIによるE.G.Oの使用。
- 複数の混乱閾値。
- コアページのパニックタイプは仮の割り当て（資料10.1）。
- マッチ可能反撃「身構える」の「勝ち続ける限り同じマッチ内で再使用」は未実装（1回判定のみ）。

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
