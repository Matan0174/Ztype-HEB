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

export function initLevelSelect(startGameCallback) {
    ui.levelsGrid.innerHTML = '';
    for (let i = 1; i <= GAME_CONFIG.LEVELS.MAX; i++) {
        const btn = document.createElement('div');
        btn.classList.add('level-btn');
        btn.innerText = i;
        
        // All levels unlocked for now
        btn.onclick = () => {
            state.level = i;
            startGameCallback(true); // true = skip reset level to 1
        };
        
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
    document.getElementById("retry-level-btn").onclick = () => startGame(); 
    document.getElementById("level-home-btn").onclick = () => showScreen("main-menu");
    document.getElementById("toggle-sound").onclick = () => {
        const isMuted = toggleMute();
        document.getElementById("toggle-sound").innerText = isMuted ? "🔇" : "🔊";
    };

    document.querySelectorAll(".back-btn").forEach((btn) => {
        btn.onclick = () => {
            showScreen("main-menu"); 
        };
    });
}
