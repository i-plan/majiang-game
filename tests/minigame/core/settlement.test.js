const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '../../..')
const rules = require(path.join(ROOT, 'minigame', 'game', 'config', 'rules', 'mvp'))
const { buildRoundResult, buildSeatFanBreakdown } = require(path.join(ROOT, 'minigame', 'game', 'core', 'settlement'))

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

function createTiles(specs, prefix) {
  return specs.map((spec, index) => createTile(spec.code, spec.label, `${prefix}-${index}`))
}

function createAllFlowerTiles(prefix) {
  return createTiles([
    { code: 'spring', label: '春' },
    { code: 'summer', label: '夏' },
    { code: 'autumn', label: '秋' },
    { code: 'winter', label: '冬' },
    { code: 'plum', label: '梅' },
    { code: 'orchid', label: '兰' },
    { code: 'flower-bamboo', label: '竹' },
    { code: 'chrysanthemum', label: '菊' }
  ], prefix)
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

test('buildRoundResult covers loser-to-loser negative fan transfers and can end the match on pairwise settlement', () => {
  const state = createState({
    bankerBase: 2,
    dealerSeat: 0,
    discardCount: 4,
    roundIndex: 5,
    seats: [
      createSeat(0, 3),
      createSeat(1, 100, { flowers: createFlowerTiles(1, 'seat-1') }),
      createSeat(2, 3),
      createSeat(3, 100)
    ]
  })

  const result = buildRoundResult(state, {
    type: 'discardWin',
    winnerSeat: 3,
    discarderSeat: 0,
    winningTile: createTile('wan-6', '6万', 'winning-negative-pairwise')
  })

  assert.deepEqual(
    result.pairwiseTransfers.map((item) => ({ fromSeat: item.fromSeat, toSeat: item.toSeat, value: item.value })),
    [
      { fromSeat: 0, toSeat: 1, value: 1 },
      { fromSeat: 2, toSeat: 1, value: 1 }
    ]
  )
  assert.deepEqual(result.deltas, [-3, 0, -3, 6])
  assert.deepEqual(result.nextScores, [0, 100, 0, 106])
  assert.equal(result.matchEnded, true)
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

test('buildRoundResult keeps selfDraw when the tianHu dealer-first-draw boundary is not met', () => {
  const cases = [
    {
      name: 'non-dealer self draw on discard count 0',
      dealerSeat: 0,
      discardCount: 0,
      winnerSeat: 1
    },
    {
      name: 'dealer self draw after at least one discard',
      dealerSeat: 0,
      discardCount: 1,
      winnerSeat: 0
    }
  ]

  cases.forEach(({ name, dealerSeat, discardCount, winnerSeat }) => {
    const state = createState({
      bankerBase: 2,
      dealerSeat,
      discardCount,
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
      winnerSeat,
      winningTile: createTile('wan-2', '2万', `self-draw-${name}`)
    })

    assert.equal(result.type, 'selfDraw')
    assert.equal(result.mainWinType.id, 'selfDraw')
    assert.equal(result.mainWinType.label, '自摸')
    assert.notEqual(result.mainWinType.id, 'tianHu')
  })
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

test('buildRoundResult keeps discardWin and qiangGang main settlement evenly shared across all three losers', () => {
  const cases = [
    {
      type: 'discardWin',
      expectedShare: 2,
      expectedMainWinTypeId: 'pingHu',
      expectedDeltas: [-2, -2, 6, -2],
      winningTile: createTile('wan-4', '4万', 'shared-discard-win')
    },
    {
      type: 'qiangGang',
      expectedShare: 4,
      expectedMainWinTypeId: 'qiangGang',
      expectedDeltas: [-4, -4, 12, -4],
      winningTile: createTile('tong-8', '8筒', 'shared-qiang-gang')
    }
  ]

  cases.forEach(({ type, expectedShare, expectedMainWinTypeId, expectedDeltas, winningTile }) => {
    const state = createState({
      bankerBase: 2,
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
      type,
      winnerSeat: 2,
      discarderSeat: 1,
      winningTile
    })

    assert.equal(result.mainWinType.id, expectedMainWinTypeId)
    assert.equal(result.mainSettlement.share, expectedShare)
    assert.deepEqual(result.pairwiseTransfers, [])
    assert.deepEqual(result.deltas, expectedDeltas)
    assert.deepEqual(result.deltas.filter((value, index) => index !== 2), [-expectedShare, -expectedShare, -expectedShare])
  })
})

test('buildRoundResult includes a claimed gold winning tile in the winner fan breakdown and share', () => {
  const state = createState({
    bankerBase: 2,
    dealerSeat: 0,
    discardCount: 4,
    roundIndex: 6,
    goldTileCode: 'white',
    goldTileLabel: '白',
    seats: [
      createSeat(0, 100),
      createSeat(1, 100),
      createSeat(2, 100, {
        concealedTiles: createTiles([
          { code: 'white', label: '白' }
        ], 'winner')
      }),
      createSeat(3, 100)
    ]
  })

  const result = buildRoundResult(state, {
    type: 'discardWin',
    winnerSeat: 2,
    discarderSeat: 0,
    winningTile: createTile('white', '白', 'claimed-gold')
  })

  assert.equal(result.fanDetailsBySeat[2].goldCount, 2)
  assert.deepEqual(result.fanDetailsBySeat[2].items.map((item) => ({ label: item.label, total: item.total })), [
    { label: '金牌', total: 2 }
  ])
  assert.equal(result.mainSettlement.winnerFanTotal, 2)
  assert.equal(result.mainSettlement.share, 4)
  assert.deepEqual(result.deltas, [-4, -4, 12, -4])
  assert.deepEqual(result.nextScores, [96, 96, 112, 96])
})

test('buildSeatFanBreakdown counts gold honors without double-counting them as honor concealed triplets', () => {
  const state = createState({
    goldTileCode: 'white',
    goldTileLabel: '白',
    seats: []
  })
  const seat = createSeat(0, 100, {
    concealedTiles: createTiles([
      { code: 'white', label: '白' },
      { code: 'white', label: '白' },
      { code: 'white', label: '白' },
      { code: 'bamboo-5', label: '5条' }
    ], 'gold-triplet')
  })

  const fanDetail = buildSeatFanBreakdown(state, seat)

  assert.equal(fanDetail.totalFan, 3)
  assert.equal(fanDetail.goldCount, 3)
  assert.deepEqual(fanDetail.items.map((item) => ({ label: item.label, total: item.total })), [
    { label: '金牌', total: 3 }
  ])
  assert.equal(fanDetail.items.some((item) => item.label === '字牌暗刻'), false)
})

test('buildSeatFanBreakdown does not treat a claimed honor winning tile as an honor concealed triplet', () => {
  const state = createState({
    seats: []
  })
  const seat = createSeat(0, 100, {
    concealedTiles: createTiles([
      { code: 'east', label: '东' },
      { code: 'east', label: '东' },
      { code: 'bamboo-5', label: '5条' }
    ], 'claimed-honor')
  })

  const fanDetail = buildSeatFanBreakdown(state, seat, createTile('east', '东', 'winning-east'))

  assert.equal(fanDetail.totalFan, 0)
  assert.deepEqual(fanDetail.items, [])
  assert.equal(fanDetail.items.some((item) => item.label === '字牌暗刻'), false)
})

test('buildSeatFanBreakdown counts a claimed gold suit winning tile without treating it as an ordinary concealed triplet', () => {
  const state = createState({
    goldTileCode: 'wan-3',
    goldTileLabel: '3万',
    seats: []
  })
  const seat = createSeat(0, 100, {
    concealedTiles: createTiles([
      { code: 'wan-3', label: '3万' },
      { code: 'wan-3', label: '3万' },
      { code: 'bamboo-5', label: '5条' }
    ], 'claimed-gold-suit')
  })

  const fanDetail = buildSeatFanBreakdown(state, seat, createTile('wan-3', '3万', 'winning-wan-3'))

  assert.equal(fanDetail.totalFan, 3)
  assert.equal(fanDetail.goldCount, 3)
  assert.deepEqual(fanDetail.items.map((item) => ({ label: item.label, total: item.total })), [
    { label: '金牌', total: 3 }
  ])
  assert.equal(fanDetail.items.some((item) => item.label === '暗刻'), false)
})

test('buildSeatFanBreakdown does not treat a claimed suit winning tile as an ordinary concealed triplet', () => {
  const state = createState({
    seats: []
  })
  const seat = createSeat(0, 100, {
    concealedTiles: createTiles([
      { code: 'wan-4', label: '4万' },
      { code: 'wan-4', label: '4万' },
      { code: 'bamboo-5', label: '5条' }
    ], 'claimed-suit')
  })

  const fanDetail = buildSeatFanBreakdown(state, seat, createTile('wan-4', '4万', 'winning-wan-4'))

  assert.equal(fanDetail.totalFan, 0)
  assert.deepEqual(fanDetail.items, [])
  assert.equal(fanDetail.items.some((item) => item.label === '暗刻'), false)
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

test('buildSeatFanBreakdown stacks gold, flower, triplet, peng, and gang fans from all sources', () => {
  const state = createState({
    goldTileCode: 'white',
    goldTileLabel: '白',
    seats: []
  })
  const seat = createSeat(0, 100, {
    concealedTiles: createTiles([
      { code: 'east', label: '东' },
      { code: 'east', label: '东' },
      { code: 'east', label: '东' },
      { code: 'wan-1', label: '1万' },
      { code: 'wan-1', label: '1万' },
      { code: 'wan-1', label: '1万' },
      { code: 'white', label: '白' },
      { code: 'bamboo-5', label: '5条' }
    ], 'concealed'),
    melds: [
      {
        type: 'peng',
        code: 'red',
        tiles: createTiles([
          { code: 'red', label: '中' },
          { code: 'red', label: '中' },
          { code: 'red', label: '中' }
        ], 'peng')
      },
      {
        type: 'gang',
        gangType: 'add',
        code: 'bamboo-4',
        tiles: createTiles([
          { code: 'bamboo-4', label: '4条' },
          { code: 'bamboo-4', label: '4条' },
          { code: 'bamboo-4', label: '4条' },
          { code: 'bamboo-4', label: '4条' }
        ], 'add-gang')
      },
      {
        type: 'gang',
        gangType: 'concealed',
        code: 'south',
        tiles: createTiles([
          { code: 'south', label: '南' },
          { code: 'south', label: '南' },
          { code: 'south', label: '南' },
          { code: 'south', label: '南' }
        ], 'concealed-gang')
      },
      {
        type: 'gang',
        gangType: 'melded',
        code: 'tong-7',
        tiles: createTiles([
          { code: 'tong-7', label: '7筒' },
          { code: 'tong-7', label: '7筒' },
          { code: 'tong-7', label: '7筒' },
          { code: 'tong-7', label: '7筒' }
        ], 'melded-gang')
      }
    ],
    flowers: createAllFlowerTiles('flowers')
  })

  const fanDetail = buildSeatFanBreakdown(state, seat, createTile('white', '白', 'winning'))

  assert.equal(fanDetail.totalFan, 53)
  assert.equal(fanDetail.goldCount, 2)
  assert.equal(fanDetail.flowerCount, 8)
  assert.deepEqual(
    fanDetail.items.map((item) => ({ label: item.label, total: item.total })),
    [
      { label: '金牌', total: 2 },
      { label: '花牌', total: 8 },
      { label: '春夏秋冬', total: 8 },
      { label: '梅兰竹菊', total: 8 },
      { label: '八花齐', total: 16 },
      { label: '字牌暗刻', total: 2 },
      { label: '暗刻', total: 1 },
      { label: '字牌碰牌', total: 1 },
      { label: '补杠', total: 1 },
      { label: '字牌暗杠', total: 4 },
      { label: '明杠', total: 2 }
    ]
  )
})

test('buildSeatFanBreakdown counts an ordinary concealed gang as the non-honor concealed-gang fan', () => {
  const state = createState({
    seats: []
  })
  const seat = createSeat(0, 100, {
    melds: [
      {
        type: 'gang',
        gangType: 'concealed',
        code: 'tong-3',
        tiles: createTiles([
          { code: 'tong-3', label: '3筒' },
          { code: 'tong-3', label: '3筒' },
          { code: 'tong-3', label: '3筒' },
          { code: 'tong-3', label: '3筒' }
        ], 'ordinary-concealed-gang')
      }
    ]
  })

  const fanDetail = buildSeatFanBreakdown(state, seat)

  assert.equal(fanDetail.totalFan, rules.fanValues.concealedGang)
  assert.equal(fanDetail.goldCount, 0)
  assert.equal(fanDetail.flowerCount, 0)
  assert.deepEqual(
    fanDetail.items.map((item) => ({ label: item.label, total: item.total })),
    [
      { label: '暗杠', total: rules.fanValues.concealedGang }
    ]
  )
})

test('buildSeatFanBreakdown counts honor gangs and partial flower collections without eight-flower bonus', () => {
  const state = createState({
    seats: []
  })
  const seat = createSeat(0, 100, {
    melds: [
      {
        type: 'gang',
        gangType: 'add',
        code: 'east',
        tiles: createTiles([
          { code: 'east', label: '东' },
          { code: 'east', label: '东' },
          { code: 'east', label: '东' },
          { code: 'east', label: '东' }
        ], 'honor-add-gang')
      },
      {
        type: 'gang',
        gangType: 'melded',
        code: 'red',
        tiles: createTiles([
          { code: 'red', label: '中' },
          { code: 'red', label: '中' },
          { code: 'red', label: '中' },
          { code: 'red', label: '中' }
        ], 'honor-melded-gang')
      }
    ],
    flowers: createTiles([
      { code: 'spring', label: '春' },
      { code: 'summer', label: '夏' },
      { code: 'autumn', label: '秋' },
      { code: 'winter', label: '冬' }
    ], 'season-flowers')
  })

  const fanDetail = buildSeatFanBreakdown(state, seat)

  assert.equal(fanDetail.totalFan, 17)
  assert.equal(fanDetail.goldCount, 0)
  assert.equal(fanDetail.flowerCount, 4)
  assert.deepEqual(
    fanDetail.items.map((item) => ({ label: item.label, total: item.total })),
    [
      { label: '花牌', total: 4 },
      { label: '春夏秋冬', total: 8 },
      { label: '字牌补杠', total: 2 },
      { label: '字牌明杠', total: 3 }
    ]
  )
})

test('buildRoundResult keeps ordinary selfDraw, zero pairwise transfers, and match end when a loser reaches zero', () => {
  const state = createState({
    bankerBase: 2,
    dealerSeat: 0,
    discardCount: 3,
    roundIndex: 8,
    seats: [
      createSeat(0, 100),
      createSeat(1, 4),
      createSeat(2, 100),
      createSeat(3, 100)
    ]
  })

  const result = buildRoundResult(state, {
    type: 'selfDraw',
    winnerSeat: 2,
    winningTile: createTile('tong-2', '2筒', 'self-draw')
  })

  assert.equal(result.typeLabel, '自摸')
  assert.equal(result.mainWinType.id, 'selfDraw')
  assert.equal(result.mainSettlement.share, 4)
  assert.equal(result.nextDealerSeat, 2)
  assert.equal(result.matchEnded, true)
  assert.deepEqual(result.pairwiseTransfers, [])
  assert.match(result.summaryText, /番差为 0/)
  assert.deepEqual(result.deltas, [-4, -4, 12, -4])
  assert.deepEqual(result.nextScores, [96, 0, 112, 96])
})

test('buildRoundResult keeps special self-draw win types ahead of the tianHu fallback', () => {
  const cases = [
    { patternId: 'threeGoldDown', expectedId: 'threeGoldDown', expectedLabel: '三金倒', expectedMultiplier: 3 },
    { patternId: 'tianTing', expectedId: 'tianTing', expectedLabel: '天听', expectedMultiplier: 4 },
    { patternId: 'youJin', expectedId: 'youJin', expectedLabel: '游金', expectedMultiplier: 4 },
    { patternId: 'doubleYouJin', expectedId: 'doubleYouJin', expectedLabel: '双游', expectedMultiplier: 8 },
    { patternId: 'tripleYouJin', expectedId: 'tripleYouJin', expectedLabel: '三游', expectedMultiplier: 16 }
  ]

  cases.forEach(({ patternId, expectedId, expectedLabel, expectedMultiplier }) => {
    const state = createState({
      bankerBase: 2,
      dealerSeat: 0,
      discardCount: 0,
      roundIndex: 9,
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
      winningTile: createTile('wan-1', '1万', `special-${patternId}`),
      winInfo: {
        patternId
      }
    })

    assert.equal(result.mainWinType.id, expectedId)
    assert.equal(result.mainWinType.label, expectedLabel)
    assert.equal(result.mainWinType.multiplier, expectedMultiplier)
    assert.equal(result.mainSettlement.share, 2 * expectedMultiplier)
    assert.notEqual(result.mainWinType.id, 'tianHu')
  })
})
