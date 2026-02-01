export const GAME_CONFIG = {
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
    KNOCKBACK_DISTANCE: 15,
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
