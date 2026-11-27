// Turkey Run — the game itself: state machine (title / play / paused / caught /
// escaped), scoring, lives, the farmer chase, HUD, and every screen the player
// sees. The world scrolls; the turkey dodges left/right and jumps.
import { CFG, DIFFS, DIFF_ORDER, OUTFITS, OUTFIT_ORDER } from './config.js';
import { mulberry32 } from './random.js';
import { Sfx } from './audio.js';
import { Input } from './input.js';
import { Turkey } from './turkey.js';
import { Farmer } from './farmer.js';
import { HazardField } from './hazards.js';
import { drawFarm } from './farm.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_CAUGHT = 'caught';
export const SCREEN_ESCAPED = 'escaped';

const BEST_KEY = 'turkeyRunBest';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = new Input(canvas);
    this.sfx = new Sfx();
    this.turkey = new Turkey();
    this.farmer = new Farmer();
    this.rng = mulberry32(20261127);
    this.field = new HazardField(this.rng);
    this.screen = SCREEN_TITLE;
    this.best = 0;
    try {
      this.best = Number(window.localStorage.getItem(BEST_KEY) || 0) || 0;
    } catch (e) { this.best = 0; }
    // Menu choices — real settings, applied by start().
    this.diff = 'normal';
    this.outfit = 'classic';
    this.hitLog = []; // {dist, kind, t} — what ended runs (probe diagnostics)
    this.menuBtns = { diff: {}, outfit: {}, start: null };
    this.reset();
    this.t = 0; // global animation clock
    this.shake = 0;
    this.flash = 0;
    this.endAt = 0; // when the end screen appeared (guards accidental restarts)
    this.floaters = []; // {x, y, text, color, ttl}
    this.pausedBtn = { x: CFG.W - 108, y: 12, w: 44, h: 44 };
    this.muteBtn = { x: CFG.W - 56, y: 12, w: 44, h: 44 };
  }

  reset() {
    this.rng = mulberry32(20261127);
    this.field.reset(this.rng);
    this.field.spawnMul = DIFFS[this.diff].spawnMul;
    this.turkey.reset();
    this.turkey.setOutfit(this.outfit);
    this.farmer.reset();
    this.score = 0;
    this.distM = 0;
    this.distPx = 0;
    this.lives = DIFFS[this.diff].lives;
    this.corn = 0;
    this.speed = CFG.BASE_SPEED * DIFFS[this.diff].speedMul;
    this.shake = 0;
    this.flash = 0;
    this.floaters = [];
    this.hitLog = [];
    this.jumpLog = []; // {dist, kind, dx, w, flight} — what the autopilot jumped
    this.input.clearEdges();
  }

  get speedNow() {
    return Math.min(CFG.SPEED_MAX, (CFG.BASE_SPEED + this.distM * CFG.SPEED_PER_M) * DIFFS[this.diff].speedMul);
  }

  start() {
    this.reset();
    this.screen = SCREEN_PLAY;
    this.sfx.ensure();
    this.sfx.gobble();
  }

  toTitle() {
    this.reset();
    this.screen = SCREEN_TITLE;
  }

  saveBest() {
    if (this.score > this.best) {
      this.best = this.score;
      try { window.localStorage.setItem(BEST_KEY, String(this.best)); } catch (e) { /* private mode */ }
    }
  }

  endCaught() {
    this.screen = SCREEN_CAUGHT;
    this.endAt = this.t;
    this.saveBest();
    this.sfx.caught();
  }

  endEscaped() {
    this.screen = SCREEN_ESCAPED;
    this.endAt = this.t;
    this.saveBest();
    this.sfx.escaped();
  }

  addFloater(x, y, text, color) {
    this.floaters.push({ x, y, text, color, ttl: 1.1 });
  }

  hit(kind, details) {
    if (this.turkey.invuln > 0) return;
    this.lives -= 1;
    this.turkey.invuln = 1.3;
    this.farmer.onHit();
    this.shake = 0.35;
    this.flash = 0.25;
    this.sfx.hit();
    this.hitLog.push({ dist: Math.floor(this.distM), kind: kind || '?', t: Math.round(this.t * 10) / 10, ...(details || {}) });
    if (this.hitLog.length > 8) this.hitLog.shift();
    this.addFloater(this.turkey.x, this.turkey.y - 90, 'OUCH!', '#ff5a3c');
    if (this.lives <= 0) this.endCaught();
  }

  // One fixed step. Returns false when the run ended this step.
  step(dt) {
    this.t += dt;
    this.shake = Math.max(0, this.shake - dt);
    this.flash = Math.max(0, this.flash - dt);
    for (const f of this.floaters) { f.y -= 34 * dt; f.ttl -= dt; }
    this.floaters = this.floaters.filter((f) => f.ttl > 0);

    if (this.screen === SCREEN_TITLE) {
      this.turkey.runPhase += dt * 4;
      // Idle-pecking on the menu: head dips for 0.6 s of every 3 s.
      this.turkey.peck = (this.t % 3) < 0.6;
      this.farmer.runPhase += dt * 2;
      return true;
    }
    if (this.screen !== SCREEN_PLAY) return true;

    this.speed = this.speedNow;
    const events = this.field.update(dt, this.speed, this.distM, this.turkey);
    const inPuddle = events.inPuddle;
    const effSpeed = inPuddle ? this.speed * 0.55 : this.speed;
    this.distPx += effSpeed * dt;
    this.distM = this.distPx / CFG.PX_PER_M;
    this.score = Math.floor(this.distM) + this.corn * 10;

    const wasGrounded = this.turkey.grounded;
    this.turkey.update(dt, this.input.moveDir(), this.input.takeJump());
    if (wasGrounded && !this.turkey.grounded) this.sfx.jump();
    this.farmer.update(dt, effSpeed, !inPuddle && events.hits === 0);

    if (events.corns > 0) {
      this.corn += events.corns;
      for (let i = 0; i < events.corns; i += 1) this.farmer.onCorn();
      this.sfx.pickup();
      this.addFloater(this.turkey.x, this.turkey.y - 90, `+${events.corns * 10}`, '#ffd94a');
    }
    for (let i = 0; i < events.hits; i += 1) this.hit(events.hitKinds[i], events.hitDetails[i]);
    if (this.screen !== SCREEN_PLAY) return false;

    if (inPuddle) this.farmer.gap = Math.max(0, this.farmer.gap - 2 * dt);
    if (this.farmer.gap <= 0) { this.endCaught(); return false; }
    if (this.distM >= CFG.GOAL_M) { this.endEscaped(); return false; }
    return true;
  }

  // Pointer / key handling per screen. Called every frame with the input.
  handleInput() {
    const clicks = this.input.takeClicks();
    const clickStart = this.input.takeEdge('Space') || this.input.takeEdge('Enter');

    if (this.screen === SCREEN_TITLE) {
      // Menu clicks: difficulty buttons, outfit swatches, START.
      for (const c of clicks) {
        let used = false;
        for (const d of DIFF_ORDER) {
          if (this.inBtn(c, this.menuBtns.diff[d])) { this.diff = d; this.sfx.ensure(); this.sfx.click(); used = true; }
        }
        for (const o of OUTFIT_ORDER) {
          if (this.inBtn(c, this.menuBtns.outfit[o])) { this.outfit = o; this.turkey.setOutfit(o); this.sfx.ensure(); this.sfx.click(); used = true; }
        }
        if (this.menuBtns.start && this.inBtn(c, this.menuBtns.start)) { this.start(); return; }
        if (used) return;
      }
      // Keys: 1/2/3 difficulty, C cycles outfit, Space/Enter starts.
      for (let i = 0; i < DIFF_ORDER.length; i += 1) {
        if (this.input.takeEdge(`Digit${i + 1}`)) { this.diff = DIFF_ORDER[i]; this.sfx.ensure(); this.sfx.click(); }
      }
      if (this.input.takeEdge('KeyC')) {
        const next = OUTFIT_ORDER[(OUTFIT_ORDER.indexOf(this.outfit) + 1) % OUTFIT_ORDER.length];
        this.outfit = next;
        this.turkey.setOutfit(next);
        this.sfx.ensure();
        this.sfx.click();
      }
      if (clickStart) this.start();
      return;
    }
    if (this.screen === SCREEN_CAUGHT || this.screen === SCREEN_ESCAPED) {
      if (this.t - this.endAt < 0.6) { this.input.clearEdges(); return; }
      for (const c of clicks) {
        if (this.menuBtn && this.inBtn(c, this.menuBtn)) { this.toTitle(); return; }
        if (this.restartBtn && this.inBtn(c, this.restartBtn)) { this.start(); return; }
      }
      if (this.input.takeEdge('KeyR') || clickStart) this.start();
      if (this.input.takeEdge('Escape') || this.input.takeEdge('KeyT')) this.toTitle();
      return;
    }
    if (this.screen === SCREEN_PAUSED) {
      if (this.input.takeEdge('KeyP') || this.input.takeEdge('Escape') || clickStart) {
        this.screen = SCREEN_PLAY;
        this.sfx.click();
      }
      for (const c of clicks) {
        if (this.inBtn(c, this.pausedBtn) || this.inBtn(c, this.muteBtn)) {
          this.screen = SCREEN_PLAY;
          this.sfx.click();
        }
      }
      return;
    }
    // PLAY
    if (this.input.takeEdge('KeyP') || this.input.takeEdge('Escape')) {
      this.screen = SCREEN_PAUSED;
      this.sfx.click();
      return;
    }
    if (this.input.takeEdge('KeyM')) {
      this.sfx.ensure();
      this.sfx.toggleMute();
      return;
    }
    for (const c of clicks) {
      if (this.inBtn(c, this.pausedBtn)) { this.screen = SCREEN_PAUSED; this.sfx.click(); return; }
      if (this.inBtn(c, this.muteBtn)) { this.sfx.ensure(); this.sfx.toggleMute(); return; }
    }
  }

  inBtn(c, b) {
    return c.x >= b.x && c.x <= b.x + b.w && c.y >= b.y && c.y <= b.y + b.h;
  }

  update(dt) {
    this.handleInput();
    this.step(Math.min(dt, 1 / 20));
  }

  draw() {
    const ctx = this.ctx;
    ctx.save();
    if (this.shake > 0) {
      const s = this.shake * 22;
      ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }
    const camX = this.screen === SCREEN_TITLE ? 0 : this.distPx;
    drawFarm(ctx, camX, this.t);
    if (this.screen !== SCREEN_TITLE) {
      this.field.draw(ctx, camX, this.t);
      this.farmer.draw(ctx, this.turkey.x, this.t);
      this.turkey.draw(ctx, this.t);
      for (const f of this.floaters) {
        ctx.globalAlpha = Math.min(1, f.ttl);
        ctx.fillStyle = f.color;
        ctx.font = 'bold 26px Trebuchet MS, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(f.text, f.x, f.y);
        ctx.textAlign = 'left';
        ctx.globalAlpha = 1;
      }
    } else {
      // Title scene: the turkey pecks on the right, the farmer lurks behind
      // a hay bale at the far right edge. The menu panel sits on the left.
      this.turkey.x = 860;
      this.turkey.y = CFG.GROUND_Y;
      this.turkey.draw(ctx, this.t);
      this.farmer.drawAt(ctx, 1150, this.t);
      // Hay bale the farmer hides behind.
      ctx.fillStyle = CFG.HAY;
      ctx.beginPath();
      ctx.arc(1175, CFG.GROUND_Y - 30, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = CFG.HAY_DARK;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(1175, CFG.GROUND_Y - 30, 24, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    if (this.screen === SCREEN_TITLE) this.drawTitle();
    else if (this.screen === SCREEN_PLAY || this.screen === SCREEN_PAUSED) this.drawHud();
    if (this.screen === SCREEN_PAUSED) this.drawPaused();
    if (this.screen === SCREEN_CAUGHT) this.drawEnd(false);
    if (this.screen === SCREEN_ESCAPED) this.drawEnd(true);
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,60,30,${this.flash * 1.4})`;
      ctx.fillRect(0, 0, CFG.W, CFG.H);
    }
  }

  drawHud() {
    const ctx = this.ctx;
    // Top bar.
    ctx.fillStyle = 'rgba(30,16,6,0.55)';
    ctx.beginPath();
    ctx.roundRect(0, 0, CFG.W, 64, 10);
    ctx.fill();

    // Hearts.
    for (let i = 0; i < CFG.LIVES; i += 1) {
      const hx = 26 + i * 34;
      ctx.fillStyle = i < this.lives ? '#ff4d6d' : 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      ctx.moveTo(hx + 10, 46);
      ctx.bezierCurveTo(hx - 2, 34, hx - 8, 24, hx + 2, 18);
      ctx.bezierCurveTo(hx + 6, 14, hx + 10, 18, hx + 10, 22);
      ctx.bezierCurveTo(hx + 10, 18, hx + 14, 14, hx + 18, 18);
      ctx.bezierCurveTo(hx + 28, 24, hx + 22, 34, hx + 10, 46);
      ctx.fill();
    }
    // Corn count.
    ctx.fillStyle = CFG.CORN;
    ctx.beginPath();
    ctx.ellipse(128, 32, 9, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff3c4';
    ctx.font = 'bold 22px Trebuchet MS, sans-serif';
    ctx.fillText(`x ${this.corn}`, 142, 40);

    // Distance + progress to the woods.
    ctx.fillStyle = '#fff3c4';
    ctx.font = 'bold 26px Trebuchet MS, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.floor(this.distM)} m`, CFG.W / 2, 30);
    const pw = 260;
    const px = CFG.W / 2 - pw / 2;
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.roundRect(px, 38, pw, 10, 5);
    ctx.fill();
    ctx.fillStyle = '#7fae4c';
    ctx.beginPath();
    ctx.roundRect(px, 38, pw * Math.min(1, this.distM / CFG.GOAL_M), 10, 5);
    ctx.fill();
    ctx.font = 'bold 15px Trebuchet MS, sans-serif';
    ctx.fillText('🌲 WOODS', CFG.W / 2 + pw / 2 + 52, 47);
    ctx.textAlign = 'left';

    // Score (right), speed under it.
    ctx.fillStyle = '#ffd94a';
    ctx.font = 'bold 26px Trebuchet MS, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`SCORE ${this.score}`, CFG.W - 176, 30);
    ctx.fillStyle = '#fff3c4';
    ctx.font = '16px Trebuchet MS, sans-serif';
    ctx.fillText(`${Math.round(this.speed * 0.09)} km/h`, CFG.W - 176, 52);
    ctx.textAlign = 'left';

    // Farmer proximity bar, bottom-left: how close he is.
    const gap = this.farmer.gap;
    ctx.fillStyle = 'rgba(30,16,6,0.55)';
    ctx.beginPath();
    ctx.roundRect(16, CFG.H - 44, 210, 28, 8);
    ctx.fill();
    ctx.fillStyle = gap > 50 ? '#7fae4c' : gap > 25 ? '#e8a33c' : '#ff4d3c';
    ctx.beginPath();
    ctx.roundRect(20, CFG.H - 40, 130 * (gap / 100), 20, 6);
    ctx.fill();
    ctx.fillStyle = '#fff3c4';
    ctx.font = 'bold 15px Trebuchet MS, sans-serif';
    ctx.fillText('FARMER', 158, CFG.H - 24);

    this.drawIconBtn(this.pausedBtn, 'II');
    this.drawIconBtn(this.muteBtn, this.sfx.muted ? '✕' : '♪');
  }

  drawIconBtn(b, label) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(30,16,6,0.55)';
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.w, b.h, 8);
    ctx.fill();
    ctx.fillStyle = '#fff3c4';
    ctx.font = 'bold 20px Trebuchet MS, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, b.x + b.w / 2, b.y + b.h / 2 + 7);
    ctx.textAlign = 'left';
  }

  drawTitle() {
    const ctx = this.ctx;
    // Warm vignette over the live scene.
    const vg = ctx.createLinearGradient(0, 0, 0, CFG.H);
    vg.addColorStop(0, 'rgba(60,20,0,0.25)');
    vg.addColorStop(1, 'rgba(60,20,0,0.45)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, CFG.W, CFG.H);

    // Title, top-center.
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff3c4';
    ctx.font = 'bold 84px Trebuchet MS, sans-serif';
    ctx.shadowColor = 'rgba(90,30,0,0.8)';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 5;
    ctx.fillText('TURKEY RUN', CFG.W / 2, 112);
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = '#ffd94a';
    ctx.font = 'bold 30px Trebuchet MS, sans-serif';
    ctx.fillText('— THE GREAT ESCAPE —', CFG.W / 2, 152);
    ctx.fillStyle = '#fff3c4';
    ctx.font = '20px Trebuchet MS, sans-serif';
    ctx.fillText('Thanksgiving is coming. The farmer is coming faster.', CFG.W / 2, 184);

    // Menu panel, left.
    ctx.fillStyle = 'rgba(30,16,6,0.62)';
    ctx.beginPath();
    ctx.roundRect(48, 214, 400, 396, 14);
    ctx.fill();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffd94a';
    ctx.font = 'bold 18px Trebuchet MS, sans-serif';
    ctx.fillText('DIFFICULTY', 72, 248);
    const diffBtns = { easy: 64, normal: 188, hard: 312 };
    for (const d of DIFF_ORDER) {
      const bx = diffBtns[d];
      const by = 260;
      const bw = 116;
      const bh = 46;
      const sel = this.diff === d;
      ctx.fillStyle = sel ? '#e8a33c' : 'rgba(255,255,255,0.14)';
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, 9);
      ctx.fill();
      ctx.fillStyle = sel ? '#4a2f1a' : '#fff3c4';
      ctx.font = 'bold 19px Trebuchet MS, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(DIFFS[d].label, bx + bw / 2, by + 30);
      ctx.textAlign = 'left';
      this.menuBtns.diff[d] = { x: bx, y: by, w: bw, h: bh };
    }
    const diffNote = {
      easy: '4 ♥ · slower · wider gaps',
      normal: '3 ♥ · classic pace',
      hard: '2 ♥ · faster · denser hazards',
    }[this.diff];
    ctx.fillStyle = '#fff3c4';
    ctx.font = '16px Trebuchet MS, sans-serif';
    ctx.fillText(diffNote, 72, 330);

    ctx.fillStyle = '#ffd94a';
    ctx.font = 'bold 18px Trebuchet MS, sans-serif';
    ctx.fillText('TURKEY OUTFIT', 72, 368);
    const swX = { classic: 108, golden: 224, snow: 340 };
    for (const o of OUTFIT_ORDER) {
      const cx = swX[o];
      const cy = 396;
      ctx.fillStyle = OUTFITS[o].body;
      ctx.beginPath();
      ctx.arc(cx, cy, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = this.outfit === o ? '#ffd94a' : 'rgba(255,255,255,0.35)';
      ctx.lineWidth = this.outfit === o ? 4 : 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 24, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#fff3c4';
      ctx.font = '15px Trebuchet MS, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(OUTFITS[o].name, cx, 442);
      ctx.textAlign = 'left';
      this.menuBtns.outfit[o] = { x: cx - 28, y: cy - 28, w: 56, h: 56 };
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(72, 464);
    ctx.lineTo(424, 464);
    ctx.stroke();

    ctx.fillStyle = '#ffd94a';
    ctx.font = 'bold 18px Trebuchet MS, sans-serif';
    ctx.fillText('HOW TO PLAY', 72, 494);
    ctx.fillStyle = '#fff3c4';
    ctx.font = '17px Trebuchet MS, sans-serif';
    ctx.fillText('← → / A D dodge  ·  SPACE / CLICK jump', 72, 522);
    ctx.fillText('P pause  ·  M mute  ·  1/2/3 difficulty  ·  C outfit', 72, 548);
    if (this.best > 0) {
      ctx.fillStyle = '#ffd94a';
      ctx.font = 'bold 20px Trebuchet MS, sans-serif';
      ctx.fillText(`BEST SCORE: ${this.best}`, 72, 586);
    } else {
      ctx.fillStyle = '#fff3c4';
      ctx.font = '16px Trebuchet MS, sans-serif';
      ctx.fillText('No best yet — make the first run count!', 72, 586);
    }

    // START, bottom-right. Its label follows the chosen difficulty.
    const sb = { x: 880, y: 612, w: 340, h: 66 };
    ctx.fillStyle = '#e8a33c';
    ctx.beginPath();
    ctx.roundRect(sb.x, sb.y, sb.w, sb.h, 12);
    ctx.fill();
    ctx.fillStyle = '#4a2f1a';
    ctx.font = 'bold 28px Trebuchet MS, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`▶  START — ${DIFFS[this.diff].label}`, sb.x + sb.w / 2, sb.y + 43);
    ctx.textAlign = 'left';
    this.menuBtns.start = sb;

    if (Math.floor(this.t * 1.6) % 2 === 0) {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px Trebuchet MS, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PRESS SPACE OR CLICK START', 860, 250);
      ctx.textAlign = 'left';
    }
  }

  drawPaused() {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(20,10,4,0.6)';
    ctx.fillRect(0, 0, CFG.W, CFG.H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff3c4';
    ctx.font = 'bold 64px Trebuchet MS, sans-serif';
    ctx.fillText('PAUSED', CFG.W / 2, 330);
    ctx.font = '22px Trebuchet MS, sans-serif';
    ctx.fillText('Press P or click to keep running', CFG.W / 2, 380);
    ctx.textAlign = 'left';
  }

  drawEnd(escaped) {
    const ctx = this.ctx;
    ctx.fillStyle = escaped ? 'rgba(20,50,20,0.55)' : 'rgba(40,10,4,0.6)';
    ctx.fillRect(0, 0, CFG.W, CFG.H);
    ctx.textAlign = 'center';
    ctx.fillStyle = escaped ? '#a5e08a' : '#ff6b4d';
    ctx.font = 'bold 84px Trebuchet MS, sans-serif';
    ctx.fillText(escaped ? 'ESCAPED!' : 'CAUGHT!', CFG.W / 2, 190);
    ctx.fillStyle = '#fff3c4';
    ctx.font = '24px Trebuchet MS, sans-serif';
    ctx.fillText(
      escaped
        ? 'You made it to the woods. No Thanksgiving dinner tonight!'
        : 'The farmer got you… Thanksgiving dinner is served.',
      CFG.W / 2, 240,
    );
    ctx.font = 'bold 30px Trebuchet MS, sans-serif';
    ctx.fillText(`SCORE  ${this.score}`, CFG.W / 2, 310);
    ctx.font = '22px Trebuchet MS, sans-serif';
    ctx.fillText(`Distance  ${Math.floor(this.distM)} m   •   Corn  ${this.corn}   •   Best  ${this.best}`, CFG.W / 2, 350);
    if (this.score >= this.best && this.score > 0) {
      ctx.fillStyle = '#ffd94a';
      ctx.font = 'bold 24px Trebuchet MS, sans-serif';
      ctx.fillText('★ NEW BEST! ★', CFG.W / 2, 392);
    }
    // Buttons: RUN AGAIN (left) and MENU (right).
    const bw = 300;
    const bh = 62;
    const by = 440;
    const rx = CFG.W / 2 - bw - 10;
    const mx = CFG.W / 2 + 10;
    ctx.fillStyle = '#e8a33c';
    ctx.beginPath();
    ctx.roundRect(rx, by, bw, bh, 12);
    ctx.fill();
    ctx.fillStyle = '#4a2f1a';
    ctx.font = 'bold 26px Trebuchet MS, sans-serif';
    ctx.fillText('↻  RUN AGAIN', rx + bw / 2, by + 41);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.beginPath();
    ctx.roundRect(mx, by, bw, bh, 12);
    ctx.fill();
    ctx.fillStyle = '#fff3c4';
    ctx.fillText('☰  MENU', mx + bw / 2, by + 41);
    ctx.font = '19px Trebuchet MS, sans-serif';
    ctx.fillText('R — run again  ·  Esc — menu', CFG.W / 2, by + 96);
    ctx.textAlign = 'left';
    this.restartBtn = { x: rx, y: by, w: bw, h: bh };
    this.menuBtn = { x: mx, y: by, w: bw, h: bh };
  }

  // Read-only snapshot for the playtest probe.
  snapshot() {
    return {
      screen: this.screen,
      score: this.score,
      distM: Math.floor(this.distM),
      lives: this.lives,
      corn: this.corn,
      gap: Math.round(this.farmer.gap),
      speed: Math.round(this.speed),
      best: this.best,
      items: this.field.items.length,
      turkeyX: Math.round(this.turkey.x),
      turkeyY: Math.round(this.turkey.y),
      grounded: this.turkey.grounded,
      diff: this.diff,
      outfit: this.outfit,
      outfitBody: this.turkey.palette.body,
      menu: this.screen === SCREEN_TITLE,
      hitLog: this.hitLog.slice(-5),
      jumpLog: this.jumpLog.slice(-8),
    };
  }
}
