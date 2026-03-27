const { TILE_CODES, getTileMeta, getTileSortKey, isFlowerTile } = require('../config/tileCatalog')

const PLAYABLE_CODES = TILE_CODES.filter((code) => !isFlowerTile(code))

function getCode(tileOrCode) {
  return typeof tileOrCode === 'string' ? tileOrCode : tileOrCode.code
}

function buildCounts(codes) {
  return codes.reduce((counts, code) => {
    counts[code] = (counts[code] || 0) + 1
    return counts
  }, {})
}

function cloneCounts(counts) {
  return Object.keys(counts).reduce((next, code) => {
    next[code] = counts[code]
    return next
  }, {})
}

function getSortedCodes(counts) {
  return Object.keys(counts)
    .filter((code) => counts[code] > 0)
    .sort((left, right) => getTileSortKey(left) - getTileSortKey(right))
}

function buildMemoKey(counts, goldCount) {
  return `${goldCount}|${getSortedCodes(counts).map((code) => `${code}:${counts[code]}`).join('|')}`
}

function removeCount(counts, code, amount) {
  const nextCounts = cloneCounts(counts)
  nextCounts[code] -= amount

  if (nextCounts[code] <= 0) {
    delete nextCounts[code]
  }

  return nextCounts
}

function canFormMeldsWithGold(counts, goldCount, memo) {
  const key = buildMemoKey(counts, goldCount)

  if (memo[key] !== undefined) {
    return memo[key]
  }

  const codes = getSortedCodes(counts)

  if (!codes.length) {
    memo[key] = goldCount % 3 === 0
    return memo[key]
  }

  const currentCode = codes[0]
  const currentCount = counts[currentCode]
  const meta = getTileMeta(currentCode)
  let result = false

  for (let actualUsed = Math.min(3, currentCount); actualUsed >= 1; actualUsed -= 1) {
    const needGold = 3 - actualUsed
    if (needGold > goldCount) {
      continue
    }

    const nextCounts = removeCount(counts, currentCode, actualUsed)
    if (canFormMeldsWithGold(nextCounts, goldCount - needGold, memo)) {
      result = true
      break
    }
  }

  if (!result && meta && meta.category === 'suit' && meta.rank <= 7) {
    const nextCode = `${meta.suit}-${meta.rank + 1}`
    const nextNextCode = `${meta.suit}-${meta.rank + 2}`
    let needGold = 0
    let nextCounts = removeCount(counts, currentCode, 1)

    if (nextCounts[nextCode]) {
      nextCounts = removeCount(nextCounts, nextCode, 1)
    } else {
      needGold += 1
    }

    if (nextCounts[nextNextCode]) {
      nextCounts = removeCount(nextCounts, nextNextCode, 1)
    } else {
      needGold += 1
    }

    if (needGold <= goldCount && canFormMeldsWithGold(nextCounts, goldCount - needGold, memo)) {
      result = true
    }
  }

  memo[key] = result
  return result
}

function analyzeStandardWinWithGold(codes, goldCode, openMeldCount, rules) {
  const targetTileCount = (rules.dealing.winSetCount - openMeldCount) * 3 + 2

  if (codes.length !== targetTileCount) {
    return null
  }

  const goldCount = goldCode ? codes.filter((code) => code === goldCode).length : 0

  if (goldCount === 1 && !rules.standardWin.allowSingleGoldPingHu) {
    return null
  }

  if (goldCount > 1 && !rules.standardWin.allowDoubleGoldPingHu) {
    return null
  }

  const nonGoldCodes = goldCode ? codes.filter((code) => code !== goldCode) : codes.slice()
  const counts = buildCounts(nonGoldCodes)
  const pairCandidates = getSortedCodes(counts)
  let naturalPair = false
  const goldPairCodes = []

  for (let index = 0; index < pairCandidates.length; index += 1) {
    const pairCode = pairCandidates[index]

    if (counts[pairCode] >= 2) {
      const naturalCounts = removeCount(counts, pairCode, 2)
      if (canFormMeldsWithGold(naturalCounts, goldCount, {})) {
        naturalPair = true
      }
    }

    if (goldCount >= 1 && counts[pairCode] >= 1) {
      const goldPairCounts = removeCount(counts, pairCode, 1)
      if (canFormMeldsWithGold(goldPairCounts, goldCount - 1, {})) {
        goldPairCodes.push(pairCode)
      }
    }
  }

  let doubleGoldPair = false
  if (goldCount >= 2 && rules.standardWin.allowDoubleGoldPingHu) {
    doubleGoldPair = canFormMeldsWithGold(counts, goldCount - 2, {})
  }

  if (!naturalPair && !goldPairCodes.length && !doubleGoldPair) {
    return null
  }

  let pairMode = 'natural'
  if (!naturalPair) {
    pairMode = goldPairCodes.length ? 'gold-pair' : 'double-gold-pair'
  }

  return {
    usesGold: goldCount > 0,
    pairMode,
    goldCount,
    goldPairCodes: goldPairCodes.sort((left, right) => getTileSortKey(left) - getTileSortKey(right))
  }
}

function buildFailedEvaluation(extra) {
  return Object.assign({
    canHu: false,
    patternId: '',
    patternLabel: '',
    goldCount: 0,
    usesGold: false,
    pairMode: '',
    goldPairCodes: []
  }, extra)
}

function resolvePatternBySeatState(state, seat, extraTile) {
  if (!extraTile && seat.youJinLevel >= 3) {
    return {
      patternId: 'tripleYouJin',
      patternLabel: '三游'
    }
  }

  if (!extraTile && seat.youJinLevel >= 2) {
    return {
      patternId: 'doubleYouJin',
      patternLabel: '双游'
    }
  }

  if (!extraTile && seat.youJinLevel >= 1) {
    return {
      patternId: 'youJin',
      patternLabel: '游金'
    }
  }

  if (!extraTile && seat.tianTingActive && state.rules.winningPatterns.tianTing) {
    return {
      patternId: 'tianTing',
      patternLabel: '天听'
    }
  }

  return {
    patternId: 'standard',
    patternLabel: '平胡'
  }
}

function evaluateWin(state, seat, extraTile) {
  const rules = state.rules
  const goldCode = state.goldTileCode || ''
  const codes = seat.concealedTiles.map(getCode)

  if (extraTile) {
    codes.push(getCode(extraTile))
  }

  const openMeldCount = (seat.melds || []).length
  const targetTileCount = (rules.dealing.winSetCount - openMeldCount) * 3 + 2

  if (codes.length !== targetTileCount) {
    return buildFailedEvaluation({
      goldCode
    })
  }

  const goldCount = goldCode ? codes.filter((code) => code === goldCode).length : 0

  if (rules.winningPatterns.threeGoldDown && goldCount >= 3) {
    return {
      canHu: true,
      patternId: 'threeGoldDown',
      patternLabel: '三金倒',
      goldCount,
      usesGold: true,
      pairMode: 'special',
      goldPairCodes: [],
      goldCode,
      openMeldCount,
      handTileCount: codes.length,
      extraTileCode: extraTile ? getCode(extraTile) : ''
    }
  }

  if (!rules.winningPatterns.standardHand) {
    return buildFailedEvaluation({ goldCode, goldCount })
  }

  const standardResult = analyzeStandardWinWithGold(codes, goldCode, openMeldCount, rules)

  if (!standardResult) {
    return buildFailedEvaluation({ goldCode, goldCount })
  }

  const pattern = resolvePatternBySeatState(state, seat, extraTile)

  return {
    canHu: true,
    patternId: pattern.patternId,
    patternLabel: pattern.patternLabel,
    goldCount,
    usesGold: standardResult.usesGold,
    pairMode: standardResult.pairMode,
    goldPairCodes: standardResult.goldPairCodes,
    goldCode,
    openMeldCount,
    handTileCount: codes.length,
    extraTileCode: extraTile ? getCode(extraTile) : ''
  }
}

function buildSeatLike(seat, concealedTiles) {
  return {
    concealedTiles,
    melds: seat.melds || [],
    flowers: seat.flowers || [],
    youJinLevel: 0,
    tianTingActive: false
  }
}

function findWinningCodes(state, seat) {
  const openMeldCount = (seat.melds || []).length
  const targetTileCount = (state.rules.dealing.winSetCount - openMeldCount) * 3 + 1
  const concealedTiles = seat.concealedTiles || []

  if (concealedTiles.length !== targetTileCount) {
    return []
  }

  const winningCodes = []

  PLAYABLE_CODES.forEach((code) => {
    const evaluation = evaluateWin(state, buildSeatLike(seat, concealedTiles), { code })
    if (evaluation.canHu) {
      winningCodes.push(code)
    }
  })

  return winningCodes.sort((left, right) => getTileSortKey(left) - getTileSortKey(right))
}

function getTianTingDiscardCodes(state, seat) {
  const seen = {}
  const discardCodes = []

  seat.concealedTiles.forEach((tile, index) => {
    if (seen[tile.code]) {
      return
    }

    seen[tile.code] = true
    const nextTiles = seat.concealedTiles.slice(0, index).concat(seat.concealedTiles.slice(index + 1))
    const waitingCodes = findWinningCodes(state, buildSeatLike(seat, nextTiles))

    if (waitingCodes.length) {
      discardCodes.push(tile.code)
    }
  })

  return discardCodes.sort((left, right) => getTileSortKey(left) - getTileSortKey(right))
}

function getYouJinEntryCodes(state, seat) {
  const evaluation = evaluateWin(state, buildSeatLike(seat, seat.concealedTiles))

  if (!evaluation.canHu || evaluation.patternId !== 'standard') {
    return []
  }

  return evaluation.goldPairCodes.slice()
}

function canHuForSeat(seat, extraTile, state) {
  return evaluateWin(state, seat, extraTile).canHu
}

module.exports = {
  canHuForSeat,
  evaluateWin,
  findWinningCodes,
  getTianTingDiscardCodes,
  getYouJinEntryCodes
}
