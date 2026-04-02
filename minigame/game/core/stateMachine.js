const { sortTiles, isFlowerTile } = require('../config/tileCatalog')
const { createWall, drawLiveTile, drawSupplementTile, getRemainingCount } = require('./wall')
const {
  evaluateDiscardResponses,
  getCurrentReactionPrompt,
  getSelfActions,
  isReactionHuBlockedByYouJin,
  isSameAction
} = require('./actionEvaluator')
const { evaluateWin, getTianTingDiscardCodes } = require('./winChecker')
const { buildRoundResult } = require('./settlement')

const WINDS = ['东', '南', '西', '北']
const SEAT_LABELS = ['你', '右家', '对家', '左家']

function getSeatLabel(seatId) {
  return SEAT_LABELS[seatId] || `座位${seatId + 1}`
}

function getYouJinLabel(level) {
  if (level >= 3) {
    return '三游'
  }

  if (level === 2) {
    return '双游'
  }

  if (level === 1) {
    return '游金'
  }

  return ''
}

function createSeat(seatId, score) {
  return {
    seatId,
    wind: WINDS[seatId] || '',
    isHuman: seatId === 0,
    concealedTiles: [],
    melds: [],
    flowers: [],
    discards: [],
    score,
    youJinLevel: 0,
    tianTingActive: false,
    tianTingEligible: false
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

function addConcealedTile(seat, tile) {
  seat.concealedTiles.push(tile)
  sortSeatCollections(seat)
}

function addFlowerTile(seat, tile) {
  seat.flowers.push(tile)
  sortSeatCollections(seat)
}

function clearTianTingState(seat) {
  seat.tianTingActive = false
  seat.tianTingEligible = false
}

function createBaseState(rules, options) {
  const settings = Object.assign({
    bankerBase: rules.match.defaultBankerBase,
    dealerSeat: rules.fixedDealerSeat || 0,
    roundIndex: 1,
    initialScores: null
  }, options)
  const initialScores = Array.isArray(settings.initialScores) ? settings.initialScores : []
  const seats = Array.from({ length: rules.seatCount }, (_, seatId) => createSeat(seatId, typeof initialScores[seatId] === 'number' ? initialScores[seatId] : rules.match.initialScore))

  if (seats[settings.dealerSeat]) {
    seats[settings.dealerSeat].tianTingEligible = true
  }

  return {
    rules: JSON.parse(JSON.stringify(rules)),
    phase: 'turn',
    version: 0,
    dealerSeat: settings.dealerSeat,
    activeSeat: settings.dealerSeat,
    turnStage: null,
    roundIndex: settings.roundIndex,
    bankerBase: settings.bankerBase,
    goldTileCode: '',
    goldTileLabel: '',
    goldDice: [],
    goldDiceTotal: 0,
    discardCount: 0,
    wall: createWall(rules),
    seats,
    lastDrawTile: null,
    lastDrawSource: '',
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
      addFlowerTile(seat, tile)

      if (settings.logDraw) {
        pushLog(state, `${getSeatLabel(seatId)} 补花 ${tile.label}`)
      }

      currentSource = 'supplement'
      continue
    }

    addConcealedTile(seat, tile)
    state.lastDrawTile = tile
    state.lastDrawSource = currentSource

    if (settings.logDraw) {
      const actionText = currentSource === 'supplement' ? '补牌' : '摸牌'
      pushLog(state, `${getSeatLabel(seatId)} ${actionText}`)
    }

    return tile
  }
}

function drawInitialTile(state, seatId, source) {
  const seat = state.seats[seatId]
  const tile = drawBySource(state, source)

  if (!tile) {
    return null
  }

  if (isFlowerTile(tile)) {
    addFlowerTile(seat, tile)
    return {
      tile,
      isFlower: true
    }
  }

  addConcealedTile(seat, tile)
  return {
    tile,
    isFlower: false
  }
}

function resolvePendingFlowersInRounds(state, pendingCounts) {
  let dealerLastTile = null
  let currentPending = pendingCounts.slice()

  while (currentPending.some((count) => count > 0)) {
    const nextPending = new Array(state.seats.length).fill(0)

    for (let offset = 0; offset < state.seats.length; offset += 1) {
      const seatId = (state.dealerSeat + offset) % state.seats.length
      const pendingCount = currentPending[seatId] || 0

      if (!pendingCount) {
        continue
      }

      nextPending[seatId] += pendingCount - 1

      const drawResult = drawInitialTile(state, seatId, 'supplement')
      if (!drawResult) {
        return {
          success: false,
          dealerLastTile: null
        }
      }

      if (drawResult.isFlower) {
        nextPending[seatId] += 1
        continue
      }

      if (seatId === state.dealerSeat) {
        dealerLastTile = drawResult.tile
      }
    }

    currentPending = nextPending
  }

  return {
    success: true,
    dealerLastTile
  }
}

function removeTileById(seat, tileId) {
  const index = seat.concealedTiles.findIndex((tile) => tile.id === tileId)

  if (index < 0) {
    return null
  }

  return seat.concealedTiles.splice(index, 1)[0]
}

function removeTileByCode(seat, code) {
  const index = seat.concealedTiles.findIndex((tile) => tile.code === code)

  if (index < 0) {
    return null
  }

  const removed = seat.concealedTiles.splice(index, 1)[0]
  sortSeatCollections(seat)
  return removed
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
    const patternLabel = outcome.winInfo && outcome.winInfo.patternLabel && outcome.winInfo.patternLabel !== '平胡'
      ? `${outcome.winInfo.patternLabel} 自摸`
      : '自摸胡牌'
    pushLog(state, `${getSeatLabel(outcome.winnerSeat)} ${patternLabel}`)
  } else if (outcome.type === 'discardWin') {
    pushLog(state, `${getSeatLabel(outcome.winnerSeat)} 胡了 ${getSeatLabel(outcome.discarderSeat)} 的 ${outcome.winningTile.label}`)
  } else if (outcome.type === 'qiangGang') {
    pushLog(state, `${getSeatLabel(outcome.winnerSeat)} 抢杠胡 ${getSeatLabel(outcome.discarderSeat)} 的 ${outcome.winningTile.label}`)
  } else {
    pushLog(state, '牌墙剩余 16 张，本局流局')
  }
}

function shouldDrawGameBeforeLiveDraw(state) {
  return getRemainingCount(state.wall) <= state.rules.dealing.drawStopRemaining
}

function advanceToNextLiveDraw(state) {
  state.reactionWindow = null

  if (shouldDrawGameBeforeLiveDraw(state)) {
    finishRound(state, { type: 'drawGame' })
    return false
  }

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

function getSeatTargetHandSize(state, seatId) {
  return seatId === state.dealerSeat ? state.rules.dealing.dealerHandSize : state.rules.dealing.idleHandSize
}

function dealInitialHands(state) {
  const maxHandSize = Math.max(state.rules.dealing.dealerHandSize, state.rules.dealing.idleHandSize)
  const pendingCounts = new Array(state.seats.length).fill(0)
  const dealtCounts = new Array(state.seats.length).fill(0)
  let dealerLastTile = null
  let dealerLastSource = 'live'

  for (let round = 0; round < maxHandSize; round += 1) {
    for (let offset = 0; offset < state.seats.length; offset += 1) {
      const seatId = (state.dealerSeat + offset) % state.seats.length
      const targetHandSize = getSeatTargetHandSize(state, seatId)

      if (dealtCounts[seatId] >= targetHandSize) {
        continue
      }

      const drawResult = drawInitialTile(state, seatId, 'live')
      if (!drawResult) {
        return null
      }

      dealtCounts[seatId] += 1

      if (drawResult.isFlower) {
        pendingCounts[seatId] += 1
        continue
      }

      if (seatId === state.dealerSeat) {
        dealerLastTile = drawResult.tile
        dealerLastSource = 'live'
      }
    }
  }

  const supplementResult = resolvePendingFlowersInRounds(state, pendingCounts)
  if (!supplementResult.success) {
    return null
  }

  if (supplementResult.dealerLastTile) {
    dealerLastTile = supplementResult.dealerLastTile
    dealerLastSource = 'supplement'
  }

  return {
    dealerLastTile,
    dealerLastSource
  }
}

function revealGoldTile(state) {
  if (!state.rules.gold || !state.rules.gold.enabled) {
    return null
  }

  const firstDie = Math.floor(Math.random() * 6) + 1
  const secondDie = Math.floor(Math.random() * 6) + 1
  const total = firstDie + secondDie
  let revealIndex = state.wall.supplementIndex - (total - 1)

  while (revealIndex >= state.wall.liveIndex) {
    const tile = state.wall.tiles[revealIndex]

    if (!isFlowerTile(tile)) {
      state.goldDice = [firstDie, secondDie]
      state.goldDiceTotal = total
      state.goldTileCode = tile.code
      state.goldTileLabel = tile.label
      pushLog(state, `开金 ${tile.label}（骰子 ${firstDie} + ${secondDie} = ${total}）`)
      return tile
    }

    revealIndex -= 1
  }

  return null
}

function startRound(rules, options) {
  const state = createBaseState(rules, options)

  pushLog(state, `第 ${state.roundIndex} 局开始`)
  pushLog(state, `${getSeatLabel(state.dealerSeat)} 坐庄，庄底 ${state.bankerBase}`)

  const initialDeal = dealInitialHands(state)
  if (!initialDeal || !initialDeal.dealerLastTile) {
    finishRound(state, { type: 'drawGame' })
    return state
  }

  revealGoldTile(state)

  state.activeSeat = state.dealerSeat
  state.turnStage = 'afterDraw'
  state.lastDrawTile = initialDeal.dealerLastTile
  state.lastDrawSource = initialDeal.dealerLastSource

  pushLog(state, `${getSeatLabel(state.dealerSeat)} 先手`)
  return state
}

function shouldActivateTianTing(state, seatId, discardCode) {
  const seat = state.seats[seatId]

  if (!state.rules.winningPatterns.tianTing || !seat) {
    return false
  }

  if (seatId !== state.dealerSeat || !seat.tianTingEligible || state.discardCount !== 0 || state.turnStage !== 'afterDraw') {
    return false
  }

  return getTianTingDiscardCodes(state, seat).indexOf(discardCode) >= 0
}

function shouldLockToLastDrawDiscard(state, seat) {
  return Boolean(
    state &&
    seat &&
    state.turnStage === 'afterDraw' &&
    state.lastDrawTile &&
    (seat.youJinLevel > 0 || seat.tianTingActive)
  )
}

function finalizeDiscard(state, seatId, tile, options) {
  const settings = Object.assign({
    activatesTianTing: false,
    logText: ''
  }, options)
  const seat = state.seats[seatId]

  if (settings.activatesTianTing) {
    seat.tianTingActive = true
  }

  if (seat.tianTingEligible) {
    seat.tianTingEligible = false
  }

  seat.discards.push(tile)
  sortSeatCollections(seat)
  state.lastDiscardTile = tile
  state.lastDiscardSeat = seatId
  state.lastDrawTile = null
  state.turnStage = null
  state.discardCount += 1

  pushLog(state, settings.logText || `${getSeatLabel(seatId)} 打出 ${tile.label}`)

  const reactionWindow = evaluateDiscardResponses(state)

  if (reactionWindow) {
    state.phase = 'reaction'
    state.reactionWindow = reactionWindow
    return true
  }

  return advanceToNextLiveDraw(state)
}

function discardTile(state, seatId, tileId) {
  if (!state || state.phase !== 'turn' || state.reactionWindow || state.activeSeat !== seatId) {
    return false
  }

  const seat = state.seats[seatId]

  if (shouldLockToLastDrawDiscard(state, seat) && tileId !== state.lastDrawTile.id) {
    return false
  }

  const targetTile = seat.concealedTiles.find((tile) => tile.id === tileId)
  if (!targetTile) {
    return false
  }

  const activatesTianTing = shouldActivateTianTing(state, seatId, targetTile.code)
  const tile = removeTileById(seat, tileId)

  if (!tile) {
    return false
  }

  return finalizeDiscard(state, seatId, tile, {
    activatesTianTing,
    logText: activatesTianTing ? `${getSeatLabel(seatId)} 打出 ${tile.label}，进入天听` : ''
  })
}

function applyConcealedGang(state, seatId, action) {
  const seat = state.seats[seatId]
  clearTianTingState(seat)

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

function finalizeAddGang(state, seatId, code) {
  const seat = state.seats[seatId]
  clearTianTingState(seat)

  const meldIndex = seat.melds.findIndex((meld) => meld.type === 'peng' && meld.code === code)

  if (meldIndex < 0) {
    return false
  }

  const removed = removeTilesByCodes(seat, [code])

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
  state.reactionWindow = null
  state.activeSeat = seatId
  state.turnStage = 'afterDraw'
  return true
}

function buildHuAction(state, seatId, fromSeat, tile, source, winInfo) {
  return {
    type: 'hu',
    seatId,
    fromSeat,
    source,
    code: tile.code,
    winInfo,
    priority: state.rules.claimPriority.hu || 0,
    label: winInfo && winInfo.patternLabel ? winInfo.patternLabel : '胡'
  }
}

function createRobGangReactionWindow(state, seatId, code) {
  const tile = {
    id: `rob-gang-${state.roundIndex}-${seatId}-${code}`,
    code,
    label: state.seats[seatId].melds.find((meld) => meld.code === code).tiles[0].label,
    flower: false
  }
  const optionsBySeat = {}

  state.seats.forEach((seat) => {
    if (seat.seatId === seatId) {
      return
    }

    if (seat.youJinLevel > 0 || isReactionHuBlockedByYouJin(state, seat.seatId)) {
      return
    }

    const winInfo = evaluateWin(state, seat, tile)
    if (winInfo.canHu) {
      optionsBySeat[seat.seatId] = [buildHuAction(state, seat.seatId, seatId, tile, 'robGang', winInfo)]
    }
  })

  if (!Object.keys(optionsBySeat).length) {
    return null
  }

  return {
    kind: 'robGang',
    discardTile: tile,
    fromSeat: seatId,
    optionsBySeat,
    passedSeats: [],
    pendingAction: {
      seatId,
      code
    }
  }
}

function applyAddGang(state, seatId, action) {
  const robGangWindow = createRobGangReactionWindow(state, seatId, action.code)

  if (robGangWindow) {
    state.phase = 'reaction'
    state.reactionWindow = robGangWindow
    return true
  }

  return finalizeAddGang(state, seatId, action.code)
}

function applyYouJinAction(state, seatId, action) {
  const seat = state.seats[seatId]
  const discardedTile = removeTileByCode(seat, action.code)

  if (!discardedTile) {
    return false
  }

  clearTianTingState(seat)
  seat.youJinLevel = action.mode === 'upgrade' ? action.nextLevel : 1

  return finalizeDiscard(state, seatId, discardedTile, {
    logText: `${getSeatLabel(seatId)} 打出 ${discardedTile.label}，进入${getYouJinLabel(seat.youJinLevel)}`
  })
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
      winningTile: state.lastDrawTile,
      winInfo: validAction.winInfo
    })
    return true
  }

  if (validAction.type === 'youJin') {
    return applyYouJinAction(state, seatId, validAction)
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
  clearTianTingState(seat)

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
  clearTianTingState(seat)

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
  clearTianTingState(seat)

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
      type: state.reactionWindow.kind === 'robGang' ? 'qiangGang' : 'discardWin',
      winnerSeat: seatId,
      discarderSeat: validAction.fromSeat,
      winningTile: state.reactionWindow.discardTile,
      winInfo: validAction.winInfo
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
    if (state.reactionWindow.kind === 'robGang') {
      const pendingAction = state.reactionWindow.pendingAction
      return finalizeAddGang(state, pendingAction.seatId, pendingAction.code)
    }

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
