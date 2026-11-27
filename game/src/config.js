// Turkey Run — tuning constants. One place for every number the game balances on,
// so the feel can be tuned without hunting through the draw code.
export const CFG = {
  W: 1280,
  H: 720,
  GROUND_Y: 600,

  // Player physics (pixels, seconds).
  GRAVITY: 2600,
  JUMP_V: -980,
  MOVE_SPEED: 430,
  TURKEY_X_MIN: 120,
  TURKEY_X_MAX: 560,
  TURKEY_W: 64,
  TURKEY_H: 58,

  // World speed (px/s) grows with distance; distance in metres = px / 50.
  BASE_SPEED: 380,
  SPEED_PER_M: 0.14,
  SPEED_MAX: 760,
  PX_PER_M: 50,

  // Win / lose.
  GOAL_M: 1500,
  LIVES: 3,

  // The farmer chase: gap is 0..100. A hit costs 34; clean running regains 6/s;
  // a corn cob gives back 2. Gap 0 (or lives 0) means CAUGHT.
  GAP_START: 100,
  GAP_HIT: 34,
  GAP_RECOVER: 6,
  GAP_CORN: 2,

  // Spawning, in metres of travel between obstacle groups.
  SPAWN_MIN_M: 7,
  SPAWN_MAX_M: 14,

  // Palette: golden hour on the farm.
  SKY_TOP: '#ff9d5c',
  SKY_MID: '#ffc27a',
  SKY_LOW: '#ffe3a3',
  SUN: '#fff3c4',
  HILL_FAR: '#b98a4e',
  HILL_NEAR: '#8a6b3a',
  GROUND: '#7a5230',
  GROUND_DARK: '#5f3d22',
  GRASS: '#7fae4c',
  GRASS_DARK: '#5d8a38',
  BARN_RED: '#a63d2f',
  BARN_DARK: '#7e2c22',
  WOOD: '#8a5a33',
  HAY: '#e0a83c',
  HAY_DARK: '#b57f24',
  OVEN_IRON: '#3c3f46',
  OVEN_FIRE: '#ff7b24',
  OVEN_FIRE2: '#ffc93c',
  KNIFE: '#dfe6ee',
  KNIFE_HANDLE: '#5a3a22',
  CORN: '#ffd94a',
  CORN_HUSK: '#5d8a38',
  TURKEY_BODY: '#7a4a26',
  TURKEY_DARK: '#5a3418',
  TURKEY_TAIL: '#c96a2e',
  TURKEY_TAIL2: '#e8a33c',
  TURKEY_HEAD: '#e8e0d0',
  WATTLE: '#d43d2a',
  FARMER_SHIRT: '#3f6fb5',
  FARMER_OVERALLS: '#2e4a7a',
  FARMER_HAT: '#e0c06a',
  FARMER_SKIN: '#e8b98a',
};

// Difficulty: real settings, not labels. Speed multiplies the run speed,
// spawnMul stretches (easy) or squeezes (hard) the gap between obstacle
// groups, lives is how many hits the run survives.
export const DIFFS = {
  easy: { label: 'EASY', speedMul: 0.85, spawnMul: 1.35, lives: 4 },
  normal: { label: 'NORMAL', speedMul: 1.0, spawnMul: 1.0, lives: 3 },
  hard: { label: 'HARD', speedMul: 1.15, spawnMul: 0.8, lives: 2 },
};
export const DIFF_ORDER = ['easy', 'normal', 'hard'];

// Turkey outfits: palettes that actually repaint the bird in-game.
export const OUTFITS = {
  classic: { name: 'CLASSIC', body: '#7a4a26', dark: '#5a3418', tail: '#c96a2e', tail2: '#e8a33c' },
  golden: { name: 'GOLDEN', body: '#b57f24', dark: '#8a5f1a', tail: '#d43d2a', tail2: '#e8a33c' },
  snow: { name: 'SNOW', body: '#e8e0d0', dark: '#b8b0a0', tail: '#8a97a8', tail2: '#c9d2dc' },
};
export const OUTFIT_ORDER = ['classic', 'golden', 'snow'];
