const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '../../..')
const rules = require(path.join(ROOT, 'minigame', 'game', 'config', 'rules', 'mvp'))

const actionEvaluatorPath = path.join(ROOT, 'minigame', 'game', 'core', 'actionEvaluator')
const winCheckerPath = path.join(ROOT, 'minigame', 'game', 'core', 'winChecker')

function createTile(code, label, seatId, index) {
  return {
    id: `${seatId}-${index}-${code}`,
    code,
    label
  }
}

function createSeat(seatId, tileSpecs) {
  return {
    seatId,
    concealedTiles: tileSpecs.map((tile, index) => createTile(tile.code, tile.label, seatId, index)),
    melds: [],
    flowers: [],
    discards: [],
    score: 100,
    youJinLevel: 0,
    tianTingActive: false
  }
}

function loadActionEvaluatorWithWinChecker(options) {
  const resolvedActionEvaluatorPath = require.resolve(actionEvaluatorPath)
  const resolvedWinCheckerPath = require.resolve(winCheckerPath)
  const settings = Object.assign({
    evaluateWin: () => ({ canHu: false }),
    getYouJinEntryCodes: () => []
  }, options)

  delete require.cache[resolvedActionEvaluatorPath]
  delete require.cache[resolvedWinCheckerPath]

  const winChecker = require(resolvedWinCheckerPath)
  const originalEvaluateWin = winChecker.evaluateWin
  const originalGetYouJinEntryCodes = winChecker.getYouJinEntryCodes

  winChecker.evaluateWin = settings.evaluateWin
  winChecker.getYouJinEntryCodes = settings.getYouJinEntryCodes

  const actionEvaluator = require(resolvedActionEvaluatorPath)

  return {
    actionEvaluator,
    restore() {
      winChecker.evaluateWin = originalEvaluateWin
      winChecker.getYouJinEntryCodes = originalGetYouJinEntryCodes
      delete require.cache[resolvedActionEvaluatorPath]
      delete require.cache[resolvedWinCheckerPath]
    }
  }
}

function loadActionEvaluatorWithoutHu() {
  return loadActionEvaluatorWithWinChecker()
}

function loadActionEvaluatorWithHu() {
  return loadActionEvaluatorWithWinChecker({
    evaluateWin: () => ({
      canHu: true,
      patternId: 'standard',
      patternLabel: '平胡'
    })
  })
}

test('discard responses prioritize higher claims, then nearest seat, then cascade after passes', () => {
  const { actionEvaluator, restore } = loadActionEvaluatorWithoutHu()

  try {
    const state = {
      rules,
      seats: [
        createSeat(0, []),
        createSeat(1, [
          { code: 'wan-4', label: '4万' },
          { code: 'wan-6', label: '6万' }
        ]),
        createSeat(2, [
          { code: 'wan-5', label: '5万' },
          { code: 'wan-5', label: '5万' }
        ]),
        createSeat(3, [
          { code: 'wan-5', label: '5万' },
          { code: 'wan-5', label: '5万' }
        ])
      ],
      lastDiscardTile: createTile('wan-5', '5万', 'discard', 0),
      lastDiscardSeat: 0
    }

    state.reactionWindow = actionEvaluator.evaluateDiscardResponses(state)
    assert.ok(state.reactionWindow)
    assert.deepEqual(Object.keys(state.reactionWindow.optionsBySeat), ['1', '2', '3'])

    let prompt = actionEvaluator.getCurrentReactionPrompt(state)
    assert.equal(prompt.seatId, 2)
    assert.deepEqual(prompt.actions.map((action) => action.type), ['peng'])

    state.reactionWindow.passedSeats.push(2)
    prompt = actionEvaluator.getCurrentReactionPrompt(state)
    assert.equal(prompt.seatId, 3)
    assert.deepEqual(prompt.actions.map((action) => action.type), ['peng'])

    state.reactionWindow.passedSeats.push(3)
    prompt = actionEvaluator.getCurrentReactionPrompt(state)
    assert.equal(prompt.seatId, 1)
    assert.deepEqual(prompt.actions.map((action) => action.type), ['chi'])

    state.reactionWindow.passedSeats.push(1)
    assert.equal(actionEvaluator.getCurrentReactionPrompt(state), null)
  } finally {
    restore()
  }
})

test('discard responses keep multiple chi options distinct and stably ordered', () => {
  const { actionEvaluator, restore } = loadActionEvaluatorWithoutHu()

  try {
    const state = {
      rules,
      seats: [
        createSeat(0, []),
        createSeat(1, [
          { code: 'wan-2', label: '2万' },
          { code: 'wan-3', label: '3万' },
          { code: 'wan-5', label: '5万' },
          { code: 'wan-6', label: '6万' }
        ]),
        createSeat(2, []),
        createSeat(3, [])
      ],
      lastDiscardTile: createTile('wan-4', '4万', 'discard', 0),
      lastDiscardSeat: 0
    }

    state.reactionWindow = actionEvaluator.evaluateDiscardResponses(state)
    const prompt = actionEvaluator.getCurrentReactionPrompt(state)

    assert.ok(prompt)
    assert.equal(prompt.seatId, 1)
    assert.deepEqual(prompt.actions.map((action) => action.type), ['chi', 'chi', 'chi'])
    assert.deepEqual(prompt.actions.map((action) => action.label), [
      '吃 2万 3万',
      '吃 3万 5万',
      '吃 5万 6万'
    ])
  } finally {
    restore()
  }
})

test('getCurrentReactionPrompt keeps only the highest-priority actions for the chosen seat', () => {
  const { actionEvaluator, restore } = loadActionEvaluatorWithoutHu()

  try {
    const state = {
      rules,
      seats: [
        createSeat(0, []),
        createSeat(1, []),
        createSeat(2, []),
        createSeat(3, [])
      ],
      reactionWindow: {
        fromSeat: 0,
        discardTile: createTile('wan-5', '5万', 'discard', 0),
        optionsBySeat: {
          1: [
            { type: 'hu', priority: 300, label: '胡' },
            { type: 'gang', priority: 200, label: '杠 5万' },
            { type: 'peng', priority: 200, label: '碰 5万' }
          ],
          2: [
            { type: 'chi', priority: 100, label: '吃 4万 6万' }
          ]
        },
        passedSeats: []
      }
    }

    const prompt = actionEvaluator.getCurrentReactionPrompt(state)

    assert.ok(prompt)
    assert.equal(prompt.seatId, 1)
    assert.deepEqual(prompt.actions.map((action) => action.type), ['hu'])
    assert.deepEqual(prompt.actions.map((action) => action.label), ['胡'])
  } finally {
    restore()
  }
})

test('getCurrentReactionPrompt keeps same-priority gang and peng actions while excluding lower-priority chi', () => {
  const { actionEvaluator, restore } = loadActionEvaluatorWithoutHu()

  try {
    const state = {
      rules,
      seats: [
        createSeat(0, []),
        createSeat(1, []),
        createSeat(2, []),
        createSeat(3, [])
      ],
      reactionWindow: {
        fromSeat: 0,
        discardTile: createTile('wan-5', '5万', 'discard', 0),
        optionsBySeat: {
          1: [
            { type: 'gang', priority: 200, label: '杠 5万' },
            { type: 'peng', priority: 200, label: '碰 5万' },
            { type: 'chi', priority: 100, label: '吃 4万 6万' }
          ]
        },
        passedSeats: []
      }
    }

    const prompt = actionEvaluator.getCurrentReactionPrompt(state)

    assert.ok(prompt)
    assert.equal(prompt.seatId, 1)
    assert.deepEqual(prompt.actions.map((action) => action.type), ['gang', 'peng'])
    assert.deepEqual(prompt.actions.map((action) => action.label), ['杠 5万', '碰 5万'])
  } finally {
    restore()
  }
})

test('reaction hu is blocked only after another seat reaches double youJin', () => {
  const { actionEvaluator, restore } = loadActionEvaluatorWithHu()

  try {
    const state = {
      rules,
      seats: [
        createSeat(0, []),
        createSeat(1, []),
        createSeat(2, []),
        createSeat(3, [])
      ],
      lastDiscardTile: createTile('wan-5', '5万', 'discard', 0),
      lastDiscardSeat: 0
    }

    state.seats[2].youJinLevel = 1
    let actions = actionEvaluator.getReactionActionsForSeat(state, 1, state.lastDiscardTile, state.lastDiscardSeat)
    assert.deepEqual(actions.map((action) => action.type), ['hu'])

    state.seats[2].youJinLevel = 2
    actions = actionEvaluator.getReactionActionsForSeat(state, 1, state.lastDiscardTile, state.lastDiscardSeat)
    assert.deepEqual(actions, [])
  } finally {
    restore()
  }
})

test('self hu is blocked by another seat triple youJin unless the draw came from supplement', () => {
  const { actionEvaluator, restore } = loadActionEvaluatorWithHu()

  try {
    const state = {
      rules,
      phase: 'turn',
      reactionWindow: null,
      activeSeat: 1,
      turnStage: 'afterDraw',
      lastDrawTile: createTile('wan-5', '5万', 'draw', 0),
      lastDrawSource: 'live',
      goldTileCode: 'white',
      seats: [
        createSeat(0, []),
        createSeat(1, []),
        createSeat(2, []),
        createSeat(3, [])
      ]
    }

    state.seats[0].youJinLevel = 2
    let actions = actionEvaluator.getSelfActions(state, 1)
    assert.deepEqual(actions.map((action) => action.type), ['hu'])

    state.seats[0].youJinLevel = 3
    actions = actionEvaluator.getSelfActions(state, 1)
    assert.deepEqual(actions, [])

    state.lastDrawSource = 'supplement'
    actions = actionEvaluator.getSelfActions(state, 1)
    assert.deepEqual(actions.map((action) => action.type), ['hu'])
  } finally {
    restore()
  }
})
