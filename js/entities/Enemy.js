import { canvas, state } from "../state.js";
import { GAME_CONFIG } from "../config.js";

// -- Enemy --
export class Enemy {
  constructor(word) {
    this.reset(word);
  }

  reset(word) {
    this.fullWord = word;
    this.remaining = word;
    this.logicalRemaining = word;
    this.matched = "";
    this.x = Math.random() * (canvas.width - 200) + 100;
    this.y = -50;
    // Logic: Base speed + Level modifier + Random Variance
    // Since 'level' is dynamic, we should read it from state
    const baseSpeed =
      GAME_CONFIG.ENEMY.BASE_SPEED +
      state.level * GAME_CONFIG.ENEMY.SPEED_INC_PER_LEVEL;
    // Add 20% variance so enemies don't move in a perfect line
    this.speed = baseSpeed * (0.8 + Math.random() * 0.4);

    this.isBoss = word.length > 10;
    this.radius = this.isBoss
      ? GAME_CONFIG.ENEMY.RADIUS_BOSS
      : GAME_CONFIG.ENEMY.RADIUS_BASE;
    if (this.isBoss) this.speed *= 0.6; // Bosses are slower

    // Visuals
    this.shape = ["circle", "hexagon", "triangle", "square"][
      Math.floor(Math.random() * 4)
    ];
    this.hue = Math.floor(Math.random() * 60) + 300; // 300-360 range
    this.angle = 0;
    this.spinSpeed = (Math.random() - 0.5) * 2; // Radians per second

    // Spawn entrance animation
    this.targetY = this.y;
  }

  update(dt) {
    // Move towards player
    const dx = state.player.x - this.x;
    const dy = state.player.y - this.y;
    this.angle += this.spinSpeed * dt;

    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 0) {
      this.x += (dx / dist) * this.speed * dt;
      this.y += (dy / dist) * this.speed * dt;
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    const isActive = state.targetEnemy === this;
    const baseColor = isActive
      ? GAME_CONFIG.PLAYER.COLOR_SECONDARY
      : `hsl(${this.hue}, 70%, 60%)`;

    ctx.beginPath();
    // Shape drawing logic
    if (this.shape === "hexagon") {
      for (let i = 0; i < 6; i++)
        ctx.lineTo(
          this.radius * Math.cos((i * Math.PI) / 3),
          this.radius * Math.sin((i * Math.PI) / 3),
        );
    } else if (this.shape === "triangle") {
      for (let i = 0; i < 3; i++)
        ctx.lineTo(
          this.radius * 1.2 * Math.cos((i * 2 * Math.PI) / 3 - Math.PI / 2),
          this.radius * 1.2 * Math.sin((i * 2 * Math.PI) / 3 - Math.PI / 2),
        );
    } else if (this.shape === "square") {
      ctx.rect(
        -this.radius * 0.8,
        -this.radius * 0.8,
        this.radius * 1.6,
        this.radius * 1.6,
      );
    } else {
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    }
    ctx.closePath();

    // Fill & Stroke
    ctx.fillStyle = this.isBoss
      ? GAME_CONFIG.PLAYER.COLOR_SECONDARY
      : baseColor;
    // If active, add glow to shape
    if (isActive) {
      ctx.shadowBlur = 15;
      ctx.shadowColor = GAME_CONFIG.PLAYER.COLOR_PRIMARY;
    }
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = isActive
      ? GAME_CONFIG.PLAYER.COLOR_PRIMARY
      : "rgba(255,255,255,0.3)";
    ctx.lineWidth = isActive ? 3 : 1;
    ctx.stroke();

    ctx.restore();

    // Text Drawing
    ctx.font = (this.isBoss ? "bold 30px" : "20px") + " Rubik";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    if (isActive) {
      ctx.shadowBlur = 10;
      ctx.shadowColor = GAME_CONFIG.PLAYER.COLOR_PRIMARY;
    }

    ctx.fillStyle = isActive ? GAME_CONFIG.PLAYER.COLOR_PRIMARY : "#ffffff";
    const textYOffset = this.radius + 25;

    // Draw remaining text
    ctx.fillText(this.remaining, this.x, this.y + textYOffset);

    // Optional: Draw matched part in different color or faint
    // ctx.fillStyle = 'rgba(255,255,255,0.3)';
    // ctx.fillText(this.matched, this.x, this.y + textYOffset - 20); // Above?

    ctx.shadowBlur = 0;
  }
}
