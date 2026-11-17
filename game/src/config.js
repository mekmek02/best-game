// EMBERKEEP tuning: every number the game balances on lives here, so tuning never
// means hunting through the simulation. The field is a fixed 1280x720 arena; the
// canvas scales it to the window and letterboxes it.
export const FIELD = { width: 1280, height: 720 };

// Fixed simulation step (seconds). The world advances only in whole steps, so a
// seeded run replays byte for byte and the screenshot scenes are deterministic.
export const STEP = 1 / 60;

// The player: the Emberkeeper, a hooded warden carrying the last lantern.
export const PLAYER = {
  radius: 16,
  speed: 265,
  maxHearts: 3,
  fireInterval: 0.24,
  bulletSpeed: 580,
  bulletRadius: 5,
  bulletDamage: 1,
  lightRadius: 170,
  burnDps: 2.0,
  invulnSeconds: 1.2,
  pickupRadius: 46,
};

// Shadow kinds. Each one answers a different question the player must solve:
// wisps swarm, crawlers soak, spitters punish standing still, brutes split.
export const ENEMIES = {
  wisp:    { hp: 3, speed: 100, radius: 12, score: 10, damage: 1, shards: 1, eye: '#c9a7ff' },
  crawler: { hp: 5, speed: 56,  radius: 18, score: 25, damage: 1, shards: 2, eye: '#ff9d5c' },
  spitter: { hp: 4, speed: 72,  radius: 14, score: 30, damage: 1, shards: 2, eye: '#7ee081', range: 330, shotInterval: 2.4, orbSpeed: 190 },
  brute:   { hp: 15, speed: 40,  radius: 27, score: 60, damage: 1, shards: 5, eye: '#ff5c7a' },
  warden:  { hp: 170, speed: 48, radius: 46, score: 1000, damage: 1, shards: 24, eye: '#ffd166' },
};

// How long a wave's spawning lasts, and how the director builds each wave.
// Counts grow with the wave; the mix shifts from wisps toward crawlers, spitters
// and brutes as the night deepens.
export const WAVES = {
  total: 10,
  bossWave: 10,
  bruteWave: 5,
  spawnInterval: 0.85,
  names: [
    'First Shadows',
    'Whispers in the Dark',
    'The Crawl',
    'Spitters in the Dark',
    'The Gloom Brute',
    'Thicker Night',
    'The Swarm',
    'The Long Dark',
    'Almost Dawn',
    'The Gloom Warden',
  ],
};

export function waveComposition(wave) {
  const list = [];
  const add = (kind, count) => { if (count > 0) list.push({ kind, count }); };
  add('wisp', 6 + wave * 3);
  add('crawler', wave >= 2 ? 2 + wave : 0);
  add('spitter', wave >= 3 ? 1 + Math.floor(wave / 2) : 0);
  add('brute', wave >= 4 ? Math.floor((wave - 2) / 2) : 0);
  if (wave === WAVES.bruteWave) add('brute', 1);
  if (wave === WAVES.bossWave) add('warden', 1);
  return list;
}

// Enemy health and speed scale gently with the wave so the same kinds stay
// threatening without turning into bullet sponges.
export function waveScale(wave) {
  return { hp: 1 + (wave - 1) * 0.12, speed: 1 + (wave - 1) * 0.03 };
}

// Blessings offered between waves: pick one of three. Each one changes how the
// keeper fights, so the choice matters every time.
export const UPGRADES = [
  { id: 'twin',    name: 'Twin Ember',   desc: 'Fire one extra ember each shot.', max: 2,
    line: 'Two flames fly where one flew.' },
  { id: 'rapid',   name: 'Rapid Wick',   desc: 'Shoot 22% faster.', max: 3,
    line: 'The wick burns quicker, the night retreats faster.' },
  { id: 'flame',   name: 'Wide Flame',   desc: 'Lantern light reaches 45 further and burns harder.', max: 3,
    line: 'Hold the lantern high; the dark hates the light.' },
  { id: 'boots',   name: 'Swift Boots',  desc: 'Move 14% faster.', max: 3,
    line: 'Outrun what cannot be outfought.' },
  { id: 'heart',   name: 'Heart of Ember', desc: 'Gain a heart and mend one.', max: 3,
    line: 'The flame lends you its warmth.' },
  { id: 'pierce',  name: 'Piercing Ember', desc: 'Embers pass through one more shadow.', max: 2,
    line: 'Light does not stop at the first shadow.' },
  { id: 'magnet',  name: 'Shard Magnet', desc: 'Ember shards fly to you from much further.', max: 2,
    line: 'What the night drops, the light gathers.' },
  { id: 'heavy',   name: 'Heavy Ember',  desc: 'Embers hit for +1 damage.', max: 3,
    line: 'A heavier ember, a shorter night.' },
];

// Score: kills pay their kind's score, shards pay 5 each, clearing a wave pays
// 100 times the wave number.
export const SCORE = { shard: 5, waveClear: 100 };

// Colours: one night, one flame. The whole game is drawn from this palette so
// any frame reads at a glance, even shrunk to a contact sheet.
export const PALETTE = {
  skyTop: '#0b1026',
  skyBottom: '#05070f',
  ground: '#0d1330',
  amber: '#ffb347',
  amberHot: '#ffe08a',
  ember: '#ff7a2f',
  violet: '#2a1b4a',
  violetDeep: '#160d2e',
  eyeWisp: '#c9a7ff',
  bone: '#f2ead8',
  danger: '#ff5c7a',
  leaf: '#7ee081',
};
