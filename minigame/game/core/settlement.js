const { isHonorTile } = require('../config/tileCatalog')

const SEAT_NAMES = ['你', '右家', '对家', '左家']
const SEASON_CODES = ['spring', 'summer', 'autumn', 'winter']
const FLOWER_CODES = ['plum', 'orchid', 'flower-bamboo', 'chrysanthemum']

function getSeatName(seatId) {
  return SEAT_NAMES[seatId] || `座位${seatId + 1}`
}

function getOutcomeLabel(type) {
  if (type === 'selfDraw') {
    return '自摸'
  }

  if (type === 'discardWin') {
    return '点炮和'
  }

  if (type === 'qiangGang') {
    return '抢杠胡'
  }

  return '流局'
}

function addItem(items, label, value, count) {
  if (!value || !count) {
    return
  }

  items.push({
    label,
    count,
    value,
    total: value * count,
    text: `${label} × ${count}`
  })
}

function collectSeatTiles(seat, extraTile) {
  const meldTiles = (seat.melds || []).reduce((tiles, meld) => tiles.concat(meld.tiles || []), [])
  const concealedTiles = seat.concealedTiles.slice()

  if (extraTile) {
    concealedTiles.push(extraTile)
  }

  return concealedTiles.concat(meldTiles)
}

function buildSeatFanBreakdown(state, seat, extraTile) {
  const items = []
  const fanValues = state.rules.fanValues
  const allTiles = collectSeatTiles(seat, extraTile)
  const goldCode = state.goldTileCode
  const goldTiles = goldCode ? allTiles.filter((tile) => tile.code === goldCode) : []
  const concealedCounts = seat.concealedTiles.reduce((counts, tile) => {
    if (tile.code === goldCode) {
      return counts
    }

    counts[tile.code] = (counts[tile.code] || 0) + 1
    return counts
  }, {})
  const flowerCodes = seat.flowers.map((tile) => tile.code)

  addItem(items, '金牌', fanValues.goldTile, goldTiles.length)
  addItem(items, '花牌', fanValues.flowerTile, seat.flowers.length)

  const hasFourSeasons = SEASON_CODES.every((code) => flowerCodes.indexOf(code) >= 0)
  const hasFourFlowers = FLOWER_CODES.every((code) => flowerCodes.indexOf(code) >= 0)

  if (hasFourSeasons) {
    addItem(items, '春夏秋冬', fanValues.fourSeasons, 1)
  }

  if (hasFourFlowers) {
    addItem(items, '梅兰竹菊', fanValues.fourFlowers, 1)
  }

  if (seat.flowers.length === 8) {
    addItem(items, '八花齐', fanValues.allFlowers, 1)
  }

  Object.keys(concealedCounts).forEach((code) => {
    const tripletCount = Math.floor(concealedCounts[code] / 3)

    if (!tripletCount) {
      return
    }

    if (isHonorTile(code)) {
      addItem(items, '字牌暗刻', fanValues.honorConcealedTriplet, tripletCount)
      return
    }

    addItem(items, '暗刻', fanValues.concealedTriplet, tripletCount)
  })

  ;(seat.melds || []).forEach((meld) => {
    if (meld.type === 'peng' && isHonorTile(meld.code)) {
      addItem(items, '字牌碰牌', fanValues.honorPeng, 1)
      return
    }

    if (meld.type !== 'gang') {
      return
    }

    const isHonorGang = isHonorTile(meld.code)

    if (meld.gangType === 'add') {
      addItem(items, isHonorGang ? '字牌补杠' : '补杠', isHonorGang ? fanValues.honorAddGang : fanValues.addGang, 1)
      return
    }

    if (meld.gangType === 'concealed') {
      addItem(items, isHonorGang ? '字牌暗杠' : '暗杠', isHonorGang ? fanValues.honorConcealedGang : fanValues.concealedGang, 1)
      return
    }

    addItem(items, isHonorGang ? '字牌明杠' : '明杠', isHonorGang ? fanValues.honorMeldedGang : fanValues.meldedGang, 1)
  })

  const totalFan = items.reduce((total, item) => total + item.total, 0)

  return {
    seatId: seat.seatId,
    totalFan,
    items,
    goldCount: goldTiles.length,
    flowerCount: seat.flowers.length
  }
}

function resolveMainWinType(state, outcome) {
  if (outcome.winInfo && outcome.winInfo.patternId === 'tripleYouJin') {
    return {
      id: 'tripleYouJin',
      label: '三游',
      multiplier: state.rules.winMultipliers.tripleYouJin
    }
  }

  if (outcome.winInfo && outcome.winInfo.patternId === 'doubleYouJin') {
    return {
      id: 'doubleYouJin',
      label: '双游',
      multiplier: state.rules.winMultipliers.doubleYouJin
    }
  }

  if (outcome.winInfo && outcome.winInfo.patternId === 'youJin') {
    return {
      id: 'youJin',
      label: '游金',
      multiplier: state.rules.winMultipliers.youJin
    }
  }

  if (outcome.winInfo && outcome.winInfo.patternId === 'threeGoldDown') {
    return {
      id: 'threeGoldDown',
      label: '三金倒',
      multiplier: state.rules.winMultipliers.threeGoldDown
    }
  }

  if (outcome.winInfo && outcome.winInfo.patternId === 'tianTing') {
    return {
      id: 'tianTing',
      label: '天听',
      multiplier: state.rules.winMultipliers.tianTing
    }
  }

  if (outcome.type === 'selfDraw' && state.discardCount === 0 && outcome.winnerSeat === state.dealerSeat) {
    return {
      id: 'tianHu',
      label: '天胡',
      multiplier: state.rules.winMultipliers.tianHu
    }
  }

  if (outcome.type === 'qiangGang') {
    return {
      id: 'qiangGang',
      label: '抢杠胡',
      multiplier: state.rules.winMultipliers.qiangGang
    }
  }

  if (outcome.type === 'discardWin') {
    return {
      id: 'pingHu',
      label: '点炮和',
      multiplier: state.rules.winMultipliers.pingHu
    }
  }

  return {
    id: 'selfDraw',
    label: '自摸',
    multiplier: state.rules.winMultipliers.selfDraw
  }
}

function buildMainWinDeltas(state, outcome, fanDetailsBySeat, mainWinType) {
  const seatCount = state.seats.length
  const deltas = new Array(seatCount).fill(0)
  const winnerFan = fanDetailsBySeat[outcome.winnerSeat]
  const share = (state.bankerBase + winnerFan.totalFan) * mainWinType.multiplier

  state.seats.forEach((seat) => {
    if (seat.seatId === outcome.winnerSeat) {
      deltas[seat.seatId] += share * (seatCount - 1)
    } else {
      deltas[seat.seatId] -= share
    }
  })

  return {
    deltas,
    share,
    winnerFanTotal: winnerFan.totalFan,
    total: share * (seatCount - 1)
  }
}

function buildPairwiseTransfers(participantIds, fanDetailsBySeat) {
  const seatCount = fanDetailsBySeat.length
  const deltas = new Array(seatCount).fill(0)
  const transfers = []

  for (let leftIndex = 0; leftIndex < participantIds.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < participantIds.length; rightIndex += 1) {
      const leftSeatId = participantIds[leftIndex]
      const rightSeatId = participantIds[rightIndex]
      const leftFan = fanDetailsBySeat[leftSeatId].totalFan
      const rightFan = fanDetailsBySeat[rightSeatId].totalFan
      const diff = leftFan - rightFan

      if (diff === 0) {
        continue
      }

      if (diff > 0) {
        deltas[leftSeatId] += diff
        deltas[rightSeatId] -= diff
        transfers.push({
          fromSeat: rightSeatId,
          toSeat: leftSeatId,
          value: diff,
          text: `${getSeatName(rightSeatId)} 向 ${getSeatName(leftSeatId)} 支付 ${diff} 分番差`
        })
        continue
      }

      deltas[leftSeatId] += diff
      deltas[rightSeatId] -= diff
      transfers.push({
        fromSeat: leftSeatId,
        toSeat: rightSeatId,
        value: Math.abs(diff),
        text: `${getSeatName(leftSeatId)} 向 ${getSeatName(rightSeatId)} 支付 ${Math.abs(diff)} 分番差`
      })
    }
  }

  return {
    deltas,
    transfers
  }
}

function buildSummaryText(type, winnerSeat, mainWinType, mainSettlement, pairwiseTransfers) {
  if (type === 'drawGame') {
    return '牌墙剩 16 张流局，本局不结算胡牌分。'
  }

  const pairwiseText = pairwiseTransfers && pairwiseTransfers.length ? '其余三家另算番差。' : '其余三家番差为 0。'
  return `${getSeatName(winnerSeat)} ${mainWinType.label}，胡家番数 ${mainSettlement.winnerFanTotal}，每家主付 ${mainSettlement.share}。${pairwiseText}`
}

function resolveNextDealerSeat(state, outcome) {
  if (typeof outcome.winnerSeat === 'number') {
    return outcome.winnerSeat
  }

  return state.dealerSeat
}

function buildRoundResult(state, outcome) {
  const fanDetailsBySeat = state.seats.map((seat) => {
    const winnerExtraTile = typeof outcome.winnerSeat === 'number' && seat.seatId === outcome.winnerSeat && outcome.type !== 'selfDraw'
      ? outcome.winningTile
      : null

    return buildSeatFanBreakdown(state, seat, winnerExtraTile)
  })
  const currentScores = state.seats.map((seat) => seat.score)

  if (outcome.type === 'drawGame') {
    return {
      type: outcome.type,
      typeLabel: getOutcomeLabel(outcome.type),
      mainWinType: {
        id: 'drawGame',
        label: '流局',
        multiplier: 0
      },
      winnerSeat: null,
      discarderSeat: null,
      winningTile: null,
      winningTileLabel: '',
      deltas: new Array(state.seats.length).fill(0),
      currentScores,
      nextScores: currentScores.slice(),
      nextDealerSeat: state.dealerSeat,
      matchEnded: currentScores.some((score) => score <= 0),
      bankerBase: state.bankerBase,
      goldTileCode: state.goldTileCode,
      goldTileLabel: state.goldTileLabel,
      goldDice: state.goldDice,
      goldDiceTotal: state.goldDiceTotal,
      fanDetailsBySeat,
      pairwiseTransfers: [],
      mainSettlement: {
        share: 0,
        total: 0,
        winnerFanTotal: 0
      },
      summaryText: buildSummaryText(outcome.type),
      roundIndex: state.roundIndex,
      timestamp: Date.now()
    }
  }

  const mainWinType = resolveMainWinType(state, outcome)
  const mainSettlement = buildMainWinDeltas(state, outcome, fanDetailsBySeat, mainWinType)
  const participantIds = state.seats
    .map((seat) => seat.seatId)
    .filter((seatId) => seatId !== outcome.winnerSeat)
  const pairwise = buildPairwiseTransfers(participantIds, fanDetailsBySeat)
  const deltas = mainSettlement.deltas.map((value, index) => value + pairwise.deltas[index])
  const nextScores = currentScores.map((score, index) => score + deltas[index])
  const nextDealerSeat = resolveNextDealerSeat(state, outcome)

  return {
    type: outcome.type,
    typeLabel: getOutcomeLabel(outcome.type),
    mainWinType,
    winnerSeat: typeof outcome.winnerSeat === 'number' ? outcome.winnerSeat : null,
    discarderSeat: typeof outcome.discarderSeat === 'number' ? outcome.discarderSeat : null,
    winningTile: outcome.winningTile || null,
    winningTileLabel: outcome.winningTile ? outcome.winningTile.label : '',
    winInfo: outcome.winInfo || null,
    deltas,
    currentScores,
    nextScores,
    nextDealerSeat,
    matchEnded: nextScores.some((score) => score <= 0),
    bankerBase: state.bankerBase,
    goldTileCode: state.goldTileCode,
    goldTileLabel: state.goldTileLabel,
    goldDice: state.goldDice,
    goldDiceTotal: state.goldDiceTotal,
    fanDetailsBySeat,
    pairwiseTransfers: pairwise.transfers,
    mainSettlement,
    summaryText: buildSummaryText(outcome.type, outcome.winnerSeat, mainWinType, mainSettlement, pairwise.transfers),
    roundIndex: state.roundIndex,
    timestamp: Date.now()
  }
}

module.exports = {
  buildRoundResult,
  buildSeatFanBreakdown,
  getOutcomeLabel
}
