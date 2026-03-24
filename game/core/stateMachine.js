const { sortTiles, isFlowerTile } = require('../config/tileCatalog')
const { createWall, drawLiveTile, drawSupplementTile, getRemainingCount } = require('./wall')
const { evaluateDiscardResponses, getCurrentReactionPrompt, getSelfActions, isSameAction } = require('./actionEvaluator')
const { buildRoundResult } = require('./settlement')

const WINDS = ['东', '南', '西', '北']
const SEAT_LABELS = ['玩家', '右家AI', '对家AI', '左家AI']

function getSeatLabel(seatId) {
  return SEAT_LABELS[seatId] || `座位${seatId + 1}`
}

function createSeat(seatId) {
  return {
    seatId,
    wind: WINDS[seatId] || '',
    isHuman: seatId === 0,
    concealedTiles: [],
    melds: [],
    flowers: [],
    discards: [],
    score: 0
  }
}

function pushLog(state, text) {
  state.logCounter += 1
  state.log.unshift({
    id: `log-${state.logCounter}`,
    text
  })
  state.log = state.log.slice(0, 18)
}

function sortSeatCollections(seat) {
  seat.concealedTiles = sortTiles(seat.concealedTiles)
  seat.flowers = sortTiles(seat.flowers)
}

function createBaseState(rules) {
  return {
    rules: JSON.parse(JSON.stringify(rules)),
    phase: 'turn',
    version: 0,
    dealerSeat: rules.fixedDealerSeat || 0,
    activeSeat: rules.fixedDealerSeat || 0,
    turnStage: null,
    wall: createWall(rules),
    seats: Array.from({ length: rules.seatCount }, (_, seatId) => createSeat(seatId)),
    lastDrawTile: null,
    lastDiscardTile: null,
    lastDiscardSeat: null,
    reactionWindow: null,
    result: null,
    log: [],
    logCounter: 0
  }
}

function drawBySource(state, source) {
  return source === 'supplement' ? drawSupplementTile(state.wall) : drawLiveTile(state.wall)
}

function drawResolvedTile(state, seatId, source, options) {
  const settings = Object.assign({ logDraw: true }, options)
  const seat = state.seats[seatId]
  let currentSource = source

  while (true) {
    const tile = drawBySource(state, currentSource)

    if (!tile) {
      return null
    }

    if (isFlowerTile(tile)) {
      seat.flowers.push(tile)
      sortSeatCollections(seat)

      if (settings.logDraw) {
        pushLog(state, `${getSeatLabel(seatId)} 补花 ${tile.label}`)
      }

      currentSource = 'supplement'
      continue
    }

    seat.concealedTiles.push(tile)
    sortSeatCollections(seat)
    state.lastDrawTile = tile

    if (settings.logDraw) {
      const actionText = currentSource === 'supplement' ? '补牌' : '摸牌'
      pushLog(state, `${getSeatLabel(seatId)} ${actionText}`)
    }

    return tile
  }
}

function removeTileById(seat, tileId) {
  const index = seat.concealedTiles.findIndex((tile) => tile.id === tileId)

  if (index < 0) {
    return null
  }

  return seat.concealedTiles.splice(index, 1)[0]
}

function removeTilesByCodes(seat, codes) {
  const removed = []

  for (let index = 0; index < codes.length; index += 1) {
    const code = codes[index]
    const tileIndex = seat.concealedTiles.findIndex((tile) => tile.code === code)

    if (tileIndex < 0) {
      return null
    }

    removed.push(seat.concealedTiles.splice(tileIndex, 1)[0])
  }

  sortSeatCollections(seat)
  return removed
}

function takeClaimedDiscard(state) {
  if (typeof state.lastDiscardSeat !== 'number' || !state.lastDiscardTile) {
    return null
  }

  const discards = state.seats[state.lastDiscardSeat].discards
  const discardIndex = discards.findIndex((tile) => tile.id === state.lastDiscardTile.id)

  if (discardIndex >= 0) {
    return discards.splice(discardIndex, 1)[0]
  }

  return state.lastDiscardTile
}

function finishRound(state, outcome) {
  state.phase = 'ended'
  state.turnStage = null
  state.reactionWindow = null
  state.result = buildRoundResult(state, outcome)

  if (outcome.type === 'selfDraw') {
    pushLog(state, `${getSeatLabel(outcome.winnerSeat)} 自摸胡牌`)
  } else if (outcome.type === 'discardWin') {
    pushLog(state, `${getSeatLabel(outcome.winnerSeat)} 胡了 ${getSeatLabel(outcome.discarderSeat)} 的 ${outcome.winningTile.label}`)
  } else {
    pushLog(state, '牌墙耗尽，本局流局')
  }
}

function advanceToNextLiveDraw(state) {
  state.reactionWindow = null
  state.phase = 'turn'
  state.turnStage = 'afterDraw'
  state.activeSeat = (state.lastDiscardSeat + 1) % state.seats.length

  const tile = drawResolvedTile(state, state.activeSeat, 'live', { logDraw: true })

  if (!tile) {
    finishRound(state, { type: 'drawGame' })
    return false
  }

  return true
}

function startRound(rules) {
  const state = createBaseState(rules)

  pushLog(state, '新的一局开始')
  pushLog(state, `${getSeatLabel(state.dealerSeat)} 坐庄`)

  for (let round = 0; round < 13; round += 1) {
    for (let seatId = 0; seatId < state.seats.length; seatId += 1) {
      if (!drawResolvedTile(state, seatId, 'live', { logDraw: false })) {
        finishRound(state, { type: 'drawGame' })
        return state
      }
    }
  }

  state.activeSeat = state.dealerSeat
  state.turnStage = 'afterDraw'

  if (!drawResolvedTile(state, state.dealerSeat, 'live', { logDraw: false })) {
    finishRound(state, { type: 'drawGame' })
    return state
  }

  pushLog(state, `${getSeatLabel(state.dealerSeat)} 先手`)
  return state
}

function discardTile(state, seatId, tileId) {
  if (!state || state.phase !== 'turn' || state.reactionWindow || state.activeSeat !== seatId) {
    return false
  }

  const seat = state.seats[seatId]
  const tile = removeTileById(seat, tileId)

  if (!tile) {
    return false
  }

  seat.discards.push(tile)
  sortSeatCollections(seat)
  state.lastDiscardTile = tile
  state.lastDiscardSeat = seatId
  state.lastDrawTile = null
  state.turnStage = null

  pushLog(state, `${getSeatLabel(seatId)} 打出 ${tile.label}`)

  const reactionWindow = evaluateDiscardResponses(state)

  if (reactionWindow) {
    state.phase = 'reaction'
    state.reactionWindow = reactionWindow
    return true
  }

  return advanceToNextLiveDraw(state)
}

function applyConcealedGang(state, seatId, action) {
  const seat = state.seats[seatId]
  const removed = removeTilesByCodes(seat, [action.code, action.code, action.code, action.code])

  if (!removed) {
    return false
  }

  seat.melds.push({
    type: 'gang',
    gangType: 'concealed',
    code: action.code,
    fromSeat: seatId,
    tiles: sortTiles(removed)
  })

  pushLog(state, `${getSeatLabel(seatId)} 暗杠 ${removed[0].label}`)

  const drawn = drawResolvedTile(state, seatId, 'supplement', { logDraw: true })
  if (!drawn) {
    finishRound(state, { type: 'drawGame' })
    return true
  }

  state.phase = 'turn'
  state.turnStage = 'afterDraw'
  state.activeSeat = seatId
  return true
}

function applyAddGang(state, seatId, action) {
  const seat = state.seats[seatId]
  const meldIndex = seat.melds.findIndex((meld) => meld.type === 'peng' && meld.code === action.code)

  if (meldIndex < 0) {
    return false
  }

  const removed = removeTilesByCodes(seat, [action.code])

  if (!removed) {
    return false
  }

  seat.melds[meldIndex] = Object.assign({}, seat.melds[meldIndex], {
    type: 'gang',
    gangType: 'add',
    tiles: sortTiles(seat.melds[meldIndex].tiles.concat(removed))
  })

  pushLog(state, `${getSeatLabel(seatId)} 补杠 ${removed[0].label}`)

  const drawn = drawResolvedTile(state, seatId, 'supplement', { logDraw: true })
  if (!drawn) {
    finishRound(state, { type: 'drawGame' })
    return true
  }

  state.phase = 'turn'
  state.turnStage = 'afterDraw'
  state.activeSeat = seatId
  return true
}

function applySelfAction(state, seatId, action) {
  if (!state || state.phase !== 'turn' || state.activeSeat !== seatId || state.reactionWindow) {
    return false
  }

  const validAction = getSelfActions(state, seatId).find((candidate) => isSameAction(candidate, action))

  if (!validAction) {
    return false
  }

  if (validAction.type === 'hu') {
    finishRound(state, {
      type: 'selfDraw',
      winnerSeat: seatId,
      winningTile: state.lastDrawTile
    })
    return true
  }

  if (validAction.type === 'gang' && validAction.mode === 'concealed') {
    return applyConcealedGang(state, seatId, validAction)
  }

  if (validAction.type === 'gang' && validAction.mode === 'add') {
    return applyAddGang(state, seatId, validAction)
  }

  return false
}

function moveToClaimTurn(state, seatId) {
  state.phase = 'turn'
  state.reactionWindow = null
  state.activeSeat = seatId
  state.turnStage = 'afterClaim'
  state.lastDrawTile = null
}

function applyPengClaim(state, seatId, action) {
  const seat = state.seats[seatId]
  const claimedTile = takeClaimedDiscard(state)
  const removed = removeTilesByCodes(seat, [action.code, action.code])

  if (!claimedTile || !removed) {
    return false
  }

  seat.melds.push({
    type: 'peng',
    code: action.code,
    fromSeat: action.fromSeat,
    tiles: sortTiles(removed.concat(claimedTile))
  })

  pushLog(state, `${getSeatLabel(seatId)} 碰 ${claimedTile.label}`)
  moveToClaimTurn(state, seatId)
  return true
}

function applyChiClaim(state, seatId, action) {
  const seat = state.seats[seatId]
  const claimedTile = takeClaimedDiscard(state)
  const removed = removeTilesByCodes(seat, action.consumeCodes)

  if (!claimedTile || !removed) {
    return false
  }

  seat.melds.push({
    type: 'chi',
    code: action.targetCode,
    fromSeat: action.fromSeat,
    tiles: sortTiles(removed.concat(claimedTile))
  })

  pushLog(state, `${getSeatLabel(seatId)} 吃 ${removed.concat(claimedTile).map((tile) => tile.label).join(' ')}`)
  moveToClaimTurn(state, seatId)
  return true
}

function applyMeldedGangClaim(state, seatId, action) {
  const seat = state.seats[seatId]
  const claimedTile = takeClaimedDiscard(state)
  const removed = removeTilesByCodes(seat, [action.code, action.code, action.code])

  if (!claimedTile || !removed) {
    return false
  }

  seat.melds.push({
    type: 'gang',
    gangType: 'melded',
    code: action.code,
    fromSeat: action.fromSeat,
    tiles: sortTiles(removed.concat(claimedTile))
  })

  pushLog(state, `${getSeatLabel(seatId)} 明杠 ${claimedTile.label}`)

  state.phase = 'turn'
  state.reactionWindow = null
  state.activeSeat = seatId
  state.turnStage = 'afterDraw'

  const drawn = drawResolvedTile(state, seatId, 'supplement', { logDraw: true })
  if (!drawn) {
    finishRound(state, { type: 'drawGame' })
  }

  return true
}

function applyReactionAction(state, seatId, action) {
  if (!state || state.phase !== 'reaction' || !state.reactionWindow) {
    return false
  }

  const prompt = getCurrentReactionPrompt(state)

  if (!prompt || prompt.seatId !== seatId) {
    return false
  }

  const validAction = prompt.actions.find((candidate) => isSameAction(candidate, action))

  if (!validAction) {
    return false
  }

  if (validAction.type === 'hu') {
    finishRound(state, {
      type: 'discardWin',
      winnerSeat: seatId,
      discarderSeat: validAction.fromSeat,
      winningTile: state.lastDiscardTile
    })
    return true
  }

  if (validAction.type === 'peng') {
    return applyPengClaim(state, seatId, validAction)
  }

  if (validAction.type === 'chi') {
    return applyChiClaim(state, seatId, validAction)
  }

  if (validAction.type === 'gang' && validAction.mode === 'melded') {
    return applyMeldedGangClaim(state, seatId, validAction)
  }

  return false
}

function passReaction(state, seatId) {
  if (!state || state.phase !== 'reaction' || !state.reactionWindow) {
    return false
  }

  const prompt = getCurrentReactionPrompt(state)

  if (!prompt || prompt.seatId !== seatId) {
    return false
  }

  if (state.reactionWindow.passedSeats.indexOf(seatId) < 0) {
    state.reactionWindow.passedSeats.push(seatId)
    pushLog(state, `${getSeatLabel(seatId)} 选择过`)
  }

  if (!getCurrentReactionPrompt(state)) {
    return advanceToNextLiveDraw(state)
  }

  return true
}

module.exports = {
  discardTile,
  finishRound,
  getRemainingCount,
  getSeatLabel,
  getCurrentReactionPrompt,
  passReaction,
  applyReactionAction,
  applySelfAction,
  startRound
}
