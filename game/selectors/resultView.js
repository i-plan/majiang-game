const SEAT_NAMES = ['你', '右家', '对家', '左家']

function getSeatName(seatId) {
  return SEAT_NAMES[seatId] || `座位${seatId + 1}`
}

function buildMeldTexts(melds) {
  return (melds || []).map((meld) => `${meld.type === 'chi' ? '吃' : meld.type === 'peng' ? '碰' : '杠'} ${meld.tiles.map((tile) => tile.label).join(' ')}`)
}

function buildSeatResult(seat, snapshot) {
  const delta = snapshot.result.deltas[seat.seatId]

  return {
    seatId: seat.seatId,
    displayName: getSeatName(seat.seatId),
    windLabel: seat.wind,
    concealedLabels: seat.concealedTiles.map((tile) => tile.label),
    meldTexts: buildMeldTexts(seat.melds),
    flowerLabels: seat.flowers.map((tile) => tile.label),
    discardLabels: seat.discards.map((tile) => tile.label),
    delta,
    deltaText: delta > 0 ? `+${delta}` : `${delta}`,
    isWinner: seat.seatId === snapshot.result.winnerSeat,
    isDiscarder: seat.seatId === snapshot.result.discarderSeat
  }
}

function buildResultView(snapshot) {
  const result = snapshot.result

  return {
    typeLabel: result.typeLabel,
    summaryText: result.summaryText,
    winnerLabel: typeof result.winnerSeat === 'number' ? getSeatName(result.winnerSeat) : '无',
    discarderLabel: typeof result.discarderSeat === 'number' ? getSeatName(result.discarderSeat) : '',
    winningTileLabel: result.winningTileLabel,
    seatResults: snapshot.seats.map((seat) => buildSeatResult(seat, snapshot)),
    recentLogs: snapshot.log.slice(0, 10)
  }
}

module.exports = {
  buildResultView
}
