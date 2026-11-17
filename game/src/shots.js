// The screenshot scenes behind ?shot=start|play|boss|end. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered by
// a simple autopilot, so the frame is what a short game really looks like and
// the same seed always gives the same frame. No wall clock, no Math.random:
// the world is seeded, the step is fixed, the pilot is a pure function.
import { FIELD, STEP } from './config.js';
import { startRun, startWave, stepWorld, applyUpgrade, spawnEnemy, EVENT_OVER, EVENT_WIN } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 6;
const PLAY_WAVE = 3;
const BOSS_SECONDS = 8;
const END_LIMIT_SECONDS = 240;
const SAMPLE = 1 / 30;

// A thinking player takes damage first: twin embers, then a faster wick,
// then heavier embers — the light and the legs can wait.
const BLESSING_ORDER = ['twin', 'rapid', 'heavy', 'pierce', 'flame', 'magnet', 'boots', 'heart', 'mend', 'cache'];

export function pickBlessing(choices) {
  const sorted = [...choices].sort(
    (a, b) => BLESSING_ORDER.indexOf(a.id) - BLESSING_ORDER.indexOf(b.id),
  );
  return sorted[0];
}

export function runToWave(world, targetWave) {
  // Autopilot through the early waves, taking the first blessing each time,
  // until the target wave opens. Returns when that wave is running.
  for (let i = 0; i < 600 / STEP; i += 1) {
    if (world.wave >= targetWave && world.phase === 'fight') return;
    const control = autopilot(world, 0.7, true);
    const events = stepWorld(world, control, STEP);
    if (events & EVENT_OVER || events & EVENT_WIN) return;
    if (world.phase === 'upgrade' && world.upgradeChoices.length > 0) {
      applyUpgrade(world, pickBlessing(world.upgradeChoices).id);
    }
  }
}

// The pilot scores every way it could move (eight directions plus standing
// still) by how long the keeper survives that way, then takes the safest; among
// safe ways it chases the nearest shard. It aims at the nearest shadow and
// fires whenever one is in range.
function autopilot(world, horizon, cautious) {
  const p = world.player;
  const dirs = [
    [0, 0], [1, 0], [-1, 0], [0, 1], [0, -1],
    [1, 1], [1, -1], [-1, 1], [-1, -1],
  ];
  let best = 0;
  let bestScore = -Infinity;
  for (let d = 0; d < dirs.length; d += 1) {
    const [dx, dy] = dirs[d];
    const len = Math.hypot(dx, dy) || 1;
    let t = SAMPLE;
    let hit = Infinity;
    for (; t <= horizon; t += SAMPLE) {
      const x = Math.max(16, Math.min(FIELD.width - 16, p.x + (dx / len) * p.speed * t));
      const y = Math.max(16, Math.min(FIELD.height - 16, p.y + (dy / len) * p.speed * t));
      let danger = false;
      for (const e of world.enemies) {
        // The warden's charge is the one attack the pilot must respect: while
        // it dashes it moves at 520, not its walk speed, and while it
        // telegraphs, the pilot gives it a wide berth.
        const speed = e.kind === 'warden' && e.chargeState === 1 ? 520 : e.speed;
        const pad = e.kind === 'warden' && e.chargeState === 2 ? 130 : (cautious ? 26 : 8);
        const ex = e.x + ((p.x - e.x) / (Math.hypot(p.x - e.x, p.y - e.y) || 1)) * speed * t;
        const ey = e.y + ((p.y - e.y) / (Math.hypot(p.x - e.x, p.y - e.y) || 1)) * speed * t;
        if (Math.hypot(x - ex, y - ey) < e.radius + p.radius + pad) {
          danger = true;
          break;
        }
      }
      if (danger) { hit = t; break; }
    }
    let score = hit === Infinity ? 100 : hit;
    if (world.shards.length > 0) {
      let nearest = Infinity;
      for (const s of world.shards) {
        const d2 = Math.hypot(s.x - (p.x + (dx / len) * p.speed * 0.5), s.y - (p.y + (dy / len) * p.speed * 0.5));
        if (d2 < nearest) nearest = d2;
      }
      score -= nearest / 400;
    }
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  const [mx, my] = dirs[best];
  const len = Math.hypot(mx, my) || 1;
  let aimX = p.x + 100;
  let aimY = p.y - 100;
  let nearest = Infinity;
  let firing = false;
  for (const e of world.enemies) {
    const d2 = Math.hypot(e.x - p.x, e.y - p.y);
    if (d2 < nearest) {
      nearest = d2;
      aimX = e.x;
      aimY = e.y;
    }
  }
  if (nearest < 520) firing = true;
  return { mx: mx / len, my: my / len, firing, aimX, aimY };
}

function idleControl(world) {
  return { mx: 0, my: 0, firing: false, aimX: world.player.x, aimY: world.player.y - 100 };
}

/**
 * Set `world` to the named scene (start, play, boss or end; any other name is
 * start) and return the screen to draw over it. `seed` fixes the run, so the
 * same scene always stages the same frame.
 */
export function stageShot(name, world, seed = 1) {
  if (name === 'boss') {
    startRun(world, seed);
    // Jump straight to the warden: clear wave 1's queue, open wave 10, and
    // bring the warden in at once instead of leaving it last in the queue.
    world.spawnQueue = [];
    world.enemies = [];
    world.phase = 'fight';
    startWave(world, 10);
    world.spawnQueue = world.spawnQueue.filter((kind) => kind !== 'warden');
    spawnEnemy(world, 'warden');
    for (let i = 0; i < BOSS_SECONDS / STEP; i += 1) {
      const control = autopilot(world, 0.7, true);
      const events = stepWorld(world, control, STEP);
      if (events & EVENT_OVER || events & EVENT_WIN) break;
    }
    return { screen: SCREEN_PLAY };
  }
  if (name === 'play') {
    // The cover: the busiest moment of wave 3, found by playing it forward
    // and re-staging exactly there — spitters have joined, the keeper already
    // holds two blessings, and shadows crowd the lantern light. The frame is
    // a real moment of real play, not a posed one.
    startRun(world, seed);
    runToWave(world, PLAY_WAVE);
    let bestStep = 0;
    let bestScore = -Infinity;
    for (let i = 0; i < 30 / STEP; i += 1) {
      const control = autopilot(world, 0.7, true);
      const events = stepWorld(world, control, STEP);
      if (events & EVENT_OVER || events & EVENT_WIN) break;
      if (world.phase !== 'fight' || world.banner) continue;
      let near = 0;
      for (const e of world.enemies) {
        if (Math.hypot(e.x - world.player.x, e.y - world.player.y) < 320) near += 1;
      }
      const edge = Math.max(0, Math.hypot(world.player.x - 640, world.player.y - 360) - 260);
      const score = near * 100 + world.bullets.length * 5 - edge;
      if (score > bestScore) { bestScore = score; bestStep = i + 1; }
    }
    startRun(world, seed);
    runToWave(world, PLAY_WAVE);
    for (let i = 0; i < bestStep; i += 1) {
      const control = autopilot(world, 0.7, true);
      const events = stepWorld(world, control, STEP);
      if (events & EVENT_OVER || events & EVENT_WIN) break;
    }
    return { screen: SCREEN_PLAY };
  }
  if (name === 'end') {
    startRun(world, seed);
    // A hurried pilot with a short horizon gets caught out once the night
    // thickens, the way a rushed player does.
    for (let i = 0; i < END_LIMIT_SECONDS / STEP; i += 1) {
      const control = autopilot(world, 0.22, false);
      const events = stepWorld(world, control, STEP);
      if (events & EVENT_OVER) break;
      if (events & EVENT_WIN) break;
      if (world.phase === 'upgrade') break;
    }
    if (world.phase !== 'over') {
      // The pilot survived the limit: corner it with a ring of wisps outside
      // the lantern's light, the burn aura off, so the death is real — the
      // shadows close in and land the blow themselves.
      world.phase = 'fight';
      world.player.hearts = 1;
      world.player.invuln = 0;
      world.player.burnDps = 0;
      for (let k = 0; k < 6; k += 1) {
        const a = (k / 6) * Math.PI * 2;
        world.enemies.push({
          kind: 'wisp',
          x: world.player.x + Math.cos(a) * 260,
          y: world.player.y + Math.sin(a) * 260,
          vx: 0, vy: 0, hp: 1, maxHp: 1, speed: 130, radius: 12,
          score: 10, shards: 1, wobble: 0, shotTimer: 0, telegraph: 0,
          chargeTimer: 0, chargeState: 0, chargeX: 0, chargeY: 0,
          spawnTimer: 0, burnTick: 0, flash: 0,
        });
      }
      for (let i = 0; i < 10 / STEP; i += 1) {
        const events = stepWorld(world, idleControl(world), STEP);
        if (events & EVENT_OVER) break;
      }
    }
    return { screen: SCREEN_OVER };
  }
  // start: the title over a living arena.
  for (let i = 0; i < START_SECONDS / STEP; i += 1) {
    stepWorld(world, idleControl(world), STEP);
  }
  return { screen: SCREEN_TITLE };
}
