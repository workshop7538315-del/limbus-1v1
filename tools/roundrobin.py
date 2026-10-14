# tools/roundrobin.py — 自動戦闘の総当たりテスト（Playwright）
# 使い方: python3 tools/roundrobin.py <リポジトリの絶対パス> <各組み合わせの試合数> [出力JSON]
# 既定は万全な状態（window.TEST_FULL_POWER = true、js/state.js 参照）。--normal を付けると通常の状態でテストする。
# W社のデッキはコスト3のスキルを1枚にしている。各デッキにはリソース回復スキルを最低3枚入れる。
# 操作は両者共通: 出せる中で最もコストの高いスキルを出し、自分を狙う相手のダイスを優先して指定。E.G.Oは使わない。

import sys, json, itertools, time
from playwright.sync_api import sync_playwright

root = sys.argv[1]
N = int(sys.argv[2]) if len(sys.argv) > 2 else 10
NORMAL = '--normal' in sys.argv  # 通常テスト（万全な状態にしない）
sys.argv = [a for a in sys.argv if a != '--normal']

ARCH = {
  # 各デッキにリソース回復スキル（光回復・充電・呼吸・振動を得るスキル）を最低3枚
  'lib':     {'name': '見習い司書',         'core': 'core_1',  'deck': ['card_1','card_1','card_3','card_3','card_5','card_7','card_6','card_6','card_18']},
  'assn':    {'name': '裏路地の暗殺者',     'core': 'core_2',  'deck': ['card_1','card_1','card_3','card_5','card_7','card_8','card_6','card_6','card_18']},
  'shield':  {'name': '盾持ち兵士',         'core': 'core_3',  'deck': ['card_2','card_2','card_10','card_3','card_3','card_9','card_6','card_6','card_18']},
  'bleed':   {'name': '黒雲会(出血)',       'core': 'core_4',  'deck': ['card_12','card_12','card_13','card_14','card_14','card_15','card_16','card_16','card_6']},
  'sinking': {'name': '雨天事務所(沈潜)',   'core': 'core_6',  'deck': ['card_19','card_20','card_21','card_23','card_24','card_26','card_18','card_18','card_6']},
  'salsu':   {'name': '剣契の殺手(呼吸)',   'core': 'core_7',  'deck': ['card_27','card_27','card_28','card_28','card_32','card_29','card_30','card_33','card_37']},
  'wblade':  {'name': 'W社(刀)(充電)',      'core': 'core_9',  'deck': ['card_38','card_38','card_38','card_39','card_40','card_41','card_47','card_49','card_49']},
  'wdual':   {'name': 'W社(双剣)(充電)',    'core': 'core_10', 'deck': ['card_42','card_42','card_42','card_43','card_43','card_44','card_47','card_49','card_49']},
  'liu':     {'name': 'リウ協会(火傷)',     'core': 'core_12', 'deck': ['card_54','card_55','card_55','card_56','card_57','card_58','card_59','card_59','card_59']},
  'yuro':    {'name': 'ユロージヴィ(振動)', 'core': 'core_13', 'deck': ['card_62','card_62','card_63','card_63','card_64','card_65','card_66','card_66','card_67']},
}

GAME_JS = r"""
async ([a, b]) => {
  // ---- 共通の自動操作（両陣営同じ）----
  const policy = (p, slot) => {
    const me = gameState[p], enemy = gameState[opponentOf(p)];
    const playable = me.hand.filter(c => c.cost <= me.light);
    if (!playable.length) { stats[p].deadSlots++; return null; }
    const maxCost = Math.max(...playable.map(c => c.cost));
    const pool = playable.filter(c => c.cost === maxCost);
    const card = pool[Math.floor(Math.random() * pool.length)];
    let target = null;
    if (!['counter', 'counter_clash'].includes(card.skillType) && enemy.slots.length && !enemy.isStaggered) {
      const threat = enemy.slots.find(s => s.targetSlot === slot);
      target = threat || enemy.slots[Math.floor(Math.random() * enemy.slots.length)];
    }
    return { card, target };
  };
  window.stats = { p1: { deadSlots: 0, slots: 0, direct: 0, lightSum: 0, handSum: 0, rounds: 0, chargeSum: 0, breathSum: 0, hpLog: [] },
                   p2: { deadSlots: 0, slots: 0, direct: 0, lightSum: 0, handSum: 0, rounds: 0, chargeSum: 0, breathSum: 0, hpLog: [] } };
  window.chooseP2Action = (slot) => { stats.p2.slots++; const r = policy('p2', slot); if (r) playCardToSlot('p2', slot, r.card, r.target); };
  const origApply = applyDamage;
  window.applyDamage = function (target, attackType, amount, attacker, options) {
    const before = gameState[target].hp; const r = origApply.apply(this, arguments);
    if (attacker && attacker !== target) stats[attacker].direct += Math.max(0, before - gameState[target].hp);
    return r;
  };
  window.TEST_FULL_POWER = FULL_POWER;
  selectedP1CoreIds = [a.core]; selectedP2CoreIds = [b.core];
  EGO_RISK_LEVELS.forEach(r => { selectedP1EgoIds[r] = null; selectedP2EgoIds[r] = null; });
  decks.p1 = [...a.deck]; decks.p2 = [...b.deck];
  startBattle(); battleAnim.active = false;
  let lastRound = 0, guard = 0;
  while (guard++ < 600) {
    if (document.getElementById('result-modal').style.display === 'flex') break;
    if (gameState.round !== lastRound) {
      lastRound = gameState.round;
      ['p1', 'p2'].forEach(p => { const s = gameState[p], st = stats[p];
        st.rounds++; st.lightSum += s.light; st.handSum += s.hand.length;
        st.chargeSum += (getStatus(p, 'charge')?.count || 0); st.burnSum = (st.burnSum||0) + (getStatus(opponentOf(p), 'burn')?.power || 0); st.breathSum += (getStatus(p, 'breath')?.power || 0);
        st.hpLog.push(s.hp); });
      if (gameState.round > 40) break;
    }
    const cur = getCurrentPlanningSlot();
    if (cur && cur.owner === 'p1') {
      stats.p1.slots++;
      const r = policy('p1', cur);
      if (r) { selectedHandCard = r.card; selectedTargetSlot = r.target; } else { selectedHandCard = null; selectedTargetSlot = null; }
      confirmCurrentSlotAction();
    } else if (gameState.currentQueueIndex >= gameState.planningQueue.length) {
      await executeFullTurn();
    } else { await new Promise(r => setTimeout(r, 0)); }
  }
  const L = document.getElementById('log').innerText;
  const cnt = re => (L.match(re) || []).length;
  const side = p => ({
    hp: gameState[p].hp, maxHp: gameState[p].maxHp,
    clashWins: cnt(new RegExp(`\\[マッチ勝利\\] ${playerLabel(p)}が勝利`, 'g')),
    crits: cnt(new RegExp(`\\[クリティカル\\] ${playerLabel(p)}`, 'g')),
    staggered: cnt(new RegExp(`\\[混乱\\] ${playerLabel(p)}が混乱状態`, 'g')),
    panics: cnt(new RegExp(`\\[パニック\\] ${playerLabel(p)}がパニック`, 'g')),
    ...stats[p]
  });
  return { rounds: gameState.round, winner: gameState.p1.hp <= 0 && gameState.p2.hp <= 0 ? 'draw' : gameState.p2.hp <= 0 ? 'p1' : gameState.p1.hp <= 0 ? 'p2' : 'none', p1: side('p1'), p2: side('p2') };
}
"""

results = []
t0 = time.time()
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page()
    errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.on('dialog', lambda d: d.dismiss())
    keys = list(ARCH)
    for x, y in itertools.permutations(keys, 2):
        for i in range(N):
            pg.goto(f'file://{root}/index.html')
            r = pg.evaluate(GAME_JS.replace('FULL_POWER', 'false' if NORMAL else 'true'), [ARCH[x], ARCH[y]])
            r['a'], r['b'] = x, y
            results.append(r)
    b.close()
json.dump({'results': results, 'errors': errors[:20], 'secs': time.time() - t0}, open(sys.argv[3] if len(sys.argv)>3 else 'tourney_out.json', 'w'), ensure_ascii=False)
print(len(results), 'games', round(time.time() - t0), 's', 'errors', len(errors), errors[:3])
