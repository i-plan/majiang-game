const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '../../..')
const gameModulePath = path.join(ROOT, 'minigame', 'game.js')

function loadGameModule(globalWx) {
  const resolvedPath = require.resolve(gameModulePath)
  delete require.cache[resolvedPath]

  const originalWx = global.wx
  if (typeof globalWx === 'undefined') {
    delete global.wx
  } else {
    global.wx = globalWx
  }

  const loadedModule = require(resolvedPath)

  return {
    gameModule: loadedModule,
    restore() {
      delete require.cache[resolvedPath]
      if (typeof originalWx === 'undefined') {
        delete global.wx
      } else {
        global.wx = originalWx
      }
    }
  }
}

test('bootGame wires wx touch events to the created scene manager and re-renders on show', () => {
  let touchStartHandler = null
  let showHandler = null
  const calls = {
    handleTarget: [],
    render: []
  }
  const wxApi = {
    createCanvas() {
      return {
        getContext() {
          return null
        }
      }
    },
    onTouchStart(handler) {
      touchStartHandler = handler
    },
    onShow(handler) {
      showHandler = handler
    }
  }
  const renderer = {
    render(viewModel) {
      calls.render.push(viewModel)
      return [{
        id: 'start',
        kind: 'startGame',
        left: 0,
        top: 0,
        width: 30,
        height: 30
      }]
    }
  }
  const scenes = {
    home() {
      return {
        enter() {},
        exit() {},
        handleTarget(target, point) {
          calls.handleTarget.push({ target, point })
          return true
        },
        getViewModel() {
          return {
            type: 'home',
            title: '伤心麻一麻',
            subtitle: '1 名玩家 + 3 个 AI 单机演示',
            bankerBaseOptions: [],
            selectedBankerBase: 2,
            starting: false
          }
        }
      }
    }
  }

  const { gameModule, restore } = loadGameModule()

  try {
    const manager = gameModule.bootGame({
      wxApi,
      renderer,
      scenes
    })

    assert.equal(gameModule.getManager(), manager)
    assert.equal(manager.getCurrentSceneName(), 'home')
    assert.ok(typeof touchStartHandler === 'function')
    assert.ok(typeof showHandler === 'function')

    touchStartHandler({
      changedTouches: [{ clientX: 10, clientY: 12 }]
    })
    showHandler()

    assert.deepEqual(calls.handleTarget, [{
      target: {
        id: 'start',
        kind: 'startGame',
        left: 0,
        top: 0,
        width: 30,
        height: 30
      },
      point: { x: 10, y: 12 }
    }])
    assert.ok(calls.render.length >= 2)
  } finally {
    restore()
  }
})

test('bootGame returns the existing manager when called repeatedly within the same runtime', () => {
  const renderer = {
    render() {
      return []
    }
  }
  const scenes = {
    home() {
      return {
        enter() {},
        exit() {},
        handleTarget() {
          return false
        },
        getViewModel() {
          return { type: 'home', title: '伤心麻一麻', subtitle: '', bankerBaseOptions: [], selectedBankerBase: 2, starting: false }
        }
      }
    }
  }

  const { gameModule, restore } = loadGameModule()

  try {
    const firstManager = gameModule.bootGame({ renderer, scenes })
    const secondManager = gameModule.bootGame({ renderer: { render() { return [{ id: 'ignored' }] } }, scenes: {} })

    assert.equal(firstManager, secondManager)
    assert.equal(gameModule.getManager(), firstManager)
  } finally {
    restore()
  }
})
