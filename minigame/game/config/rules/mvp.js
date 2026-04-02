module.exports = {
  id: 'quanzhou-local',
  name: '伤心麻一麻',
  seatCount: 4,
  includeFlowers: true,
  fixedDealerSeat: 0,
  allowChi: true,
  allowPeng: true,
  allowMeldedGang: true,
  allowConcealedGang: true,
  allowAddGang: true,
  allowMultipleWinners: false,
  dealing: {
    dealerHandSize: 17,
    idleHandSize: 16,
    winSetCount: 5,
    drawStopRemaining: 16
  },
  match: {
    initialScore: 100,
    bankerBaseOptions: [2, 10],
    defaultBankerBase: 10
  },
  gold: {
    enabled: true,
    wildcard: true
  },
  winningPatterns: {
    standardHand: true,
    threeGoldDown: true,
    tianHu: true,
    tianTing: true
  },
  standardWin: {
    allowSingleGoldPingHu: true,
    allowDoubleGoldPingHu: false
  },
  fanValues: {
    goldTile: 1,
    flowerTile: 1,
    concealedTriplet: 1,
    honorConcealedTriplet: 2,
    honorPeng: 1,
    addGang: 1,
    honorAddGang: 2,
    meldedGang: 2,
    honorMeldedGang: 3,
    concealedGang: 3,
    honorConcealedGang: 4,
    fourSeasons: 8,
    fourFlowers: 8,
    allFlowers: 16
  },
  winMultipliers: {
    pingHu: 1,
    selfDraw: 2,
    qiangGang: 2,
    threeGoldDown: 3,
    tianHu: 4,
    tianTing: 4,
    youJin: 4,
    doubleYouJin: 8,
    tripleYouJin: 16
  },
  claimPriority: {
    hu: 300,
    gang: 200,
    peng: 200,
    chi: 100
  }
}
