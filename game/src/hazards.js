// Everything the turkey runs into, over, or through: fences, hay bales, crates,
// puddles, the oven, falling carving knives — and the corn worth running for.
// Items live in world coordinates (absolute px along the run); the screen x is
// item.x minus the camera (distance travelled in px).
import { CFG } from './config.js';
import { range, chance } from './random.js';

const GROUND_KINDS = ['fence', 'bale', 'crate', 'puddle', 'oven'];

export class HazardField {
  constructor(rng) {
    this.rng = rng;
    this.spawnMul = 1; // difficulty stretches/squeezes spawn gaps
    this.items = [];
    this.nextSpawnM = 30; // first group well ahead, so the run opens gently
    this.spawnedOven = false;
  }

  reset(rng) {
    this.rng = rng;
    this.items = [];
    this.nextSpawnM = 30;
    this.spawnedOven = false;
  }

  // Which hazards are fair at this distance: knives and ovens join after 150 m.
  pickKind(distM) {
    const r = this.rng();
    if (distM > 150 && r < 0.16) return 'knife';
    if (distM > 120 && r < 0.34) return 'oven';
    if (distM > 60 && r < 0.48) return 'puddle';
    return GROUND_KINDS[Math.floor(this.rng() * 4)]; // fence, bale, crate, puddle
  }

  // Spawn a group at world x `wx` (px). A group is one hazard, sometimes with
  // a corn arc over it so a good jump pays.
  spawnGroup(wx, distM) {
    const kind = this.pickKind(distM);
    if (kind === 'knife') {
      this.items.push({
        kind: 'knife', x: wx + range(this.rng, -60, 240), y: -60,
        w: 18, h: 74, vy: 0, state: 'warn', warnT: 0.55, spent: false,
      });
      return;
    }
    const base = { kind, x: wx, spent: false };
    if (kind === 'fence') Object.assign(base, { w: 26, h: 64, y: CFG.GROUND_Y - 64 });
    if (kind === 'bale') Object.assign(base, { w: 74, h: 84, y: CFG.GROUND_Y - 84 });
    if (kind === 'crate') Object.assign(base, { w: 56, h: 56, y: CFG.GROUND_Y - 56 });
    if (kind === 'puddle') Object.assign(base, { w: 140, h: 14, y: CFG.GROUND_Y - 6 });
    if (kind === 'oven') Object.assign(base, { w: 112, h: 80, y: CFG.GROUND_Y - 80 });
    this.items.push(base);
    if (kind === 'oven') this.spawnedOven = true;
    // Corn arc over jumpable hazards, or a low line after a puddle.
    if (kind !== 'puddle' && chance(this.rng, 0.75)) {
      const n = 3 + Math.floor(this.rng() * 3);
      for (let i = 0; i < n; i += 1) {
        const cx = wx + base.w / 2 + (i - (n - 1) / 2) * 44;
        const cy = CFG.GROUND_Y - 130 - Math.sin((i / Math.max(1, n - 1)) * Math.PI) * 46;
        this.items.push({ kind: 'corn', x: cx, y: cy, w: 26, h: 26, spent: false, bob: this.rng() * 6 });
      }
    } else if (chance(this.rng, 0.5)) {
      for (let i = 0; i < 3; i += 1) {
        this.items.push({ kind: 'corn', x: wx + 60 + i * 44, y: CFG.GROUND_Y - 52, w: 26, h: 26, spent: false, bob: this.rng() * 6 });
      }
    }
  }

  // Advance the world. Returns events for the game to score: hits, corn, puddle.
  update(dt, speed, distM, turkey) {
    const events = { hits: 0, hitKinds: [], hitDetails: [], corns: 0, inPuddle: false };
    const camX = distM * CFG.PX_PER_M;
    // Spawn ahead of the right edge.
    while (this.nextSpawnM * CFG.PX_PER_M < camX + CFG.W + 300) {
      const gapM = range(this.rng, CFG.SPAWN_MIN_M, CFG.SPAWN_MAX_M) * this.spawnMul;
      this.nextSpawnM += gapM;
      this.spawnGroup(this.nextSpawnM * CFG.PX_PER_M, this.nextSpawnM);
    }
    const tbox = turkey.box();
    const turkeyWorldX = camX + turkey.x;
    for (const it of this.items) {
      if (it.kind === 'knife') {
        if (it.state === 'warn') {
          // Hold the telegraph until the turkey is close: a knife spawned far
          // ahead would otherwise warn, fall and be spent before the turkey
          // ever gets there. The threat starts about one warn-plus-fall
          // (1.1 s of travel) ahead, so the blade lands on the bird's path.
          const dx = it.x - (camX + turkey.x);
          if (dx < speed * 1.1) it.warnT -= dt;
          if (it.warnT <= 0) { it.state = 'fall'; it.vy = 150; }
        } else {
          it.vy += 5200 * dt;
          it.y += it.vy * dt;
          if (it.y > CFG.GROUND_Y + 40) { it.spent = true; }
        }
      }
      if (it.spent) continue;
      // Collision: turkey box in world coords.
      const ix = it.x;
      const iw = it.w;
      const ih = it.h;
      const iy = it.kind === 'corn' ? it.y : it.y;
      const overlapX = turkeyWorldX + tbox.x - turkey.x < ix + iw - 4 && turkeyWorldX + tbox.x - turkey.x + tbox.w > ix + 4;
      const overlapY = tbox.y < iy + ih - 4 && tbox.y + tbox.h > iy + 4;
      if (it.kind === 'corn') {
        // Corn uses a small circle-ish box around its centre.
        const cx = ix;
        const cy = iy + 13;
        const px = turkeyWorldX;
        const py = tbox.y + tbox.h / 2;
        if (Math.abs(px - cx) < 44 && Math.abs(py - cy) < 44) {
          it.spent = true;
          events.corns += 1;
        }
        continue;
      }
      if (it.kind === 'puddle') {
        if (overlapX && turkey.grounded) events.inPuddle = true;
        continue;
      }
      // The turkey is inside a ground hazard (or a falling knife).
    if (overlapX && overlapY) {
      it.spent = true;
      events.hits += 1;
      events.hitKinds.push(it.kind);
      events.hitDetails.push({ kind: it.kind, dx: Math.round(it.x - turkeyWorldX), turkeyY: Math.round(turkey.y) });
    }
    }
    // Drop spent items and anything far behind the camera.
    this.items = this.items.filter((it) => !it.spent && it.x > camX - 200);
    return events;
  }

  draw(ctx, camX, t) {
    for (const it of this.items) {
      const sx = it.x - camX;
      if (sx < -160 || sx > CFG.W + 160) continue;
      if (it.kind === 'fence') this.drawFence(ctx, sx, it);
      else if (it.kind === 'bale') this.drawBale(ctx, sx, it);
      else if (it.kind === 'crate') this.drawCrate(ctx, sx, it);
      else if (it.kind === 'puddle') this.drawPuddle(ctx, sx, it);
      else if (it.kind === 'oven') this.drawOven(ctx, sx, it, t);
      else if (it.kind === 'knife') this.drawKnife(ctx, sx, it, t);
      else if (it.kind === 'corn') this.drawCorn(ctx, sx, it, t);
    }
  }

  drawFence(ctx, sx, it) {
    ctx.fillStyle = CFG.WOOD;
    ctx.fillRect(sx, it.y, 6, it.h);
    ctx.fillRect(sx + it.w - 6, it.y, 6, it.h);
    ctx.fillStyle = '#a8763f';
    ctx.fillRect(sx - 4, it.y + 12, it.w + 8, 8);
    ctx.fillRect(sx - 4, it.y + 34, it.w + 8, 8);
    ctx.fillStyle = '#6b4423';
    ctx.fillRect(sx - 2, it.y - 4, 10, 6);
    ctx.fillRect(sx + it.w - 8, it.y - 4, 10, 6);
  }

  drawBale(ctx, sx, it) {
    ctx.fillStyle = CFG.HAY;
    ctx.beginPath();
    ctx.arc(sx + it.w / 2, it.y + it.h / 2, it.w / 2 - 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = CFG.HAY_DARK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(sx + it.w / 2, it.y + it.h / 2, it.w / 2 - 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(sx + it.w / 2, it.y + it.h / 2, it.w / 2 - 22, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#8a6b1f';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i += 1) {
      const a = -0.6 + i * 0.5;
      ctx.beginPath();
      ctx.moveTo(sx + it.w / 2 + Math.cos(a) * 12, it.y + it.h / 2 + Math.sin(a) * 12);
      ctx.lineTo(sx + it.w / 2 + Math.cos(a) * (it.w / 2 - 4), it.y + it.h / 2 + Math.sin(a) * (it.w / 2 - 4));
      ctx.stroke();
    }
  }

  drawCrate(ctx, sx, it) {
    ctx.fillStyle = '#b07a3e';
    ctx.fillRect(sx, it.y, it.w, it.h);
    ctx.strokeStyle = '#7a5222';
    ctx.lineWidth = 3;
    ctx.strokeRect(sx + 1, it.y + 1, it.w - 2, it.h - 2);
    ctx.beginPath();
    ctx.moveTo(sx, it.y);
    ctx.lineTo(sx + it.w, it.y + it.h);
    ctx.moveTo(sx + it.w, it.y);
    ctx.lineTo(sx, it.y + it.h);
    ctx.stroke();
  }

  drawPuddle(ctx, sx, it) {
    ctx.fillStyle = '#7fb2d9';
    ctx.beginPath();
    ctx.ellipse(sx + it.w / 2, CFG.GROUND_Y + 2, it.w / 2, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.ellipse(sx + it.w / 2 - 20, CFG.GROUND_Y, it.w / 5, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  drawOven(ctx, sx, it, t) {
    // Iron stove body on little legs, door glowing, chimney smoking.
    ctx.fillStyle = '#2c2e33';
    ctx.fillRect(sx + 14, it.y + it.h - 10, 8, 10);
    ctx.fillRect(sx + it.w - 22, it.y + it.h - 10, 8, 10);
    ctx.fillStyle = CFG.OVEN_IRON;
    ctx.beginPath();
    ctx.roundRect(sx, it.y, it.w, it.h - 6, 10);
    ctx.fill();
    // Door with fire glow.
    const flick = 0.7 + Math.sin(t * 11 + sx) * 0.3;
    ctx.fillStyle = `rgba(255,123,36,${0.55 + 0.35 * flick})`;
    ctx.beginPath();
    ctx.roundRect(sx + 16, it.y + 22, it.w - 32, 34, 6);
    ctx.fill();
    ctx.fillStyle = CFG.OVEN_FIRE2;
    ctx.beginPath();
    ctx.moveTo(sx + 30, it.y + 52);
    ctx.quadraticCurveTo(sx + 38, it.y + 30 + Math.sin(t * 13) * 4, sx + 46, it.y + 52);
    ctx.quadraticCurveTo(sx + 56, it.y + 28 - Math.sin(t * 9) * 4, sx + 66, it.y + 52);
    ctx.quadraticCurveTo(sx + 76, it.y + 32, sx + 82, it.y + 52);
    ctx.closePath();
    ctx.fill();
    // Chimney + smoke.
    ctx.fillStyle = CFG.OVEN_IRON;
    ctx.fillRect(sx + it.w - 30, it.y - 26, 18, 28);
    ctx.fillStyle = 'rgba(220,220,220,0.5)';
    for (let i = 0; i < 3; i += 1) {
      const ph = (t * 0.7 + i / 3) % 1;
      ctx.beginPath();
      ctx.arc(sx + it.w - 21 + Math.sin(ph * 5) * 6, it.y - 30 - ph * 46, 5 + ph * 9, 0, Math.PI * 2);
      ctx.fill();
    }
    // Danger stripe on top.
    ctx.fillStyle = '#e8c33c';
    ctx.fillRect(sx + 6, it.y + 2, it.w - 12, 6);
    ctx.fillStyle = '#2c2e33';
    for (let x = sx + 10; x < sx + it.w - 10; x += 16) ctx.fillRect(x, it.y + 2, 8, 6);
  }

  drawKnife(ctx, sx, it, t) {
    if (it.state === 'warn') {
      // Telegraph: shadow on the ground + a glint where it will land.
      const pulse = 0.5 + Math.sin(t * 18) * 0.5;
      ctx.fillStyle = `rgba(40,20,8,${0.25 + 0.25 * pulse})`;
      ctx.beginPath();
      ctx.ellipse(sx + 9, CFG.GROUND_Y + 6, 26, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255,240,180,${0.5 + 0.5 * pulse})`;
      ctx.font = 'bold 26px Trebuchet MS, sans-serif';
      ctx.fillText('!', sx + 2, CFG.GROUND_Y - 60);
      return;
    }
    // Falling blade: steel + dark handle, slight spin.
    ctx.save();
    ctx.translate(sx + 9, it.y + 37);
    ctx.rotate(0.35);
    ctx.fillStyle = CFG.KNIFE;
    ctx.beginPath();
    ctx.moveTo(-8, -37);
    ctx.lineTo(8, -37);
    ctx.lineTo(8, 12);
    ctx.lineTo(0, 30);
    ctx.lineTo(-8, 12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = CFG.KNIFE_HANDLE;
    ctx.fillRect(-7, -52, 14, 16);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillRect(-5, -34, 3, 40);
    ctx.restore();
  }

  drawCorn(ctx, sx, it, t) {
    const bobY = Math.sin(t * 3 + it.bob) * 3;
    const cx = sx;
    const cy = it.y + 13 + bobY;
    // Husk leaves.
    ctx.fillStyle = CFG.CORN_HUSK;
    ctx.beginPath();
    ctx.moveTo(cx - 10, cy + 8);
    ctx.quadraticCurveTo(cx - 18, cy - 4, cx - 8, cy - 12);
    ctx.lineTo(cx - 2, cy + 2);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx + 10, cy + 8);
    ctx.quadraticCurveTo(cx + 18, cy - 4, cx + 8, cy - 12);
    ctx.lineTo(cx + 2, cy + 2);
    ctx.closePath();
    ctx.fill();
    // Cob.
    ctx.fillStyle = CFG.CORN;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 11, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d9a92c';
    for (let r = -1; r <= 1; r += 1) {
      ctx.fillRect(cx - 8, cy + r * 7, 16, 1.5);
    }
  }
}
