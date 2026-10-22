import { R } from './rt.js';
import { UI } from './ui-bridge.js';
import {
  S, stats, save, wipe, load, upgradeCost, crewCost, roomCost, crewTotal, roomCount, incomePerSec, fishIncome, sellValue,
  codexMutCount, codexSpecies, omenActive, sigilsAvailable, canOffer, doOffering, ensureContracts, eggValue, eggTotal,
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
  sellFish, fishToBag, fishToTank, equipBest, sellAllStored, sellEggs, storeEggs, takeEggs,
} from './game.js';
import { startReveal, skipReveal, endReveal, RV, REVEALS } from './reveal.js';
import { layoutShip } from './ship.js';
import { sfxPlay, setSfx, setMusic, initAudio, vibrate } from './audio.js';
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
    'haul', 'haulTitle', 'haulSub', 'haulBody', 'haulClose', 'haulSellAll', 'fly', 'app', 'eggBadge', 'jobBadge', 'moneyPill',
  ]) E[id] = document.getElementById(id);
  Object.assign(UI, { toast, tip, setMode, zoneBanner, startHaul: () => {}, omen, visit, refresh: refreshPanel, showHaul, eggFly });

  // haul screen
  E.haul.addEventListener('click', onHaulClick);
  E.haulClose.addEventListener('click', () => haulAction('storeall', null, E.haulClose));
  // tactile feedback on every button
  document.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    if (S.settings.haptics) vibrate(8);
    b.classList.remove('pressed'); void b.offsetWidth; b.classList.add('pressed');
  }, true);

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
let hudT = 0, shownMoney = null, prevMoney = null, pendGain = 0, gainT = 0, lastEggs = -1;
export function updateUI(dt) {
  hudT += dt;
  const st = stats();
  if (shownMoney === null) { shownMoney = S.money; prevMoney = S.money; }
  const inc0 = incomePerSec(st);
  const d = S.money - prevMoney;
  prevMoney = S.money;
  if (d > Math.max(1, inc0 * 0.6)) pendGain += d;
  gainT += dt;
  if (pendGain > 0 && gainT > 0.18) { popGain(pendGain); pendGain = 0; gainT = 0; }
  shownMoney += (S.money - shownMoney) * (1 - Math.exp(-dt * 10));
  if (Math.abs(S.money - shownMoney) < 0.5 || S.money < shownMoney) shownMoney = S.money;
  E.moneyV.textContent = money(shownMoney);
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
    const eggs = eggTotal();
    E.eggBadge.textContent = eggs ? fmt(eggs) : '';
    E.eggBadge.classList.toggle('hidden', !eggs);
    if (lastEggs >= 0 && eggs > lastEggs) bump(E.eggBadge);
    lastEggs = eggs;
    const claim = S.contracts.filter((c) => c.progress >= c.target).length;
    E.jobBadge.textContent = claim || '';
    E.jobBadge.classList.toggle('hidden', !claim);
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
  E.shipHud.classList.toggle('hidden', m !== 'ship' && m !== 'haul');
  E.fireBtn.classList.toggle('hidden', m !== 'ship');
  E.nav.classList.toggle('locked', m === 'haul');
  E.haul.classList.toggle('hidden', m !== 'haul');
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
let queue = [], qi = 0, cur = null, hatchLuck = 0, hatchBack = null;
// hatch a list of egg tiers one after another, then go back to where we came from
function hatchQueue(list, luck, back) {
  if (!list.length) return;
  closePanel();
  try { snapshot(document.getElementById('cv')); } catch (e) {}
  queue = list.slice().sort((a, b) => a - b); qi = 0;
  hatchLuck = luck; hatchBack = back;
  R.mode = 'reveal';
  setMode('reveal');
  nextEgg();
}
function nextEgg() {
  E.card.classList.add('hidden');
  if (qi >= queue.length) {
    endReveal();
    cur = null;
    save();
    if (hatchBack === 'haul' && eggTotal(R.haulEggs || {}) > 0) {
      R.mode = 'haul';
      setMode('haul');
      showHaul(false);
    } else {
      toShip();
      if (hatchBack === 'eggs' && eggTotal() > 0) openPanel('eggs');
    }
    if (S.tut === 3) { tip('Keep creatures for money every second, or sell for cash now. Eggs you store wait in the Eggs tab.'); S.tut = 4; }
    return;
  }
  const tier = queue[qi++];
  const item = hatch(tier, hatchLuck);
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
  E.cardKeep.disabled = false;
  E.cardKeep.innerHTML = full ? `KEEP<b>to storage</b>` : `KEEP<b>tank +${money(inc)}/s</b>`;
  const left = queue.length - qi;
  E.cardCount.textContent = `egg ${qi} of ${queue.length}`;
  E.cardRest.classList.toggle('hidden', left < 1);
  E.cardRest.textContent = `sell this + hatch & sell ${left} more`;
  E.card.classList.remove('hidden');
  E.card.style.setProperty('--rc', RARITIES[r].color);
}

function cardAction(a) {
  if (!cur || !RV.held) return;
  const item = cur;
  if (a === 'sell') {
    sellInst(item.inst);
    coinFly(E.cardSell, 6);
  } else if (a === 'keep') {
    const where = keepInst(item.inst);
    sfxPlay('buy');
    flyTo(E.cardKeep, E.nav.querySelector('[data-panel="aquarium"]'), `<img src="${creatureURL(item.inst.id, item.inst.mut)}" class="flyfish">`, 1);
    if (where === 'bag') toast('Tanks full: sent to storage. Use Equip Best in Tanks.', '#9fd8c9');
  } else if (a === 'rest') {
    let total = sellInst(item.inst);
    let best = null;
    while (qi < queue.length) {
      const it = hatch(queue[qi++], hatchLuck);
      if (!best || it.def.r > best.def.r) best = it;
      total += sellInst(it.inst);
    }
    coinFly(E.cardRest, 10);
    toast(`Sold the rest for ${money(total)}` + (best ? ` (best: ${best.def.name})` : ''), '#ffd34d');
  }
  endReveal();
  cur = null;
  nextEgg();
}

// ---------------------------------------------------------------------------
// The haul: decide what to do with every egg you reeled up
// ---------------------------------------------------------------------------
function showHaul(fresh) {
  const inv = R.haulEggs || {};
  const n = eggTotal(inv);
  const st = stats();
  let total = 0;
  for (const t in inv) total += eggValue(+t, st) * inv[t];
  E.haulTitle.textContent = `${n} egg${n === 1 ? '' : 's'}`;
  E.haulSub.innerHTML = R.haulLuck > 0.001 ? `<b style="color:#9dffc8">+${Math.round(R.haulLuck * 100)}% haul luck</b> if you hatch them now` : 'hatch now, sell now, or store them for later';
  E.haulSellAll.textContent = money(total);
  const tiers = Object.keys(inv).map(Number).sort((a, b) => b - a);
  E.haulBody.innerHTML = tiers.map((t, i) => {
    const eg = EGGS[t - 1], v = eggValue(t, st);
    return `<div class="hrow ${fresh ? 'enter' : ''}" style="--ec:${eg.color};animation-delay:${i * 70}ms" data-row="${t}">
      <div class="hegg"><img src="${eggURL(t)}" alt=""><span class="hcount">×${inv[t]}</span></div>
      <div class="hinfo"><b style="color:${eg.color}">${eg.name}</b><small>sells for ${money(v)} each</small></div>
      <div class="hbtns"><button class="hb sm hatch" data-h="hatch" data-t="${t}">HATCH</button><button class="hb sm sell" data-h="sell" data-t="${t}">SELL<b>${money(v)}</b></button><button class="hb sm store" data-h="store" data-t="${t}">STORE</button></div>
    </div>`;
  }).join('');
  if (fresh) {
    tiers.forEach((t, i) => setTimeout(() => sfxPlay('hit', 2 + t), 120 + i * 70));
    countUp(E.haulSellAll, total);
  }
}
function onHaulClick(e) {
  const b = e.target.closest('[data-h]');
  if (!b || b.disabled) return;
  haulAction(b.dataset.h, b.dataset.t ? +b.dataset.t : null, b);
}
function haulAction(act, t, btn) {
  const inv = R.haulEggs || {};
  if (act === 'hatch') return hatchQueue(takeEggs(inv, t, 1), R.haulLuck, 'haul');
  if (act === 'hatchall') {
    const list = [];
    for (const k of Object.keys(inv)) list.push(...takeEggs(inv, +k, inv[k]));
    return hatchQueue(list, R.haulLuck, 'haul');
  }
  if (act === 'sell') { sellEggs(inv, t, 1); coinFly(btn, 3); }
  if (act === 'store') { storeEggs(inv, t, 1); flyTo(btn, E.nav.querySelector('[data-panel="eggs"]'), `<img src="${eggURL(t)}" class="flyegg">`, 1); }
  if (act === 'sellall') {
    let v = 0;
    for (const k of Object.keys(inv)) v += sellEggs(inv, +k, inv[k]);
    if (v) { coinFly(btn, 12); toast(`Sold the haul for ${money(v)}`, '#ffd34d'); }
  }
  if (act === 'storeall') {
    let n = 0, top = 1;
    for (const k of Object.keys(inv)) { top = Math.max(top, +k); n += storeEggs(inv, +k, inv[k]); }
    if (n) { flyTo(btn, E.nav.querySelector('[data-panel="eggs"]'), `<img src="${eggURL(top)}" class="flyegg">`, Math.min(n, 6)); toast(`${n} egg${n > 1 ? 's' : ''} stored in your Eggs tab`, '#9fd8c9'); }
  }
  save();
  if (eggTotal(inv) <= 0) { setTimeout(() => { if (R.mode === 'haul') toShip(); }, 250); E.haul.classList.add('closing'); setTimeout(() => E.haul.classList.remove('closing'), 400); }
  else showHaul(false);
}

// ---------------------------------------------------------------------------
// juice: flying icons, gain popups, bumps
// ---------------------------------------------------------------------------
function appRect() { return E.app.getBoundingClientRect(); }
function bump(el) { if (!el) return; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
function flyTo(fromEl, toEl, html, n = 1, onEach) {
  if (!fromEl || !toEl) return;
  const A = appRect(), f = fromEl.getBoundingClientRect(), t = toEl.getBoundingClientRect();
  const x0 = f.left + f.width / 2 - A.left, y0 = f.top + f.height / 2 - A.top;
  const x1 = t.left + t.width / 2 - A.left, y1 = t.top + t.height / 2 - A.top;
  for (let i = 0; i < n; i++) {
    const d = document.createElement('div');
    d.className = 'flyer';
    d.innerHTML = html;
    d.style.left = x0 + 'px'; d.style.top = y0 + 'px';
    E.fly.appendChild(d);
    const jx = (Math.random() - 0.5) * 70, jy = -40 - Math.random() * 60;
    const anim = d.animate([
      { transform: 'translate(-50%,-50%) scale(.4)', opacity: 0 },
      { transform: `translate(calc(-50% + ${jx}px), calc(-50% + ${jy}px)) scale(1.15)`, opacity: 1, offset: 0.3 },
      { transform: `translate(calc(-50% + ${x1 - x0}px), calc(-50% + ${y1 - y0}px)) scale(.45)`, opacity: 0.9 },
    ], { duration: 620 + i * 35, delay: i * 55, easing: 'cubic-bezier(.45,0,.8,.4)', fill: 'both' });
    anim.onfinish = () => { d.remove(); bump(toEl); if (onEach) onEach(i); };
  }
}
let coinTick = 0;
function coinFly(fromEl, n) {
  flyTo(fromEl, E.moneyPill, '<span class="flycoin">⛁</span>', n, () => {
    const now = performance.now();
    if (now - coinTick > 60) { coinTick = now; sfxPlay('ichor'); }
  });
}
function eggFly(x, y, tier) {
  const target = E.eggSlots;
  if (!target || target.classList.contains('hidden')) return;
  const A = appRect(), t = target.getBoundingClientRect();
  const d = document.createElement('div');
  d.className = 'flyer';
  d.innerHTML = `<img src="${eggURL(tier)}" class="flyegg">`;
  d.style.left = x + 'px'; d.style.top = y + 'px';
  E.fly.appendChild(d);
  const x1 = t.left + t.width / 2 - A.left, y1 = t.top + t.height / 2 - A.top;
  d.animate([
    { transform: 'translate(-50%,-50%) scale(1.4)', opacity: 1 },
    { transform: `translate(calc(-50% + ${x1 - x}px), calc(-50% + ${y1 - y}px)) scale(.5)`, opacity: 0.8 },
  ], { duration: 480, easing: 'cubic-bezier(.5,0,.9,.5)', fill: 'both' }).onfinish = () => { d.remove(); bump(target); };
}
function popGain(v) {
  bump(E.moneyPill);
  const d = document.createElement('div');
  d.className = 'gainpop';
  d.textContent = '+' + money(v);
  E.hud.appendChild(d);
  setTimeout(() => d.remove(), 1100);
}
function countUp(el, to) {
  const t0 = performance.now(), dur = 600;
  const step = (now) => {
    const k = Math.min(1, (now - t0) / dur);
    el.textContent = money(to * (1 - Math.pow(1 - k, 3)));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// canvas tap during reveal
export function revealTap() {
  if (RV.active && !RV.held) skipReveal();
}

// ---------------------------------------------------------------------------
// Panels
// ---------------------------------------------------------------------------
const TITLES = { upgrades: 'The Armory', crew: 'Hire Crew', ship: 'Shipwright', aquarium: 'Aquarium', eggs: 'Egg Hold', codex: 'Bestiary', contracts: 'Contracts', menu: 'Captain\'s Log' };
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

let popPanel = null;
function renderPanel() {
  const fn = { upgrades: pUpgrades, crew: pCrew, ship: pShip, aquarium: pAquarium, eggs: pEggs, codex: pCodex, contracts: pContracts, menu: pMenu }[R.panel];
  const st = E.sheetBody.scrollTop;
  E.sheetBody.innerHTML = fn ? fn() : '';
  E.sheetBody.scrollTop = st;
  updateAfford();
  if (popPanel) {
    E.sheetBody.querySelectorAll(popPanel).forEach((el) => { const row = el.closest('.row') || el; row.classList.add('pop'); });
    popPanel = null;
  }
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

function fishCard(f, st, inTank, full) {
  const d = CREATURE_BY_ID[f.id];
  const m = f.mut ? MUT_BY_ID[f.mut] : null;
  const act = inTank
    ? `<button class="mini" data-act="toBag" data-id="${f.uid}">remove</button>`
    : `<button class="mini go" data-act="toTank" data-id="${f.uid}">${full ? 'swap in' : 'add'}</button>`;
  return `<div class="fish ${inTank ? '' : 'stored'}" style="--rc:${RARITIES[d.r].color}" data-fish="${f.uid}"><img src="${creatureURL(f.id, f.mut)}" alt=""><b>${d.name}</b>
    <small>${m ? `<span style="color:${m.color}">${m.name}</span> · ` : ''}${RARITIES[d.r].name}${f.colossal ? ' · COLOSSAL' : ''}</small>
    <em>${inTank ? '' : 'would earn '}+${money(fishIncome(f, st))}/s</em><div class="fbtns">${act}<button class="mini" data-act="sellfish" data-id="${f.uid}">sell ${money(sellValue(f, st))}</button></div></div>`;
}
function pAquarium() {
  const st = stats();
  const full = S.aquarium.length >= st.aquaSlots;
  // would equipping best change anything?
  const all = S.aquarium.concat(S.bag).sort((a, b) => b.value - a.value).slice(0, st.aquaSlots);
  let bestInc = 0;
  for (const f of all) bestInc += fishIncome(f, st);
  const gain = bestInc - incomePerSec(st);
  let stored = 0;
  for (const f of S.bag) stored += sellValue(f, st);
  let h = `<p class="sub">Tanks <b>${S.aquarium.length}/${st.aquaSlots}</b> · earning <b>${money(incomePerSec(st))}/s</b> · storage <b>${S.bag.length}</b></p>
  <div class="abtns"><button class="buy go wide" data-act="equipBest" ${gain > 0.001 ? '' : 'disabled'}>EQUIP BEST<b>${gain > 0.001 ? '+' + money(gain) + '/s' : 'already best'}</b></button>
  <button class="buy wide" data-act="sellStored" ${S.bag.length ? '' : 'disabled'}>SELL ALL STORED<b>${money(stored)}</b></button></div>
  <h4 class="shead">In tanks</h4><div class="grid">`;
  for (const f of S.aquarium) h += fishCard(f, st, true, full);
  for (let i = S.aquarium.length; i < st.aquaSlots; i++) h += `<div class="fish empty"><span>empty tank</span></div>`;
  h += `</div><h4 class="shead">Storage <small>no limit · creatures here don't earn</small></h4>`;
  if (!S.bag.length) h += `<p class="note">Creatures you keep while the tanks are full wait here.</p>`;
  else {
    h += '<div class="grid">';
    S.bag.slice(0, 120).forEach((f) => (h += fishCard(f, st, false, full)));
    h += '</div>';
    if (S.bag.length > 120) h += `<p class="note">+${S.bag.length - 120} more stored</p>`;
  }
  h += `<p class="note">Tank creatures earn ${Math.round(AQUA_RATE * 1000) / 10}% of their value every second, even while you're away (at half rate, up to 8 hours). Build more Aquarium Tanks in the Shipwright for more slots.</p>`;
  return h;
}

function pEggs() {
  const st = stats();
  const inv = S.eggInv;
  const tiers = Object.keys(inv).map(Number).filter((t) => inv[t] > 0).sort((a, b) => b - a);
  let tot = 0;
  for (const t of tiers) tot += eggValue(t, st) * inv[t];
  let h = `<p class="sub">Stored eggs <b>${eggTotal()}</b> · worth <b>${money(tot)}</b> if sold · no limit</p>`;
  if (!tiers.length) return h + `<p class="note">Eggs you STORE from a haul wait here until you're ready to hatch or sell them.</p>`;
  h += `<div class="abtns"><button class="buy go wide" data-act="eggHatchAll">HATCH EVERYTHING<b>${eggTotal()} eggs</b></button><button class="buy wide" data-act="eggSellAll">SELL EVERYTHING<b>${money(tot)}</b></button></div>`;
  for (const t of tiers) {
    const eg = EGGS[t - 1], v = eggValue(t, st);
    h += `<div class="row erow" style="--ec:${eg.color}"><div class="hegg"><img src="${eggURL(t)}" alt=""><span class="hcount">×${fmt(inv[t])}</span></div>
    <div class="info"><b style="color:${eg.color}">${eg.name}</b><br><span>${money(v)} each</span></div>
    <div class="ebtns"><button class="mini go" data-act="eggHatch" data-id="${t}">hatch 1</button><button class="mini go" data-act="eggHatchT" data-id="${t}">hatch all</button>
    <button class="mini" data-act="eggSell" data-id="${t}">sell 1</button><button class="mini" data-act="eggSellT" data-id="${t}">sell all</button></div></div>`;
  }
  h += `<p class="note">Haul luck from a dive only applies when you hatch straight from that haul.</p>`;
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
    case 'upg': if (buyUpgrade(id)) { flashBtn(b); popPanel = `[data-act="upg"][data-id="${id}"]`; } break;
    case 'cage': if (buyCage(+id)) flashBtn(b); break;
    case 'crew': if (hireCrew(id)) { flashBtn(b); popPanel = `[data-act="crew"][data-id="${id}"]`; } break;
    case 'room': if (buildRoom(id)) { flashBtn(b); toast('New room built', '#ffd34d'); } break;
    case 'sellfish': { coinFly(b, 4); sellFish(+id); break; }
    case 'toBag': fishToBag(+id); break;
    case 'toTank': fishToTank(+id); flyTo(b, E.moneyPill, '<span class="flycoin">✦</span>', 1); break;
    case 'equipBest': {
      const before = incomePerSec();
      if (equipBest()) { sfxPlay('buy'); toast(`Tanks now earn ${money(incomePerSec())}/s (+${money(incomePerSec() - before)})`, '#9dff7a'); popPanel = '.fish'; }
      break;
    }
    case 'sellStored': { const v = sellAllStored(); if (v) { coinFly(b, 10); toast('Sold storage for ' + money(v), '#ffd34d'); } break; }
    case 'eggHatch': hatchQueue(takeEggs(S.eggInv, +id, 1), 0, 'eggs'); save(); return;
    case 'eggHatchT': hatchQueue(takeEggs(S.eggInv, +id, S.eggInv[id] || 0), 0, 'eggs'); save(); return;
    case 'eggHatchAll': { const l = []; for (const k of Object.keys(S.eggInv)) l.push(...takeEggs(S.eggInv, +k, S.eggInv[k])); hatchQueue(l, 0, 'eggs'); save(); return; }
    case 'eggSell': sellEggs(S.eggInv, +id, 1); coinFly(b, 3); break;
    case 'eggSellT': sellEggs(S.eggInv, +id, S.eggInv[id] || 0); coinFly(b, 8); break;
    case 'eggSellAll': { let v = 0; for (const k of Object.keys(S.eggInv)) v += sellEggs(S.eggInv, +k, S.eggInv[k]); if (v) { coinFly(b, 12); toast('Sold every stored egg for ' + money(v), '#ffd34d'); } break; }
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
