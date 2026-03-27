# AGENTS.md - Development Guide for AI Agents

This file provides development guidelines and conventions for agents working on this Quanzhou Mahjong (泉州麻将) WeChat mini-game project.

## Project Overview

- **Project Type**: Native WeChat Mini-game + Mini-program
- **Tech Stack**: JavaScript + CommonJS (no ES modules, no build chains)
- **Main Directory**: `minigame/` (current active version)
- **Legacy Directory**: `miniprogram/` (retained for regression reference)
- **Scope**: Single-player demo with 3 AI players, no backend/online multiplayer

## Commands

### Running Tests

```bash
# Run all tests (102 minigame tests + 46 miniprogram page tests)
npm test

# Run by category
npm run test:core      # Core game logic (rules, action-evaluator, settlement, game-session)
npm run test:view      # View layer tests
npm run test:scene     # Scene management tests
npm run test:smoke    # End-to-end smoke tests
npm run test:ai       # AI behavior tests
npm run test:miniprogram:page  # Mini-program page regression tests

# Run single test file
node --test --test-concurrency=1 tests/minigame/core/rules.test.js
node --test --test-concurrency=1 tests/minigame/view/table-view.test.js
```

Note: `--test-concurrency=1` is required to ensure deterministic test execution order.

### Manual Testing

- Use WeChat Developer Tools to test in real device/simulator
- Open `project.config.json` (compileType: "minigame") for小游戏 testing
- Open with compileType: "miniprogram" for小程序 page regression

## Directory Structure

```
minigame/
├── game/
│   ├── core/          # Game logic (stateMachine, actionEvaluator, winChecker, settlement)
│   ├── config/        # tileCatalog, rules
│   ├── runtime/       # gameSession
│   ├── selectors/     # tableView, resultView
│   └── ai/            # simpleAi
├── src/
│   ├── scenes/        # homeScene, tableScene, resultScene
│   ├── sceneManager.js
│   └── ... (game bootstrap, renderer, layout, touch-router)
├── pages/
│   ├── home/
│   ├── table/
│   └── result/
└── ...

tests/
├── minigame/
│   ├── core/
│   ├── scene/
│   ├── view/
│   └── smoke/
└── miniprogram/
    └── page/
```

## Code Style Guidelines

### General Principles

- **Page Separation**: Pages handle only display and interaction; game rules go in pure logic layer (`minigame/game/`)
- **No Backend**: Do not add backend or online multiplayer features
- **No Build Chains**: Use native WeChat mini-game APIs, no Webpack/Rollup
- **No Secrets**: Never commit secrets, keys, or credentials

### Imports

- Use CommonJS `require()` syntax
- Relative paths for internal modules:
  ```javascript
  const { sortTiles } = require('../config/tileCatalog')
  const { evaluateWin } = require('./winChecker')
  ```
- Avoid absolute paths; use relative imports from project root

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files | camelCase | `stateMachine.js`, `gameSession.js` |
| Functions | camelCase | `sortTiles()`, `evaluateWin()` |
| Classes | PascalCase | `GameSession`, `StateMachine` |
| Constants | UPPER_SNAKE_CASE | `WINDS`, `SEAT_LABELS` |
| Seat Labels | Chinese | `['你', '右家', '对家', '左家']` |

### State Management

- State machine uses plain JavaScript objects
- Immutable updates: use `Object.assign()` or spread operator
- Log entries limited to 18 items: `state.log = state.log.slice(0, 18)`

### Error Handling

- Use assertions in tests:
  ```javascript
  assert.notEqual(index, -1, `缺少测试用牌: ${description}`)
  assert.strictEqual(actual, expected)
  ```
- In production code, handle gracefully with try-catch for async operations
- Validate inputs at function boundaries

### Types

- Use JSDoc comments for complex types:
  ```javascript
  /**
   * @typedef {Object} Seat
   * @property {number} seatId
   * @property {string} wind
   * @property {boolean} isHuman
   * @property {Tile[]} concealedTiles
   * @property {Meld[]} melds
   * @property {Tile[]} flowers
   * @property {number} score
   */
  ```
- Keep type definitions simple; avoid TypeScript or Flow

### Test Writing

- Use Node.js built-in `node:test` (no external test frameworks)
- Test file naming: `*.test.js`
- Use absolute `require` paths for module imports:
  ```javascript
  const path = require('node:path')
  const ROOT = path.resolve(__dirname, '../../..')
  const rulesPath = path.join(ROOT, 'minigame', 'game', 'config', 'rules', 'mvp')
  ```
- Test structure: `test('description', () => { ... })`
- Assertions: `assert.strictEqual()`, `assert.notEqual()`, `assert.deepStrictEqual()`

### Game Logic Patterns

1. **Seat Iteration**: Use modulo for circular seat order
   ```javascript
   function nextSeatId(state, seatId) {
     return (seatId + 1) % state.seats.length
   }
   ```

2. **Action Priority**: Define in `rules.claimPriority`
   ```javascript
   function getPriority(state, type) {
     return state.rules.claimPriority[type] || 0
   }
   ```

3. **State Transitions**: Use `phase` and `turnStage` to track game progress

### UI/View Patterns

- View selectors return pure data objects for rendering
- Scene management handles page transitions
- Touch events go through `touchRouter` for routing
- Layout calculations in `layout.js`, rendering in `renderer.js`

### Key Files Reference

- **Core Logic**: `minigame/game/core/stateMachine.js`
- **Action Evaluation**: `minigame/game/core/actionEvaluator.js`
- **Win Detection**: `minigame/game/core/winChecker.js`
- **Settlement**: `minigame/game/core/settlement.js`
- **Runtime**: `minigame/game/runtime/gameSession.js`
- **View Selectors**: `minigame/game/selectors/tableView.js`, `resultView.js`
- **Scenes**: `minigame/src/scenes/tableScene.js`

## Common Workflows

### Adding a New Rule

1. Implement rule in `minigame/game/core/` (stateMachine, actionEvaluator, winChecker)
2. Add tests in `tests/minigame/core/`
3. Update view selectors if UI changes needed
4. Verify with `npm run test:core`

### Adding a New UI Feature

1. Add view logic in `minigame/game/selectors/`
2. Update scene in `minigame/src/scenes/`
3. Add view tests in `tests/minigame/view/`
4. Verify with `npm run test:view`

### Fixing a Bug

1. Write a failing test first
2. Fix the code
3. Verify test passes
4. Run full regression: `npm test`

## Important Notes

- **Dual Codebase**: Both `minigame/game/` and `miniprogram/game/` exist. For new features, modify `minigame/` first, then sync if needed
- **Tian Ting**: Current implementation is conservative; may need adjustment if full rules are obtained
- **游金/双游/三游**: Already implemented with proper locking for lastDrawTile
- **Test Stability**: Always run with `--test-concurrency=1` for deterministic results
