const rules = require('../config/rules/mvp')
const simpleAi = require('../ai/simpleAi')
const { getSelfActions } = require('../core/actionEvaluator')
const {
  startRound,
  discardTile,
  applySelfAction,
  applyReactionAction,
  passReaction,
  getCurrentReactionPrompt
} = require('../core/stateMachine')

const HUMAN_SEAT = 0

let state = null
const listeners = []

function notify() {
  listeners.slice().forEach((listener) => listener())
}

function touchState() {
  if (state) {
    state.version += 1
  }
}

function emitChange() {
  touchState()
  notify()
}

function getSnapshot() {
  return state ? JSON.parse(JSON.stringify(state)) : null
}

function subscribe(listener) {
  listeners.push(listener)

  return () => {
    const index = listeners.indexOf(listener)
    if (index >= 0) {
      listeners.splice(index, 1)
    }
  }
}

function startNewRound() {
  state = startRound(rules)
  emitChange()
  return getSnapshot()
}

function hasState() {
  return Boolean(state)
}

function discardHumanTile(tileId) {
  if (!state) {
    return false
  }

  const changed = discardTile(state, HUMAN_SEAT, tileId)

  if (changed) {
    emitChange()
  }

  return changed
}

function takeHumanSelfAction(action) {
  if (!state) {
    return false
  }

  const changed = applySelfAction(state, HUMAN_SEAT, action)

  if (changed) {
    emitChange()
  }

  return changed
}

function takeHumanReaction(action) {
  if (!state) {
    return false
  }

  const changed = applyReactionAction(state, HUMAN_SEAT, action)

  if (changed) {
    emitChange()
  }

  return changed
}

function passHumanReaction() {
  if (!state) {
    return false
  }

  const changed = passReaction(state, HUMAN_SEAT)

  if (changed) {
    emitChange()
  }

  return changed
}

function advanceAi() {
  if (!state || state.phase === 'ended') {
    return false
  }

  let changed = false
  let safety = 0

  while (state && state.phase !== 'ended' && safety < 50) {
    safety += 1

    const reactionPrompt = getCurrentReactionPrompt(state)

    if (reactionPrompt) {
      if (reactionPrompt.seatId === HUMAN_SEAT) {
        break
      }

      const reactionAction = simpleAi.chooseReactionAction(state, reactionPrompt.seatId, reactionPrompt.actions)

      if (reactionAction) {
        applyReactionAction(state, reactionPrompt.seatId, reactionAction)
      } else {
        passReaction(state, reactionPrompt.seatId)
      }

      changed = true
      continue
    }

    if (state.activeSeat === HUMAN_SEAT) {
      break
    }

    const selfActions = getSelfActions(state, state.activeSeat)
    const selfAction = simpleAi.chooseTurnAction(state, state.activeSeat, selfActions)

    if (selfAction) {
      applySelfAction(state, state.activeSeat, selfAction)
      changed = true
      continue
    }

    const discardTileId = simpleAi.chooseDiscardTile(state, state.activeSeat)
    if (!discardTileId) {
      break
    }

    discardTile(state, state.activeSeat, discardTileId)
    changed = true
  }

  if (changed) {
    emitChange()
  }

  return changed
}

module.exports = {
  HUMAN_SEAT,
  advanceAi,
  discardHumanTile,
  getCurrentReactionPrompt,
  getSnapshot,
  hasState,
  passHumanReaction,
  startNewRound,
  subscribe,
  takeHumanReaction,
  takeHumanSelfAction
}
