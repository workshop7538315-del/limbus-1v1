// ui.js — デッキ構築画面・バトル画面のDOM描画

function toggleFilter() {
  const panel = document.getElementById('filter-panel');
  panel.classList.toggle('open');
  document.getElementById('filter-arrow').innerText = panel.classList.contains('open') ? '▲' : '▼';
}
function setFilter(filter, event) {
  currentFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
  if (event) event.target.classList.add('active');
  renderBuilder();
}
function coreAccordionKey(owner, coreId) { return owner + ':' + coreId; }
function toggleCoreAccordion(owner, coreId, event) { event.stopPropagation(); const key = coreAccordionKey(owner, coreId); coreAccordionOpen[key] = !coreAccordionOpen[key]; renderBuilder(); }
function toggleDeckAccordion(player, event) { event.stopPropagation(); deckAccordionOpen[player] = !deckAccordionOpen[player]; renderBuilder(); }
function setActiveDeckEditor(player) { activeDeckEditor = player; renderBuilder(); }
function compareCardsByCostThenName(a, b) { return a.cost - b.cost || a.name.localeCompare(b.name, 'ja'); }
function getGroupedSortedDeck(deckIds) {
  const counts = {};
  deckIds.forEach(id => counts[id] = (counts[id] || 0) + 1);
  return Object.keys(counts).map(id => ({ card: CARD_DATABASE.find(c => c.id === id), count: counts[id] })).filter(x => x.card).sort((a,b) => compareCardsByCostThenName(a.card,b.card));
}
function togglePoolAccordion(cardId, event) { event.stopPropagation(); poolAccordionOpen[cardId] = !poolAccordionOpen[cardId]; renderBuilder(); }

function renderCoreSelectionList(elementId, selectedArray, toggleSelectFunc, owner) {
  const container = document.getElementById(elementId); container.innerHTML = '';
  CORE_PAGES.forEach(core => {
    const isSelected = selectedArray.includes(core.id);
    const isOpen = !!coreAccordionOpen[coreAccordionKey(owner, core.id)];
    const div = document.createElement('div'); div.className = 'core-card-item' + (isSelected ? ' selected' : '');
    div.innerHTML = `
      <div class="core-card-header"><div><strong style="color:#f39c12;">${core.name}</strong> (${core.speedDiceCount}速度ダイス)</div>
      <span onclick="toggleCoreAccordion('${owner}','${core.id}',event)" style="color:#2980b9;font-weight:bold;padding:2px 6px;">${isOpen?'▲ 詳細閉じる':'▼ 詳細開く'}</span></div>
      <div class="core-card-detail ${isOpen?'open':''}">
        <div>HP: ${core.hp} / 混乱耐性: ${core.stagger} / 最大光: ${core.maxLight} / 速度: ${core.speedMin}～${core.speedMax}</div>
        <div style="margin-top:2px;">パッシブ: <strong>${core.passiveName}</strong> - ${core.passiveDesc}</div>
        <div class="res-group"><span class="res-tag ${getResText(core.res.slash).class}">斬:${getResText(core.res.slash).text}</span><span class="res-tag ${getResText(core.res.pierce).class}">突:${getResText(core.res.pierce).text}</span><span class="res-tag ${getResText(core.res.blunt).class}">打:${getResText(core.res.blunt).text}</span></div>
      </div>`;
    div.onclick = () => toggleSelectFunc(core.id); container.appendChild(div);
  });
}
function toggleP1Core(id) { if (selectedP1CoreIds.includes(id)) { if (selectedP1CoreIds.length>1) selectedP1CoreIds=selectedP1CoreIds.filter(i=>i!==id); } else selectedP1CoreIds.push(id); renderBuilder(); }
function toggleP2Core(id) { if (selectedP2CoreIds.includes(id)) { if (selectedP2CoreIds.length>1) selectedP2CoreIds=selectedP2CoreIds.filter(i=>i!==id); } else selectedP2CoreIds.push(id); renderBuilder(); }
function addBatchCards(cardId, amount, event) {
  event.stopPropagation(); const targetDeck = decks[activeDeckEditor], currentCount = targetDeck.filter(id=>id===cardId).length, card=CARD_DATABASE.find(c=>c.id===cardId), label=activeDeckEditor==='p1'?'P1':'P2';
  let added=0; for(let i=0;i<amount;i++){ if(targetDeck.length>=9){ alert(`${label}のデッキは最大9枚までです。`); break; } if(currentCount+added>=3){ alert(`${label}の同名ページ「${card.name}」は最大3枚までです。`); break; } targetDeck.push(cardId); added++; } renderBuilder();
}
function removeCardFromDeck(player, cardId, event) { event.stopPropagation(); const deck=decks[player], i=deck.lastIndexOf(cardId); if(i!==-1) deck.splice(i,1); renderBuilder(); }
function renderDeckList(player) {
  const deckList=document.getElementById(`${player}-deck-list`); deckList.innerHTML=''; deckList.classList.toggle('collapsed',!deckAccordionOpen[player]);
  getGroupedSortedDeck(decks[player]).forEach(item=>{
    const div=document.createElement('div'); div.className='deck-item-card';
    div.innerHTML=`<div class="deck-item-info"><strong>${item.card.name}</strong> <span class="deck-item-count">[×${item.count}]</span><small style="color:#aaa;"> (コスト:${item.card.cost})</small></div><button class="remove-btn" onclick="removeCardFromDeck('${player}','${item.card.id}',event)">×</button>`;
    div.onclick=e=>removeCardFromDeck(player,item.card.id,e); deckList.appendChild(div);
  });
  document.getElementById(`${player}-deck-count`).innerText=decks[player].length;
  document.getElementById(`${player}-deck-arrow`).innerText=deckAccordionOpen[player]?'▲':'▼';
  const section=document.getElementById(`${player}-deck-section`), badge=document.getElementById(`${player}-editing-badge`);
  section.classList.toggle('editing',activeDeckEditor===player); badge.classList.toggle('hidden',activeDeckEditor!==player);
}

const SKILL_TYPE_LABELS={attack:'攻撃',defense:'防御',evade:'回避',counter:'反撃',counter_clash:'マッチ可能反撃'};
function getSkillTypeLabel(skill){ return SKILL_TYPE_LABELS[skill?.skillType] || skill?.skillType || ''; }
function getSkillIconPath(skill){
  if(skill?.skillType==='evade') return 'assets/dice_icons/evade.png';
  if(skill?.skillType==='defense') return 'assets/dice_icons/block.png';
  if(skill?.skillType==='counter') return `assets/dice_icons/counter_${skill.attackType || 'blunt'}.png`;
  if(skill?.skillType==='attack') return `assets/dice_icons/attack_${skill.attackType}.png`;
  if(skill?.legacyDice?.[0]){ const d=skill.legacyDice[0]; return `assets/dice_icons/counter_clash_${d.attackType||'blunt'}.png`; }
  return '';
}
function getSkillDisplayLabel(skill){ const icon=getSkillIconPath(skill); const type=skill?.skillType==='counter_clash'?'マッチ可能反撃':`${getSkillTypeLabel(skill)}${skill.attackType?`（${{slash:'斬撃',pierce:'貫通',blunt:'打撃'}[skill.attackType]||skill.attackType}）`:''}`; return icon?`<img class="dice-icon" src="${icon}" alt="">${type}`:type; }
function getSkillPowerText(skill){ if(!skill) return ''; if(!skill.coinCount) return 'コインなし（特殊反撃）'; const cp=skill.coinPower>=0?`+${skill.coinPower}`:`${skill.coinPower}`; return `基礎${skill.basePower} / コイン${cp} ×${skill.coinCount}`; }
function getCardUseEffectTexts(card){ if(!card?.effect) return []; return card.effect.split('。').map(x=>x.trim()).filter(x=>x.includes('使用時')).map(x=>x+'。'); }
function getCardLogTooltipHtml(card){ const t=getCardUseEffectTexts(card); return t.length?`<span class="tooltip-text log-card-tooltip-text"><div class="card-effect">${t.join('<br>')}</div></span>`:''; }
function formatCardNameWithTooltip(card){ const t=getCardLogTooltipHtml(card); return t?`<span class="tooltip-target log-card-tooltip">${card.name}${t}</span>`:card.name; }
function skillDetailHtml(card){
  if(!card) return '';
  const coins=(card.coins||[]).map((c,i)=>{ const t=getSkillHitEffectTexts(card,c); return `<span class="coin-chip">● ${i+1}${t.length?`<small>${t.join('<br>')}</small>`:''}</span>`; }).join(' ');
  const legacy=(card.legacyDice||[]).map(d=>`<span class="dice-tag counter_clash">${getSkillDisplayLabel({skillType:'counter_clash',legacyDice:[d]})} ${d.min}～${d.max}</span>`).join(' ');
  const legacyCounter=(card.counterDice||[]).map(d=>`<span class="dice-tag counter">${getSkillDisplayLabel({skillType:'counter',attackType:d.attackType||'blunt'})} ${d.min}～${d.max}</span>`).join(' ');
  return `<div class="skill-line"><strong>${getSkillDisplayLabel(card)}</strong> <span class="sin-badge sin-${card.sin}">${getSinLabel(card.sin)}</span></div>${card.coinCount?`<div class="skill-power-line">${getSkillPowerText(card)}</div><div class="card-dice-list">${coins}</div>`:''}${legacy?`<div class="card-dice-list">${legacy}</div>`:''}${legacyCounter?`<div class="card-dice-list">${legacyCounter}</div>`:''}`;
}

function toggleEgoLoadout(player, egoId) {
  const ego = EGO_DATABASE.find(e => e.id === egoId);
  if (!ego) return;
  const loadout = player === 'p1' ? selectedP1EgoIds : selectedP2EgoIds;
  loadout[ego.risk] = loadout[ego.risk] === egoId ? null : egoId;
  renderBuilder();
}
function renderEgoLoadout(player) {
  const el = document.getElementById(`${player}-ego-loadout`);
  if (!el) return;
  const loadout = player === 'p1' ? selectedP1EgoIds : selectedP2EgoIds;
  el.innerHTML = EGO_RISK_LEVELS.map(risk => {
    const equippedId = loadout[risk];
    const available = EGO_DATABASE.filter(e => e.risk === risk);
    const equipped = equippedId ? EGO_DATABASE.find(e => e.id === equippedId) : null;
    const options = available.length ? available.map(ego => {
      const selected = ego.id === equippedId;
      const res = Object.entries(ego.sinRes || {}).map(([sin,v]) => `${getSinLabel(sin)}×${v}`).join(' ');
      const cost = Object.entries(ego.resourceCost || {}).map(([sin,n]) => `${getSinLabel(sin)}×${n}`).join(' ');
      return `<button class="ego-loadout-option ${selected?'selected':''} sin-${ego.sin}" onclick="toggleEgoLoadout('${player}','${ego.id}')"><strong>${ego.name}</strong><small>${ego.sinner} / ${getSinLabel(ego.sin)}</small><small>資源: ${cost}</small><small>耐性: ${res}</small></button>`;
    }).join('') : '<div class="ego-empty">未実装</div>';
    return `<div class="ego-risk-slot"><div class="ego-risk-label">${risk}</div><div class="ego-risk-content">${equipped ? `<span class="ego-equipped-mark">装備: ${equipped.name}</span>` : '<span class="ego-none">未装備</span>'}${options}</div></div>`;
  }).join('');
}
function renderEgoResourcePanel(player) {
  const el=document.getElementById(`${player}-ego-resources`);
  if(!el)return;
  el.innerHTML=SIN_TYPES.map(sin=>`<span class="ego-resource sin-${sin}" title="${getSinLabel(sin)}">${getSinLabel(sin).slice(0,1)}<b>${gameState[player].egoResources?.[sin]||0}</b></span>`).join('');
}

function renderHand(){
  const handDiv=document.getElementById('p1-hand'); handDiv.innerHTML=''; const currentSlot=getCurrentPlanningSlot(); if(!currentSlot||currentSlot.owner!=='p1')return;
  renderEgoCards(handDiv);
  gameState.p1.hand.forEach(card=>{ const cardEl=document.createElement('div'),selected=selectedHandCard===card; cardEl.className='card'+(selected?' selected':'');
    cardEl.innerHTML=`<strong>${card.name}</strong><br><small>コスト: ${card.cost} / ${getSinLabel(card.sin)} / 表率: ${getHeadsChance('p1')}%</small><div class="skill-power-line">${getSkillPowerText(card)}</div>${card.effect?`<div class="card-effect">${card.effect}</div>`:''}<hr>${skillDetailHtml(card)}`;
    cardEl.onclick=()=>{ if(!card.isEgo && gameState.p1.light<card.cost)return alert('光が不足しています！'); selectedHandCard=selected?null:card; if(!selectedHandCard)selectedTargetSlot=null; else if(selectedHandCard.skillType==='counter')selectedTargetSlot=null; else if(gameState.p2.slots.length===1)selectedTargetSlot=gameState.p2.slots[0]; else if(selectedTargetSlot&&!gameState.p2.slots.includes(selectedTargetSlot))selectedTargetSlot=null; renderHand();updatePlanningPrompt();updateUI();}; handDiv.appendChild(cardEl); });
}
function renderStatusEffects(player){
  const buff=document.getElementById(`${player}-buff-box`),debuff=document.getElementById(`${player}-debuff-box`);
  if(!buff||!debuff)return;
  buff.innerHTML='';debuff.innerHTML='';
  Object.values(gameState[player].statuses||{}).forEach(status=>{
    if(!status||status.count<=0)return;
    const box=status.category==='debuff'?debuff:buff,def=STATUS_DEFINITIONS[status.id],value=def?.valueFromCount?status.count:(status.power||0);
    const badge=document.createElement('span');
    badge.className=`status-badge ${status.category==='debuff'?'status-debuff':'status-buff'}`;
    const valueText=def?.valueFromCount?String(value):`${value}/${status.count}`;
    badge.innerHTML=`${status.name} ${valueText}<span class="tooltip-text status-tooltip">${getStatusTooltip(status)}</span>`;
    box.appendChild(badge);
  });
  if(!buff.children.length)buff.innerHTML='<span class="status-empty">なし</span>';
  if(!debuff.children.length)debuff.innerHTML='<span class="status-empty">なし</span>';
}

function updateUI(){
  ['p1','p2'].forEach(p=>{
    const s=gameState[p]; document.getElementById(`${p}-hp`).innerText=s.hp;document.getElementById(`${p}-maxhp`).innerText=s.maxHp;document.getElementById(`${p}-hp-bar`).style.width=`${s.maxHp?(s.hp/s.maxHp)*100:0}%`;
    document.getElementById(`${p}-sanity`).innerText=s.sanity;document.getElementById(`${p}-sanity-bar`).style.width=`${((s.sanity+45)/90)*100}%`;
    const nextThreshold=getNextStaggerThreshold(p); document.getElementById(`${p}-stagger`).innerText=nextThreshold===null?'なし':nextThreshold; document.getElementById(`${p}-maxstagger`).innerText=`Lv${(s.staggerLevel||0)+1}`; document.getElementById(`${p}-stagger-bar`).style.width=`${nextThreshold===null?0:Math.min(100,(nextThreshold/s.maxHp)*100)}%`;
    document.getElementById(`${p}-light`).innerText=s.light;document.getElementById(`${p}-maxlight`).innerText=s.maxLight;renderStatusEffects(p);renderEgoResourcePanel(p);
    document.getElementById(`${p}-box`).classList.toggle('staggered',s.isStaggered);
    const slotsDiv=document.getElementById(`${p}-speed-slots`); slotsDiv.innerHTML=`<div class="speed-range-label">速度範囲: ${s.core.speedMin}～${s.core.speedMax}</div>`;
    if(s.isStaggered){slotsDiv.innerHTML+='<div class="speed-slot staggered-slot">混乱中 (行動不能)</div>';return;}
    const cur=getCurrentPlanningSlot(),targeting=isP1Planning()&&selectedHandCard&&p==='p2';
    s.slots.forEach((slot,idx)=>{ const active=cur&&cur.owner===p&&cur.id===slot.id,target=selectedTargetSlot===slot; const targetDesc=slot.targetSlot?`<br><small>→ ${slotLabel(slot.targetSlot)}</small>`:(slot.card?'<br><small>→ 一方攻撃</small>':''); const cardDesc=slot.card?`<br><small style="color:#2ecc71" class="tooltip-target">${slot.card.name}<span class="tooltip-text"><div class="card-effect">${slot.card.effect||''}</div>${skillDetailHtml(slot.card)}</span></small>`:''; const el=document.createElement('div');el.className='speed-slot';if(active)el.classList.add('active-slot');if(targeting)el.classList.add('targetable');if(target)el.classList.add('targeting');el.innerHTML=`速度ダイス${idx+1}<br><strong>速度: ${slot.speed}</strong>${cardDesc}${targetDesc}`;if(targeting)el.onclick=()=>selectTargetSlot(slot);slotsDiv.appendChild(el);});
  });
}
function startRoundLogBlock(round){const logDiv=document.getElementById('log'),block=document.createElement('div');block.className='log-round';block.innerHTML=`<div class="log-round-title">第${round}幕</div><div class="log-round-body"></div>`;logDiv.appendChild(block);logDiv.scrollTop=logDiv.scrollHeight;}
function log(msg){const logDiv=document.getElementById('log');let body=logDiv.querySelector('.log-round:last-child .log-round-body');if(!body){startRoundLogBlock(gameState.round||1);body=logDiv.querySelector('.log-round:last-child .log-round-body');}const entry=document.createElement('div');entry.className='log-entry';entry.innerHTML=msg;body.appendChild(entry);logDiv.scrollTop=logDiv.scrollHeight;}
function formatSkillList(card){ if(!card)return ''; const coins=(card.coins||[]).map((c,i)=>{const effects=getSkillHitEffectTexts(card,c);return `<span class="log-dice-tag attack"><span class="coin-dot">${i+1}</span> ${card.coinPower>=0?`+${card.coinPower}`:card.coinPower}${effects.length?`<span class="tooltip-text log-dice-tooltip-text">${effects.join('<br>')}</span>`:''}</span>`;}).join(' '); return coins||((card.legacyDice||[]).map(d=>`<span class="log-dice-tag counter_clash">${d.min}～${d.max}</span>`).join(' ')); }
function logClashSummary(slotA,slotB){const logDiv=document.getElementById('log');let body=logDiv.querySelector('.log-round:last-child .log-round-body');if(!body){startRoundLogBlock(gameState.round||1);body=logDiv.querySelector('.log-round:last-child .log-round-body');}const entry=document.createElement('div');entry.className='log-entry log-clash-entry';entry.innerHTML=`<div class="log-clash-title">[マッチ]</div><div class="log-clash-sides"><div><strong>${playerLabel(slotA.owner)}</strong> 速度${slotA.speed}「${formatCardNameWithTooltip(slotA.card)}」<div class="log-clash-dice">${formatSkillList(slotA.card)}</div></div><div class="log-clash-vs">VS</div><div><strong>${playerLabel(slotB.owner)}</strong> 速度${slotB.speed}「${formatCardNameWithTooltip(slotB.card)}」<div class="log-clash-dice">${formatSkillList(slotB.card)}</div></div></div>`;body.appendChild(entry);logDiv.scrollTop=logDiv.scrollHeight;}function renderEgoCards(handDiv) {
  gameState.p1.equippedEgos?.forEach(ego => {
    const card = makeEgoCard(ego);
    const selected = selectedHandCard?.egoId === ego.id;
    const canUse = canPayEgoResource('p1', ego.resourceCost) && !gameState.p1.usedEgosThisTurn?.includes(ego.id);
    const cardEl = document.createElement('div');
    cardEl.className = `card ego-card sin-${ego.sin}${selected?' selected':''}${canUse?'':' unavailable'}`;
    const costs = Object.entries(ego.resourceCost || {}).map(([sin,n]) => `${getSinLabel(sin)}×${n}`).join(' ');
    const power = `${ego.basePower}～${ego.basePower + ego.coinPower}`;
    const coinText = `${ego.coinCount}コイン / コイン威力+${ego.coinPower}`;
    const corrosion = ego.corrosion ? `
      <div class="ego-detail-block">
        <b>侵蝕</b><br>
        威力: ${ego.corrosion.basePower}～${ego.corrosion.basePower + ego.corrosion.coinPower}
        / ${ego.corrosion.coinCount}コイン / コイン威力+${ego.corrosion.coinPower}<br>
        ${ego.corrosion.effect || '侵蝕スキル'}
      </div>` : '';
    cardEl.innerHTML = `
      <strong>E.G.O: ${ego.id === 'ego_crows_eye_view' ? '烏瞰図' : ego.id === 'ego_chains_of_others' ? '他人の鎖' : ego.name}</strong>
      <br><small>${ego.sinner} / ${ego.risk}</small>
      <details class="ego-card-details" onclick="event.stopPropagation()">
        <summary>効果・威力を見る</summary>
        <div class="ego-detail-content">
          <div><b>威力:</b> ${power}　<b>${coinText}</b></div>
          <div><b>攻撃:</b> ${ego.attackType === 'slash' ? '斬撃' : ego.attackType === 'pierce' ? '貫通' : ego.attackType === 'blunt' ? '打撃' : ego.attackType}</div>
          <div><b>罪悪資源:</b> ${costs}</div>
          <div><b>精神:</b> -${ego.sanityCost}</div>
          <div class="ego-detail-block"><b>効果</b><br>${ego.effect || '追加効果なし'}</div>
          ${corrosion}
        </div>
      </details>
      ${gameState.p1.usedEgosThisTurn?.includes(ego.id)?'<div class="ego-used-label">この幕は使用済み</div>':''}`;
    cardEl.onclick = (event) => {
      if (event.target.closest('details')) return;
      if (!canUse) return;
      selectedHandCard = selected ? null : card;
      selectedTargetSlot = null;
      if (selectedHandCard && gameState.p2.slots.length === 1) selectedTargetSlot = gameState.p2.slots[0];
      renderHand(); updatePlanningPrompt(); updateUI();
    };
    handDiv.appendChild(cardEl);
  });
}
function renderEgoResourcePanel(player) {
  const el=document.getElementById(`${player}-ego-resources`);
  if(!el)return;
  el.innerHTML=SIN_TYPES.map(sin=>`<span class="ego-resource sin-${sin}" title="${getSinLabel(sin)}">${getSinLabel(sin).slice(0,1)}<b>${gameState[player].egoResources?.[sin]||0}</b></span>`).join('');
}

function renderHand(){
  const handDiv=document.getElementById('p1-hand'); handDiv.innerHTML=''; const currentSlot=getCurrentPlanningSlot(); if(!currentSlot||currentSlot.owner!=='p1')return;
  renderEgoCards(handDiv);
  gameState.p1.hand.forEach(card=>{ const cardEl=document.createElement('div'),selected=selectedHandCard===card; cardEl.className='card'+(selected?' selected':'');
    cardEl.innerHTML=`<strong>${card.name}</strong><br><small>コスト: ${card.cost} / ${getSinLabel(card.sin)} / 表率: ${getHeadsChance('p1')}%</small><div class="skill-power-line">${getSkillPowerText(card)}</div>${card.effect?`<div class="card-effect">${card.effect}</div>`:''}<hr>${skillDetailHtml(card)}`;
    cardEl.onclick=()=>{ if(!card.isEgo && gameState.p1.light<card.cost)return alert('光が不足しています！'); selectedHandCard=selected?null:card; if(!selectedHandCard)selectedTargetSlot=null; else if(selectedHandCard.skillType==='counter')selectedTargetSlot=null; else if(gameState.p2.slots.length===1)selectedTargetSlot=gameState.p2.slots[0]; else if(selectedTargetSlot&&!gameState.p2.slots.includes(selectedTargetSlot))selectedTargetSlot=null; renderHand();updatePlanningPrompt();updateUI();}; handDiv.appendChild(cardEl); });
}
function renderStatusEffects(player){
  const buff=document.getElementById(`${player}-buff-box`),debuff=document.getElementById(`${player}-debuff-box`);
  if(!buff||!debuff)return;
  buff.innerHTML='';debuff.innerHTML='';
  Object.values(gameState[player].statuses||{}).forEach(status=>{
    if(!status||status.count<=0)return;
    const box=status.category==='debuff'?debuff:buff,def=STATUS_DEFINITIONS[status.id],value=def?.valueFromCount?status.count:(status.power||0);
    const badge=document.createElement('span');
    badge.className=`status-badge ${status.category==='debuff'?'status-debuff':'status-buff'}`;
    const valueText=def?.valueFromCount?String(value):`${value}/${status.count}`;
    badge.innerHTML=`${status.name} ${valueText}<span class="tooltip-text status-tooltip">${getStatusTooltip(status)}</span>`;
    box.appendChild(badge);
  });
  if(!buff.children.length)buff.innerHTML='<span class="status-empty">なし</span>';
  if(!debuff.children.length)debuff.innerHTML='<span class="status-empty">なし</span>';
}

function updateUI(){
  ['p1','p2'].forEach(p=>{
    const s=gameState[p]; document.getElementById(`${p}-hp`).innerText=s.hp;document.getElementById(`${p}-maxhp`).innerText=s.maxHp;document.getElementById(`${p}-hp-bar`).style.width=`${s.maxHp?(s.hp/s.maxHp)*100:0}%`;
    document.getElementById(`${p}-sanity`).innerText=s.sanity;document.getElementById(`${p}-sanity-bar`).style.width=`${((s.sanity+45)/90)*100}%`;
    const nextThreshold=getNextStaggerThreshold(p); document.getElementById(`${p}-stagger`).innerText=nextThreshold===null?'なし':nextThreshold; document.getElementById(`${p}-maxstagger`).innerText=`Lv${(s.staggerLevel||0)+1}`; document.getElementById(`${p}-stagger-bar`).style.width=`${nextThreshold===null?0:Math.min(100,(nextThreshold/s.maxHp)*100)}%`;
    document.getElementById(`${p}-light`).innerText=s.light;document.getElementById(`${p}-maxlight`).innerText=s.maxLight;renderStatusEffects(p);renderEgoResourcePanel(p);
    document.getElementById(`${p}-box`).classList.toggle('staggered',s.isStaggered);
    const slotsDiv=document.getElementById(`${p}-speed-slots`); slotsDiv.innerHTML=`<div class="speed-range-label">速度範囲: ${s.core.speedMin}～${s.core.speedMax}</div>`;
    if(s.isStaggered){slotsDiv.innerHTML+='<div class="speed-slot staggered-slot">混乱中 (行動不能)</div>';return;}
    const cur=getCurrentPlanningSlot(),targeting=isP1Planning()&&selectedHandCard&&p==='p2';
    s.slots.forEach((slot,idx)=>{ const active=cur&&cur.owner===p&&cur.id===slot.id,target=selectedTargetSlot===slot; const targetDesc=slot.targetSlot?`<br><small>→ ${slotLabel(slot.targetSlot)}</small>`:(slot.card?'<br><small>→ 一方攻撃</small>':''); const cardDesc=slot.card?`<br><small style="color:#2ecc71" class="tooltip-target">${slot.card.name}<span class="tooltip-text"><div class="card-effect">${slot.card.effect||''}</div>${skillDetailHtml(slot.card)}</span></small>`:''; const el=document.createElement('div');el.className='speed-slot';if(active)el.classList.add('active-slot');if(targeting)el.classList.add('targetable');if(target)el.classList.add('targeting');el.innerHTML=`速度ダイス${idx+1}<br><strong>速度: ${slot.speed}</strong>${cardDesc}${targetDesc}`;if(targeting)el.onclick=()=>selectTargetSlot(slot);slotsDiv.appendChild(el);});
  });
}
function startRoundLogBlock(round){const logDiv=document.getElementById('log'),block=document.createElement('div');block.className='log-round';block.innerHTML=`<div class="log-round-title">第${round}幕</div><div class="log-round-body"></div>`;logDiv.appendChild(block);logDiv.scrollTop=logDiv.scrollHeight;}
function log(msg){const logDiv=document.getElementById('log');let body=logDiv.querySelector('.log-round:last-child .log-round-body');if(!body){startRoundLogBlock(gameState.round||1);body=logDiv.querySelector('.log-round:last-child .log-round-body');}const entry=document.createElement('div');entry.className='log-entry';entry.innerHTML=msg;body.appendChild(entry);logDiv.scrollTop=logDiv.scrollHeight;}
function formatSkillList(card){ if(!card)return ''; const coins=(card.coins||[]).map((c,i)=>{const effects=getSkillHitEffectTexts(card,c);return `<span class="log-dice-tag attack"><span class="coin-dot">${i+1}</span> ${card.coinPower>=0?`+${card.coinPower}`:card.coinPower}${effects.length?`<span class="tooltip-text log-dice-tooltip-text">${effects.join('<br>')}</span>`:''}</span>`;}).join(' '); return coins||((card.legacyDice||[]).map(d=>`<span class="log-dice-tag counter_clash">${d.min}～${d.max}</span>`).join(' ')); }
function logClashSummary(slotA,slotB){const logDiv=document.getElementById('log');let body=logDiv.querySelector('.log-round:last-child .log-round-body');if(!body){startRoundLogBlock(gameState.round||1);body=logDiv.querySelector('.log-round:last-child .log-round-body');}const entry=document.createElement('div');entry.className='log-entry log-clash-entry';entry.innerHTML=`<div class="log-clash-title">[マッチ]</div><div class="log-clash-sides"><div><strong>${playerLabel(slotA.owner)}</strong> 速度${slotA.speed}「${formatCardNameWithTooltip(slotA.card)}」<div class="log-clash-dice">${formatSkillList(slotA.card)}</div></div><div class="log-clash-vs">VS</div><div><strong>${playerLabel(slotB.owner)}</strong> 速度${slotB.speed}「${formatCardNameWithTooltip(slotB.card)}」<div class="log-clash-dice">${formatSkillList(slotB.card)}</div></div></div>`;body.appendChild(entry);logDiv.scrollTop=logDiv.scrollHeight;}
