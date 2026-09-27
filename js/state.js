// state.js — ゲーム状態とデッキ構築画面の状態変数

let selectedP1CoreIds = [CORE_PAGES[0].id];
let selectedP2CoreIds = [CORE_PAGES[1].id];
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
const MAX_EGO_RESOURCE = 10;
const gameState = {
  p1: {
    core: null,
    hp: 0, maxHp: 0,
    stagger: 0, maxStagger: 0, isStaggered: false, staggerSkipDone: false,
    sanity: 0, minSanity: -45, maxSanity: 45,
    light: 3, maxLight: 3,
    egoResources: { wrath:0, lust:0, sloth:0, gluttony:0, gloom:0, pride:0, envy:0 },
    deck: [], hand: [], discard: [], slots: [], statuses: {},
    defenseStock: [], counterSkills: [],
    bloodPactFirstPageAvailable: true, bloodPactFirstPageHitCount: 0,
    sinkingPactUses: 0, sinkingMarkedTargets: {},
    sinkingThinkingFirstPageAvailable: true, sinkingThinkingHitCount: 0
  },
  p2: {
    core: null,
    hp: 0, maxHp: 0,
    stagger: 0, maxStagger: 0, isStaggered: false, staggerSkipDone: false,
    sanity: 0, minSanity: -45, maxSanity: 45,
    light: 3, maxLight: 3,
    egoResources: { wrath:0, lust:0, sloth:0, gluttony:0, gloom:0, pride:0, envy:0 },
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
