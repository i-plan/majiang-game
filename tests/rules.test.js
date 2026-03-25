const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const rulesPath = path.join(ROOT, 'game', 'config', 'rules', 'mvp')
const tileCatalogPath = path.join(ROOT, 'game', 'config', 'tileCatalog')
const wallModulePath = path.join(ROOT, 'game', 'core', 'wall')
const stateMachinePath = path.join(ROOT, 'game', 'core', 'stateMachine')

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
