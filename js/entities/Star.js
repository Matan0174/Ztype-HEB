import { canvas } from "../state.js";
import { GAME_CONFIG } from "../config.js";

// -- Background Stars --
export class Star {
  constructor() {
    this.reset();
  }

  reset() {
    this.x = Math.random() * canvas.width;
    this.y = Math.random() * canvas.height;
    this.z = Math.random() * 2 + 0.5; // Depth factor
    this.size = Math.random() * 1.5;
    this.opacity = Math.random() * 0.5 + 0.3;
  }

  update(dt) {
    // Move stars down to simulate forward movement
    this.y += GAME_CONFIG.BACKGROUND.STAR_SPEED * this.z * dt;

    if (this.y > canvas.height) {
      this.y = 0;
      this.x = Math.random() * canvas.width;
    }
  }

  draw(ctx) {
    ctx.fillStyle = `rgba(255, 255, 255, ${this.opacity})`;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
  }
}
