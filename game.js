const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// ---- Game Configuration / הגדרות משחק ----
const GAME_CONFIG = {
  PLAYER: {
    COLOR_PRIMARY: "#00f3ff",
    COLOR_SECONDARY: "#f0f",
    Y_OFFSET: 50,
  },
  ENEMY: {
    BASE_SPEED: 40, // Pixels per second
    SPEED_INC_PER_LEVEL: 5,
    SPAWN_INTERVAL_BASE: 2000, // ms
    SPAWN_INTERVAL_MIN: 600,
    RADIUS_BASE: 20,
    RADIUS_BOSS: 40,
  },
  BULLET: {
    SPEED: 1200, // Pixels per second
    COLOR: "#00f3ff",
    TRAIL_LENGTH: 5,
  },
  PARTICLE: {
    GRAVITY: 0,
    FRICTION: 0.95,
    LIFE_BASE: 1.0,
    DECAY_RATE: 2.0, // Units per second
  },
  BACKGROUND: {
    STAR_COUNT: 100,
    STAR_SPEED: 10,
  },
  LEVELS: {
    MAX: 20,
  },
};

// ---- Game State / מצב משחק ----
let gameState = "start"; // start, playing, gameover, paused, level_complete, level_select
let score = 0;
let highScore = parseInt(localStorage.getItem("ztype_he_highscore")) || 0;
let level = 1;
let multiplier = 1;
let maxMultiplier = 1;
let lastTime = 0;
let spawnTimer = 0;
let isMuted = false;

// ---- Object Pools & Entities / מאגרי אובייקטים וישויות ----
// Using simple pooling for high-frequency objects to reduce GC
class Pool {
  constructor(createFn, resetFn) {
    this.createFn = createFn;
    this.resetFn = resetFn;
    this.pool = [];
  }

  get(...args) {
    let obj = this.pool.length > 0 ? this.pool.pop() : this.createFn();
    this.resetFn(obj, ...args);
    return obj;
  }

  release(obj) {
    this.pool.push(obj);
  }
}

// Entities arrays
let enemies = [];
let bullets = []; // Active bullets
let particles = []; // Active particles
let stars = []; // Background stars

let player = { x: 0, y: 0 };
let targetEnemy = null;

// DOM Elements
const uiLayer = document.getElementById("ui-layer");
const scoreEl = document.getElementById("score-value");
const finalScoreEl = document.getElementById("final-score");
const levelEl = document.getElementById("level-value");
const highScoreEl = document.querySelector("#hud-top .high-score span");
const comboDisplay = document.getElementById("combo-display");
const comboValue = document.getElementById("combo-value");
const toggleSoundBtn = document.getElementById("toggle-sound");
const newHighScoreEl = document.querySelector(".new-high-score");
const gameContainer = document.getElementById("game-container");
const pauseGameBtn = document.getElementById("pause-game-btn");
const completedLevelNumEl = document.getElementById("completed-level-num");
const levelBonusEl = document.getElementById("level-bonus");
const levelsGrid = document.getElementById("levels-grid");

// Buttons
const menuStartBtn = document.getElementById("menu-start-btn");
const menuLevelsBtn = document.getElementById("menu-levels-btn");
const menuGuideBtn = document.getElementById("menu-guide-btn");
const menuAboutBtn = document.getElementById("menu-about-btn");
const restartBtn = document.getElementById("restart-btn");
const homeBtn = document.getElementById("home-btn");
const nextLevelBtn = document.getElementById("next-level-btn");
const backBtns = document.querySelectorAll(".back-btn");
const resumeBtn = document.getElementById("resume-btn");
const pauseHomeBtn = document.getElementById("pause-home-btn");
const retryLevelBtn = document.getElementById("retry-level-btn");
const levelHomeBtn = document.getElementById("level-home-btn");
const retryLevelNumEl = document.getElementById("retry-level-num");

// Level Progression State
let enemiesToSpawn = 0;
let enemiesSpawnedCount = 0;
let levelWordDeck = [];

// ---- Audio Context ----
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx = new AudioContext();

if (highScoreEl) highScoreEl.innerText = highScore;

// ---- Audio Functions ----
function toggleMute() {
  isMuted = !isMuted;
  toggleSoundBtn.innerText = isMuted ? "🔇" : "🔊";
  if (isMuted) {
    if (audioCtx.state === "running") audioCtx.suspend();
  } else {
    if (audioCtx.state === "suspended") audioCtx.resume();
  }
}

function playSound(type) {
  if (isMuted || !audioCtx) return;
  if (audioCtx.state === "suspended") audioCtx.resume();

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);

  const now = audioCtx.currentTime;

  switch (type) {
    case "shoot":
      osc.type = "square";
      osc.frequency.setValueAtTime(400 + multiplier * 50, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
      break;
    case "explosion":
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(100, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.3);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
      break;
    case "lock":
      osc.type = "sine";
      osc.frequency.setValueAtTime(600, now);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
      break;
    case "combo_break":
      osc.type = "triangle";
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.linearRampToValueAtTime(100, now + 0.3);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.linearRampToValueAtTime(0.0, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
      break;
  }
}

// ---- Classes & Game Logic ----

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  player.x = canvas.width / 2;
  player.y = canvas.height - GAME_CONFIG.PLAYER.Y_OFFSET;

  // Re-init stars if needed or just let them be
  if (stars.length === 0) initStars();
}
window.addEventListener("resize", resize);

// -- Background Stars --
class Star {
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

function initStars() {
  stars = [];
  for (let i = 0; i < GAME_CONFIG.BACKGROUND.STAR_COUNT; i++) {
    stars.push(new Star());
  }
}

// -- Level Select Logic --
function initLevelSelect() {
    levelsGrid.innerHTML = '';
    for (let i = 1; i <= GAME_CONFIG.LEVELS.MAX; i++) {
        const btn = document.createElement('div');
        btn.classList.add('level-btn');
        btn.innerText = i;
        
        // All levels unlocked for now
        btn.onclick = () => {
            level = i;
            startGame(true); // true = skip reset level to 1
        };
        
        levelsGrid.appendChild(btn);
    }
}

// -- Enemy --
class Enemy {
  constructor(word) {
    this.reset(word);
  }

  reset(word) {
    this.fullWord = word;
    this.remaining = word;
    this.matched = "";
    this.x = Math.random() * (canvas.width - 200) + 100;
    this.y = -50;
    // Logic: Base speed + Level modifier + Random Variance
    const baseSpeed =
      GAME_CONFIG.ENEMY.BASE_SPEED +
      level * GAME_CONFIG.ENEMY.SPEED_INC_PER_LEVEL;
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
    const dx = player.x - this.x;
    const dy = player.y - this.y;
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

    const isActive = targetEnemy === this;
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

// -- Bullet (Pooled) --
const bulletPool = new Pool(
  () => ({ x: 0, y: 0, tx: 0, ty: 0, dead: true, trail: [] }),
  (b, x, y, target) => {
    b.x = x;
    b.y = y;
    b.target = target;
    b.dead = false;
    b.trail = [];
  },
);

function updateBullets(dt) {
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
        b.dead = true; // Hit! logic is handled immediately in processHit, bullet visuals catch up
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

function drawBullets(ctx) {
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

// -- Particle (Pooled) --
const particlePool = new Pool(
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

function createExplosion(x, y, count, color) {
  for (let i = 0; i < count; i++) {
    const p = particlePool.get(x, y, color);
    particles.push(p);
  }
  // Shake effect
  gameContainer.classList.remove("shake");
  void gameContainer.offsetWidth;
  gameContainer.classList.add("shake");
}

function updateParticles(dt) {
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

function drawParticles(ctx) {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.rect(p.x, p.y, 4, 4);
    ctx.fill();
  }
  ctx.globalAlpha = 1.0;
}

// ---- Game Flow Control ----

function updateMultiplier(increase) {
  if (increase) {
    multiplier++;
    if (multiplier > maxMultiplier) maxMultiplier = multiplier;
  } else {
    multiplier = 1;
    playSound("combo_break");
  }

  comboValue.innerText = multiplier;

  if (multiplier > 1) {
    comboDisplay.classList.remove("hidden");
    comboDisplay.classList.remove("pulse");
    void comboDisplay.offsetWidth;
    comboDisplay.classList.add("pulse");
  } else {
    comboDisplay.classList.add("hidden");
  }
}

function spawnEnemy() {
  if (enemiesSpawnedCount >= enemiesToSpawn) return;

  let word = "שגיאה";

  // Random Boss Logic
  if (
    level > 5 &&
    Math.random() < 0.05 &&
    typeof getRandomBossWord === "function"
  ) {
    word = getRandomBossWord();
  } else {
    if (levelWordDeck.length === 0 && typeof getLevelWordPool === "function") {
      levelWordDeck = getLevelWordPool(level);
    }
    if (levelWordDeck.length > 0) word = levelWordDeck.pop();
  }

  enemies.push(new Enemy(word));
  enemiesSpawnedCount++;
}

function startLevel(lvl) {
  level = lvl;
  levelEl.innerText = level;

  // Difficulty curve:
  enemiesToSpawn = 10 + level * 5;
  enemiesSpawnedCount = 0;

  enemies = [];
  // Clear particles/bullets for clean start? Optional.
  // bullets = [];
  targetEnemy = null;
  spawnTimer = 0;

  if (typeof getLevelWordPool === "function") {
    levelWordDeck = getLevelWordPool(level);
  }
}

function levelComplete() {
  gameState = "level_complete";
  const bonus = level * 1000;
  score += bonus;
  scoreEl.innerText = score;

  completedLevelNumEl.innerText = level;
  levelBonusEl.innerText = bonus;

  showScreen("level-complete-screen");
  playSound("lock");
}

function nextLevel() {
  startLevel(level + 1);
  gameState = "playing";
  updateMultiplier(false);
  showScreen("none");
  if (audioCtx.state === "suspended") audioCtx.resume();
  lastTime = performance.now();
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
    if (pauseGameBtn) pauseGameBtn.classList.add("hidden");
  }
}

function togglePause() {
  if (gameState === "playing") {
    gameState = "paused";
    showScreen("pause-screen");
    if (audioCtx.state === "running") audioCtx.suspend();
  } else if (gameState === "paused") {
    gameState = "playing";
    showScreen("none");
    if (audioCtx.state === "suspended") audioCtx.resume();
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
  }
}

function startGame(skipReset = false) {
  gameState = "playing";
  score = 0;
  if (!skipReset) level = 1;
  startLevel(level);
  multiplier = 1;
  updateMultiplier(false);

  scoreEl.innerText = score;
  levelEl.innerText = level;

  showScreen("none");
  newHighScoreEl.classList.add("hidden");
  if (pauseGameBtn) pauseGameBtn.classList.remove("hidden");

  if (audioCtx.state === "suspended") audioCtx.resume();

  // Init effects
  initStars();
  resize();

  lastTime = performance.now();
  requestAnimationFrame(gameLoop);
}

function gameOver() {
  gameState = "gameover";
  finalScoreEl.innerText = score;
  if (score > highScore) {
    highScore = score;
    localStorage.setItem("ztype_he_highscore", highScore);
    highScoreEl.innerText = highScore;
    newHighScoreEl.classList.remove("hidden");
  }
  
  if (retryLevelNumEl) retryLevelNumEl.innerText = level;
  
  showScreen("game-over-screen");
}

// ---- Input Handling ----
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (gameState === "playing" || gameState === "paused") {
      togglePause();
      return;
    }
  }

  if (gameState !== "playing") return;

  const char = e.key;
  if (char.length !== 1) return;

  let hit = false;
  let hitEnemy = null;

  if (!targetEnemy) {
    // Find optimal target (closest to player) that starts with char
    const candidates = enemies.filter((enemy) =>
      enemy.remaining.startsWith(char),
    );
    if (candidates.length > 0) {
      candidates.sort((a, b) => b.y - a.y); // Higher Y = Closer to bottom (player)
      targetEnemy = candidates[0];
      hitEnemy = targetEnemy;
      hit = true;
    }
  } else {
    if (targetEnemy.remaining.startsWith(char)) {
      hitEnemy = targetEnemy;
      hit = true;
    }
  }

  if (hit && hitEnemy) {
    processHit(hitEnemy);
  } else {
    if (multiplier > 1) updateMultiplier(false);
  }
});

function processHit(enemy) {
  // Visual bullet
  const b = bulletPool.get(player.x, player.y, enemy);
  bullets.push(b);

  playSound("shoot");

  // Logic
  enemy.matched += enemy.remaining[0];
  enemy.remaining = enemy.remaining.substring(1);

  if (enemy.remaining.length === 0) {
    score += enemy.fullWord.length * 10 * multiplier;
    scoreEl.innerText = score;

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
    targetEnemy = null;

    if (enemiesSpawnedCount >= enemiesToSpawn && enemies.length === 0) {
      setTimeout(levelComplete, 500);
    }
  }
}

// ---- Main Game Loop ----
function gameLoop(timestamp) {
  if (gameState !== "playing") return;

  // Delta Time calculation (in seconds)
  const dtMs = timestamp - lastTime;
  const dt = Math.min(dtMs / 1000, 0.1); // Cap dt at 0.1s to prevent huge jumps on lag
  lastTime = timestamp;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 1. Draw Background
  stars.forEach((s) => {
    s.update(dt);
    s.draw(ctx);
  });

  // 2. Spawning
  spawnTimer += dtMs;
  // Dynamic spawn rate based on level
  const currentSpawnInterval = Math.max(
    GAME_CONFIG.ENEMY.SPAWN_INTERVAL_MIN,
    GAME_CONFIG.ENEMY.SPAWN_INTERVAL_BASE - level * 100,
  );
  if (spawnTimer > currentSpawnInterval) {
    spawnEnemy();
    spawnTimer = 0;
  }

  // 3. Player
  // Player is static but we redraw
  ctx.fillStyle = GAME_CONFIG.PLAYER.COLOR_PRIMARY;
  ctx.beginPath();
  // Simple Ship Shape
  ctx.moveTo(player.x, player.y);
  ctx.lineTo(player.x - 20, player.y + 40);
  ctx.lineTo(player.x, player.y + 30); // Engine notch
  ctx.lineTo(player.x + 20, player.y + 40);
  ctx.closePath();
  ctx.fill();
  // Engine Glow
  ctx.fillStyle = GAME_CONFIG.PLAYER.COLOR_SECONDARY;
  ctx.beginPath();
  ctx.arc(player.x, player.y + 35, 5 + Math.random() * 3, 0, Math.PI * 2);
  ctx.fill();

  // Beam to target
  if (targetEnemy) {
    ctx.beginPath();
    ctx.strokeStyle = "rgba(0, 243, 255, 0.15)";
    ctx.lineWidth = 2;
    ctx.moveTo(player.x, player.y);
    ctx.lineTo(targetEnemy.x, targetEnemy.y);
    ctx.stroke();
  }

  // 4. Update & Draw Enemies
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    e.update(dt);
    e.draw(ctx);

    // Collision Check
    const dist = Math.hypot(player.x - e.x, player.y - e.y);
    if (dist < e.radius + 20) {
      playSound("explosion");
      createExplosion(player.x, player.y, 100, "#ff0000");
      gameOver();
    }
  }

  // 5. Update & Draw Bullets / Particles
  updateBullets(dt);
  drawBullets(ctx);
  updateParticles(dt);
  drawParticles(ctx);

  requestAnimationFrame(gameLoop);
}

// ---- Event Listeners Initialization ----
menuStartBtn.addEventListener("click", () => startGame(false));
menuLevelsBtn.addEventListener('click', () => {
    initLevelSelect();
    showScreen('level-select-screen');
});
restartBtn.addEventListener("click", () => startGame(false));
nextLevelBtn.addEventListener("click", nextLevel);
menuGuideBtn.addEventListener("click", () => showScreen("guide-screen"));
menuAboutBtn.addEventListener("click", () => showScreen("about-screen"));
backBtns.forEach((btn) =>
  btn.addEventListener("click", () => showScreen("main-menu")),
);
homeBtn.addEventListener("click", () => showScreen("main-menu"));
if (pauseGameBtn) pauseGameBtn.addEventListener("click", togglePause);
if (resumeBtn) resumeBtn.addEventListener("click", togglePause);
toggleSoundBtn.addEventListener("click", toggleMute);

if (pauseHomeBtn) {
  pauseHomeBtn.addEventListener("click", () => {
    gameState = "start";
    showScreen("main-menu");
    playSound("combo_break");
  });
}

if (retryLevelBtn) {
    retryLevelBtn.addEventListener("click", () => {
        startGame(true); // Retry current level
    });
}

if (levelHomeBtn) {
    levelHomeBtn.addEventListener("click", () => {
        gameState = "start";
        showScreen("main-menu"); 
    });
}

// Initial resize
resize();
initStars();
