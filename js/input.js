import { state, enemies, setTargetEnemy } from "./state.js";
import { processHit, updateMultiplier } from "./logic.js";
import { togglePause } from "./game.js"; // Circular? No, togglePause is in game.js which is now main entry

// We need to pass togglePause callback to avoid circular dependency if possible,
// or just expose it.
// Actually, listener should be set up in game.js and import logic from here.

export function handleKeydown(e, { togglePause, nextLevel, startGame, showScreen }) {
  // Global shortcuts
  if (e.key === "Escape") {
    if (state.mode === "playing") {
      togglePause();
      return;
    }
    if (state.mode === "paused") {
      togglePause();
      return;
    }
    // "Back" functionality for menus
    if (document.getElementById("level-select-screen").classList.contains("active") ||
        document.getElementById("guide-screen").classList.contains("active") ||
        document.getElementById("about-screen").classList.contains("active")) {
        showScreen("main-menu");
        return;
    }
    // From Game Over or Level Complete -> Back to Menu
    if (state.mode === "gameover" || state.mode === "level_complete") {
        showScreen("main-menu");
        // Reset state for menu if needed, though showScreen handles UI, logic might need state reset?
        // Actually showScreen doesn't reset state.mode. 
        // startGame() handles resets. showScreen is just UI.
        // Ideally we should have a "goToMainMenu" function but sticking to UI for now safeish.
        // Ideally set state.mode = "start"
        state.mode = "start";
        return;
    }
    return;
  }

  if (e.key === "Enter") {
      if (state.mode === "level_complete") {
          nextLevel();
          return;
      }
      if (state.mode === "gameover") {
          startGame(true); // Retry level
          return;
      }
      if (state.mode === "paused") {
          togglePause(); // Resume
          return;
      }
      if (state.mode === "start") {
          // If in main menu, Start Game
          if (document.getElementById("main-menu").classList.contains("active")) {
              startGame();
              return;
          }
      }
      return;
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
}
