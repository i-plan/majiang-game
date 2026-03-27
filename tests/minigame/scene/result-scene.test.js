const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '../../..')
const rules = require(path.join(ROOT, 'minigame', 'game', 'config', 'rules', 'mvp'))
const { buildRoundResult } = require(path.join(ROOT, 'minigame', 'game', 'core', 'settlement'))
const { createResultScene } = require(path.join(ROOT, 'minigame', 'src', 'scenes', 'resultScene'))

function createTile(code, label, index) {
  return {
    id: `${code}-${index}`,
    code,
    label
  }
}

function createTiles(specs, prefix) {
  return specs.map((spec, index) => createTile(spec.code, spec.label, `${prefix}-${index}`))
}

function createFlowerTiles(count, prefix) {
  return new Array(count).fill(null).map((_, index) => createTile('plum', '梅', `${prefix}-${index}`))
}

function createSeat(seatId, score, options) {
  const seatOptions = options || {}
  const winds = ['东', '南', '西', '北']

  return {
    seatId,
    wind: winds[seatId],
    concealedTiles: seatOptions.concealedTiles || [],
    melds: seatOptions.melds || [],
    flowers: seatOptions.flowers || [],
    discards: seatOptions.discards || [],
    score,
    youJinLevel: 0,
    tianTingActive: false,
    tianTingEligible: false
  }
}

function createState(options) {
  const stateOptions = options || {}

  return {
    rules,
    seats: stateOptions.seats,
    bankerBase: stateOptions.bankerBase || 2,
    dealerSeat: typeof stateOptions.dealerSeat === 'number' ? stateOptions.dealerSeat : 0,
    goldTileCode: stateOptions.goldTileCode || '',
    goldTileLabel: stateOptions.goldTileLabel || '',
    goldDice: stateOptions.goldDice || [],
    goldDiceTotal: stateOptions.goldDiceTotal || 0,
    roundIndex: stateOptions.roundIndex || 1,
    discardCount: stateOptions.discardCount || 0
  }
}

function createSnapshot(state, outcome) {
  return {
    result: buildRoundResult(state, outcome),
    seats: state.seats,
    log: new Array(3).fill(null).map((_, index) => ({
      id: `log-${index + 1}`,
      text: `真实结算日志 ${index + 1}`
    }))
  }
}

function createSettledSnapshot() {
  return createSnapshot(createState({
    bankerBase: 2,
    dealerSeat: 0,
    discardCount: 3,
    roundIndex: 2,
    seats: [
      createSeat(0, 100, {
        concealedTiles: createTiles([{ code: 'wan-1', label: '1万' }], 'draw-0')
      }),
      createSeat(1, 100, {
        concealedTiles: createTiles([{ code: 'wan-2', label: '2万' }], 'draw-1')
      }),
      createSeat(2, 100, {
        concealedTiles: createTiles([{ code: 'tong-2', label: '2筒' }], 'draw-2')
      }),
      createSeat(3, 100, {
        concealedTiles: createTiles([{ code: 'bamboo-2', label: '2条' }], 'draw-3')
      })
    ]
  }), {
    type: 'drawGame'
  })
}

function createFixture(options) {
  const settings = options || {}
  let snapshot = Object.prototype.hasOwnProperty.call(settings, 'snapshot') ? settings.snapshot : null
  const calls = {
    goTo: [],
    renderCount: 0
  }

  const manager = {
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

  const gameSession = {
    getSnapshot() {
      return snapshot
    }
  }

  return {
    calls,
    scene: createResultScene({
      manager,
      gameSession
    }),
    setSnapshot(nextSnapshot) {
      snapshot = nextSnapshot
    }
  }
}

test('result scene redirects home when no settled snapshot is available', () => {
  const { calls, scene } = createFixture({
    snapshot: null
  })

  assert.equal(scene.loadSnapshot(), false)
  assert.deepEqual(calls.goTo, [{ name: 'home', sceneOptions: undefined }])
})

test('result scene also redirects home for an unsettled snapshot object', () => {
  const { calls, scene } = createFixture({
    snapshot: {
      seats: [],
      log: []
    }
  })

  scene.enter()

  assert.deepEqual(calls.goTo, [{ name: 'home', sceneOptions: undefined }])
  assert.equal(scene.getState().navigating, false)
})

test('result scene loads a real discard-win snapshot into scene state', () => {
  const snapshot = createSnapshot(createState({
    bankerBase: 2,
    dealerSeat: 0,
    discardCount: 3,
    roundIndex: 4,
    seats: [
      createSeat(0, 100, {
        concealedTiles: createTiles([{ code: 'wan-9', label: '9万' }], 'seat-0-hand'),
        flowers: createFlowerTiles(3, 'seat-0-flower')
      }),
      createSeat(1, 100, {
        concealedTiles: createTiles([
          { code: 'wan-1', label: '1万' },
          { code: 'wan-2', label: '2万' }
        ], 'seat-1-hand'),
        flowers: createFlowerTiles(1, 'seat-1-flower')
      }),
      createSeat(2, 100, {
        concealedTiles: createTiles([{ code: 'tong-5', label: '5筒' }], 'seat-2-hand'),
        flowers: createFlowerTiles(1, 'seat-2-flower')
      }),
      createSeat(3, 100, {
        concealedTiles: createTiles([{ code: 'bamboo-7', label: '7条' }], 'seat-3-hand')
      })
    ]
  }), {
    type: 'discardWin',
    winnerSeat: 1,
    discarderSeat: 0,
    winningTile: createTile('wan-3', '3万', 'winning')
  })
  const { scene } = createFixture({ snapshot })

  scene.enter()

  const state = scene.getState()
  assert.equal(state.navigating, false)
  assert.equal(state.view.typeLabel, '点炮和')
  assert.equal(state.view.sourceSeatRoleLabel, '放炮')
  assert.equal(state.view.sourceSeatLabel, '你')
  assert.equal(state.view.replayButtonText, '下一局')
  assert.deepEqual(state.view.pairwiseTransferTexts, [
    '对家 向 你 支付 2 分番差',
    '左家 向 你 支付 3 分番差',
    '左家 向 对家 支付 1 分番差'
  ])
  assert.deepEqual(state.view.seatResults[1].concealedLabels, ['1万', '2万', '3万'])
  assert.equal(state.view.recentLogs.length, 3)
})

test('result scene replay navigation uses an explicit replay scene option and ignores repeated taps', () => {
  const { calls, scene } = createFixture({
    snapshot: createSettledSnapshot()
  })

  scene.enter()
  assert.equal(scene.onReplay(), true)
  assert.equal(scene.onReplay(), false)

  assert.deepEqual(calls.goTo, [{ name: 'table', sceneOptions: { replay: true } }])
  assert.equal(scene.getState().navigating, true)
})

test('result scene releases the navigating lock when replay navigation fails', () => {
  const { scene } = createFixture({
    snapshot: createSettledSnapshot(),
    goTo() {
      return false
    }
  })

  scene.enter()

  assert.equal(scene.onReplay(), false)
  assert.equal(scene.getState().navigating, false)
})

test('result scene releases the navigating lock when returning home fails', () => {
  const { scene } = createFixture({
    snapshot: createSettledSnapshot(),
    goTo() {
      return false
    }
  })

  scene.enter()

  assert.equal(scene.onBackHome(), false)
  assert.equal(scene.getState().navigating, false)
})

test('result scene routes successful home navigation through the manager', () => {
  const { calls, scene } = createFixture({
    snapshot: createSettledSnapshot()
  })

  scene.enter()
  assert.equal(scene.onBackHome(), true)

  assert.deepEqual(calls.goTo, [{ name: 'home', sceneOptions: undefined }])
  assert.equal(scene.getState().navigating, true)
})
