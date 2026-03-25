const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const simpleAi = require(path.join(ROOT, 'game', 'ai', 'simpleAi'))

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
