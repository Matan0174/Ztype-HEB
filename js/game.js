import { GAME_CONFIG } from "./config.js";
import { 
    state, canvas, ctx, ui, gameContainer, 
    enemies, bullets, particles, stars, levelWordDeck,
    setStars, setLevelWordDeck, resetEntities, setTargetEnemy 
} from "./state.js";
import { audioCtx, playSound, toggleMute } from "./audio.js";
import { Star } from "./entities/Star.js";
import { Enemy } from "./entities/Enemy.js";
import { bulletPool, updateBullets, drawBullets } from "./entities/Bullet.js";
import { particlePool, createExplosion, updateParticles, drawParticles } from "./entities/Particle.js";
import { getLevelWordPool, getRandomBossWord } from "./words.js";

// ---- Initialization ----

if (ui.highScoreEl) ui.highScoreEl.innerText = state.highScore;

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  state.player.x = canvas.width / 2;
  state.player.y = canvas.height - GAME_CONFIG.PLAYER.Y_OFFSET;

  // Re-init stars if needed or just let them be
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

// -- Level Select Logic --
function initLevelSelect() {
    ui.levelsGrid.innerHTML = '';
    for (let i = 1; i <= GAME_CONFIG.LEVELS.MAX; i++) {
        const btn = document.createElement('div');
        btn.classList.add('level-btn');
        btn.innerText = i;
        
        // All levels unlocked for now
        btn.onclick = () => {
            state.level = i;
            startGame(true); // true = skip reset level to 1
        };
        
        ui.levelsGrid.appendChild(btn);
    }
}

// ---- Game Flow Control ----

function updateMultiplier(increase) {
  if (increase) {
    state.multiplier++;
    if (state.multiplier > state.maxMultiplier) state.maxMultiplier = state.multiplier;
  } else {
    state.multiplier = 1;
    playSound("combo_break");
  }

  ui.comboValue.innerText = state.multiplier;

  if (state.multiplier > 1) {
    ui.comboDisplay.classList.remove("hidden");
    ui.comboDisplay.classList.remove("pulse");
    void ui.comboDisplay.offsetWidth;
    ui.comboDisplay.classList.add("pulse");
  } else {
    ui.comboDisplay.classList.add("hidden");
  }
}

function spawnEnemy() {
  if (state.enemiesSpawnedCount >= state.enemiesToSpawn) return;

  let word = "שגיאה";

  // Random Boss Logic
  if (
    state.level > 5 &&
    Math.random() < 0.05
  ) {
    word = getRandomBossWord();
  } else {
    if (levelWordDeck.length === 0) {
      setLevelWordDeck(getLevelWordPool(state.level));
    }
    if (levelWordDeck.length > 0) word = levelWordDeck.pop();
  }

  enemies.push(new Enemy(word));
  state.enemiesSpawnedCount++;
}

function startLevel(lvl) {
  state.level = lvl;
  ui.levelEl.innerText = state.level;

  // Difficulty curve:
  state.enemiesToSpawn = 10 + state.level * 5;
  state.enemiesSpawnedCount = 0;

  resetEntities(); // clears enemies, targetEnemy
  state.spawnTimer = 0;

  setLevelWordDeck(getLevelWordPool(state.level));
}

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

function showScreen(screenId) {
  document
    .querySelectorAll(".screen")
    .forEach((s) => s.classList.remove("active"));
  if (screenId !== "none") {
    document.getElementById(screenId).classList.add("active");
  }

  if (screenId === "main-menu" || screenId === "game-over-screen") {
    if (ui.pauseGameBtn) ui.pauseGameBtn.classList.add("hidden");
  }
}

function togglePause() {
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

  // Init effects
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

// ---- Input Handling ----
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (state.mode === "playing" || state.mode === "paused") {
      togglePause();
      return;
    }
  }

  if (state.mode !== "playing") return;

  const char = e.key;
  if (char.length !== 1) return;

  let hit = false;
  let hitEnemy = null;

  if (!state.targetEnemy) {
    // Find optimal target (closest to player) that starts with char
    const candidates = enemies.filter((enemy) =>
      enemy.logicalRemaining.startsWith(char),
    );
    if (candidates.length > 0) {
      candidates.sort((a, b) => b.y - a.y); // Higher Y = Closer to bottom (player)
      setTargetEnemy(candidates[0]);
      hitEnemy = state.targetEnemy;
      hit = true;
    }
  } else {
    if (state.targetEnemy.logicalRemaining.startsWith(char)) {
      hitEnemy = state.targetEnemy;
      hit = true;
    }
  }

  if (hit && hitEnemy) {
    processHit(hitEnemy);
  } else {
    if (state.multiplier > 1) updateMultiplier(false);
  }
});

function processHit(enemy) {
  // Visual bullet
  const b = bulletPool.get(state.player.x, state.player.y, enemy);
  bullets.push(b);

  playSound("shoot");

  // Logic
  enemy.logicalRemaining = enemy.logicalRemaining.substring(1);

  if (enemy.logicalRemaining.length === 0) {
    setTargetEnemy(null);
  }
}

function enemyHit(enemy) {
  // Visual Update
  enemy.matched += enemy.remaining[0];
  enemy.remaining = enemy.remaining.substring(1);

  // Knockback effect
  enemy.y -= GAME_CONFIG.ENEMY.KNOCKBACK_DISTANCE;

  if (enemy.remaining.length === 0) {
    state.score += enemy.fullWord.length * 10 * state.multiplier;
    ui.scoreEl.innerText = state.score;

    updateMultiplier(true);
    createExplosion(
      enemy.x,
      enemy.y,
      enemy.isBoss ? 50 : 20,
      GAME_CONFIG.PLAYER.COLOR_SECONDARY,
    );
    playSound("explosion");

    const index = enemies.indexOf(enemy);
    if (index > -1) enemies.splice(index, 1);
    
    // Safety check
    if (state.targetEnemy === enemy) setTargetEnemy(null);

    if (state.enemiesSpawnedCount >= state.enemiesToSpawn && enemies.length === 0) {
      setTimeout(levelComplete, 500);
    }
  }
}

// ---- Main Game Loop ----
function gameLoop(timestamp) {
  if (state.mode !== "playing") return;

  // Delta Time calculation (in seconds)
  const dtMs = timestamp - state.lastTime;
  const dt = Math.min(dtMs / 1000, 0.1); // Cap dt at 0.1s to prevent huge jumps on lag
  state.lastTime = timestamp;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 1. Draw Background
  stars.forEach((s) => {
    s.update(dt);
    s.draw(ctx);
  });

  // 2. Spawning
  state.spawnTimer += dtMs;
  // Dynamic spawn rate based on level
  const currentSpawnInterval = Math.max(
    GAME_CONFIG.ENEMY.SPAWN_INTERVAL_MIN,
    GAME_CONFIG.ENEMY.SPAWN_INTERVAL_BASE - state.level * 100,
  );
  if (state.spawnTimer > currentSpawnInterval) {
    spawnEnemy();
    state.spawnTimer = 0;
  }

  // 3. Player
  // Calculate angle
  let angle = 0;
  if (state.targetEnemy) {
    const dx = state.targetEnemy.x - state.player.x;
    const dy = state.targetEnemy.y - state.player.y;
    angle = Math.atan2(dy, dx) + Math.PI / 2; // +90deg because drawing points up (-y)
  }

  ctx.save();
  ctx.translate(state.player.x, state.player.y);
  ctx.rotate(angle);

  ctx.fillStyle = GAME_CONFIG.PLAYER.COLOR_PRIMARY;
  ctx.beginPath();
  // Simple Ship Shape drawing relative to (0,0)
  ctx.moveTo(0, 0);
  ctx.lineTo(-20, 40);
  ctx.lineTo(0, 30); // Engine notch
  ctx.lineTo(20, 40);
  ctx.closePath();
  ctx.fill();

  // Engine Glow
  ctx.fillStyle = GAME_CONFIG.PLAYER.COLOR_SECONDARY;
  ctx.beginPath();
  ctx.arc(0, 35, 5 + Math.random() * 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // Beam to target
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

    // Collision Check
    const dist = Math.hypot(state.player.x - e.x, state.player.y - e.y);
    if (dist < e.radius + 20) {
      playSound("explosion");
      createExplosion(state.player.x, state.player.y, 100, "#ff0000");
      gameOver();
    }
  }

  // 5. Bullets
  updateBullets(dt, enemyHit);
  drawBullets(ctx);

  // 6. Particles
  updateParticles(dt);
  drawParticles(ctx);
  
  // Loop
  requestAnimationFrame(gameLoop);
}

// UI Event Binding (moved here to ensure everything is loaded)
document.getElementById("menu-start-btn").onclick = () => startGame();
document.getElementById("menu-levels-btn").onclick = () => {
    initLevelSelect();
    showScreen("level-select-screen");
};
document.getElementById("menu-guide-btn").onclick = () => showScreen("guide-screen");
document.getElementById("menu-about-btn").onclick = () => showScreen("about-screen");
document.getElementById("restart-btn").onclick = () => startGame();
document.getElementById("home-btn").onclick = () => showScreen("main-menu");
document.getElementById("next-level-btn").onclick = nextLevel;
document.getElementById("resume-btn").onclick = togglePause;
document.getElementById("pause-home-btn").onclick = () => showScreen("main-menu");
document.getElementById("retry-level-btn").onclick = () => startGame(); // Retry just restarts level? 
document.getElementById("level-home-btn").onclick = () => showScreen("main-menu");
document.getElementById("toggle-sound").onclick = () => {
    const isMuted = toggleMute();
    document.getElementById("toggle-sound").innerText = isMuted ? "🔇" : "🔊";
};

document.querySelectorAll(".back-btn").forEach((btn) => {
    btn.onclick = () => {
        showScreen("main-menu"); // Simplification: back always goes to menu based on existing logic
    };
});

// Initial Setup
resize();
showScreen("main-menu");
