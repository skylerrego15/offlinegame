import { R } from './rt.js';
import { UI } from './ui-bridge.js';
import {
  S, stats, save, wipe, load, upgradeCost, crewCost, roomCost, crewTotal, roomCount, incomePerSec, fishIncome, sellValue,
  codexMutCount, codexSpecies, omenActive, sigilsAvailable, canOffer, doOffering, ensureContracts,
} from './state.js';
import { UPGRADES, CREW, ROOMS, CREATURES, CREATURE_BY_ID, RARITIES, MUTATIONS, MUT_BY_ID, EGGS, ZONES, OMEN_BY_ID, zoneAt, AQUA_RATE } from './data.js';
import { creatureURL, eggURL } from './assets.js';
import { CAGES, cageIcon, cageBonuses } from './cage.js';
import { VERSION } from './version.js';
import { snapshot } from './gl.js';
import { money, fmt, meters, clamp } from './util.js';
import {
  hatch, sellInst, keepInst, weakestFish, sellAquarium, buyUpgrade, hireCrew, buildRoom, startReel, toShip,
  claimContract, rerollContract, rerollCost, tapVisit, reelSafe, fireHarpoon, COMBO_WINDOW, buyCage,
} from './game.js';
import { startReveal, skipReveal, endReveal, RV, REVEALS } from './reveal.js';
import { layoutShip } from './ship.js';
import { sfxPlay, setSfx, setMusic, initAudio } from './audio.js';
import { floatText, burst } from './fx.js';

const $ = (s) => document.querySelector(s);
const E = {};

export function initUI() {
  for (const id of [
    'hud', 'moneyV', 'incomeV', 'dreadBar', 'dreadV', 'dreadPill', 'omenChip', 'sigilV',
    'diveHud', 'comboV', 'depthV', 'zoneV', 'maxV', 'lineFill', 'eggSlots', 'shieldV', 'luckV', 'reelBtn',
    'reelHud', 'tensionFill', 'safeMark', 'lurkWarn', 'lurkV', 'powerBar', 'powerTrack', 'powerFill', 'powerSafe', 'powerKnob', 'powerV', 'reelDepth', 'reelEggs',
    'shipHud', 'fireBtn', 'nav', 'banner', 'bannerSmall', 'bannerBig', 'bannerLore', 'toasts', 'tip',
    'card', 'cardName', 'cardRar', 'cardTags', 'cardStats', 'cardSell', 'cardKeep', 'cardRest', 'cardCount', 'cardBadge', 'cardStyle',
    'visitBtn', 'sheet', 'sheetTitle', 'sheetBody', 'sheetClose', 'modal',
  ]) E[id] = document.getElementById(id);
  Object.assign(UI, { toast, tip, setMode, zoneBanner, startHaul, omen, visit, refresh: refreshPanel });

  // nav
  E.nav.addEventListener('click', (e) => {
    const b = e.target.closest('[data-panel]');
    if (!b) return;
    sfxPlay('ui');
    openPanel(b.dataset.panel);
  });
  E.sheetClose.addEventListener('click', closePanel);
  E.sheetBody.addEventListener('click', onSheetClick);
  E.sheetBody.addEventListener('change', onSheetChange);
  E.reelBtn.addEventListener('click', () => { if (R.mode === 'dive' && R.hp && R.hp.phase !== 'air') startReel('manual'); });
  E.visitBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); tapVisit(); });
  E.tip.addEventListener('click', () => E.tip.classList.add('hidden'));
  E.dreadPill.addEventListener('click', () => { sfxPlay('ui'); dreadInfo(); });

  // hold-to-aim harpoon button
  let aimX = 0, aimA = 0, aimId = null;
  E.fireBtn.addEventListener('pointerdown', (e) => {
    if (R.mode !== 'ship') return;
    initAudio();
    e.preventDefault();
    aimId = e.pointerId;
    try { E.fireBtn.setPointerCapture(e.pointerId); } catch (_) {}
    aimX = e.clientX; aimA = R.aimAngle;
    R.mode = 'aim';
    E.fireBtn.classList.add('held');
    sfxPlay('aim', 0);
  });
  E.fireBtn.addEventListener('pointermove', (e) => {
    if (R.mode !== 'aim' || e.pointerId !== aimId) return;
    const a = clamp(aimA + (e.clientX - aimX) * 0.006, -0.85, 0.85);
    if (Math.abs(a - R.aimAngle) > 0.05) sfxPlay('aim', a);
    R.aimAngle = a;
  });
  const release = (e) => {
    if (R.mode !== 'aim' || e.pointerId !== aimId) return;
    aimId = null;
    E.fireBtn.classList.remove('held');
    if (e.type === 'pointercancel') { R.mode = 'ship'; return; }
    fireHarpoon();
    if (S.tut < 2) { tip('Drag left and right anywhere on screen — the harpoon follows your finger. Chain eggs back to back: every combo multiplies your range!'); S.tut = 2; }
  };
  E.fireBtn.addEventListener('pointerup', release);
  E.fireBtn.addEventListener('pointercancel', release);

  // power bar
  const setPow = (e) => {
    const r = E.powerTrack.getBoundingClientRect();
    R.power = clamp(1 - (e.clientY - r.top) / r.height, 0, 1);
  };
  let powId = null;
  E.powerBar.addEventListener('pointerdown', (e) => { e.preventDefault(); powId = e.pointerId; try { E.powerBar.setPointerCapture(e.pointerId); } catch (_) {} setPow(e); });
  E.powerBar.addEventListener('pointermove', (e) => { if (e.pointerId === powId) setPow(e); });
  E.powerBar.addEventListener('pointerup', () => (powId = null));
  E.powerBar.addEventListener('pointercancel', () => (powId = null));

  // reveal card
  E.cardSell.addEventListener('click', () => cardAction('sell'));
  E.cardKeep.addEventListener('click', () => cardAction('keep'));
  E.cardRest.addEventListener('click', () => cardAction('rest'));

  setMode('ship');
}

// ---------------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------------
let hudT = 0;
export function updateUI(dt) {
  hudT += dt;
  const st = stats();
  E.moneyV.textContent = money(S.money);
  if (hudT > 0.25) {
    hudT = 0;
    const inc = incomePerSec(st);
    E.incomeV.textContent = inc > 0 ? '+' + money(inc) + '/s' : 'aquarium empty';
    E.dreadBar.style.width = S.dread + '%';
    E.dreadV.textContent = Math.floor(S.dread);
    E.dreadPill.classList.toggle('hot', S.dread >= 60);
    E.dreadPill.classList.toggle('crit', S.dread >= 80);
    E.sigilV.textContent = S.sigils ? '✦ ' + S.sigils : '';
    if (S.omen && omenActive(S.omen)) {
      const o = OMEN_BY_ID[S.omen];
      E.omenChip.classList.remove('hidden');
      E.omenChip.style.borderColor = o.color;
      E.omenChip.innerHTML = `<b style="color:${o.color}">${o.name}</b> · ${o.desc} · ${Math.ceil((S.omenEnd - Date.now()) / 1000)}s`;
    } else E.omenChip.classList.add('hidden');
    if (R.panel) updateAfford();
  }
  const hp = R.hp;
  if ((R.mode === 'dive' || R.mode === 'reel') && hp) {
    const y = Math.max(0, hp.y);
    E.depthV.textContent = meters(y);
    E.zoneV.textContent = zoneAt(y).name;
    E.maxV.textContent = 'line ' + meters(hp.maxDepth);
    E.lineFill.style.height = clamp((y / hp.maxDepth) * 100, 0, 100) + '%';
    const cnt = {};
    for (const t of hp.eggs) cnt[t] = (cnt[t] || 0) + 1;
    let html = '';
    for (let t = 8; t >= 1; t--) if (cnt[t]) html += `<em><img src="${eggURL(t)}" alt="">${cnt[t] > 1 ? '×' + cnt[t] : ''}</em>`;
    if (!html) html = '<small>cage empty</small>';
    if (E.eggSlots._h !== html) { E.eggSlots.innerHTML = html; E.eggSlots._h = html; E.reelEggs.innerHTML = html; }
    E.shieldV.textContent = hp.shields ? '⛨'.repeat(hp.shields) : '';
    if (R.mode === 'dive' && hp.combo > 0) {
      const left = clamp(COMBO_WINDOW - (hp.y - hp.lastHitY), 0, COMBO_WINDOW);
      E.comboV.innerHTML = `CHAIN x${hp.combo} · next egg within ${Math.ceil(left)}m<i><b style="width:${(left / COMBO_WINDOW) * 100}%"></b></i>`;
    } else E.comboV.textContent = '';
    E.luckV.textContent = hp.haulLuck > 0.001 ? '+' + Math.round(hp.haulLuck * 100) + '% haul luck' : '';
    if (R.mode === 'reel') {
      E.tensionFill.style.width = clamp(hp.tension * 100, 0, 100) + '%';
      E.tensionFill.classList.toggle('danger', hp.tension > 0.65);
      const safe = reelSafe();
      E.powerSafe.style.bottom = safe * 100 + '%';
      E.powerFill.style.height = R.power * 100 + '%';
      E.powerKnob.style.bottom = R.power * 100 + '%';
      E.powerV.textContent = Math.round(R.power * 100) + '%';
      E.powerFill.className = R.power > safe ? 'over' : R.power > safe - 0.12 ? 'sweet' : '';
      const L = R.field && R.field.lurker;
      E.lurkWarn.classList.toggle('hidden', !L);
      if (L) E.lurkV.textContent = Math.max(0, Math.floor(L.y - hp.y)) + 'm';
      E.reelDepth.textContent = meters(y) + ' to surface';
    }
  }
  if (R.visit && R.visit.screenX != null && R.visit.phase === 'grab') {
    E.visitBtn.style.left = R.visit.screenX + 'px';
    E.visitBtn.style.top = R.visit.screenY + 'px';
    E.visitBtn.textContent = `STRIKE IT! ${R.visit.taps}/${R.visit.need}`;
  }
}

function setMode(m) {
  E.diveHud.classList.toggle('hidden', m !== 'dive' && m !== 'reel');
  E.reelHud.classList.toggle('hidden', m !== 'reel');
  E.reelBtn.classList.toggle('hidden', m !== 'dive');
  E.eggSlots.classList.toggle('hidden', m === 'reel');
  E.shipHud.classList.toggle('hidden', m !== 'ship');
  E.card.classList.add('hidden');
  if (m !== 'ship') closePanel();
  if (m === 'ship' && S.tut === 0) { tip('Hold the harpoon button, slide your finger to aim, release to fire into the deep.'); S.tut = 1; }
}

function toast(msg, color = '#e8dcc0') {
  const d = document.createElement('div');
  d.className = 'toast';
  d.style.borderColor = color;
  d.innerHTML = `<span style="color:${color}">${msg}</span>`;
  E.toasts.appendChild(d);
  while (E.toasts.children.length > 3) E.toasts.firstChild.remove();
  setTimeout(() => d.classList.add('out'), 2600);
  setTimeout(() => d.remove(), 3100);
}

let tipTimer = 0;
function tip(text) {
  E.tip.textContent = text;
  E.tip.classList.remove('hidden');
  clearTimeout(tipTimer);
  tipTimer = setTimeout(() => E.tip.classList.add('hidden'), 7000);
}

let bannerTimer = 0;
function zoneBanner(z) {
  E.bannerSmall.textContent = `ZONE ${z.index + 1} · ${meters(z.start)}`;
  E.bannerBig.textContent = z.name;
  E.bannerBig.style.color = z.accent;
  E.bannerLore.textContent = z.lore;
  E.banner.classList.remove('hidden', 'out');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => E.banner.classList.add('out'), 2300);
}

function omen(o) {
  E.bannerSmall.textContent = 'AN OMEN';
  E.bannerBig.textContent = o.name;
  E.bannerBig.style.color = o.color;
  E.bannerLore.textContent = o.desc;
  E.banner.classList.remove('hidden', 'out');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => E.banner.classList.add('out'), 3000);
}

function visit(on) {
  E.visitBtn.classList.toggle('hidden', !on);
  if (on) toast('SOMETHING CLIMBS THE HULL — STRIKE IT!', '#ff4d6d');
}

// ---------------------------------------------------------------------------
// Haul reveal flow
// ---------------------------------------------------------------------------
let queue = [], qi = 0, cur = null;
function startHaul() {
  try { snapshot(document.getElementById('cv')); } catch (e) {}
  queue = R.haul.slice(); qi = 0;
  nextEgg();
}
function nextEgg() {
  E.card.classList.add('hidden');
  if (qi >= queue.length) {
    endReveal();
    cur = null;
    save();
    toShip();
    if (S.tut === 3) { tip('Keep creatures in your aquarium for money every second, or sell for cash now. Upgrades are in the bottom bar.'); S.tut = 4; }
    return;
  }
  const tier = queue[qi++];
  const item = hatch(tier, R.haulLuck);
  cur = item;
  const r = item.def.r;
  const special = item.inst.mut || item.first || item.inst.colossal;
  if (S.settings.autoSell >= r && !special) {
    const v = sellInst(item.inst);
    floatText(R.W / 2, R.H * 0.5, `${item.def.name} sold +${money(v)}`, RARITIES[r].color, 16, true, 1.2);
    setTimeout(nextEgg, 260);
    return;
  }
  startReveal(item, () => showCard(item));
  if (S.settings.skipCommon && r <= 1 && !special) skipReveal();
}

function showCard(item) {
  const { def, inst } = item;
  const st = stats();
  const r = def.r;
  if (item.first || item.firstMut) {
    const bonus = sellValue(inst, st) * (item.first ? 2 : 1);
    S.money += bonus; S.lifetime += bonus; S.runEarned += bonus;
    E.cardBadge.textContent = (item.first ? 'NEW SPECIES' : 'NEW VARIANT') + ' · discovery bonus +' + money(bonus);
    E.cardBadge.classList.remove('hidden');
  } else E.cardBadge.classList.add('hidden');
  E.cardName.textContent = def.name;
  E.cardName.style.color = RARITIES[r].color;
  E.cardRar.textContent = RARITIES[r].name.toUpperCase();
  E.cardRar.style.color = RARITIES[r].color;
  let tags = '';
  if (inst.mut) { const m = MUT_BY_ID[inst.mut]; tags += `<span class="tag" style="border-color:${m.color};color:${m.color}">${m.name} x${m.mult}</span>`; }
  if (inst.colossal) tags += '<span class="tag gold">COLOSSAL</span>';
  tags += `<span class="tag">${(def.len * inst.size).toFixed(1)}m</span>`;
  E.cardTags.innerHTML = tags;
  E.cardStyle.textContent = 'reveal: ' + REVEALS[RV.anim];
  const sv = sellValue(inst, st), inc = fishIncome(inst, st);
  E.cardStats.innerHTML = `<i>${def.lore}</i>`;
  E.cardSell.innerHTML = `SELL<b>${money(sv)}</b>`;
  const full = S.aquarium.length >= st.aquaSlots;
  const weak = weakestFish();
  E.cardKeep.disabled = false;
  if (!full) E.cardKeep.innerHTML = `KEEP<b>+${money(inc)}/s</b>`;
  else if (weak && weak.value < inst.value) E.cardKeep.innerHTML = `SWAP<b>sells ${CREATURE_BY_ID[weak.id].name.split(' ').slice(-1)[0]}</b>`;
  else { E.cardKeep.innerHTML = 'TANKS FULL<b>build more</b>'; E.cardKeep.disabled = true; }
  const left = queue.length - qi;
  E.cardCount.textContent = `egg ${qi} of ${queue.length}`;
  E.cardRest.classList.toggle('hidden', left < 1);
  E.cardRest.textContent = `sell this + ${left} more`;
  E.card.classList.remove('hidden');
  E.card.style.setProperty('--rc', RARITIES[r].color);
}

function cardAction(a) {
  if (!cur || !RV.held) return;
  const item = cur;
  if (a === 'sell') {
    sellInst(item.inst);
  } else if (a === 'keep') {
    const st = stats();
    if (S.aquarium.length >= st.aquaSlots) {
      const w = weakestFish();
      if (!w || w.value >= item.inst.value) return;
      sellAquarium(w.uid);
    }
    keepInst(item.inst);
    sfxPlay('buy');
  } else if (a === 'rest') {
    let total = sellInst(item.inst);
    let best = null;
    while (qi < queue.length) {
      const it = hatch(queue[qi++], R.haulLuck);
      if (!best || it.def.r > best.def.r) best = it;
      total += sellInst(it.inst);
    }
    toast(`Sold the rest for ${money(total)}` + (best ? ` (best: ${best.def.name})` : ''), '#ffd34d');
  }
  endReveal();
  cur = null;
  nextEgg();
}

// canvas tap during reveal
export function revealTap() {
  if (RV.active && !RV.held) skipReveal();
}

// ---------------------------------------------------------------------------
// Panels
// ---------------------------------------------------------------------------
const TITLES = { upgrades: 'The Armory', crew: 'Hire Crew', ship: 'Shipwright', aquarium: 'Aquarium', codex: 'Bestiary', contracts: 'Contracts', menu: 'Captain\'s Log' };
function openPanel(name) {
  if (R.mode !== 'ship') return;
  R.panel = name;
  E.sheetTitle.textContent = TITLES[name];
  E.sheet.classList.remove('hidden');
  renderPanel();
  E.sheetBody.scrollTop = 0;
  E.nav.querySelectorAll('[data-panel]').forEach((b) => b.classList.toggle('on', b.dataset.panel === name));
}
function closePanel() {
  R.panel = null;
  E.sheet && E.sheet.classList.add('hidden');
  E.nav && E.nav.querySelectorAll('[data-panel]').forEach((b) => b.classList.remove('on'));
}
function refreshPanel() { if (R.panel) renderPanel(); }

function renderPanel() {
  const fn = { upgrades: pUpgrades, crew: pCrew, ship: pShip, aquarium: pAquarium, codex: pCodex, contracts: pContracts, menu: pMenu }[R.panel];
  const st = E.sheetBody.scrollTop;
  E.sheetBody.innerHTML = fn ? fn() : '';
  E.sheetBody.scrollTop = st;
  updateAfford();
}
function updateAfford() {
  E.sheetBody.querySelectorAll('[data-cost]').forEach((b) => {
    b.classList.toggle('poor', S.money < +b.dataset.cost);
  });
}

function costBtn(act, id, cost, label = '') {
  return `<button class="buy" data-act="${act}" data-id="${id}" data-cost="${cost}">${label}<b>${money(cost)}</b></button>`;
}

function pUpgrades() {
  const st = stats();
  let h = `<p class="sub">Range <b>${meters(st.range)}</b> · Speed <b>${Math.floor(st.speed)} m/s</b> · Luck <b>+${Math.round(st.luck * 100)}%</b></p>`;
  h += `<h4 class="shead">Cages <small>bought cages are kept forever · the equipped cage's boosts apply</small></h4>`;
  CAGES.forEach((cg, i) => {
    const owned = S.cages.includes(i), on = S.cage === i;
    const btn = on ? '<button class="buy" disabled>EQUIPPED</button>' : owned ? `<button class="buy go" data-act="cage" data-id="${i}">EQUIP</button>` : costBtn('cage', i, cg.cost);
    h += `<div class="row cagerow ${on ? 'on' : ''}" style="--cg:${cg.glow || '#8a6440'}"><img class="cimg" src="${cageIcon(i)}" alt=""><div class="info"><b>${cg.name}</b><br><em>${cageBonuses(cg)}</em><br><span>${cg.lore}</span></div>${btn}</div>`;
  });
  h += `<h4 class="shead">Harpoon</h4>`;
  for (const u of UPGRADES) {
    const l = S.upgrades[u.id];
    const maxed = l >= u.max;
    const now = u.show(u.val(l)), next = maxed ? '' : u.show(u.val(l + 1));
    h += `<div class="row"><div class="ic">${u.icon}</div><div class="info"><b>${u.name}</b> <small>Lv ${l}/${u.max}</small><br><span>${u.desc}</span><br><em>${now}${maxed ? ' · MAX' : ' → ' + next}</em></div>
    ${maxed ? '<button class="buy" disabled>MAX</button>' : costBtn('upg', u.id, upgradeCost(u))}</div>`;
  }
  return h;
}

function pCrew() {
  const st = stats();
  const tot = crewTotal();
  let h = `<p class="sub">Beds <b>${tot}/${st.crewCap}</b> · crew efficiency <b>${Math.round(st.eff * 100)}%</b>${st.eff < 1 ? ' (Dread is shaking them)' : ''} · <a class="link" data-act="dread">what is Dread?</a></p>`;
  for (const c of CREW) {
    h += `<div class="row"><div class="ic dot" style="background:${c.color}"></div><div class="info"><b>${c.name}</b> <small>x${S.crew[c.id]}</small><br><span>${c.desc}</span></div>
    ${tot >= st.crewCap ? '<button class="buy" disabled>NO BEDS</button>' : costBtn('crew', c.id, crewCost(c.id), 'HIRE')}</div>`;
  }
  h += `<p class="note">Every hire costs more. Build <b>Crew Bunks</b> in the Shipwright for more beds. Crew live and work in the rooms you build.</p>`;
  return h;
}

function pShip() {
  const cost = roomCost();
  let h = `<p class="sub">${S.rooms.length} rooms across ${Math.ceil(S.rooms.length / 3)} decks · next room <b>${money(cost)}</b></p>`;
  for (const r of ROOMS) {
    h += `<div class="row"><div class="ic room-${r.id}"></div><div class="info"><b>${r.name}</b> <small>x${roomCount(r.id)}</small><br><span>${r.desc}</span></div>${costBtn('room', r.id, cost, 'BUILD')}</div>`;
  }
  h += `<p class="note">The ship grows a new deck every three rooms. Tap any room on the hull to jump here.</p>`;
  return h;
}

function pAquarium() {
  const st = stats();
  let h = `<p class="sub">Tanks <b>${S.aquarium.length}/${st.aquaSlots}</b> · earning <b>${money(incomePerSec(st))}/s</b></p><div class="grid">`;
  for (const f of S.aquarium) {
    const d = CREATURE_BY_ID[f.id];
    const m = f.mut ? MUT_BY_ID[f.mut] : null;
    h += `<div class="fish" style="--rc:${RARITIES[d.r].color}"><img src="${creatureURL(f.id, f.mut)}" alt=""><b>${d.name}</b>
    <small>${m ? `<span style="color:${m.color}">${m.name}</span> · ` : ''}${RARITIES[d.r].name}${f.colossal ? ' · COLOSSAL' : ''}</small>
    <em>+${money(fishIncome(f, st))}/s</em><button class="mini" data-act="sellfish" data-id="${f.uid}">sell ${money(sellValue(f, st))}</button></div>`;
  }
  for (let i = S.aquarium.length; i < st.aquaSlots; i++) h += `<div class="fish empty"><span>empty tank</span></div>`;
  h += `</div><p class="note">Aquarium creatures earn ${Math.round(AQUA_RATE * 1000) / 10}% of their value every second — even while you're away (at half rate, up to 8 hours).</p>`;
  return h;
}

function pCodex() {
  const sp = codexSpecies(), mc = codexMutCount();
  const bonus = Math.round((0.005 * mc + 0.01 * sp) * 1000) / 10;
  let h = `<p class="sub">Species <b>${sp}/${CREATURES.length}</b> · variants <b>${mc}/${CREATURES.length * (MUTATIONS.length + 1)}</b> · codex bonus <b>+${bonus}%</b> to all money</p><div class="grid codex">`;
  for (const c of CREATURES) {
    const cx = S.codex[c.id];
    h += `<button class="tile ${cx ? '' : 'unknown'}" data-act="codex" data-id="${c.id}" style="--rc:${RARITIES[c.r].color}"><img src="${creatureURL(c.id)}" alt=""><b>${cx ? c.name : '???'}</b><small>${RARITIES[c.r].name}</small></button>`;
  }
  h += '</div>';
  return h;
}
function codexDetail(id) {
  const c = CREATURE_BY_ID[id], cx = S.codex[id];
  if (!cx) { toast('Not yet hatched. Its egg waits somewhere below.', '#9fb3b0'); return; }
  const muts = ['normal', ...MUTATIONS.map((m) => m.id)];
  E.modal.innerHTML = `<div class="mbox" style="--rc:${RARITIES[c.r].color}"><img class="big" src="${creatureURL(id)}"><h3>${c.name}</h3><p class="rar">${RARITIES[c.r].name} · ${c.len}m</p><p><i>${c.lore}</i></p>
  <p>Hatched <b>${cx.caught}</b> · best <b>${money(cx.best)}</b></p><div class="muts">${muts.map((m) => {
    const md = MUT_BY_ID[m];
    const has = cx.muts[m];
    return `<div class="mut ${has ? '' : 'no'}"><img src="${has ? creatureURL(id, m === 'normal' ? null : m) : creatureURL(id)}"><small style="color:${md ? md.color : '#ccc'}">${md ? md.name : 'Normal'}</small></div>`;
  }).join('')}</div><button class="btn" data-close>close</button></div>`;
  E.modal.classList.remove('hidden');
  E.modal.onclick = (e) => { if (e.target === E.modal || e.target.closest('[data-close]')) E.modal.classList.add('hidden'); };
}

function pContracts() {
  ensureContracts();
  let h = `<p class="sub">Fulfilled <b>${S.contractsDone}</b> · rewards scale with your deepest zone</p>`;
  for (const c of S.contracts) {
    const done = c.progress >= c.target;
    const pct = clamp((c.progress / c.target) * 100, 0, 100);
    h += `<div class="contract ${done ? 'done' : ''}"><b>${c.desc}</b><div class="pbar"><i style="width:${pct}%"></i></div>
    <small>${c.type === 'sell' ? money(c.progress) + ' / ' + money(c.target) : fmt(c.progress) + ' / ' + fmt(c.target)} · reward <b>${money(c.reward)}</b></small>
    <div class="cbtns">${done ? `<button class="buy go" data-act="claim" data-id="${c.id}">CLAIM</button>` : costBtn('reroll', c.id, rerollCost(), 'REROLL ')}</div></div>`;
  }
  return h;
}

function pMenu() {
  const s = S.settings;
  const tg = (k, label) => `<label class="tg"><input type="checkbox" data-set="${k}" ${s[k] ? 'checked' : ''}><span>${label}</span></label>`;
  const sig = sigilsAvailable();
  let h = `<div class="sect"><h4>Settings</h4>${tg('sfx', 'Sound effects')}${tg('music', 'Ambient drone')}${tg('skipCommon', 'Fast reveals for Common & Uncommon')}
  <label class="tg"><span>Auto-sell up to</span><select data-set="autoSell">${[-1, 0, 1, 2, 3].map((v) => `<option value="${v}" ${s.autoSell === v ? 'selected' : ''}>${v < 0 ? 'Off' : RARITIES[v].name}</option>`).join('')}</select></label>
  <p class="note">Mutated, colossal and newly discovered creatures are never auto-sold.</p></div>`;
  h += `<div class="sect offer"><h4>The Offering</h4><p>Sink your ship, crew and fortune into the deep. In return: <b>Abyssal Sigils</b> — each gives +8% money and +2% luck forever. Your Bestiary is kept.</p>
  <p>Sigils now: <b>✦ ${S.sigils}</b> · you would gain <b>✦ ${sig}</b>${S.stats.maxDepth < ZONES[9].start ? ` (reach Zone 10, ${meters(ZONES[9].start)}, first)` : ''}</p>
  <button class="btn danger" data-act="offer" ${canOffer() ? '' : 'disabled'}>MAKE THE OFFERING</button></div>`;
  const t = S.stats;
  h += `<div class="sect"><h4>Log</h4><div class="stats"><span>Dives</span><b>${t.dives}</b><span>Deepest</span><b>${meters(t.maxDepth)}</b><span>Best combo</span><b>x${t.maxCombo}</b><span>Eggs hauled</span><b>${t.eggs}</b><span>Creatures hatched</span><b>${t.hatched}</b><span>Best creature</span><b>${money(t.bestValue)}</b><span>Lifetime earned</span><b>${money(S.lifetime)}</b><span>Offerings</span><b>${t.offerings}</b></div></div>`;
  h += `<div class="sect"><h4>Install</h4><p class="note">iPhone: Share → <b>Add to Home Screen</b>. After the first load the game plays fully offline.</p>
  <button class="btn ghost" data-act="update">force update</button> <button class="btn ghost" data-act="wipe">erase save</button>
  <p class="note">version ${VERSION}</p></div>`;
  return h;
}

function onSheetClick(e) {
  const b = e.target.closest('[data-act]');
  if (!b || b.disabled) return;
  const id = b.dataset.id;
  switch (b.dataset.act) {
    case 'upg': if (buyUpgrade(id)) flashBtn(b); break;
    case 'cage': if (buyCage(+id)) flashBtn(b); break;
    case 'crew': if (hireCrew(id)) flashBtn(b); break;
    case 'room': if (buildRoom(id)) { flashBtn(b); toast('New room built', '#ffd34d'); } break;
    case 'sellfish': { const v = sellAquarium(+id); toast('Sold for ' + money(v), '#ffd34d'); break; }
    case 'codex': codexDetail(id); return;
    case 'dread': dreadInfo(); return;
    case 'claim': claimContract(id); break;
    case 'reroll': rerollContract(id); break;
    case 'offer':
      E.modal.innerHTML = `<div class="mbox"><h3>Make the Offering?</h3><p>Everything sinks: money, upgrades, crew, rooms, aquarium. You rise again with <b>✦ ${sigilsAvailable()}</b> more Abyssal Sigils.</p><button class="btn danger" data-yes>SINK IT ALL</button><button class="btn ghost" data-close>not yet</button></div>`;
      E.modal.classList.remove('hidden');
      E.modal.onclick = (ev) => {
        if (ev.target.closest('[data-yes]')) {
          const g = doOffering(); layoutShip(); save(); E.modal.classList.add('hidden'); closePanel(); toShip();
          sfxPlay('reveal', 7); toast(`The deep accepts. +✦${g} Abyssal Sigils`, '#c79bff');
        } else if (ev.target === E.modal || ev.target.closest('[data-close]')) E.modal.classList.add('hidden');
      };
      return;
    case 'update':
      save();
      toast('Updating…', '#9fd8c9');
      Promise.resolve()
        .then(() => (navigator.serviceWorker ? navigator.serviceWorker.getRegistrations() : []))
        .then((rs) => Promise.all(rs.map((r) => r.unregister())))
        .then(() => (window.caches ? caches.keys().then((ks) => Promise.all(ks.map((k) => caches.delete(k)))) : 0))
        .catch(() => {})
        .then(() => location.reload());
      return;
    case 'wipe':
      E.modal.innerHTML = `<div class="mbox"><h3>Erase everything?</h3><p>This cannot be undone.</p><button class="btn danger" data-yes>ERASE</button><button class="btn ghost" data-close>cancel</button></div>`;
      E.modal.classList.remove('hidden');
      E.modal.onclick = (ev) => {
        if (ev.target.closest('[data-yes]')) { wipe(); save(); location.reload(); }
        else if (ev.target === E.modal || ev.target.closest('[data-close]')) E.modal.classList.add('hidden');
      };
      return;
  }
  save();
  renderPanel();
}
function onSheetChange(e) {
  const k = e.target.dataset.set;
  if (!k) return;
  if (e.target.type === 'checkbox') S.settings[k] = e.target.checked;
  else S.settings[k] = +e.target.value;
  setSfx(S.settings.sfx); setMusic(S.settings.music);
  save();
}
function flashBtn(b) {
  const r = b.getBoundingClientRect();
  burst(r.left + r.width / 2, r.top + r.height / 2, 14, { scr: true, color: '#ffd34d', speed: 140, life: 0.5 });
}

function dreadInfo() {
  const st = stats();
  const rate = st.dreadRate;
  E.modal.innerHTML = `<div class="mbox" style="--rc:#c0182f"><h3>◉ Dread · ${Math.floor(S.dread)}/100</h3>
  <p>Dread is how much <b>the deep has noticed your ship</b>.</p>
  <p class="dl"><b>It goes up when you:</b><br>· hatch Epic or rarer creatures (rarer = more)<br>· swim past a watching eye<br>· dive below Zone 13<br>· employ Occultists</p>
  <p class="dl"><b>It goes down:</b><br>· slowly on its own<br>· faster with Chaplains and Lantern Shrines<br>· when you fight off a tentacle</p>
  <p class="dl"><b>Why you might want some:</b> every point gives <b style="color:#9dffc8">+0.4% hatch luck</b> (you have +${(S.dread * 0.4).toFixed(0)}% now).</p>
  <p class="dl"><b>Why too much hurts:</b><br>· above <b>60</b>, your crew get shaken and work slower (down to 60%)<br>· at <b>80+</b>, tentacles climb the hull to drag creatures out of your aquarium. Tap them fast to fight them off.</p>
  <p class="note">Right now it's ${rate > 0 ? `<b style="color:#ff4d6d">rising ${(rate * 60).toFixed(1)}</b>` : `<b style="color:#9dffc8">falling ${(-rate * 60).toFixed(1)}</b>`} per minute.</p>
  <button class="btn" data-close>got it</button></div>`;
  E.modal.classList.remove('hidden');
  E.modal.onclick = (e) => { if (e.target === E.modal || e.target.closest('[data-close]')) E.modal.classList.add('hidden'); };
}

export function openPanelFor(roomType) {
  openPanel(roomType === 'tank' ? 'aquarium' : roomType === 'bunk' ? 'crew' : 'ship');
}

export function showOffline(earn, sec) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  E.modal.innerHTML = `<div class="mbox"><h3>While you slept…</h3><p>${h ? h + 'h ' : ''}${m}m passed. Your aquarium earned</p><p class="bigmoney">${money(earn)}</p><button class="btn" data-close>collect</button></div>`;
  E.modal.classList.remove('hidden');
  E.modal.onclick = (e) => { if (e.target.closest('[data-close]') || e.target === E.modal) { E.modal.classList.add('hidden'); sfxPlay('coin'); } };
}
