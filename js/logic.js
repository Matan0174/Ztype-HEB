import { GAME_CONFIG } from "./config.js";
import { 
    state, canvas, ctx, ui,
    enemies, bullets, particles, stars, levelWordDeck,
    setLevelWordDeck, resetEntities, setTargetEnemy 
} from "./state.js";
import { playSound, audioCtx, startMusic, stopMusic, toggleMute} from "./audio.js";
import { Enemy } from "./entities/Enemy.js";
import { bulletPool } from "./entities/Bullet.js";
import { createExplosion } from "./entities/Particle.js";
import { getLevelWordPool, getRandomBossWord } from "./words.js";

// Import gameLoop from game.js to restart it
// Wait, circular dependency... 
// game.js is the main entry point, so logic.js shouldn't import from it if possible.
// We need to pass callbacks or export these functions to be used by game.js

export function updateMultiplier(increase) {
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

export function spawnEnemy() {
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

export function startLevel(lvl) {
  state.level = lvl;
  ui.levelEl.innerText = state.level;

  // Difficulty curve:
  state.enemiesToSpawn = 10 + state.level * 5;
  state.enemiesSpawnedCount = 0;

  resetEntities(); // clears enemies, targetEnemy
  state.spawnTimer = 0;

  setLevelWordDeck(getLevelWordPool(state.level));
}

// NOTE: levelComplete needs to show screen, which is UI logic. 
// We will export showScreen from a new ui.js or proper place, 
// for now let's keep showScreen within the main loop or move it to utils/ui. 
// Ideally Logic shouldn't manipulate DOM directly but updates State/UI.

export function processHit(enemy) {
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

export function enemyHit(enemy, onLevelComplete) {
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
      setTimeout(onLevelComplete, 500);
    }
  }
}
