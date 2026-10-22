import { CAGES } from './cage.js';
import { UPGRADES, CREW, CREW_BY_ID, ROOMS, CREATURES, MUTATIONS, AQUA_RATE, ZONES, RARITIES, EGGS } from './data.js';
import { randi, pick, fmt } from './util.js';

const KEY = 'drownedClutch_v1';

export function defaultState() {
  return {
    v: 1,
    money: 50,
    lifetime: 0,
    runEarned: 0,
    sigils: 0,
    upgrades: Object.fromEntries(UPGRADES.map((u) => [u.id, 0])),
    crew: Object.fromEntries(CREW.map((c) => [c.id, 0])),
    rooms: ['tank', 'bunk'],
    aquarium: [],
    codex: {},
    dread: 0,
    stats: { dives: 0, maxDepth: 0, maxCombo: 0, hatched: 0, eggs: 0, offerings: 0, bestValue: 0 },
    cages: [0],
    cage: 0,
    contracts: [],
    contractsDone: 0,
    settings: { sfx: true, music: true, skipCommon: false, autoSell: -1, haptics: true },
    tut: 0,
    uid: 1,
    omen: null,
    omenEnd: 0,
    nextOmen: Date.now() + 120000,
    lastSeen: Date.now(),
  };
}

export let S = defaultState();

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw);
      const base = defaultState();
      S = Object.assign(base, d);
      S.upgrades = Object.assign(base.upgrades, d.upgrades || {});
      S.crew = Object.assign(base.crew, d.crew || {});
      S.stats = Object.assign(base.stats, d.stats || {});
      S.settings = Object.assign(base.settings, d.settings || {});
      if (!Array.isArray(S.rooms) || !S.rooms.length) S.rooms = base.rooms;
      if (!Array.isArray(S.cages) || !S.cages.length) S.cages = [0];
      if (!S.cages.includes(S.cage)) S.cage = 0;
      return true;
    }
  } catch (e) {
    console.warn('load failed', e);
  }
  S = defaultState();
  return false;
}

export function save() {
  try {
    S.lastSeen = Date.now();
    localStorage.setItem(KEY, JSON.stringify(S));
  } catch (e) {
    console.warn('save failed', e);
  }
}

export function wipe() {
  try { localStorage.removeItem(KEY); } catch (e) {}
  S = defaultState();
}

export function roomCount(id) {
  let n = 0;
  for (const r of S.rooms) if (r === id) n++;
  return n;
}
export function crewTotal() {
  let n = 0;
  for (const k in S.crew) n += S.crew[k];
  return n;
}
export function codexMutCount() {
  let n = 0;
  for (const id in S.codex) n += Object.keys(S.codex[id].muts || {}).length;
  return n;
}
export function codexSpecies() {
  return Object.keys(S.codex).length;
}

export function omenActive(id) {
  return S.omen === id && Date.now() < S.omenEnd;
}

// derived stats -----------------------------------------------------------------
export function stats() {
  const u = S.upgrades, c = S.crew;
  const rWinch = roomCount('winch'), rShrine = roomCount('shrine'), rRef = roomCount('refinery'), rTrophy = roomCount('trophy');
  const eff = S.dread > 60 ? Math.max(0.6, 1 - (S.dread - 60) * 0.008) : 1; // crew efficiency
  const sigilMult = 1 + 0.08 * S.sigils;
  const codexMult = 1 + 0.005 * codexMutCount() + 0.01 * codexSpecies();
  let luck = 0.08 * u.lantern + (0.03 * c.occultist + 0.01 * c.chaplain) * eff + 0.06 * rShrine + S.dread * 0.004 + 0.02 * S.sigils;
  if (omenActive('choir')) luck += 0.6;
  const cg = CAGES[S.cage] || CAGES[0];
  luck += cg.luck;
  const reelBase = 55 * Math.pow(1.1, u.winch) * (1 + 0.04 * c.deckhand * eff + 0.08 * rWinch);
  return {
    eff,
    range: 70 * Math.pow(1.16, u.range),
    speed: Math.min(72, (24 + 1.4 * u.speed) * (1 + 0.02 * c.gunner * eff)),
    steer: (1 + 0.1 * u.steer) * (1 + 0.02 * c.gunner * eff),
    safe: Math.min(0.94, 0.55 + 0.022 * u.winch + 0.03 * rWinch),
    reelBase,
    luck,
    sonar: u.sonar,
    light: 1 + 0.06 * u.lantern,
    shields: u.plating,
    density: 1 + 0.05 * c.lookout * eff,
    aquaSlots: 4 * roomCount('tank'),
    crewCap: 4 * roomCount('bunk') + 2,
    sellMult: sigilMult * codexMult * cg.sell * (1 + 0.05 * rRef) * (omenActive('ichor') ? 2 : 1),
    incomeMult: sigilMult * codexMult * cg.aqua * (1 + 0.04 * c.aquarist * eff + 0.03 * rTrophy),
    dreadRate: 0.008 * c.occultist - 0.02 * c.chaplain - 0.03 * rShrine - 0.012,
    mutMult: (omenActive('fog') ? 3 : 1) * cg.mut,
  };
}

export function incomePerSec(st = stats()) {
  let s = 0;
  for (const f of S.aquarium) s += f.value * AQUA_RATE;
  return s * st.incomeMult;
}
export function fishIncome(f, st = stats()) {
  return f.value * AQUA_RATE * st.incomeMult;
}
export function sellValue(f, st = stats()) {
  return f.value * st.sellMult;
}

// costs -------------------------------------------------------------------------
export function upgradeCost(u) {
  return Math.ceil(u.base * Math.pow(u.growth, S.upgrades[u.id]));
}
export function crewCost(id) {
  const c = CREW_BY_ID[id];
  return Math.ceil(c.base * Math.pow(1.42, S.crew[id]) * Math.pow(1.04, crewTotal()));
}
export function roomCost() {
  const n = Math.max(0, S.rooms.length - 2);
  return Math.ceil(250 * Math.pow(1.58, n));
}

export function addMoney(n) {
  S.money += n;
  if (n > 0) {
    S.lifetime += n;
    S.runEarned += n;
  }
}

export function nextUid() {
  return S.uid++;
}

// contracts ---------------------------------------------------------------------
export function deepestZone() {
  let z = 0;
  for (const zz of ZONES) if (S.stats.maxDepth >= zz.start) z = zz.index;
  return z;
}
export function makeContract() {
  const z = deepestZone();
  const scale = Math.pow(2.1, z) * 60;
  const types = ['hatch', 'depth', 'combo', 'sell', 'mutation', 'eggs'];
  const type = pick(types);
  let c;
  if (type === 'hatch') {
    const r = Math.min(6, Math.max(0, Math.floor(z / 3) + randi(-1, 1)));
    const n = randi(2, 5);
    c = { type, r, target: n, desc: `Hatch ${n} ${RARITIES[r].name}+ creatures` };
  } else if (type === 'depth') {
    const d = Math.round(Math.min(ZONES[19].end - 5, Math.max(80, S.stats.maxDepth * (1.05 + Math.random() * 0.25))) / 10) * 10;
    c = { type, target: d, desc: `Reach ${fmt(d)}m deep in one dive` };
  } else if (type === 'combo') {
    const n = Math.min(12, Math.max(2, S.stats.maxCombo + randi(0, 1)));
    c = { type, target: n, desc: `Land a x${n} egg combo` };
  } else if (type === 'sell') {
    const n = Math.ceil(scale * randi(4, 9));
    c = { type, target: n, desc: `Sell $${fmt(n)} of creatures` };
  } else if (type === 'mutation') {
    const n = randi(1, 2);
    c = { type, target: n, desc: `Hatch ${n} mutated creature${n > 1 ? 's' : ''}` };
  } else {
    const t = Math.min(8, Math.max(1, Math.floor(z * 0.4) + 1));
    const n = randi(2, 4);
    c = { type, tier: t, target: n, desc: `Haul ${n} ${EGGS[t - 1].name.replace(' Egg', '')}+ eggs in one dive` };
  }
  c.progress = 0;
  c.reward = Math.ceil(scale * (6 + Math.random() * 6));
  c.id = Math.random().toString(36).slice(2);
  return c;
}
export function ensureContracts() {
  while (S.contracts.length < 3) S.contracts.push(makeContract());
}
export function contractEvent(type, payload) {
  for (const c of S.contracts) {
    if (c.progress >= c.target) continue;
    if (c.type !== type) continue;
    if (type === 'hatch' && payload.r >= c.r) c.progress++;
    else if (type === 'depth') c.progress = Math.max(c.progress, Math.floor(payload));
    else if (type === 'combo') c.progress = Math.max(c.progress, payload);
    else if (type === 'sell') c.progress += payload;
    else if (type === 'mutation') c.progress++;
    else if (type === 'eggs') c.progress = Math.max(c.progress, payload.filter((t) => t >= c.tier).length);
    c.progress = Math.min(c.progress, c.target);
  }
}

// prestige -------------------------------------------------------------------------
export function sigilsAvailable() {
  return Math.floor(Math.sqrt(S.runEarned / 1e6));
}
export function canOffer() {
  return S.stats.maxDepth >= ZONES[9].start && sigilsAvailable() > 0;
}
export function doOffering() {
  const gained = sigilsAvailable();
  const keep = {
    sigils: S.sigils + gained,
    codex: S.codex,
    stats: Object.assign({}, S.stats, { offerings: S.stats.offerings + 1 }),
    settings: S.settings,
    lifetime: S.lifetime,
    tut: S.tut,
    uid: S.uid,
    contractsDone: S.contractsDone,
    cages: S.cages,
    cage: S.cage,
  };
  S = Object.assign(defaultState(), keep);
  S.money = 50 + 200 * S.sigils;
  return gained;
}
