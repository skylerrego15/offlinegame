// ---------------------------------------------------------------------------
//  DROWNED CLUTCH — static game data
// ---------------------------------------------------------------------------

export const RARITIES = [
  { name: 'Common', color: '#a3acb5', glow: '#cfd6dc', dread: 0 },
  { name: 'Uncommon', color: '#5fd17a', glow: '#9dffb4', dread: 0 },
  { name: 'Rare', color: '#3fa9ff', glow: '#9fd6ff', dread: 0 },
  { name: 'Epic', color: '#b45cff', glow: '#d9a8ff', dread: 1 },
  { name: 'Legendary', color: '#ffb52e', glow: '#ffe09a', dread: 3 },
  { name: 'Mythic', color: '#ff4d6d', glow: '#ffa3b3', dread: 6 },
  { name: 'Eldritch', color: '#3dffc8', glow: '#b3ffeb', dread: 12 },
  { name: 'Abyssal', color: '#f4e9ff', glow: '#ffffff', dread: 20 },
];

export const EGGS = [
  { tier: 1, name: 'Silt Egg', color: '#b6a891', ichor: 4 },
  { tier: 2, name: 'Coral Egg', color: '#3fd7e6', ichor: 12 },
  { tier: 3, name: 'Frost Egg', color: '#bfe9ff', ichor: 40 },
  { tier: 4, name: 'Magma Egg', color: '#ff7a1a', ichor: 150 },
  { tier: 5, name: 'Venom Egg', color: '#66ff4d', ichor: 600 },
  { tier: 6, name: 'Abyss Egg', color: '#a64dff', ichor: 2500 },
  { tier: 7, name: 'Blood Egg', color: '#ff1f3d', ichor: 12000 },
  { tier: 8, name: 'Eldritch Egg', color: '#d94dff', ichor: 60000 },
];

// hatch odds per egg tier, by creature rarity (percent)
export const HATCH_ODDS = [
  [72, 24, 4, 0, 0, 0, 0, 0],
  [45, 36, 15, 3.6, 0.4, 0, 0, 0],
  [20, 34, 31, 12, 2.7, 0.3, 0, 0],
  [6, 20, 35, 27, 10, 1.8, 0.2, 0],
  [0, 8, 24, 34, 24, 8.5, 1.4, 0.1],
  [0, 0, 10, 28, 34, 22, 5.4, 0.6],
  [0, 0, 0, 14, 33, 36, 14, 3],
  [0, 0, 0, 0, 18, 40, 33, 9],
];

export const CREATURES = [
  { id: 'triggerfish', name: 'Bilgemouth Trigger', r: 0, value: 12, len: 0.4, lore: 'Chews hull-rot. Hums when it is happy, which is never.' },
  { id: 'parrotfish', name: 'Rustbeak Parrot', r: 0, value: 15, len: 0.6, lore: 'Its beak grinds bone into the white sand of the shallows.' },
  { id: 'catshark', name: 'Lamplit Catshark', r: 0, value: 19, len: 0.9, lore: 'Follows ship lanterns. Nobody knows what it wants from the light.' },
  { id: 'leopard', name: 'Gravespot Leopard', r: 1, value: 55, len: 1.6, lore: 'Every spot is the shape of a drowned sailor\'s face.' },
  { id: 'wobbegong', name: 'Fringe-Beard Wobbegong', r: 1, value: 70, len: 2.1, lore: 'Lies still on the seabed for decades, listening to footsteps above.' },
  { id: 'beluga', name: 'Pale Choirwhale', r: 1, value: 92, len: 4.2, lore: 'Sings in a key that makes the crew weep and not know why.' },
  { id: 'thresher', name: 'Lashtail Thresher', r: 2, value: 260, len: 4.8, lore: 'Its tail cracks like a whip loud enough to stop a heart.' },
  { id: 'hammerhead', name: 'Anvilhead', r: 2, value: 330, len: 5.5, lore: 'Sees in every direction at once. It has seen you.' },
  { id: 'mako', name: 'Quickfang Mako', r: 2, value: 410, len: 3.9, lore: 'Faster than the line. Faster than prayer.' },
  { id: 'viper', name: 'Bleeding Viper', r: 3, value: 1600, len: 1.2, lore: 'Glows the color of an open wound. It is always hungry.' },
  { id: 'gulper', name: 'Gulper of Green Lanterns', r: 3, value: 2100, len: 2.4, lore: 'Its mouth is larger than it is. So is its appetite.' },
  { id: 'angler', name: 'Lanternmaw', r: 4, value: 8200, len: 3.1, lore: 'The light is an eye. The eye is a lie. The lie is a mouth.' },
  { id: 'palefang', name: 'The Pale Gnasher', r: 4, value: 11500, len: 6.6, lore: 'Its whiskers taste the thoughts of whatever swims near.' },
  { id: 'ossuary', name: 'Ossuary Beard', r: 5, value: 46000, len: 9.4, lore: 'Six eyes, armored in old skulls. Wears the dead as plate.' },
  { id: 'thornjaw', name: 'Thornjaw Devourer', r: 5, value: 61000, len: 12.5, lore: 'Swallowed a lighthouse once. The light still shows through.' },
  { id: 'lantern', name: 'Seven-Lamp Revenant', r: 5, value: 76000, len: 10.8, lore: 'Seven lamps for seven drowned captains. Room for an eighth.' },
  { id: 'marrow', name: 'Marrow Serpent', r: 6, value: 420000, len: 31, lore: 'Its ribs are the keels of ships it has eaten whole.' },
  { id: 'leviathan', name: 'Drowned Leviathan', r: 6, value: 610000, len: 44, lore: 'The tentacles are not its own. They are what it ate, still moving.' },
  { id: 'voidray', name: 'Starveil, Wing of Nothing', r: 7, value: 3600000, len: 60, lore: 'Its wings hold a night sky no living star belongs to.' },
  { id: 'cathedral', name: 'The Cathedral That Swims', r: 7, value: 6200000, len: 120, lore: 'A congregation still prays inside. You can hear them through the shell.' },
];
export const CREATURE_BY_ID = Object.fromEntries(CREATURES.map((c) => [c.id, c]));
export const BY_RARITY = RARITIES.map((_, r) => CREATURES.filter((c) => c.r === r));

export const MUTATIONS = [
  { id: 'albino', name: 'Albino', mult: 1.5, w: 34, color: '#f4f1ea' },
  { id: 'gilded', name: 'Gilded', mult: 3, w: 25, color: '#ffd34d' },
  { id: 'spectral', name: 'Spectral', mult: 4, w: 15, color: '#7ff6ff' },
  { id: 'bloodborn', name: 'Bloodborn', mult: 5, w: 12, color: '#ff2b4a' },
  { id: 'iridescent', name: 'Iridescent', mult: 8, w: 8, color: '#ff8af0' },
  { id: 'abyssal', name: 'Abyssal', mult: 12, w: 4, color: '#8a5bff' },
  { id: 'void', name: 'Void-Touched', mult: 25, w: 2, color: '#d8d8ff' },
];
export const MUT_BY_ID = Object.fromEntries(MUTATIONS.map((m) => [m.id, m]));

// 20 zones -----------------------------------------------------------------
const Z = (name, top, bot, accent, feature, lore) => ({ name, top, bot, accent, feature, lore });
export const ZONES = [
  Z('The Shallow Graves', '#1d5466', '#123848', '#9fd8c9', 'crosses', 'Wooden markers for sailors who never came home.'),
  Z('Kelp Cathedral', '#11403f', '#0b2c2c', '#6fbf73', 'kelp', 'The kelp grows in pews. Something sits in them.'),
  Z('The Drowned Village', '#13324d', '#0c2337', '#e3c27a', 'houses', 'Lamps still burn in the windows.'),
  Z('Whalefall Ribs', '#112c3e', '#0b1e2c', '#e8e0c8', 'ribs', 'A god-whale fell here. Its bones became a forest.'),
  Z('Lantern Reef', '#0b2635', '#081b27', '#4dffd2', 'reef', 'The coral glows. The coral breathes.'),
  Z('The Weeping Shelf', '#13223c', '#0c162a', '#8fa6ff', 'cliffs', 'The cliffs cry salt that is not seawater.'),
  Z('Sunken Chapel', '#171d35', '#0f1326', '#e1c77f', 'arches', 'The bell still rings at the turn of every tide.'),
  Z('The Brine Lakes', '#111b2b', '#0a111d', '#7affb0', 'pools', 'Lakes beneath the sea. Nothing that sinks in them floats.'),
  Z('Ossuary Trench', '#18151f', '#0f0c15', '#e6dcc4', 'skulls', 'Skulls stacked by patient hands.'),
  Z('Black Smoker Vents', '#1d1311', '#130b09', '#ff7a2e', 'vents', 'The water boils. The eggs love it.'),
  Z('The Choir Pits', '#151020', '#0c0915', '#c79bff', 'columns', 'Pillars that hum a single, endless note.'),
  Z('The Glass Forest', '#0d1b25', '#081017', '#9ff3ff', 'crystals', 'Every crystal holds a frozen scream.'),
  Z('Teeth of Ys', '#1b1013', '#11090b', '#f2d0c0', 'teeth', 'A drowned city\'s jaw, still trying to close.'),
  Z('The Chained Deep', '#13141b', '#0b0c11', '#aab2c2', 'chains', 'Someone chained something down here. The links are bending.'),
  Z('The Hollow Moon', '#0f1121', '#080915', '#f0f0d8', 'moon', 'A second moon, sunk and hollow, lit from inside.'),
  Z('The Drowned Spires', '#0b1515', '#060c0c', '#3dffc8', 'monoliths', 'Angles that do not agree with each other.'),
  Z('The Watching Dark', '#0c0c13', '#060609', '#ffdd55', 'eyes', 'Do not count the eyes. They notice.'),
  Z('The Gutted Leviathan', '#2b0c11', '#170509', '#ff4d6d', 'flesh', 'You are inside it now. It is not quite dead.'),
  Z('The Sleeper\'s Coil', '#100b19', '#08050d', '#b45cff', 'tentacles', 'Every coil is the same limb. It goes on forever.'),
  Z('The Unlit Throne', '#060509', '#010101', '#ffffff', 'throne', 'The bottom of everything. Someone is sitting on it.'),
];
// depth layout
let acc = 0;
ZONES.forEach((z, i) => {
  const len = 80 + 15 * i;
  z.index = i;
  z.start = acc;
  z.end = acc + len;
  acc += len;
});
export const MAX_DEPTH = acc;
export function zoneAt(depth) {
  for (let i = ZONES.length - 1; i >= 0; i--) if (depth >= ZONES[i].start) return ZONES[i];
  return ZONES[0];
}

// upgrades ------------------------------------------------------------------
export const UPGRADES = [
  { id: 'range', name: 'Harpoon Line', icon: '⇣', desc: 'Base dive depth', max: 40, base: 60, growth: 1.62, val: (l) => 70 * Math.pow(1.16, l), show: (v) => Math.floor(v) + 'm' },
  { id: 'speed', name: 'Powder Charge', icon: '➶', desc: 'Harpoon dive speed', max: 30, base: 45, growth: 1.55, val: (l) => 28 * Math.pow(1.1, l), show: (v) => Math.floor(v) + ' m/s' },
  { id: 'barbs', name: 'Barbed Tines', icon: '⋔', desc: 'Eggs the harpoon can carry', max: 12, base: 150, growth: 2.15, val: (l) => 3 + l, show: (v) => v + ' eggs' },
  { id: 'steer', name: 'Rudder Fins', icon: '⇄', desc: 'Steering control while diving', max: 15, base: 80, growth: 1.7, val: (l) => 1 + 0.12 * l, show: (v) => v.toFixed(2) + 'x' },
  { id: 'winch', name: 'Bone Winch', icon: '⟲', desc: 'Reel speed + safe tension', max: 25, base: 70, growth: 1.6, val: (l) => l, show: (v) => 'Lv ' + v },
  { id: 'lantern', name: 'Corpse-Light Lantern', icon: '✺', desc: 'Hatch luck + light radius', max: 30, base: 200, growth: 1.75, val: (l) => 0.08 * l, show: (v) => '+' + Math.round(v * 100) + '% luck' },
  { id: 'sonar', name: 'Whisper Sonar', icon: '◎', desc: 'Reveals eggs below you', max: 10, base: 120, growth: 1.9, val: (l) => l, show: (v) => (v ? 40 + v * 30 + 'm scan' : 'None') },
  { id: 'plating', name: 'Iron Plating', icon: '⛨', desc: 'Hazard hits absorbed per dive', max: 8, base: 300, growth: 2.2, val: (l) => l, show: (v) => v + ' shields' },
];
export const UPG_BY_ID = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));

export const CREW = [
  { id: 'deckhand', name: 'Deckhand', color: '#c9a26b', base: 100, desc: '+4% reel speed each', room: 'winch' },
  { id: 'gunner', name: 'Harpooner', color: '#d0503f', base: 150, desc: '+3% dive speed, +2% steer each', room: 'deck' },
  { id: 'lookout', name: 'Lookout', color: '#4ba3c9', base: 200, desc: '+5% egg density each', room: 'nest' },
  { id: 'aquarist', name: 'Aquarist', color: '#4bc98b', base: 300, desc: '+4% aquarium income each', room: 'tank' },
  { id: 'chaplain', name: 'Chaplain', color: '#e6e1d3', base: 350, desc: '+1% luck, calms Dread each', room: 'shrine' },
  { id: 'occultist', name: 'Occultist', color: '#9b5cff', base: 400, desc: '+3% luck each, but feeds Dread', room: 'shrine' },
];
export const CREW_BY_ID = Object.fromEntries(CREW.map((c) => [c.id, c]));

export const ROOMS = [
  { id: 'tank', name: 'Aquarium Tank', desc: '+4 aquarium slots' },
  { id: 'bunk', name: 'Crew Bunks', desc: '+4 crew beds' },
  { id: 'winch', name: 'Winch Room', desc: '+8% reel speed, +3% safe tension' },
  { id: 'shrine', name: 'Lantern Shrine', desc: '+6% luck, calms Dread' },
  { id: 'refinery', name: 'Ichor Refinery', desc: '+5% sell value' },
  { id: 'trophy', name: 'Trophy Hall', desc: '+3% aquarium income, shows your best catch' },
];
export const ROOM_BY_ID = Object.fromEntries(ROOMS.map((r) => [r.id, r]));

export const OMENS = [
  { id: 'bloodtide', name: 'Blood Tide', desc: 'Higher-tier eggs rise from the deep', color: '#ff2b4a' },
  { id: 'choir', name: 'Choir of the Deep', desc: '+60% hatch luck', color: '#c79bff' },
  { id: 'calm', name: 'Dead Calm', desc: 'No hazards. No lurkers.', color: '#9fd8c9' },
  { id: 'ichor', name: 'Ichor Rain', desc: 'All sales pay double', color: '#ffd34d' },
  { id: 'fog', name: 'Mutagenic Fog', desc: 'Mutations x3', color: '#7affb0' },
];
export const OMEN_BY_ID = Object.fromEntries(OMENS.map((o) => [o.id, o]));

export const AQUA_RATE = 0.025; // income per second as a fraction of value
