const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '../../..')
const rules = require(path.join(ROOT, 'minigame', 'game', 'config', 'rules', 'mvp'))
const { startRound } = require(path.join(ROOT, 'minigame', 'game', 'core', 'stateMachine'))
const { buildRoundResult } = require(path.join(ROOT, 'minigame', 'game', 'core', 'settlement'))
const { createTableScene, DOUBLE_TAP_INTERVAL } = require(path.join(ROOT, 'minigame', 'src', 'scenes', 'tableScene'))

function getDifferentTileId(seat, excludedTileId) {
  const tile = seat.concealedTiles.find((item) => item.id !== excludedTileId)
  assert.ok(tile, '测试局面至少要有一张非 lastDrawTile 的手牌')
  return tile.id
}

function createManagerFixture(options) {
  const settings = options || {}
  const calls = {
    goTo: [],
    renderCount: 0
  }

  return {
    calls,
    manager: {
      requestRender() {
        calls.renderCount += 1
        return true
      },
      goTo(name, sceneOptions) {
        calls.goTo.push({ name, sceneOptions })
        if (typeof settings.goTo === 'function') {
          return settings.goTo(name, sceneOptions)
        }
        return true
      }
    }
  }
}

function createTimerFixture() {
  const calls = {
    cleared: [],
    set: []
  }
  let nextId = 40

  return {
    calls,
    timerApi: {
      clearTimeout(timerId) {
        calls.cleared.push(timerId)
      },
      setTimeout(handler, delay) {
        nextId += 1
        calls.set.push({
          id: nextId,
          handler,
          delay
        })
        return nextId
      }
    }
  }
}

function createSessionFixture(options) {
  const settings = options || {}
  let snapshot = Object.prototype.hasOwnProperty.call(settings, 'snapshot') ? settings.snapshot : null
  let listener = null
  const calls = {
    advanceAi: 0,
    discardHumanTile: [],
    passHumanReaction: 0,
    startNewRound: 0,
    startNextRound: 0,
    subscribe: 0,
    takeHumanReaction: [],
    takeHumanSelfAction: [],
    unsubscribe: 0
  }

  const gameSession = {
    advanceAi() {
      calls.advanceAi += 1
      if (typeof settings.advanceAi === 'function') {
        return settings.advanceAi()
      }
      return true
    },
    discardHumanTile(tileId) {
      calls.discardHumanTile.push(tileId)
      if (typeof settings.discardHumanTile === 'function') {
        return settings.discardHumanTile(tileId)
      }
      return true
    },
    getSnapshot() {
      return snapshot
    },
    passHumanReaction() {
      calls.passHumanReaction += 1
      if (typeof settings.passHumanReaction === 'function') {
        return settings.passHumanReaction()
      }
      return true
    },
    startNewRound() {
      calls.startNewRound += 1
      if (typeof settings.startNewRound === 'function') {
        return settings.startNewRound()
      }
      return true
    },
    startNextRound() {
      calls.startNextRound += 1
      if (typeof settings.startNextRound === 'function') {
        return settings.startNextRound()
      }
      return true
    },
    subscribe(nextListener) {
      calls.subscribe += 1
      listener = nextListener
      return () => {
        calls.unsubscribe += 1
        if (listener === nextListener) {
          listener = null
        }
      }
    },
    takeHumanReaction(action) {
      calls.takeHumanReaction.push(action)
      if (typeof settings.takeHumanReaction === 'function') {
        return settings.takeHumanReaction(action)
      }
      return true
    },
    takeHumanSelfAction(action) {
      calls.takeHumanSelfAction.push(action)
      if (typeof settings.takeHumanSelfAction === 'function') {
        return settings.takeHumanSelfAction(action)
      }
      return true
    }
  }

  return {
    calls,
    emit() {
      if (listener) {
        listener()
      }
    },
    gameSession,
    setSnapshot(nextSnapshot) {
      snapshot = nextSnapshot
    }
  }
}

function createFixture(options) {
  const settings = options || {}
  let currentTime = typeof settings.now === 'number' ? settings.now : 1000
  const managerFixture = createManagerFixture(settings)
  const timerFixture = createTimerFixture()
  const sessionFixture = createSessionFixture(settings)

  return {
    managerCalls: managerFixture.calls,
    scene: createTableScene({
      manager: managerFixture.manager,
      gameSession: sessionFixture.gameSession,
      now: () => currentTime,
      timerApi: timerFixture.timerApi
    }),
    sessionCalls: sessionFixture.calls,
    gameSession: sessionFixture.gameSession,
    setNow(nextTime) {
      currentTime = nextTime
    },
    setSnapshot: sessionFixture.setSnapshot,
    emit: sessionFixture.emit,
    timerCalls: timerFixture.calls
  }
}

test('table scene enter starts a new round when no snapshot is available', () => {
  const { scene, sessionCalls } = createFixture({
    snapshot: null
  })

  scene.enter()

  assert.equal(sessionCalls.subscribe, 1)
  assert.equal(sessionCalls.startNewRound, 1)
  assert.equal(sessionCalls.startNextRound, 0)
})

test('table scene enter starts the next round only when replay is explicitly requested', () => {
  const settledSnapshot = startRound(rules, {
    dealerSeat: 0,
    roundIndex: 2,
    bankerBase: 10
  })

  settledSnapshot.result = buildRoundResult(settledSnapshot, {
    type: 'drawGame'
  })

  const replayFixture = createFixture({
    snapshot: settledSnapshot
  })
  replayFixture.scene.enter({ replay: true })

  assert.equal(replayFixture.sessionCalls.startNextRound, 1)
  assert.equal(replayFixture.sessionCalls.startNewRound, 0)

  const normalFixture = createFixture({
    snapshot: settledSnapshot
  })
  normalFixture.scene.enter()

  assert.equal(normalFixture.sessionCalls.startNextRound, 0)
  assert.ok(normalFixture.scene.getState().view)
  assert.equal(normalFixture.scene.getState().view.roundEnded, true)
})

test('table scene refreshView clears stale selection and acting state from a real snapshot', () => {
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

  const { scene } = createFixture({ snapshot })
  scene.refreshView()

  const state = scene.getState()
  assert.equal(state.acting, false)
  assert.equal(state.selectedTileId, '')
  assert.equal(state.view.roundLabel, '第 2 局')
  assert.equal(state.view.dealerLabel, '对家')
  assert.equal(state.view.goldTileLabel, '白板')
  assert.equal(state.view.goldDiceLabel, '3 + 4 = 7')
  assert.equal(state.view.topSeat.isDealer, true)
  assert.equal(state.view.topSeat.specialStateLabel, '双游')
  assert.equal(state.view.rightSeat.specialStateLabel, '天听')
  assert.deepEqual(state.view.recentLogs.map((item) => item.id), ['log-1', 'log-2'])
})

test('table scene onTileTap selects first and discards only after a quick second tap on the same tile', () => {
  const snapshot = startRound(rules, {
    dealerSeat: 0,
    roundIndex: 1,
    bankerBase: 10
  })
  const tileId = getDifferentTileId(snapshot.seats[0], snapshot.lastDrawTile.id)
  const fixture = createFixture({ snapshot, now: 1000 })

  fixture.scene.refreshView()

  fixture.scene.onTileTap(tileId)
  assert.equal(fixture.scene.getState().selectedTileId, tileId)
  assert.equal(fixture.scene.getState().view.selectedTileId, tileId)
  assert.deepEqual(fixture.sessionCalls.discardHumanTile, [])

  fixture.setNow(1000 + DOUBLE_TAP_INTERVAL + 150)
  fixture.scene.onTileTap(tileId)
  assert.deepEqual(fixture.sessionCalls.discardHumanTile, [])
  assert.equal(fixture.scene.getState().acting, false)

  fixture.setNow(1000 + DOUBLE_TAP_INTERVAL + 300)
  fixture.scene.onTileTap(tileId)

  assert.deepEqual(fixture.sessionCalls.discardHumanTile, [tileId])
  assert.equal(fixture.scene.getState().selectedTileId, '')
  assert.equal(fixture.scene.getState().acting, true)
})

test('table scene ignores non-lastDrawTile taps when discard is locked and still requires a quick second tap for the locked tile', () => {
  const snapshot = startRound(rules, {
    dealerSeat: 0,
    roundIndex: 1,
    bankerBase: 10
  })
  const fixture = createFixture({ snapshot, now: 2000 })
  const blockedTileId = getDifferentTileId(snapshot.seats[0], snapshot.lastDrawTile.id)

  snapshot.seats[0].youJinLevel = 1
  fixture.scene.refreshView()

  assert.equal(fixture.scene.getState().selectedTileId, snapshot.lastDrawTile.id)
  assert.equal(fixture.scene.getState().view.lockedDiscardTileId, snapshot.lastDrawTile.id)

  fixture.scene.onTileTap(blockedTileId)
  assert.equal(fixture.scene.getState().selectedTileId, snapshot.lastDrawTile.id)
  assert.deepEqual(fixture.sessionCalls.discardHumanTile, [])

  fixture.scene.onTileTap(snapshot.lastDrawTile.id)
  assert.deepEqual(fixture.sessionCalls.discardHumanTile, [])
  assert.equal(fixture.scene.getState().acting, false)

  fixture.setNow(2200)
  fixture.scene.onTileTap(snapshot.lastDrawTile.id)

  assert.deepEqual(fixture.sessionCalls.discardHumanTile, [snapshot.lastDrawTile.id])
  assert.equal(fixture.scene.getState().selectedTileId, '')
  assert.equal(fixture.scene.getState().acting, true)
})

test('table scene refreshView schedules ai advance when the selector marks the turn as autoAdvance', () => {
  const snapshot = startRound(rules, {
    dealerSeat: 0,
    roundIndex: 2,
    bankerBase: 10
  })
  const fixture = createFixture({ snapshot })

  snapshot.activeSeat = 2
  snapshot.phase = 'turn'

  fixture.scene.refreshView()

  assert.equal(fixture.scene.getState().view.activeLabel, '对家')
  assert.equal(fixture.scene.getState().view.autoAdvance, true)
  assert.deepEqual(fixture.timerCalls.set.map((item) => item.delay), [500])

  fixture.timerCalls.set[0].handler()

  assert.equal(fixture.sessionCalls.advanceAi, 1)
})

test('table scene refreshView clears a pending ai timer before scheduling result navigation', () => {
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
  const fixture = createFixture({
    snapshot: activeSnapshot
  })

  activeSnapshot.activeSeat = 1
  settledSnapshot.result = buildRoundResult(settledSnapshot, {
    type: 'drawGame'
  })

  fixture.scene.enter()
  fixture.setSnapshot(settledSnapshot)
  fixture.scene.refreshView()

  assert.deepEqual(fixture.timerCalls.set.map((item) => item.delay), [500, 650])
  assert.equal(fixture.timerCalls.cleared.includes(fixture.timerCalls.set[0].id), true)

  fixture.timerCalls.set[1].handler()

  assert.deepEqual(fixture.managerCalls.goTo, [{ name: 'result', sceneOptions: undefined }])
})

test('table scene cleanup clears timers, unsubscribes, and prevents late ai callbacks from advancing', () => {
  const snapshot = startRound(rules, {
    dealerSeat: 0,
    roundIndex: 2,
    bankerBase: 10
  })
  const fixture = createFixture({ snapshot })

  snapshot.activeSeat = 2
  fixture.scene.enter()
  fixture.scene.cleanup()
  fixture.timerCalls.set[0].handler()

  assert.equal(fixture.sessionCalls.unsubscribe, 1)
  assert.equal(fixture.sessionCalls.advanceAi, 0)
  assert.equal(fixture.timerCalls.cleared.includes(fixture.timerCalls.set[0].id), true)
})

test('table scene routes pass actions through passHumanReaction and unlocks after a no-op pass', () => {
  const snapshot = startRound(rules, {
    dealerSeat: 0,
    roundIndex: 3,
    bankerBase: 10
  })
  const fixture = createFixture({
    snapshot,
    passHumanReaction() {
      return false
    }
  })

  fixture.scene.refreshView()
  const currentView = fixture.scene.getState().view
  currentView.availableActions = [{ type: 'pass', label: '过' }]
  currentView.promptType = 'reaction'

  fixture.scene.onActionTap(0)

  assert.equal(fixture.sessionCalls.passHumanReaction, 1)
  assert.deepEqual(fixture.sessionCalls.takeHumanReaction, [])
  assert.deepEqual(fixture.sessionCalls.takeHumanSelfAction, [])
  assert.equal(fixture.scene.getState().acting, false)
  assert.equal(fixture.scene.getState().selectedTileId, '')
})

test('table scene routes human reaction actions through takeHumanReaction', () => {
  const snapshot = startRound(rules, {
    dealerSeat: 0,
    roundIndex: 3,
    bankerBase: 10
  })
  const fixture = createFixture({ snapshot })
  const reactionAction = { type: 'chi', label: '吃 2万 3万' }

  fixture.scene.refreshView()
  const currentView = fixture.scene.getState().view
  currentView.availableActions = [reactionAction]
  currentView.promptType = 'reaction'

  fixture.scene.onActionTap(0)

  assert.deepEqual(fixture.sessionCalls.takeHumanReaction, [reactionAction])
  assert.deepEqual(fixture.sessionCalls.takeHumanSelfAction, [])
  assert.equal(fixture.scene.getState().selectedTileId, '')
  assert.equal(fixture.scene.getState().acting, true)
})

test('table scene routes human self actions through takeHumanSelfAction', () => {
  const snapshot = startRound(rules, {
    dealerSeat: 0,
    roundIndex: 3,
    bankerBase: 10
  })
  const fixture = createFixture({ snapshot })
  const selfAction = { type: 'gang', label: '补杠' }

  fixture.scene.refreshView()
  const currentView = fixture.scene.getState().view
  currentView.availableActions = [selfAction]
  currentView.promptType = 'self'

  fixture.scene.onActionTap(0)

  assert.deepEqual(fixture.sessionCalls.takeHumanSelfAction, [selfAction])
  assert.deepEqual(fixture.sessionCalls.takeHumanReaction, [])
  assert.equal(fixture.scene.getState().selectedTileId, '')
  assert.equal(fixture.scene.getState().acting, true)
})
