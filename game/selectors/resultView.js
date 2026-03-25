const SEAT_NAMES = ['你', '右家', '对家', '左家']

function getSeatName(seatId) {
  return SEAT_NAMES[seatId] || `座位${seatId + 1}`
}

function buildMeldTexts(melds) {
  return (melds || []).map((meld) => {
    if (meld.type === 'chi') {
      return `吃 ${meld.tiles.map((tile) => tile.label).join(' ')}`
    }

    if (meld.type === 'peng') {
      return `碰 ${meld.tiles.map((tile) => tile.label).join(' ')}`
    }

    if (meld.gangType === 'concealed') {
      return `暗杠 ${meld.tiles.map((tile) => tile.label).join(' ')}`
    }

    if (meld.gangType === 'add') {
      return `补杠 ${meld.tiles.map((tile) => tile.label).join(' ')}`
    }

    return `明杠 ${meld.tiles.map((tile) => tile.label).join(' ')}`
  })
}

function buildFanItemsText(fanDetail) {
  if (!fanDetail || !fanDetail.items.length) {
    return '无'
  }

  return fanDetail.items.map((item) => `${item.text} = ${item.total}番`).join(' / ')
}

function buildSeatResult(seat, snapshot) {
  const result = snapshot.result
  const delta = result.deltas[seat.seatId]
  const fanDetail = result.fanDetailsBySeat[seat.seatId]
  const nextScore = result.nextScores[seat.seatId]
  const concealedLabels = seat.concealedTiles.map((tile) => tile.label)

  if (seat.seatId === result.winnerSeat && result.type !== 'selfDraw' && result.winningTileLabel) {
    concealedLabels.push(result.winningTileLabel)
  }

  return {
    seatId: seat.seatId,
    displayName: getSeatName(seat.seatId),
    windLabel: seat.wind,
    concealedLabels,
    meldTexts: buildMeldTexts(seat.melds),
    flowerLabels: seat.flowers.map((tile) => tile.label),
    discardLabels: seat.discards.map((tile) => tile.label),
    currentScore: seat.score,
    nextScore,
    scoreFlowText: `${seat.score} → ${nextScore}`,
    delta,
    deltaText: delta > 0 ? `+${delta}` : `${delta}`,
    fanTotal: fanDetail.totalFan,
    fanText: `${fanDetail.totalFan} 番`,
    fanItemsText: buildFanItemsText(fanDetail),
    isWinner: seat.seatId === result.winnerSeat,
    isDiscarder: seat.seatId === result.discarderSeat,
    isPositiveDelta: delta > 0,
    isNegativeDelta: delta < 0,
    isNextDealer: seat.seatId === result.nextDealerSeat
  }
}

function getSourceSeatRoleLabel(result) {
  if (result.type === 'discardWin') {
    return '放炮'
  }

  if (result.type === 'qiangGang') {
    return '被抢杠'
  }

  return ''
}

function buildMainSettlementText(result) {
  if (result.type === 'drawGame') {
    return '流局不计算胡牌主结算，积分保持不变。'
  }

  return `(${result.bankerBase} 底 + ${result.mainSettlement.winnerFanTotal} 番) × ${result.mainWinType.multiplier} = 每家主付 ${result.mainSettlement.share}，胡家主收 ${result.mainSettlement.total}。`
}

function buildResultView(snapshot) {
  const result = snapshot.result

  const isDrawGame = result.type === 'drawGame'

  return {
    typeLabel: result.typeLabel,
    mainWinLabel: isDrawGame ? '' : result.mainWinType.label,
    summaryText: result.summaryText,
    roundLabel: `第 ${result.roundIndex} 局`,
    bankerBase: result.bankerBase,
    goldTileLabel: result.goldTileLabel || '未开金',
    goldDiceLabel: result.goldDiceTotal ? `${result.goldDice.join(' + ')} = ${result.goldDiceTotal}` : '',
    winnerLabel: !isDrawGame && typeof result.winnerSeat === 'number' ? getSeatName(result.winnerSeat) : '',
    sourceSeatLabel: !isDrawGame && typeof result.discarderSeat === 'number' ? getSeatName(result.discarderSeat) : '',
    sourceSeatRoleLabel: getSourceSeatRoleLabel(result),
    nextDealerLabel: typeof result.nextDealerSeat === 'number' ? getSeatName(result.nextDealerSeat) : '',
    winningTileLabel: isDrawGame ? '' : result.winningTileLabel,
    mainSettlementText: buildMainSettlementText(result),
    pairwiseTransferTexts: result.pairwiseTransfers.map((item) => item.text),
    seatResults: snapshot.seats.map((seat) => buildSeatResult(seat, snapshot)),
    recentLogs: snapshot.log.slice(0, 10),
    matchEnded: result.matchEnded,
    replayButtonText: result.matchEnded ? '开始新牌局' : '下一局'
  }
}

module.exports = {
  buildResultView
}
