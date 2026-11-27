// Turkey Run — bootstrap. Sets up the canvas, starts the game loop, and stages
// deterministic screenshots behind ?shot=title|play|hazard|end|escape (&seed=1).
import { CFG } from './config.js';
import { Game, SCREEN_TITLE } from './game.js';
import { stageShot } from './stage.js';

const canvas = document.getElementById('game');
canvas.width = CFG.W;
canvas.height = CFG.H;

const game = new Game(canvas);

function fit() {
  const scale = Math.min(window.innerWidth / CFG.W, window.innerHeight / CFG.H);
  canvas.style.width = `${Math.floor(CFG.W * scale)}px`;
  canvas.style.height = `${Math.floor(CFG.H * scale)}px`;
}
window.addEventListener('resize', fit);
fit();

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seed = Number(params.get('seed') || 1);

// Read-only snapshot for the playtest probe (state, never a cheat: it only
// reports what the game already knows).
window.__turkeyRun = {
  game,
  state: () => game.snapshot(),
  start: () => game.start(),
};

if (shot) {
  // Staged screenshot: simulate the real rules to the frozen moment, draw once.
  stageShot(shot, game);
  game.draw();
  window.__shotReady = true;
  // The staged frame stays frozen for the screenshot, but the screen still
  // answers input (the probe clicks MENU on the staged end screen): one
  // input step + one redraw per gesture, no running loop, so the frozen
  // frame never drifts before it is captured.
  const interact = () => { game.handleInput(); game.draw(); };
  window.addEventListener('pointerdown', interact);
  window.addEventListener('keydown', interact);
} else {
  let last = performance.now();
  const loop = (now) => {
    const dt = (now - last) / 1000;
    last = now;
    game.update(dt);
    game.draw();
    requestAnimationFrame(loop);
  };
  game.screen = SCREEN_TITLE;
  requestAnimationFrame(loop);
}
