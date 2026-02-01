import { GAME_CONFIG } from "./config.js";

// DOM Elements
export const canvas = document.getElementById("gameCanvas");
export const ctx = canvas.getContext("2d");
export const gameContainer = document.getElementById("game-container");

// UI Elements (exported for convenience if needed, or fetched in game.js)
export const ui = {
    scoreEl: document.getElementById("score-value"),
    finalScoreEl: document.getElementById("final-score"),
    levelEl: document.getElementById("level-value"),
    highScoreEl: document.querySelector("#hud-top .high-score span"),
    comboDisplay: document.getElementById("combo-display"),
    comboValue: document.getElementById("combo-value"),
    toggleSoundBtn: document.getElementById("toggle-sound"),
    newHighScoreEl: document.querySelector(".new-high-score"),
    completedLevelNumEl: document.getElementById("completed-level-num"),
    levelBonusEl: document.getElementById("level-bonus"),
    levelsGrid: document.getElementById("levels-grid"),
    retryLevelNumEl: document.getElementById("retry-level-num"),
    pauseGameBtn: document.getElementById("pause-game-btn"),
};

// Game State
export const state = {
  mode: "start", // start, playing, gameover, paused, level_complete, level_select
  score: 0,
  highScore: parseInt(localStorage.getItem("ztype_he_highscore")) || 0,
  level: 1,
  multiplier: 1,
  maxMultiplier: 1,
  lastTime: 0,
  spawnTimer: 0,
  isMuted: false,
  enemiesToSpawn: 0,
  enemiesSpawnedCount: 0,
  player: { x: 0, y: 0 },
  targetEnemy: null,
};

// Entities Arrays
export const enemies = [];
export const bullets = [];
export const particles = [];
export let stars = []; // stars might be re-initialized
export let levelWordDeck = [];

export function setStars(newStars) {
    stars = newStars;
}

export function setLevelWordDeck(deck) {
    levelWordDeck = deck;
}

export function resetEntities() {
    enemies.length = 0;
    // bullets.length = 0; 
    state.targetEnemy = null;
}

export function setTargetEnemy(enemy) {
    state.targetEnemy = enemy;
}
