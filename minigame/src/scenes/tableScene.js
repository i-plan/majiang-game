const defaultGameSession = require('../../game/runtime/gameSession')
const { buildTableView } = require('../../game/selectors/tableView')

const DOUBLE_TAP_INTERVAL = 350

function createTableScene(dependencies) {
  const { manager, timerApi, now } = dependencies
  const gameSession = dependencies.gameSession || defaultGameSession
  const state = {
    view: null,
    selectedTileId: '',
    acting: false
  }

  let aiTimer = null
  let navigationTimer = null
  let unsubscribe = null
  let destroyed = false
  let navigating = false
  let replayRequested = false
  let lastTileTapId = ''
  let lastTileTapAt = 0

  function sync(nextState) {
    Object.assign(state, nextState)
    manager.requestRender()
  }

  function resetPendingDiscardTap() {
    lastTileTapId = ''
    lastTileTapAt = 0
  }

  function clearTimer(timerId) {
    if (timerId) {
      timerApi.clearTimeout(timerId)
    }
  }

  function cleanup() {
    clearTimer(aiTimer)
    clearTimer(navigationTimer)
    aiTimer = null
    navigationTimer = null
    destroyed = true
    resetPendingDiscardTap()

    if (unsubscribe) {
      unsubscribe()
      unsubscribe = null
    }
  }

  function ensureSubscription() {
    if (!unsubscribe) {
      unsubscribe = gameSession.subscribe(() => {
        refreshView()
      })
    }
  }

  function discardSelectedTile(tileId) {
    if (state.acting || !state.view || !state.view.canDiscard || state.view.discardDisabled) {
      return false
    }

    resetPendingDiscardTap()
    sync({
      selectedTileId: '',
      acting: true
    })

    const changed = gameSession.discardHumanTile(tileId)
    if (!changed) {
      refreshView()
    }

    return changed
  }

  function scheduleAiIfNeeded(view) {
    clearTimer(aiTimer)
    aiTimer = null

    if (!view || !view.autoAdvance) {
      return false
    }

    aiTimer = timerApi.setTimeout(() => {
      if (!destroyed) {
        gameSession.advanceAi()
      }
    }, 500)

    return true
  }

  function refreshView() {
    const snapshot = gameSession.getSnapshot()

    if (!snapshot) {
      return false
    }

    let selectedTileId = state.selectedTileId
    const humanTiles = snapshot.seats && snapshot.seats[0] ? snapshot.seats[0].concealedTiles : []

    if (selectedTileId && !humanTiles.some((tile) => tile.id === selectedTileId)) {
      selectedTileId = ''
    }

    const view = buildTableView(snapshot, { selectedTileId })
    resetPendingDiscardTap()
    sync({
      view,
      selectedTileId: view.selectedTileId,
      acting: false
    })

    if (view.roundEnded && !navigating) {
      navigating = true
      clearTimer(aiTimer)
      aiTimer = null
      clearTimer(navigationTimer)
      navigationTimer = timerApi.setTimeout(() => {
        if (!destroyed) {
          manager.goTo('result')
        }
      }, 650)
      return true
    }

    scheduleAiIfNeeded(view)
    return true
  }

  function onTileTap(tileId) {
    const view = state.view

    if (state.acting || !view || !view.canSelectHandTile) {
      return false
    }

    if (view.lockedDiscardTileId && tileId !== view.lockedDiscardTileId) {
      return false
    }

    const currentTime = now()
    const isDoubleTapDiscard = state.selectedTileId === tileId && lastTileTapId === tileId && currentTime - lastTileTapAt <= DOUBLE_TAP_INTERVAL

    if (isDoubleTapDiscard && view.canDiscard && !view.discardDisabled) {
      discardSelectedTile(tileId)
      return true
    }

    const selectedTileId = view.lockedDiscardTileId || tileId
    const nextView = buildTableView(gameSession.getSnapshot(), { selectedTileId })

    lastTileTapId = tileId
    lastTileTapAt = currentTime
    sync({
      selectedTileId: nextView.selectedTileId,
      view: nextView
    })

    return true
  }

  function onActionTap(index) {
    if (state.acting) {
      return false
    }

    const actions = state.view ? state.view.availableActions : []
    const action = actions[index]

    if (!action) {
      return false
    }

    sync({
      selectedTileId: '',
      acting: true
    })

    let changed = false

    if (action.type === 'pass') {
      changed = gameSession.passHumanReaction()
    } else if (state.view.promptType === 'reaction') {
      changed = gameSession.takeHumanReaction(action)
    } else {
      changed = gameSession.takeHumanSelfAction(action)
    }

    if (!changed) {
      refreshView()
    }

    return changed
  }

  return {
    name: 'table',

    enter(options) {
      replayRequested = Boolean(options && options.replay)
      destroyed = false
      navigating = false
      resetPendingDiscardTap()
      ensureSubscription()

      const snapshot = gameSession.getSnapshot()

      if (!snapshot) {
        replayRequested = false
        gameSession.startNewRound()
        return
      }

      if (snapshot.result && replayRequested) {
        replayRequested = false
        gameSession.startNextRound()
        return
      }

      replayRequested = false
      refreshView()
    },

    exit() {
      cleanup()
    },

    handleTarget(target) {
      if (!target) {
        return false
      }

      if (target.kind === 'tile') {
        return onTileTap(target.tileId)
      }

      if (target.kind === 'action') {
        return onActionTap(target.index)
      }

      return false
    },

    getViewModel() {
      return {
        type: 'table',
        view: state.view,
        acting: state.acting
      }
    },

    getState() {
      return Object.assign({}, state)
    },

    cleanup,
    discardSelectedTile,
    onActionTap,
    onTileTap,
    refreshView,
    scheduleAiIfNeeded
  }
}

module.exports = {
  DOUBLE_TAP_INTERVAL,
  createTableScene
}
