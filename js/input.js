import { state, enemies, setTargetEnemy } from "./state.js";
import { processHit, updateMultiplier } from "./logic.js";
import { togglePause } from "./game.js"; // Circular? No, togglePause is in game.js which is now main entry

// We need to pass togglePause callback to avoid circular dependency if possible,
// or just expose it.
// Actually, listener should be set up in game.js and import logic from here.

export function handleKeydown(e, { togglePause }) {
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
}
