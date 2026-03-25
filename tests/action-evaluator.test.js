const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const rules = require(path.join(ROOT, 'game', 'config', 'rules', 'mvp'))

const actionEvaluatorPath = path.join(ROOT, 'game', 'core', 'actionEvaluator')
const winCheckerPath = path.join(ROOT, 'game', 'core', 'winChecker')

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

function loadActionEvaluatorWithoutHu() {
  const resolvedActionEvaluatorPath = require.resolve(actionEvaluatorPath)
  const resolvedWinCheckerPath = require.resolve(winCheckerPath)

  delete require.cache[resolvedActionEvaluatorPath]
  delete require.cache[resolvedWinCheckerPath]

  const winChecker = require(resolvedWinCheckerPath)
  const originalEvaluateWin = winChecker.evaluateWin
  const originalGetYouJinEntryCodes = winChecker.getYouJinEntryCodes

  winChecker.evaluateWin = () => ({ canHu: false })
  winChecker.getYouJinEntryCodes = () => []

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
