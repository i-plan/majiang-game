const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '../../..')
const rules = require(path.join(ROOT, 'minigame', 'game', 'config', 'rules', 'mvp'))
const { buildRoundResult } = require(path.join(ROOT, 'minigame', 'game', 'core', 'settlement'))
const { buildResultView } = require(path.join(ROOT, 'minigame', 'game', 'selectors', 'resultView'))

function createTile(code, label, index) {
  return {
    id: `${code}-${index}`,
    code,
    label
  }
}

function createTiles(specs, prefix) {
  return specs.map((spec, index) => createTile(spec.code, spec.label, `${prefix}-${index}`))
}

function createFlowerTiles(count, prefix) {
  return new Array(count).fill(null).map((_, index) => createTile('plum', '梅', `${prefix}-${index}`))
}

function createSeat(seatId, wind, score, options) {
  const seatOptions = options || {}

  return {
    seatId,
    wind,
    concealedTiles: seatOptions.concealedTiles || [{ id: `tile-${seatId}`, label: `${seatId + 1}万` }],
    melds: seatOptions.melds || [],
    flowers: seatOptions.flowers || [],
    discards: seatOptions.discards || [],
    score
  }
}

function createResult(type) {
  if (type === 'drawGame') {
    return {
      type,
      typeLabel: '流局',
      mainWinType: {
        label: '流局'
      },
      summaryText: '牌墙剩 16 张流局，本局不结算胡牌分。',
      roundIndex: 2,
      bankerBase: 10,
      goldTileLabel: '1筒',
      goldDice: [1, 1],
      goldDiceTotal: 2,
      winnerSeat: null,
      discarderSeat: null,
      nextDealerSeat: 0,
      winningTileLabel: '',
      mainSettlement: {
        winnerFanTotal: 0,
        share: 0,
        total: 0
      },
      pairwiseTransfers: [],
      deltas: [0, 0, 0, 0],
      nextScores: [100, 100, 100, 100],
      matchEnded: false,
      fanDetailsBySeat: [
        { totalFan: 0, items: [] },
        { totalFan: 0, items: [] },
        { totalFan: 0, items: [] },
        { totalFan: 0, items: [] }
      ]
    }
  }

  return {
    type,
    typeLabel: type === 'qiangGang' ? '抢杠胡' : (type === 'selfDraw' ? '自摸胡' : '点炮和'),
    mainWinType: {
      label: type === 'qiangGang' ? '抢杠胡' : (type === 'selfDraw' ? '自摸' : '点炮和')
    },
    summaryText: '测试结算文案',
    roundIndex: 2,
    bankerBase: 10,
    goldTileLabel: '1筒',
    goldDice: [1, 1],
    goldDiceTotal: 2,
    winnerSeat: 1,
    discarderSeat: type === 'selfDraw' ? null : 2,
    nextDealerSeat: 1,
    winningTileLabel: '3万',
    mainSettlement: {
      winnerFanTotal: 5,
      share: 15,
      total: 45
    },
    pairwiseTransfers: [],
    deltas: [-15, 45, -20, -10],
    nextScores: [85, 145, 80, 90],
    matchEnded: false,
    fanDetailsBySeat: [
      { totalFan: 1, items: [] },
      { totalFan: 5, items: [] },
      { totalFan: 0, items: [] },
      { totalFan: 0, items: [] }
    ]
  }
}

function createSnapshot(type) {
  return {
    result: createResult(type),
    seats: [
      createSeat(0, '东', 100),
      createSeat(1, '南', 100),
      createSeat(2, '西', 100),
      createSeat(3, '北', 100)
    ],
    log: new Array(12).fill(null).map((_, index) => ({
      id: `log-${index + 1}`,
      text: `测试日志 ${index + 1}`
    }))
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

function createRealSnapshot(state, outcome) {
  return {
    result: buildRoundResult(state, outcome),
    seats: state.seats,
    log: new Array(3).fill(null).map((_, index) => ({
      id: `real-log-${index + 1}`,
      text: `真实结算日志 ${index + 1}`
    }))
  }
}

test('buildResultView exposes the correct source-seat role label for discard wins and rob-gang wins', () => {
  const discardWinView = buildResultView(createSnapshot('discardWin'))
  const qiangGangView = buildResultView(createSnapshot('qiangGang'))

  assert.equal(discardWinView.sourceSeatRoleLabel, '放炮')
  assert.equal(discardWinView.sourceSeatLabel, '对家')
  assert.equal(qiangGangView.sourceSeatRoleLabel, '被抢杠')
  assert.equal(qiangGangView.sourceSeatLabel, '对家')
})

test('buildResultView marks score rows by actual positive and negative deltas', () => {
  const view = buildResultView(createSnapshot('discardWin'))

  assert.equal(view.seatResults[0].isNegativeDelta, true)
  assert.equal(view.seatResults[0].isPositiveDelta, false)
  assert.equal(view.seatResults[1].isPositiveDelta, true)
  assert.equal(view.seatResults[1].isNegativeDelta, false)
  assert.equal(view.seatResults[2].isNegativeDelta, true)
  assert.equal(view.seatResults[3].isNegativeDelta, true)
})

test('buildResultView hides winner-specific tags for draw games', () => {
  const view = buildResultView(createSnapshot('drawGame'))

  assert.equal(view.typeLabel, '流局')
  assert.equal(view.mainWinLabel, '')
  assert.equal(view.winnerLabel, '')
  assert.equal(view.sourceSeatLabel, '')
  assert.equal(view.winningTileLabel, '')
  assert.equal(view.nextDealerLabel, '你')
})

test('buildResultView keeps self-draw fields without a source-seat tag', () => {
  const view = buildResultView(createSnapshot('selfDraw'))

  assert.equal(view.typeLabel, '自摸胡')
  assert.equal(view.mainWinLabel, '自摸')
  assert.equal(view.winnerLabel, '右家')
  assert.equal(view.sourceSeatLabel, '')
  assert.equal(view.winningTileLabel, '3万')
})

test('buildResultView keeps gold info and next dealer markers in sync', () => {
  const view = buildResultView(createSnapshot('discardWin'))

  assert.equal(view.goldTileLabel, '1筒')
  assert.equal(view.goldDiceLabel, '1 + 1 = 2')
  assert.equal(view.nextDealerLabel, '右家')
  assert.equal(view.seatResults[1].isNextDealer, true)
  assert.equal(view.seatResults.filter((item) => item.isNextDealer).length, 1)
})

test('buildResultView formats a real discard-win settlement with pairwise transfers and claimed winning tile display', () => {
  const state = createState({
    bankerBase: 2,
    dealerSeat: 0,
    discardCount: 3,
    roundIndex: 4,
    seats: [
      createSeat(0, '东', 100, {
        concealedTiles: createTiles([{ code: 'wan-9', label: '9万' }], 'seat-0-hand'),
        flowers: createFlowerTiles(3, 'seat-0-flower')
      }),
      createSeat(1, '南', 100, {
        concealedTiles: createTiles([
          { code: 'wan-1', label: '1万' },
          { code: 'wan-2', label: '2万' }
        ], 'seat-1-hand'),
        flowers: createFlowerTiles(1, 'seat-1-flower')
      }),
      createSeat(2, '西', 100, {
        concealedTiles: createTiles([{ code: 'tong-5', label: '5筒' }], 'seat-2-hand'),
        flowers: createFlowerTiles(1, 'seat-2-flower')
      }),
      createSeat(3, '北', 100, {
        concealedTiles: createTiles([{ code: 'bamboo-7', label: '7条' }], 'seat-3-hand')
      })
    ]
  })
  const view = buildResultView(createRealSnapshot(state, {
    type: 'discardWin',
    winnerSeat: 1,
    discarderSeat: 0,
    winningTile: createTile('wan-3', '3万', 'winning')
  }))

  assert.equal(view.typeLabel, '点炮和')
  assert.equal(view.mainWinLabel, '点炮和')
  assert.equal(view.winnerLabel, '右家')
  assert.equal(view.sourceSeatRoleLabel, '放炮')
  assert.equal(view.sourceSeatLabel, '你')
  assert.equal(view.nextDealerLabel, '右家')
  assert.equal(view.mainSettlementText, '(2 底 + 1 番) × 1 = 每家主付 3，胡家主收 9。')
  assert.deepEqual(view.pairwiseTransferTexts, [
    '对家 向 你 支付 2 分番差',
    '左家 向 你 支付 3 分番差',
    '左家 向 对家 支付 1 分番差'
  ])
  assert.equal(view.replayButtonText, '下一局')
  assert.deepEqual(view.seatResults[1].concealedLabels, ['1万', '2万', '3万'])
  assert.equal(view.seatResults[1].fanItemsText, '花牌 × 1 = 1番')
  assert.equal(view.seatResults[0].fanItemsText, '花牌 × 3 = 3番')
})

test('buildResultView formats a real match-ended self-draw settlement without duplicating the winning tile', () => {
  const state = createState({
    bankerBase: 2,
    dealerSeat: 0,
    discardCount: 3,
    roundIndex: 8,
    seats: [
      createSeat(0, '东', 100, {
        concealedTiles: createTiles([{ code: 'wan-1', label: '1万' }], 'self-0')
      }),
      createSeat(1, '南', 4, {
        concealedTiles: createTiles([{ code: 'wan-2', label: '2万' }], 'self-1')
      }),
      createSeat(2, '西', 100, {
        concealedTiles: createTiles([{ code: 'tong-2', label: '2筒' }], 'self-2')
      }),
      createSeat(3, '北', 100, {
        concealedTiles: createTiles([{ code: 'wan-3', label: '3万' }], 'self-3')
      })
    ]
  })
  const view = buildResultView(createRealSnapshot(state, {
    type: 'selfDraw',
    winnerSeat: 2,
    winningTile: createTile('tong-2', '2筒', 'self-draw')
  }))

  assert.equal(view.typeLabel, '自摸')
  assert.equal(view.mainWinLabel, '自摸')
  assert.equal(view.winnerLabel, '对家')
  assert.equal(view.sourceSeatLabel, '')
  assert.equal(view.nextDealerLabel, '对家')
  assert.equal(view.mainSettlementText, '(2 底 + 0 番) × 2 = 每家主付 4，胡家主收 12。')
  assert.deepEqual(view.pairwiseTransferTexts, [])
  assert.equal(view.matchEnded, true)
  assert.equal(view.replayButtonText, '开始新牌局')
  assert.deepEqual(view.seatResults[2].concealedLabels, ['2筒'])
  assert.equal(view.seatResults[2].deltaText, '+12')
})

test('buildResultView keeps the newest 10 logs in original order', () => {
  const view = buildResultView(createSnapshot('discardWin'))

  assert.equal(view.recentLogs.length, 10)
  assert.deepEqual(
    view.recentLogs.map((item) => item.id),
    ['log-1', 'log-2', 'log-3', 'log-4', 'log-5', 'log-6', 'log-7', 'log-8', 'log-9', 'log-10']
  )
})
