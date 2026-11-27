// The farm at golden hour: sky, sun, clouds, hills, barn, windmill, fence and
// the dirt path. Scenery is placed by segment index (every 400 px of travel) and
// a stable hash, so running back over the same ground looks the same.
import { CFG } from './config.js';
import { hash01 } from './random.js';

function segVal(seg, salt) {
  return hash01(seg * 131 + salt * 7919);
}

export function drawFarm(ctx, camX, t) {
  // Sky.
  const sky = ctx.createLinearGradient(0, 0, 0, CFG.GROUND_Y);
  sky.addColorStop(0, CFG.SKY_TOP);
  sky.addColorStop(0.55, CFG.SKY_MID);
  sky.addColorStop(1, CFG.SKY_LOW);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, CFG.W, CFG.GROUND_Y);

  // Low sun with glow, upper right.
  const sunX = 1060;
  const sunY = 150;
  const glow = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 190);
  glow.addColorStop(0, 'rgba(255,243,196,0.95)');
  glow.addColorStop(0.35, 'rgba(255,220,140,0.45)');
  glow.addColorStop(1, 'rgba(255,220,140,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sunX - 200, sunY - 200, 400, 400);
  ctx.fillStyle = CFG.SUN;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 46, 0, Math.PI * 2);
  ctx.fill();

  // Clouds, drifting slowly with the camera at 0.1 parallax.
  ctx.fillStyle = 'rgba(255,240,214,0.85)';
  for (let i = 0; i < 6; i += 1) {
    const cx = ((i * 317 + 120 - camX * 0.1 - t * 6) % (CFG.W + 360) + CFG.W + 360) % (CFG.W + 360) - 180;
    const cy = 70 + (i % 3) * 52;
    const s = 0.7 + (i % 3) * 0.35;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 64 * s, 20 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + 38 * s, cy + 6, 44 * s, 16 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(cx - 40 * s, cy + 8, 40 * s, 14 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Far hills.
  ctx.fillStyle = CFG.HILL_FAR;
  ctx.beginPath();
  ctx.moveTo(0, 470);
  for (let x = 0; x <= CFG.W; x += 40) {
    ctx.lineTo(x, 470 - Math.sin((x + camX * 0.25) * 0.004) * 46 - 20);
  }
  ctx.lineTo(CFG.W, CFG.GROUND_Y);
  ctx.lineTo(0, CFG.GROUND_Y);
  ctx.closePath();
  ctx.fill();

  // Far-hill surface at a screen x — the same sine the hill is drawn with.
  // A building's base must sit on this line, not on a fixed y: a fixed base
  // floats up to 44 px whenever the hill dips below it.
  const farHillY = (sx) => 450 - Math.sin((sx + camX * 0.25) * 0.004) * 46;

  // Barn, windmill and silo on the far hill (parallax 0.35), one per 1400 px.
  const barnSeg = Math.floor((camX * 0.35) / 1400);
  for (let s = barnSeg - 1; s <= barnSeg + 1; s += 1) {
    const bx = s * 1400 + 320 - camX * 0.35;
    if (bx < -260 || bx > CFG.W + 260) continue;
    // Each structure's base sits on the hill at its own x, sunk 4 px so the
    // contact reads with no hairline gap. Contact shadows on the hill under
    // each base.
    const by = farHillY(bx + 75) + 4;
    const sy = farHillY(bx + 190) + 4;
    const my = farHillY(bx + 290) + 4;
    ctx.fillStyle = 'rgba(60,32,8,0.28)';
    ctx.beginPath();
    ctx.ellipse(bx + 75, by + 3, 88, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(bx + 190, sy + 3, 30, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(bx + 290, my + 3, 34, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    // Barn.
    ctx.fillStyle = CFG.BARN_RED;
    ctx.fillRect(bx, by - 74, 150, 74);
    ctx.fillStyle = CFG.BARN_DARK;
    ctx.beginPath();
    ctx.moveTo(bx - 10, by - 74);
    ctx.lineTo(bx + 75, by - 118);
    ctx.lineTo(bx + 160, by - 74);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f3e6c8';
    ctx.fillRect(bx + 58, by - 34, 34, 34);
    ctx.strokeStyle = CFG.BARN_DARK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(bx + 58, by - 17);
    ctx.lineTo(bx + 92, by - 17);
    ctx.moveTo(bx + 75, by - 34);
    ctx.lineTo(bx + 75, by);
    ctx.stroke();
    // Silo.
    ctx.fillStyle = '#c9c2b4';
    ctx.beginPath();
    ctx.roundRect(bx + 168, sy - 96, 44, 96, 20);
    ctx.fill();
    ctx.fillStyle = '#a89f8c';
    ctx.fillRect(bx + 168, sy - 96, 44, 8);
    // Windmill.
    const wx = bx + 290;
    ctx.strokeStyle = '#6b4a26';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(wx - 26, my);
    ctx.lineTo(wx, my - 92);
    ctx.lineTo(wx + 26, my);
    ctx.stroke();
    ctx.save();
    ctx.translate(wx, my - 96);
    ctx.rotate(t * 0.7);
    ctx.strokeStyle = '#e8dcc0';
    ctx.lineWidth = 4;
    for (let i = 0; i < 4; i += 1) {
      ctx.rotate(Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -44);
      ctx.lineTo(14, -40);
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();
  }

  // Near hill.
  ctx.fillStyle = CFG.HILL_NEAR;
  ctx.beginPath();
  ctx.moveTo(0, 540);
  for (let x = 0; x <= CFG.W; x += 40) {
    ctx.lineTo(x, 540 - Math.sin((x + camX * 0.5) * 0.006 + 2) * 26 - 8);
  }
  ctx.lineTo(CFG.W, CFG.GROUND_Y);
  ctx.lineTo(0, CFG.GROUND_Y);
  ctx.closePath();
  ctx.fill();

  // Trees on the near hill, one per ~500 px (parallax 0.5).
  const treeSeg = Math.floor((camX * 0.5) / 500);
  for (let s = treeSeg - 1; s <= treeSeg + 2; s += 1) {
    const tx = s * 500 + segVal(s, 7) * 300 - camX * 0.5;
    if (tx < -80 || tx > CFG.W + 80) continue;
    const th = 60 + segVal(s, 8) * 46;
    const ty = 528 - segVal(s, 9) * 26;
    ctx.fillStyle = '#5a3a1e';
    ctx.fillRect(tx - 5, ty, 10, 46);
    ctx.fillStyle = segVal(s, 10) > 0.5 ? '#c96a2e' : '#d98a2e';
    ctx.beginPath();
    ctx.arc(tx, ty - th * 0.4, th * 0.55, 0, Math.PI * 2);
    ctx.arc(tx - th * 0.4, ty - th * 0.1, th * 0.4, 0, Math.PI * 2);
    ctx.arc(tx + th * 0.4, ty - th * 0.1, th * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Fence along the path (parallax 0.75).
  ctx.fillStyle = CFG.WOOD;
  const fenceOff = (camX * 0.75) % 90;
  for (let x = -fenceOff; x < CFG.W + 90; x += 90) {
    ctx.fillRect(x, CFG.GROUND_Y - 44, 7, 44);
  }
  ctx.fillStyle = '#a8763f';
  ctx.fillRect(0, CFG.GROUND_Y - 34, CFG.W, 7);
  ctx.fillRect(0, CFG.GROUND_Y - 16, CFG.W, 7);

  // Ground: dirt with a worn path, grass strip on top.
  ctx.fillStyle = CFG.GROUND;
  ctx.fillRect(0, CFG.GROUND_Y, CFG.W, CFG.H - CFG.GROUND_Y);
  ctx.fillStyle = CFG.GRASS;
  ctx.fillRect(0, CFG.GROUND_Y, CFG.W, 12);
  ctx.fillStyle = CFG.GRASS_DARK;
  ctx.fillRect(0, CFG.GROUND_Y + 10, CFG.W, 4);
  ctx.fillStyle = '#8a5f36';
  ctx.beginPath();
  ctx.ellipse(CFG.W / 2, CFG.GROUND_Y + 66, CFG.W * 0.62, 34, 0, 0, Math.PI * 2);
  ctx.fill();

  // Grass tufts, flowers and pumpkins on the ground, per 400 px segment.
  const gSeg = Math.floor(camX / 400);
  for (let s = gSeg - 1; s <= gSeg + 3; s += 1) {
    for (let k = 0; k < 4; k += 1) {
      const gx = s * 400 + segVal(s * 4 + k, 3) * 380 - camX;
      if (gx < -30 || gx > CFG.W + 30) continue;
      const gy = CFG.GROUND_Y + 26 + segVal(s * 4 + k, 4) * 74;
      const kind = segVal(s * 4 + k, 5);
      if (kind < 0.55) {
        // Grass tuft.
        ctx.strokeStyle = kind < 0.3 ? CFG.GRASS : CFG.GRASS_DARK;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(gx, gy);
        ctx.lineTo(gx - 5, gy - 12);
        ctx.moveTo(gx, gy);
        ctx.lineTo(gx, gy - 14);
        ctx.moveTo(gx, gy);
        ctx.lineTo(gx + 5, gy - 12);
        ctx.stroke();
      } else if (kind < 0.8) {
        // Flower.
        ctx.fillStyle = ['#ff8fb2', '#ffd94a', '#fff3c4'][Math.floor(kind * 40) % 3];
        ctx.beginPath();
        ctx.arc(gx, gy - 6, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = CFG.GRASS_DARK;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(gx, gy);
        ctx.lineTo(gx, gy - 6);
        ctx.stroke();
      } else {
        // Pumpkin.
        ctx.fillStyle = '#e07b24';
        ctx.beginPath();
        ctx.ellipse(gx, gy - 6, 12, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#c96a1e';
        ctx.beginPath();
        ctx.ellipse(gx - 4, gy - 6, 5, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = CFG.GRASS_DARK;
        ctx.fillRect(gx - 1, gy - 17, 3, 6);
      }
    }
  }

  // Distance marker every 100 m: a small wooden sign.
  const mSeg = Math.floor(camX / (100 * CFG.PX_PER_M));
  for (let s = mSeg; s <= mSeg + 1; s += 1) {
    const mx = s * 100 * CFG.PX_PER_M - camX;
    if (mx < -40 || mx > CFG.W + 40 || s === 0) continue;
    ctx.fillStyle = CFG.WOOD;
    ctx.fillRect(mx - 2, CFG.GROUND_Y - 52, 5, 52);
    ctx.fillStyle = '#c9a05e';
    ctx.beginPath();
    ctx.roundRect(mx - 30, CFG.GROUND_Y - 74, 64, 26, 5);
    ctx.fill();
    ctx.fillStyle = '#4a2f1a';
    ctx.font = 'bold 15px Trebuchet MS, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${s * 100}m`, mx + 2, CFG.GROUND_Y - 56);
    ctx.textAlign = 'left';
  }

  // Birds crossing the sky, and autumn leaves drifting down — ambient motion
  // that keeps even the menu scene alive.
  ctx.strokeStyle = 'rgba(60,30,10,0.75)';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i += 1) {
    const bx = ((t * (26 + i * 9) + i * 430) % (CFG.W + 240)) - 120;
    const by = 84 + i * 46 + Math.sin(t * 1.4 + i * 2) * 8;
    const flap = Math.sin(t * 7 + i * 3) * 5;
    ctx.beginPath();
    ctx.moveTo(bx - 12, by - flap);
    ctx.quadraticCurveTo(bx, by + 4, bx, by);
    ctx.quadraticCurveTo(bx, by + 4, bx + 12, by - flap);
    ctx.stroke();
  }
  for (let i = 0; i < 6; i += 1) {
    const fall = (t * (18 + i * 4) + i * 137) % (CFG.H + 40);
    const lx = (i * 211 + Math.sin(t * 0.9 + i * 2.4) * 46 + 140) % CFG.W;
    const ly = fall - 20;
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(Math.sin(t * 1.7 + i) * 0.9);
    ctx.fillStyle = ['#d98a2e', '#c96a2e', '#b57f24'][i % 3];
    ctx.beginPath();
    ctx.ellipse(0, 0, 7, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
