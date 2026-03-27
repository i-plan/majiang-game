const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '../../..')
const rulesPath = path.join(ROOT, 'minigame', 'game', 'config', 'rules', 'mvp')
const tileCatalogPath = path.join(ROOT, 'minigame', 'game', 'config', 'tileCatalog')
const wallModulePath = path.join(ROOT, 'minigame', 'game', 'core', 'wall')
const actionEvaluatorPath = path.join(ROOT, 'minigame', 'game', 'core', 'actionEvaluator')
const stateMachinePath = path.join(ROOT, 'minigame', 'game', 'core', 'stateMachine')
const winCheckerPath = path.join(ROOT, 'minigame', 'game', 'core', 'winChecker')

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

function loadCoreModulesWithPatchedWinChecker(options) {
  const resolvedActionEvaluatorPath = require.resolve(actionEvaluatorPath)
  const resolvedStateMachinePath = require.resolve(stateMachinePath)
  const resolvedWinCheckerPath = require.resolve(winCheckerPath)
  const settings = Object.assign({
    evaluateWin: () => ({ canHu: false }),
    getYouJinEntryCodes: () => []
  }, options)

  delete require.cache[resolvedActionEvaluatorPath]
  delete require.cache[resolvedStateMachinePath]
  delete require.cache[resolvedWinCheckerPath]

  const winChecker = require(resolvedWinCheckerPath)
  const originalEvaluateWin = winChecker.evaluateWin
  const originalGetYouJinEntryCodes = winChecker.getYouJinEntryCodes

  winChecker.evaluateWin = settings.evaluateWin
  winChecker.getYouJinEntryCodes = settings.getYouJinEntryCodes

  const actionEvaluator = require(resolvedActionEvaluatorPath)
  const stateMachine = require(resolvedStateMachinePath)

  return {
    actionEvaluator,
    stateMachine,
    restore() {
      winChecker.evaluateWin = originalEvaluateWin
      winChecker.getYouJinEntryCodes = originalGetYouJinEntryCodes
      delete require.cache[resolvedActionEvaluatorPath]
      delete require.cache[resolvedStateMachinePath]
      delete require.cache[resolvedWinCheckerPath]
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

function createPengMeld(code, fromSeat) {
  const picker = createTilePicker()

  return {
    type: 'peng',
    code,
    fromSeat,
    tiles: [picker.takeByCode(code), picker.takeByCode(code), picker.takeByCode(code)]
  }
}

function createDiscardReactionState(options) {
  const { evaluateDiscardResponses } = require(actionEvaluatorPath)
  const settings = Object.assign({
    discardSeat: 0,
    discardCode: 'wan-3',
    seatCodes: [[], [], [], []],
    seatOverrides: [{}, {}, {}, {}]
  }, options)
  const picker = createTilePicker()
  const state = createControlledTurnState({
    activeSeat: settings.discardSeat,
    turnStage: null,
    seatCodes: settings.seatCodes,
    seatOverrides: settings.seatOverrides,
    lastDrawSeatId: settings.discardSeat,
    lastDrawCode: ''
  })
  const discardTile = picker.takeByCode(settings.discardCode)

  state.phase = 'reaction'
  state.turnStage = null
  state.activeSeat = settings.discardSeat
  state.lastDiscardSeat = settings.discardSeat
  state.lastDiscardTile = discardTile
  state.seats[settings.discardSeat].discards = [discardTile]
  state.reactionWindow = evaluateDiscardResponses(state)

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

test('winChecker exposes gold-pair metadata for youJin entry and rejects double-gold pairs', () => {
  const { evaluateWin, getYouJinEntryCodes } = require(winCheckerPath)
  const cases = [
    {
      label: 'single gold pair',
      seatCodes: [[
        'wan-1', 'wan-2', 'wan-3',
        'tong-1', 'tong-2', 'tong-3',
        'bamboo-1', 'bamboo-2', 'bamboo-3',
        'bamboo-4', 'bamboo-5', 'bamboo-6',
        'east', 'east', 'east',
        'south', 'white'
      ], [], [], []],
      expected: {
        canHu: true,
        usesGold: true,
        pairMode: 'gold-pair',
        goldCount: 1,
        goldPairCodes: ['south'],
        entryCodes: ['south']
      }
    },
    {
      label: 'double gold pair',
      seatCodes: [[
        'wan-1', 'wan-2', 'wan-3',
        'tong-1', 'tong-2', 'tong-3',
        'bamboo-1', 'bamboo-2', 'bamboo-3',
        'bamboo-4', 'bamboo-5', 'bamboo-6',
        'east', 'east', 'east',
        'white', 'white'
      ], [], [], []],
      expected: {
        canHu: false,
        usesGold: false,
        pairMode: '',
        goldCount: 2,
        goldPairCodes: [],
        entryCodes: []
      }
    }
  ]

  cases.forEach(({ label, seatCodes, expected }) => {
    const state = createControlledTurnState({
      seatCodes,
      lastDrawCode: ''
    })
    const evaluation = evaluateWin(state, state.seats[0])

    assert.equal(evaluation.canHu, expected.canHu, `${label} should report the expected hu result`)
    assert.equal(evaluation.usesGold, expected.usesGold, `${label} should report the expected usesGold value`)
    assert.equal(evaluation.pairMode, expected.pairMode, `${label} should report the expected pairMode`)
    assert.equal(evaluation.goldCount, expected.goldCount, `${label} should report the expected gold count`)
    assert.deepEqual(evaluation.goldPairCodes, expected.goldPairCodes, `${label} should report the expected gold-pair candidates`)
    assert.deepEqual(getYouJinEntryCodes(state, state.seats[0]), expected.entryCodes, `${label} should expose the expected youJin entry codes`)
  })
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

test('getSelfActions exposes youJin enter and upgrade actions around hu priority', () => {
  const { actionEvaluator, restore } = loadCoreModulesWithPatchedWinChecker({
    evaluateWin: (_state, _seat, extraTile) => {
      if (extraTile) {
        return { canHu: false }
      }

      return {
        canHu: true,
        patternId: 'standard',
        patternLabel: '平胡'
      }
    },
    getYouJinEntryCodes: () => ['wan-4', 'tong-7']
  })

  try {
    const enterState = createControlledTurnState({
      seatCodes: [['wan-4', 'tong-7', 'white'], [], [], []],
      lastDrawCode: 'white'
    })
    const enterActions = actionEvaluator.getSelfActions(enterState, 0)
    const enterYouJinActions = enterActions.filter((action) => action.type === 'youJin')

    assert.equal(enterActions[0].type, 'hu')
    assert.deepEqual(
      enterYouJinActions.map((action) => ({ mode: action.mode, code: action.code, label: action.label })),
      [
        { mode: 'enter', code: 'wan-4', label: '游金 打 4万' },
        { mode: 'enter', code: 'tong-7', label: '游金 打 7筒' }
      ]
    )

    const upgradeState = createControlledTurnState({
      seatCodes: [['white', 'wan-1'], [], [], []],
      seatOverrides: [{
        youJinLevel: 1
      }, {}, {}, {}],
      lastDrawCode: 'white'
    })
    const upgradeActions = actionEvaluator.getSelfActions(upgradeState, 0)

    assert.deepEqual(upgradeActions.map((action) => action.type), ['hu', 'youJin'])
    assert.deepEqual(
      upgradeActions[1],
      Object.assign({}, upgradeActions[1], {
        mode: 'upgrade',
        nextLevel: 2,
        code: 'white',
        label: '双游'
      })
    )
  } finally {
    restore()
  }
})

test('applySelfAction enters youJin by discarding the declared tile and opening a discard reaction window', () => {
  const { actionEvaluator, stateMachine, restore } = loadCoreModulesWithPatchedWinChecker({
    evaluateWin: (_state, _seat, extraTile) => {
      if (extraTile) {
        return { canHu: false }
      }

      return {
        canHu: true,
        patternId: 'standard',
        patternLabel: '平胡'
      }
    },
    getYouJinEntryCodes: () => ['wan-4']
  })

  try {
    const state = createControlledTurnState({
      seatCodes: [
        ['wan-4', 'red'],
        ['wan-2', 'wan-3'],
        [],
        []
      ],
      seatOverrides: [{
        tianTingActive: true,
        tianTingEligible: true
      }, {}, {}, {}],
      lastDrawCode: 'red'
    })
    const youJinAction = actionEvaluator.getSelfActions(state, 0).find((action) => action.type === 'youJin' && action.mode === 'enter')

    assert.ok(youJinAction)
    assert.equal(youJinAction.code, 'wan-4')
    assert.equal(stateMachine.applySelfAction(state, 0, youJinAction), true)
    assert.equal(state.seats[0].youJinLevel, 1)
    assert.equal(state.seats[0].tianTingActive, false)
    assert.equal(state.seats[0].tianTingEligible, false)
    assert.equal(state.seats[0].concealedTiles.some((tile) => tile.code === 'wan-4'), false)
    assert.equal(state.seats[0].discards[state.seats[0].discards.length - 1].code, 'wan-4')
    assert.equal(state.lastDiscardTile.code, 'wan-4')
    assert.equal(state.lastDrawTile, null)
    assert.equal(state.phase, 'reaction')
    assert.equal(state.reactionWindow.fromSeat, 0)
    assert.equal(state.log.some((item) => item.text.includes('进入游金')), true)

    const prompt = stateMachine.getCurrentReactionPrompt(state)

    assert.ok(prompt)
    assert.equal(prompt.seatId, 1)
    assert.deepEqual(prompt.actions.map((action) => action.type), ['chi'])
  } finally {
    restore()
  }
})

test('applySelfAction upgrades youJin on a gold draw and continues to the next live draw when unclaimed', () => {
  const { actionEvaluator, stateMachine, restore } = loadCoreModulesWithPatchedWinChecker({
    evaluateWin: (_state, _seat, extraTile) => {
      if (extraTile) {
        return { canHu: false }
      }

      return { canHu: false }
    }
  })

  try {
    const state = createControlledTurnState({
      seatCodes: [['white', 'wan-1'], [], [], []],
      seatOverrides: [{
        youJinLevel: 1,
        tianTingActive: true,
        tianTingEligible: true
      }, {}, {}, {}],
      lastDrawCode: 'white'
    })
    const upgradeAction = actionEvaluator.getSelfActions(state, 0).find((action) => action.type === 'youJin' && action.mode === 'upgrade')

    assert.ok(upgradeAction)
    assert.equal(upgradeAction.nextLevel, 2)
    assert.equal(upgradeAction.label, '双游')
    assert.equal(stateMachine.applySelfAction(state, 0, upgradeAction), true)
    assert.equal(state.seats[0].youJinLevel, 2)
    assert.equal(state.seats[0].tianTingActive, false)
    assert.equal(state.seats[0].tianTingEligible, false)
    assert.equal(state.seats[0].concealedTiles.some((tile) => tile.code === 'white'), false)
    assert.equal(state.seats[0].discards[state.seats[0].discards.length - 1].code, 'white')
    assert.equal(state.lastDiscardSeat, 0)
    assert.equal(state.lastDiscardTile.code, 'white')
    assert.equal(state.phase, 'turn')
    assert.equal(state.reactionWindow, null)
    assert.equal(state.activeSeat, 1)
    assert.equal(state.turnStage, 'afterDraw')
    assert.ok(state.lastDrawTile)
    assert.equal(state.seats[1].concealedTiles.some((tile) => tile.id === state.lastDrawTile.id), true)
    assert.equal(state.log.some((item) => item.text.includes('进入双游')), true)
  } finally {
    restore()
  }
})

test('applySelfAction resolves a concealed gang into a supplement draw turn and clears tianTing', () => {
  const { getSelfActions } = require(actionEvaluatorPath)
  const { applySelfAction } = require(stateMachinePath)
  const state = createControlledTurnState({
    seatCodes: [['red', 'red', 'red', 'red', 'wan-1'], [], [], []],
    seatOverrides: [{
      tianTingActive: true,
      tianTingEligible: true
    }, {}, {}, {}],
    lastDrawCode: 'red'
  })
  const concealedGangAction = getSelfActions(state, 0).find((action) => action.type === 'gang' && action.mode === 'concealed' && action.code === 'red')

  assert.ok(concealedGangAction)
  assert.equal(applySelfAction(state, 0, concealedGangAction), true)
  assert.equal(state.phase, 'turn')
  assert.equal(state.reactionWindow, null)
  assert.equal(state.activeSeat, 0)
  assert.equal(state.turnStage, 'afterDraw')
  assert.equal(state.seats[0].tianTingActive, false)
  assert.equal(state.seats[0].tianTingEligible, false)
  assert.equal(state.seats[0].melds[0].type, 'gang')
  assert.equal(state.seats[0].melds[0].gangType, 'concealed')
  assert.equal(state.seats[0].melds[0].code, 'red')
  assert.deepEqual(state.seats[0].melds[0].tiles.map((tile) => tile.code), ['red', 'red', 'red', 'red'])
  assert.equal(state.seats[0].concealedTiles.length, 2)
  assert.equal(state.lastDrawSource, 'supplement')
  assert.ok(state.lastDrawTile)
  assert.equal(state.seats[0].concealedTiles.some((tile) => tile.id === state.lastDrawTile.id), true)
  assert.equal(state.log.some((item) => item.text.includes('暗杠')), true)
})

test('applyReactionAction resolves an ordinary hu claim into discardWin with the source seat preserved', () => {
  const { stateMachine, restore } = loadCoreModulesWithPatchedWinChecker({
    evaluateWin: (_state, seat, extraTile) => {
      if (extraTile && seat.seatId === 1) {
        return {
          canHu: true,
          patternId: 'standard',
          patternLabel: '平胡'
        }
      }

      return { canHu: false }
    }
  })

  try {
    const state = createDiscardReactionState({
      discardCode: 'wan-5',
      seatCodes: [[], [], [], []]
    })
    const prompt = stateMachine.getCurrentReactionPrompt(state)

    assert.ok(prompt)
    assert.equal(prompt.seatId, 1)
    assert.deepEqual(prompt.actions.map((action) => action.type), ['hu'])
    assert.equal(stateMachine.applyReactionAction(state, 1, prompt.actions[0]), true)
    assert.equal(state.phase, 'ended')
    assert.equal(state.result.type, 'discardWin')
    assert.equal(state.result.winnerSeat, 1)
    assert.equal(state.result.discarderSeat, 0)
    assert.equal(state.result.winningTileLabel, '5万')
    assert.equal(state.log.some((item) => item.text.includes('胡了 你 的 5万')), true)
  } finally {
    restore()
  }
})

test('passReaction cascades between multiple hu claimants and the later claimant can still win', () => {
  const { stateMachine, restore } = loadCoreModulesWithPatchedWinChecker({
    evaluateWin: (_state, seat, extraTile) => {
      if (extraTile && (seat.seatId === 1 || seat.seatId === 2)) {
        return {
          canHu: true,
          patternId: 'standard',
          patternLabel: '平胡'
        }
      }

      return { canHu: false }
    }
  })

  try {
    const state = createDiscardReactionState({
      discardCode: 'wan-5',
      seatCodes: [[], [], [], []]
    })
    let prompt = stateMachine.getCurrentReactionPrompt(state)

    assert.ok(prompt)
    assert.deepEqual(Object.keys(state.reactionWindow.optionsBySeat), ['1', '2'])
    assert.equal(prompt.seatId, 1)
    assert.deepEqual(prompt.actions.map((action) => action.type), ['hu'])
    assert.equal(stateMachine.passReaction(state, 1), true)
    assert.equal(state.phase, 'reaction')

    prompt = stateMachine.getCurrentReactionPrompt(state)

    assert.ok(prompt)
    assert.equal(prompt.seatId, 2)
    assert.deepEqual(prompt.actions.map((action) => action.type), ['hu'])
    assert.equal(stateMachine.applyReactionAction(state, 2, prompt.actions[0]), true)
    assert.equal(state.phase, 'ended')
    assert.equal(state.result.type, 'discardWin')
    assert.equal(state.result.winnerSeat, 2)
    assert.equal(state.result.discarderSeat, 0)
    assert.equal(state.result.winningTileLabel, '5万')
    assert.equal(state.log.some((item) => item.text.includes('选择过')), true)
    assert.equal(state.log.some((item) => item.text.includes('胡了 你 的 5万')), true)
  } finally {
    restore()
  }
})

test('applySelfAction opens a rob-gang reaction window and resolves qiangGang when another seat can hu', () => {
  const { getSelfActions } = require(actionEvaluatorPath)
  const { applySelfAction, applyReactionAction, getCurrentReactionPrompt } = require(stateMachinePath)
  const state = createControlledTurnState({
    seatCodes: [
      ['red', 'wan-1', 'wan-2'],
      ['wan-1', 'wan-2', 'wan-3', 'wan-1', 'wan-2', 'wan-3', 'wan-4', 'wan-5', 'wan-6', 'wan-7', 'wan-8', 'wan-9', 'red'],
      [],
      []
    ],
    seatOverrides: [
      {
        melds: [createPengMeld('red', 2)]
      },
      {
        melds: [createPengMeld('east', 3)]
      },
      {},
      {}
    ],
    lastDrawCode: 'red'
  })
  const addGangAction = getSelfActions(state, 0).find((action) => action.type === 'gang' && action.mode === 'add' && action.code === 'red')

  assert.ok(addGangAction)
  assert.equal(applySelfAction(state, 0, addGangAction), true)
  assert.equal(state.phase, 'reaction')
  assert.equal(state.reactionWindow.kind, 'robGang')
  assert.deepEqual(state.reactionWindow.pendingAction, { seatId: 0, code: 'red' })

  const prompt = getCurrentReactionPrompt(state)

  assert.equal(prompt.seatId, 1)
  assert.equal(prompt.actions.length, 1)
  assert.equal(prompt.actions[0].type, 'hu')
  assert.equal(applyReactionAction(state, 1, prompt.actions[0]), true)
  assert.equal(state.phase, 'ended')
  assert.equal(state.result.type, 'qiangGang')
  assert.equal(state.result.winnerSeat, 1)
  assert.equal(state.result.discarderSeat, 0)
  assert.equal(state.log.some((item) => item.text.includes('抢杠胡')), true)
})

test('passReaction finalizes add gang after all rob-gang claims are passed', () => {
  const { getSelfActions } = require(actionEvaluatorPath)
  const { applySelfAction, getCurrentReactionPrompt, passReaction } = require(stateMachinePath)
  const state = createControlledTurnState({
    seatCodes: [
      ['red', 'wan-1', 'wan-2'],
      ['wan-1', 'wan-2', 'wan-3', 'wan-1', 'wan-2', 'wan-3', 'wan-4', 'wan-5', 'wan-6', 'wan-7', 'wan-8', 'wan-9', 'red'],
      [],
      []
    ],
    seatOverrides: [
      {
        melds: [createPengMeld('red', 2)]
      },
      {
        melds: [createPengMeld('east', 3)]
      },
      {},
      {}
    ],
    lastDrawCode: 'red'
  })
  const addGangAction = getSelfActions(state, 0).find((action) => action.type === 'gang' && action.mode === 'add' && action.code === 'red')

  assert.ok(addGangAction)
  assert.equal(applySelfAction(state, 0, addGangAction), true)
  assert.equal(getCurrentReactionPrompt(state).seatId, 1)
  assert.equal(passReaction(state, 1), true)
  assert.equal(state.phase, 'turn')
  assert.equal(state.reactionWindow, null)
  assert.equal(state.activeSeat, 0)
  assert.equal(state.turnStage, 'afterDraw')
  assert.equal(state.result, null)
  assert.equal(state.seats[0].melds[0].type, 'gang')
  assert.equal(state.seats[0].melds[0].gangType, 'add')
  assert.equal(state.seats[0].concealedTiles.some((tile) => tile.code === 'red'), false)
  assert.equal(state.lastDrawSource, 'supplement')
  assert.ok(state.lastDrawTile)
  assert.equal(state.log.some((item) => item.text.includes('选择过')), true)
  assert.equal(state.log.some((item) => item.text.includes('补杠')), true)
})

test('applySelfAction finalizes add gang immediately when no seat can rob the gang', () => {
  const { getSelfActions } = require(actionEvaluatorPath)
  const { applySelfAction } = require(stateMachinePath)
  const state = createControlledTurnState({
    seatCodes: [
      ['red', 'wan-1', 'wan-2'],
      ['wan-1', 'wan-1', 'wan-1'],
      [],
      []
    ],
    seatOverrides: [
      {
        melds: [createPengMeld('red', 2)]
      },
      {
        melds: [createPengMeld('east', 3)]
      },
      {},
      {}
    ],
    lastDrawCode: 'red'
  })
  const addGangAction = getSelfActions(state, 0).find((action) => action.type === 'gang' && action.mode === 'add' && action.code === 'red')

  assert.ok(addGangAction)
  assert.equal(applySelfAction(state, 0, addGangAction), true)
  assert.equal(state.phase, 'turn')
  assert.equal(state.reactionWindow, null)
  assert.equal(state.activeSeat, 0)
  assert.equal(state.turnStage, 'afterDraw')
  assert.equal(state.result, null)
  assert.equal(state.seats[0].melds[0].type, 'gang')
  assert.equal(state.seats[0].melds[0].gangType, 'add')
  assert.equal(state.lastDrawSource, 'supplement')
  assert.ok(state.lastDrawTile)
})

test('passReaction cascades between peng claimants before chi and lets the later peng claimant take the turn', () => {
  const { passReaction, applyReactionAction, getCurrentReactionPrompt } = require(stateMachinePath)
  const state = createDiscardReactionState({
    discardCode: 'wan-5',
    seatCodes: [
      [],
      ['wan-4', 'wan-6', 'tong-1'],
      ['wan-5', 'wan-5', 'bamboo-1'],
      ['wan-5', 'wan-5', 'tong-2']
    ]
  })
  const firstPrompt = getCurrentReactionPrompt(state)

  assert.ok(firstPrompt)
  assert.equal(firstPrompt.seatId, 2)
  assert.deepEqual(firstPrompt.actions.map((action) => action.type), ['peng'])
  assert.equal(passReaction(state, 2), true)

  const secondPrompt = getCurrentReactionPrompt(state)

  assert.ok(secondPrompt)
  assert.equal(secondPrompt.seatId, 3)
  assert.deepEqual(secondPrompt.actions.map((action) => action.type), ['peng'])
  assert.equal(applyReactionAction(state, 3, secondPrompt.actions[0]), true)
  assert.equal(state.phase, 'turn')
  assert.equal(state.reactionWindow, null)
  assert.equal(state.activeSeat, 3)
  assert.equal(state.turnStage, 'afterClaim')
  assert.equal(state.lastDrawTile, null)
  assert.deepEqual(state.seats[3].melds.map((meld) => ({ type: meld.type, code: meld.code, fromSeat: meld.fromSeat })), [{
    type: 'peng',
    code: 'wan-5',
    fromSeat: 0
  }])
  assert.deepEqual(state.seats[3].melds[0].tiles.map((tile) => tile.code), ['wan-5', 'wan-5', 'wan-5'])
  assert.equal(state.seats[0].discards.length, 0)
  assert.equal(state.log.some((item) => item.text.includes('对家 选择过')), true)
  assert.equal(state.log.some((item) => item.text.includes('左家 碰 5万')), true)
})

test('applyReactionAction moves a chi claim into the claimer turn and removes the discard from the table', () => {
  const { applyReactionAction, getCurrentReactionPrompt } = require(stateMachinePath)
  const state = createDiscardReactionState({
    discardCode: 'wan-3',
    seatCodes: [
      [],
      ['wan-1', 'wan-2', 'wan-6'],
      [],
      []
    ]
  })
  const prompt = getCurrentReactionPrompt(state)

  assert.ok(prompt)
  assert.equal(prompt.seatId, 1)
  assert.deepEqual(prompt.actions.map((action) => action.type), ['chi'])
  assert.equal(applyReactionAction(state, 1, prompt.actions[0]), true)
  assert.equal(state.phase, 'turn')
  assert.equal(state.reactionWindow, null)
  assert.equal(state.activeSeat, 1)
  assert.equal(state.turnStage, 'afterClaim')
  assert.equal(state.lastDrawTile, null)
  assert.deepEqual(state.seats[1].melds.map((meld) => ({ type: meld.type, code: meld.code })), [{ type: 'chi', code: 'wan-3' }])
  assert.deepEqual(state.seats[1].melds[0].tiles.map((tile) => tile.code), ['wan-1', 'wan-2', 'wan-3'])
  assert.equal(state.seats[0].discards.length, 0)
})

test('applyReactionAction resolves a melded gang claim into a supplement draw turn', () => {
  const { applyReactionAction, getCurrentReactionPrompt } = require(stateMachinePath)
  const state = createDiscardReactionState({
    discardCode: 'wan-5',
    seatCodes: [
      [],
      ['wan-5', 'wan-5', 'wan-5'],
      [],
      []
    ]
  })
  const prompt = getCurrentReactionPrompt(state)
  const gangAction = prompt && prompt.actions.find((action) => action.type === 'gang')

  assert.ok(gangAction)
  assert.equal(applyReactionAction(state, 1, gangAction), true)
  assert.equal(state.phase, 'turn')
  assert.equal(state.reactionWindow, null)
  assert.equal(state.activeSeat, 1)
  assert.equal(state.turnStage, 'afterDraw')
  assert.equal(state.lastDrawSource, 'supplement')
  assert.ok(state.lastDrawTile)
  assert.equal(state.seats[0].discards.length, 0)
  assert.deepEqual(state.seats[1].melds.map((meld) => ({ type: meld.type, gangType: meld.gangType, code: meld.code })), [{
    type: 'gang',
    gangType: 'melded',
    code: 'wan-5'
  }])
})

test('passReaction ends the round as a draw game when no claims remain and only 16 tiles are left', () => {
  const { getCurrentReactionPrompt, passReaction } = require(stateMachinePath)
  const state = createDiscardReactionState({
    discardCode: 'wan-3',
    seatCodes: [
      [],
      ['wan-1', 'wan-2'],
      [],
      []
    ]
  })

  state.wall = {
    tiles: new Array(rules.dealing.drawStopRemaining).fill(null),
    liveIndex: 0,
    supplementIndex: rules.dealing.drawStopRemaining - 1
  }

  assert.equal(getCurrentReactionPrompt(state).seatId, 1)
  assert.equal(passReaction(state, 1), false)
  assert.equal(state.phase, 'ended')
  assert.equal(state.result.type, 'drawGame')
  assert.equal(state.log.some((item) => item.text.includes('流局')), true)
})
