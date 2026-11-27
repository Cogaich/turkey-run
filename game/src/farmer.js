// The farmer: he chases from behind, pitchfork in hand, and the gap between
// him and the turkey is the run's tension. `gap` is 0..100; 100 is a safe lead,
// 0 is caught. He is drawn at the left edge so the chase is always visible.
import { CFG } from './config.js';

export class Farmer {
  constructor() {
    this.reset();
  }

  reset() {
    this.gap = CFG.GAP_START;
    this.runPhase = 0;
    this.grunt = 0; // seconds since last "hey!" — drives the arm wave
  }

  update(dt, speed, clean) {
    this.runPhase += dt * (6 + speed / 90);
    if (clean) this.gap = Math.min(100, this.gap + CFG.GAP_RECOVER * dt);
    this.grunt += dt;
  }

  onHit() {
    this.gap = Math.max(0, this.gap - CFG.GAP_HIT);
    this.grunt = 0;
  }

  onCorn() {
    this.gap = Math.min(100, this.gap + CFG.GAP_CORN);
  }

  // Screen x of the farmer's centre. Turkey at ~260: gap 100 -> x ~0 (edge),
  // gap 0 -> x ~turkey.x - 60 (right on the bird).
  xFor(turkeyX) {
    return turkeyX - 60 - this.gap * 2.0;
  }

  draw(ctx, turkeyX, t) {
    this.drawAt(ctx, this.xFor(turkeyX), t);
  }

  // Draw the farmer centred at absolute screen x `x` (used by the menu,
  // where he lurks behind a hay bale instead of chasing).
  drawAt(ctx, x, t) {
    if (x < -90) {
      // Too far back to see: a puff of dust and a warning at the edge.
      ctx.fillStyle = 'rgba(122,82,48,0.5)';
      ctx.beginPath();
      ctx.ellipse(14, CFG.GROUND_Y + 4, 18, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff3c4';
      ctx.font = 'bold 20px Trebuchet MS, sans-serif';
      ctx.fillText('!', 10, CFG.GROUND_Y - 46);
      return;
    }
    const feet = CFG.GROUND_Y;
    const bob = Math.sin(this.runPhase) * 3;
    const bodyY = feet - 52 + bob;
    const legSwing = Math.sin(this.runPhase) * 12;

    // Shadow.
    ctx.fillStyle = 'rgba(40,20,8,0.30)';
    ctx.beginPath();
    ctx.ellipse(x, CFG.GROUND_Y + 8, 30, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Legs (overalls) + boots.
    ctx.strokeStyle = CFG.FARMER_OVERALLS;
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - 8, bodyY + 22);
    ctx.lineTo(x - 8 + legSwing, feet);
    ctx.moveTo(x + 8, bodyY + 22);
    ctx.lineTo(x + 8 - legSwing, feet);
    ctx.stroke();
    ctx.fillStyle = '#4a2f1a';
    ctx.fillRect(x - 14 + legSwing, feet - 6, 14, 7);
    ctx.fillRect(x + 2 - legSwing, feet - 6, 14, 7);

    // Body: shirt + overalls.
    ctx.fillStyle = CFG.FARMER_SHIRT;
    ctx.beginPath();
    ctx.ellipse(x, bodyY, 22, 24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = CFG.FARMER_OVERALLS;
    ctx.fillRect(x - 18, bodyY + 2, 36, 22);
    ctx.fillStyle = '#d8b13c';
    ctx.fillRect(x - 8, bodyY + 4, 5, 5);
    ctx.fillRect(x + 3, bodyY + 4, 5, 5);

    // Reaching arm + pitchfork, waving when he just closed in.
    const reach = 14 + (this.grunt < 0.8 ? Math.sin(this.grunt * 18) * 6 : 0);
    ctx.strokeStyle = CFG.FARMER_SKIN;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(x + 12, bodyY - 6);
    ctx.lineTo(x + 12 + reach, bodyY - 18);
    ctx.stroke();
    ctx.strokeStyle = CFG.WOOD;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x + 12 + reach - 6, bodyY + 26);
    ctx.lineTo(x + 12 + reach + 10, bodyY - 34);
    ctx.stroke();
    ctx.strokeStyle = '#c8ccd4';
    ctx.lineWidth = 3;
    for (let i = -1; i <= 1; i += 1) {
      ctx.beginPath();
      ctx.moveTo(x + 12 + reach + 10 + i * 5, bodyY - 34);
      ctx.lineTo(x + 12 + reach + 14 + i * 5, bodyY - 48);
      ctx.stroke();
    }

    // Head + straw hat.
    ctx.fillStyle = CFG.FARMER_SKIN;
    ctx.beginPath();
    ctx.arc(x + 4, bodyY - 34, 13, 0, Math.PI * 2);
    ctx.fill();
    // Moustache.
    ctx.fillStyle = '#6b4a26';
    ctx.fillRect(x - 2, bodyY - 30, 16, 4);
    // Hat.
    ctx.fillStyle = CFG.FARMER_HAT;
    ctx.beginPath();
    ctx.ellipse(x + 4, bodyY - 42, 22, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + 4, bodyY - 48, 13, 8, 0, Math.PI, 0);
    ctx.fill();
    // Eye, glaring at the turkey.
    ctx.fillStyle = '#1c1410';
    ctx.beginPath();
    ctx.arc(x + 10, bodyY - 38, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
}
