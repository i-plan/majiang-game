const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const rules = require(path.join(ROOT, 'game', 'config', 'rules', 'mvp'))
const { startRound } = require(path.join(ROOT, 'game', 'core', 'stateMachine'))
const gameSession = require(path.join(ROOT, 'game', 'runtime', 'gameSession'))

const tablePagePath = path.join(ROOT, 'pages', 'table', 'table.js')
const tablePageWxmlPath = path.join(ROOT, 'pages', 'table', 'table.wxml')
const seatSummaryWxmlPath = path.join(ROOT, 'components', 'seat-summary', 'index.wxml')
const actionPanelWxmlPath = path.join(ROOT, 'components', 'action-panel', 'index.wxml')
const actionPanelPath = path.join(ROOT, 'components', 'action-panel', 'index.js')

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

function readTableTemplate() {
  return fs.readFileSync(tablePageWxmlPath, 'utf8')
}

function readSeatSummaryTemplate() {
  return fs.readFileSync(seatSummaryWxmlPath, 'utf8')
}

function readActionPanelTemplate() {
  return fs.readFileSync(actionPanelWxmlPath, 'utf8')
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
  assert.match(template, /bindtap="onDiscardTap" disabled="\{\{acting \|\| view\.discardDisabled \|\| !view\.canDiscard\}\}">/)
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
