const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '../../..')
const rules = require(path.join(ROOT, 'minigame', 'game', 'config', 'rules', 'mvp'))
const { startRound } = require(path.join(ROOT, 'minigame', 'game', 'core', 'stateMachine'))

const actionEvaluatorPath = path.join(ROOT, 'minigame', 'game', 'core', 'actionEvaluator')
const tableViewPath = path.join(ROOT, 'minigame', 'game', 'selectors', 'tableView')

function loadBuildTableViewWithSelfActions(selfActions) {
  const resolvedActionEvaluatorPath = require.resolve(actionEvaluatorPath)
  const resolvedTableViewPath = require.resolve(tableViewPath)

  delete require.cache[resolvedTableViewPath]
  delete require.cache[resolvedActionEvaluatorPath]

  const actionEvaluator = require(resolvedActionEvaluatorPath)
  const originalGetSelfActions = actionEvaluator.getSelfActions
  const originalGetCurrentReactionPrompt = actionEvaluator.getCurrentReactionPrompt

  actionEvaluator.getSelfActions = () => selfActions
  actionEvaluator.getCurrentReactionPrompt = () => null

  const { buildTableView } = require(resolvedTableViewPath)

  return {
    buildTableView,
    restore() {
      actionEvaluator.getSelfActions = originalGetSelfActions
      actionEvaluator.getCurrentReactionPrompt = originalGetCurrentReactionPrompt
      delete require.cache[resolvedTableViewPath]
      delete require.cache[resolvedActionEvaluatorPath]
    }
  }
}

test('buildTableView status text matches hu, gang, and youJin self-action combinations', () => {
  const snapshot = startRound(rules, {
    dealerSeat: 0,
    roundIndex: 1,
    bankerBase: 10
  })

  const huOnly = loadBuildTableViewWithSelfActions([{ type: 'hu', label: '胡' }])
  try {
    assert.equal(huOnly.buildTableView(snapshot, { selectedTileId: '' }).statusText, '你可以胡牌，也可以直接打牌')
  } finally {
    huOnly.restore()
  }

  const gangOnly = loadBuildTableViewWithSelfActions([{ type: 'gang', label: '暗杠' }])
  try {
    assert.equal(gangOnly.buildTableView(snapshot, { selectedTileId: '' }).statusText, '你可以杠牌，也可以直接打牌')
  } finally {
    gangOnly.restore()
  }

  const youJinOnly = loadBuildTableViewWithSelfActions([{ type: 'youJin', label: '游金 打 5万' }])
  try {
    assert.equal(youJinOnly.buildTableView(snapshot, { selectedTileId: '' }).statusText, '你可以游金，也可以直接打牌')
  } finally {
    youJinOnly.restore()
  }

  const huAndYouJin = loadBuildTableViewWithSelfActions([
    { type: 'hu', label: '胡' },
    { type: 'youJin', label: '游金 打 5万' }
  ])
  try {
    assert.equal(huAndYouJin.buildTableView(snapshot, { selectedTileId: '' }).statusText, '你可以胡牌、游金，也可以直接打牌')
  } finally {
    huAndYouJin.restore()
  }

  const huAndGang = loadBuildTableViewWithSelfActions([
    { type: 'hu', label: '胡' },
    { type: 'gang', label: '暗杠' }
  ])
  try {
    assert.equal(huAndGang.buildTableView(snapshot, { selectedTileId: '' }).statusText, '你可以胡牌、杠牌，也可以直接打牌')
  } finally {
    huAndGang.restore()
  }

  const huGangAndYouJin = loadBuildTableViewWithSelfActions([
    { type: 'hu', label: '胡' },
    { type: 'gang', label: '暗杠' },
    { type: 'youJin', label: '游金 打 5万' }
  ])
  try {
    assert.equal(huGangAndYouJin.buildTableView(snapshot, { selectedTileId: '' }).statusText, '你可以胡牌、杠牌、游金，也可以直接打牌')
  } finally {
    huGangAndYouJin.restore()
  }
})
