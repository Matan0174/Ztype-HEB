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
    this.size = this.z * 0.6 + Math.random() * 0.5;
    this.opacity = Math.random() * 0.5 + 0.3;
    this.rgb = ["255, 255, 255", "180, 220, 255", "255, 200, 255"][Math.floor(Math.random() * 3)];
    this.twinklePhase = Math.random() * Math.PI * 2;
    this.twinkleSpeed = Math.random() * 2 + 1;
  }

  update(dt) {
    // Move stars down to simulate forward movement
    this.y += GAME_CONFIG.BACKGROUND.STAR_SPEED * this.z * dt;
    this.twinklePhase += this.twinkleSpeed * dt;

    if (this.y > canvas.height) {
      this.y = 0;
      this.x = Math.random() * canvas.width;
    }
  }

  draw(ctx) {
    const alpha = this.opacity * (0.7 + 0.3 * Math.sin(this.twinklePhase));
    ctx.fillStyle = `rgba(${this.rgb}, ${alpha})`;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
  }
}
