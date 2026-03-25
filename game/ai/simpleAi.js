const { getTileMeta, isTerminalTile } = require('../config/tileCatalog')

function buildCounts(codes) {
  return codes.reduce((counts, code) => {
    counts[code] = (counts[code] || 0) + 1
    return counts
  }, {})
}

function removeCodes(codes, codesToRemove) {
  const nextCodes = codes.slice()

  codesToRemove.forEach((targetCode) => {
    const index = nextCodes.indexOf(targetCode)
    if (index >= 0) {
      nextCodes.splice(index, 1)
    }
  })

  return nextCodes
}

function scoreHandCodes(codes) {
  const counts = buildCounts(codes)
  let score = 0

  Object.keys(counts).forEach((code) => {
    const count = counts[code]
    const meta = getTileMeta(code)

    if (!meta) {
      return
    }

    if (count >= 3) {
      score += 9
    } else if (count === 2) {
      score += 4
    } else {
      score += 1
    }

    if (meta.category === 'honor') {
      if (count === 1) {
        score -= 4
      }
      return
    }

    if (meta.category !== 'suit') {
      return
    }

    const left1 = counts[`${meta.suit}-${meta.rank - 1}`] || 0
    const left2 = counts[`${meta.suit}-${meta.rank - 2}`] || 0
    const right1 = counts[`${meta.suit}-${meta.rank + 1}`] || 0
    const right2 = counts[`${meta.suit}-${meta.rank + 2}`] || 0

    if (left1) {
      score += 2
    }

    if (right1) {
      score += 2
    }

    if (left2 && left1) {
      score += 1
    }

    if (right1 && right2) {
      score += 1
    }

    if (count === 1 && !left1 && !right1 && !left2 && !right2) {
      score -= isTerminalTile(code) ? 3 : 2
    }
  })

  return score
}

function chooseTurnAction(state, seatId, actions) {
  const youJinAction = actions.find((action) => action.type === 'youJin')
  if (youJinAction) {
    return youJinAction
  }

  const huAction = actions.find((action) => action.type === 'hu')
  if (huAction) {
    return huAction
  }

  const gangAction = actions.find((action) => action.type === 'gang')
  if (gangAction) {
    return gangAction
  }

  return null
}

function evaluateClaimBenefit(state, seatId, action) {
  const seat = state.seats[seatId]
  const currentCodes = seat.concealedTiles.map((tile) => tile.code)
  const currentScore = scoreHandCodes(currentCodes)

  if (action.type === 'gang') {
    return 8
  }

  if (action.type === 'peng') {
    const nextScore = scoreHandCodes(removeCodes(currentCodes, [action.code, action.code]))
    return nextScore + 6 - currentScore
  }

  if (action.type === 'chi') {
    const nextScore = scoreHandCodes(removeCodes(currentCodes, action.consumeCodes))
    return nextScore + 4 - currentScore
  }

  return -999
}

function chooseReactionAction(state, seatId, actions) {
  const huAction = actions.find((action) => action.type === 'hu')
  if (huAction) {
    return huAction
  }

  const gangAction = actions.find((action) => action.type === 'gang')
  if (gangAction) {
    return gangAction
  }

  const scored = actions
    .filter((action) => action.type === 'peng' || action.type === 'chi')
    .map((action) => ({
      action,
      value: evaluateClaimBenefit(state, seatId, action) + Math.random() * 0.15
    }))
    .sort((left, right) => right.value - left.value)

  if (!scored.length) {
    return null
  }

  return scored[0].value >= 0 ? scored[0].action : null
}

function chooseDiscardTile(state, seatId) {
  const seat = state.seats[seatId]

  if (state.turnStage === 'afterDraw' && state.lastDrawTile && (seat.youJinLevel > 0 || seat.tianTingActive)) {
    return state.lastDrawTile.id
  }

  const candidates = seat.concealedTiles.map((tile) => {
    const remainingCodes = seat.concealedTiles
      .filter((candidate) => candidate.id !== tile.id)
      .map((candidate) => candidate.code)

    return {
      tileId: tile.id,
      value: scoreHandCodes(remainingCodes) + Math.random() * 0.25
    }
  }).sort((left, right) => right.value - left.value)

  return candidates.length ? candidates[0].tileId : ''
}

module.exports = {
  chooseDiscardTile,
  chooseReactionAction,
  chooseTurnAction,
  scoreHandCodes
}
