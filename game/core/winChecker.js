const { getTileMeta, getTileSortKey } = require('../config/tileCatalog')

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

function buildMemoKey(counts) {
  return getSortedCodes(counts)
    .map((code) => `${code}:${counts[code]}`)
    .join('|')
}

function reduceCount(counts, code, amount) {
  counts[code] -= amount
  if (counts[code] <= 0) {
    delete counts[code]
  }
}

function increaseCount(counts, code, amount) {
  counts[code] = (counts[code] || 0) + amount
}

function canFormMelds(counts, memo) {
  const key = buildMemoKey(counts)

  if (!key) {
    return true
  }

  if (memo[key] !== undefined) {
    return memo[key]
  }

  const codes = getSortedCodes(counts)
  const currentCode = codes[0]
  const currentCount = counts[currentCode]
  const meta = getTileMeta(currentCode)
  let result = false

  if (currentCount >= 3) {
    reduceCount(counts, currentCode, 3)
    result = canFormMelds(counts, memo)
    increaseCount(counts, currentCode, 3)
  }

  if (!result && meta && meta.category === 'suit' && meta.rank <= 7) {
    const nextCode = `${meta.suit}-${meta.rank + 1}`
    const nextNextCode = `${meta.suit}-${meta.rank + 2}`

    if (counts[nextCode] && counts[nextNextCode]) {
      reduceCount(counts, currentCode, 1)
      reduceCount(counts, nextCode, 1)
      reduceCount(counts, nextNextCode, 1)
      result = canFormMelds(counts, memo)
      increaseCount(counts, currentCode, 1)
      increaseCount(counts, nextCode, 1)
      increaseCount(counts, nextNextCode, 1)
    }
  }

  memo[key] = result
  return result
}

function canHuWithCodes(codes, openMeldCount) {
  const requiredCount = (4 - openMeldCount) * 3 + 2

  if (codes.length !== requiredCount) {
    return false
  }

  const counts = buildCounts(codes)
  const pairCandidates = getSortedCodes(counts).filter((code) => counts[code] >= 2)

  for (let index = 0; index < pairCandidates.length; index += 1) {
    const pairCode = pairCandidates[index]
    const nextCounts = cloneCounts(counts)
    reduceCount(nextCounts, pairCode, 2)

    if (canFormMelds(nextCounts, {})) {
      return true
    }
  }

  return false
}

function canHuForSeat(seat, extraTile) {
  const codes = seat.concealedTiles.map(getCode)

  if (extraTile) {
    codes.push(getCode(extraTile))
  }

  return canHuWithCodes(codes, (seat.melds || []).length)
}

module.exports = {
  canHuForSeat,
  canHuWithCodes
}
