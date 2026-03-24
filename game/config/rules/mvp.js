module.exports = {
  id: 'quanzhou-mvp',
  name: '泉州麻将 MVP',
  seatCount: 4,
  includeFlowers: true,
  fixedDealerSeat: 0,
  allowChi: true,
  allowPeng: true,
  allowMeldedGang: true,
  allowConcealedGang: true,
  allowAddGang: true,
  allowMultipleWinners: false,
  winningPatterns: {
    standardHand: true
  },
  settlement: {
    selfDrawWinner: 3,
    selfDrawLoser: -1,
    discardWinWinner: 1,
    discardWinDiscarder: -1,
    drawGame: 0
  },
  claimPriority: {
    hu: 300,
    gang: 200,
    peng: 200,
    chi: 100
  }
}
