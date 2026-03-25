const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const stateMachinePath = path.join(ROOT, 'game', 'core', 'stateMachine')
const gameSessionPath = path.join(ROOT, 'game', 'runtime', 'gameSession')

function createSeat(seatId, score) {
  return {
    seatId,
    score
  }
}

function createState(options) {
  const stateOptions = options || {}

  return {
    version: 0,
    phase: stateOptions.phase || 'turn',
    turnStage: stateOptions.turnStage || 'afterDraw',
    roundIndex: stateOptions.roundIndex || 1,
    dealerSeat: typeof stateOptions.dealerSeat === 'number' ? stateOptions.dealerSeat : 0,
    bankerBase: typeof stateOptions.bankerBase === 'number' ? stateOptions.bankerBase : 10,
    activeSeat: typeof stateOptions.activeSeat === 'number' ? stateOptions.activeSeat : 0,
    seats: (stateOptions.scores || [100, 100, 100, 100]).map((score, seatId) => createSeat(seatId, score)),
    result: stateOptions.result || null,
    reactionWindow: null,
    discardCount: 0,
    lastDiscardTile: null,
    lastDiscardSeat: null,
    lastDrawTile: { id: 'last-draw', code: 'wan-1', label: '1万' },
    lastDrawSource: 'live',
    goldTileCode: '',
    goldTileLabel: '',
    goldDice: [],
    goldDiceTotal: 0,
    wall: { liveIndex: 0, supplementIndex: 30 },
    log: []
  }
}

function loadGameSessionWithPatchedStartRound(startRoundImpl) {
  const resolvedStateMachinePath = require.resolve(stateMachinePath)
  const resolvedGameSessionPath = require.resolve(gameSessionPath)

  delete require.cache[resolvedGameSessionPath]
  delete require.cache[resolvedStateMachinePath]

  const stateMachine = require(resolvedStateMachinePath)
  const originalStartRound = stateMachine.startRound

  stateMachine.startRound = startRoundImpl

  const gameSession = require(resolvedGameSessionPath)

  return {
    gameSession,
    restore() {
      stateMachine.startRound = originalStartRound
      delete require.cache[resolvedGameSessionPath]
      delete require.cache[resolvedStateMachinePath]
    }
  }
}

test('startNextRound continues from result.nextDealerSeat and result.nextScores when the match is not ended', () => {
  const calls = []
  const endedRound = createState({
    roundIndex: 3,
    dealerSeat: 0,
    bankerBase: 10,
    scores: [95, 105, 100, 100],
    result: {
      matchEnded: false,
      nextDealerSeat: 2,
      nextScores: [90, 110, 100, 100]
    }
  })
  const nextRound = createState({
    roundIndex: 4,
    dealerSeat: 2,
    bankerBase: 10,
    scores: [90, 110, 100, 100],
    result: null
  })
  const { gameSession, restore } = loadGameSessionWithPatchedStartRound((rules, options) => {
    calls.push(options)
    return calls.length === 1 ? endedRound : nextRound
  })

  try {
    gameSession.startNewMatch({ bankerBase: 10 })
    const snapshot = gameSession.startNextRound()

    assert.deepEqual(calls[1], {
      bankerBase: 10,
      dealerSeat: 2,
      roundIndex: 4,
      initialScores: [90, 110, 100, 100]
    })
    assert.equal(snapshot.roundIndex, 4)
    assert.equal(snapshot.dealerSeat, 2)
    assert.deepEqual(snapshot.seats.map((seat) => seat.score), [90, 110, 100, 100])
    assert.equal(snapshot.result, null)
  } finally {
    restore()
  }
})

test('startNextRound resets to a fresh match after matchEnded becomes true', () => {
  const calls = []
  const endedMatch = createState({
    roundIndex: 8,
    dealerSeat: 1,
    bankerBase: 2,
    scores: [0, 150, 120, 130],
    result: {
      matchEnded: true,
      nextDealerSeat: 3,
      nextScores: [0, 150, 120, 130]
    }
  })
  const freshMatch = createState({
    roundIndex: 1,
    dealerSeat: 0,
    bankerBase: 2,
    scores: [100, 100, 100, 100],
    result: null
  })
  const { gameSession, restore } = loadGameSessionWithPatchedStartRound((rules, options) => {
    calls.push(options)
    return calls.length === 1 ? endedMatch : freshMatch
  })

  try {
    gameSession.startNewMatch({ bankerBase: 2 })
    const snapshot = gameSession.startNextRound()

    assert.deepEqual(calls[1], {
      bankerBase: 2,
      dealerSeat: 0,
      roundIndex: 1
    })
    assert.equal(snapshot.roundIndex, 1)
    assert.equal(snapshot.dealerSeat, 0)
    assert.equal(snapshot.bankerBase, 2)
    assert.deepEqual(snapshot.seats.map((seat) => seat.score), [100, 100, 100, 100])
    assert.equal(snapshot.result, null)
  } finally {
    restore()
  }
})
