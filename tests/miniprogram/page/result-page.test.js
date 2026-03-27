const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '../../..')
const rules = require(path.join(ROOT, 'miniprogram', 'game', 'config', 'rules', 'mvp'))
const { buildRoundResult } = require(path.join(ROOT, 'miniprogram', 'game', 'core', 'settlement'))
const gameSession = require(path.join(ROOT, 'miniprogram', 'game', 'runtime', 'gameSession'))

const resultPagePath = path.join(ROOT, 'miniprogram', 'pages', 'result', 'result.js')
const resultPageWxmlPath = path.join(ROOT, 'miniprogram', 'pages', 'result', 'result.wxml')

function loadResultPageDefinition() {
  const resolvedResultPagePath = require.resolve(resultPagePath)
  delete require.cache[resolvedResultPagePath]

  const originalPage = global.Page
  const originalWx = global.wx
  let capturedDefinition = null

  global.Page = (definition) => {
    capturedDefinition = definition
  }
  global.wx = {
    redirectTo() {},
    reLaunch() {}
  }

  require(resolvedResultPagePath)

  global.Page = originalPage
  global.wx = originalWx

  return capturedDefinition
}

function createPageInstance() {
  const definition = loadResultPageDefinition()
  const page = {
    data: JSON.parse(JSON.stringify(definition.data)),
    setData(patch) {
      this.data = Object.assign({}, this.data, patch)
    }
  }

  Object.keys(definition).forEach((key) => {
    if (typeof definition[key] === 'function') {
      page[key] = definition[key].bind(page)
    }
  })

  return page
}

function readResultTemplate() {
  return fs.readFileSync(resultPageWxmlPath, 'utf8')
}

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

function createSeat(seatId, score, options) {
  const seatOptions = options || {}
  const winds = ['东', '南', '西', '北']

  return {
    seatId,
    wind: winds[seatId],
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

test('result page sends replay requests through an explicit replay flag without advancing the session first', () => {
  const page = createPageInstance()
  const originalStartNextRound = gameSession.startNextRound
  const originalWx = global.wx

  let startNextRoundCalls = 0
  let redirectedUrl = ''

  gameSession.startNextRound = () => {
    startNextRoundCalls += 1
  }
  global.wx = {
    redirectTo({ url, fail }) {
      redirectedUrl = url
      fail()
    },
    reLaunch() {}
  }

  try {
    page.onReplay()

    assert.equal(redirectedUrl, '/pages/table/table?replay=1')
    assert.equal(startNextRoundCalls, 0)
    assert.equal(page.data.navigating, false)
    assert.equal(page._navigating, false)
  } finally {
    gameSession.startNextRound = originalStartNextRound
    global.wx = originalWx
  }
})

test('result page returns to home when shown without a settled snapshot', () => {
  const page = createPageInstance()
  const originalGetSnapshot = gameSession.getSnapshot
  const originalWx = global.wx

  let relaunchedUrl = ''

  gameSession.getSnapshot = () => null
  global.wx = {
    redirectTo() {},
    reLaunch({ url }) {
      relaunchedUrl = url
    }
  }

  try {
    page.onShow()

    assert.equal(relaunchedUrl, '/pages/home/home')
  } finally {
    gameSession.getSnapshot = originalGetSnapshot
    global.wx = originalWx
  }
})

test('result page returns to home when shown with a non-null but unsettled snapshot', () => {
  const page = createPageInstance()
  const originalGetSnapshot = gameSession.getSnapshot
  const originalWx = global.wx

  let relaunchedUrl = ''

  gameSession.getSnapshot = () => ({
    seats: [],
    log: []
  })
  global.wx = {
    redirectTo() {},
    reLaunch({ url }) {
      relaunchedUrl = url
    }
  }

  try {
    page.data.navigating = true
    page._navigating = true

    page.onShow()

    assert.equal(relaunchedUrl, '/pages/home/home')
    assert.equal(page._navigating, false)
  } finally {
    gameSession.getSnapshot = originalGetSnapshot
    global.wx = originalWx
  }
})

test('result page loads a real discard-win snapshot into page view data', () => {
  const page = createPageInstance()
  const originalGetSnapshot = gameSession.getSnapshot
  const snapshot = createRealSnapshot(createState({
    bankerBase: 2,
    dealerSeat: 0,
    discardCount: 3,
    roundIndex: 4,
    seats: [
      createSeat(0, 100, {
        concealedTiles: createTiles([{ code: 'wan-9', label: '9万' }], 'seat-0-hand'),
        flowers: createFlowerTiles(3, 'seat-0-flower')
      }),
      createSeat(1, 100, {
        concealedTiles: createTiles([
          { code: 'wan-1', label: '1万' },
          { code: 'wan-2', label: '2万' }
        ], 'seat-1-hand'),
        flowers: createFlowerTiles(1, 'seat-1-flower')
      }),
      createSeat(2, 100, {
        concealedTiles: createTiles([{ code: 'tong-5', label: '5筒' }], 'seat-2-hand'),
        flowers: createFlowerTiles(1, 'seat-2-flower')
      }),
      createSeat(3, 100, {
        concealedTiles: createTiles([{ code: 'bamboo-7', label: '7条' }], 'seat-3-hand')
      })
    ]
  }), {
    type: 'discardWin',
    winnerSeat: 1,
    discarderSeat: 0,
    winningTile: createTile('wan-3', '3万', 'winning')
  })

  gameSession.getSnapshot = () => snapshot

  try {
    page.onShow()

    assert.equal(page.data.navigating, false)
    assert.equal(page.data.view.typeLabel, '点炮和')
    assert.equal(page.data.view.sourceSeatRoleLabel, '放炮')
    assert.equal(page.data.view.sourceSeatLabel, '你')
    assert.equal(page.data.view.replayButtonText, '下一局')
    assert.deepEqual(page.data.view.pairwiseTransferTexts, [
      '对家 向 你 支付 2 分番差',
      '左家 向 你 支付 3 分番差',
      '左家 向 对家 支付 1 分番差'
    ])
    assert.deepEqual(page.data.view.seatResults[1].concealedLabels, ['1万', '2万', '3万'])
    assert.equal(page.data.view.recentLogs.length, 3)
  } finally {
    gameSession.getSnapshot = originalGetSnapshot
  }
})

test('result page resets stale navigating state and shows a real match-ended self-draw snapshot', () => {
  const page = createPageInstance()
  const originalGetSnapshot = gameSession.getSnapshot
  const snapshot = createRealSnapshot(createState({
    bankerBase: 2,
    dealerSeat: 0,
    discardCount: 3,
    roundIndex: 8,
    seats: [
      createSeat(0, 100, {
        concealedTiles: createTiles([{ code: 'wan-1', label: '1万' }], 'self-0')
      }),
      createSeat(1, 4, {
        concealedTiles: createTiles([{ code: 'wan-2', label: '2万' }], 'self-1')
      }),
      createSeat(2, 100, {
        concealedTiles: createTiles([{ code: 'tong-2', label: '2筒' }], 'self-2')
      }),
      createSeat(3, 100, {
        concealedTiles: createTiles([{ code: 'wan-3', label: '3万' }], 'self-3')
      })
    ]
  }), {
    type: 'selfDraw',
    winnerSeat: 2,
    winningTile: createTile('tong-2', '2筒', 'self-draw')
  })

  gameSession.getSnapshot = () => snapshot

  try {
    page.data.navigating = true
    page.data.view = { stale: true }
    page._navigating = true

    page.onShow()

    assert.equal(page._navigating, false)
    assert.equal(page.data.navigating, false)
    assert.equal(page.data.view.typeLabel, '自摸')
    assert.equal(page.data.view.matchEnded, true)
    assert.equal(page.data.view.sourceSeatLabel, '')
    assert.equal(page.data.view.replayButtonText, '开始新牌局')
    assert.deepEqual(page.data.view.pairwiseTransferTexts, [])
    assert.deepEqual(page.data.view.seatResults[2].concealedLabels, ['2筒'])
  } finally {
    gameSession.getSnapshot = originalGetSnapshot
  }
})

test('result page releases the navigating lock when returning home fails', () => {
  const page = createPageInstance()
  const originalWx = global.wx

  global.wx = {
    redirectTo() {},
    reLaunch({ fail }) {
      fail()
    }
  }

  try {
    page.onBackHome()

    assert.equal(page.data.navigating, false)
    assert.equal(page._navigating, false)
  } finally {
    global.wx = originalWx
  }
})

test('result page ignores repeated replay taps while a navigation is already in flight', () => {
  const page = createPageInstance()
  const originalWx = global.wx

  let redirectCalls = 0
  let redirectedUrl = ''

  global.wx = {
    redirectTo({ url }) {
      redirectCalls += 1
      redirectedUrl = url
    },
    reLaunch() {}
  }

  try {
    page.onReplay()
    page.onReplay()

    assert.equal(redirectCalls, 1)
    assert.equal(redirectedUrl, '/pages/table/table?replay=1')
    assert.equal(page.data.navigating, true)
    assert.equal(page._navigating, true)
  } finally {
    global.wx = originalWx
  }
})

test('result page ignores repeated home taps while a navigation is already in flight', () => {
  const page = createPageInstance()
  const originalWx = global.wx

  let reLaunchCalls = 0
  let relaunchedUrl = ''

  global.wx = {
    redirectTo() {},
    reLaunch({ url }) {
      reLaunchCalls += 1
      relaunchedUrl = url
    }
  }

  try {
    page.onBackHome()
    page.onBackHome()

    assert.equal(reLaunchCalls, 1)
    assert.equal(relaunchedUrl, '/pages/home/home')
    assert.equal(page.data.navigating, true)
    assert.equal(page._navigating, true)
  } finally {
    global.wx = originalWx
  }
})

test('result page blocks mixed replay and home taps once either navigation starts', () => {
  const replayPage = createPageInstance()
  const homePage = createPageInstance()
  const originalWx = global.wx

  let redirectCalls = 0
  let reLaunchCalls = 0
  let redirectedUrl = ''
  let relaunchedUrl = ''

  global.wx = {
    redirectTo({ url }) {
      redirectCalls += 1
      redirectedUrl = url
    },
    reLaunch({ url }) {
      reLaunchCalls += 1
      relaunchedUrl = url
    }
  }

  try {
    replayPage.onReplay()
    replayPage.onBackHome()

    assert.equal(redirectCalls, 1)
    assert.equal(reLaunchCalls, 0)
    assert.equal(redirectedUrl, '/pages/table/table?replay=1')
    assert.equal(replayPage._navigating, true)

    homePage.onBackHome()
    homePage.onReplay()

    assert.equal(redirectCalls, 1)
    assert.equal(reLaunchCalls, 1)
    assert.equal(relaunchedUrl, '/pages/home/home')
    assert.equal(homePage._navigating, true)
  } finally {
    global.wx = originalWx
  }
})

test('result page template binds match-ended state, pairwise section, and replay button to view fields', () => {
  const template = readResultTemplate()

  assert.match(template, /<view wx:if="\{\{view\.matchEnded\}\}" class="match-end-tip">有玩家积分小于等于 0，本场已结束。<\/view>/)
  assert.match(template, /<view wx:if="\{\{view\.pairwiseTransferTexts\.length\}\}" class="detail-card card">/)
  assert.match(template, /<view wx:for="\{\{view\.pairwiseTransferTexts\}\}" wx:key="index" class="detail-line">\{\{item\}\}<\/view>/)
  assert.match(template, /<button class="primary-btn" bindtap="onReplay" disabled="\{\{navigating\}\}">\{\{view\.replayButtonText\}\}<\/button>/)
})

test('result page template binds summary tags and seat result fields from the result view model', () => {
  const template = readResultTemplate()

  assert.match(template, /<view class="result-type">\{\{view\.typeLabel\}\}<\/view>/)
  assert.match(template, /<view class="detail-text">\{\{view\.mainSettlementText\}\}<\/view>/)
  assert.match(template, /<text wx:if="\{\{view\.sourceSeatLabel\}\}" class="pill">\{\{view\.sourceSeatRoleLabel\}\} \{\{view\.sourceSeatLabel\}\}<\/text>/)
  assert.match(template, /<text wx:if="\{\{view\.winningTileLabel\}\}" class="pill">胡牌 \{\{view\.winningTileLabel\}\}<\/text>/)
  assert.match(template, /<view class="score-meta">番项 \{\{item\.fanItemsText\}\}<\/view>/)
  assert.match(template, /<view class="seat-line">手牌：\{\{item\.concealedLabels\.length \? item\.concealedLabels\.join\(' '\) : '无'\}\}<\/view>/)
})
