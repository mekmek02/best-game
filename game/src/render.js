// Every pixel EMBERKEEP shows. The renderer owns no state of its own: it draws
// the world it is handed, the screen main.js names, and nothing else, so a
// screenshot scene is the same code path as live play. All motion reads
// world.time, never the wall clock, so a seeded run draws the same frame twice.
import { FIELD, PALETTE, WAVES } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_UPGRADE = 'upgrade';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';
export const SCREEN_PAUSE = 'pause';

const TAU = Math.PI * 2;

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fmtTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function drawBackground(ctx, world) {
  const g = ctx.createLinearGradient(0, 0, 0, FIELD.height);
  g.addColorStop(0, PALETTE.skyTop);
  g.addColorStop(1, PALETTE.skyBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);

  // Stars, twinkling on the world's own clock.
  for (const s of world.stars) {
    const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(world.time * 1.3 + s.phase));
    ctx.globalAlpha = tw * 0.8;
    ctx.fillStyle = '#dfe6ff';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Slow fog drifting across the arena.
  for (const f of world.fog) {
    const fg = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
    fg.addColorStop(0, 'rgba(90, 110, 180, 0.07)');
    fg.addColorStop(1, 'rgba(90, 110, 180, 0)');
    ctx.fillStyle = fg;
    ctx.fillRect(f.x - f.r, f.y - f.r, f.r * 2, f.r * 2);
  }

  // The arena floor: a faint ringed ground under the lantern's glow.
  ctx.strokeStyle = 'rgba(120, 140, 220, 0.045)';
  ctx.lineWidth = 1.5;
  for (const r of [120, 220, 320]) {
    ctx.beginPath();
    ctx.arc(FIELD.width / 2, FIELD.height / 2, r, 0, TAU);
    ctx.stroke();
  }
}

function drawLanternGlow(ctx, world) {
  const p = world.player;
  const flicker = 1 + 0.04 * Math.sin(world.time * 9) + 0.03 * Math.sin(world.time * 23);
  const radius = p.lightRadius * flicker;
  const g = ctx.createRadialGradient(p.x, p.y, 10, p.x, p.y, radius);
  g.addColorStop(0, 'rgba(255, 179, 71, 0.34)');
  g.addColorStop(0.55, 'rgba(255, 140, 50, 0.13)');
  g.addColorStop(1, 'rgba(255, 140, 50, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(p.x - radius, p.y - radius, radius * 2, radius * 2);
  // The edge of the light, a thin warm rim the eye can follow.
  ctx.strokeStyle = 'rgba(255, 179, 71, 0.20)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(p.x, p.y, radius, 0, TAU);
  ctx.stroke();
}

function drawFlameIcon(ctx, x, y, size, filled) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 20, size / 20);
  ctx.beginPath();
  ctx.moveTo(0, -10);
  ctx.bezierCurveTo(6, -4, 9, 1, 7, 6);
  ctx.bezierCurveTo(5, 10, -5, 10, -7, 6);
  ctx.bezierCurveTo(-9, 1, -6, -4, 0, -10);
  ctx.closePath();
  ctx.fillStyle = filled ? PALETTE.amber : 'rgba(255, 179, 71, 0.16)';
  ctx.fill();
  ctx.strokeStyle = filled ? PALETTE.amberHot : 'rgba(255, 179, 71, 0.35)';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.restore();
}

function drawShards(ctx, world) {
  for (const s of world.shards) {
    const blink = s.life < 3 ? (Math.sin(world.time * 10) > 0 ? 1 : 0.35) : 1;
    ctx.globalAlpha = blink;
    const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 9);
    g.addColorStop(0, PALETTE.amberHot);
    g.addColorStop(0.5, PALETTE.ember);
    g.addColorStop(1, 'rgba(255, 122, 47, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 9, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#fff3d6';
    ctx.beginPath();
    ctx.arc(s.x, s.y, 2.6, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawHearts(ctx, world) {
  for (const h of world.hearts) {
    const bob = Math.sin(world.time * 4 + h.x) * 3;
    const blink = h.life < 3 ? (Math.sin(world.time * 10) > 0 ? 1 : 0.4) : 1;
    ctx.globalAlpha = blink;
    ctx.save();
    ctx.translate(h.x, h.y + bob);
    ctx.fillStyle = '#ff5c7a';
    ctx.beginPath();
    ctx.moveTo(0, 8);
    ctx.bezierCurveTo(-12, -2, -8, -12, 0, -5);
    ctx.bezierCurveTo(8, -12, 12, -2, 0, 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.beginPath();
    ctx.arc(-4, -4, 2.2, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function drawEnemy(ctx, world, e) {
  const def = { wisp: 12, crawler: 18, spitter: 14, brute: 27, warden: 46 }[e.kind];
  const flash = e.flash > 0;
  ctx.save();
  ctx.translate(e.x, e.y);
  // A wobbling shadow blob: the edge breathes with the world's clock.
  ctx.beginPath();
  const points = 14;
  for (let i = 0; i <= points; i += 1) {
    const a = (i / points) * TAU;
    const wob = 1 + 0.09 * Math.sin(a * 3 + world.time * 4 + e.wobble);
    const r = def * wob;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = e.kind === 'warden' ? '#241239' : PALETTE.violet;
  ctx.fill();
  // A hit reads as a bright rim, not a white blob: the shadow stays dark.
  ctx.strokeStyle = flash ? 'rgba(255, 255, 255, 0.95)' : 'rgba(179, 136, 255, 0.45)';
  ctx.lineWidth = flash ? 3 : 1.6;
  ctx.stroke();

  // The eyes look at the keeper; the warden wears horns.
  const p = world.player;
  const look = Math.atan2(p.y - e.y, p.x - e.x);
  const ex = Math.cos(look);
  const ey = Math.sin(look);
  const eyeColor = e.kind === 'wisp' ? '#c9a7ff' : e.kind === 'spitter' ? '#7ee081' : e.kind === 'brute' ? '#ff5c7a' : e.kind === 'warden' ? '#ffd166' : '#ff9d5c';
  const spread = def * 0.36;
  const fwd = def * 0.22;
  for (const side of [-1, 1]) {
    const px = ex * fwd + -ey * spread * side;
    const py = ey * fwd + ex * spread * side;
    ctx.fillStyle = eyeColor;
    ctx.beginPath();
    ctx.arc(px, py, Math.max(2, def * 0.11), 0, TAU);
    ctx.fill();
  }
  if (e.kind === 'spitter' && e.telegraph > 0) {
    ctx.fillStyle = `rgba(126, 224, 129, ${0.4 + 0.6 * (1 - e.telegraph / 0.45)})`;
    ctx.beginPath();
    ctx.arc(ex * def * 0.5, ey * def * 0.5, 5, 0, TAU);
    ctx.fill();
  }
  if (e.kind === 'brute') {
    ctx.strokeStyle = 'rgba(255, 92, 122, 0.6)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-def * 0.5, -def * 0.2);
    ctx.lineTo(0, def * 0.1);
    ctx.lineTo(def * 0.4, -def * 0.3);
    ctx.stroke();
  }
  if (e.kind === 'warden') {
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-def * 0.7, -def * 0.55);
    ctx.lineTo(-def * 0.95, -def * 1.15);
    ctx.moveTo(def * 0.7, -def * 0.55);
    ctx.lineTo(def * 0.95, -def * 1.15);
    ctx.stroke();
    // The boss's health bar rides above it.
    const bw = 90;
    const bx = -bw / 2;
    const by = -def - 18;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    rr(ctx, bx - 2, by - 2, bw + 4, 10, 5);
    ctx.fill();
    ctx.fillStyle = '#ff5c7a';
    rr(ctx, bx, by, bw * Math.max(0, e.hp / e.maxHp), 6, 3);
    ctx.fill();
  }
  ctx.restore();

  // A small health bar over anything hurt but not dead.
  if (e.kind !== 'warden' && e.hp < e.maxHp) {
    const bw = def * 1.6;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(e.x - bw / 2, e.y - def - 10, bw, 4);
    ctx.fillStyle = '#ffb347';
    ctx.fillRect(e.x - bw / 2, e.y - def - 10, bw * Math.max(0, e.hp / e.maxHp), 4);
  }
}

function drawPlayer(ctx, world) {
  const p = world.player;
  ctx.save();
  ctx.translate(p.x, p.y);
  // Invulnerability blinks the keeper.
  if (p.invuln > 0 && Math.floor(world.time * 14) % 2 === 0) ctx.globalAlpha = 0.45;

  // The cloak: a hooded triangle in deep teal with an amber hem.
  ctx.beginPath();
  ctx.moveTo(0, -p.radius - 2);
  ctx.bezierCurveTo(p.radius * 0.9, -p.radius * 0.2, p.radius * 0.8, p.radius * 0.9, 0, p.radius + 4);
  ctx.bezierCurveTo(-p.radius * 0.8, p.radius * 0.9, -p.radius * 0.9, -p.radius * 0.2, 0, -p.radius - 2);
  ctx.closePath();
  ctx.fillStyle = '#1f6a60';
  ctx.fill();
  ctx.strokeStyle = PALETTE.amber;
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // The hood's shadowed face, two amber eyes toward the aim.
  const ex = Math.cos(p.angle);
  const ey = Math.sin(p.angle);
  ctx.fillStyle = '#08131a';
  ctx.beginPath();
  ctx.arc(ex * 3, ey * 3 - 2, 8.5, 0, TAU);
  ctx.fill();
  for (const side of [-1, 1]) {
    ctx.fillStyle = PALETTE.amberHot;
    ctx.beginPath();
    ctx.arc(ex * 6 + -ey * 3.4 * side, ey * 6 + ex * 3.4 * side - 2, 1.8, 0, TAU);
    ctx.fill();
  }

  // The lantern swings at the keeper's side, its own small glow.
  const swing = Math.sin(world.time * 2.2) * 0.25;
  const lx = Math.cos(p.angle + Math.PI / 2 + swing) * (p.radius + 8);
  const ly = Math.sin(p.angle + Math.PI / 2 + swing) * (p.radius + 8);
  const lg = ctx.createRadialGradient(lx, ly, 0, lx, ly, 16);
  lg.addColorStop(0, 'rgba(255, 224, 138, 0.9)');
  lg.addColorStop(0.4, 'rgba(255, 179, 71, 0.45)');
  lg.addColorStop(1, 'rgba(255, 179, 71, 0)');
  ctx.fillStyle = lg;
  ctx.beginPath();
  ctx.arc(lx, ly, 16, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#3a2a12';
  ctx.fillRect(lx - 3.5, ly - 6, 7, 12);
  ctx.fillStyle = PALETTE.amberHot;
  ctx.fillRect(lx - 2, ly - 3.5, 4, 7);
  ctx.restore();
}

function drawBullets(ctx, world) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const b of world.bullets) {
    const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, 14);
    g.addColorStop(0, 'rgba(255, 224, 138, 0.95)');
    g.addColorStop(0.4, 'rgba(255, 150, 60, 0.55)');
    g.addColorStop(1, 'rgba(255, 150, 60, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 14, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#fff3d6';
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3.4, 0, TAU);
    ctx.fill();
  }
  for (const o of world.orbs) {
    const g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, 13);
    g.addColorStop(0, 'rgba(255, 92, 122, 0.95)');
    g.addColorStop(0.5, 'rgba(179, 136, 255, 0.6)');
    g.addColorStop(1, 'rgba(179, 136, 255, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(o.x, o.y, 13, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawParticles(ctx, world) {
  for (const pt of world.particles) {
    const a = Math.max(0, pt.life / pt.maxLife);
    if (pt.kind === 'ring') {
      ctx.globalAlpha = a * 0.8;
      ctx.strokeStyle = pt.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size * (1 - a) + 10, 0, TAU);
      ctx.stroke();
    } else {
      ctx.globalAlpha = a;
      ctx.strokeStyle = pt.color;
      ctx.lineWidth = pt.size * 0.7;
      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y);
      ctx.lineTo(pt.x - pt.vx * 0.03, pt.y - pt.vy * 0.03);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
  for (const f of world.floats) {
    ctx.globalAlpha = Math.max(0, f.life);
    ctx.font = 'bold 17px Georgia, serif';
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}

function drawHud(ctx, world) {
  const p = world.player;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // Hearts, top left.
  for (let i = 0; i < p.maxHearts; i += 1) {
    drawFlameIcon(ctx, 34 + i * 30, 34, 22, i < p.hearts);
  }
  // Shards, under the hearts.
  ctx.font = 'bold 18px Georgia, serif';
  ctx.fillStyle = PALETTE.amber;
  ctx.fillText(`◆ ${world.score}`, 28, 74);

  // Wave and best, top centre.
  ctx.textAlign = 'center';
  ctx.font = 'bold 22px Georgia, serif';
  ctx.fillStyle = PALETTE.bone;
  ctx.fillText(`WAVE ${Math.max(1, world.wave)} / ${WAVES.total}`, FIELD.width / 2, 36);
  ctx.font = '15px Georgia, serif';
  ctx.fillStyle = 'rgba(242, 234, 216, 0.65)';
  if (world.best > 0) ctx.fillText(`BEST ${world.best}`, FIELD.width / 2, 58);

  // Boss bar, under the wave line.
  if (world.boss) {
    const bw = 320;
    const bx = FIELD.width / 2 - bw / 2;
    const by = 72;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    rr(ctx, bx - 3, by - 3, bw + 6, 14, 7);
    ctx.fill();
    ctx.fillStyle = '#ff5c7a';
    rr(ctx, bx, by, bw * Math.max(0, world.boss.hp / world.boss.maxHp), 8, 4);
    ctx.fill();
    ctx.font = 'bold 13px Georgia, serif';
    ctx.fillStyle = '#ffd166';
    ctx.fillText('THE GLOOM WARDEN', FIELD.width / 2, by + 28);
  }

  // Quiet hints, bottom left.
  ctx.textAlign = 'left';
  ctx.font = '13px Georgia, serif';
  ctx.fillStyle = 'rgba(242, 234, 216, 0.45)';
  ctx.fillText('WASD move · mouse aim · hold click to fire · P pause · M mute', 24, FIELD.height - 18);

  // The wave banner, big and centred, fading.
  if (world.banner) {
    const a = Math.min(1, world.banner.t / 0.6, (2.4 - world.banner.t) / 0.3 + 0.4);
    ctx.globalAlpha = Math.max(0, Math.min(1, a));
    ctx.textAlign = 'center';
    ctx.font = 'bold 54px Georgia, serif';
    ctx.fillStyle = PALETTE.amberHot;
    ctx.shadowColor = 'rgba(255, 179, 71, 0.7)';
    ctx.shadowBlur = 26;
    ctx.fillText(world.banner.text, FIELD.width / 2, FIELD.height / 2 - 70);
    ctx.shadowBlur = 0;
    ctx.font = 'italic 24px Georgia, serif';
    ctx.fillStyle = PALETTE.bone;
    ctx.fillText(world.banner.sub, FIELD.width / 2, FIELD.height / 2 - 34);
    ctx.globalAlpha = 1;
  }

  // Hurt flash and the low-health pulse.
  if (world.flash > 0) {
    const g = ctx.createRadialGradient(
      FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.3,
      FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.75,
    );
    g.addColorStop(0, 'rgba(255, 60, 90, 0)');
    g.addColorStop(1, `rgba(255, 60, 90, ${world.flash * 0.55})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }
  if (p.hearts === 1 && world.phase === 'fight') {
    const pulse = 0.10 + 0.08 * Math.sin(world.time * 5);
    const g = ctx.createRadialGradient(
      FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.32,
      FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.78,
    );
    g.addColorStop(0, 'rgba(255, 60, 90, 0)');
    g.addColorStop(1, `rgba(255, 60, 90, ${pulse})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }
}

function dim(ctx, alpha) {
  ctx.fillStyle = `rgba(4, 6, 14, ${alpha})`;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
}

function drawTitle(ctx, world) {
  dim(ctx, 0.55);
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(255, 179, 71, 0.8)';
  ctx.shadowBlur = 34;
  ctx.font = 'bold 92px Georgia, serif';
  ctx.fillStyle = PALETTE.amberHot;
  ctx.fillText('EMBERKEEP', FIELD.width / 2, 250);
  ctx.shadowBlur = 0;
  ctx.font = 'italic 26px Georgia, serif';
  ctx.fillStyle = PALETTE.bone;
  ctx.fillText('Defend the last lantern. The night is coming.', FIELD.width / 2, 296);
  ctx.font = '18px Georgia, serif';
  ctx.fillStyle = 'rgba(242, 234, 216, 0.85)';
  ctx.fillText('WASD or arrows to move · mouse to aim · hold click or Space to fire', FIELD.width / 2, 360);
  ctx.fillText('Shadows burn inside your lantern light · survive all 10 waves', FIELD.width / 2, 388);
  const blink = 0.65 + 0.35 * Math.sin(world.time * 3);
  ctx.globalAlpha = blink;
  ctx.font = 'bold 24px Georgia, serif';
  ctx.fillStyle = PALETTE.amber;
  ctx.fillText('— CLICK OR PRESS ENTER TO BEGIN —', FIELD.width / 2, 452);
  ctx.globalAlpha = 1;
  if (world.best > 0) {
    ctx.font = '18px Georgia, serif';
    ctx.fillStyle = 'rgba(242, 234, 216, 0.7)';
    ctx.fillText(`BEST SCORE ${world.best}`, FIELD.width / 2, 500);
  }
  ctx.font = '14px Georgia, serif';
  ctx.fillStyle = 'rgba(242, 234, 216, 0.4)';
  ctx.fillText('An original game · sound on · M mutes', FIELD.width / 2, FIELD.height - 24);
}

function drawUpgrade(ctx, world, mouse) {
  dim(ctx, 0.62);
  ctx.textAlign = 'center';
  ctx.font = 'bold 44px Georgia, serif';
  ctx.fillStyle = PALETTE.amberHot;
  ctx.fillText('CHOOSE A BLESSING', FIELD.width / 2, 150);
  ctx.font = 'italic 20px Georgia, serif';
  ctx.fillStyle = PALETTE.bone;
  ctx.fillText(`Wave ${world.wave} cleared — the flame rewards you. Pick one.`, FIELD.width / 2, 186);

  const cards = world.upgradeChoices;
  const cw = 300;
  const ch = 250;
  const gap = 36;
  const total = cards.length * cw + (cards.length - 1) * gap;
  let x = FIELD.width / 2 - total / 2;
  const y = 250;
  cards.forEach((card, i) => {
    const hover = mouse && mouse.x >= x && mouse.x <= x + cw && mouse.y >= y && mouse.y <= y + ch;
    ctx.save();
    if (hover) {
      ctx.shadowColor = 'rgba(255, 179, 71, 0.8)';
      ctx.shadowBlur = 24;
    }
    ctx.fillStyle = hover ? '#1a2342' : '#12182e';
    rr(ctx, x, y, cw, ch, 14);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = hover ? PALETTE.amber : 'rgba(255, 179, 71, 0.4)';
    ctx.lineWidth = hover ? 2.5 : 1.5;
    rr(ctx, x, y, cw, ch, 14);
    ctx.stroke();
    drawFlameIcon(ctx, x + cw / 2, y + 58, 40, true);
    ctx.font = 'bold 24px Georgia, serif';
    ctx.fillStyle = PALETTE.amberHot;
    ctx.fillText(card.name, x + cw / 2, y + 118);
    ctx.font = '16px Georgia, serif';
    ctx.fillStyle = PALETTE.bone;
    wrapText(ctx, card.desc, x + cw / 2, y + 152, cw - 44, 22);
    ctx.font = 'italic 14px Georgia, serif';
    ctx.fillStyle = 'rgba(242, 234, 216, 0.6)';
    wrapText(ctx, card.line, x + cw / 2, y + 208, cw - 44, 19);
    ctx.font = 'bold 15px Georgia, serif';
    ctx.fillStyle = 'rgba(242, 234, 216, 0.55)';
    ctx.fillText(`press ${i + 1} or click`, x + cw / 2, y + ch - 16);
    ctx.restore();
    x += cw + gap;
  });
}

function wrapText(ctx, text, cx, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  lines.forEach((l, i) => ctx.fillText(l, cx, y + i * lineHeight));
}

function drawStats(ctx, world, cy) {
  const accuracy = world.shotsFired > 0 ? Math.round((world.shotsHit / world.shotsFired) * 100) : 0;
  const rows = [
    ['SCORE', `${world.score}`],
    ['BEST', `${Math.max(world.best, world.score)}`],
    ['WAVE REACHED', `${world.wave} / ${WAVES.total}`],
    ['SHADOWS BANISHED', `${world.kills}`],
    ['TIME SURVIVED', fmtTime(world.runTime)],
    ['ACCURACY', `${accuracy}%`],
  ];
  ctx.font = '20px Georgia, serif';
  rows.forEach((row, i) => {
    const y = cy + i * 34;
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(242, 234, 216, 0.65)';
    ctx.fillText(row[0], FIELD.width / 2 - 16, y);
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.bone;
    ctx.fillText(row[1], FIELD.width / 2 + 16, y);
  });
}

function drawOver(ctx, world) {
  dim(ctx, 0.72);
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(255, 92, 122, 0.7)';
  ctx.shadowBlur = 28;
  ctx.font = 'bold 58px Georgia, serif';
  ctx.fillStyle = '#ff8fa3';
  ctx.fillText('THE FLAME HAS FALLEN', FIELD.width / 2, 190);
  ctx.shadowBlur = 0;
  ctx.font = 'italic 22px Georgia, serif';
  ctx.fillStyle = PALETTE.bone;
  ctx.fillText('The night takes the valley — this time.', FIELD.width / 2, 228);
  drawStats(ctx, world, 300);
  const blink = 0.65 + 0.35 * Math.sin(world.time * 3);
  ctx.globalAlpha = blink;
  ctx.font = 'bold 22px Georgia, serif';
  ctx.fillStyle = PALETTE.amber;
  ctx.fillText('— PRESS ENTER OR CLICK TO TRY AGAIN —', FIELD.width / 2, 540);
  ctx.globalAlpha = 1;
}

function drawWin(ctx, world) {
  dim(ctx, 0.6);
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(255, 179, 71, 0.9)';
  ctx.shadowBlur = 34;
  ctx.font = 'bold 62px Georgia, serif';
  ctx.fillStyle = PALETTE.amberHot;
  ctx.fillText('DAWN BREAKS', FIELD.width / 2, 190);
  ctx.shadowBlur = 0;
  ctx.font = 'italic 22px Georgia, serif';
  ctx.fillStyle = PALETTE.bone;
  ctx.fillText('Ten waves, one lantern — you kept the flame alive.', FIELD.width / 2, 228);
  drawStats(ctx, world, 300);
  const blink = 0.65 + 0.35 * Math.sin(world.time * 3);
  ctx.globalAlpha = blink;
  ctx.font = 'bold 22px Georgia, serif';
  ctx.fillStyle = PALETTE.amber;
  ctx.fillText('— PRESS ENTER OR CLICK TO PLAY AGAIN —', FIELD.width / 2, 540);
  ctx.globalAlpha = 1;
}

function drawPause(ctx) {
  dim(ctx, 0.6);
  ctx.textAlign = 'center';
  ctx.font = 'bold 56px Georgia, serif';
  ctx.fillStyle = PALETTE.bone;
  ctx.fillText('PAUSED', FIELD.width / 2, FIELD.height / 2 - 10);
  ctx.font = '20px Georgia, serif';
  ctx.fillStyle = 'rgba(242, 234, 216, 0.75)';
  ctx.fillText('Press P or Esc to return to the fight', FIELD.width / 2, FIELD.height / 2 + 34);
}

// The one entry point. `screen` is one of the SCREEN_* constants; `mouse` is
// the pointer in field coordinates (for upgrade-card hover) or null.
export function drawWorld(ctx, world, screen, mouse) {
  ctx.save();
  if (world.shake > 0) {
    // Deterministic jitter from the world's own clock, so a seeded run draws
    // the same frame twice (Math.random would not).
    const s = world.shake;
    ctx.translate(Math.sin(world.time * 91.7) * s * 0.5, Math.cos(world.time * 113.3) * s * 0.5);
  }
  drawBackground(ctx, world);
  drawLanternGlow(ctx, world);
  drawShards(ctx, world);
  drawHearts(ctx, world);
  for (const e of world.enemies) drawEnemy(ctx, world, e);
  if (world.phase !== 'over') drawPlayer(ctx, world);
  drawBullets(ctx, world);
  drawParticles(ctx, world);
  if (screen === SCREEN_PLAY || screen === SCREEN_PAUSE) drawHud(ctx, world);
  if (screen === SCREEN_TITLE) drawTitle(ctx, world);
  if (screen === SCREEN_UPGRADE) {
    drawHud(ctx, world);
    drawUpgrade(ctx, world, mouse);
  }
  if (screen === SCREEN_OVER) drawOver(ctx, world);
  if (screen === SCREEN_WIN) drawWin(ctx, world);
  if (screen === SCREEN_PAUSE) drawPause(ctx);
  ctx.restore();
}
