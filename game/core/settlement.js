function getOutcomeLabel(type) {
  if (type === 'selfDraw') {
    return '自摸'
  }

  if (type === 'discardWin') {
    return '点炮胡'
  }

  return '流局'
}

function buildDeltas(state, outcome) {
  const seatCount = state.seats.length
  const deltas = new Array(seatCount).fill(0)
  const rules = state.rules.settlement

  if (outcome.type === 'selfDraw') {
    state.seats.forEach((seat) => {
      if (seat.seatId === outcome.winnerSeat) {
        deltas[seat.seatId] = rules.selfDrawWinner
      } else {
        deltas[seat.seatId] = rules.selfDrawLoser
      }
    })
  }

  if (outcome.type === 'discardWin') {
    deltas[outcome.winnerSeat] = rules.discardWinWinner
    deltas[outcome.discarderSeat] = rules.discardWinDiscarder
  }

  return deltas
}

function buildSummaryText(type, winnerSeat, discarderSeat) {
  if (type === 'selfDraw') {
    return `座位 ${winnerSeat + 1} 自摸胡牌`
  }

  if (type === 'discardWin') {
    return `座位 ${winnerSeat + 1} 胡了座位 ${discarderSeat + 1} 的牌`
  }

  return '牌墙耗尽，本局流局'
}

function buildRoundResult(state, outcome) {
  const deltas = buildDeltas(state, outcome)

  return {
    type: outcome.type,
    typeLabel: getOutcomeLabel(outcome.type),
    winnerSeat: typeof outcome.winnerSeat === 'number' ? outcome.winnerSeat : null,
    discarderSeat: typeof outcome.discarderSeat === 'number' ? outcome.discarderSeat : null,
    winningTile: outcome.winningTile || null,
    winningTileLabel: outcome.winningTile ? outcome.winningTile.label : '',
    deltas,
    summaryText: buildSummaryText(outcome.type, outcome.winnerSeat, outcome.discarderSeat),
    timestamp: Date.now()
  }
}

module.exports = {
  buildRoundResult,
  getOutcomeLabel
}
