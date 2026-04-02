const rules = require('../../game/config/rules/mvp')

function buildFeatureTags() {
  return [
    '144 张',
    `庄 ${rules.dealing.dealerHandSize} / 闲 ${rules.dealing.idleHandSize}`,
    rules.gold.enabled && rules.gold.wildcard ? '开金百搭' : '不开金',
    '吃碰杠胡'
  ]
}

function buildConnectedItems(state) {
  const bankerBaseSummary = state.bankerBaseOptions
    .map((item) => item.value)
    .slice()
    .sort((left, right) => right - left)
    .join(' / ')

  return [
    '1. 1 名玩家 + 3 个 AI，本地单机场景',
    `2. 开局选庄底 ${bankerBaseSummary}，按局续分`,
    '3. 计入花牌、金牌、暗刻、碰牌、各类杠和八花',
    '4. 结果页展示主结算与未胡三家番差'
  ]
}

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
        title: '伤心麻一麻',
        subtitle: '原生微信小游戏 · 本地课分玩法',
        featureTags: buildFeatureTags(),
        infoTitle: '当前已接入',
        infoItems: buildConnectedItems(state)
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
