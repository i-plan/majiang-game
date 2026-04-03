# AGENTS.md - Development Guide for AI Agents

This file provides development guidelines and conventions for agents working on this Quanzhou Mahjong (泉州麻将) WeChat mini-game project.

## Project Overview

- **Project Type**: Native WeChat Mini-game + Mini-program
- **Tech Stack**: JavaScript + CommonJS (no ES modules, no build chains)
- **Main Directory**: `minigame/` (current active version)
- **Legacy Directory**: `miniprogram/` (retained for reference)
- **Scope**: Single-player demo with 3 AI players, no backend/online multiplayer
- **Validation Policy**: This repo no longer keeps automated test assets or `npm test` scripts. Prefer manual verification in WeChat Developer Tools and do not add test files or test scripts unless the user explicitly asks to restore them.

## Commands

### Manual Verification

- Use WeChat Developer Tools to verify gameplay flows in simulator or on device
- Open `project.config.json` with `compileType: "minigame"` for the active小游戏 version
- `miniprogram/` is retained only for historical reference and preserved page behavior checks when explicitly needed

## Directory Structure

```text
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
```

## Code Style Guidelines

### General Principles

- **Page Separation**: Pages handle only display and interaction; game rules go in pure logic layer (`minigame/game/`)
- **No Backend**: Do not add backend or online multiplayer features
- **No Build Chains**: Use native WeChat mini-game APIs, no Webpack/Rollup
- **No Secrets**: Never commit secrets, keys, or credentials
- **Manual Verification First**: Do not proactively add automated tests, test scaffolds, or test scripts; validate affected flows manually by default

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

- In production code, handle gracefully with try-catch for async operations when needed
- Validate inputs at function boundaries
- Keep runtime failure paths simple and explicit

### Types

- Use JSDoc comments for complex types when they help clarify data shape
- Keep type definitions simple; avoid TypeScript or Flow

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

1. Implement the rule in `minigame/game/core/`
2. Update selectors or scene glue if UI changes are needed
3. Verify the affected gameplay flow manually in WeChat Developer Tools

### Adding a New UI Feature

1. Add view logic in `minigame/game/selectors/`
2. Update scene in `minigame/src/scenes/`
3. Verify the related page flow manually in WeChat Developer Tools

### Fixing a Bug

1. Reproduce the bug with the smallest possible manual path
2. Fix the code in the main `minigame/` implementation
3. Re-verify the affected flow and nearby transitions manually

## Important Notes

- **Dual Codebase**: Both `minigame/game/` and `miniprogram/game/` exist. For new features, modify `minigame/` first, then sync only if explicitly required
- **Tian Ting**: Current implementation is conservative; may need adjustment if full rules are obtained
- **游金/双游/三游**: Already implemented with proper locking for `lastDrawTile`
