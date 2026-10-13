import { Pool } from "../utils.js";
import { particles, gameContainer } from "../state.js";
import { GAME_CONFIG } from "../config.js";

// -- Particle (Pooled) --
export const particlePool = new Pool(
  () => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, size: 3, color: "#fff" }),
  (p, x, y, color) => {
    p.x = x;
    p.y = y;
    p.color = color;
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 150 + 50; // Pixels per sec
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed;
    p.life = GAME_CONFIG.PARTICLE.LIFE_BASE;
    p.size = Math.random() * 3 + 2;
  },
);

export const floatingTexts = [];

export function spawnFloatingText(x, y, text, color) {
  floatingTexts.push({ x, y, text, color, life: 1 });
}

export function createExplosion(x, y, count, color) {
  for (let i = 0; i < count; i++) {
    const p = particlePool.get(x, y, color);
    particles.push(p);
  }
  // Shake effect
  gameContainer.classList.remove("shake");
  void gameContainer.offsetWidth;
  gameContainer.classList.add("shake");
}

export function updateParticles(dt) {
  // Friction is tuned per 60fps frame
  const friction = Math.pow(GAME_CONFIG.PARTICLE.FRICTION, dt * 60);
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.vx *= friction;
    p.vy *= friction;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= GAME_CONFIG.PARTICLE.DECAY_RATE * dt;

    if (p.life <= 0) {
      particlePool.release(p);
      particles.splice(i, 1);
    }
  }

  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const t = floatingTexts[i];
    t.y -= 50 * dt;
    t.life -= dt;
    if (t.life <= 0) floatingTexts.splice(i, 1);
  }
}

export function drawParticles(ctx) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const p of particles) {
    const life = Math.max(0, p.life);
    const s = p.size * life;
    ctx.globalAlpha = life;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
  }
  ctx.restore();

  ctx.save();
  ctx.font = "bold 22px Rubik";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowBlur = 8;
  for (const t of floatingTexts) {
    ctx.globalAlpha = Math.max(0, t.life);
    ctx.fillStyle = t.color;
    ctx.shadowColor = t.color;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.restore();
}
