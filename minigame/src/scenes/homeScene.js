const rules = require('../../game/config/rules/mvp')

function createHomeScene(dependencies) {
  const { manager, gameSession } = dependencies
  const state = {
    bankerBaseOptions: rules.match.bankerBaseOptions.map((value) => ({
      value,
      label: `庄底 ${value}`
    })),
    selectedBankerBase: rules.match.defaultBankerBase,
    starting: false
  }

  function sync(nextState) {
    Object.assign(state, nextState)
    manager.requestRender()
  }

  function selectBankerBase(value) {
    if (state.starting) {
      return false
    }

    sync({
      selectedBankerBase: Number(value)
    })
    return true
  }

  function startGame() {
    if (state.starting) {
      return false
    }

    sync({
      starting: true
    })

    gameSession.startNewMatch({
      bankerBase: state.selectedBankerBase
    })

    const changed = manager.goTo('table')
    if (!changed) {
      sync({
        starting: false
      })
      return false
    }

    return true
  }

  return {
    name: 'home',

    enter() {
      sync({
        starting: false
      })
    },

    exit() {},

    handleTarget(target) {
      if (!target) {
        return false
      }

      if (target.kind === 'bankerBase') {
        return selectBankerBase(target.value)
      }

      if (target.kind === 'startGame') {
        return startGame()
      }

      return false
    },

    getViewModel() {
      return Object.assign({
        type: 'home',
        title: '泉州麻将',
        subtitle: '1 名玩家 + 3 个 AI 单机演示'
      }, state)
    },

    getState() {
      return Object.assign({}, state)
    },

    selectBankerBase,
    startGame
  }
}

module.exports = {
  createHomeScene
}
