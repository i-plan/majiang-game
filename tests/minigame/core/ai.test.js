const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '../../..')
const simpleAi = require(path.join(ROOT, 'minigame', 'game', 'ai', 'simpleAi'))

function withMockedRandom(value, run) {
  const originalRandom = Math.random
  Math.random = () => value

  try {
    run()
  } finally {
    Math.random = originalRandom
  }
}

test('chooseDiscardTile returns lastDrawTile when the seat is locked by youJin or tianTing', () => {
  const lockedTile = {
    id: 'locked-tile',
    code: 'wan-9'
  }
  const state = {
    turnStage: 'afterDraw',
    lastDrawTile: lockedTile,
    seats: [
      {
        concealedTiles: [
          { id: 'other-tile', code: 'wan-1' },
          lockedTile
        ],
        youJinLevel: 1,
        tianTingActive: false
      },
      {
        concealedTiles: [
          { id: 'other-tile-2', code: 'tong-1' },
          lockedTile
        ],
        youJinLevel: 0,
        tianTingActive: true
      }
    ]
  }

  assert.equal(simpleAi.chooseDiscardTile(state, 0), lockedTile.id)
  assert.equal(simpleAi.chooseDiscardTile(state, 1), lockedTile.id)
})

test('chooseTurnAction prioritizes youJin, then hu, then gang', () => {
  const gangAction = { type: 'gang', label: '杠' }
  const huAction = { type: 'hu', label: '胡' }
  const youJinAction = { type: 'youJin', label: '游金' }

  assert.equal(simpleAi.chooseTurnAction({}, 0, [gangAction, huAction, youJinAction]), youJinAction)
  assert.equal(simpleAi.chooseTurnAction({}, 0, [gangAction, huAction]), huAction)
  assert.equal(simpleAi.chooseTurnAction({}, 0, [gangAction]), gangAction)
  assert.equal(simpleAi.chooseTurnAction({}, 0, []), null)
})

test('chooseReactionAction prioritizes hu and gang ahead of scored chi and peng claims', () => {
  const state = {
    seats: [
      {
        concealedTiles: [
          { id: 'seat-0-1', code: 'wan-2' },
          { id: 'seat-0-2', code: 'wan-3' }
        ]
      }
    ]
  }
  const chiAction = { type: 'chi', label: '吃 2万 3万', consumeCodes: ['wan-2', 'wan-3'] }
  const pengAction = { type: 'peng', label: '碰 4万', code: 'wan-4' }
  const gangAction = { type: 'gang', label: '杠' }
  const huAction = { type: 'hu', label: '胡' }

  assert.equal(simpleAi.chooseReactionAction(state, 0, [chiAction, pengAction, gangAction, huAction]), huAction)
  assert.equal(simpleAi.chooseReactionAction(state, 0, [chiAction, pengAction, gangAction]), gangAction)
})

test('chooseDiscardTile uses the unlocked hand heuristic instead of forcing lastDrawTile', () => {
  withMockedRandom(0, () => {
    const state = {
      turnStage: 'afterDraw',
      lastDrawTile: { id: 'last-draw-tile', code: 'wan-3' },
      seats: [
        {
          concealedTiles: [
            { id: 'wan-1-tile', code: 'wan-1' },
            { id: 'wan-2-tile', code: 'wan-2' },
            { id: 'last-draw-tile', code: 'wan-3' },
            { id: 'east-tile', code: 'east' }
          ],
          youJinLevel: 0,
          tianTingActive: false
        }
      ]
    }

    assert.equal(simpleAi.chooseDiscardTile(state, 0), 'east-tile')
  })
})
