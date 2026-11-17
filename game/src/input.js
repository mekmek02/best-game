// Keyboard and mouse state, translated into field coordinates. The game canvas
// is scaled to the window and letterboxed, so a mouse position is only useful
// after it is mapped back into the 1280x720 field.
import { FIELD } from './config.js';

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.mouseX = FIELD.width / 2;
    this.mouseY = FIELD.height / 2 - 120;
    this.mouseDown = false;
    // Clicks are queued with their field position; the state machine drains the
    // queue once per frame, so a click is never read twice.
    this.clicks = [];
    this.pressed = new Set();
    this.onKeyDown = (event) => {
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) event.preventDefault();
      if (!event.repeat) this.pressed.add(key);
      this.keys.add(key);
    };
    this.onKeyUp = (event) => {
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      this.keys.delete(key);
    };
    this.onMouseMove = (event) => {
      const pos = this.toField(event.clientX, event.clientY);
      this.mouseX = pos.x;
      this.mouseY = pos.y;
    };
    this.onMouseDown = (event) => {
      if (event.button !== 0) return;
      this.mouseDown = true;
      const pos = this.toField(event.clientX, event.clientY);
      this.clicks.push(pos);
    };
    this.onMouseUp = (event) => {
      if (event.button === 0) this.mouseDown = false;
    };
    this.onBlur = () => {
      this.keys.clear();
      this.mouseDown = false;
    };
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    canvas.addEventListener('mousemove', this.onMouseMove);
    canvas.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
  }

  toField(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / FIELD.width, rect.height / FIELD.height);
    const offsetX = rect.left + (rect.width - FIELD.width * scale) / 2;
    const offsetY = rect.top + (rect.height - FIELD.height * scale) / 2;
    return {
      x: (clientX - offsetX) / scale,
      y: (clientY - offsetY) / scale,
    };
  }

  // The movement vector from WASD or the arrow keys, normalised.
  moveVector() {
    let x = 0;
    let y = 0;
    if (this.keys.has('a') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('d') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('w') || this.keys.has('ArrowUp')) y -= 1;
    if (this.keys.has('s') || this.keys.has('ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) {
      const inv = 1 / Math.sqrt(2);
      x *= inv;
      y *= inv;
    }
    return { x, y };
  }

  // True while the fire button is held, or while Space is held (keyboard-only
  // players fire toward the nearest shadow).
  firing() {
    return this.mouseDown || this.keys.has(' ');
  }

  wasPressed(key) {
    return this.pressed.has(key);
  }

  drainClicks() {
    const out = this.clicks;
    this.clicks = [];
    return out;
  }

  endFrame() {
    this.pressed.clear();
  }
}
