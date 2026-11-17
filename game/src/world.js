// EMBERKEEP's simulation: the whole game state and one fixed step of it. The
// world knows nothing about the DOM, the canvas or the keyboard; main.js feeds
// it a control vector each frame and render.js draws whatever it holds. That
// split is what makes the screenshot scenes possible: shots.js can drive the
// same world with an autopilot and get the same frames a player would see.
import { FIELD, STEP, PLAYER, ENEMIES, WAVES, SCORE, UPGRADES, waveComposition, waveScale } from './config.js';
import { makeRandom } from './random.js';

export const EVENT_NONE = 0;
export const EVENT_WAVE_CLEAR = 1;
export const EVENT_OVER = 2;
export const EVENT_WIN = 4;
export const EVENT_BOSS = 8;

const TAU = Math.PI * 2;

export function createWorld(seed) {
  const rng = makeRandom(seed);
  const world = {
    rng,
    time: 0,
    runTime: 0,
    phase: 'title',
    attract: true,
    wave: 0,
    score: 0,
    kills: 0,
    shotsFired: 0,
    shotsHit: 0,
    best: 0,
    player: null,
    enemies: [],
    bullets: [],
    orbs: [],
    shards: [],
    hearts: [],
    particles: [],
    floats: [],
    spawnQueue: [],
    spawnTimer: 0,
    banner: null,
    shake: 0,
    flash: 0,
    boss: null,
    upgradeChoices: [],
    upgradeTaken: {},
    shardStreak: 0,
    shardStreakTimer: 0,
    stars: [],
    fog: [],
    events: EVENT_NONE,
  };
  resetWorld(world, seed);
  return world;
}

export function resetWorld(world, seed) {
  world.rng = makeRandom(seed);
  world.time = 0;
  world.runTime = 0;
  world.phase = 'title';
  world.attract = true;
  world.wave = 0;
  world.score = 0;
  world.kills = 0;
  world.shotsFired = 0;
  world.shotsHit = 0;
  world.player = makePlayer();
  world.enemies = [];
  world.bullets = [];
  world.orbs = [];
  world.shards = [];
  world.hearts = [];
  world.particles = [];
  world.floats = [];
  world.spawnQueue = [];
  world.spawnTimer = 0;
  world.banner = null;
  world.shake = 0;
  world.flash = 0;
  world.boss = null;
  world.upgradeChoices = [];
  world.upgradeTaken = {};
  world.shardStreak = 0;
  world.shardStreakTimer = 0;
  world.stars = [];
  for (let i = 0; i < 90; i += 1) {
    world.stars.push({
      x: world.rng.range(0, FIELD.width),
      y: world.rng.range(0, FIELD.height),
      r: world.rng.range(0.6, 1.8),
      phase: world.rng.range(0, TAU),
    });
  }
  world.fog = [];
  for (let i = 0; i < 5; i += 1) {
    world.fog.push({
      x: world.rng.range(0, FIELD.width),
      y: world.rng.range(0, FIELD.height),
      r: world.rng.range(180, 320),
      speed: world.rng.range(4, 10),
    });
  }
}

function makePlayer() {
  return {
    x: FIELD.width / 2,
    y: FIELD.height / 2,
    angle: -Math.PI / 2,
    radius: PLAYER.radius,
    hearts: PLAYER.maxHearts,
    maxHearts: PLAYER.maxHearts,
    fireTimer: 0,
    invuln: 0,
    speed: PLAYER.speed,
    damage: PLAYER.bulletDamage,
    fireInterval: PLAYER.fireInterval,
    pierce: 0,
    shots: 1,
    magnet: PLAYER.pickupRadius,
    lightRadius: PLAYER.lightRadius,
    burnDps: PLAYER.burnDps,
  };
}

// A fresh run: wave 1, a clean arena, the keeper at the centre. The seed is
// the run's: pass one for a reproducible run (the screenshot scenes do), or
// leave it out for a fresh random night.
export function startRun(world, seed) {
  resetWorld(world, seed === undefined ? (Math.random() * 0xffffffff) >>> 0 : seed);
  world.attract = false;
  world.phase = 'fight';
  startWave(world, 1);
}

export function startWave(world, wave) {
  world.wave = wave;
  const scale = waveScale(wave);
  const queue = [];
  for (const entry of waveComposition(wave)) {
    for (let i = 0; i < entry.count; i += 1) queue.push(entry.kind);
  }
  // The warden leads its wave in, so the boss fight starts at once and the
  // minions trickle in behind it — a boss that arrives after a minute of
  // waiting is a queue, not a fight.
  world.spawnQueue = world.rng.shuffled(queue.filter((k) => k !== 'warden'));
  const wardens = queue.filter((k) => k === 'warden');
  world.spawnQueue.unshift(...wardens);
  world.spawnTimer = 0.6;
  world.waveScale = scale;
  world.banner = {
    text: `WAVE ${wave}`,
    sub: WAVES.names[wave - 1],
    t: 2.4,
  };
  world.phase = 'fight';
  return wave === WAVES.bossWave;
}

function spawnPoint(world) {
  const p = world.player;
  for (let tries = 0; tries < 12; tries += 1) {
    const edge = world.rng.int(0, 3);
    let x;
    let y;
    if (edge === 0) { x = world.rng.range(30, FIELD.width - 30); y = 24; }
    else if (edge === 1) { x = world.rng.range(30, FIELD.width - 30); y = FIELD.height - 24; }
    else if (edge === 2) { x = 24; y = world.rng.range(30, FIELD.height - 30); }
    else { x = FIELD.width - 24; y = world.rng.range(30, FIELD.height - 30); }
    const dx = x - p.x;
    const dy = y - p.y;
    if (dx * dx + dy * dy > 220 * 220) return { x, y };
  }
  return { x: 24, y: 24 };
}

export function spawnEnemy(world, kind) {
  const def = ENEMIES[kind];
  const scale = world.waveScale || { hp: 1, speed: 1 };
  const pos = spawnPoint(world);
  const enemy = {
    kind,
    x: pos.x,
    y: pos.y,
    vx: 0,
    vy: 0,
    hp: Math.round(def.hp * scale.hp),
    maxHp: Math.round(def.hp * scale.hp),
    speed: def.speed * scale.speed * world.rng.range(0.9, 1.1),
    radius: def.radius,
    score: def.score,
    shards: def.shards,
    wobble: world.rng.range(0, TAU),
    shotTimer: world.rng.range(1.2, 2.4),
    telegraph: 0,
    chargeTimer: 7,
    chargeState: 0,
    chargeX: 0,
    chargeY: 0,
    spawnTimer: 9,
    burnTick: 0,
    flash: 0,
  };
  world.enemies.push(enemy);
  if (kind === 'warden') {
    world.boss = enemy;
    world.events |= EVENT_BOSS;
  }
  return enemy;
}

function burst(world, x, y, color, count, speed) {
  for (let i = 0; i < count; i += 1) {
    const a = world.rng.range(0, TAU);
    const s = world.rng.range(speed * 0.3, speed);
    world.particles.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: world.rng.range(0.3, 0.7),
      maxLife: 0.7,
      size: world.rng.range(1.5, 3.5),
      color,
      kind: 'spark',
    });
  }
}

function addFloat(world, x, y, text, color) {
  world.floats.push({ x, y, text, color, life: 1.0 });
}

function dropLoot(world, enemy) {
  for (let i = 0; i < enemy.shards; i += 1) {
    const a = world.rng.range(0, TAU);
    world.shards.push({
      x: enemy.x,
      y: enemy.y,
      vx: Math.cos(a) * world.rng.range(20, 70),
      vy: Math.sin(a) * world.rng.range(20, 70),
      life: 15,
    });
  }
  if (enemy.kind === 'brute' && world.rng.next() < 0.3) {
    world.hearts.push({ x: enemy.x, y: enemy.y, life: 12 });
  }
  if (enemy.kind === 'warden') {
    world.hearts.push({ x: enemy.x - 30, y: enemy.y, life: 15 });
    world.hearts.push({ x: enemy.x + 30, y: enemy.y, life: 15 });
  }
}

function killEnemy(world, enemy, index) {
  world.enemies.splice(index, 1);
  world.kills += 1;
  world.score += enemy.score;
  addFloat(world, enemy.x, enemy.y - enemy.radius, `+${enemy.score}`, '#ffe08a');
  burst(world, enemy.x, enemy.y, '#b388ff', enemy.kind === 'brute' ? 22 : 12, 180);
  burst(world, enemy.x, enemy.y, '#ffb347', 8, 120);
  dropLoot(world, enemy);
  if (enemy.kind === 'brute') {
    for (let i = 0; i < 2; i += 1) {
      const wisp = spawnEnemy(world, 'wisp');
      wisp.x = enemy.x + world.rng.range(-30, 30);
      wisp.y = enemy.y + world.rng.range(-30, 30);
    }
  }
  if (enemy.kind === 'warden') {
    world.boss = null;
    world.shake = 14;
    world.particles.push({
      x: enemy.x, y: enemy.y, vx: 0, vy: 0, life: 0.8, maxLife: 0.8,
      size: enemy.radius, color: '#ffb347', kind: 'ring',
    });
  }
}

function hurtPlayer(world, fromX, fromY) {
  const p = world.player;
  if (p.invuln > 0 || world.attract || world.phase !== 'fight') return;
  p.hearts -= 1;
  p.invuln = PLAYER.invulnSeconds;
  world.flash = 0.55;
  world.shake = 10;
  const dx = p.x - fromX;
  const dy = p.y - fromY;
  const len = Math.hypot(dx, dy) || 1;
  p.x = Math.max(p.radius, Math.min(FIELD.width - p.radius, p.x + (dx / len) * 34));
  p.y = Math.max(p.radius, Math.min(FIELD.height - p.radius, p.y + (dy / len) * 34));
  burst(world, p.x, p.y, '#ff5c7a', 14, 200);
  if (p.hearts <= 0) {
    world.phase = 'over';
    world.events |= EVENT_OVER;
    burst(world, p.x, p.y, '#ffb347', 40, 260);
    burst(world, p.x, p.y, '#ff5c7a', 24, 200);
  }
}

function fireBullets(world, aimX, aimY) {
  const p = world.player;
  const base = Math.atan2(aimY - p.y, aimX - p.x);
  p.angle = base;
  const spread = 0.14;
  for (let i = 0; i < p.shots; i += 1) {
    const offset = (i - (p.shots - 1) / 2) * spread;
    const a = base + offset;
    world.bullets.push({
      x: p.x + Math.cos(a) * (p.radius + 8),
      y: p.y + Math.sin(a) * (p.radius + 8),
      vx: Math.cos(a) * PLAYER.bulletSpeed,
      vy: Math.sin(a) * PLAYER.bulletSpeed,
      radius: PLAYER.bulletRadius,
      damage: p.damage,
      pierce: p.pierce,
      life: 1.1,
    });
  }
  world.shotsFired += 1;
}

// The three blessings offered after a wave. Choices already taken to their cap
// leave the pool; if fewer than three remain, a mend and a cache fill the row.
export function rollUpgrades(world) {
  const pool = UPGRADES.filter((u) => (world.upgradeTaken[u.id] || 0) < u.max);
  const picked = world.rng.shuffled(pool).slice(0, 3);
  const fallbacks = [
    { id: 'mend', name: 'Mend', desc: 'Restore 1 heart now.', max: 99, line: 'The flame lends you its warmth.' },
    { id: 'cache', name: 'Ember Cache', desc: '+150 score, banked at once.', max: 99, line: 'Small light, kept well.' },
  ];
  let f = 0;
  while (picked.length < 3 && f < fallbacks.length) {
    picked.push(fallbacks[f]);
    f += 1;
  }
  world.upgradeChoices = picked;
  return picked;
}

export function applyUpgrade(world, id) {
  const p = world.player;
  world.upgradeTaken[id] = (world.upgradeTaken[id] || 0) + 1;
  if (id === 'twin') p.shots = Math.min(3, p.shots + 1);
  else if (id === 'rapid') p.fireInterval *= 0.78;
  else if (id === 'flame') { p.lightRadius += 45; p.burnDps += 1.2; }
  else if (id === 'boots') p.speed *= 1.14;
  else if (id === 'heart') { p.maxHearts += 1; p.hearts = Math.min(p.maxHearts, p.hearts + 1); }
  else if (id === 'pierce') p.pierce += 1;
  else if (id === 'magnet') p.magnet += 90;
  else if (id === 'heavy') p.damage += 1;
  else if (id === 'mend') p.hearts = Math.min(p.maxHearts, p.hearts + 1);
  else if (id === 'cache') world.score += 150;
  world.phase = 'fight';
  if (world.wave >= WAVES.total) {
    world.phase = 'win';
    world.events |= EVENT_WIN;
    return;
  }
  startWave(world, world.wave + 1);
}

// One fixed step. `control` is { mx, my, firing, aimX, aimY } in field space.
// Returns the event bitmask for this step; main.js reads world.events after.
export function stepWorld(world, control, dt = STEP) {
  world.events = EVENT_NONE;
  world.time += dt;
  if (world.phase === 'fight') world.runTime += dt;
  if (world.banner) {
    world.banner.t -= dt;
    if (world.banner.t <= 0) world.banner = null;
  }
  if (world.shake > 0) world.shake = Math.max(0, world.shake - dt * 26);
  if (world.flash > 0) world.flash = Math.max(0, world.flash - dt * 1.8);
  if (world.shardStreakTimer > 0) {
    world.shardStreakTimer -= dt;
    if (world.shardStreakTimer <= 0) world.shardStreak = 0;
  }
  for (const f of world.fog) {
    f.x += f.speed * dt;
    if (f.x - f.r > FIELD.width) f.x = -f.r;
  }

  const p = world.player;
  if (p.invuln > 0) p.invuln -= dt;
  if (p.fireTimer > 0) p.fireTimer -= dt;

  // --- movement and firing (not while the title idles) ---
  if (world.phase === 'fight') {
    p.x = Math.max(p.radius, Math.min(FIELD.width - p.radius, p.x + control.mx * p.speed * dt));
    p.y = Math.max(p.radius, Math.min(FIELD.height - p.radius, p.y + control.my * p.speed * dt));
    if (control.firing && p.fireTimer <= 0) {
      p.fireTimer = p.fireInterval;
      fireBullets(world, control.aimX, control.aimY);
    }
  } else if (world.phase === 'title' || world.attract) {
    // The title idles: the keeper stands in the lantern light while shadows
    // drift in and burn. No input, no damage, no waves.
    if (world.enemies.length < 7 && world.rng.next() < dt * 0.8) {
      spawnEnemy(world, world.rng.pick(['wisp', 'wisp', 'crawler']));
    }
  }

  // --- spawning ---
  // The night thickens as the waves go on: the trickle quickens from 0.85s
  // on wave 1 to 0.5s by wave 8, so later waves crowd the lantern light.
  if (world.phase === 'fight' && world.spawnQueue.length > 0) {
    world.spawnTimer -= dt;
    if (world.spawnTimer <= 0) {
      const interval = Math.max(0.5, WAVES.spawnInterval - world.wave * 0.05);
      world.spawnTimer = interval * world.rng.range(0.8, 1.2);
      spawnEnemy(world, world.spawnQueue.shift());
    }
  }

  // --- enemies ---
  const burn = world.attract ? p.burnDps * 4 : p.burnDps;
  for (let i = world.enemies.length - 1; i >= 0; i -= 1) {
    const e = world.enemies[i];
    if (e.flash > 0) e.flash -= dt;
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = dx / dist;
    const ny = dy / dist;

    // The lantern's light slows what stands inside it. Only the inner
    // flame burns: the light scorches shadows as they close in, but the
    // keeper's embers must finish them — the light alone must never win
    // a wave by itself.
    let speed = e.speed;
    if (dist < p.lightRadius + e.radius) {
      speed *= 0.72;
    }
    if (dist < p.lightRadius * 0.45 + e.radius) {
      e.burnTick += dt;
      if (e.burnTick >= 0.5) {
        e.burnTick = 0;
        e.hp -= burn * 0.5 * (e.kind === 'warden' ? 0.5 : 1);
        if (e.hp <= 0) {
          killEnemy(world, e, i);
          continue;
        }
      }
    }

    if (e.kind === 'wisp') {
      const wob = Math.sin(world.time * 3 + e.wobble) * 0.5;
      e.x += (nx + -ny * wob) * speed * dt;
      e.y += (ny + nx * wob) * speed * dt;
    } else if (e.kind === 'crawler' || e.kind === 'brute') {
      e.x += nx * speed * dt;
      e.y += ny * speed * dt;
    } else if (e.kind === 'spitter') {
      if (dist > ENEMIES.spitter.range) {
        e.x += nx * speed * dt;
        e.y += ny * speed * dt;
      } else if (dist < ENEMIES.spitter.range * 0.6) {
        e.x -= nx * speed * 0.6 * dt;
        e.y -= ny * speed * 0.6 * dt;
      } else {
        e.x += -ny * speed * 0.4 * dt;
        e.y += nx * speed * 0.4 * dt;
      }
      e.shotTimer -= dt;
      if (e.telegraph > 0) {
        e.telegraph -= dt;
        if (e.telegraph <= 0) {
          world.orbs.push({
            x: e.x, y: e.y,
            vx: nx * ENEMIES.spitter.orbSpeed,
            vy: ny * ENEMIES.spitter.orbSpeed,
            radius: 7, life: 4,
          });
          e.shotTimer = ENEMIES.spitter.shotInterval * world.rng.range(0.9, 1.2);
        }
      } else if (e.shotTimer <= 0 && dist < ENEMIES.spitter.range + 60) {
        e.telegraph = 0.45;
      }
    } else if (e.kind === 'warden') {
      if (e.chargeState === 1) {
        e.chargeTimer -= dt;
        e.x += e.chargeX * 520 * dt;
        e.y += e.chargeY * 520 * dt;
        e.x = Math.max(e.radius, Math.min(FIELD.width - e.radius, e.x));
        e.y = Math.max(e.radius, Math.min(FIELD.height - e.radius, e.y));
        if (e.chargeTimer <= 0) e.chargeState = 0;
      } else if (e.chargeState === 2) {
        e.chargeTimer -= dt;
        if (e.chargeTimer <= 0) {
          e.chargeState = 1;
          e.chargeTimer = 0.55;
          e.chargeX = nx;
          e.chargeY = ny;
        }
      } else {
        e.x += nx * speed * dt;
        e.y += ny * speed * dt;
        e.chargeTimer -= dt;
        if (e.chargeTimer <= 0) {
          e.chargeState = 2;
          e.chargeTimer = 0.8;
        }
        e.spawnTimer -= dt;
        if (e.spawnTimer <= 0) {
          e.spawnTimer = 9;
          const minions = world.enemies.filter((m) => m.kind === 'wisp').length;
          if (minions < 12) {
            for (let k = 0; k < 3; k += 1) {
              const wisp = spawnEnemy(world, 'wisp');
              wisp.x = e.x + world.rng.range(-60, 60);
              wisp.y = e.y + world.rng.range(-60, 60);
            }
          }
        }
      }
    }

    // Touching the keeper hurts.
    const pdx = p.x - e.x;
    const pdy = p.y - e.y;
    const pr = p.radius + e.radius - 4;
    if (pdx * pdx + pdy * pdy < pr * pr) {
      hurtPlayer(world, e.x, e.y);
      if (world.phase === 'over') return world.events;
      // The shadow recoils a little too, so the hit reads.
      e.x -= nx * 18;
      e.y -= ny * 18;
    }
  }

  // --- player bullets ---
  for (let i = world.bullets.length - 1; i >= 0; i -= 1) {
    const b = world.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0 || b.x < -20 || b.x > FIELD.width + 20 || b.y < -20 || b.y > FIELD.height + 20;
    if (!dead) {
      for (let j = world.enemies.length - 1; j >= 0; j -= 1) {
        const e = world.enemies[j];
        const dx = b.x - e.x;
        const dy = b.y - e.y;
        const r = b.radius + e.radius;
        if (dx * dx + dy * dy < r * r) {
          e.hp -= b.damage;
          e.flash = 0.12;
          world.shotsHit += 1;
          burst(world, b.x, b.y, '#ffb347', 3, 90);
          if (e.hp <= 0) killEnemy(world, e, j);
          if (b.pierce > 0) {
            b.pierce -= 1;
          } else {
            dead = true;
          }
          break;
        }
      }
    }
    if (dead) world.bullets.splice(i, 1);
  }

  // --- shadow orbs ---
  for (let i = world.orbs.length - 1; i >= 0; i -= 1) {
    const o = world.orbs[i];
    o.x += o.vx * dt;
    o.y += o.vy * dt;
    o.life -= dt;
    let dead = o.life <= 0 || o.x < -20 || o.x > FIELD.width + 20 || o.y < -20 || o.y > FIELD.height + 20;
    if (!dead) {
      const dx = o.x - p.x;
      const dy = o.y - p.y;
      const r = o.radius + p.radius - 2;
      if (dx * dx + dy * dy < r * r) {
        dead = true;
        hurtPlayer(world, o.x - o.vx, o.y - o.vy);
        if (world.phase === 'over') return world.events;
      }
    }
    if (dead) world.orbs.splice(i, 1);
  }

  // --- shards ---
  for (let i = world.shards.length - 1; i >= 0; i -= 1) {
    const s = world.shards[i];
    s.life -= dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.vx *= 1 - 3 * dt;
    s.vy *= 1 - 3 * dt;
    const dx = p.x - s.x;
    const dy = p.y - s.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (dist < p.magnet) {
      s.x += (dx / dist) * 320 * dt;
      s.y += (dy / dist) * 320 * dt;
    }
    if (dist < p.radius + 12) {
      world.shards.splice(i, 1);
      world.score += SCORE.shard;
      world.shardStreak += 1;
      world.shardStreakTimer = 2.5;
      continue;
    }
    if (s.life <= 0) world.shards.splice(i, 1);
  }

  // --- heart pickups ---
  for (let i = world.hearts.length - 1; i >= 0; i -= 1) {
    const h = world.hearts[i];
    h.life -= dt;
    const dx = p.x - h.x;
    const dy = p.y - h.y;
    if (dx * dx + dy * dy < (p.radius + 16) * (p.radius + 16)) {
      world.hearts.splice(i, 1);
      p.hearts = Math.min(p.maxHearts, p.hearts + 1);
      addFloat(world, p.x, p.y - 30, '+1 ♥', '#ff8fa3');
      continue;
    }
    if (h.life <= 0) world.hearts.splice(i, 1);
  }

  // --- particles and floating text ---
  for (let i = world.particles.length - 1; i >= 0; i -= 1) {
    const pt = world.particles[i];
    pt.life -= dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 1 - 2.5 * dt;
    pt.vy *= 1 - 2.5 * dt;
    if (pt.life <= 0) world.particles.splice(i, 1);
  }
  for (let i = world.floats.length - 1; i >= 0; i -= 1) {
    const f = world.floats[i];
    f.life -= dt * 0.9;
    f.y -= 26 * dt;
    if (f.life <= 0) world.floats.splice(i, 1);
  }

  // --- wave clear ---
  if (world.phase === 'fight' && world.spawnQueue.length === 0 && world.enemies.length === 0) {
    const bonus = SCORE.waveClear * world.wave;
    world.score += bonus;
    addFloat(world, FIELD.width / 2, FIELD.height / 2 - 60, `WAVE CLEAR +${bonus}`, '#ffe08a');
    world.particles.push({
      x: p.x, y: p.y, vx: 0, vy: 0, life: 0.9, maxLife: 0.9,
      size: p.lightRadius, color: '#ffb347', kind: 'ring',
    });
    if (world.wave >= WAVES.total) {
      world.phase = 'win';
      world.events |= EVENT_WIN;
    } else {
      world.phase = 'upgrade';
      rollUpgrades(world);
      world.events |= EVENT_WAVE_CLEAR;
    }
  }

  return world.events;
}
