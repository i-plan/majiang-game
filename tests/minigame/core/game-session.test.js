const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '../../..')
const actionEvaluatorPath = path.join(ROOT, 'minigame', 'game', 'core', 'actionEvaluator')
const simpleAiPath = path.join(ROOT, 'minigame', 'game', 'ai', 'simpleAi')
const stateMachinePath = path.join(ROOT, 'minigame', 'game', 'core', 'stateMachine')
const gameSessionPath = path.join(ROOT, 'minigame', 'game', 'runtime', 'gameSession')

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

function loadGameSessionWithPatchedDependencies(overrides) {
  const resolvedActionEvaluatorPath = require.resolve(actionEvaluatorPath)
  const resolvedSimpleAiPath = require.resolve(simpleAiPath)
  const resolvedStateMachinePath = require.resolve(stateMachinePath)
  const resolvedGameSessionPath = require.resolve(gameSessionPath)

  delete require.cache[resolvedGameSessionPath]
  delete require.cache[resolvedStateMachinePath]
  delete require.cache[resolvedActionEvaluatorPath]
  delete require.cache[resolvedSimpleAiPath]

  const stateMachine = require(resolvedStateMachinePath)
  const actionEvaluator = require(resolvedActionEvaluatorPath)
  const simpleAi = require(resolvedSimpleAiPath)
  const originalImplementations = {
    startRound: stateMachine.startRound,
    discardTile: stateMachine.discardTile,
    applySelfAction: stateMachine.applySelfAction,
    applyReactionAction: stateMachine.applyReactionAction,
    passReaction: stateMachine.passReaction,
    getCurrentReactionPrompt: stateMachine.getCurrentReactionPrompt,
    getSelfActions: actionEvaluator.getSelfActions,
    chooseTurnAction: simpleAi.chooseTurnAction,
    chooseReactionAction: simpleAi.chooseReactionAction,
    chooseDiscardTile: simpleAi.chooseDiscardTile
  }

  Object.keys(overrides).forEach((key) => {
    if (key in stateMachine) {
      stateMachine[key] = overrides[key]
      return
    }

    if (key in actionEvaluator) {
      actionEvaluator[key] = overrides[key]
      return
    }

    if (key in simpleAi) {
      simpleAi[key] = overrides[key]
    }
  })

  const gameSession = require(resolvedGameSessionPath)

  return {
    gameSession,
    restore() {
      stateMachine.startRound = originalImplementations.startRound
      stateMachine.discardTile = originalImplementations.discardTile
      stateMachine.applySelfAction = originalImplementations.applySelfAction
      stateMachine.applyReactionAction = originalImplementations.applyReactionAction
      stateMachine.passReaction = originalImplementations.passReaction
      stateMachine.getCurrentReactionPrompt = originalImplementations.getCurrentReactionPrompt
      actionEvaluator.getSelfActions = originalImplementations.getSelfActions
      simpleAi.chooseTurnAction = originalImplementations.chooseTurnAction
      simpleAi.chooseReactionAction = originalImplementations.chooseReactionAction
      simpleAi.chooseDiscardTile = originalImplementations.chooseDiscardTile
      delete require.cache[resolvedGameSessionPath]
      delete require.cache[resolvedStateMachinePath]
      delete require.cache[resolvedActionEvaluatorPath]
      delete require.cache[resolvedSimpleAiPath]
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

test('startNextRound falls back to a fresh match when there is no settled result and preserves banker-base settings', () => {
  {
    const calls = []
    const freshMatch = createState({
      roundIndex: 1,
      dealerSeat: 0,
      bankerBase: 10,
      scores: [100, 100, 100, 100],
      result: null
    })
    const { gameSession, restore } = loadGameSessionWithPatchedStartRound((rules, options) => {
      calls.push(options)
      return freshMatch
    })

    try {
      const snapshot = gameSession.startNextRound()

      assert.deepEqual(calls[0], {
        bankerBase: 10,
        dealerSeat: 0,
        roundIndex: 1
      })
      assert.equal(snapshot.roundIndex, 1)
      assert.equal(snapshot.dealerSeat, 0)
      assert.equal(snapshot.bankerBase, 10)
      assert.deepEqual(snapshot.seats.map((seat) => seat.score), [100, 100, 100, 100])
      assert.equal(snapshot.result, null)
    } finally {
      restore()
    }
  }

  {
    const calls = []
    const liveRound = createState({
      roundIndex: 4,
      dealerSeat: 2,
      bankerBase: 2,
      scores: [95, 105, 100, 100],
      result: null
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
      return calls.length === 1 ? liveRound : freshMatch
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
  }
})

test('startNewRound reuses the latest normalized banker-base setting', () => {
  {
    const calls = []
    const roundTwo = createState({
      roundIndex: 1,
      dealerSeat: 0,
      bankerBase: 2,
      scores: [100, 100, 100, 100],
      result: null
    })
    const roundTen = createState({
      roundIndex: 1,
      dealerSeat: 0,
      bankerBase: 10,
      scores: [100, 100, 100, 100],
      result: null
    })
    const restartTen = createState({
      roundIndex: 1,
      dealerSeat: 0,
      bankerBase: 10,
      scores: [100, 100, 100, 100],
      result: null
    })
    const { gameSession, restore } = loadGameSessionWithPatchedStartRound((rules, options) => {
      calls.push(options)
      if (calls.length === 1) {
        return roundTwo
      }
      if (calls.length === 2) {
        return roundTen
      }
      return restartTen
    })

    try {
      gameSession.startNewMatch({ bankerBase: 2 })
      gameSession.startNewMatch({ bankerBase: 10 })
      const snapshot = gameSession.startNewRound()

      assert.deepEqual(calls.map((call) => call.bankerBase), [2, 10, 10])
      assert.equal(snapshot.roundIndex, 1)
      assert.equal(snapshot.bankerBase, 10)
    } finally {
      restore()
    }
  }

  {
    const calls = []
    const normalizedDefault = createState({
      roundIndex: 1,
      dealerSeat: 0,
      bankerBase: 10,
      scores: [100, 100, 100, 100],
      result: null
    })
    const restartedDefault = createState({
      roundIndex: 1,
      dealerSeat: 0,
      bankerBase: 10,
      scores: [100, 100, 100, 100],
      result: null
    })
    const { gameSession, restore } = loadGameSessionWithPatchedStartRound((rules, options) => {
      calls.push(options)
      return calls.length === 1 ? normalizedDefault : restartedDefault
    })

    try {
      const firstSnapshot = gameSession.startNewMatch({ bankerBase: 999 })
      const restartedSnapshot = gameSession.startNewRound()

      assert.deepEqual(calls.map((call) => call.bankerBase), [10, 10])
      assert.equal(firstSnapshot.bankerBase, 10)
      assert.equal(restartedSnapshot.bankerBase, 10)
    } finally {
      restore()
    }
  }
})

test('subscribe notifies listeners on emitted changes and stops after unsubscribe', () => {
  const calls = []
  const initialRound = createState({
    roundIndex: 1,
    dealerSeat: 0,
    bankerBase: 10,
    scores: [100, 100, 100, 100],
    result: null
  })
  const endedRound = createState({
    roundIndex: 1,
    dealerSeat: 0,
    bankerBase: 10,
    scores: [95, 105, 100, 100],
    result: {
      matchEnded: false,
      nextDealerSeat: 1,
      nextScores: [90, 110, 100, 100]
    }
  })
  const nextRound = createState({
    roundIndex: 2,
    dealerSeat: 1,
    bankerBase: 10,
    scores: [90, 110, 100, 100],
    result: null
  })
  const freshMatch = createState({
    roundIndex: 1,
    dealerSeat: 0,
    bankerBase: 10,
    scores: [100, 100, 100, 100],
    result: null
  })
  const { gameSession, restore } = loadGameSessionWithPatchedStartRound((rules, options) => {
    calls.push(options)
    if (calls.length === 1) {
      return initialRound
    }
    if (calls.length === 2) {
      return nextRound
    }
    return freshMatch
  })

  let notified = 0
  const unsubscribe = gameSession.subscribe(() => {
    notified += 1
  })

  try {
    gameSession.startNewMatch({ bankerBase: 10 })

    assert.equal(notified, 1)

    endedRound.result = {
      matchEnded: false,
      nextDealerSeat: 1,
      nextScores: [90, 110, 100, 100]
    }
    initialRound.result = endedRound.result
    initialRound.seats = endedRound.seats

    gameSession.startNextRound()

    assert.equal(notified, 2)

    unsubscribe()
    gameSession.startNewRound()

    assert.equal(notified, 2)
  } finally {
    restore()
  }
})

test('advanceAi stops when the current reaction prompt belongs to the human seat', () => {
  const roundState = createState({
    bankerBase: 10,
    activeSeat: 2
  })
  let chooseReactionCalls = 0
  let discardCalls = 0
  const { gameSession, restore } = loadGameSessionWithPatchedDependencies({
    startRound: () => roundState,
    getCurrentReactionPrompt: () => ({
      seatId: 0,
      actions: [{ type: 'hu', label: '胡' }]
    }),
    chooseReactionAction: () => {
      chooseReactionCalls += 1
      return null
    },
    discardTile: () => {
      discardCalls += 1
      return true
    }
  })

  try {
    gameSession.startNewMatch({ bankerBase: 10 })

    let notified = 0
    const unsubscribe = gameSession.subscribe(() => {
      notified += 1
    })

    try {
      const changed = gameSession.advanceAi()

      assert.equal(changed, false)
      assert.equal(chooseReactionCalls, 0)
      assert.equal(discardCalls, 0)
      assert.equal(notified, 0)
      assert.equal(gameSession.getSnapshot().version, 1)
    } finally {
      unsubscribe()
    }
  } finally {
    restore()
  }
})

test('advanceAi applies an ai self action before considering discard and emits once', () => {
  const roundState = createState({
    bankerBase: 10,
    activeSeat: 2
  })
  const appliedActions = []
  let selfActionLookups = 0
  let chooseTurnCalls = 0
  let chooseDiscardCalls = 0
  let discardCalls = 0
  const { gameSession, restore } = loadGameSessionWithPatchedDependencies({
    startRound: () => roundState,
    getCurrentReactionPrompt: () => null,
    getSelfActions: (state, seatId) => {
      selfActionLookups += 1
      assert.equal(seatId, 2)
      return [{ type: 'gang', label: '杠' }]
    },
    chooseTurnAction: (state, seatId, actions) => {
      chooseTurnCalls += 1
      assert.equal(seatId, 2)
      assert.deepEqual(actions, [{ type: 'gang', label: '杠' }])
      return actions[0]
    },
    applySelfAction: (state, seatId, action) => {
      appliedActions.push({ seatId, type: action.type })
      state.activeSeat = 0
      state.turnStage = 'afterDraw'
      return true
    },
    chooseDiscardTile: () => {
      chooseDiscardCalls += 1
      return 'unexpected-discard'
    },
    discardTile: () => {
      discardCalls += 1
      return true
    }
  })

  try {
    gameSession.startNewMatch({ bankerBase: 10 })

    let notified = 0
    const unsubscribe = gameSession.subscribe(() => {
      notified += 1
    })

    try {
      const changed = gameSession.advanceAi()

      assert.equal(changed, true)
      assert.equal(notified, 1)
      assert.equal(selfActionLookups, 1)
      assert.equal(chooseTurnCalls, 1)
      assert.equal(chooseDiscardCalls, 0)
      assert.equal(discardCalls, 0)
      assert.deepEqual(appliedActions, [{ seatId: 2, type: 'gang' }])
      assert.equal(gameSession.getSnapshot().activeSeat, 0)
      assert.equal(gameSession.getSnapshot().version, 2)
    } finally {
      unsubscribe()
    }
  } finally {
    restore()
  }
})

test('advanceAi treats a failed ai self action as a no-op without emit or retries', () => {
  const roundState = createState({
    bankerBase: 10,
    activeSeat: 2
  })
  const selfAction = { type: 'gang', label: '杠' }
  let selfActionLookups = 0
  let chooseTurnCalls = 0
  let applySelfCalls = 0
  let chooseDiscardCalls = 0
  const { gameSession, restore } = loadGameSessionWithPatchedDependencies({
    startRound: () => roundState,
    getCurrentReactionPrompt: () => null,
    getSelfActions: () => {
      selfActionLookups += 1
      return [selfAction]
    },
    chooseTurnAction: (state, seatId, actions) => {
      chooseTurnCalls += 1
      assert.equal(seatId, 2)
      assert.deepEqual(actions, [selfAction])
      return actions[0]
    },
    applySelfAction: (state, seatId, action) => {
      applySelfCalls += 1
      assert.equal(seatId, 2)
      assert.equal(action, selfAction)
      return false
    },
    chooseDiscardTile: () => {
      chooseDiscardCalls += 1
      return 'unexpected-discard'
    },
    discardTile: () => {
      assert.fail('未预期执行 discardTile')
    }
  })

  try {
    gameSession.startNewMatch({ bankerBase: 10 })

    let notified = 0
    const unsubscribe = gameSession.subscribe(() => {
      notified += 1
    })

    try {
      const changed = gameSession.advanceAi()

      assert.equal(changed, false)
      assert.equal(notified, 0)
      assert.equal(selfActionLookups, 1)
      assert.equal(chooseTurnCalls, 1)
      assert.equal(applySelfCalls, 1)
      assert.equal(chooseDiscardCalls, 0)
      assert.equal(gameSession.getSnapshot().activeSeat, 2)
      assert.equal(gameSession.getSnapshot().version, 1)
    } finally {
      unsubscribe()
    }
  } finally {
    restore()
  }
})

test('advanceAi lets ai apply a reaction action and then stops on the human turn with one emit', () => {
  const roundState = createState({
    bankerBase: 10,
    activeSeat: 3
  })
  const reactionChoices = []
  const appliedReactions = []
  const reactionAction = { type: 'peng', label: '碰' }
  const { gameSession, restore } = loadGameSessionWithPatchedDependencies({
    startRound: () => roundState,
    getCurrentReactionPrompt: () => {
      if (roundState.activeSeat === 0) {
        return null
      }

      return {
        seatId: 2,
        actions: [reactionAction]
      }
    },
    chooseReactionAction: (state, seatId, actions) => {
      reactionChoices.push({ seatId, actionTypes: actions.map((action) => action.type) })
      return actions[0]
    },
    applyReactionAction: (state, seatId, action) => {
      appliedReactions.push({ seatId, type: action.type })
      state.activeSeat = 0
      return true
    },
    passReaction: () => {
      assert.fail('未预期执行 passReaction')
    },
    chooseTurnAction: () => {
      assert.fail('未预期执行 chooseTurnAction')
    },
    chooseDiscardTile: () => {
      assert.fail('未预期执行 chooseDiscardTile')
    }
  })

  try {
    gameSession.startNewMatch({ bankerBase: 10 })

    let notified = 0
    const unsubscribe = gameSession.subscribe(() => {
      notified += 1
    })

    try {
      const changed = gameSession.advanceAi()

      assert.equal(changed, true)
      assert.equal(notified, 1)
      assert.deepEqual(reactionChoices, [{ seatId: 2, actionTypes: ['peng'] }])
      assert.deepEqual(appliedReactions, [{ seatId: 2, type: 'peng' }])
      assert.equal(gameSession.getSnapshot().activeSeat, 0)
      assert.equal(gameSession.getSnapshot().version, 2)
    } finally {
      unsubscribe()
    }
  } finally {
    restore()
  }
})

test('advanceAi treats a failed ai reaction action as a no-op without emit or retries', () => {
  const roundState = createState({
    bankerBase: 10,
    activeSeat: 3
  })
  const reactionAction = { type: 'peng', label: '碰' }
  let chooseReactionCalls = 0
  let applyReactionCalls = 0
  let chooseTurnCalls = 0
  const { gameSession, restore } = loadGameSessionWithPatchedDependencies({
    startRound: () => roundState,
    getCurrentReactionPrompt: () => ({
      seatId: 2,
      actions: [reactionAction]
    }),
    chooseReactionAction: (state, seatId, actions) => {
      chooseReactionCalls += 1
      assert.equal(seatId, 2)
      assert.deepEqual(actions, [reactionAction])
      return actions[0]
    },
    applyReactionAction: (state, seatId, action) => {
      applyReactionCalls += 1
      assert.equal(seatId, 2)
      assert.equal(action, reactionAction)
      return false
    },
    passReaction: () => {
      assert.fail('未预期执行 passReaction')
    },
    chooseTurnAction: () => {
      chooseTurnCalls += 1
      return null
    },
    chooseDiscardTile: () => {
      assert.fail('未预期执行 chooseDiscardTile')
    }
  })

  try {
    gameSession.startNewMatch({ bankerBase: 10 })

    let notified = 0
    const unsubscribe = gameSession.subscribe(() => {
      notified += 1
    })

    try {
      const changed = gameSession.advanceAi()

      assert.equal(changed, false)
      assert.equal(notified, 0)
      assert.equal(chooseReactionCalls, 1)
      assert.equal(applyReactionCalls, 1)
      assert.equal(chooseTurnCalls, 0)
      assert.equal(gameSession.getSnapshot().activeSeat, 3)
      assert.equal(gameSession.getSnapshot().version, 1)
    } finally {
      unsubscribe()
    }
  } finally {
    restore()
  }
})

test('advanceAi lets ai pass a reaction prompt and then stops for the human prompt with one emit', () => {
  const roundState = createState({
    bankerBase: 10,
    activeSeat: 3
  })
  roundState.promptIndex = 0
  const reactionChoices = []
  const passedSeats = []
  const { gameSession, restore } = loadGameSessionWithPatchedDependencies({
    startRound: () => roundState,
    getCurrentReactionPrompt: (state) => {
      if (state.promptIndex === 0) {
        return {
          seatId: 2,
          actions: [{ type: 'peng', label: '碰' }]
        }
      }

      if (state.promptIndex === 1) {
        return {
          seatId: 0,
          actions: [{ type: 'hu', label: '胡' }]
        }
      }

      return null
    },
    chooseReactionAction: (state, seatId, actions) => {
      reactionChoices.push({ seatId, actionTypes: actions.map((action) => action.type) })
      return null
    },
    passReaction: (state, seatId) => {
      passedSeats.push(seatId)
      state.promptIndex += 1
      return true
    },
    applyReactionAction: () => {
      assert.fail('未预期执行 applyReactionAction')
    },
    chooseTurnAction: () => {
      assert.fail('未预期执行 chooseTurnAction')
    },
    chooseDiscardTile: () => {
      assert.fail('未预期执行 chooseDiscardTile')
    }
  })

  try {
    gameSession.startNewMatch({ bankerBase: 10 })

    let notified = 0
    const unsubscribe = gameSession.subscribe(() => {
      notified += 1
    })

    try {
      const changed = gameSession.advanceAi()

      assert.equal(changed, true)
      assert.equal(notified, 1)
      assert.deepEqual(reactionChoices, [{ seatId: 2, actionTypes: ['peng'] }])
      assert.deepEqual(passedSeats, [2])
      assert.equal(gameSession.getSnapshot().version, 2)
    } finally {
      unsubscribe()
    }
  } finally {
    restore()
  }
})

test('advanceAi discards for an ai seat when no self action is available and then stops on the human turn', () => {
  const roundState = createState({
    bankerBase: 10,
    activeSeat: 3
  })
  const discardedTiles = []
  let selfActionLookups = 0
  let chooseTurnCalls = 0
  let chooseDiscardCalls = 0
  const { gameSession, restore } = loadGameSessionWithPatchedDependencies({
    startRound: () => roundState,
    getCurrentReactionPrompt: () => null,
    getSelfActions: () => {
      selfActionLookups += 1
      return []
    },
    chooseTurnAction: () => {
      chooseTurnCalls += 1
      return null
    },
    chooseDiscardTile: (state, seatId) => {
      chooseDiscardCalls += 1
      assert.equal(seatId, 3)
      return 'ai-discard-tile'
    },
    discardTile: (state, seatId, tileId) => {
      discardedTiles.push({ seatId, tileId })
      state.activeSeat = 0
      return true
    }
  })

  try {
    gameSession.startNewMatch({ bankerBase: 10 })

    let notified = 0
    const unsubscribe = gameSession.subscribe(() => {
      notified += 1
    })

    try {
      const changed = gameSession.advanceAi()

      assert.equal(changed, true)
      assert.equal(notified, 1)
      assert.equal(selfActionLookups, 1)
      assert.equal(chooseTurnCalls, 1)
      assert.equal(chooseDiscardCalls, 1)
      assert.deepEqual(discardedTiles, [{ seatId: 3, tileId: 'ai-discard-tile' }])
      assert.equal(gameSession.getSnapshot().activeSeat, 0)
      assert.equal(gameSession.getSnapshot().version, 2)
    } finally {
      unsubscribe()
    }
  } finally {
    restore()
  }
})

test('human action wrappers forward HUMAN_SEAT and only emit when the state actually changes', () => {
  const cases = [
    {
      label: 'discardHumanTile',
      methodName: 'discardHumanTile',
      overrideName: 'discardTile',
      args: ['tile-1']
    },
    {
      label: 'takeHumanSelfAction',
      methodName: 'takeHumanSelfAction',
      overrideName: 'applySelfAction',
      args: [{ type: 'gang', label: '杠' }]
    },
    {
      label: 'takeHumanReaction',
      methodName: 'takeHumanReaction',
      overrideName: 'applyReactionAction',
      args: [{ type: 'hu', label: '胡' }]
    },
    {
      label: 'passHumanReaction',
      methodName: 'passHumanReaction',
      overrideName: 'passReaction',
      args: []
    }
  ]

  cases.forEach(({ label, methodName, overrideName, args }) => {
    const noStateCalls = []
    const missingState = loadGameSessionWithPatchedDependencies({
      [overrideName]: (...callArgs) => {
        noStateCalls.push(callArgs)
        return true
      }
    })

    try {
      assert.equal(missingState.gameSession[methodName](...args), false, `${label} should fail without state`)
      assert.deepEqual(noStateCalls, [], `${label} should not call core methods without state`)
    } finally {
      missingState.restore()
    }

    const roundState = createState({ bankerBase: 10 })
    const forwardedCalls = []
    const patchedSession = loadGameSessionWithPatchedDependencies({
      startRound: () => roundState,
      [overrideName]: (...callArgs) => {
        forwardedCalls.push(callArgs)
        return forwardedCalls.length > 1
      }
    })

    try {
      patchedSession.gameSession.startNewMatch({ bankerBase: 10 })

      let notified = 0
      const unsubscribe = patchedSession.gameSession.subscribe(() => {
        notified += 1
      })

      try {
        assert.equal(patchedSession.gameSession.getSnapshot().version, 1)
        assert.equal(patchedSession.gameSession[methodName](...args), false, `${label} should return false when core state does not change`)
        assert.equal(notified, 0, `${label} should not emit on a no-op core result`)
        assert.equal(patchedSession.gameSession.getSnapshot().version, 1)

        assert.equal(patchedSession.gameSession[methodName](...args), true, `${label} should return true when core state changes`)
        assert.equal(notified, 1, `${label} should emit once when core state changes`)
        assert.equal(patchedSession.gameSession.getSnapshot().version, 2)
        assert.equal(forwardedCalls.length, 2)

        forwardedCalls.forEach((callArgs) => {
          assert.equal(callArgs[0], roundState)
          assert.deepEqual(callArgs.slice(1), [0].concat(args))
        })
      } finally {
        unsubscribe()
      }
    } finally {
      patchedSession.restore()
    }
  })
})
