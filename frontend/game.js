// =============================================================================
// BACKEND INTEGRATION (REMOVED)
// =============================================================================
// Supabase backend integration removed to keep project frontend-only.
// Any runtime checks for `window.supabaseClient` should receive `null`.
window.supabaseClient = null;

// =============================================================================
// GLOBAL ACTIVE PLAYER STATE (Persisted via localStorage across pages)
// =============================================================================
window.activePlayer = {
  id: localStorage.getItem("snakeUserId") || null,
  username: localStorage.getItem("snakeUsername") || null,
  highScore: parseInt(localStorage.getItem("snakeHighScore") || "0", 10),
};

window.updateActivePlayer = function (id, username, highScore) {
  window.activePlayer.id = id;
  window.activePlayer.username = username;
  window.activePlayer.highScore = highScore;

  if (id) localStorage.setItem("snakeUserId", id);
  if (username) localStorage.setItem("snakeUsername", username);
  if (highScore !== null && highScore !== undefined) {
    localStorage.setItem("snakeHighScore", highScore.toString());
  }
};

/**
 * ============================================================================
 * Advanced Snake Game Architecture
 * Core Engine with Dynamic Rule System
 * ============================================================================
 *
 * This implementation demonstrates:
 * - Fixed-Timestep Game Loop (delta-time accumulator)
 * - Publish/Subscribe Event Bus
 * - Finite State Machine (FSM)
 * - FIFO Input Queue with timestamp validation
 * - Strategy Pattern for dynamic rule systems
 * - Array-based entity management
 * - Canvas matrix transformations for visual effects
 */

// =============================================================================
// 1. EVENT BUS (Publish/Subscribe System)
// =============================================================================

class EventBus {
  constructor() {
    this.subscribers = {};
  }

  /**
   * Subscribe to an event
   * @param {string} eventType - Event identifier
   * @param {Function} callback - Handler function
   */
  subscribe(eventType, callback) {
    if (!this.subscribers[eventType]) {
      this.subscribers[eventType] = [];
    }
    this.subscribers[eventType].push(callback);
  }

  /**
   * Unsubscribe from an event
   * @param {string} eventType - Event identifier
   * @param {Function} callback - Handler to remove
   */
  unsubscribe(eventType, callback) {
    if (!this.subscribers[eventType]) return;
    this.subscribers[eventType] = this.subscribers[eventType].filter(
      (cb) => cb !== callback,
    );
  }

  /**
   * Publish an event to all subscribers
   * @param {string} eventType - Event identifier
   * @param {*} data - Event payload
   */
  publish(eventType, data = null) {
    if (!this.subscribers[eventType]) return;
    this.subscribers[eventType].forEach((callback) => callback(data));
  }

  clear() {
    this.subscribers = {};
  }
}

// Global event bus instance
const eventBus = new EventBus();

// Event Type Constants
const EVENT_TYPES = {
  GAME_START: "game:start",
  GAME_OVER: "game:over",
  GAME_PAUSE: "game:pause",
  GAME_RESUME: "game:resume",
  SNAKE_MOVED: "snake:moved",
  SNAKE_COLLIDED: "snake:collided",
  FOOD_EATEN: "food:eaten",
  FOOD_SPAWNED: "food:spawned",
  SCORE_CHANGED: "score:changed",
  RULE_ACTIVATED: "rule:activated",
  RULE_DEACTIVATED: "rule:deactivated",
  VISUAL_EFFECT_APPLIED: "visual:effect",
  POISON_DEATH: "poison:death", // fired when slow-death timer expires
  POISON_CURED: "poison:cured", // fired when player eats 2 cure apples
};

// =============================================================================
// 2. FINITE STATE MACHINE (FSM)
// =============================================================================

class GameStateMachine {
  constructor() {
    this.state = "MENU"; // MENU, PLAYING, PAUSED, GAME_OVER
    this.previousState = null;
  }

  transition(newState) {
    if (this.state === newState) return;
    this.previousState = this.state;
    this.state = newState;
    eventBus.publish(EVENT_TYPES.GAME_STATE_CHANGED, {
      from: this.previousState,
      to: newState,
    });
  }

  getState() {
    return this.state;
  }

  isPlaying() {
    return this.state === "PLAYING";
  }
}

// =============================================================================
// 3. INPUT QUEUE (FIFO with Timestamp Validation)
// =============================================================================

class InputQueue {
  constructor() {
    this.queue = [];
  }

  /**
   * Push input to queue with timestamp
   * @param {string} direction - Direction: 'UP', 'DOWN', 'LEFT', 'RIGHT'
   * @param {number} timestamp - System timestamp (Date.now())
   */
  enqueue(direction, timestamp = Date.now()) {
    this.queue.push({
      direction,
      timestamp,
    });
  }

  /**
   * Dequeue the oldest input
   * @returns {Object|null} Input object or null if queue is empty
   */
  dequeue() {
    return this.queue.length > 0 ? this.queue.shift() : null;
  }

  /**
   * Peek at the oldest input without removing it
   * @returns {Object|null} Input object or null if queue is empty
   */
  peek() {
    return this.queue.length > 0 ? this.queue[0] : null;
  }

  /**
   * Get the age of the oldest input in milliseconds
   * @returns {number} Age in ms, or Infinity if queue is empty
   */
  getOldestInputAge() {
    if (this.queue.length === 0) return Infinity;
    return Date.now() - this.queue[0].timestamp;
  }

  clear() {
    this.queue = [];
  }

  getSize() {
    return this.queue.length;
  }
}

// =============================================================================
// 4. SNAKE ENTITY (Array-based coordinate representation)
// =============================================================================

class Snake {
  constructor(startX, startY, initialLength = 3) {
    this.body = [];
    // Initialize snake from head to tail
    for (let i = 0; i < initialLength; i++) {
      this.body.unshift({
        x: startX - i,
        y: startY,
      });
    }
    this.direction = { x: 1, y: 0 }; // Moving right
    this.nextDirection = { x: 1, y: 0 };
  }

  /**
   * Set the next direction (prevents reversing into self)
   * @param {Object} newDirection - {x, y} unit vector
   */
  setDirection(newDirection) {
    // Prevent 180-degree turns
    if (
      newDirection.x === -this.direction.x &&
      newDirection.y === -this.direction.y
    ) {
      return;
    }
    this.nextDirection = { ...newDirection };
  }

  /**
   * Move the snake: add head, remove tail
   * @param {Object} customHead - Optional custom head position (for splits, etc.)
   * @returns {Object} The new head position
   */
  move(customHead = null) {
    this.direction = { ...this.nextDirection };

    let newHead;
    if (customHead) {
      newHead = { ...customHead };
    } else {
      const headCoord = this.body[0];
      newHead = {
        x: headCoord.x + this.direction.x,
        y: headCoord.y + this.direction.y,
      };
    }

    this.body.unshift(newHead);
    this.body.pop();

    return newHead;
  }

  /**
   * Grow the snake (for food eaten scenarios)
   * @param {number} amount - Segments to add
   */
  grow(amount = 1) {
    for (let i = 0; i < amount; i++) {
      const tail = this.body[this.body.length - 1];
      this.body.push({ ...tail });
    }
  }

  /**
   * Get the head position
   * @returns {Object} Head coordinate {x, y}
   */
  getHead() {
    return this.body[0];
  }

  /**
   * Get the tail position
   * @returns {Object} Tail coordinate {x, y}
   */
  getTail() {
    return this.body[this.body.length - 1];
  }

  /**
   * Check if a coordinate collides with the snake body
   * @param {Object} coord - Coordinate to check {x, y}
   * @param {number} skipSegments - Segments from head to skip (default 4 for self-collision)
   * @returns {boolean}
   */
  collidesWith(coord, skipSegments = 4) {
    for (let i = skipSegments; i < this.body.length; i++) {
      if (this.body[i].x === coord.x && this.body[i].y === coord.y) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if snake is out of bounds
   * @param {number} gridWidth - Game grid width
   * @param {number} gridHeight - Game grid height
   * @returns {boolean}
   */
  isOutOfBounds(gridWidth, gridHeight) {
    const head = this.getHead();
    return (
      head.x < 0 || head.x >= gridWidth || head.y < 0 || head.y >= gridHeight
    );
  }

  /**
   * Get the length of the snake
   * @returns {number}
   */
  getLength() {
    return this.body.length;
  }

  /**
   * Serialize snake state
   * @returns {Array}
   */
  getBody() {
    return this.body.map((segment) => ({ ...segment }));
  }

  /**
   * Instantly swap head and tail: reverse body array and flip direction.
   * Sets nextDirection so the snake immediately moves away from its new body.
   */
  swapHeadTail() {
    this.body.reverse();
    // New direction = opposite of old direction so it continues moving smoothly
    this.direction = { x: -this.direction.x, y: -this.direction.y };
    this.nextDirection = { x: -this.nextDirection.x, y: -this.nextDirection.y };
  }
}

// =============================================================================
// 5. STRATEGY PATTERN (Dynamic Rule System)
// =============================================================================

/**
 * Base Strategy class for all game rules
 * All rule strategies must implement this interface
 */
class RuleStrategy {
  constructor(name = "BaseRule") {
    this.name = name;
    this.isActive = false;
    this.duration = Infinity; // Milliseconds; Infinity = permanent
    this.startTime = null;
  }

  /**
   * Called when the rule is activated
   * @param {Object} context - Game context (game object, snake, etc.)
   */
  onActivate(context) {
    this.isActive = true;
    this.startTime = Date.now();
    eventBus.publish(EVENT_TYPES.RULE_ACTIVATED, { ruleName: this.name });
  }

  /**
   * Called every game tick while the rule is active
   * @param {Object} context - Game context
   * @param {number} deltaTime - Time since last tick in ms
   */
  execute(context, deltaTime) {
    // Override in subclasses
  }

  /**
   * Called when the rule is deactivated
   * @param {Object} context - Game context
   */
  onDeactivate(context) {
    this.isActive = false;
    eventBus.publish(EVENT_TYPES.RULE_DEACTIVATED, { ruleName: this.name });
  }

  /**
   * Check if the rule duration has expired
   * @returns {boolean}
   */
  hasExpired() {
    if (this.duration === Infinity) return false;
    return Date.now() - this.startTime > this.duration;
  }

  getName() {
    return this.name;
  }
}

/**
 * Example Rule: Reverse Controls
 * All directional inputs are reversed
 */
class ReverseControlsRule extends RuleStrategy {
  constructor() {
    super("ReverseControls");
    this.duration = 10000; // 10 seconds
  }

  execute(context, deltaTime) {
    // This rule modifies input processing in the main loop
    // See GameEngine.processInput() for integration
  }
}

/**
 * Example Rule: Input Delay
 * User inputs are delayed before being processed
 */
class InputDelayRule extends RuleStrategy {
  constructor(delayMs = 500) {
    super("InputDelay");
    this.delayMs = delayMs;
    this.duration = 15000; // 15 seconds
  }

  execute(context, deltaTime) {
    // This rule delays input processing
    // See GameEngine.processInput() for integration
  }
}

/**
 * Example Rule: Speed Burst
 * Snake moves at double speed
 */
class SpeedBurstRule extends RuleStrategy {
  constructor() {
    super("SpeedBurst");
    this.duration = 8000; // 8 seconds
    this.speedMultiplier = 2.0;
  }

  execute(context, deltaTime) {
    // This rule modifies the game tick rate
    // See GameEngine.update() for integration
  }

  getSpeedMultiplier() {
    return this.speedMultiplier;
  }
}

/**
 * Rule: Moving Food (Grid-Locked Teleport)
 *
 * Food stays locked to the grid at all times.
 * Every TELEPORT_EVERY ticks it jumps to a new, unoccupied cell.
 * WARN_TICKS before the teleport, food.flashing is set to true so the
 * renderer can show a visible warning (strobe + ring).
 */
class MovingFoodRule extends RuleStrategy {
  constructor() {
    super("MovingFood");
    this.duration = 30000; // 30 seconds total (increased from 20s)
    this.TELEPORT_EVERY = 20; // ticks between teleports (2 s at 10 tps)
    this.WARN_TICKS = 5; // flash for this many ticks before teleport (0.5 s)
    this.tickCounter = 0;
  }

  onActivate(context) {
    super.onActivate(context);
    this.tickCounter = 0;
    if (context.food) context.food.flashing = false;
  }

  execute(context, deltaTime) {
    if (!context.food) return;

    this.tickCounter++;

    // ── Step 1: Enable flash warning WARN_TICKS before teleport ────────────
    const ticksLeft = this.TELEPORT_EVERY - this.tickCounter;
    context.food.flashing = ticksLeft < this.WARN_TICKS;

    // ── Step 2: Teleport on interval ────────────────────────────────────────
    if (this.tickCounter >= this.TELEPORT_EVERY) {
      this.tickCounter = 0;
      context.food.flashing = false;

      // Find a grid cell not occupied by the snake
      let newPos;
      let attempts = 0;
      const maxAttempts = context.gridWidth * context.gridHeight;
      do {
        newPos = {
          x: Math.floor(Math.random() * context.gridWidth),
          y: Math.floor(Math.random() * context.gridHeight),
        };
        attempts++;
      } while (context.snake.collidesWith(newPos, 0) && attempts < maxAttempts);

      context.food.x = newPos.x;
      context.food.y = newPos.y;
      eventBus.publish(EVENT_TYPES.FOOD_SPAWNED, { x: newPos.x, y: newPos.y });
    }
  }

  onDeactivate(context) {
    super.onDeactivate(context);
    this.tickCounter = 0;
    if (context.food) context.food.flashing = false;
  }
}

// =============================================================================
// POISON FOOD RULE
// =============================================================================

/**
 * Rule: Poison Food
 *
 * Spawns a distinctly-coloured poison apple alongside the regular food.
 * Eating it does NOT kill instantly — instead it starts a 10-second
 * "Slow Death" countdown.  The snake flashes sickly green while poisoned.
 * Eating 2 normal apples before the timer expires cures the poison.
 * If the timer reaches 0, a POISON_DEATH event triggers Game Over.
 */
class PoisonFoodRule extends RuleStrategy {
  constructor() {
    super("PoisonFood");
    this.duration = 30000; // rule stays active for 30 s
    this.SLOW_DEATH_MS = 10000; // 10-second cure window
    this.CURES_NEEDED = 2; // apples to eat to cure
    this.POISON_COUNT = 4; // how many poison apples at once
    this.SPAWN_RADIUS = 4; // cell radius around regular food

    // Runtime state
    this.poisonFoodPositions = []; // array of {x,y}
    this.isPoisoned = false;
    this.countdownMs = 0;
    this.curesEaten = 0;
    this._foodHandler = null;
    this._lastFoodX = -1; // track regular food position
    this._lastFoodY = -1;
  }

  /**
   * Spawn a free cell within SPAWN_RADIUS of context.food.
   * Falls back to random grid cell if no near cell found.
   * @param {Object} context
   * @param {Array}  exclude  - positions already claimed by other poison apples
   */
  _spawnNearFood(context, exclude = []) {
    const R = this.SPAWN_RADIUS;
    const fx = context.food
      ? context.food.x
      : Math.floor(context.gridWidth / 2);
    const fy = context.food
      ? context.food.y
      : Math.floor(context.gridHeight / 2);

    let pos;
    let tries = 0;

    // First try to land near the food
    while (tries < 80) {
      const dx = Math.floor(Math.random() * (R * 2 + 1)) - R;
      const dy = Math.floor(Math.random() * (R * 2 + 1)) - R;
      pos = {
        x: Math.min(context.gridWidth - 1, Math.max(0, fx + dx)),
        y: Math.min(context.gridHeight - 1, Math.max(0, fy + dy)),
      };
      tries++;

      const onSnake = context.snake.collidesWith(pos, 0);
      const onFood =
        context.food && pos.x === context.food.x && pos.y === context.food.y;
      const onOther = exclude.some((p) => p && p.x === pos.x && p.y === pos.y);
      if (!onSnake && !onFood && !onOther) return pos;
    }

    // Fallback: anywhere on the grid
    const MAX = context.gridWidth * context.gridHeight;
    tries = 0;
    do {
      pos = {
        x: Math.floor(Math.random() * context.gridWidth),
        y: Math.floor(Math.random() * context.gridHeight),
      };
      tries++;
    } while (
      tries < MAX &&
      (context.snake.collidesWith(pos, 0) ||
        (context.food &&
          pos.x === context.food.x &&
          pos.y === context.food.y) ||
        exclude.some((p) => p && p.x === pos.x && p.y === pos.y))
    );
    return pos;
  }

  /** Rebuild the entire cluster near the current food position */
  _respawnCluster(context) {
    this.poisonFoodPositions = [];
    for (let i = 0; i < this.POISON_COUNT; i++) {
      this.poisonFoodPositions.push(
        this._spawnNearFood(context, this.poisonFoodPositions),
      );
    }
    if (context.food) {
      this._lastFoodX = context.food.x;
      this._lastFoodY = context.food.y;
    }
  }

  onActivate(context) {
    super.onActivate(context);
    this.isPoisoned = false;
    this.countdownMs = this.SLOW_DEATH_MS;
    this.curesEaten = 0;
    this._respawnCluster(context);

    // Count normal-food eats as cures while poisoned
    this._foodHandler = () => {
      if (!this.isPoisoned) return;
      this.curesEaten++;
      if (this.curesEaten >= this.CURES_NEEDED) {
        this.isPoisoned = false;
        this.curesEaten = 0;
        this.countdownMs = this.SLOW_DEATH_MS;
        eventBus.publish(EVENT_TYPES.POISON_CURED);
      }
    };
    eventBus.subscribe(EVENT_TYPES.FOOD_EATEN, this._foodHandler);
  }

  execute(context, deltaTime) {
    if (!context.food) return;

    // ── Re-cluster whenever the regular food moves (was eaten) ─────────────────
    if (
      context.food.x !== this._lastFoodX ||
      context.food.y !== this._lastFoodY
    ) {
      this._respawnCluster(context);
    }

    // ── Check if snake head is on any poison apple ──────────────────────────
    const head = context.snake.getHead();
    for (let i = 0; i < this.poisonFoodPositions.length; i++) {
      const p = this.poisonFoodPositions[i];
      if (!p) continue;
      if (head.x === p.x && head.y === p.y) {
        // Trigger poisoned state
        this.isPoisoned = true;
        this.countdownMs = this.SLOW_DEATH_MS;
        this.curesEaten = 0;
        // Respawn just this one apple near the food
        const others = this.poisonFoodPositions.filter((_, j) => j !== i);
        this.poisonFoodPositions[i] = this._spawnNearFood(context, others);
        break;
      }
    }

    // ── Tick the slow-death countdown ───────────────────────────────────
    if (this.isPoisoned) {
      this.countdownMs -= deltaTime;
      if (this.countdownMs <= 0) {
        this.countdownMs = 0;
        eventBus.publish(EVENT_TYPES.POISON_DEATH);
      }
    }
  }
} // end PoisonFoodRule

// =============================================================================
// NEW MODIFIERS
// =============================================================================

/**
 * Rule: Head-Tail Swap
 *
 * Activates twice per event duration (once immediately, once halfway).
 * Instantly reverses the snake's body array, shifting control to the new head.
 * White flash fires on the new head to signal the swap visually.
 */
class HeadTailSwapRule extends RuleStrategy {
  constructor() {
    super("HeadTailSwap");
    this.duration = 12000; // active for 12 s
    this.swapsDone = 0;
  }

  onActivate(context) {
    super.onActivate(context);
    this.swapsDone = 0;
    this.performSwap(context);
  }

  execute(context, deltaTime) {
    // Perform the second swap exactly halfway through the duration
    if (
      this.swapsDone === 1 &&
      Date.now() - this.startTime >= this.duration / 2
    ) {
      this.performSwap(context);
    }
  }

  performSwap(context) {
    this.swapsDone++;

    // Instantly reverse body and direction
    context.snake.swapHeadTail();

    // Bright signal for new head position
    if (context.renderer) {
      context.renderer.headFlashColor = "white";
      context.renderer.headFlashUntil = Date.now() + 600;
    }
  }

  onDeactivate(context) {
    super.onDeactivate(context);
    if (context && context.renderer) context.renderer.headFlashUntil = 0;
  }
}

/**
 * Rule: Random Walls
 * Picks 5 empty cells and marks them as walls.
 * Hitting a wall instantly triggers Game Over.
 * Walls are removed when the modifier expires.
 */
class RandomWallsRule extends RuleStrategy {
  constructor() {
    super("RandomWalls");
    this.duration = 18000; // 18 seconds
    this.walls = [];
  }

  onActivate(context) {
    super.onActivate(context);
    this.walls = [];
    const WALL_COUNT = 15; // 15 walls (increased difficulty)
    let attempts = 0;
    const MAX = context.gridWidth * context.gridHeight * 2;

    while (this.walls.length < WALL_COUNT && attempts < MAX) {
      attempts++;
      const pos = {
        x: Math.floor(Math.random() * context.gridWidth),
        y: Math.floor(Math.random() * context.gridHeight),
      };
      // Must not overlap snake, food, or existing walls
      const onSnake = context.snake.collidesWith(pos, 0);
      const onFood =
        context.food && pos.x === context.food.x && pos.y === context.food.y;
      const onWall = this.walls.some((w) => w.x === pos.x && w.y === pos.y);
      if (!onSnake && !onFood && !onWall) this.walls.push(pos);
    }
  }

  execute() {
    /* collision is checked in GameEngine.update() */
  }

  onDeactivate() {
    super.onDeactivate();
    this.walls = []; // Clear walls from the grid
  }
}

/**
 * Rule Manager: Orchestrates active rules
 */
class RuleManager {
  constructor() {
    this.activeRules = [];
    this.rulePool = {}; // Available rules to activate
  }

  /**
   * Register a rule strategy in the pool
   * @param {RuleStrategy} strategy - Rule instance
   */
  registerRule(strategy) {
    this.rulePool[strategy.getName()] = strategy;
  }

  /**
   * Activate a rule by name
   * @param {string} ruleName - Rule identifier
   * @param {Object} context - Game context
   */
  activateRule(ruleName, context) {
    const rule = this.rulePool[ruleName];
    if (!rule || rule.isActive) return;

    const instance = Object.create(Object.getPrototypeOf(rule));
    Object.assign(instance, rule);
    instance.onActivate(context);
    this.activeRules.push(instance);
  }

  /**
   * Deactivate a specific rule
   * @param {string} ruleName - Rule identifier
   * @param {Object} context - Game context
   */
  deactivateRule(ruleName, context) {
    const index = this.activeRules.findIndex((r) => r.getName() === ruleName);
    if (index === -1) return;

    this.activeRules[index].onDeactivate(context);
    this.activeRules.splice(index, 1);
  }

  /**
   * Execute all active rules and clean up expired ones
   * @param {Object} context - Game context
   * @param {number} deltaTime - Time since last tick in ms
   */
  executeRules(context, deltaTime) {
    // Execute each active rule
    this.activeRules.forEach((rule) => {
      rule.execute(context, deltaTime);
    });

    // Remove expired rules
    this.activeRules = this.activeRules.filter((rule) => {
      if (rule.hasExpired()) {
        rule.onDeactivate(context);
        return false;
      }
      return true;
    });
  }

  /**
   * Get all active rules
   * @returns {Array}
   */
  getActiveRules() {
    return [...this.activeRules];
  }

  /**
   * Check if a specific rule is active
   * @param {string} ruleName - Rule identifier
   * @returns {boolean}
   */
  isRuleActive(ruleName) {
    return this.activeRules.some((r) => r.getName() === ruleName);
  }

  clear() {
    this.activeRules = [];
  }
}

// =============================================================================
// 6. CANVAS RENDERER (with Matrix Transformations)
// =============================================================================

// =============================================================================
// FLOATING TEXT PARTICLE
// =============================================================================

class FloatingText {
  /**
   * @param {string} text      - Text label to display
   * @param {number} x         - Canvas pixel X (center anchor)
   * @param {number} y         - Canvas pixel Y (start position)
   * @param {number} duration  - Total lifetime in ms (default 1500)
   */
  constructor(text, x, y, duration = 1500) {
    this.text = text;
    this.x = x;
    this.y = y;
    this.duration = duration;
    this.elapsed = 0;
    this.alive = true;
  }

  /**
   * Advance particle by deltaTime ms
   * @param {number} dt - ms since last frame
   */
  tick(dt) {
    this.elapsed += dt;
    if (this.elapsed >= this.duration) this.alive = false;
  }

  /** 0 → 1 progress through lifetime */
  get progress() {
    return Math.min(this.elapsed / this.duration, 1);
  }

  /** Current opacity: 1 at start → 0 at end, with a short ease-in to avoid pop */
  get opacity() {
    // Ease-in for first 10%, linear fade-out after
    if (this.progress < 0.1) return this.progress / 0.1;
    return 1 - (this.progress - 0.1) / 0.9;
  }

  /** Pixels floated upward from spawn */
  get floatY() {
    return this.progress * 90;
  }
}

// =============================================================================
// 6. CANVAS RENDERER (with Matrix Transformations)
// =============================================================================

class GameRenderer {
  constructor(canvasElement, gridWidth, gridHeight, cellSize = 20) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext("2d");
    this.gridWidth = gridWidth;
    this.gridHeight = gridHeight;
    this.cellSize = cellSize;

    // Set canvas size
    this.canvas.width = gridWidth * cellSize;
    this.canvas.height = gridHeight * cellSize;

    this.visualEffects = [];
    this.floatingTexts = []; // Active FloatingText particles
    this._lastFrameTime = null;
    this.headFlashUntil = 0; // Timestamp until which the snake head shows flash
    this.headFlashColor = "white"; // "white" = post-swap, "amber" = pre-warning
  }

  /**
   * Apply visual transformation (e.g., flip, rotate)
   * @param {Object} effect - Transformation object
   */
  applyVisualEffect(effect) {
    this.visualEffects.push(effect);
  }

  /**
   * Remove a visual effect
   * @param {string} effectName - Effect identifier
   */
  removeVisualEffect(effectName) {
    this.visualEffects = this.visualEffects.filter(
      (e) => e.name !== effectName,
    );
  }

  /**
   * Spawn a floating text notification on the canvas.
   * Position is in canvas pixel coordinates; pass null to use canvas center.
   *
   * @param {string} text      - Label to show (e.g. "⚠ Input Delay!")
   * @param {number|null} x    - Canvas X anchor (null → horizontal center)
   * @param {number|null} y    - Canvas Y anchor (null → vertical center)
   * @param {number} duration  - Lifetime in ms (default 1500)
   */
  spawnFloatingText(text, x = null, y = null, duration = 1500) {
    const px = x !== null ? x : this.canvas.width / 2;
    const py = y !== null ? y : this.canvas.height / 2;
    this.floatingTexts.push(new FloatingText(text, px, py, duration));
  }

  /**
   * Main render method
   * @param {Snake} snake - Snake entity
   * @param {Object} food - Food object {x, y}
   * @param {number} score - Current score
   * @param {RuleManager} ruleManager - Rule manager for visual effects
   */
  render(snake, food, score, ruleManager, deltaTime = 16) {
    // Look up poison rule once for the whole frame
    const poisonRule = ruleManager
      .getActiveRules()
      .find((r) => r.name === "PoisonFood");
    const isPoisoned = !!(poisonRule && poisonRule.isPoisoned);

    // Save canvas state before transformations
    this.ctx.save();

    // Apply visual transformations from rules
    this.applyCanvasTransformations(ruleManager);

    // Clear canvas
    this.ctx.fillStyle = "#060912";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw grid
    this.drawGrid();

    // Draw regular food
    this.drawFood(food);

    // Draw poison apples if modifier is active (loop over entire cluster)
    if (poisonRule && poisonRule.poisonFoodPositions) {
      for (const pos of poisonRule.poisonFoodPositions) {
        if (pos) this.drawPoisonFood(pos);
      }
    }

    // Draw random walls if modifier is active
    const wallRule = ruleManager
      .getActiveRules()
      .find((r) => r.name === "RandomWalls");
    if (wallRule && wallRule.walls.length) {
      this.drawWalls(wallRule.walls);
    }

    // Draw snake (flashes sickly green when poisoned; head flashes white after swap)
    this.drawSnake(snake, isPoisoned, Date.now() < this.headFlashUntil);

    // Draw score
    this.drawScore(score);

    // Restore canvas state BEFORE screen-space overlays
    this.ctx.restore();

    // Draw poison HUD (screen-space — immune to ScreenFlip)
    if (isPoisoned) {
      this.drawPoisonHUD(
        poisonRule.countdownMs,
        poisonRule.SLOW_DEATH_MS,
        poisonRule.curesEaten,
        poisonRule.CURES_NEEDED,
      );
    }

    // Draw floating text particles
    this.drawFloatingTexts(deltaTime);
  }

  /**
   * Tick and draw all living floating text particles.
   * Called in screen-space (after ctx.restore) so transforms don't affect it.
   * @param {number} deltaTime - ms since last frame
   */
  drawFloatingTexts(deltaTime) {
    const ctx = this.ctx;

    // Tick every particle and remove dead ones
    for (const ft of this.floatingTexts) ft.tick(deltaTime);
    this.floatingTexts = this.floatingTexts.filter((ft) => ft.alive);

    for (const ft of this.floatingTexts) {
      const drawY = ft.y - ft.floatY;

      ctx.save();
      ctx.globalAlpha = ft.opacity;

      // --- Glowing backdrop pill ---
      const fontSize = Math.max(14, Math.min(22, this.canvas.width * 0.038));
      const label = ft.text;
      ctx.font = `700 ${fontSize}px 'Inter', 'Segoe UI', sans-serif`;
      const metrics = ctx.measureText(label);
      const textW = metrics.width;
      const padX = 16;
      const padY = 8;
      const pillW = textW + padX * 2;
      const pillH = fontSize + padY * 2;
      const pillX = ft.x - pillW / 2;
      const pillY = drawY - pillH / 2;
      const r = pillH / 2;

      // Outer glow
      ctx.shadowColor = "rgba(245, 158, 11, 0.9)";
      ctx.shadowBlur = 22;

      // Pill background
      ctx.beginPath();
      ctx.moveTo(pillX + r, pillY);
      ctx.arcTo(pillX + pillW, pillY, pillX + pillW, pillY + pillH, r);
      ctx.arcTo(pillX + pillW, pillY + pillH, pillX, pillY + pillH, r);
      ctx.arcTo(pillX, pillY + pillH, pillX, pillY, r);
      ctx.arcTo(pillX, pillY, pillX + pillW, pillY, r);
      ctx.closePath();
      ctx.fillStyle = "rgba(20, 15, 5, 0.82)";
      ctx.fill();

      // Pill border
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(245, 158, 11, 0.85)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Text
      ctx.shadowColor = "rgba(245, 158, 11, 0.7)";
      ctx.shadowBlur = 10;
      ctx.fillStyle = "#fbbf24";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, ft.x, drawY);

      ctx.restore();
    }
  }

  /**
   * Apply canvas matrix transformations based on active rules
   * @param {RuleManager} ruleManager - Rule manager
   */
  applyCanvasTransformations(ruleManager) {
    // No visual transformations currently active
  }

  /**
   * Draw the game grid (for debugging)
   */
  drawGrid() {
    this.ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    this.ctx.lineWidth = 0.5;

    for (let x = 0; x <= this.gridWidth; x++) {
      this.ctx.beginPath();
      this.ctx.moveTo(x * this.cellSize, 0);
      this.ctx.lineTo(x * this.cellSize, this.canvas.height);
      this.ctx.stroke();
    }

    for (let y = 0; y <= this.gridHeight; y++) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y * this.cellSize);
      this.ctx.lineTo(this.canvas.width, y * this.cellSize);
      this.ctx.stroke();
    }
  }

  /**
   * Draw the snake.
   * @param {Snake}   snake       - Snake entity
   * @param {boolean} isPoisoned  - Flash sickly green when true
   * @param {boolean} headFlash   - Flash head (color set by renderer.headFlashColor)
   */
  drawSnake(snake, isPoisoned = false, headFlash = false) {
    const body = snake.getBody();
    const ctx = this.ctx;
    const flashColor = this.headFlashColor || "white"; // "white" or "amber"

    // Poisoned strobe: flips every 160 ms for a slow sickly pulse
    const poisonFlash = isPoisoned && Math.floor(Date.now() / 160) % 2 === 0;

    // Head-flash strobe: flips every 80ms for rapid visual feedback
    const flashStrobe = headFlash && Math.floor(Date.now() / 80) % 2 === 0;

    let headColor, glowColor;
    if (headFlash && flashStrobe) {
      headColor = flashColor === "amber" ? "#f59e0b" : "#ffffff";
      glowColor =
        flashColor === "amber"
          ? "rgba(245,158,11,0.9)"
          : "rgba(255,255,255,0.9)";
    } else if (poisonFlash) {
      headColor = "#7fff00";
      glowColor = "rgba(127,255,0,0.6)";
    } else {
      headColor = "#00ff00";
      glowColor = "rgba(0,255,0,0)";
    }
    const bodyColor = poisonFlash ? "#4db800" : "#00cc00";

    ctx.save();
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = headFlash || isPoisoned ? 14 : 0;

    // Draw head
    const headX = body[0].x * this.cellSize;
    const headY = body[0].y * this.cellSize;
    ctx.fillStyle = headColor;
    ctx.fillRect(headX, headY, this.cellSize, this.cellSize);

    // Draw eyes to visually distinguish the head segment
    ctx.shadowBlur = 0; // Turn off glow for eyes
    ctx.fillStyle = "#060912"; // Dark color to match canvas background
    const eyeSize = Math.max(2, this.cellSize * 0.15);
    let eye1X, eye1Y, eye2X, eye2Y;

    // Position eyes based on current direction
    const cs = this.cellSize;
    if (snake.direction.x === 1) {
      // Right
      eye1X = headX + cs * 0.65;
      eye1Y = headY + cs * 0.2;
      eye2X = headX + cs * 0.65;
      eye2Y = headY + cs * 0.8 - eyeSize;
    } else if (snake.direction.x === -1) {
      // Left
      eye1X = headX + cs * 0.35 - eyeSize;
      eye1Y = headY + cs * 0.2;
      eye2X = headX + cs * 0.35 - eyeSize;
      eye2Y = headY + cs * 0.8 - eyeSize;
    } else if (snake.direction.y === -1) {
      // Up
      eye1X = headX + cs * 0.2;
      eye1Y = headY + cs * 0.35 - eyeSize;
      eye2X = headX + cs * 0.8 - eyeSize;
      eye2Y = headY + cs * 0.35 - eyeSize;
    } else {
      // Down (or default)
      eye1X = headX + cs * 0.2;
      eye1Y = headY + cs * 0.65;
      eye2X = headX + cs * 0.8 - eyeSize;
      eye2Y = headY + cs * 0.65;
    }

    ctx.beginPath();
    ctx.arc(
      eye1X + eyeSize / 2,
      eye1Y + eyeSize / 2,
      eyeSize / 2,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.beginPath();
    ctx.arc(
      eye2X + eyeSize / 2,
      eye2Y + eyeSize / 2,
      eyeSize / 2,
      0,
      Math.PI * 2,
    );
    ctx.fill();

    // Draw body (reset glow for body segments)
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = isPoisoned ? 8 : 0;
    ctx.fillStyle = bodyColor;
    for (let i = 1; i < body.length; i++) {
      ctx.fillRect(
        body[i].x * this.cellSize,
        body[i].y * this.cellSize,
        this.cellSize,
        this.cellSize,
      );
    }
    ctx.restore();
  }

  /**
   * Draw temporary wall cells from the RandomWalls modifier.
   * @param {Array<{x:number,y:number}>} walls
   */
  drawWalls(walls) {
    const ctx = this.ctx;
    const cs = this.cellSize;
    const t = Date.now();

    for (const w of walls) {
      const px = w.x * cs;
      const py = w.y * cs;

      // Base fill — distinct amber/orange
      ctx.save();
      ctx.fillStyle = "#d97706";
      ctx.shadowColor = "rgba(245, 158, 11, 0.5)";
      ctx.shadowBlur = 8;
      ctx.fillRect(px, py, cs, cs);

      // Subtle animated inner border
      const pulse = 0.5 + 0.5 * Math.sin(t / 400 + w.x * 0.7 + w.y * 1.3);
      ctx.strokeStyle = `rgba(253, 230, 138, ${0.4 + pulse * 0.4})`;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(px + 1, py + 1, cs - 2, cs - 2);

      // Tiny ✕ mark so it reads clearly as an obstacle
      const cx = px + cs / 2,
        cy = py + cs / 2,
        cr = cs * 0.25;
      ctx.strokeStyle = "rgba(255, 251, 235, 0.9)";
      ctx.lineWidth = Math.max(1, cs * 0.06);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(cx - cr, cy - cr);
      ctx.lineTo(cx + cr, cy + cr);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + cr, cy - cr);
      ctx.lineTo(cx - cr, cy + cr);
      ctx.stroke();
      ctx.restore();
    }
  }

  /**
   * Draw the poison apple.
   * Visually distinct: dark purple with a skull-like cross and pulsing toxic ring.
   * @param {{x:number, y:number}} pos - Grid position
   */
  drawPoisonFood(pos) {
    const cx = pos.x * this.cellSize + this.cellSize / 2;
    const cy = pos.y * this.cellSize + this.cellSize / 2;
    const r = this.cellSize / 2 - 1;
    const ctx = this.ctx;
    const t = Date.now();

    // Pulsing outer toxic ring
    const pulse = 0.5 + 0.5 * Math.sin(t / 200);
    const ringR = r + 2 + pulse * 4;
    ctx.save();
    ctx.globalAlpha = 0.45 + pulse * 0.4;
    ctx.strokeStyle = "#a855f7";
    ctx.lineWidth = 1.5;
    ctx.shadowColor = "#a855f7";
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Main body — deep toxic purple
    ctx.save();
    ctx.fillStyle = "#6d28d9";
    ctx.shadowColor = "#a855f7";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Skeleton 💀 emoji indicator inside
    ctx.save();
    ctx.fillStyle = "white";
    ctx.font = `${Math.floor(this.cellSize * 0.65)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("💀", cx, cy + 1.5);
    ctx.restore();
  }

  /**
   * Draw the slow-death HUD bar along the top of the canvas.
   * Always in screen-space (called after ctx.restore).
   *
   * @param {number} countdownMs  - Remaining ms
   * @param {number} totalMs      - Total window ms (used to compute bar width)
   * @param {number} curesEaten   - Normal apples eaten since poisoned
   * @param {number} curesNeeded  - Apples needed to cure
   */
  drawPoisonHUD(countdownMs, totalMs, curesEaten, curesNeeded) {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const barH = Math.max(28, this.canvas.height * 0.046);
    const padX = 12;
    const progress = Math.max(0, countdownMs / totalMs); // 1 → 0 as timer drains

    // ── Backdrop ──────────────────────────────────────────────────────
    ctx.save();
    ctx.fillStyle = "rgba(10, 4, 20, 0.88)";
    ctx.fillRect(0, 0, W, barH);

    // ── Timer fill (shrinks left-to-right as time drains) ──────────────────
    // Colour shifts from purple (safe) → red (critical)
    const r = Math.round(109 + (1 - progress) * 146); // 109 → 255
    const g = Math.round(40 * progress); // 40  → 0
    const b = Math.round(217 - (1 - progress) * 150); // 217 → 67
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.shadowColor = `rgb(${r},${g},${b})`;
    ctx.shadowBlur = 8;
    ctx.fillRect(0, 0, W * progress, barH);
    ctx.restore();

    // ── Bottom border line ─────────────────────────────────────────────
    ctx.save();
    ctx.strokeStyle = "rgba(168, 85, 247, 0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, barH);
    ctx.lineTo(W, barH);
    ctx.stroke();
    ctx.restore();

    // ── Text ───────────────────────────────────────────────────────────
    const fontSize = Math.max(11, Math.min(15, barH * 0.46));
    ctx.save();
    ctx.font = `700 ${fontSize}px 'Inter','Segoe UI',sans-serif`;
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = 4;
    const mid = barH / 2;

    // Left: skull icon + label
    ctx.fillStyle = "#fff";
    ctx.textAlign = "left";
    ctx.fillText(`☠ SLOW DEATH`, padX, mid);

    // Centre: countdown
    ctx.fillStyle = progress < 0.3 ? "#ff4444" : "#fff";
    ctx.textAlign = "center";
    ctx.fillText(`${(countdownMs / 1000).toFixed(1)}s`, W / 2, mid);

    // Right: cure progress
    const cureStr = `♥ ${curesEaten}/${curesNeeded} cures`;
    ctx.fillStyle = curesEaten > 0 ? "#86efac" : "#d1d5db";
    ctx.textAlign = "right";
    ctx.fillText(cureStr, W - padX, mid);
    ctx.restore();
  }

  /**
   * Draw the food.
   * When food.flashing is true, strobes between red and amber and draws
   * a pulsing warning ring so the player knows a teleport is imminent.
   * @param {Object} food - Food object {x, y, flashing?}
   */
  drawFood(food) {
    const cx = food.x * this.cellSize + this.cellSize / 2;
    const cy = food.y * this.cellSize + this.cellSize / 2;
    const r = this.cellSize / 2;
    const ctx = this.ctx;

    if (food.flashing) {
      // Strobe at ~8 Hz: flips every 125 ms
      const strobeOn = Math.floor(Date.now() / 125) % 2 === 0;

      // ── Warning ring (drawn first, behind the food dot) ─────────────────
      // Animated expanding radius using a slower sine wave
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 80);
      const ringR = r + 3 + pulse * 5;

      ctx.save();
      ctx.globalAlpha = 0.55 + pulse * 0.35;
      ctx.strokeStyle = strobeOn ? "#f59e0b" : "#fbbf24";
      ctx.lineWidth = 2;
      ctx.shadowColor = "#f59e0b";
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // ── Food dot — strobes between red and amber ─────────────────────────
      ctx.save();
      ctx.fillStyle = strobeOn ? "#f59e0b" : "#ef4444";
      ctx.shadowColor = strobeOn ? "#f59e0b" : "#ef4444";
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(cx, cy, r - 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else {
      // ── Normal food ──────────────────────────────────────────────────────
      ctx.save();
      ctx.fillStyle = "#ef4444";
      ctx.shadowColor = "rgba(239, 68, 68, 0.6)";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /**
   * Draw the score
   * @param {number} score - Current score
   */
  drawScore(score) {
    this.ctx.fillStyle = "#ffffff";
    this.ctx.font = "20px Arial";
    this.ctx.fillText(`Score: ${score}`, 10, this.canvas.height - 10);
  }

  /**
   * Clear the canvas completely
   */
  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.floatingTexts = [];
  }
}

// =============================================================================
// 7. MAIN GAME ENGINE (Fixed-Timestep Game Loop)
// =============================================================================

class GameEngine {
  constructor(canvasElement, config = {}) {
    // Configuration
    this.config = {
      gridWidth: config.gridWidth || 40,
      gridHeight: config.gridHeight || 30,
      cellSize: config.cellSize || 20,
      targetTickRate: config.targetTickRate || 10, // 10 ticks per second (100ms per tick)
      ...config,
    };

    // Game state
    this.stateMachine = new GameStateMachine();
    this.snake = new Snake(
      Math.floor(this.config.gridWidth / 2),
      Math.floor(this.config.gridHeight / 2),
      3,
    );
    this.food = this.spawnFood();
    this.score = 0;

    // Input and timing
    this.inputQueue = new InputQueue();
    this.ruleManager = new RuleManager();
    this.renderer = new GameRenderer(
      canvasElement,
      this.config.gridWidth,
      this.config.gridHeight,
      this.config.cellSize,
    );

    // Game loop timing
    this.tickAccumulator = 0;
    this.tickThreshold = 1000 / this.config.targetTickRate; // ms per tick
    this.lastFrameTime = null;
    this.isRunning = false;

    this.setupEventListeners();
    this.setupRules();
  }

  /**
   * Setup keyboard input listeners
   */
  setupEventListeners() {
    document.addEventListener("keydown", (e) => {
      const directionMap = {
        ArrowUp: { x: 0, y: -1 },
        ArrowDown: { x: 0, y: 1 },
        ArrowLeft: { x: -1, y: 0 },
        ArrowRight: { x: 1, y: 0 },
        w: { x: 0, y: -1 },
        s: { x: 0, y: 1 },
        a: { x: -1, y: 0 },
        d: { x: 1, y: 0 },
      };

      if (directionMap[e.key]) {
        e.preventDefault();
        this.inputQueue.enqueue(directionMap[e.key], Date.now());
      }

      if (e.key === " ") {
        e.preventDefault();
        this.togglePause();
      }
    });

    // Poison death — slow-death timer expired inside PoisonFoodRule
    eventBus.subscribe(EVENT_TYPES.POISON_DEATH, () => {
      if (this.stateMachine.isPlaying()) this.endGame();
    });
  }

  /**
   * Register available rule strategies
   */
  setupRules() {
    this.ruleManager.registerRule(new ReverseControlsRule());
    this.ruleManager.registerRule(new InputDelayRule(500));
    this.ruleManager.registerRule(new SpeedBurstRule());
    this.ruleManager.registerRule(new MovingFoodRule());
    this.ruleManager.registerRule(new PoisonFoodRule());
    this.ruleManager.registerRule(new HeadTailSwapRule());
    this.ruleManager.registerRule(new RandomWallsRule());
  }

  /**
   * Spawn food at random location
   * @returns {Object} Food object {x, y}
   */
  spawnFood() {
    let food;
    let isOnSnake = true;

    // Ensure food doesn't spawn on snake
    while (isOnSnake) {
      food = {
        x: Math.floor(Math.random() * this.config.gridWidth),
        y: Math.floor(Math.random() * this.config.gridHeight),
      };
      isOnSnake = this.snake.collidesWith(food, 0);
    }

    eventBus.publish(EVENT_TYPES.FOOD_SPAWNED, food);
    return food;
  }

  /**
   * Process inputs from the input queue
   * Applies modifier rules like InputDelay and ReverseControls
   */
  processInput() {
    // Check if InputDelay rule is active
    const inputDelayRule = this.ruleManager
      .getActiveRules()
      .find((r) => r.name === "InputDelay");

    const earliestAllowedTime = inputDelayRule
      ? Date.now() - inputDelayRule.delayMs
      : Infinity;

    // Process only if the input is old enough (and ReverseControls is not active)
    const input = this.inputQueue.peek();
    if (!input) return;

    if (input.timestamp > earliestAllowedTime) {
      return; // Input is too recent, skip this tick
    }

    this.inputQueue.dequeue();

    // Apply ReverseControls rule if active
    let direction = input.direction;
    const reverseRule = this.ruleManager
      .getActiveRules()
      .find((r) => r.name === "ReverseControls");
    if (reverseRule) {
      direction = { x: -direction.x, y: -direction.y };
    }

    this.snake.setDirection(direction);
  }

  /**
   * Core game logic update
   */
  update() {
    if (!this.stateMachine.isPlaying()) return;

    // Process input queue
    this.processInput();

    // Calculate actual tick rate with speed modifiers
    let effectiveTickThreshold = this.tickThreshold;
    const speedBurstRule = this.ruleManager
      .getActiveRules()
      .find((r) => r.name === "SpeedBurst");
    if (speedBurstRule) {
      effectiveTickThreshold /= speedBurstRule.getSpeedMultiplier();
    }

    if (this.tickAccumulator < effectiveTickThreshold) {
      return; // Not enough time has passed for a game tick
    }

    this.tickAccumulator -= effectiveTickThreshold;

    // Move snake
    const newHeadPos = this.snake.move();
    eventBus.publish(EVENT_TYPES.SNAKE_MOVED, { head: newHeadPos });

    // Check collisions
    if (
      this.snake.isOutOfBounds(this.config.gridWidth, this.config.gridHeight) ||
      this.snake.collidesWith(newHeadPos)
    ) {
      this.endGame();
      return;
    }

    // Check wall collision (RandomWalls modifier)
    const wallRule = this.ruleManager
      .getActiveRules()
      .find((r) => r.name === "RandomWalls");
    if (
      wallRule &&
      wallRule.walls.some((w) => w.x === newHeadPos.x && w.y === newHeadPos.y)
    ) {
      this.endGame();
      return;
    }

    // Check food collision
    if (newHeadPos.x === this.food.x && newHeadPos.y === this.food.y) {
      this.snake.grow();
      this.score += 10;
      this.food = this.spawnFood();
      eventBus.publish(EVENT_TYPES.FOOD_EATEN, { position: newHeadPos });
      eventBus.publish(EVENT_TYPES.SCORE_CHANGED, { score: this.score });
    }

    // Execute all active rules
    this.ruleManager.executeRules(
      {
        snake: this.snake,
        food: this.food,
        score: this.score,
        gridWidth: this.config.gridWidth,
        gridHeight: this.config.gridHeight,
        renderer: this.renderer,
        canvas: this.renderer.canvas,
      },
      effectiveTickThreshold,
    );
  }

  /**
   * Main game loop (called every frame via requestAnimationFrame)
   * @param {number} currentTime - Timestamp from RAF
   */
  gameLoop = (currentTime) => {
    if (!this.isRunning) return;

    // Initialize timing on first frame
    if (this.lastFrameTime === null) {
      this.lastFrameTime = currentTime;
    }

    // Calculate delta time
    const deltaTime = currentTime - this.lastFrameTime;
    this.lastFrameTime = currentTime;

    // Accumulate delta time
    this.tickAccumulator += deltaTime;

    // Update game logic
    this.update();

    // Render — pass deltaTime so floating text particles are ticked correctly
    this.renderer.render(
      this.snake,
      this.food,
      this.score,
      this.ruleManager,
      deltaTime,
    );

    // Continue loop
    requestAnimationFrame(this.gameLoop);
  };

  /**
   * Start the game
   */
  start() {
    this.stateMachine.transition("PLAYING");
    this.isRunning = true;
    this.lastFrameTime = null;
    this.tickAccumulator = 0;
    eventBus.publish(EVENT_TYPES.GAME_START);
    requestAnimationFrame(this.gameLoop);
  }

  /**
   * End the game
   */
  endGame() {
    this.isRunning = false;
    this.stateMachine.transition("GAME_OVER");
    eventBus.publish(EVENT_TYPES.GAME_OVER, { finalScore: this.score });
  }

  /**
   * Toggle pause state
   */
  togglePause() {
    if (this.stateMachine.getState() === "PLAYING") {
      this.stateMachine.transition("PAUSED");
      this.isRunning = false;
      eventBus.publish(EVENT_TYPES.GAME_PAUSE);
    } else if (this.stateMachine.getState() === "PAUSED") {
      this.stateMachine.transition("PLAYING");
      this.isRunning = true;
      this.lastFrameTime = null;
      eventBus.publish(EVENT_TYPES.GAME_RESUME);
      requestAnimationFrame(this.gameLoop);
    }
  }

  /**
   * Reset the game
   */
  reset() {
    this.snake = new Snake(
      Math.floor(this.config.gridWidth / 2),
      Math.floor(this.config.gridHeight / 2),
      3,
    );
    this.food = this.spawnFood();
    this.score = 0;
    this.inputQueue.clear();
    this.ruleManager.clear();
    this.stateMachine.transition("MENU");
    this.renderer.headFlashUntil = 0;
  }

  /**
   * Activate a rule by name
   * @param {string} ruleName - Rule identifier
   */
  activateRule(ruleName) {
    this.ruleManager.activateRule(ruleName, {
      snake: this.snake,
      food: this.food,
      score: this.score,
      gridWidth: this.config.gridWidth,
      gridHeight: this.config.gridHeight,
      renderer: this.renderer,
      canvas: this.renderer.canvas,
    });
  }

  /**
   * Deactivate a rule by name
   * @param {string} ruleName - Rule identifier
   */
  deactivateRule(ruleName) {
    this.ruleManager.deactivateRule(ruleName, {
      snake: this.snake,
      food: this.food,
      score: this.score,
      renderer: this.renderer,
      canvas: this.renderer.canvas,
    });
  }

  /**
   * Get current game state
   * @returns {Object} Game state snapshot
   */
  getState() {
    return {
      state: this.stateMachine.getState(),
      score: this.score,
      snakeLength: this.snake.getLength(),
      snakeHead: this.snake.getHead(),
      food: this.food,
      activeRules: this.ruleManager.getActiveRules().map((r) => r.getName()),
      inputQueueSize: this.inputQueue.getSize(),
    };
  }
}

// =============================================================================
// 8. EXPORT FOR MODULE USAGE
// =============================================================================

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    GameEngine,
    EventBus,
    InputQueue,
    Snake,
    RuleStrategy,
    RuleManager,
    GameRenderer,
    GameStateMachine,
    // Example rules
    ReverseControlsRule,
    InputDelayRule,
    SpeedBurstRule,
    MovingFoodRule,
    // Event types
    EVENT_TYPES,
    // Global event bus
    eventBus,
  };
}
