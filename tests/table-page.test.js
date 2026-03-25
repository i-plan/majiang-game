const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const rules = require(path.join(ROOT, 'game', 'config', 'rules', 'mvp'))
const { startRound } = require(path.join(ROOT, 'game', 'core', 'stateMachine'))
const gameSession = require(path.join(ROOT, 'game', 'runtime', 'gameSession'))

const tablePagePath = path.join(ROOT, 'pages', 'table', 'table.js')

function loadTablePageDefinition() {
  const resolvedTablePagePath = require.resolve(tablePagePath)
  delete require.cache[resolvedTablePagePath]

  const originalPage = global.Page
  const originalWx = global.wx
  let capturedDefinition = null

  global.Page = (definition) => {
    capturedDefinition = definition
  }
  global.wx = {
    redirectTo() {},
    reLaunch() {}
  }

  require(resolvedTablePagePath)

  global.Page = originalPage
  global.wx = originalWx

  return capturedDefinition
}

function createPageInstance() {
  const definition = loadTablePageDefinition()
  const page = {
    data: JSON.parse(JSON.stringify(definition.data)),
    setData(patch) {
      this.data = Object.assign({}, this.data, patch)
    }
  }

  Object.keys(definition).forEach((key) => {
    if (typeof definition[key] === 'function') {
      page[key] = definition[key].bind(page)
    }
  })

  return page
}

test('table page ignores discard and action taps while acting', () => {
  const page = createPageInstance()
  let discardCalls = 0
  let passCalls = 0

  const originalDiscardHumanTile = gameSession.discardHumanTile
  const originalPassHumanReaction = gameSession.passHumanReaction

  gameSession.discardHumanTile = () => {
    discardCalls += 1
    return true
  }
  gameSession.passHumanReaction = () => {
    passCalls += 1
    return true
  }

  try {
    page.data = {
      view: {
        canDiscard: true,
        discardDisabled: false,
        availableActions: [{ type: 'pass', label: '过' }],
        promptType: 'reaction'
      },
      selectedTileId: 'tile-1',
      acting: true
    }

    page.onDiscardTap()
    page.onActionTap({ detail: { index: 0 } })

    assert.equal(discardCalls, 0)
    assert.equal(passCalls, 0)
  } finally {
    gameSession.discardHumanTile = originalDiscardHumanTile
    gameSession.passHumanReaction = originalPassHumanReaction
  }
})

test('table page releases the acting lock when a human action does not change state', () => {
  const page = createPageInstance()
  const originalTakeHumanSelfAction = gameSession.takeHumanSelfAction

  gameSession.takeHumanSelfAction = () => false

  try {
    page.data = {
      view: {
        availableActions: [{ type: 'hu', label: '胡' }],
        promptType: 'self'
      },
      selectedTileId: 'tile-1',
      acting: false
    }

    page.refreshView = function () {
      this.setData({
        acting: false,
        view: this.data.view
      })
      this.refreshed = true
    }

    page.onActionTap({ detail: { index: 0 } })

    assert.equal(page.refreshed, true)
    assert.equal(page.data.acting, false)
  } finally {
    gameSession.takeHumanSelfAction = originalTakeHumanSelfAction
  }
})

test('table page refreshView clears acting after a state update arrives', () => {
  const page = createPageInstance()
  const originalGetSnapshot = gameSession.getSnapshot

  gameSession.getSnapshot = () => startRound(rules, {
    dealerSeat: 0,
    roundIndex: 1,
    bankerBase: 10
  })

  try {
    page.data.acting = true
    page.refreshView()

    assert.equal(page.data.acting, false)
    assert.ok(page.data.view)
  } finally {
    gameSession.getSnapshot = originalGetSnapshot
  }
})

test('table page starts the next round only when replay is explicitly requested', () => {
  const page = createPageInstance()
  const originalSubscribe = gameSession.subscribe
  const originalGetSnapshot = gameSession.getSnapshot
  const originalStartNextRound = gameSession.startNextRound
  const originalStartNewRound = gameSession.startNewRound

  let startNextRoundCalls = 0
  let startNewRoundCalls = 0

  gameSession.subscribe = () => () => {}
  gameSession.getSnapshot = () => ({ result: { type: 'drawGame' } })
  gameSession.startNextRound = () => {
    startNextRoundCalls += 1
  }
  gameSession.startNewRound = () => {
    startNewRoundCalls += 1
  }

  try {
    page.refreshView = function () {
      this.refreshed = true
    }

    page.onLoad({ replay: '1' })
    page.onShow()

    assert.equal(startNextRoundCalls, 1)
    assert.equal(startNewRoundCalls, 0)
    assert.equal(page.refreshed, undefined)
  } finally {
    gameSession.subscribe = originalSubscribe
    gameSession.getSnapshot = originalGetSnapshot
    gameSession.startNextRound = originalStartNextRound
    gameSession.startNewRound = originalStartNewRound
  }
})

test('table page keeps the settled-state flow when replay is not requested', () => {
  const page = createPageInstance()
  const originalSubscribe = gameSession.subscribe
  const originalGetSnapshot = gameSession.getSnapshot
  const originalStartNextRound = gameSession.startNextRound

  let startNextRoundCalls = 0

  gameSession.subscribe = () => () => {}
  gameSession.getSnapshot = () => ({ result: { type: 'drawGame' } })
  gameSession.startNextRound = () => {
    startNextRoundCalls += 1
  }

  try {
    page.refreshView = function () {
      this.refreshed = true
    }

    page.onShow()

    assert.equal(startNextRoundCalls, 0)
    assert.equal(page.refreshed, true)
  } finally {
    gameSession.subscribe = originalSubscribe
    gameSession.getSnapshot = originalGetSnapshot
    gameSession.startNextRound = originalStartNextRound
  }
})
