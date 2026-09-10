/**
 * ============================================================================
 * ADVANCED RULE EXAMPLES & CUSTOM MODIFIER IMPLEMENTATIONS
 * ============================================================================
 *
 * This file demonstrates how to extend the game engine with custom rules
 * and showcases patterns for implementing 30+ complex modifiers.
 */

// =============================================================================
// MOVEMENT MODIFIER RULES
// =============================================================================

/**
 * Circular Movement: Snake is forced to move in a circular pattern
 */
class CircularMovementRule extends RuleStrategy {
  constructor() {
    super("CircularMovement");
    this.duration = 12000;
    this.angle = 0;
    this.radius = 10;
  }

  execute(context, deltaTime) {
    this.angle += 0.1;
    const snake = context.snake;
    const head = snake.getHead();

    const orbitX = Math.round(
      context.gridWidth / 2 + Math.cos(this.angle) * this.radius,
    );
    const orbitY = Math.round(
      context.gridHeight / 2 + Math.sin(this.angle) * this.radius,
    );

    // Calculate direction towards orbit point
    const dx = orbitX - head.x;
    const dy = orbitY - head.y;

    if (Math.abs(dx) > Math.abs(dy)) {
      snake.setDirection({ x: Math.sign(dx), y: 0 });
    } else {
      snake.setDirection({ x: 0, y: Math.sign(dy) });
    }
  }
}

/**
 * Slow Motion: Reduce game speed to 50% of normal
 */
class SlowMotionRule extends RuleStrategy {
  constructor(speedMultiplier = 0.5) {
    super("SlowMotion");
    this.duration = 10000;
    this.speedMultiplier = speedMultiplier;
  }

  getSpeedMultiplier() {
    return this.speedMultiplier;
  }

  execute(context, deltaTime) {
    // Handled by modify tickThreshold in GameEngine.update()
  }
}

/**
 * Random Turns: Snake randomly changes direction
 */
class RandomTurnsRule extends RuleStrategy {
  constructor() {
    super("RandomTurns");
    this.duration = 15000;
    this.turnChance = 0.1; // 10% chance per tick
  }

  execute(context, deltaTime) {
    if (Math.random() < this.turnChance) {
      const directions = [
        { x: 0, y: -1 },
        { x: 0, y: 1 },
        { x: -1, y: 0 },
        { x: 1, y: 0 },
      ];

      const validDirections = directions.filter((dir) => {
        // Prevent 180-degree turns
        return !(
          dir.x === -context.snake.direction.x &&
          dir.y === -context.snake.direction.y
        );
      });

      const randomDir =
        validDirections[Math.floor(Math.random() * validDirections.length)];
      context.snake.setDirection(randomDir);
    }
  }
}

/**
 * Quantum Snake: Snake randomly teleports
 */
class QuantumSnakeRule extends RuleStrategy {
  constructor() {
    super("QuantumSnake");
    this.duration = 8000;
    this.teleportChance = 0.05; // 5% chance per tick
  }

  execute(context, deltaTime) {
    if (Math.random() < this.teleportChance) {
      const head = context.snake.getHead();
      const newX = Math.floor(Math.random() * context.gridWidth);
      const newY = Math.floor(Math.random() * context.gridHeight);

      // Move snake to new position
      context.snake.body[0] = { x: newX, y: newY };
    }
  }
}

// =============================================================================
// FOOD MODIFIER RULES
// =============================================================================

/**
 * Poison Food: Occasionally spawns poison that shrinks snake
 */
class PoisonFoodRule extends RuleStrategy {
  constructor() {
    super("PoisonFood");
    this.duration = 20000;
    this.poison = null;
    this.poisonChance = 0.3; // 30% food is poison
  }

  execute(context, deltaTime) {
    // Check if current food is poison
    if (!this.poison && Math.random() < this.poisonChance) {
      this.poison = { ...context.food };
    }

    // If eating poison, shrink
    const head = context.snake.getHead();
    if (this.poison && head.x === this.poison.x && head.y === this.poison.y) {
      // Remove last segment
      if (context.snake.getLength() > 1) {
        context.snake.body.pop();
      }
      this.poison = null;
    }
  }
}

/**
 * Multiplying Food: Food spawns multiple copies
 */
class MultiplyingFoodRule extends RuleStrategy {
  constructor() {
    super("MultiplyingFood");
    this.duration = 15000;
    this.extraFood = [];
  }

  execute(context, deltaTime) {
    // Spawn extra food pellets randomly
    if (Math.random() < 0.02) {
      this.extraFood.push({
        x: Math.floor(Math.random() * context.gridWidth),
        y: Math.floor(Math.random() * context.gridHeight),
      });
    }

    // Check collision with extra food
    const head = context.snake.getHead();
    this.extraFood = this.extraFood.filter((food) => {
      if (food.x === head.x && food.y === head.y) {
        context.snake.grow();
        return false; // Remove this food
      }
      return true;
    });
  }

  getExtraFood() {
    return [...this.extraFood];
  }
}

/**
 * Invisible Food: Food position is randomized client-side
 */
class InvisibleFoodRule extends RuleStrategy {
  constructor() {
    super("InvisibleFood");
    this.duration = 10000;
    this.realPosition = null;
  }

  onActivate(context) {
    super.onActivate(context);
    this.realPosition = { ...context.food };
  }

  execute(context, deltaTime) {
    // Keep real position hidden, but still check collision
    const head = context.snake.getHead();
    if (head.x === this.realPosition.x && head.y === this.realPosition.y) {
      // Food eaten, spawn new one
      this.realPosition = {
        x: Math.floor(Math.random() * context.gridWidth),
        y: Math.floor(Math.random() * context.gridHeight),
      };
    }

    // Display food at wrong location (visual only)
    context.food = {
      x: Math.floor(Math.random() * context.gridWidth),
      y: Math.floor(Math.random() * context.gridHeight),
    };
  }
}

// =============================================================================
// COLLISION & BOUNDARY RULES
// =============================================================================

/**
 * Wrap Around: Snake wraps to opposite side of screen
 */
class WrapAroundRule extends RuleStrategy {
  constructor() {
    super("WrapAround");
    this.duration = Infinity;
  }

  // This rule modifies collision detection in GameEngine.update()
  // When isOutOfBounds detects wrap, reposition instead of ending game
}

/**
 * Shrinking Walls: Playable area shrinks over time
 */
class ShrinkingWallsRule extends RuleStrategy {
  constructor() {
    super("ShrinkingWalls");
    this.duration = 25000;
    this.shrinkRate = 0.5; // Shrink 1 cell per 2 seconds
    this.startTime = null;
  }

  onActivate(context) {
    super.onActivate(context);
    this.startTime = Date.now();
  }

  getCurrentBounds() {
    const elapsed = Date.now() - this.startTime;
    const shrinkAmount = Math.floor((elapsed / 1000) * this.shrinkRate);
    return {
      left: shrinkAmount,
      right: shrinkAmount,
      top: shrinkAmount,
      bottom: shrinkAmount,
    };
  }

  execute(context, deltaTime) {
    // Modify bounds in GameEngine.update()
  }
}

/**
 * Obstacles: Random obstacles spawn on the grid
 */
class ObstaclesRule extends RuleStrategy {
  constructor() {
    super("Obstacles");
    this.duration = 20000;
    this.obstacles = [];
    this.spawnChance = 0.01; // 1% per tick
  }

  execute(context, deltaTime) {
    // Spawn new obstacles
    if (Math.random() < this.spawnChance) {
      this.obstacles.push({
        x: Math.floor(Math.random() * context.gridWidth),
        y: Math.floor(Math.random() * context.gridHeight),
      });
    }

    // Check collision with obstacles
    const head = context.snake.getHead();
    for (const obstacle of this.obstacles) {
      if (head.x === obstacle.x && head.y === obstacle.y) {
        // Collision detected - end game or shrink snake
        context.snake.body.splice(Math.floor(context.snake.body.length / 2), 5);
      }
    }

    // Limit obstacle count
    if (this.obstacles.length > 20) {
      this.obstacles.shift();
    }
  }

  getObstacles() {
    return [...this.obstacles];
  }
}

// =============================================================================
// VISUAL EFFECT RULES
// =============================================================================

/**
 * Pixelated Vision: Render at reduced resolution
 */
class PixelatedVisionRule extends RuleStrategy {
  constructor() {
    super("PixelatedVision");
    this.duration = 12000;
    this.pixelSize = 4;
  }

  execute(context, deltaTime) {
    // Renderer applies pixelation based on this value
  }

  getPixelSize() {
    return this.pixelSize;
  }
}

/**
 * Color Inversion: Swap color scheme
 */
class ColorInversionRule extends RuleStrategy {
  constructor() {
    super("ColorInversion");
    this.duration = 8000;
  }

  execute(context, deltaTime) {
    // Renderer inverts colors
  }
}

/**
 * Screen Distortion: Canvas wobbles/distorts
 */
class ScreenDistortionRule extends RuleStrategy {
  constructor() {
    super("ScreenDistortion");
    this.duration = 10000;
    this.wobbleIntensity = 0.1;
  }

  execute(context, deltaTime) {
    // Renderer applies canvas distortion
  }

  getWobbleOffset() {
    return {
      x: Math.sin(Date.now() * 0.01) * this.wobbleIntensity,
      y: Math.cos(Date.now() * 0.01) * this.wobbleIntensity,
    };
  }
}

/**
 * Ghost Mode: Snake becomes semi-transparent
 */
class GhostModeRule extends RuleStrategy {
  constructor() {
    super("GhostMode");
    this.duration = 15000;
    this.opacity = 0.5;
  }

  execute(context, deltaTime) {
    // Renderer applies opacity
  }

  getOpacity() {
    return this.opacity;
  }
}

// =============================================================================
// SCORE & GAMEPLAY MODIFIER RULES
// =============================================================================

/**
 * Score Multiplier: Increase points per food
 */
class ScoreMultiplierRule extends RuleStrategy {
  constructor(multiplier = 2) {
    super("ScoreMultiplier");
    this.duration = 20000;
    this.multiplier = multiplier;
  }

  getMultiplier() {
    return this.multiplier;
  }

  execute(context, deltaTime) {
    // GameEngine applies multiplier when food is eaten
  }
}

/**
 * Time Pressure: Score decreases over time
 */
class TimePressureRule extends RuleStrategy {
  constructor() {
    super("TimePressure");
    this.duration = 15000;
    this.decayRate = 1; // 1 point per second
    this.lastDecayTime = null;
  }

  onActivate(context) {
    super.onActivate(context);
    this.lastDecayTime = Date.now();
  }

  execute(context, deltaTime) {
    const now = Date.now();
    if (now - this.lastDecayTime > 1000) {
      context.score = Math.max(0, context.score - this.decayRate);
      this.lastDecayTime = now;
    }
  }
}

/**
 * Reverse Growth: Eating food shrinks the snake
 */
class ReverseGrowthRule extends RuleStrategy {
  constructor() {
    super("ReverseGrowth");
    this.duration = 18000;
  }

  execute(context, deltaTime) {
    // Override grow() to shrink instead
  }
}

/**
 * Double Or Nothing: Food alternates between +20 and -10 points
 */
class DoubleOrNothingRule extends RuleStrategy {
  constructor() {
    super("DoubleOrNothing");
    this.duration = 15000;
    this.isPositive = true;
  }

  execute(context, deltaTime) {
    // Toggle on each food eaten
  }

  getPointValue() {
    const value = this.isPositive ? 20 : -10;
    this.isPositive = !this.isPositive;
    return value;
  }
}

// =============================================================================
// COMBO RULES (Multi-effect modifiers)
// =============================================================================

/**
 * Hardcore Mode: Combines multiple hard modifiers
 * - Reverse Controls
 * - Input Delay (300ms)
 * - Speed Burst (1.5x)
 * - Obstacles spawn frequently
 */
class HardcoreModeRule extends RuleStrategy {
  constructor(gameEngine) {
    super("HardcoreMode");
    this.duration = 30000;
    this.gameEngine = gameEngine;
  }

  onActivate(context) {
    super.onActivate(context);
    // Activate multiple rules
    this.gameEngine.activateRule("ReverseControls");
    this.gameEngine.activateRule("InputDelay");
    this.gameEngine.activateRule("SpeedBurst");
    this.gameEngine.activateRule("Obstacles");
  }

  onDeactivate(context) {
    super.onDeactivate(context);
    // Deactivate all child rules
    this.gameEngine.deactivateRule("ReverseControls");
    this.gameEngine.deactivateRule("InputDelay");
    this.gameEngine.deactivateRule("SpeedBurst");
    this.gameEngine.deactivateRule("Obstacles");
  }
}

/**
 * Chaos Mode: Random effects change every 2 seconds
 */
class ChaosModeRule extends RuleStrategy {
  constructor(gameEngine) {
    super("ChaosMode");
    this.duration = 25000;
    this.gameEngine = gameEngine;
    this.availableRules = [
      "ReverseControls",
      "InputDelay",
      "SpeedBurst",
      "RandomTurns",
      "ScreenFlip",
    ];
    this.lastChangeTime = null;
    this.currentRule = null;
  }

  execute(context, deltaTime) {
    const now = Date.now();

    if (!this.lastChangeTime) {
      this.lastChangeTime = now;
    }

    if (now - this.lastChangeTime > 2000) {
      // Deactivate current rule
      if (this.currentRule) {
        this.gameEngine.deactivateRule(this.currentRule);
      }

      // Activate random rule
      this.currentRule =
        this.availableRules[
          Math.floor(Math.random() * this.availableRules.length)
        ];
      this.gameEngine.activateRule(this.currentRule);
      this.lastChangeTime = now;
    }
  }

  onDeactivate(context) {
    super.onDeactivate(context);
    if (this.currentRule) {
      this.gameEngine.deactivateRule(this.currentRule);
    }
  }
}

// =============================================================================
// RULE REGISTRATION HELPER
// =============================================================================

/**
 * Convenience function to register all custom rules
 */
function registerAllCustomRules(gameEngine) {
  // Movement Modifiers
  gameEngine.ruleManager.registerRule(new CircularMovementRule());
  gameEngine.ruleManager.registerRule(new SlowMotionRule());
  gameEngine.ruleManager.registerRule(new RandomTurnsRule());
  gameEngine.ruleManager.registerRule(new QuantumSnakeRule());

  // Food Modifiers
  gameEngine.ruleManager.registerRule(new PoisonFoodRule());
  gameEngine.ruleManager.registerRule(new MultiplyingFoodRule());
  gameEngine.ruleManager.registerRule(new InvisibleFoodRule());

  // Collision & Boundary
  gameEngine.ruleManager.registerRule(new WrapAroundRule());
  gameEngine.ruleManager.registerRule(new ShrinkingWallsRule());
  gameEngine.ruleManager.registerRule(new ObstaclesRule());

  // Visual Effects
  gameEngine.ruleManager.registerRule(new PixelatedVisionRule());
  gameEngine.ruleManager.registerRule(new ColorInversionRule());
  gameEngine.ruleManager.registerRule(new ScreenDistortionRule());
  gameEngine.ruleManager.registerRule(new GhostModeRule());

  // Score & Gameplay
  gameEngine.ruleManager.registerRule(new ScoreMultiplierRule(2));
  gameEngine.ruleManager.registerRule(new TimePressureRule());
  gameEngine.ruleManager.registerRule(new ReverseGrowthRule());
  gameEngine.ruleManager.registerRule(new DoubleOrNothingRule());

  // Combo Modifiers
  gameEngine.ruleManager.registerRule(new HardcoreModeRule(gameEngine));
  gameEngine.ruleManager.registerRule(new ChaosModeRule(gameEngine));

  console.log("✅ All custom rules registered");
}

// =============================================================================
// USAGE EXAMPLE
// =============================================================================

/*
// In your HTML/main script:

const gameEngine = new GameEngine(canvas);
registerAllCustomRules(gameEngine);

// Now you can activate any custom rule:
gameEngine.activateRule('CircularMovement');
gameEngine.activateRule('GhostMode');
gameEngine.activateRule('ScoreMultiplier');

// Or activate a combo rule which auto-activates child rules:
gameEngine.activateRule('HardcoreMode');

// Rules automatically expire after their duration and are cleaned up
*/

// Export for module usage (if using as module)
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    // Movement Modifiers
    CircularMovementRule,
    SlowMotionRule,
    RandomTurnsRule,
    QuantumSnakeRule,
    // Food Modifiers
    PoisonFoodRule,
    MultiplyingFoodRule,
    InvisibleFoodRule,
    // Collision & Boundary
    WrapAroundRule,
    ShrinkingWallsRule,
    ObstaclesRule,
    // Visual Effects
    PixelatedVisionRule,
    ColorInversionRule,
    ScreenDistortionRule,
    GhostModeRule,
    // Score & Gameplay
    ScoreMultiplierRule,
    TimePressureRule,
    ReverseGrowthRule,
    DoubleOrNothingRule,
    // Combo Modifiers
    HardcoreModeRule,
    ChaosModeRule,
    // Helper
    registerAllCustomRules,
  };
}
