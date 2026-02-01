import { Pool } from "../utils.js";
import { enemies, bullets } from "../state.js";
import { GAME_CONFIG } from "../config.js";

// -- Bullet (Pooled) --
export const bulletPool = new Pool(
  () => ({ x: 0, y: 0, tx: 0, ty: 0, dead: true, trail: [] }),
  (b, x, y, target) => {
    b.x = x;
    b.y = y;
    b.target = target;
    b.dead = false;
    b.trail = [];
  },
);

export function updateBullets(dt, onHitCallback) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];

    if (!b.target || enemies.indexOf(b.target) === -1) {
      b.dead = true;
    } else {
      // Update trail
      b.trail.push({ x: b.x, y: b.y });
      if (b.trail.length > GAME_CONFIG.BULLET.TRAIL_LENGTH) b.trail.shift();

      // Move
      const dx = b.target.x - b.x;
      const dy = b.target.y - b.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const moveDist = GAME_CONFIG.BULLET.SPEED * dt;

      if (dist < moveDist) {
        b.x = b.target.x;
        b.y = b.target.y;
        b.dead = true;
        if (onHitCallback) onHitCallback(b.target);
      } else {
        b.x += (dx / dist) * moveDist;
        b.y += (dy / dist) * moveDist;
      }
    }

    if (b.dead) {
      bulletPool.release(b);
      bullets.splice(i, 1);
    }
  }
}

export function drawBullets(ctx) {
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  for (const b of bullets) {
    ctx.beginPath();
    ctx.strokeStyle = `rgba(0, 243, 255, 0.5)`;
    if (b.trail.length > 0) {
      ctx.moveTo(b.trail[0].x, b.trail[0].y);
      for (let p of b.trail) ctx.lineTo(p.x, p.y);
    }
    ctx.lineTo(b.x, b.y);
    ctx.stroke();

    ctx.fillStyle = GAME_CONFIG.BULLET.COLOR;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}
