// Keyboard + mouse/touch input, collected as edges the game consumes.
// The game reads this, never the DOM directly, so the same input works for a
// human player and for the playtest probe (which dispatches real key events).
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.jumpQueued = false;
    this.clicks = []; // {x, y} in canvas pixels, consumed in order
    this.edges = new Set(); // key codes pressed since last consume

    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (!e.repeat) {
        this.keys.add(e.code);
        this.edges.add(e.code);
        if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') this.jumpQueued = true;
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    canvas.addEventListener('pointerdown', (e) => {
      const r = canvas.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * canvas.width;
      const y = ((e.clientY - r.top) / r.height) * canvas.height;
      this.clicks.push({ x, y });
      this.jumpQueued = true;
    });
  }

  // -1 left, +1 right, 0 still. Arrows and WASD both count.
  moveDir() {
    let d = 0;
    if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) d -= 1;
    if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) d += 1;
    return d;
  }

  takeJump() {
    const j = this.jumpQueued;
    this.jumpQueued = false;
    return j;
  }

  takeClicks() {
    const c = this.clicks;
    this.clicks = [];
    return c;
  }

  // Edge-triggered key: true once per press (Space, KeyR, KeyP, KeyM, Enter).
  takeEdge(code) {
    if (!this.edges.has(code)) return false;
    this.edges.delete(code);
    return true;
  }

  clearEdges() {
    this.edges.clear();
    this.jumpQueued = false;
    this.clicks = [];
  }
}
