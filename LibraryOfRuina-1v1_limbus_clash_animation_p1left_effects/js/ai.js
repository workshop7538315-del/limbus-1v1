// ai.js — P2(敵)の行動選択AI

function chooseP2Action(currentSlot) {
  const playable = gameState.p2.hand.filter(c => c.cost <= gameState.p2.light);
  if (playable.length === 0) return;
  const card = playable[Math.floor(Math.random() * playable.length)];
  const p1Slots = gameState.p1.slots;
  const target = (card.skillType === 'counter') ? null : (p1Slots.length > 0 ? p1Slots[Math.floor(Math.random() * p1Slots.length)] : null);
  playCardToSlot('p2', currentSlot, card, target);
}
