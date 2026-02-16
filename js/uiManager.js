import { state, ui } from "./state.js";
import { startMusic, stopMusic } from "./audio.js";
import { GAME_CONFIG } from "./config.js";

// We need a reference to `startGame` or similar if the UI buttons need to call it.
// One pattern is to have an `initUI` function that accepts callbacks.

export function showScreen(screenId) {
  document
    .querySelectorAll(".screen")
    .forEach((s) => s.classList.remove("active"));
  if (screenId !== "none") {
    document.getElementById(screenId).classList.add("active");
  }

  if (screenId === "main-menu" || screenId === "game-over-screen") {
    if (ui.pauseGameBtn) ui.pauseGameBtn.classList.add("hidden");
    stopMusic();
  }
}

import Auth from "./auth.js";

export function initLevelSelect(startGameCallback) {
    ui.levelsGrid.innerHTML = '';
    
    // Determine max unlocked level
    let maxUnlocked = 3; // Default for guests

    if (Auth.user && Auth.user.maxLevel) {
        // If logged in, users unlock levels progressively.
        // However, if their maxLevel is LESS than 3 (e.g. new user), 
        // they should theoretically start at 1. But usually "guests get 1-3" 
        // implies "everyone gets at least 1-3". 
        // User request: "who registered... progress kept". 
        // If I register, do I LOSE access to level 3 if I only finished level 1?
        // Probably not. It's safer to say max(user.maxLevel, 3) OR just user.maxLevel.
        // But usually "register to get PAST level 3". So levels 1-3 are always free.
        // So maxUnlocked = Math.max(Auth.user.maxLevel, 3);
        maxUnlocked = Math.max(Auth.user.maxLevel, 3);
    }

    for (let i = 1; i <= GAME_CONFIG.LEVELS.MAX; i++) {
        const btn = document.createElement('div');
        btn.classList.add('level-btn');
        btn.innerText = i;
        
        let isLocked = false;
        
        if (Auth.user) {
            // Logged in: Locked if level > maxUnlocked (and also check if next level is reachable)
            // Actually usually you can play any level <= maxUnlocked + 1? Or just <= maxUnlocked?
            // "התקדמות תשמר" usually means "completed level X, now X+1 is unlocked".
            // So if maxLevel is the HIGHEST COMPLETED level...
            // Let's assume maxLevel in DB is "Highest Level Unlocked" or "Highest Level Completed".
            // Let's stick to "Highest Level UNLOCKED".
            // DB default is 1. So level 1 is unlocked.
            if (i > maxUnlocked) isLocked = true;
        } else {
            // Guest: Locked if level > 3
            if (i > 3) isLocked = true;
        }

        if (isLocked) {
            btn.classList.add('locked');
            if (!Auth.user && i > 3) {
                btn.title = "הירשם כדי לשחק בשלבים מתקדמים";
            } else {
                btn.title = "סיים את השלב הקודם כדי לפתוח";
            }
        } else {
            btn.onclick = () => {
                state.level = i;
                startGameCallback(true);
            };
        }
        
        ui.levelsGrid.appendChild(btn);
    }
}

export function bindUIEvents({ startGame, nextLevel, togglePause, toggleMute }) {
    document.getElementById("menu-start-btn").onclick = () => startGame();
    document.getElementById("menu-levels-btn").onclick = () => {
        initLevelSelect(startGame);
        showScreen("level-select-screen");
    };
    document.getElementById("menu-guide-btn").onclick = () => showScreen("guide-screen");
    document.getElementById("menu-about-btn").onclick = () => showScreen("about-screen");
    document.getElementById("restart-btn").onclick = () => startGame();
    document.getElementById("home-btn").onclick = () => showScreen("main-menu");
    document.getElementById("next-level-btn").onclick = nextLevel;
    document.getElementById("resume-btn").onclick = togglePause;
    document.getElementById("pause-home-btn").onclick = () => showScreen("main-menu");
    // Pass true to prompt skipping level reset (i.e. retry current level)
    document.getElementById("retry-level-btn").onclick = () => startGame(true); 
    document.getElementById("level-home-btn").onclick = () => showScreen("main-menu");
    
    // Bind pause button explicitly if it exists
    const pauseBtn = document.getElementById("pause-game-btn");
    if (pauseBtn) {
        pauseBtn.onclick = togglePause;
    }

    document.getElementById("toggle-sound").onclick = () => {
        const isMuted = toggleMute();
        document.getElementById("toggle-sound").innerText = isMuted ? "🔇" : "🔊";
    };

    document.querySelectorAll(".back-btn").forEach((btn) => {
        btn.onclick = () => {
             // For guide/about screens, just go back to main menu
            showScreen("main-menu"); 
        };
    });
}
