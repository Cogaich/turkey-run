// Screenshot staging behind ?shot=title|play|hazard|end|escape (&seed=1).
// Each scene plays the real rules forward from a fresh world for a fixed number
// of steps, steered by a simple autopilot, so the frame is what a real run looks
// like — and the same seed always gives the same frame. The staged game never
// listens to input; it only draws the frozen moment.
import { CFG } from './config.js';
import { SCREEN_TITLE, SCREEN_PLAY, SCREEN_CAUGHT, SCREEN_ESCAPED } from './game.js';

const STEP = 1 / 60;
const PLAY_SECONDS = 24;
const HAZARD_LIMIT_SECONDS = 150;
const END_LIMIT_SECONDS = 300;
const ESCAPE_LIMIT_SECONDS = 400;

/**
 * Autopilot: jump when a jumpable obstacle is close ahead, sidestep a falling
 * knife, drift toward the nearest corn. `skill` 0..1 scales how early it jumps.
 */
function autopilot(game, skill) {
  const turkey = game.turkey;
  const camX = game.distPx;
  const tx = camX + turkey.x;
  const speed = game.speedNow;
  let move = 0;
  let jump = false;

  // Nearest knife falling near us: sidestep away from its x — but only
  // while grounded. Dodging mid-jump drags the turkey backwards through
  // the air and lands it on the very obstacle it was jumping (the staged
  // escape run died three times that way). Airborne, the bird is usually
  // above the blade anyway.
  for (const it of game.field.items) {
    if (it.kind !== 'knife' || it.spent) continue;
    const dx = it.x - tx;
    if (it.state === 'fall' && it.y < turkey.y && Math.abs(dx) < 70) {
      if (turkey.grounded) move = dx > 0 ? -1 : 1;
    }
    if (it.state === 'warn' && Math.abs(dx) < 250) {
      if (turkey.grounded) move = dx > 0 ? -1 : 1;
    }
  }

  // Nearest ground obstacle ahead: jump when one jump's flight clears it.
  // One jump flies speed * 0.754 px (airtime 2*980/2600 s); the turkey must
  // land past the far edge plus a margin, so the jump starts when the far
  // edge plus margin fits inside the flight — early enough for wide ovens,
  // late enough not to land on the next hazard.
  let nearest = null;
  for (const it of game.field.items) {
    if (it.spent || it.kind === 'corn' || it.kind === 'puddle' || it.kind === 'knife') continue;
    const dx = it.x - tx;
    if (dx > -20 && (nearest === null || dx < nearest.dx)) nearest = { dx, it };
  }
  if (nearest && turkey.grounded) {
    const flight = speed * 0.754;
    // Margin must clear the obstacle's HEIGHT, not just its width: the
    // turkey's feet are still low when its rear edge crosses the far edge
    // of a tall bale/oven, so a width-only margin clips the far corner
    // (that was the 4 px clip killing every staged run at ~128 m).
    const margin = 30 + nearest.it.h + (1 - skill) * 30;
    const need = nearest.dx + nearest.it.w + margin;
    if (need <= flight && nearest.dx > -10) {
      jump = true;
      game.jumpLog.push({ dist: Math.floor(game.distM), kind: nearest.it.kind, dx: Math.round(nearest.dx), w: nearest.it.w, flight: Math.round(flight) });
    }
  }

  // Drift toward the nearest corn when nothing threatens us.
  if (move === 0 && !jump) {
    let corn = null;
    for (const it of game.field.items) {
      if (it.kind !== 'corn' || it.spent) continue;
      const dx = it.x - tx;
      if (dx > -40 && dx < 500 && (corn === null || dx < corn.dx)) corn = { dx, it };
    }
    if (corn) move = corn.dx > 30 ? 1 : corn.dx < -30 ? -1 : 0;
  }

  // Feed the decisions in through the turkey directly (no input events).
  if (jump) {
    turkey.buffer = 0.12;
    turkey.coyote = 0.1;
  }
  // Freeze horizontal drift mid-jump: chasing corn (or anything) while
  // airborne drags the turkey backwards through the air and lands it on
  // the obstacle it was jumping. All steering happens on the ground.
  if (!turkey.grounded) move = 0;

  return move;
}

// One simulation step with the autopilot steering (or standing still).
function simStep(game, skill, frozen) {
  if (frozen) return;
  const move = skill === null ? 0 : autopilot(game, skill);
  // Reuse the game's own step, but bypass its input reads by pre-setting the
  // turkey's jump buffer and moving it here; game.step reads input for move,
  // so we temporarily patch the input's moveDir.
  const input = game.input;
  const origMove = input.moveDir;
  input.moveDir = () => move;
  const alive = game.step(STEP);
  input.moveDir = origMove;
  return alive;
}

/**
 * Set `game` to the named scene and return the screen it should draw.
 * name: title | play | hazard | end | escape (anything else is title).
 */
export function stageShot(name, game) {
  game.reset();
  if (name === 'title') {
    game.screen = SCREEN_TITLE;
    // 0.3 s in: the "PRESS SPACE OR CLICK START" blink is on and the turkey
    // is mid-peck, so the cover shows the live menu at its liveliest.
    for (let i = 0; i < 0.3 / STEP; i += 1) game.t += STEP;
    game.turkey.peck = true;
    return SCREEN_TITLE;
  }

  game.screen = SCREEN_PLAY;
  if (name === 'play') {
    for (let i = 0; i < PLAY_SECONDS / STEP; i += 1) {
      if (simStep(game, 0.85) === false) break;
    }
    return game.screen === SCREEN_PLAY ? SCREEN_PLAY : game.screen;
  }

  if (name === 'hazard') {
    // Freeze on a frame with an oven ahead and a knife in the air.
    for (let i = 0; i < HAZARD_LIMIT_SECONDS / STEP; i += 1) {
      if (simStep(game, 0.85) === false) break;
      const camX = game.distPx;
      const tx = camX + game.turkey.x;
      let ovenNear = false;
      let knifeNear = false;
      for (const it of game.field.items) {
        if (it.spent) continue;
        const dx = it.x - tx;
        if (it.kind === 'oven' && dx > 180 && dx < 560) ovenNear = true;
        if (it.kind === 'knife' && it.state === 'fall' && Math.abs(dx) < 260) knifeNear = true;
      }
      if (ovenNear && knifeNear) break;
    }
    return SCREEN_PLAY;
  }

  if (name === 'escape') {
    for (let i = 0; i < ESCAPE_LIMIT_SECONDS / STEP; i += 1) {
      if (simStep(game, 0.95) === false) break;
      if (game.distM >= CFG.GOAL_M) break;
    }
    if (game.screen === SCREEN_CAUGHT || game.screen === SCREEN_ESCAPED) game.t += 1;
    return game.screen;
  }

  // 'end' (and anything else): stand still, get caught, show the end screen.
  for (let i = 0; i < END_LIMIT_SECONDS / STEP; i += 1) {
    if (simStep(game, null) === false) break;
  }
  // Let the 0.6 s restart guard pass so the staged end screen is clickable.
  if (game.screen === SCREEN_CAUGHT || game.screen === SCREEN_ESCAPED) game.t += 1;
  return game.screen === SCREEN_PLAY ? SCREEN_CAUGHT : game.screen;
}
