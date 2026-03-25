const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const { buildResultView } = require(path.join(ROOT, 'game', 'selectors', 'resultView'))

function createSeat(seatId, wind, score) {
  return {
    seatId,
    wind,
    concealedTiles: [{ id: `tile-${seatId}`, label: `${seatId + 1}万` }],
    melds: [],
    flowers: [],
    discards: [],
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

test('buildResultView keeps the newest 10 logs in original order', () => {
  const view = buildResultView(createSnapshot('discardWin'))

  assert.equal(view.recentLogs.length, 10)
  assert.deepEqual(
    view.recentLogs.map((item) => item.id),
    ['log-1', 'log-2', 'log-3', 'log-4', 'log-5', 'log-6', 'log-7', 'log-8', 'log-9', 'log-10']
  )
})
