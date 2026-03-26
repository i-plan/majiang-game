const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const rulesPath = path.join(ROOT, 'game', 'config', 'rules', 'mvp')
const tileCatalogPath = path.join(ROOT, 'game', 'config', 'tileCatalog')
const wallModulePath = path.join(ROOT, 'game', 'core', 'wall')
const stateMachinePath = path.join(ROOT, 'game', 'core', 'stateMachine')
const winCheckerPath = path.join(ROOT, 'game', 'core', 'winChecker')

const rules = require(rulesPath)
const { buildTileDeck } = require(tileCatalogPath)

function createTilePicker() {
  const remainingTiles = buildTileDeck({ includeFlowers: true })

  function takeIndex(predicate, description) {
    const index = remainingTiles.findIndex(predicate)
    assert.notEqual(index, -1, `缺少测试用牌: ${description}`)
    return remainingTiles.splice(index, 1)[0]
  }

  return {
    takeByCode(code) {
      return takeIndex((tile) => tile.code === code, code)
    },
    takeNextNonFlower() {
      return takeIndex((tile) => !tile.flower, 'non-flower')
    },
    takeRemaining() {
      return remainingTiles.splice(0)
    }
  }
}

function buildWallForOpeningFlower(flowerSeatId) {
  const picker = createTilePicker()
  const liveTiles = []

  for (let round = 0; round < rules.dealing.dealerHandSize; round += 1) {
    for (let seatId = 0; seatId < rules.seatCount; seatId += 1) {
      const targetHandSize = seatId === 0 ? rules.dealing.dealerHandSize : rules.dealing.idleHandSize
      if (round >= targetHandSize) {
        continue
      }

      liveTiles.push(round === 0 && seatId === flowerSeatId ? picker.takeByCode('plum') : picker.takeNextNonFlower())
    }
  }

  const tailTiles = [
    picker.takeNextNonFlower(),
    picker.takeNextNonFlower(),
    picker.takeNextNonFlower()
  ]
  const middleTiles = picker.takeRemaining()
  const tiles = liveTiles.concat(middleTiles, tailTiles)

  return {
    tiles,
    liveIndex: 0,
    supplementIndex: tiles.length - 1
  }
}

function loadStateMachineWithPatchedWall(createWall) {
  const resolvedWallModulePath = require.resolve(wallModulePath)
  const resolvedStateMachinePath = require.resolve(stateMachinePath)
  delete require.cache[resolvedStateMachinePath]
  delete require.cache[resolvedWallModulePath]

  const wallModule = require(resolvedWallModulePath)
  const originalCreateWall = wallModule.createWall
  const originalRandom = Math.random

  wallModule.createWall = createWall
  Math.random = () => 0

  const stateMachine = require(resolvedStateMachinePath)

  return {
    stateMachine,
    restore() {
      Math.random = originalRandom
      wallModule.createWall = originalCreateWall
      delete require.cache[resolvedStateMachinePath]
      delete require.cache[resolvedWallModulePath]
    }
  }
}

function assertOpeningHandSizes(state) {
  assert.deepEqual(
    state.seats.map((seat) => seat.concealedTiles.length),
    [rules.dealing.dealerHandSize, rules.dealing.idleHandSize, rules.dealing.idleHandSize, rules.dealing.idleHandSize]
  )
}

function createSeatState(picker, seatId, codes, extra) {
  return Object.assign({
    seatId,
    concealedTiles: codes.map((code) => picker.takeByCode(code)),
    melds: [],
    flowers: [],
    discards: [],
    score: rules.match.initialScore,
    youJinLevel: 0,
    tianTingActive: false,
    tianTingEligible: false
  }, extra)
}

function createControlledTurnState(options) {
  const { startRound } = require(stateMachinePath)
  const settings = Object.assign({
    dealerSeat: 0,
    activeSeat: 0,
    turnStage: 'afterDraw',
    discardCount: 0,
    lastDrawSource: 'live',
    goldTileCode: 'white',
    goldTileLabel: '白',
    seatCodes: [[], [], [], []],
    seatOverrides: [{}, {}, {}, {}],
    lastDrawSeatId: 0,
    lastDrawCode: ''
  }, options)
  const picker = createTilePicker()
  const state = startRound(rules, {
    dealerSeat: settings.dealerSeat,
    roundIndex: 1,
    bankerBase: 10
  })

  state.phase = 'turn'
  state.result = null
  state.reactionWindow = null
  state.dealerSeat = settings.dealerSeat
  state.activeSeat = settings.activeSeat
  state.turnStage = settings.turnStage
  state.discardCount = settings.discardCount
  state.lastDiscardTile = null
  state.lastDiscardSeat = null
  state.lastDrawSource = settings.lastDrawSource
  state.goldTileCode = settings.goldTileCode
  state.goldTileLabel = settings.goldTileLabel
  state.log = []
  state.logCounter = 0
  state.seats = settings.seatCodes.map((codes, seatId) => createSeatState(picker, seatId, codes, settings.seatOverrides[seatId] || {}))

  const lastDrawSeat = state.seats[settings.lastDrawSeatId]
  state.lastDrawTile = lastDrawSeat && settings.lastDrawCode
    ? lastDrawSeat.concealedTiles.find((tile) => tile.code === settings.lastDrawCode) || null
    : null

  return state
}

test('startRound keeps idle seats at 16 concealed tiles after round-based flower replacement', () => {
  const { stateMachine, restore } = loadStateMachineWithPatchedWall(() => buildWallForOpeningFlower(1))

  try {
    const state = stateMachine.startRound(rules, {
      dealerSeat: 0,
      roundIndex: 1,
      bankerBase: 10
    })

    assertOpeningHandSizes(state)
    assert.equal(state.seats[1].flowers.length, 1)
    assert.equal(state.seats[1].flowers[0].code, 'plum')
    assert.equal(state.lastDrawSource, 'live')
  } finally {
    restore()
  }
})

test('startRound keeps dealer on 17 concealed tiles when dealer opens with a flower', () => {
  const { stateMachine, restore } = loadStateMachineWithPatchedWall(() => buildWallForOpeningFlower(0))

  try {
    const state = stateMachine.startRound(rules, {
      dealerSeat: 0,
      roundIndex: 1,
      bankerBase: 10
    })

    assertOpeningHandSizes(state)
    assert.equal(state.seats[0].flowers.length, 1)
    assert.equal(state.seats[0].flowers[0].code, 'plum')
    assert.equal(state.lastDrawSource, 'supplement')
    assert.ok(state.lastDrawTile)
    assert.equal(
      state.seats[0].concealedTiles.some((tile) => tile.id === state.lastDrawTile.id),
      true
    )
  } finally {
    restore()
  }
})

test('randomized starts always satisfy dealer 17 and idle 16 opening hand sizes', () => {
  const { startRound } = require(stateMachinePath)

  for (let index = 0; index < 30; index += 1) {
    const state = startRound(rules, {
      dealerSeat: 0,
      roundIndex: index + 1,
      bankerBase: 10
    })

    assertOpeningHandSizes(state)
    assert.ok(state.goldTileCode)
    assert.ok(state.goldTileLabel)
  }
})

test('stateMachine logs use the same seat naming style as the selectors', () => {
  const { startRound } = require(stateMachinePath)
  const state = startRound(rules, {
    dealerSeat: 0,
    roundIndex: 1,
    bankerBase: 10
  })

  assert.equal(state.log.some((item) => item.text.includes('玩家')), false)
  assert.equal(state.log.some((item) => item.text.includes('AI')), false)
  assert.equal(state.log.some((item) => item.text.includes('你 坐庄')), true)
})

test('discardTile enters tianTing on the dealer first discard when the hand stays ready', () => {
  const { discardTile } = require(stateMachinePath)
  const { getTianTingDiscardCodes } = require(winCheckerPath)
  const state = createControlledTurnState({
    seatCodes: [[
      'wan-1', 'wan-2', 'wan-3',
      'tong-1', 'tong-2', 'tong-3',
      'bamboo-1', 'bamboo-2', 'bamboo-3',
      'east', 'east', 'east',
      'south', 'south',
      'red', 'red',
      'west'
    ], [], [], []],
    seatOverrides: [{
      tianTingEligible: true
    }, {}, {}, {}],
    lastDrawCode: 'west'
  })
  const discardCodes = getTianTingDiscardCodes(state, state.seats[0])
  const westTile = state.seats[0].concealedTiles.find((tile) => tile.code === 'west')

  assert.ok(westTile)
  assert.equal(discardCodes.includes('west'), true)
  assert.equal(discardTile(state, 0, westTile.id), true)
  assert.equal(state.seats[0].tianTingActive, true)
  assert.equal(state.seats[0].tianTingEligible, false)
  assert.equal(state.seats[0].discards.length, 1)
  assert.equal(state.seats[0].discards[0].code, 'west')
  assert.equal(state.log.some((item) => item.text.includes('进入天听')), true)
})

test('discardTile rejects non-lastDrawTile discards while tianTing or youJin locking is active', () => {
  const { discardTile } = require(stateMachinePath)
  const lockedCases = [
    {
      label: 'tianTing',
      seatOverride: {
        tianTingActive: true
      }
    },
    {
      label: 'youJin',
      seatOverride: {
        youJinLevel: 1
      }
    }
  ]

  lockedCases.forEach(({ label, seatOverride }) => {
    const state = createControlledTurnState({
      seatCodes: [['wan-1', 'wan-2'], [], [], []],
      seatOverrides: [seatOverride, {}, {}, {}],
      lastDrawCode: 'wan-2'
    })
    const blockedTile = state.seats[0].concealedTiles.find((tile) => tile.code === 'wan-1')

    assert.ok(blockedTile)
    assert.equal(discardTile(state, 0, blockedTile.id), false, `${label} should only allow discarding lastDrawTile`)
    assert.deepEqual(state.seats[0].concealedTiles.map((tile) => tile.code), ['wan-1', 'wan-2'])
    assert.equal(state.seats[0].discards.length, 0)
    assert.equal(state.turnStage, 'afterDraw')
  })
})
