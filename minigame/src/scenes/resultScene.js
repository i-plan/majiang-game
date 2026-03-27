const { buildResultView } = require('../../game/selectors/resultView')

function createResultScene(dependencies) {
  const { manager, gameSession } = dependencies
  const state = {
    view: null,
    navigating: false
  }
  let navigating = false

  function sync(nextState) {
    Object.assign(state, nextState)
    manager.requestRender()
  }

  function unlockNavigation() {
    navigating = false
    sync({
      navigating: false
    })
  }

  function loadSnapshot() {
    navigating = false
    const snapshot = gameSession.getSnapshot()

    if (!snapshot || !snapshot.result) {
      manager.goTo('home')
      return false
    }

    sync({
      view: buildResultView(snapshot),
      navigating: false
    })
    return true
  }

  function onReplay() {
    if (navigating) {
      return false
    }

    navigating = true
    sync({
      navigating: true
    })

    const changed = manager.goTo('table', { replay: true })
    if (!changed) {
      unlockNavigation()
      return false
    }

    return true
  }

  function onBackHome() {
    if (navigating) {
      return false
    }

    navigating = true
    sync({
      navigating: true
    })

    const changed = manager.goTo('home')
    if (!changed) {
      unlockNavigation()
      return false
    }

    return true
  }

  return {
    name: 'result',

    enter() {
      loadSnapshot()
    },

    exit() {},

    handleTarget(target) {
      if (!target) {
        return false
      }

      if (target.kind === 'replay') {
        return onReplay()
      }

      if (target.kind === 'home') {
        return onBackHome()
      }

      return false
    },

    getViewModel() {
      return {
        type: 'result',
        view: state.view,
        navigating: state.navigating
      }
    },

    getState() {
      return Object.assign({}, state)
    },

    onReplay,
    onBackHome,
    loadSnapshot
  }
}

module.exports = {
  createResultScene
}
