const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game State / מצב משחק
let gameState = 'start'; // start, playing, gameover
let score = 0;
let highScore = parseInt(localStorage.getItem('ztype_he_highscore')) || 0;
let level = 1;
let multiplier = 1;
let maxMultiplier = 1;
let lastTime = 0;
let spawnTimer = 0;
let spawnInterval = 2000;
let isMuted = false;

// Entities / ישויות
let enemies = [];
let bullets = [];
let particles = [];
let player = { x: 0, y: 0 };
let targetEnemy = null;

// DOM Elements / אלמנטים ב-DOM
const uiLayer = document.getElementById('ui-layer');
const mainMenu = document.getElementById('main-menu');
const guideScreen = document.getElementById('guide-screen');
const aboutScreen = document.getElementById('about-screen');
const levelCompleteScreen = document.getElementById('level-complete-screen');
const nextLevelBtn = document.getElementById('next-level-btn');
const completedLevelNumEl = document.getElementById('completed-level-num');
const levelBonusEl = document.getElementById('level-bonus');

// Restore deleted variables / שחזור משתנים שנמחקו
const gameOverScreen = document.getElementById('game-over-screen');
const scoreEl = document.getElementById('score-value');
const finalScoreEl = document.getElementById('final-score');
const levelEl = document.getElementById('level-value');

// State for Level Progression / מצב להתקדמות בשלבים
let enemiesToSpawn = 0;
let enemiesSpawnedCount = 0;
let levelWordDeck = []; // Deck of unique words for the level / חפיסת מילים ייחודיות לשלב
const highScoreEl = document.querySelector('#hud-top .high-score span');
const comboDisplay = document.getElementById('combo-display');
const comboValue = document.getElementById('combo-value');
const toggleSoundBtn = document.getElementById('toggle-sound');
const newHighScoreEl = document.querySelector('.new-high-score');
const gameContainer = document.getElementById('game-container');
const pauseGameBtn = document.getElementById('pause-game-btn');
const pauseScreen = document.getElementById('pause-screen');
const resumeBtn = document.getElementById('resume-btn');
const pauseHomeBtn = document.getElementById('pause-home-btn');

// Buttons / כפתורים
const menuStartBtn = document.getElementById('menu-start-btn');
const menuGuideBtn = document.getElementById('menu-guide-btn');
const menuAboutBtn = document.getElementById('menu-about-btn');
const restartBtn = document.getElementById('restart-btn');
const homeBtn = document.getElementById('home-btn');
const backBtns = document.querySelectorAll('.back-btn');


// Audio Context / הקשר שמע
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx = new AudioContext();

// Initialize High Score Display / איתחול תצוגת שיא
if (highScoreEl) highScoreEl.innerText = highScore;

// ---- Audio Functions / פונקציות שמע ----
function toggleMute() {
    isMuted = !isMuted;
    toggleSoundBtn.innerText = isMuted ? "🔇" : "🔊";
    if (isMuted) {
        if (audioCtx.state === 'running') audioCtx.suspend();
    } else {
        if (audioCtx.state === 'suspended') audioCtx.resume();
    }
}

function playSound(type) {
    if (isMuted) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();

    if (!audioCtx) return;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    const now = audioCtx.currentTime;

    if (type === 'shoot') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(400 + (multiplier * 50), now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    } else if (type === 'explosion') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.3);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
    } else if (type === 'lock') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    } else if (type === 'combo_break') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.linearRampToValueAtTime(100, now + 0.3);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0.0, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
    }
}

// ---- Game Logic / לוגיקת משחק ----

// Resizing / שינוי גודל חלון
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    player.x = canvas.width / 2;
    player.y = canvas.height - 50;
}
window.addEventListener('resize', resize);
resize();

// Classes / מחלקות
class Enemy {
    constructor(word) {
        this.fullWord = word;
        this.remaining = word;
        this.matched = "";
        this.x = Math.random() * (canvas.width - 200) + 100;
        this.y = -50;
        this.speed = (Math.random() * 0.3 + 0.3) + (level * 0.05);
        this.radius = 20;
        this.isBoss = word.length > 10;
        if (this.isBoss) {
            this.radius = 40;
            this.speed *= 0.5;
        }

        // Random visual properties / תכונות ויזואליות רנדומליות
        this.shape = ['circle', 'hexagon', 'triangle', 'square'][Math.floor(Math.random() * 4)];
        this.hue = Math.floor(Math.random() * 60) + 300; // Pinks and Purples / גוונים של ורוד וסגול
        this.angle = 0;
        this.spinSpeed = (Math.random() - 0.5) * 0.05;
    }

    update(dt) {
        // Move towards player / תנועה לכיוון השחקן
        const dx = player.x - this.x;
        const dy = player.y - this.y;

        // Update rotation / עדכון סיבוב
        this.angle += this.spinSpeed;

        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 0) {
            this.x += (dx / dist) * this.speed;
            this.y += (dy / dist) * this.speed;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // Base Color / צבע בסיס
        const isActive = targetEnemy === this;
        const baseColor = isActive ? '#ff0055' : `hsl(${this.hue}, 70%, 60%)`;

        // Draw Shape / ציור הצורה
        ctx.beginPath();
        if (this.shape === 'hexagon') {
            for (let i = 0; i < 6; i++) {
                ctx.lineTo(this.radius * Math.cos(i * Math.PI / 3), this.radius * Math.sin(i * Math.PI / 3));
            }
        } else if (this.shape === 'triangle') {
            for (let i = 0; i < 3; i++) {
                ctx.lineTo(this.radius * 1.2 * Math.cos(i * 2 * Math.PI / 3 - Math.PI / 2), this.radius * 1.2 * Math.sin(i * 2 * Math.PI / 3 - Math.PI / 2));
            }
        } else if (this.shape === 'square') {
            ctx.rect(-this.radius * 0.8, -this.radius * 0.8, this.radius * 1.6, this.radius * 1.6);
        } else {
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        }
        ctx.closePath();

        ctx.fillStyle = this.isBoss ? '#ffe600' : baseColor;
        ctx.fill();

        // Active Outline effect / אפקט מסגרת לפעיל
        if (isActive) {
            ctx.strokeStyle = '#00f3ff';
            ctx.lineWidth = 3 + (Math.sin(Date.now() / 100) * 1);
            ctx.stroke();
        } else {
            ctx.strokeStyle = 'rgba(255,255,255,0.3)';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        ctx.restore();

        // Text Drawing (Separate to not rotate with shape) / ציור טקסט (בנפרד כדי שלא יסתובב)
        ctx.font = (this.isBoss ? 'bold 30px' : '20px') + ' Rubik';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Text Glow / זוהר לטקסט
        if (isActive) {
            ctx.shadowBlur = 10;
            ctx.shadowColor = "#00f3ff";
        } else {
            ctx.shadowBlur = 0;
        }

        ctx.fillStyle = isActive ? '#00f3ff' : '#ffffff';
        const textYOffset = this.radius + 25;
        ctx.fillText(this.remaining, this.x, this.y + textYOffset);

        ctx.shadowBlur = 0; // Reset
    }
}

class Bullet {
    constructor(startX, startY, target) {
        this.x = startX;
        this.y = startY;
        this.target = target;
        this.speed = 20;
        this.dead = false;
        this.trail = [];
    }

    update() {
        if (!this.target || enemies.indexOf(this.target) === -1) {
            this.dead = true;
            return;
        }

        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > 5) this.trail.shift();

        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < this.speed) {
            this.x = this.target.x;
            this.y = this.target.y;
            this.dead = true;
        } else {
            this.x += (dx / dist) * this.speed;
            this.y += (dy / dist) * this.speed;
        }
    }

    draw(ctx) {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(0, 243, 255, 0.5)';
        ctx.lineWidth = 2;
        if (this.trail.length > 0) {
            ctx.moveTo(this.trail[0].x, this.trail[0].y);
            for (let p of this.trail) ctx.lineTo(p.x, p.y);
        }
        ctx.lineTo(this.x, this.y);
        ctx.stroke();

        ctx.beginPath();
        ctx.fillStyle = '#00f3ff';
        ctx.arc(this.x, this.y, 4, 0, Math.PI * 2);
        ctx.fill();
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 5 + 2;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.life = 1.0;
        this.decay = Math.random() * 0.05 + 0.02;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= this.decay;
    }

    draw(ctx) {
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;

        ctx.beginPath();
        ctx.moveTo(this.x, this.y - 3);
        ctx.lineTo(this.x + 3, this.y);
        ctx.lineTo(this.x, this.y + 3);
        ctx.lineTo(this.x - 3, this.y);
        ctx.fill();

        ctx.globalAlpha = 1.0;
    }
}

function createExplosion(x, y, count = 10, color = '#ff0055') {
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(x, y, color));
    }
    gameContainer.classList.add('shake');
    setTimeout(() => gameContainer.classList.remove('shake'), 500);
}

function updateMultiplier(increase) {
    if (increase) {
        multiplier++;
        if (multiplier > maxMultiplier) maxMultiplier = multiplier;
    } else {
        multiplier = 1;
        playSound('combo_break');
    }

    comboValue.innerText = multiplier;

    if (multiplier > 1) {
        comboDisplay.classList.remove('hidden');
        comboDisplay.classList.remove('pulse');
        void comboDisplay.offsetWidth;
        comboDisplay.classList.add('pulse');
    } else {
        comboDisplay.classList.add('hidden');
    }
}

function spawnEnemy() {
    if (enemiesSpawnedCount >= enemiesToSpawn) return; // Stop spawning if level limit reached / הפסקת יצירת אויבים אם הגענו למכסת השלב

    let word = "שגיאה";

    // Boss logic / לוגיקת בוס
    if (level > 5 && Math.random() < 0.05 && typeof getRandomBossWord === 'function') {
        word = getRandomBossWord();
    } else {
        // Standard word from deck / מילה רגילה מהחפיסה
        if (levelWordDeck.length === 0) {
            // Refill if empty (fallback) / מילוי מחדש אם נגמר (גיבוי)
            if (typeof getLevelWordPool === 'function') {
                levelWordDeck = getLevelWordPool(level);
            }
        }

        if (levelWordDeck.length > 0) {
            word = levelWordDeck.pop();
        }
    }

    enemies.push(new Enemy(word));
    enemiesSpawnedCount++;
}

function startLevel(lvl) {
    level = lvl;
    levelEl.innerText = level;

    // Formula: 10 enemies + 5 per level / נוסחה: 10 אויבים + 5 לכל שלב
    enemiesToSpawn = 10 + (level * 5);
    enemiesSpawnedCount = 0;

    enemies = []; // Clear existing / ניקוי קיימים
    bullets = [];
    targetEnemy = null;
    spawnTimer = 0;

    // Initialize word deck / איתחול חפיסת המילים
    if (typeof getLevelWordPool === 'function') {
        levelWordDeck = getLevelWordPool(level);
    }
}

function levelComplete() {
    gameState = 'level_complete';
    const bonus = level * 1000;
    score += bonus;
    scoreEl.innerText = score;

    completedLevelNumEl.innerText = level;
    levelBonusEl.innerText = bonus;

    showScreen('level-complete-screen');
    playSound('lock'); // Victory sound / צליל ניצחון
}

function nextLevel() {
    startLevel(level + 1);
    gameState = 'playing'; // Resume / המשך משחק

    updateMultiplier(false); // Reset combo or keep it? Let's reset for fairness/pace

    // Hide screens
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

    if (audioCtx.state === 'suspended') audioCtx.resume();
    requestAnimationFrame(gameLoop);
}

// ---- Scene Management / ניהול סצנות ----

function showScreen(screenId) {
    // Hide all screens / הסתרת כל המסכים
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    // Show requested / הצגת המסך המבוקש
    document.getElementById(screenId).classList.add('active');

    // Manage Pause Button Visibility / ניהול נראות כפתור ההשהיה
    if (screenId === 'main-menu' || screenId === 'game-over-screen') {
        if (pauseGameBtn) pauseGameBtn.classList.add('hidden');
    }
}

function togglePause() {
    if (gameState === 'playing') {
        gameState = 'paused';
        showScreen('pause-screen');
        if (audioCtx.state === 'running') audioCtx.suspend();
    } else if (gameState === 'paused') {
        gameState = 'playing';
        showScreen('none'); // Hide all screens / הסתרת כל המסכים
        if (audioCtx.state === 'suspended') audioCtx.resume();
        lastTime = performance.now();
        requestAnimationFrame(gameLoop);
    }
}

function startGame() {
    gameState = 'playing';
    score = 0;
    level = 1;
    startLevel(level); // Use helper to init level stats / שימוש בפונקציית עזר לאתחול נתוני שלב
    multiplier = 1;
    updateMultiplier(false);

    scoreEl.innerText = score;
    levelEl.innerText = level;

    // Hide all screens
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

    newHighScoreEl.classList.add('hidden');
    if (pauseGameBtn) pauseGameBtn.classList.remove('hidden');

    if (audioCtx.state === 'suspended') audioCtx.resume();

    requestAnimationFrame(gameLoop);
}

function gameOver() {
    gameState = 'gameover';
    finalScoreEl.innerText = score;

    if (score > highScore) {
        highScore = score;
        localStorage.setItem('ztype_he_highscore', highScore);
        highScoreEl.innerText = highScore;
        newHighScoreEl.classList.remove('hidden');
    }

    showScreen('game-over-screen');
}

// Input Handling / טיפול בקלט
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (gameState === 'playing' || gameState === 'paused') {
            togglePause();
            return;
        }
    }

    if (gameState !== 'playing') return;

    const char = e.key;
    if (char.length !== 1) return;

    let hit = false;

    if (!targetEnemy) {
        const candidates = enemies.filter(enemy => enemy.remaining.startsWith(char));

        if (candidates.length > 0) {
            candidates.sort((a, b) => b.y - a.y);
            targetEnemy = candidates[0];
            processHit(targetEnemy);
            playSound('lock');
            hit = true;
        }
    } else {
        if (targetEnemy.remaining.startsWith(char)) {
            processHit(targetEnemy);
            hit = true;
        }
    }

    if (!hit) {
        if (multiplier > 1) updateMultiplier(false);
    }
});

function processHit(enemy) {
    bullets.push(new Bullet(player.x, player.y, enemy));
    playSound('shoot');

    enemy.matched += enemy.remaining[0];
    enemy.remaining = enemy.remaining.substring(1);

    if (enemy.remaining.length === 0) {
        score += enemy.fullWord.length * 10 * multiplier;
        scoreEl.innerText = score;

        updateMultiplier(true);

        // Level logic handled by fixed enemy count now
        /*
        let newLevel = 1 + Math.floor(score / 1500);
        if (newLevel > level) {
            level = newLevel;
            levelEl.innerText = level;
        }
        */

        createExplosion(enemy.x, enemy.y, enemy.isBoss ? 50 : 20, '#ff0055');
        playSound('explosion');

        const index = enemies.indexOf(enemy);
        if (index > -1) {
            enemies.splice(index, 1);
        }
        targetEnemy = null;

        // Check Level Complete / בדיקת סיום שלב
        if (enemiesSpawnedCount >= enemiesToSpawn && enemies.length === 0) {
            setTimeout(levelComplete, 500); // Small delay for effect / השהייה קטנה לאפקט
        }
    }
}

// Main Loop / לולאה ראשית
function gameLoop(timestamp) {
    if (gameState !== 'playing') return;

    const dt = timestamp - lastTime;
    lastTime = timestamp;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    spawnTimer += 16;
    const currentInterval = Math.max(800, 2000 - (level * 100));

    if (spawnTimer > currentInterval) {
        spawnEnemy();
        spawnTimer = 0;
    }

    // Draw Player / ציור שחקן
    ctx.fillStyle = '#00f3ff';
    ctx.beginPath();
    ctx.moveTo(player.x, player.y);
    ctx.lineTo(player.x - 20, player.y + 40);
    ctx.lineTo(player.x + 20, player.y + 40);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f0f';
    ctx.beginPath();
    ctx.arc(player.x, player.y + 35, 5 + Math.random() * 5, 0, Math.PI * 2);
    ctx.fill();

    if (targetEnemy) {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(0, 243, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.moveTo(player.x, player.y);
        ctx.lineTo(targetEnemy.x, targetEnemy.y);
        ctx.stroke();
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        e.update();
        e.draw(ctx);

        // Check collision with player (distance based) / בדיקת התנגשות עם שחקן
        const dx = player.x - e.x;
        const dy = player.y - e.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < e.radius + 20) { // Player radius approx 20
            playSound('explosion');
            createExplosion(player.x, player.y, 50, '#ff0000');
            gameOver();
        }
    }

    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.update();
        b.draw(ctx);
        if (b.dead) bullets.splice(i, 1);
    }

    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.update();
        p.draw(ctx);
        if (p.life <= 0) particles.splice(i, 1);
    }

    requestAnimationFrame(gameLoop);
}

// Event Listeners / מאזיני אירועים
menuStartBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);
nextLevelBtn.addEventListener('click', nextLevel);

menuGuideBtn.addEventListener('click', () => showScreen('guide-screen'));
menuAboutBtn.addEventListener('click', () => showScreen('about-screen'));

// Handle Back Buttons / טיפול בכפתורי חזרה
backBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        showScreen('main-menu');
    });
});

homeBtn.addEventListener('click', () => showScreen('main-menu'));

if (pauseGameBtn) {
    pauseGameBtn.addEventListener('click', togglePause);
}

if (resumeBtn) {
    resumeBtn.addEventListener('click', togglePause);
}

if (pauseHomeBtn) {
    pauseHomeBtn.addEventListener('click', () => {
        gameState = 'start';
        showScreen('main-menu');
        playSound('combo_break');
    });
}

toggleSoundBtn.addEventListener('click', toggleMute);
