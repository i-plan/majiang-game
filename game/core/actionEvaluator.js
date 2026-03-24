const { getTileLabel, getTileMeta } = require('../config/tileCatalog')
const { canHuForSeat } = require('./winChecker')

function nextSeatId(state, seatId) {
  return (seatId + 1) % state.seats.length
}

function buildCountMap(tiles) {
  return tiles.reduce((counts, tile) => {
    counts[tile.code] = (counts[tile.code] || 0) + 1
    return counts
  }, {})
}

function getPriority(state, type) {
  return state.rules.claimPriority[type] || 0
}

function buildActionLabel(action) {
  if (action.type === 'hu') {
    return '胡'
  }

  if (action.type === 'peng') {
    return `碰 ${getTileLabel(action.code)}`
  }

  if (action.type === 'gang') {
    if (action.mode === 'concealed') {
      return `暗杠 ${getTileLabel(action.code)}`
    }

    if (action.mode === 'add') {
      return `补杠 ${getTileLabel(action.code)}`
    }

    return `明杠 ${getTileLabel(action.code)}`
  }

  if (action.type === 'chi') {
    return `吃 ${action.consumeCodes.map(getTileLabel).join(' ')}`
  }

  return action.type
}

function sortActions(actions) {
  return actions.slice().sort((left, right) => {
    if (right.priority !== left.priority) {
      return right.priority - left.priority
    }

    return left.label.localeCompare(right.label, 'zh-Hans-CN')
  })
}

function createAction(state, action) {
  return Object.assign({}, action, {
    priority: getPriority(state, action.type),
    label: buildActionLabel(action)
  })
}

function getSelfActions(state, seatId) {
  if (!state || state.phase !== 'turn' || state.reactionWindow || state.activeSeat !== seatId) {
    return []
  }

  if (state.turnStage !== 'afterDraw') {
    return []
  }

  const seat = state.seats[seatId]
  const actions = []
  const counts = buildCountMap(seat.concealedTiles)

  if (canHuForSeat(seat)) {
    actions.push(createAction(state, {
      type: 'hu',
      seatId,
      source: 'self'
    }))
  }

  if (state.rules.allowConcealedGang) {
    Object.keys(counts).forEach((code) => {
      if (counts[code] === 4) {
        actions.push(createAction(state, {
          type: 'gang',
          seatId,
          mode: 'concealed',
          code
        }))
      }
    })
  }

  if (state.rules.allowAddGang) {
    seat.melds.forEach((meld) => {
      if (meld.type === 'peng' && counts[meld.code] >= 1) {
        actions.push(createAction(state, {
          type: 'gang',
          seatId,
          mode: 'add',
          code: meld.code
        }))
      }
    })
  }

  return sortActions(actions)
}

function getChiActions(state, seatId, discardTile, fromSeat) {
  const meta = getTileMeta(discardTile)

  if (!meta || meta.category !== 'suit') {
    return []
  }

  const seat = state.seats[seatId]
  const counts = buildCountMap(seat.concealedTiles)
  const patterns = [
    [meta.rank - 2, meta.rank - 1],
    [meta.rank - 1, meta.rank + 1],
    [meta.rank + 1, meta.rank + 2]
  ]
  const actions = []
  const seen = {}

  patterns.forEach((ranks) => {
    if (ranks.some((rank) => rank < 1 || rank > 9)) {
      return
    }

    const consumeCodes = ranks.map((rank) => `${meta.suit}-${rank}`)
    const cacheKey = consumeCodes.join('|')

    if (seen[cacheKey]) {
      return
    }

    if (consumeCodes.every((code) => counts[code] > 0)) {
      seen[cacheKey] = true
      actions.push(createAction(state, {
        type: 'chi',
        seatId,
        fromSeat,
        targetCode: discardTile.code,
        consumeCodes
      }))
    }
  })

  return actions
}

function getReactionActionsForSeat(state, seatId, discardTile, fromSeat) {
  const seat = state.seats[seatId]
  const counts = buildCountMap(seat.concealedTiles)
  const actions = []

  if (canHuForSeat(seat, discardTile)) {
    actions.push(createAction(state, {
      type: 'hu',
      seatId,
      fromSeat,
      source: 'discard',
      code: discardTile.code
    }))
  }

  if (state.rules.allowMeldedGang && counts[discardTile.code] >= 3) {
    actions.push(createAction(state, {
      type: 'gang',
      seatId,
      fromSeat,
      mode: 'melded',
      code: discardTile.code
    }))
  }

  if (state.rules.allowPeng && counts[discardTile.code] >= 2) {
    actions.push(createAction(state, {
      type: 'peng',
      seatId,
      fromSeat,
      code: discardTile.code
    }))
  }

  if (state.rules.allowChi && seatId === nextSeatId(state, fromSeat)) {
    actions.push(...getChiActions(state, seatId, discardTile, fromSeat))
  }

  return sortActions(actions)
}

function evaluateDiscardResponses(state) {
  if (!state || !state.lastDiscardTile || typeof state.lastDiscardSeat !== 'number') {
    return null
  }

  const optionsBySeat = {}

  state.seats.forEach((seat) => {
    if (seat.seatId === state.lastDiscardSeat) {
      return
    }

    const actions = getReactionActionsForSeat(state, seat.seatId, state.lastDiscardTile, state.lastDiscardSeat)
    if (actions.length) {
      optionsBySeat[seat.seatId] = actions
    }
  })

  if (!Object.keys(optionsBySeat).length) {
    return null
  }

  return {
    discardTile: state.lastDiscardTile,
    fromSeat: state.lastDiscardSeat,
    optionsBySeat,
    passedSeats: []
  }
}

function getRemainingSeatActions(reactionWindow, seatId) {
  if (!reactionWindow || reactionWindow.passedSeats.indexOf(seatId) >= 0) {
    return []
  }

  return reactionWindow.optionsBySeat[seatId] || []
}

function getCurrentReactionPrompt(state) {
  if (!state || !state.reactionWindow) {
    return null
  }

  const candidates = []

  Object.keys(state.reactionWindow.optionsBySeat).forEach((key) => {
    const seatId = Number(key)
    const actions = getRemainingSeatActions(state.reactionWindow, seatId)

    if (!actions.length) {
      return
    }

    candidates.push({
      seatId,
      priority: actions[0].priority
    })
  })

  if (!candidates.length) {
    return null
  }

  const highestPriority = Math.max.apply(null, candidates.map((item) => item.priority))
  const highestSeats = candidates.filter((item) => item.priority === highestPriority)
  const chosenSeat = highestSeats.sort((left, right) => {
    const leftDistance = (left.seatId - state.reactionWindow.fromSeat + state.seats.length) % state.seats.length
    const rightDistance = (right.seatId - state.reactionWindow.fromSeat + state.seats.length) % state.seats.length
    return leftDistance - rightDistance
  })[0]

  const actions = getRemainingSeatActions(state.reactionWindow, chosenSeat.seatId)
    .filter((action) => action.priority === highestPriority)

  return {
    seatId: chosenSeat.seatId,
    fromSeat: state.reactionWindow.fromSeat,
    discardTile: state.reactionWindow.discardTile,
    actions: sortActions(actions)
  }
}

function isSameAction(left, right) {
  if (!left || !right) {
    return false
  }

  if (left.type !== right.type || left.mode !== right.mode || left.code !== right.code) {
    return false
  }

  const leftCodes = left.consumeCodes || []
  const rightCodes = right.consumeCodes || []

  if (leftCodes.length !== rightCodes.length) {
    return false
  }

  return leftCodes.every((code, index) => code === rightCodes[index])
}

module.exports = {
  evaluateDiscardResponses,
  getCurrentReactionPrompt,
  getReactionActionsForSeat,
  getSelfActions,
  isSameAction,
  sortActions
}
