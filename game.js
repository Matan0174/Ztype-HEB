const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game State
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

// Entities
let enemies = [];
let bullets = [];
let particles = [];
let player = { x: 0, y: 0 };
let targetEnemy = null; 

// DOM Elements
const uiLayer = document.getElementById('ui-layer');
const mainMenu = document.getElementById('main-menu');
const guideScreen = document.getElementById('guide-screen');
const aboutScreen = document.getElementById('about-screen');
const levelCompleteScreen = document.getElementById('level-complete-screen');
const nextLevelBtn = document.getElementById('next-level-btn');
const completedLevelNumEl = document.getElementById('completed-level-num');
const levelBonusEl = document.getElementById('level-bonus');

// Restore deleted variables
const gameOverScreen = document.getElementById('game-over-screen');
const scoreEl = document.getElementById('score-value');
const finalScoreEl = document.getElementById('final-score');
const levelEl = document.getElementById('level-value');

// State for Level Progression
let enemiesToSpawn = 0;
let enemiesSpawnedCount = 0;
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

// Buttons
const menuStartBtn = document.getElementById('menu-start-btn');
const menuGuideBtn = document.getElementById('menu-guide-btn');
const menuAboutBtn = document.getElementById('menu-about-btn');
const restartBtn = document.getElementById('restart-btn');
const homeBtn = document.getElementById('home-btn');
const backBtns = document.querySelectorAll('.back-btn');


// Audio Context
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx = new AudioContext();

// Initialize High Score Display
if(highScoreEl) highScoreEl.innerText = highScore;

// ---- Audio Functions ----
function toggleMute() {
    isMuted = !isMuted;
    toggleSoundBtn.innerText = isMuted ? "🔇" : "🔊";
    if(isMuted) {
        if(audioCtx.state === 'running') audioCtx.suspend();
    } else {
        if(audioCtx.state === 'suspended') audioCtx.resume();
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

// ---- Game Logic ----

// Resizing
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    player.x = canvas.width / 2;
    player.y = canvas.height - 50;
}
window.addEventListener('resize', resize);
resize();

// Classes
class Enemy {
    constructor(word) {
        this.fullWord = word;
        this.remaining = word;
        this.matched = "";
        this.x = Math.random() * (canvas.width - 200) + 100;
        this.y = -50;
        this.speed = (Math.random() * 0.5 + 0.5) + (level * 0.15); 
        this.radius = 20;
        this.isBoss = word.length > 10; 
        if (this.isBoss) {
            this.radius = 40;
            this.speed *= 0.5; 
        }
    }

    update(dt) {
        this.y += this.speed;
    }

    draw(ctx) {
        ctx.beginPath();
        ctx.fillStyle = targetEnemy === this ? '#ff0055' : (this.isBoss ? '#ffe600' : '#ffffff');
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();

        if (targetEnemy === this) {
            ctx.beginPath();
            ctx.strokeStyle = '#00f3ff';
            ctx.lineWidth = 2 + (Math.sin(Date.now() / 100) * 1); 
            ctx.arc(this.x, this.y, this.radius + 8, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.font = (this.isBoss ? 'bold 30px' : '20px') + ' Rubik';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        ctx.fillStyle = targetEnemy === this ? '#00f3ff' : '#ffffff';
        ctx.fillText(this.remaining, this.x, this.y + this.radius + 25);
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

        this.trail.push({x: this.x, y: this.y});
        if (this.trail.length > 5) this.trail.shift();

        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
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
            for(let p of this.trail) ctx.lineTo(p.x, p.y);
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
    if (enemiesSpawnedCount >= enemiesToSpawn) return; // Stop spawning if level limit reached

    let word = "שגיאה"; 
    if (typeof getWordForLevel === 'function') {
        word = getWordForLevel(level);
    } else {
         word = "טעות";
    }

    enemies.push(new Enemy(word));
    enemiesSpawnedCount++;
}

function startLevel(lvl) {
    level = lvl;
    levelEl.innerText = level;
    
    // Formula: 10 enemies + 5 per level.
    enemiesToSpawn = 10 + (level * 5);
    enemiesSpawnedCount = 0;
    
    enemies = []; // Clear existing
    bullets = [];
    targetEnemy = null;
    spawnTimer = 0;
}

function levelComplete() {
    gameState = 'level_complete';
    const bonus = level * 1000;
    score += bonus;
    scoreEl.innerText = score;
    
    completedLevelNumEl.innerText = level;
    levelBonusEl.innerText = bonus;
    
    showScreen('level-complete-screen');
    playSound('lock'); // Victory sound
}

function nextLevel() {
    startLevel(level + 1);
    gameState = 'playing'; // Resume
    
    updateMultiplier(false); // Reset combo or keep it? Let's reset for fairness/pace
    
    // Hide screens
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    
    if (audioCtx.state === 'suspended') audioCtx.resume();
    requestAnimationFrame(gameLoop);
}

// ---- Scene Management ----

function showScreen(screenId) {
    // Hide all screens
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    // Show requested
    document.getElementById(screenId).classList.add('active');

    // Manage Pause Button Visibility
    if (screenId === 'main-menu' || screenId === 'game-over-screen') {
        if(pauseGameBtn) pauseGameBtn.classList.add('hidden');
    }
}

function togglePause() {
    if (gameState === 'playing') {
        gameState = 'paused';
        showScreen('pause-screen');
        if(audioCtx.state === 'running') audioCtx.suspend();
    } else if (gameState === 'paused') {
        gameState = 'playing';
        showScreen('none'); // Hide all screens
        if(audioCtx.state === 'suspended') audioCtx.resume();
        lastTime = performance.now();
        requestAnimationFrame(gameLoop);
    }
}

function startGame() {
    gameState = 'playing';
    score = 0;
    level = 1;
    startLevel(level); // Use helper to init level stats
    multiplier = 1;
    updateMultiplier(false);
    
    scoreEl.innerText = score;
    levelEl.innerText = level;
    
    // Hide all screens
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    
    newHighScoreEl.classList.add('hidden'); 
    if(pauseGameBtn) pauseGameBtn.classList.remove('hidden');

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

// Input Handling
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

        // Check Level Complete
        if (enemiesSpawnedCount >= enemiesToSpawn && enemies.length === 0) {
            setTimeout(levelComplete, 500); // Small delay for effect
        }
    }
}

// Main Loop
function gameLoop(timestamp) {
    if (gameState !== 'playing') return;
    
    const dt = timestamp - lastTime;
    lastTime = timestamp;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    spawnTimer += 16; 
    const currentInterval = Math.max(300, 2000 - (level * 150));
    
    if (spawnTimer > currentInterval) {
        spawnEnemy();
        spawnTimer = 0;
    }

    // Draw Player
    ctx.fillStyle = '#00f3ff';
    ctx.beginPath();
    ctx.moveTo(player.x, player.y);
    ctx.lineTo(player.x - 20, player.y + 40);
    ctx.lineTo(player.x + 20, player.y + 40);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f0f';
    ctx.beginPath();
    ctx.arc(player.x, player.y + 35, 5 + Math.random() * 5, 0, Math.PI*2);
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

        if (e.y > player.y - 20) {
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

// Event Listeners
menuStartBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);
nextLevelBtn.addEventListener('click', nextLevel);

menuGuideBtn.addEventListener('click', () => showScreen('guide-screen'));
menuAboutBtn.addEventListener('click', () => showScreen('about-screen'));

// Handle Back Buttons
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
