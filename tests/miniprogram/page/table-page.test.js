const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '../../..')
const rules = require(path.join(ROOT, 'miniprogram', 'game', 'config', 'rules', 'mvp'))
const { buildRoundResult } = require(path.join(ROOT, 'miniprogram', 'game', 'core', 'settlement'))
const { startRound } = require(path.join(ROOT, 'miniprogram', 'game', 'core', 'stateMachine'))
const gameSession = require(path.join(ROOT, 'miniprogram', 'game', 'runtime', 'gameSession'))

const actionEvaluatorPath = path.join(ROOT, 'miniprogram', 'game', 'core', 'actionEvaluator')
const tableViewPath = path.join(ROOT, 'miniprogram', 'game', 'selectors', 'tableView')
const tablePagePath = path.join(ROOT, 'miniprogram', 'pages', 'table', 'table.js')
const tablePageWxmlPath = path.join(ROOT, 'miniprogram', 'pages', 'table', 'table.wxml')
const seatSummaryWxmlPath = path.join(ROOT, 'miniprogram', 'components', 'seat-summary', 'index.wxml')
const actionPanelWxmlPath = path.join(ROOT, 'miniprogram', 'components', 'action-panel', 'index.wxml')
const actionPanelPath = path.join(ROOT, 'miniprogram', 'components', 'action-panel', 'index.js')

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

function loadTablePageDefinitionWithPatchedActionEvaluator(overrides) {
  const resolvedActionEvaluatorPath = require.resolve(actionEvaluatorPath)
  const resolvedTableViewPath = require.resolve(tableViewPath)
  const resolvedTablePagePath = require.resolve(tablePagePath)

  delete require.cache[resolvedTablePagePath]
  delete require.cache[resolvedTableViewPath]
  delete require.cache[resolvedActionEvaluatorPath]

  const actionEvaluator = require(resolvedActionEvaluatorPath)
  const originalImplementations = {
    getSelfActions: actionEvaluator.getSelfActions,
    getCurrentReactionPrompt: actionEvaluator.getCurrentReactionPrompt
  }

  Object.keys(overrides || {}).forEach((key) => {
    actionEvaluator[key] = overrides[key]
  })

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

  try {
    require(resolvedTablePagePath)
  } finally {
    global.Page = originalPage
    global.wx = originalWx
  }

  return {
    definition: capturedDefinition,
    restore() {
      actionEvaluator.getSelfActions = originalImplementations.getSelfActions
      actionEvaluator.getCurrentReactionPrompt = originalImplementations.getCurrentReactionPrompt
      delete require.cache[resolvedTablePagePath]
      delete require.cache[resolvedTableViewPath]
      delete require.cache[resolvedActionEvaluatorPath]
    }
  }
}

function createPageInstanceFromDefinition(definition) {
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

function createPageInstance() {
  return createPageInstanceFromDefinition(loadTablePageDefinition())
}

function createPageInstanceWithPatchedActionEvaluator(overrides) {
  const { definition, restore } = loadTablePageDefinitionWithPatchedActionEvaluator(overrides)

  return {
    page: createPageInstanceFromDefinition(definition),
    restore
  }
}

function readTableTemplate() {
  return fs.readFileSync(tablePageWxmlPath, 'utf8')
}

function readSeatSummaryTemplate() {
  return fs.readFileSync(seatSummaryWxmlPath, 'utf8')
}

function readActionPanelTemplate() {
  return fs.readFileSync(actionPanelWxmlPath, 'utf8')
}

function getDifferentTileId(seat, excludedTileId) {
  const tile = seat.concealedTiles.find((item) => item.id !== excludedTileId)
  assert.ok(tile, '测试局面至少要有一张非 lastDrawTile 的手牌')
  return tile.id
}

function loadActionPanelDefinition() {
  const resolvedActionPanelPath = require.resolve(actionPanelPath)
  delete require.cache[resolvedActionPanelPath]

  const originalComponent = global.Component
  let capturedDefinition = null

  global.Component = (definition) => {
    capturedDefinition = definition
  }

  try {
    require(resolvedActionPanelPath)
  } finally {
    global.Component = originalComponent
  }

  return capturedDefinition
}

function createActionPanelInstance(properties) {
  const definition = loadActionPanelDefinition()
  const component = {
    properties: Object.assign({
      actions: [],
      disabled: false
    }, properties),
    emittedEvents: [],
    triggerEvent(name, detail) {
      this.emittedEvents.push({ name, detail })
    }
  }

  Object.keys(definition.methods).forEach((key) => {
    if (typeof definition.methods[key] === 'function') {
      component[key] = definition.methods[key].bind(component)
    }
  })

  return component
}

test('table page ignores tile and action taps while acting', () => {
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
        canSelectHandTile: true,
        canDiscard: true,
        discardDisabled: false,
        availableActions: [{ type: 'pass', label: '过' }],
        promptType: 'reaction'
      },
      selectedTileId: 'tile-1',
      acting: true
    }

    page.onTileTap({
      detail: { tileId: 'tile-1' },
      currentTarget: {
        dataset: {
          tileId: 'tile-1'
        }
      }
    })
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

test('table page refreshView loads a real snapshot into page view data and clears stale selection', () => {
  const page = createPageInstance()
  const originalGetSnapshot = gameSession.getSnapshot
  const snapshot = startRound(rules, {
    dealerSeat: 0,
    roundIndex: 2,
    bankerBase: 10
  })

  snapshot.dealerSeat = 2
  snapshot.goldTileLabel = '白板'
  snapshot.goldDice = [3, 4]
  snapshot.goldDiceTotal = 7
  snapshot.seats[2].youJinLevel = 2
  snapshot.seats[1].tianTingActive = true
  snapshot.log = [
    { id: 'log-1', text: '测试日志 1' },
    { id: 'log-2', text: '测试日志 2' }
  ]

  gameSession.getSnapshot = () => snapshot

  try {
    page.data.selectedTileId = 'missing-tile'
    page.data.acting = true

    page.refreshView()

    assert.equal(page.data.acting, false)
    assert.equal(page.data.selectedTileId, '')
    assert.equal(page.data.view.roundLabel, '第 2 局')
    assert.equal(page.data.view.dealerLabel, '对家')
    assert.equal(page.data.view.goldTileLabel, '白板')
    assert.equal(page.data.view.goldDiceLabel, '3 + 4 = 7')
    assert.equal(page.data.view.topSeat.isDealer, true)
    assert.equal(page.data.view.topSeat.specialStateLabel, '双游')
    assert.equal(page.data.view.rightSeat.specialStateLabel, '天听')
    assert.deepEqual(page.data.view.recentLogs.map((item) => item.id), ['log-1', 'log-2'])
  } finally {
    gameSession.getSnapshot = originalGetSnapshot
  }
})

test('table page onTileTap selects first and discards only after a quick second tap on the same tile', () => {
  const page = createPageInstance()
  const originalGetSnapshot = gameSession.getSnapshot
  const originalDiscardHumanTile = gameSession.discardHumanTile
  const originalDateNow = Date.now
  const snapshot = startRound(rules, {
    dealerSeat: 0,
    roundIndex: 1,
    bankerBase: 10
  })
  const tileId = getDifferentTileId(snapshot.seats[0], snapshot.lastDrawTile.id)
  const discardCalls = []
  let now = 1000

  gameSession.getSnapshot = () => snapshot
  gameSession.discardHumanTile = (discardTileId) => {
    discardCalls.push(discardTileId)
    return true
  }
  Date.now = () => now

  try {
    page.refreshView()

    page.onTileTap({
      detail: { tileId },
      currentTarget: {
        dataset: {
          tileId
        }
      }
    })

    assert.equal(page.data.selectedTileId, tileId)
    assert.equal(page.data.view.selectedTileId, tileId)
    assert.equal(page.data.view.discardDisabled, false)
    assert.deepEqual(discardCalls, [])

    now = 1500
    page.onTileTap({
      detail: { tileId },
      currentTarget: {
        dataset: {
          tileId
        }
      }
    })

    assert.equal(page.data.selectedTileId, tileId)
    assert.equal(page.data.view.selectedTileId, tileId)
    assert.equal(page.data.acting, false)
    assert.deepEqual(discardCalls, [])

    now = 1700
    page.onTileTap({
      detail: { tileId },
      currentTarget: {
        dataset: {
          tileId
        }
      }
    })

    assert.deepEqual(discardCalls, [tileId])
    assert.equal(page.data.selectedTileId, '')
    assert.equal(page.data.acting, true)
  } finally {
    gameSession.getSnapshot = originalGetSnapshot
    gameSession.discardHumanTile = originalDiscardHumanTile
    Date.now = originalDateNow
  }
})

test('table page onTileTap ignores non-lastDrawTile taps when discard is locked by youJin', () => {
  const page = createPageInstance()
  const originalGetSnapshot = gameSession.getSnapshot
  const snapshot = startRound(rules, {
    dealerSeat: 0,
    roundIndex: 1,
    bankerBase: 10
  })
  const blockedTileId = getDifferentTileId(snapshot.seats[0], snapshot.lastDrawTile.id)

  snapshot.seats[0].youJinLevel = 1
  gameSession.getSnapshot = () => snapshot

  try {
    page.refreshView()

    assert.equal(page.data.selectedTileId, snapshot.lastDrawTile.id)
    assert.equal(page.data.view.lockedDiscardTileId, snapshot.lastDrawTile.id)

    page.onTileTap({
      detail: { tileId: blockedTileId },
      currentTarget: {
        dataset: {
          tileId: blockedTileId
        }
      }
    })

    assert.equal(page.data.selectedTileId, snapshot.lastDrawTile.id)
    assert.equal(page.data.view.selectedTileId, snapshot.lastDrawTile.id)
  } finally {
    gameSession.getSnapshot = originalGetSnapshot
  }
})

test('table page onTileTap still requires a quick second tap before discarding a locked lastDrawTile', () => {
  const page = createPageInstance()
  const originalGetSnapshot = gameSession.getSnapshot
  const originalDiscardHumanTile = gameSession.discardHumanTile
  const originalDateNow = Date.now
  const snapshot = startRound(rules, {
    dealerSeat: 0,
    roundIndex: 1,
    bankerBase: 10
  })
  const discardCalls = []
  let now = 2000

  snapshot.seats[0].youJinLevel = 1
  gameSession.getSnapshot = () => snapshot
  gameSession.discardHumanTile = (tileId) => {
    discardCalls.push(tileId)
    return true
  }
  Date.now = () => now

  try {
    page.refreshView()

    page.onTileTap({
      detail: { tileId: snapshot.lastDrawTile.id },
      currentTarget: {
        dataset: {
          tileId: snapshot.lastDrawTile.id
        }
      }
    })

    assert.deepEqual(discardCalls, [])
    assert.equal(page.data.selectedTileId, snapshot.lastDrawTile.id)
    assert.equal(page.data.acting, false)

    now = 2200
    page.onTileTap({
      detail: { tileId: snapshot.lastDrawTile.id },
      currentTarget: {
        dataset: {
          tileId: snapshot.lastDrawTile.id
        }
      }
    })

    assert.deepEqual(discardCalls, [snapshot.lastDrawTile.id])
    assert.equal(page.data.selectedTileId, '')
    assert.equal(page.data.acting, true)
  } finally {
    gameSession.getSnapshot = originalGetSnapshot
    gameSession.discardHumanTile = originalDiscardHumanTile
    Date.now = originalDateNow
  }
})

test('table page refreshView schedules ai advance when selector marks an ai turn as autoAdvance', () => {
  const page = createPageInstance()
  const originalGetSnapshot = gameSession.getSnapshot
  const originalAdvanceAi = gameSession.advanceAi
  const originalSetTimeout = global.setTimeout
  const originalClearTimeout = global.clearTimeout
  const snapshot = startRound(rules, {
    dealerSeat: 0,
    roundIndex: 2,
    bankerBase: 10
  })

  let scheduledDelay = 0
  let scheduledHandler = null
  let clearedTimers = 0
  let advanceAiCalls = 0

  snapshot.activeSeat = 2
  snapshot.phase = 'turn'
  gameSession.getSnapshot = () => snapshot
  gameSession.advanceAi = () => {
    advanceAiCalls += 1
  }
  global.setTimeout = (handler, delay) => {
    scheduledHandler = handler
    scheduledDelay = delay
    return 64
  }
  global.clearTimeout = () => {
    clearedTimers += 1
  }

  try {
    page.refreshView()

    assert.equal(page.data.view.activeLabel, '对家')
    assert.equal(page.data.view.autoAdvance, true)
    assert.equal(scheduledDelay, 500)
    assert.equal(clearedTimers, 1)
    assert.ok(scheduledHandler)

    scheduledHandler()

    assert.equal(advanceAiCalls, 1)
  } finally {
    gameSession.getSnapshot = originalGetSnapshot
    gameSession.advanceAi = originalAdvanceAi
    global.setTimeout = originalSetTimeout
    global.clearTimeout = originalClearTimeout
  }
})

test('table page refreshView schedules ai advance when selector exposes an ai reaction prompt', () => {
  const { page, restore } = createPageInstanceWithPatchedActionEvaluator({
    getCurrentReactionPrompt: () => ({
      seatId: 2,
      discardTile: { label: '5万' },
      actions: [{ type: 'peng', label: '碰' }]
    }),
    getSelfActions: () => []
  })
  const originalGetSnapshot = gameSession.getSnapshot
  const originalAdvanceAi = gameSession.advanceAi
  const originalSetTimeout = global.setTimeout
  const originalClearTimeout = global.clearTimeout
  const snapshot = startRound(rules, {
    dealerSeat: 0,
    roundIndex: 2,
    bankerBase: 10
  })

  let scheduledDelay = 0
  let scheduledHandler = null
  let advanceAiCalls = 0

  snapshot.phase = 'reaction'
  gameSession.getSnapshot = () => snapshot
  gameSession.advanceAi = () => {
    advanceAiCalls += 1
  }
  global.setTimeout = (handler, delay) => {
    scheduledHandler = handler
    scheduledDelay = delay
    return 65
  }
  global.clearTimeout = () => {}

  try {
    page.refreshView()

    assert.equal(page.data.view.promptType, 'self')
    assert.equal(page.data.view.autoAdvance, true)
    assert.deepEqual(page.data.view.availableActions, [])
    assert.match(page.data.view.statusText, /对家 正在响应 5万/)
    assert.equal(scheduledDelay, 500)
    assert.ok(scheduledHandler)

    scheduledHandler()

    assert.equal(advanceAiCalls, 1)
  } finally {
    restore()
    gameSession.getSnapshot = originalGetSnapshot
    gameSession.advanceAi = originalAdvanceAi
    global.setTimeout = originalSetTimeout
    global.clearTimeout = originalClearTimeout
  }
})

test('table page clears a pending ai timer before scheduling result navigation when the round settles', () => {
  const page = createPageInstance()
  const originalGetSnapshot = gameSession.getSnapshot
  const originalWx = global.wx
  const originalSetTimeout = global.setTimeout
  const originalClearTimeout = global.clearTimeout
  const originalAdvanceAi = gameSession.advanceAi
  const activeSnapshot = startRound(rules, {
    dealerSeat: 0,
    roundIndex: 2,
    bankerBase: 10
  })
  const settledSnapshot = startRound(rules, {
    dealerSeat: 0,
    roundIndex: 2,
    bankerBase: 10
  })

  let currentSnapshot = activeSnapshot
  const scheduledDelays = []
  const clearedTimerIds = []

  activeSnapshot.activeSeat = 1
  settledSnapshot.result = buildRoundResult(settledSnapshot, {
    type: 'drawGame'
  })
  gameSession.getSnapshot = () => currentSnapshot
  gameSession.advanceAi = () => {}
  global.wx = {
    redirectTo() {},
    reLaunch() {}
  }
  global.setTimeout = (_handler, delay) => {
    scheduledDelays.push(delay)
    return delay === 500 ? 41 : 42
  }
  global.clearTimeout = (timerId) => {
    clearedTimerIds.push(timerId)
  }

  try {
    page.refreshView()
    currentSnapshot = settledSnapshot
    page.refreshView()

    assert.equal(page._navigating, true)
    assert.deepEqual(scheduledDelays, [500, 650])
    assert.equal(clearedTimerIds.includes(41), true)
  } finally {
    gameSession.getSnapshot = originalGetSnapshot
    gameSession.advanceAi = originalAdvanceAi
    global.wx = originalWx
    global.setTimeout = originalSetTimeout
    global.clearTimeout = originalClearTimeout
  }
})

test('table page does not redirect to the result page after the page is hidden before the delay fires', () => {
  const page = createPageInstance()
  const originalGetSnapshot = gameSession.getSnapshot
  const originalWx = global.wx
  const originalSetTimeout = global.setTimeout
  const originalClearTimeout = global.clearTimeout
  const snapshot = startRound(rules, {
    dealerSeat: 0,
    roundIndex: 3,
    bankerBase: 10
  })

  let scheduledHandler = null
  let redirectedUrl = ''

  snapshot.result = buildRoundResult(snapshot, {
    type: 'drawGame'
  })
  gameSession.getSnapshot = () => snapshot
  global.wx = {
    redirectTo({ url }) {
      redirectedUrl = url
    },
    reLaunch() {}
  }
  global.setTimeout = (handler) => {
    scheduledHandler = handler
    return 99
  }
  global.clearTimeout = () => {}

  try {
    page.refreshView()
    page.onHide()
    scheduledHandler()

    assert.equal(page._destroyed, true)
    assert.equal(redirectedUrl, '')
  } finally {
    gameSession.getSnapshot = originalGetSnapshot
    global.wx = originalWx
    global.setTimeout = originalSetTimeout
    global.clearTimeout = originalClearTimeout
  }
})

test('table page does not queue duplicate result redirects across repeated settled refreshes', () => {
  const page = createPageInstance()
  const originalGetSnapshot = gameSession.getSnapshot
  const originalWx = global.wx
  const originalSetTimeout = global.setTimeout
  const originalClearTimeout = global.clearTimeout
  const snapshot = startRound(rules, {
    dealerSeat: 0,
    roundIndex: 3,
    bankerBase: 10
  })

  const scheduledHandlers = []
  let redirectedUrl = ''

  snapshot.result = buildRoundResult(snapshot, {
    type: 'drawGame'
  })
  gameSession.getSnapshot = () => snapshot
  global.wx = {
    redirectTo({ url }) {
      redirectedUrl = url
    },
    reLaunch() {}
  }
  global.setTimeout = (handler, delay) => {
    scheduledHandlers.push({ handler, delay })
    return scheduledHandlers.length
  }
  global.clearTimeout = () => {}

  try {
    page.refreshView()
    page.refreshView()

    assert.equal(page._navigating, true)
    assert.deepEqual(scheduledHandlers.map((item) => item.delay), [650])
    assert.equal(redirectedUrl, '')

    scheduledHandlers[0].handler()

    assert.equal(redirectedUrl, '/pages/result/result')
  } finally {
    gameSession.getSnapshot = originalGetSnapshot
    global.wx = originalWx
    global.setTimeout = originalSetTimeout
    global.clearTimeout = originalClearTimeout
  }
})

test('table page refreshView redirects to the result page after a real round result arrives', () => {
  const page = createPageInstance()
  const originalGetSnapshot = gameSession.getSnapshot
  const originalWx = global.wx
  const originalSetTimeout = global.setTimeout
  const originalClearTimeout = global.clearTimeout
  const snapshot = startRound(rules, {
    dealerSeat: 0,
    roundIndex: 3,
    bankerBase: 10
  })

  let timeoutDelay = 0
  let redirectedUrl = ''

  snapshot.result = buildRoundResult(snapshot, {
    type: 'drawGame'
  })
  gameSession.getSnapshot = () => snapshot
  global.wx = {
    redirectTo({ url }) {
      redirectedUrl = url
    },
    reLaunch() {}
  }
  global.setTimeout = (handler, delay) => {
    timeoutDelay = delay
    handler()
    return 1
  }
  global.clearTimeout = () => {}

  try {
    page.refreshView()

    assert.equal(page.data.view.roundEnded, true)
    assert.equal(page._navigating, true)
    assert.equal(timeoutDelay, 650)
    assert.equal(redirectedUrl, '/pages/result/result')
  } finally {
    gameSession.getSnapshot = originalGetSnapshot
    global.wx = originalWx
    global.setTimeout = originalSetTimeout
    global.clearTimeout = originalClearTimeout
  }
})

test('table page replay request falls back to startNewRound when the settled snapshot is missing', () => {
  const page = createPageInstance()
  const originalSubscribe = gameSession.subscribe
  const originalGetSnapshot = gameSession.getSnapshot
  const originalStartNextRound = gameSession.startNextRound
  const originalStartNewRound = gameSession.startNewRound

  let startNextRoundCalls = 0
  let startNewRoundCalls = 0

  gameSession.subscribe = () => () => {}
  gameSession.getSnapshot = () => null
  gameSession.startNextRound = () => {
    startNextRoundCalls += 1
  }
  gameSession.startNewRound = () => {
    startNewRoundCalls += 1
  }

  try {
    page.onLoad({ replay: '1' })
    page.onShow()

    assert.equal(startNextRoundCalls, 0)
    assert.equal(startNewRoundCalls, 1)
    assert.equal(page._replayRequested, false)
  } finally {
    gameSession.subscribe = originalSubscribe
    gameSession.getSnapshot = originalGetSnapshot
    gameSession.startNextRound = originalStartNextRound
    gameSession.startNewRound = originalStartNewRound
  }
})

test('table page replay request hydrates a fresh next-round view through the session listener', () => {
  const page = createPageInstance()
  const originalSubscribe = gameSession.subscribe
  const originalGetSnapshot = gameSession.getSnapshot
  const originalStartNextRound = gameSession.startNextRound
  const originalStartNewRound = gameSession.startNewRound

  const settledSnapshot = startRound(rules, {
    dealerSeat: 0,
    roundIndex: 2,
    bankerBase: 10
  })
  const nextRoundSnapshot = startRound(rules, {
    dealerSeat: 2,
    roundIndex: 3,
    bankerBase: 10
  })
  let currentSnapshot = settledSnapshot
  let subscribedListener = null
  let startNextRoundCalls = 0
  let startNewRoundCalls = 0

  settledSnapshot.result = buildRoundResult(settledSnapshot, {
    type: 'drawGame'
  })
  nextRoundSnapshot.log = [{ id: 'round-3-log', text: '进入下一局' }]
  gameSession.subscribe = (listener) => {
    subscribedListener = listener
    return () => {
      subscribedListener = null
    }
  }
  gameSession.getSnapshot = () => currentSnapshot
  gameSession.startNextRound = () => {
    startNextRoundCalls += 1
    currentSnapshot = nextRoundSnapshot
    subscribedListener()
  }
  gameSession.startNewRound = () => {
    startNewRoundCalls += 1
  }

  try {
    page.onLoad({ replay: '1' })
    page.onShow()

    assert.equal(startNextRoundCalls, 1)
    assert.equal(startNewRoundCalls, 0)
    assert.equal(page._replayRequested, false)
    assert.ok(page.data.view)
    assert.equal(page.data.view.roundLabel, '第 3 局')
    assert.equal(page.data.view.dealerLabel, '对家')
    assert.equal(page.data.view.roundEnded, false)
    assert.deepEqual(page.data.view.recentLogs.map((item) => item.id), ['round-3-log'])
  } finally {
    gameSession.subscribe = originalSubscribe
    gameSession.getSnapshot = originalGetSnapshot
    gameSession.startNextRound = originalStartNextRound
    gameSession.startNewRound = originalStartNewRound
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

test('table page subscribes only once per visible lifecycle and resubscribes after cleanup', () => {
  const page = createPageInstance()
  const originalSubscribe = gameSession.subscribe
  const originalGetSnapshot = gameSession.getSnapshot

  let subscribeCalls = 0
  let unsubscribeCalls = 0

  gameSession.subscribe = () => {
    subscribeCalls += 1
    return () => {
      unsubscribeCalls += 1
    }
  }
  gameSession.getSnapshot = () => ({ result: { type: 'drawGame' } })

  try {
    page.refreshView = function () {
      this.refreshed = (this.refreshed || 0) + 1
    }

    page.onShow()
    page.onShow()

    assert.equal(subscribeCalls, 1)
    assert.equal(unsubscribeCalls, 0)

    page.onHide()

    assert.equal(unsubscribeCalls, 1)
    assert.equal(page.unsubscribe, null)
    assert.equal(page._destroyed, true)

    page.onShow()

    assert.equal(subscribeCalls, 2)
    assert.equal(page._destroyed, false)

    page.onUnload()

    assert.equal(unsubscribeCalls, 2)
    assert.equal(page.unsubscribe, null)
    assert.equal(page._destroyed, true)
  } finally {
    gameSession.subscribe = originalSubscribe
    gameSession.getSnapshot = originalGetSnapshot
  }
})

test('table page cleanup clears ai timer and unsubscribe state', () => {
  const page = createPageInstance()
  const originalClearTimeout = global.clearTimeout

  const clearedTimerIds = []
  let unsubscribeCalls = 0

  page.aiTimer = 77
  page.unsubscribe = () => {
    unsubscribeCalls += 1
  }
  global.clearTimeout = (timerId) => {
    clearedTimerIds.push(timerId)
  }

  try {
    page.cleanup()

    assert.deepEqual(clearedTimerIds, [77])
    assert.equal(unsubscribeCalls, 1)
    assert.equal(page.unsubscribe, null)
    assert.equal(page._destroyed, true)
  } finally {
    global.clearTimeout = originalClearTimeout
  }
})

test('table page does not advance ai after unload when a pending ai timer callback fires later', () => {
  const page = createPageInstance()
  const originalAdvanceAi = gameSession.advanceAi
  const originalSetTimeout = global.setTimeout
  const originalClearTimeout = global.clearTimeout

  let scheduledHandler = null
  let advanceAiCalls = 0

  gameSession.advanceAi = () => {
    advanceAiCalls += 1
  }
  global.setTimeout = (handler) => {
    scheduledHandler = handler
    return 55
  }
  global.clearTimeout = () => {}

  try {
    page.scheduleAiIfNeeded({ autoAdvance: true })
    page.onUnload()
    scheduledHandler()

    assert.equal(page._destroyed, true)
    assert.equal(advanceAiCalls, 0)
  } finally {
    gameSession.advanceAi = originalAdvanceAi
    global.setTimeout = originalSetTimeout
    global.clearTimeout = originalClearTimeout
  }
})

test('table page routes pass actions through passHumanReaction and unlocks after a no-op pass', () => {
  const page = createPageInstance()
  const originalPassHumanReaction = gameSession.passHumanReaction
  const originalTakeHumanReaction = gameSession.takeHumanReaction
  const originalTakeHumanSelfAction = gameSession.takeHumanSelfAction

  let passCalls = 0
  let reactionCalls = 0
  let selfActionCalls = 0

  gameSession.passHumanReaction = () => {
    passCalls += 1
    return false
  }
  gameSession.takeHumanReaction = () => {
    reactionCalls += 1
    return true
  }
  gameSession.takeHumanSelfAction = () => {
    selfActionCalls += 1
    return true
  }

  try {
    page.data = {
      view: {
        availableActions: [{ type: 'pass', label: '过' }],
        promptType: 'reaction'
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

    assert.equal(passCalls, 1)
    assert.equal(reactionCalls, 0)
    assert.equal(selfActionCalls, 0)
    assert.equal(page.refreshed, true)
    assert.equal(page.data.acting, false)
    assert.equal(page.data.selectedTileId, '')
  } finally {
    gameSession.passHumanReaction = originalPassHumanReaction
    gameSession.takeHumanReaction = originalTakeHumanReaction
    gameSession.takeHumanSelfAction = originalTakeHumanSelfAction
  }
})

test('table page routes selector-built human reaction actions through takeHumanReaction', () => {
  const reactionAction = { type: 'chi', label: '吃 2万 3万' }
  const { page, restore } = createPageInstanceWithPatchedActionEvaluator({
    getCurrentReactionPrompt: () => ({
      seatId: 0,
      discardTile: { label: '4万' },
      actions: [reactionAction]
    }),
    getSelfActions: () => []
  })
  const originalGetSnapshot = gameSession.getSnapshot
  const originalPassHumanReaction = gameSession.passHumanReaction
  const originalTakeHumanReaction = gameSession.takeHumanReaction
  const originalTakeHumanSelfAction = gameSession.takeHumanSelfAction
  const snapshot = startRound(rules, {
    dealerSeat: 0,
    roundIndex: 3,
    bankerBase: 10
  })

  let receivedAction = null
  let passCalls = 0
  let selfActionCalls = 0

  snapshot.phase = 'reaction'
  gameSession.getSnapshot = () => snapshot
  gameSession.passHumanReaction = () => {
    passCalls += 1
    return true
  }
  gameSession.takeHumanReaction = (action) => {
    receivedAction = action
    return true
  }
  gameSession.takeHumanSelfAction = () => {
    selfActionCalls += 1
    return true
  }

  try {
    page.refreshView()

    assert.equal(page.data.view.promptType, 'reaction')
    assert.deepEqual(page.data.view.availableActions.map((action) => action.type), ['chi', 'pass'])

    page.onActionTap({ detail: { index: 0 } })

    assert.deepEqual(receivedAction, reactionAction)
    assert.equal(passCalls, 0)
    assert.equal(selfActionCalls, 0)
    assert.equal(page.data.selectedTileId, '')
    assert.equal(page.data.acting, true)
  } finally {
    restore()
    gameSession.getSnapshot = originalGetSnapshot
    gameSession.passHumanReaction = originalPassHumanReaction
    gameSession.takeHumanReaction = originalTakeHumanReaction
    gameSession.takeHumanSelfAction = originalTakeHumanSelfAction
  }
})

test('table page routes selector-built human self actions through takeHumanSelfAction', () => {
  const selfAction = { type: 'gang', label: '补杠' }
  const { page, restore } = createPageInstanceWithPatchedActionEvaluator({
    getCurrentReactionPrompt: () => null,
    getSelfActions: () => [selfAction]
  })
  const originalGetSnapshot = gameSession.getSnapshot
  const originalPassHumanReaction = gameSession.passHumanReaction
  const originalTakeHumanReaction = gameSession.takeHumanReaction
  const originalTakeHumanSelfAction = gameSession.takeHumanSelfAction
  const snapshot = startRound(rules, {
    dealerSeat: 0,
    roundIndex: 3,
    bankerBase: 10
  })

  let receivedAction = null
  let passCalls = 0
  let reactionCalls = 0

  snapshot.phase = 'turn'
  snapshot.activeSeat = 0
  gameSession.getSnapshot = () => snapshot
  gameSession.passHumanReaction = () => {
    passCalls += 1
    return true
  }
  gameSession.takeHumanReaction = () => {
    reactionCalls += 1
    return true
  }
  gameSession.takeHumanSelfAction = (action) => {
    receivedAction = action
    return true
  }

  try {
    page.refreshView()

    assert.equal(page.data.view.promptType, 'self')
    assert.deepEqual(page.data.view.availableActions, [selfAction])

    page.onActionTap({ detail: { index: 0 } })

    assert.deepEqual(receivedAction, selfAction)
    assert.equal(passCalls, 0)
    assert.equal(reactionCalls, 0)
    assert.equal(page.data.selectedTileId, '')
    assert.equal(page.data.acting, true)
  } finally {
    restore()
    gameSession.getSnapshot = originalGetSnapshot
    gameSession.passHumanReaction = originalPassHumanReaction
    gameSession.takeHumanReaction = originalTakeHumanReaction
    gameSession.takeHumanSelfAction = originalTakeHumanSelfAction
  }
})

test('table page forwards the selected reaction action by index when multiple chi options are available', () => {
  const page = createPageInstance()
  const originalTakeHumanReaction = gameSession.takeHumanReaction

  const actions = [
    { type: 'chi', label: '吃 2万 3万' },
    { type: 'chi', label: '吃 3万 5万' },
    { type: 'chi', label: '吃 5万 6万' }
  ]
  let receivedAction = null

  gameSession.takeHumanReaction = (action) => {
    receivedAction = action
    return true
  }

  try {
    page.data = {
      view: {
        availableActions: actions,
        promptType: 'reaction'
      },
      selectedTileId: 'tile-1',
      acting: false
    }

    page.onActionTap({ detail: { index: 1 } })

    assert.deepEqual(receivedAction, actions[1])
    assert.equal(page.data.selectedTileId, '')
    assert.equal(page.data.acting, true)
  } finally {
    gameSession.takeHumanReaction = originalTakeHumanReaction
  }
})

test('action panel emits the tapped button index in order', () => {
  const component = createActionPanelInstance({
    actions: [
      { label: '吃 2万 3万' },
      { label: '吃 3万 5万' },
      { label: '吃 5万 6万' }
    ],
    disabled: false
  })

  component.handleTap({
    currentTarget: {
      dataset: {
        index: 1
      }
    }
  })

  assert.deepEqual(component.emittedEvents, [{
    name: 'actiontap',
    detail: {
      index: 1
    }
  }])
})

test('action panel ignores taps while disabled', () => {
  const component = createActionPanelInstance({
    actions: [{ label: '过' }],
    disabled: true
  })

  component.handleTap({
    currentTarget: {
      dataset: {
        index: 0
      }
    }
  })

  assert.deepEqual(component.emittedEvents, [])
})

test('table page template binds top-bar, logs, hand, and action controls to table view fields', () => {
  const template = readTableTemplate()

  assert.match(template, /<text class="top-value">\{\{view\.roundLabel\}\}<\/text>/)
  assert.match(template, /<text class="top-value">\{\{view\.dealerLabel\}\}<\/text>/)
  assert.match(template, /<text class="top-value">\{\{view\.bankerBaseLabel\}\}<\/text>/)
  assert.match(template, /<text class="top-value">\{\{view\.goldTileLabel\}\}<\/text>/)
  assert.match(template, /<text wx:if="\{\{view\.goldDiceLabel\}\}" class="top-subvalue">\{\{view\.goldDiceLabel\}\}<\/text>/)
  assert.match(template, /<view wx:for="\{\{view\.recentLogs\}\}" wx:key="id" class="log-item">\{\{item\.text\}\}<\/view>/)
  assert.match(template, /<text wx:if="\{\{view\.humanSpecialStateLabel\}\}" class="pill">\{\{view\.humanSpecialStateLabel\}\}<\/text>/)
  assert.match(template, /<tile wx:for="\{\{view\.humanHand\}\}" wx:key="id" tile="\{\{item\}\}" disabled="\{\{acting \|\| item\.disabled\}\}" bind:tiletap="onTileTap" \/>/)
  assert.doesNotMatch(template, /onDiscardTap/)
  assert.match(template, /<action-panel actions="\{\{view\.availableActions\}\}" disabled="\{\{acting\}\}" bind:actiontap="onActionTap" \/>/)
})

test('seat summary template binds dealer, special state, pending delta, and fallback labels', () => {
  const template = readSeatSummaryTemplate()

  assert.match(template, /<text class="pill">\{\{seat\.windLabel\}\}<\/text>/)
  assert.match(template, /<text wx:if="\{\{seat\.specialStateLabel\}\}" class="pill">\{\{seat\.specialStateLabel\}\}<\/text>/)
  assert.match(template, /<text wx:if="\{\{seat\.isDealer\}\}" class="dealer-badge">庄<\/text>/)
  assert.match(template, /<view wx:if="\{\{seat\.pendingDeltaText\}\}" class="seat-delta \{\{seat\.pendingDelta > 0 \? 'seat-delta-positive' : seat\.pendingDelta < 0 \? 'seat-delta-negative' : ''\}\}">/)
  assert.match(template, /<text wx:if="\{\{!seat\.discardLabels\.length\}\}" class="empty-text">暂无<\/text>/)
  assert.match(template, /<text wx:for="\{\{seat\.flowerLabels\}\}" wx:key="index" class="chip chip-flower">\{\{item\}\}<\/text>/)
})

test('action panel template binds action labels, indices, and disabled state', () => {
  const template = readActionPanelTemplate()

  assert.match(template, /<view wx:if="\{\{actions\.length\}\}" class="action-panel">/)
  assert.match(template, /wx:for="\{\{actions\}\}"/)
  assert.match(template, /data-index="\{\{index\}\}"/)
  assert.match(template, /bindtap="handleTap"/)
  assert.match(template, /disabled="\{\{disabled\}\}"/)
  assert.match(template, /\{\{item\.label\}\}/)
})
