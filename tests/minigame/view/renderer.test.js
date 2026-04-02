const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '../../..')
const { createRenderer } = require(path.join(ROOT, 'minigame', 'src', 'render', 'renderer'))

function createResultView() {
  return {
    typeLabel: '流局',
    mainWinLabel: '',
    roundLabel: '第 1 局',
    goldTileLabel: '白板',
    goldDiceLabel: '1 + 2 = 3',
    summaryText: '本局无人和牌。',
    mainSettlementText: '分数保持不变。',
    pairwiseTransferTexts: [],
    seatResults: [
      {
        displayName: '你',
        isWinner: false,
        isDiscarder: false,
        isNextDealer: true,
        scoreFlowText: '100 → 100',
        deltaText: '+0',
        fanText: '0 番',
        fanItemsText: '无',
        concealedLabels: [],
        isPositiveDelta: false,
        isNegativeDelta: false
      }
    ],
    replayButtonText: '下一局'
  }
}

test('renderer can render the home scene without a canvas context and still expose touch targets', () => {
  const renderer = createRenderer({
    wxApi: {
      getSystemInfoSync() {
        return {
          windowWidth: 360,
          windowHeight: 720
        }
      }
    }
  })

  const targets = renderer.render({
    type: 'home',
    title: '伤心麻一麻',
    subtitle: '1 名玩家 + 3 个 AI 单机演示',
    bankerBaseOptions: [
      { value: 2, label: '庄底 2' },
      { value: 10, label: '庄底 10' }
    ],
    selectedBankerBase: 2,
    starting: false
  })

  assert.deepEqual(targets.map((target) => target.kind), ['bankerBase', 'bankerBase', 'startGame'])
  assert.equal(renderer.getSize().width, 360)
  assert.equal(renderer.getSize().height, 720)
})

test('renderer exposes result scene action targets and resize updates its viewport', () => {
  const renderer = createRenderer({})

  renderer.resize(414, 896)
  const targets = renderer.render({
    type: 'result',
    view: createResultView(),
    navigating: true
  })

  assert.deepEqual(targets.map((target) => ({ kind: target.kind, disabled: target.disabled })), [
    { kind: 'replay', disabled: true },
    { kind: 'home', disabled: true }
  ])
  assert.deepEqual(renderer.getSize(), {
    width: 414,
    height: 896
  })
})
