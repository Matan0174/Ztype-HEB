import { GAME_CONFIG } from "./config.js";
import { 
    state, canvas, ctx, ui, 
    enemies, bullets, stars, setStars 
} from "./state.js";
import { audioCtx, playSound, toggleMute, startMusic } from "./audio.js";
import { Star } from "./entities/Star.js";
import { updateBullets, drawBullets } from "./entities/Bullet.js";
import { createExplosion, updateParticles, drawParticles } from "./entities/Particle.js";
import { spawnEnemy, startLevel, enemyHit, updateMultiplier } from "./logic.js";
import { showScreen, bindUIEvents } from "./uiManager.js";
import { handleKeydown } from "./input.js";

// ---- Initialization ----

if (ui.highScoreEl) ui.highScoreEl.innerText = state.highScore;

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  state.player.x = canvas.width / 2;
  state.player.y = canvas.height - GAME_CONFIG.PLAYER.Y_OFFSET;

  if (stars.length === 0) initStars();
}
window.addEventListener("resize", resize);

function initStars() {
  const newStars = [];
  for (let i = 0; i < GAME_CONFIG.BACKGROUND.STAR_COUNT; i++) {
    newStars.push(new Star());
  }
  setStars(newStars);
}

// ---- Game Flow Control ----

function levelComplete() {
  state.mode = "level_complete";
  const bonus = state.level * 1000;
  state.score += bonus;
  ui.scoreEl.innerText = state.score;

  ui.completedLevelNumEl.innerText = state.level;
  ui.levelBonusEl.innerText = bonus;

  showScreen("level-complete-screen");
  playSound("lock");
}

function nextLevel() {
  startLevel(state.level + 1);
  state.mode = "playing";
  updateMultiplier(false);
  showScreen("none");
  if (audioCtx.state === "suspended") audioCtx.resume();
  state.lastTime = performance.now();
  requestAnimationFrame(gameLoop);
}

export function togglePause() {
  if (state.mode === "playing") {
    state.mode = "paused";
    showScreen("pause-screen");
    if (audioCtx.state === "running") audioCtx.suspend();
  } else if (state.mode === "paused") {
    state.mode = "playing";
    showScreen("none");
    if (audioCtx.state === "suspended") audioCtx.resume();
    state.lastTime = performance.now();
    requestAnimationFrame(gameLoop);
  }
}

function startGame(skipReset = false) {
  state.mode = "playing";
  state.score = 0;
  if (!skipReset) state.level = 1;
  startLevel(state.level);
  state.multiplier = 1;
  updateMultiplier(false);

  ui.scoreEl.innerText = state.score;
  ui.levelEl.innerText = state.level;

  showScreen("none");
  ui.newHighScoreEl.classList.add("hidden");
  if (ui.pauseGameBtn) ui.pauseGameBtn.classList.remove("hidden");

  if (audioCtx.state === "suspended") audioCtx.resume();
  
  startMusic();

  initStars();
  resize();

  state.lastTime = performance.now();
  requestAnimationFrame(gameLoop);
}

function gameOver() {
  state.mode = "gameover";
  ui.finalScoreEl.innerText = state.score;
  if (state.score > state.highScore) {
    state.highScore = state.score;
    localStorage.setItem("ztype_he_highscore", state.highScore);
    ui.highScoreEl.innerText = state.highScore;
    ui.newHighScoreEl.classList.remove("hidden");
  }
  
  if (ui.retryLevelNumEl) ui.retryLevelNumEl.innerText = state.level;
  
  showScreen("game-over-screen");
}

// ---- Main Game Loop ----
function gameLoop(timestamp) {
  if (state.mode !== "playing") return;

  const dtMs = timestamp - state.lastTime;
  const dt = Math.min(dtMs / 1000, 0.1); 
  state.lastTime = timestamp;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 1. Draw Background
  stars.forEach((s) => {
    s.update(dt);
    s.draw(ctx);
  });

  // 2. Spawning
  state.spawnTimer += dtMs;
  const currentSpawnInterval = Math.max(
    GAME_CONFIG.ENEMY.SPAWN_INTERVAL_MIN,
    GAME_CONFIG.ENEMY.SPAWN_INTERVAL_BASE - state.level * 100,
  );
  if (state.spawnTimer > currentSpawnInterval) {
    spawnEnemy();
    state.spawnTimer = 0;
  }

  // 3. Player
  let angle = 0;
  if (state.targetEnemy) {
    const dx = state.targetEnemy.x - state.player.x;
    const dy = state.targetEnemy.y - state.player.y;
    angle = Math.atan2(dy, dx) + Math.PI / 2; 
  }

  ctx.save();
  ctx.translate(state.player.x, state.player.y);
  ctx.rotate(angle);

  ctx.fillStyle = GAME_CONFIG.PLAYER.COLOR_PRIMARY;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-20, 40);
  ctx.lineTo(0, 30); 
  ctx.lineTo(20, 40);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = GAME_CONFIG.PLAYER.COLOR_SECONDARY;
  ctx.beginPath();
  ctx.arc(0, 35, 5 + Math.random() * 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  if (state.targetEnemy) {
    ctx.beginPath();
    ctx.strokeStyle = "rgba(0, 243, 255, 0.15)";
    ctx.lineWidth = 2;
    ctx.moveTo(state.player.x, state.player.y);
    ctx.lineTo(state.targetEnemy.x, state.targetEnemy.y);
    ctx.stroke();
  }

  // 4. Update & Draw Enemies
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    e.update(dt);
    e.draw(ctx);

    const dist = Math.hypot(state.player.x - e.x, state.player.y - e.y);
    if (dist < e.radius + 20) {
      playSound("explosion");
      createExplosion(state.player.x, state.player.y, 100, "#ff0000");
      gameOver();
    }
  }

  // 5. Bullets
  updateBullets(dt, (enemy) => enemyHit(enemy, levelComplete));
  drawBullets(ctx);

  // 6. Particles
  updateParticles(dt);
  drawParticles(ctx);
  
  requestAnimationFrame(gameLoop);
}

// Input Listener
// Input Listener
window.addEventListener("keydown", (e) => handleKeydown(e, { 
    togglePause, 
    nextLevel, 
    startGame, 
    showScreen 
}));

// Bind UI
bindUIEvents({ startGame, nextLevel, togglePause, toggleMute });

// Initial Setup
resize();
showScreen("main-menu");
