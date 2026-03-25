const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const rules = require(path.join(ROOT, 'game', 'config', 'rules', 'mvp'))
const { buildRoundResult } = require(path.join(ROOT, 'game', 'core', 'settlement'))

const WINDS = ['东', '南', '西', '北']

function createTile(code, label, index) {
  return {
    id: `${code}-${index}`,
    code,
    label
  }
}

function createFlowerTiles(count, prefix) {
  return new Array(count).fill(null).map((_, index) => createTile('plum', '梅', `${prefix}-${index}`))
}

function createSeat(seatId, score, options) {
  const seatOptions = options || {}

  return {
    seatId,
    wind: WINDS[seatId],
    concealedTiles: seatOptions.concealedTiles || [],
    melds: seatOptions.melds || [],
    flowers: seatOptions.flowers || [],
    discards: seatOptions.discards || [],
    score,
    youJinLevel: 0,
    tianTingActive: false,
    tianTingEligible: false
  }
}

function createState(options) {
  const stateOptions = options || {}

  return {
    rules,
    seats: stateOptions.seats,
    bankerBase: stateOptions.bankerBase || 2,
    dealerSeat: typeof stateOptions.dealerSeat === 'number' ? stateOptions.dealerSeat : 0,
    goldTileCode: stateOptions.goldTileCode || '',
    goldTileLabel: stateOptions.goldTileLabel || '',
    goldDice: stateOptions.goldDice || [],
    goldDiceTotal: stateOptions.goldDiceTotal || 0,
    roundIndex: stateOptions.roundIndex || 1,
    discardCount: stateOptions.discardCount || 0
  }
}

test('buildRoundResult adds pairwise fan transfers only among the three losing seats', () => {
  const state = createState({
    bankerBase: 2,
    dealerSeat: 0,
    discardCount: 3,
    roundIndex: 4,
    seats: [
      createSeat(0, 100, { flowers: createFlowerTiles(3, 'seat-0') }),
      createSeat(1, 100),
      createSeat(2, 100, { flowers: createFlowerTiles(1, 'seat-2') }),
      createSeat(3, 100)
    ]
  })

  const result = buildRoundResult(state, {
    type: 'discardWin',
    winnerSeat: 1,
    discarderSeat: 0,
    winningTile: createTile('wan-3', '3万', 'winning')
  })

  assert.equal(result.mainWinType.id, 'pingHu')
  assert.deepEqual(
    result.pairwiseTransfers.map((item) => ({ fromSeat: item.fromSeat, toSeat: item.toSeat, value: item.value })),
    [
      { fromSeat: 2, toSeat: 0, value: 2 },
      { fromSeat: 3, toSeat: 0, value: 3 },
      { fromSeat: 3, toSeat: 2, value: 1 }
    ]
  )
  assert.deepEqual(result.deltas, [3, 6, -3, -6])
  assert.deepEqual(result.nextScores, [103, 106, 97, 94])
  assert.equal(result.deltas.reduce((total, value) => total + value, 0), 0)
  assert.match(result.summaryText, /另算番差/)
})

test('buildRoundResult upgrades dealer first-draw self draw to tianHu', () => {
  const state = createState({
    bankerBase: 2,
    dealerSeat: 0,
    discardCount: 0,
    roundIndex: 1,
    seats: [
      createSeat(0, 100),
      createSeat(1, 100),
      createSeat(2, 100),
      createSeat(3, 100)
    ]
  })

  const result = buildRoundResult(state, {
    type: 'selfDraw',
    winnerSeat: 0,
    winningTile: createTile('wan-1', '1万', 'self-draw')
  })

  assert.equal(result.type, 'selfDraw')
  assert.equal(result.mainWinType.id, 'tianHu')
  assert.equal(result.discarderSeat, null)
  assert.equal(result.winningTileLabel, '1万')
  assert.equal(result.nextDealerSeat, 0)
  assert.deepEqual(result.deltas, [24, -8, -8, -8])
  assert.equal(result.deltas.reduce((total, value) => total + value, 0), 0)
})

test('buildRoundResult keeps qiangGang source seat and winner seat consistent', () => {
  const state = createState({
    bankerBase: 10,
    dealerSeat: 0,
    discardCount: 5,
    roundIndex: 6,
    seats: [
      createSeat(0, 100),
      createSeat(1, 100),
      createSeat(2, 100),
      createSeat(3, 100)
    ]
  })

  const result = buildRoundResult(state, {
    type: 'qiangGang',
    winnerSeat: 2,
    discarderSeat: 1,
    winningTile: createTile('tong-8', '8筒', 'rob-gang')
  })

  assert.equal(result.typeLabel, '抢杠胡')
  assert.equal(result.mainWinType.id, 'qiangGang')
  assert.equal(result.winnerSeat, 2)
  assert.equal(result.discarderSeat, 1)
  assert.equal(result.winningTileLabel, '8筒')
  assert.equal(result.nextDealerSeat, 2)
})

test('buildRoundResult marks draw games as match ended when any score is already zero or below', () => {
  const state = createState({
    bankerBase: 10,
    dealerSeat: 2,
    discardCount: 8,
    roundIndex: 7,
    seats: [
      createSeat(0, 100),
      createSeat(1, 0),
      createSeat(2, 120),
      createSeat(3, 80)
    ]
  })

  const result = buildRoundResult(state, {
    type: 'drawGame'
  })

  assert.equal(result.matchEnded, true)
  assert.equal(result.winnerSeat, null)
  assert.equal(result.discarderSeat, null)
  assert.deepEqual(result.deltas, [0, 0, 0, 0])
  assert.deepEqual(result.currentScores, [100, 0, 120, 80])
  assert.deepEqual(result.nextScores, [100, 0, 120, 80])
  assert.equal(result.nextDealerSeat, 2)
  assert.equal(result.mainWinType.id, 'drawGame')
})
