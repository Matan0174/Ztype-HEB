import { Pool } from "../utils.js";
import { particles, gameContainer } from "../state.js";
import { GAME_CONFIG } from "../config.js";

// -- Particle (Pooled) --
export const particlePool = new Pool(
  () => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, color: "#fff" }),
  (p, x, y, color) => {
    p.x = x;
    p.y = y;
    p.color = color;
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 150 + 50; // Pixels per sec
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed;
    p.life = GAME_CONFIG.PARTICLE.LIFE_BASE;
  },
);

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
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= GAME_CONFIG.PARTICLE.DECAY_RATE * dt;

    if (p.life <= 0) {
      particlePool.release(p);
      particles.splice(i, 1);
    }
  }
}

export function drawParticles(ctx) {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.rect(p.x, p.y, 4, 4);
    ctx.fill();
  }
  ctx.globalAlpha = 1.0;
}
