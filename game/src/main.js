// EMBERKEEP's front door: the canvas, the fixed-step loop, the screen state
// machine, and the wiring between the player's hands and the world. The world
// itself lives in world.js and knows nothing about this file; the renderer in
// render.js knows nothing about input. This file is the only place the three
// meet, which is what keeps a screenshot scene on the same code path as play.
import { FIELD, STEP } from './config.js';
import { createWorld, startRun, stepWorld, applyUpgrade, EVENT_BOSS, EVENT_OVER, EVENT_WAVE_CLEAR, EVENT_WIN } from './world.js';
import { drawWorld, SCREEN_TITLE, SCREEN_PLAY, SCREEN_UPGRADE, SCREEN_OVER, SCREEN_WIN, SCREEN_PAUSE } from './render.js';
import { stageShot } from './shots.js';
import { Input } from './input.js';
import { SoundBank } from './audio.js';

const BEST_KEY = 'emberkeep.best';

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const ctx = canvas.getContext('2d');

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number(params.get('seed'));
const seed = Number.isFinite(seedParam) ? seedParam : 1;

const world = createWorld(seed);
try {
  world.best = Number(window.localStorage.getItem(BEST_KEY) || 0) || 0;
} catch {
  world.best = 0;
}

const input = new Input(canvas);
const sound = new SoundBank();

let screen = SCREEN_TITLE;
let paused = false;
let prevKills = 0;
let prevShots = 0;
let prevHearts = world.player.hearts;
let prevStreak = 0;
let prevBanner = null;

function saveBest() {
  if (world.score > world.best) {
    world.best = world.score;
    try {
      window.localStorage.setItem(BEST_KEY, String(world.best));
    } catch {
      // Private mode or no storage: the best score simply does not persist.
    }
  }
}

function announce(text) {
  if (statusEl) statusEl.textContent = text;
}

function fitCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#05070f';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const scale = Math.min(canvas.width / FIELD.width, canvas.height / FIELD.height);
  const ox = (canvas.width - FIELD.width * scale) / 2;
  const oy = (canvas.height - FIELD.height * scale) / 2;
  ctx.setTransform(scale, 0, 0, scale, ox, oy);
  const mouse = { x: input.mouseX, y: input.mouseY };
  drawWorld(ctx, world, paused ? SCREEN_PAUSE : screen, mouse);
}

// Sounds are driven by watching the world's counters change across a step:
// a kill, a shot, a lost heart, a collected shard each play exactly once.
function playStepSounds(events) {
  if (world.shotsFired > prevShots) sound.shoot();
  if (world.kills > prevKills) sound.die();
  if (world.player.hearts < prevHearts) sound.hurt();
  if (world.shardStreak > prevStreak) sound.shard(world.shardStreak);
  if (world.banner && world.banner !== prevBanner) sound.waveStart();
  if (events & EVENT_BOSS) sound.bossRoar();
  if (events & EVENT_WAVE_CLEAR) sound.upgrade();
  if (events & EVENT_OVER) {
    saveBest();
    sound.gameOver();
  }
  if (events & EVENT_WIN) {
    saveBest();
    sound.victory();
  }
  prevShots = world.shotsFired;
  prevKills = world.kills;
  prevHearts = world.player.hearts;
  prevStreak = world.shardStreak;
  prevBanner = world.banner;
}

function nearestEnemy() {
  let best = null;
  let bestDist = Infinity;
  for (const e of world.enemies) {
    const d = Math.hypot(e.x - world.player.x, e.y - world.player.y);
    if (d < bestDist) {
      bestDist = d;
      best = e;
    }
  }
  return best;
}

function controlFromInput() {
  const mv = input.moveVector();
  let aimX = input.mouseX;
  let aimY = input.mouseY;
  // Space fires toward the nearest shadow, for players without a mouse.
  if (input.keys.has(' ') && !input.mouseDown) {
    const target = nearestEnemy();
    if (target) {
      aimX = target.x;
      aimY = target.y;
    }
  }
  return { mx: mv.x, my: mv.y, firing: input.firing(), aimX, aimY };
}

function cardAt(mouse) {
  const cards = world.upgradeChoices;
  const cw = 300;
  const ch = 250;
  const gap = 36;
  const total = cards.length * cw + (cards.length - 1) * gap;
  const x0 = FIELD.width / 2 - total / 2;
  const y = 250;
  for (let i = 0; i < cards.length; i += 1) {
    const x = x0 + i * (cw + gap);
    if (mouse.x >= x && mouse.x <= x + cw && mouse.y >= y && mouse.y <= y + ch) return i;
  }
  return -1;
}

function handleClicks() {
  for (const click of input.drainClicks()) {
    sound.unlock();
    sound.startDrone();
    if (screen === SCREEN_TITLE) {
      startRun(world);
      screen = SCREEN_PLAY;
      announce('The fight begins. Wave 1.');
      prevKills = 0;
      prevShots = 0;
      prevHearts = world.player.hearts;
      prevStreak = 0;
    } else if (screen === SCREEN_UPGRADE) {
      const index = cardAt(click);
      if (index >= 0) {
        const choice = world.upgradeChoices[index];
        applyUpgrade(world, choice.id);
        screen = world.phase === 'win' ? SCREEN_WIN : SCREEN_PLAY;
        announce(`Blessing chosen: ${choice.name}. Wave ${world.wave}.`);
      }
    } else if (screen === SCREEN_OVER || screen === SCREEN_WIN) {
      startRun(world);
      screen = SCREEN_PLAY;
      announce('The fight begins again. Wave 1.');
      prevKills = 0;
      prevShots = 0;
      prevHearts = world.player.hearts;
      prevStreak = 0;
    } else if (paused) {
      paused = false;
    }
  }
}

function handleKeys() {
  if (input.wasPressed('m') || input.wasPressed('M')) {
    sound.setMuted(!sound.muted);
  }
  if (screen === SCREEN_TITLE && (input.wasPressed('Enter') || input.wasPressed(' '))) {
    sound.unlock();
    sound.startDrone();
    startRun(world);
    screen = SCREEN_PLAY;
    announce('The fight begins. Wave 1.');
  } else if (screen === SCREEN_UPGRADE) {
    for (let i = 0; i < world.upgradeChoices.length; i += 1) {
      if (input.wasPressed(String(i + 1))) {
        const choice = world.upgradeChoices[i];
        applyUpgrade(world, choice.id);
        screen = world.phase === 'win' ? SCREEN_WIN : SCREEN_PLAY;
        announce(`Blessing chosen: ${choice.name}. Wave ${world.wave}.`);
        break;
      }
    }
  } else if ((screen === SCREEN_OVER || screen === SCREEN_WIN) && input.wasPressed('Enter')) {
    sound.unlock();
    startRun(world);
    screen = SCREEN_PLAY;
    announce('The fight begins again. Wave 1.');
  } else if (screen === SCREEN_PLAY && (input.wasPressed('p') || input.wasPressed('P') || input.wasPressed('Escape'))) {
    paused = !paused;
    announce(paused ? 'Paused.' : 'Back to the fight.');
  }
}

// --- the loop: a fixed 1/60 s step, at most five per frame, then one draw. ---
let last = performance.now();
let accumulator = 0;

function frame(now) {
  const elapsed = Math.min(0.25, (now - last) / 1000);
  last = now;
  handleKeys();
  handleClicks();
  if (!paused && (screen === SCREEN_PLAY || screen === SCREEN_TITLE)) {
    accumulator += elapsed;
    let steps = 0;
    while (accumulator >= STEP && steps < 5) {
      const events = stepWorld(world, screen === SCREEN_PLAY ? controlFromInput() : { mx: 0, my: 0, firing: false, aimX: world.player.x, aimY: world.player.y - 100 }, STEP);
      playStepSounds(events);
      if (world.phase === 'upgrade') screen = SCREEN_UPGRADE;
      else if (world.phase === 'over') screen = SCREEN_OVER;
      else if (world.phase === 'win') screen = SCREEN_WIN;
      accumulator -= STEP;
      steps += 1;
    }
    if (steps === 5) accumulator = 0;
  } else if (screen === SCREEN_UPGRADE || screen === SCREEN_OVER || screen === SCREEN_WIN) {
    // The world keeps breathing behind the overlay: particles drift, the
    // lantern flickers, but no wave advances.
    accumulator += elapsed;
    let steps = 0;
    while (accumulator >= STEP && steps < 5) {
      stepWorld(world, { mx: 0, my: 0, firing: false, aimX: world.player.x, aimY: world.player.y - 100 }, STEP);
      accumulator -= STEP;
      steps += 1;
    }
    if (steps === 5) accumulator = 0;
  }
  render();
  input.endFrame();
  requestAnimationFrame(frame);
}

// A read-only handle for automated checks (and for the curious): the live
// world and the screen being drawn. It changes nothing in the game.
window.__emberkeep = {
  world,
  get screen() { return screen; },
  get paused() { return paused; },
};

// --- screenshot mode: stage one deterministic scene, draw it once, and tell
// the harness the frame is ready. No loop, no audio, no input. ---
if (shotName) {
  const staged = stageShot(shotName, world, seed);
  screen = staged.screen;
  render();
  window.__shotReady = true;
} else {
  announce('Emberkeep. Defend the last lantern.');
  requestAnimationFrame(frame);
}
