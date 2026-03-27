const { getSelfActions, getCurrentReactionPrompt } = require('../core/actionEvaluator')
const { getRemainingCount } = require('../core/wall')

const SEAT_NAMES = ['你', '右家', '对家', '左家']
const POSITION_MAP = {
  0: 'bottom',
  1: 'right',
  2: 'top',
  3: 'left'
}

function getSeatName(seatId) {
  return SEAT_NAMES[seatId] || `座位${seatId + 1}`
}

function getSeatSpecialStateLabel(seat) {
  if (!seat) {
    return ''
  }

  if (seat.youJinLevel >= 3) {
    return '三游'
  }

  if (seat.youJinLevel === 2) {
    return '双游'
  }

  if (seat.youJinLevel === 1) {
    return '游金'
  }

  if (seat.tianTingActive) {
    return '天听'
  }

  return ''
}

function formatMeldType(meld) {
  if (meld.type === 'chi') {
    return '吃'
  }

  if (meld.type === 'peng') {
    return '碰'
  }

  if (meld.type === 'gang') {
    if (meld.gangType === 'concealed') {
      return '暗杠'
    }

    if (meld.gangType === 'add') {
      return '补杠'
    }

    return '明杠'
  }

  return meld.type
}

function buildMeldTexts(melds) {
  return (melds || []).map((meld) => `${formatMeldType(meld)} ${meld.tiles.map((tile) => tile.label).join(' ')}`)
}

function buildSeatSummary(seat, snapshot) {
  return {
    seatId: seat.seatId,
    position: POSITION_MAP[seat.seatId],
    displayName: getSeatName(seat.seatId),
    windLabel: seat.wind,
    concealedCount: seat.concealedTiles.length,
    meldTexts: buildMeldTexts(seat.melds),
    flowerLabels: seat.flowers.map((tile) => tile.label),
    discardLabels: seat.discards.map((tile) => tile.label),
    isDealer: seat.seatId === snapshot.dealerSeat,
    isActive: seat.seatId === snapshot.activeSeat,
    score: seat.score,
    scoreText: `${seat.score} 分`,
    specialStateLabel: getSeatSpecialStateLabel(seat),
    pendingDelta: snapshot.result ? snapshot.result.deltas[seat.seatId] : 0,
    pendingDeltaText: snapshot.result
      ? (snapshot.result.deltas[seat.seatId] > 0 ? `+${snapshot.result.deltas[seat.seatId]}` : `${snapshot.result.deltas[seat.seatId]}`)
      : ''
  }
}

function buildHumanHand(seat, selectedTileId, canSelectHandTile, lockedDiscardTileId) {
  return seat.concealedTiles.map((tile) => ({
    id: tile.id,
    label: tile.label,
    flower: tile.flower,
    hidden: false,
    selected: tile.id === selectedTileId,
    small: false,
    disabled: !canSelectHandTile || Boolean(lockedDiscardTileId && tile.id !== lockedDiscardTileId)
  }))
}

function buildLockedReadyStatus(seat, selfActions) {
  const stateLabel = getSeatSpecialStateLabel(seat)
  const huAction = selfActions.find((action) => action.type === 'hu')
  const upgradeAction = selfActions.find((action) => action.type === 'youJin' && action.mode === 'upgrade')

  if (seat.youJinLevel > 0) {
    if (upgradeAction && huAction) {
      return `你已${stateLabel}，可以自摸，也可以继续${upgradeAction.label}；未胡时只能打摸到的牌`
    }

    if (upgradeAction) {
      return `你已${stateLabel}，摸到金可继续${upgradeAction.label}；未胡时只能打摸到的牌`
    }

    if (huAction) {
      return `你已${stateLabel}，可以自摸胡牌；未胡时只能打摸到的牌`
    }

    return `你已${stateLabel}，未胡时只能打摸到的牌`
  }

  if (seat.tianTingActive) {
    if (huAction) {
      return '你已天听，可以自摸胡牌；未胡时只能打摸到的牌'
    }

    return '你已天听，未胡时只能打摸到的牌'
  }

  return ''
}

function buildNormalTurnStatus(selfActions) {
  const availableActionLabels = []

  if (selfActions.some((action) => action.type === 'hu')) {
    availableActionLabels.push('胡牌')
  }

  if (selfActions.some((action) => action.type === 'gang')) {
    availableActionLabels.push('杠牌')
  }

  if (selfActions.some((action) => action.type === 'youJin')) {
    availableActionLabels.push('游金')
  }

  if (availableActionLabels.length) {
    return `你可以${availableActionLabels.join('、')}，也可以直接打牌`
  }

  return '请选择一张牌打出'
}

function buildStatusText(snapshot, reactionPrompt, selfActions) {
  const humanSeat = snapshot.seats[0]

  if (snapshot.result) {
    return snapshot.result.summaryText
  }

  if (reactionPrompt) {
    if (reactionPrompt.seatId === 0) {
      return `你可以响应 ${reactionPrompt.discardTile.label}`
    }

    return `${getSeatName(reactionPrompt.seatId)} 正在响应 ${reactionPrompt.discardTile.label}`
  }

  if (snapshot.activeSeat === 0) {
    if (snapshot.turnStage === 'afterClaim') {
      return '你已吃/碰牌，请打出一张牌'
    }

    const lockedReadyStatus = buildLockedReadyStatus(humanSeat, selfActions)
    if (lockedReadyStatus) {
      return lockedReadyStatus
    }

    return buildNormalTurnStatus(selfActions)
  }

  return `${getSeatName(snapshot.activeSeat)} 思考中...`
}

function buildAvailableActions(snapshot, reactionPrompt) {
  if (reactionPrompt && reactionPrompt.seatId === 0) {
    return reactionPrompt.actions.concat({
      type: 'pass',
      label: '过'
    })
  }

  if (snapshot.activeSeat === 0 && !reactionPrompt) {
    return getSelfActions(snapshot, 0)
  }

  return []
}

function buildTableView(snapshot, options) {
  const requestedSelectedTileId = options && options.selectedTileId ? options.selectedTileId : ''
  const reactionPrompt = getCurrentReactionPrompt(snapshot)
  const selfActions = snapshot.activeSeat === 0 && !reactionPrompt ? getSelfActions(snapshot, 0) : []
  const availableActions = buildAvailableActions(snapshot, reactionPrompt)
  const humanSeat = snapshot.seats[0]
  const topSeat = buildSeatSummary(snapshot.seats[2], snapshot)
  const rightSeat = buildSeatSummary(snapshot.seats[1], snapshot)
  const leftSeat = buildSeatSummary(snapshot.seats[3], snapshot)
  const bottomSeat = buildSeatSummary(snapshot.seats[0], snapshot)
  const canSelectHandTile = snapshot.phase === 'turn' && snapshot.activeSeat === 0 && !snapshot.result
  const lockedDiscardTileId = canSelectHandTile && snapshot.lastDrawTile && (humanSeat.youJinLevel > 0 || humanSeat.tianTingActive)
    ? snapshot.lastDrawTile.id
    : ''
  const selectedTileId = canSelectHandTile ? (lockedDiscardTileId || requestedSelectedTileId) : ''
  const canDiscard = canSelectHandTile && humanSeat.concealedTiles.length > 0
  const selectedTile = humanSeat.concealedTiles.find((tile) => tile.id === selectedTileId)

  return {
    phase: snapshot.phase,
    promptType: reactionPrompt && reactionPrompt.seatId === 0 ? 'reaction' : 'self',
    roundEnded: Boolean(snapshot.result),
    roundLabel: `第 ${snapshot.roundIndex} 局`,
    dealerLabel: getSeatName(snapshot.dealerSeat),
    activeLabel: getSeatName(snapshot.activeSeat),
    bankerBaseLabel: `${snapshot.bankerBase} 底`,
    goldTileLabel: snapshot.goldTileLabel || '未开金',
    goldDiceLabel: snapshot.goldDiceTotal ? `${snapshot.goldDice.join(' + ')} = ${snapshot.goldDiceTotal}` : '',
    remainingCount: getRemainingCount(snapshot.wall),
    statusText: buildStatusText(snapshot, reactionPrompt, selfActions),
    topSeat,
    rightSeat,
    leftSeat,
    bottomSeat,
    humanMeldTexts: buildMeldTexts(humanSeat.melds),
    humanFlowers: humanSeat.flowers.map((tile) => tile.label),
    humanScoreText: `${humanSeat.score} 分`,
    humanSpecialStateLabel: getSeatSpecialStateLabel(humanSeat),
    humanHand: buildHumanHand(humanSeat, selectedTileId, canSelectHandTile, lockedDiscardTileId),
    availableActions,
    canSelectHandTile,
    canDiscard,
    selectedTileId,
    lockedDiscardTileId,
    discardButtonText: selectedTile ? `打出 ${selectedTile.label}` : '选择手牌后打出',
    discardDisabled: !selectedTile,
    autoAdvance: !snapshot.result && Boolean(
      (reactionPrompt && reactionPrompt.seatId !== 0) ||
      (!reactionPrompt && snapshot.activeSeat !== 0)
    ),
    recentLogs: snapshot.log.slice(0, 6)
  }
}

module.exports = {
  buildTableView
}
