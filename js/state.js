// state.js — ゲーム状態とデッキ構築画面の状態変数

let selectedP1CoreIds = [CORE_PAGES[0].id];
let selectedP2CoreIds = [CORE_PAGES[1].id];
const EGO_RISK_LEVELS = ['ZAYIN', 'TETH', 'HE', 'WAW', 'ALEPH'];
const selectedP1EgoIds = { ZAYIN: null, TETH: null, HE: null, WAW: null, ALEPH: null };
const selectedP2EgoIds = { ZAYIN: null, TETH: null, HE: null, WAW: null, ALEPH: null };
const decks = { p1: [], p2: [] };
let activeDeckEditor = 'p1';
let currentFilter = 'all';
let selectedHandCard = null;
let selectedTargetSlot = null;

const coreAccordionOpen = {};
const poolAccordionOpen = {};
const deckAccordionOpen = { p1: true, p2: true };

const ATTACK_TYPES = ['slash', 'pierce', 'blunt'];
const SIN_TYPES = ['wrath', 'lust', 'sloth', 'gluttony', 'gloom', 'pride', 'envy'];
// テスト用「万全な状態」モード（window.TEST_FULL_POWER = true）。
// 資源・状態を条件とする追加の威力増加・与ダメージ増加を、条件を満たしたものとして常に発動させる（自動戦闘の総当たり用）。
// 状態の数値条件は FULL_POWER_STATUS として扱い、充電は上限、消費系は不足しても成功扱い（代償なし）。実際の状態の値は変えない。
const FULL_POWER_STATUS = 18;
function isFullPowerTest() { return typeof window !== 'undefined' && !!window.TEST_FULL_POWER; }
function fullPowerValue(actual) { return isFullPowerTest() ? Math.max(actual || 0, FULL_POWER_STATUS) : (actual || 0); }
const MAX_EGO_RESOURCE = 99; // 罪悪資源の上限（2026-10-12 に10→99。原作LCBは実質上限なし。一生シチュー等の資源比例効果のため）
const gameState = {
  p1: {
    core: null,
    hp: 0, maxHp: 0,
    staggerThresholds: [], triggeredStaggerThresholds: 0, staggerLevel: 0, isStaggered: false, staggerSkipDone: false, staggerThresholdBonus: 0,
    sanity: 0, minSanity: -45, maxSanity: 45,
    shield: 0, cumulativeDamageTaken: 0, egoPassiveOffenseBonus: 0,
    isCorroded: false, corrosionEgoId: null,
    panicState: null, panicTurns: 0, panicNoAction: false, panicIndiscriminate: false, lowMoraleTriggered: false, panicTypeOverride: null,
    light: 3, maxLight: 3,
    egoResources: { wrath:0, lust:0, sloth:0, gluttony:0, gloom:0, pride:0, envy:0 },
    equippedEgos: [],
    usedEgosThisTurn: [],
    pendingStatuses: {},
    activeEgoPassives: [], pendingEgoPassives: [],
    sinRes: { wrath:1, lust:1, sloth:1, gluttony:1, gloom:1, pride:1, envy:1 },
    deck: [], hand: [], discard: [], slots: [], statuses: {},
    defenseStock: [], counterSkills: [],
    bloodPactFirstPageAvailable: true, bloodPactFirstPageHitCount: 0,
    sinkingPactUses: 0, sinkingMarkedTargets: {},
    sinkingThinkingFirstPageAvailable: true, sinkingThinkingHitCount: 0
  },
  p2: {
    core: null,
    hp: 0, maxHp: 0,
    staggerThresholds: [], triggeredStaggerThresholds: 0, staggerLevel: 0, isStaggered: false, staggerSkipDone: false, staggerThresholdBonus: 0,
    sanity: 0, minSanity: -45, maxSanity: 45,
    shield: 0, cumulativeDamageTaken: 0, egoPassiveOffenseBonus: 0,
    isCorroded: false, corrosionEgoId: null,
    panicState: null, panicTurns: 0, panicNoAction: false, panicIndiscriminate: false, lowMoraleTriggered: false, panicTypeOverride: null,
    light: 3, maxLight: 3,
    egoResources: { wrath:0, lust:0, sloth:0, gluttony:0, gloom:0, pride:0, envy:0 },
    equippedEgos: [],
    usedEgosThisTurn: [],
    pendingStatuses: {},
    activeEgoPassives: [], pendingEgoPassives: [],
    sinRes: { wrath:1, lust:1, sloth:1, gluttony:1, gloom:1, pride:1, envy:1 },
    deck: [], hand: [], discard: [], slots: [], statuses: {},
    defenseStock: [], counterSkills: [],
    bloodPactFirstPageAvailable: true, bloodPactFirstPageHitCount: 0,
    sinkingPactUses: 0, sinkingMarkedTargets: {},
    sinkingThinkingFirstPageAvailable: true, sinkingThinkingHitCount: 0
  },
  planningQueue: [],
  currentQueueIndex: 0,
  round: 0
};

function opponentOf(p) { return p === 'p1' ? 'p2' : 'p1'; }
function playerLabel(p) { return p === 'p1' ? 'P1' : 'P2'; }
function isAttackType(type) { return ATTACK_TYPES.includes(type); }
function slotLabel(slot) {
  if (!slot) return '対象なし';
  return `${playerLabel(slot.owner)}速度ダイス${slot.id + 1}(速度${slot.speed})`;
}
function getCurrentPlanningSlot() { return gameState.planningQueue[gameState.currentQueueIndex]; }
function isP1Planning() {
  const currentSlot = getCurrentPlanningSlot();
  return !!(currentSlot && currentSlot.owner === 'p1');
}
