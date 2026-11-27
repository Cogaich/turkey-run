// The player: a turkey, drawn in code — fanned tail, wattle, running legs.
// Physics live here: horizontal dodging, jumping with coyote time and a jump
// buffer so the controls feel forgiving at speed.
import { CFG, OUTFITS } from './config.js';

export class Turkey {
  constructor() {
    this.palette = OUTFITS.classic;
    this.peck = false; // idle-pecking on the menu
    this.reset();
  }

  setOutfit(name) {
    if (OUTFITS[name]) this.palette = OUTFITS[name];
  }

  reset() {
    this.x = 260; // screen x of the turkey's centre
    this.y = CFG.GROUND_Y; // feet y
    this.vy = 0;
    this.grounded = true;
    this.runPhase = 0;
    this.coyote = 0;
    this.buffer = 0;
    this.invuln = 0;
    this.face = 1;
  }

  // move: -1/0/1 from input. wantJump: edge. dt in seconds.
  update(dt, move, wantJump) {
    if (wantJump) this.buffer = 0.12;
    else this.buffer = Math.max(0, this.buffer - dt);

    this.x += move * CFG.MOVE_SPEED * dt;
    if (this.x < CFG.TURKEY_X_MIN) this.x = CFG.TURKEY_X_MIN;
    if (this.x > CFG.TURKEY_X_MAX) this.x = CFG.TURKEY_X_MAX;
    if (move !== 0) this.face = move;

    if (this.grounded) this.coyote = 0.1;
    else this.coyote = Math.max(0, this.coyote - dt);

    if (this.buffer > 0 && this.coyote > 0) {
      this.vy = CFG.JUMP_V;
      this.grounded = false;
      this.buffer = 0;
      this.coyote = 0;
    }

    this.vy += CFG.GRAVITY * dt;
    this.y += this.vy * dt;
    if (this.y >= CFG.GROUND_Y) {
      this.y = CFG.GROUND_Y;
      this.vy = 0;
      this.grounded = true;
    }

    this.runPhase += dt * (this.grounded ? 14 : 6);
    this.invuln = Math.max(0, this.invuln - dt);
  }

  // Collision box, slightly forgiving (shaved 8 px each side, 6 px off the top).
  box() {
    return {
      x: this.x - CFG.TURKEY_W / 2 + 8,
      y: this.y - CFG.TURKEY_H + 6,
      w: CFG.TURKEY_W - 16,
      h: CFG.TURKEY_H - 6,
    };
  }

  draw(ctx, t) {
    // Blink while invulnerable after a hit.
    if (this.invuln > 0 && Math.floor(t * 14) % 2 === 0) return;
    const x = this.x;
    const feet = this.y;
    const bob = this.grounded ? Math.sin(this.runPhase) * 2 : 0;
    const bodyY = feet - 30 + bob;

    // Shadow.
    ctx.fillStyle = 'rgba(40,20,8,0.30)';
    const squash = this.grounded ? 1 : Math.max(0.45, 1 - (CFG.GROUND_Y - this.y) / 400);
    ctx.beginPath();
    ctx.ellipse(x, CFG.GROUND_Y + 8, 34 * squash, 7 * squash, 0, 0, Math.PI * 2);
    ctx.fill();

    // Fanned tail behind the body: five autumn feathers.
    ctx.save();
    ctx.translate(x - 26 * this.face, bodyY - 6);
    for (let i = -2; i <= 2; i += 1) {
      const ang = (-0.9 + (i + 2) * 0.45) * this.face;
      ctx.save();
      ctx.rotate(ang);
      ctx.fillStyle = i % 2 === 0 ? this.palette.tail : this.palette.tail2;
      ctx.beginPath();
      ctx.ellipse(-14, -16, 9, 24, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = this.palette.dark;
      ctx.beginPath();
      ctx.ellipse(-14, -30, 4, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    // Legs: two orange sticks alternating while running, tucked while jumping.
    const legSwing = this.grounded ? Math.sin(this.runPhase) * 10 : 6;
    ctx.strokeStyle = '#e8912d';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - 8, bodyY + 16);
    ctx.lineTo(x - 8 + legSwing, feet);
    ctx.moveTo(x + 8, bodyY + 16);
    ctx.lineTo(x + 8 - legSwing, feet);
    ctx.stroke();

    // Body.
    ctx.fillStyle = this.palette.body;
    ctx.beginPath();
    ctx.ellipse(x, bodyY, 30, 24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = this.palette.dark;
    ctx.beginPath();
    ctx.ellipse(x - 6, bodyY + 8, 20, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Wing.
    ctx.fillStyle = this.palette.dark;
    ctx.beginPath();
    ctx.ellipse(x - 4, bodyY - 2, 16, 11, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = this.palette.tail2;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 16, bodyY - 6);
    ctx.quadraticCurveTo(x - 2, bodyY + 2, x + 10, bodyY - 6);
    ctx.stroke();

    // Head + beak + wattle, facing right (or left when moving left).
    // When idle-pecking on the menu the head dips to the ground.
    const hx = x + 26 * this.face;
    const hy = bodyY - 26 + (this.peck ? 14 : 0);
    ctx.fillStyle = CFG.TURKEY_HEAD;
    ctx.beginPath();
    ctx.arc(hx, hy, 12, 0, Math.PI * 2);
    ctx.fill();
    // Beak.
    ctx.fillStyle = '#e8912d';
    ctx.beginPath();
    ctx.moveTo(hx + 8 * this.face, hy - 2);
    ctx.lineTo(hx + 20 * this.face, hy + 2);
    ctx.lineTo(hx + 8 * this.face, hy + 6);
    ctx.closePath();
    ctx.fill();
    // Wattle.
    ctx.fillStyle = CFG.WATTLE;
    ctx.beginPath();
    ctx.ellipse(hx + 6 * this.face, hy + 9, 4, 7, 0.2 * this.face, 0, Math.PI * 2);
    ctx.fill();
    // Eye.
    ctx.fillStyle = '#1c1410';
    ctx.beginPath();
    ctx.arc(hx + 4 * this.face, hy - 4, 2.6, 0, Math.PI * 2);
    ctx.fill();
    // Snood.
    ctx.strokeStyle = CFG.WATTLE;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(hx + 10 * this.face, hy - 8);
    ctx.lineTo(hx + 13 * this.face, hy + 2);
    ctx.stroke();
  }
}
