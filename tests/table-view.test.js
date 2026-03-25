const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const rules = require(path.join(ROOT, 'game', 'config', 'rules', 'mvp'))
const { startRound } = require(path.join(ROOT, 'game', 'core', 'stateMachine'))
const { buildTableView } = require(path.join(ROOT, 'game', 'selectors', 'tableView'))

function getDifferentTileId(seat, excludedTileId) {
  const tile = seat.concealedTiles.find((item) => item.id !== excludedTileId)
  assert.ok(tile, '测试局面至少要有一张非 lastDrawTile 的手牌')
  return tile.id
}

test('buildTableView keeps normal manual selection when the player is not in a locked state', () => {
  const snapshot = startRound(rules, {
    dealerSeat: 0,
    roundIndex: 1,
    bankerBase: 10
  })
  const requestedSelectedTileId = getDifferentTileId(snapshot.seats[0], snapshot.lastDrawTile.id)

  const view = buildTableView(snapshot, {
    selectedTileId: requestedSelectedTileId
  })

  assert.equal(view.lockedDiscardTileId, '')
  assert.equal(view.selectedTileId, requestedSelectedTileId)
  assert.equal(view.canSelectHandTile, true)
  assert.equal(view.discardDisabled, false)
  assert.match(view.discardButtonText, /^打出 /)
})

test('buildTableView locks the selected tile to lastDrawTile during youJin', () => {
  const snapshot = startRound(rules, {
    dealerSeat: 0,
    roundIndex: 1,
    bankerBase: 10
  })
  const requestedSelectedTileId = getDifferentTileId(snapshot.seats[0], snapshot.lastDrawTile.id)

  snapshot.seats[0].youJinLevel = 1

  const view = buildTableView(snapshot, {
    selectedTileId: requestedSelectedTileId
  })

  assert.equal(view.lockedDiscardTileId, snapshot.lastDrawTile.id)
  assert.equal(view.selectedTileId, snapshot.lastDrawTile.id)
  assert.equal(view.discardDisabled, false)
  assert.match(view.statusText, /只能打摸到的牌/)

  const lockedTile = view.humanHand.find((tile) => tile.id === snapshot.lastDrawTile.id)
  const otherTile = view.humanHand.find((tile) => tile.id !== snapshot.lastDrawTile.id)

  assert.ok(lockedTile)
  assert.equal(lockedTile.disabled, false)
  assert.ok(otherTile)
  assert.equal(otherTile.disabled, true)
})

test('buildTableView also locks the selected tile to lastDrawTile during tianTing', () => {
  const snapshot = startRound(rules, {
    dealerSeat: 0,
    roundIndex: 1,
    bankerBase: 10
  })
  const requestedSelectedTileId = getDifferentTileId(snapshot.seats[0], snapshot.lastDrawTile.id)

  snapshot.seats[0].tianTingActive = true
  snapshot.seats[0].tianTingEligible = false

  const view = buildTableView(snapshot, {
    selectedTileId: requestedSelectedTileId
  })

  assert.equal(view.lockedDiscardTileId, snapshot.lastDrawTile.id)
  assert.equal(view.selectedTileId, snapshot.lastDrawTile.id)
  assert.equal(view.humanSpecialStateLabel, '天听')
  assert.match(view.statusText, /天听/)
})

test('buildTableView clears stale selection and disables all hand tiles when the player cannot act', () => {
  const snapshot = startRound(rules, {
    dealerSeat: 0,
    roundIndex: 1,
    bankerBase: 10
  })
  const requestedSelectedTileId = getDifferentTileId(snapshot.seats[0], snapshot.lastDrawTile.id)

  snapshot.activeSeat = 1

  const view = buildTableView(snapshot, {
    selectedTileId: requestedSelectedTileId
  })

  assert.equal(view.canSelectHandTile, false)
  assert.equal(view.selectedTileId, '')
  assert.equal(view.canDiscard, false)
  assert.equal(view.discardDisabled, true)
  assert.equal(view.humanHand.every((tile) => tile.disabled), true)
})

test('buildTableView keeps dealer, gold, and seat special-state labels in sync', () => {
  const snapshot = startRound(rules, {
    dealerSeat: 0,
    roundIndex: 1,
    bankerBase: 10
  })

  snapshot.dealerSeat = 2
  snapshot.goldTileLabel = '白板'
  snapshot.goldDice = [3, 4]
  snapshot.goldDiceTotal = 7
  snapshot.seats[2].youJinLevel = 2
  snapshot.seats[1].tianTingActive = true

  const view = buildTableView(snapshot, {
    selectedTileId: ''
  })

  assert.equal(view.dealerLabel, '对家')
  assert.equal(view.goldTileLabel, '白板')
  assert.equal(view.goldDiceLabel, '3 + 4 = 7')
  assert.equal(view.topSeat.isDealer, true)
  assert.equal(view.topSeat.specialStateLabel, '双游')
  assert.equal(view.rightSeat.isDealer, false)
  assert.equal(view.rightSeat.specialStateLabel, '天听')
  assert.equal(view.bottomSeat.isDealer, false)
})

test('buildTableView keeps the newest 6 logs in original order', () => {
  const snapshot = startRound(rules, {
    dealerSeat: 0,
    roundIndex: 1,
    bankerBase: 10
  })

  snapshot.log = new Array(8).fill(null).map((_, index) => ({
    id: `log-${index + 1}`,
    text: `测试日志 ${index + 1}`
  }))

  const view = buildTableView(snapshot, {
    selectedTileId: ''
  })

  assert.equal(view.recentLogs.length, 6)
  assert.deepEqual(
    view.recentLogs.map((item) => item.id),
    ['log-1', 'log-2', 'log-3', 'log-4', 'log-5', 'log-6']
  )
})
