const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '../../..')
const {
  DEFAULT_VIEWPORT,
  clamp,
  createLayout,
  createRowSlots,
  createWrappedSlots,
  getViewport
} = require(path.join(ROOT, 'minigame', 'src', 'render', 'layout'))

test('layout helpers clamp values and enforce the minimum viewport size', () => {
  assert.equal(clamp(5, 10, 20), 10)
  assert.equal(clamp(15, 10, 20), 15)
  assert.equal(clamp(25, 10, 20), 20)

  const layout = createLayout(280, 400)
  assert.equal(layout.width, 320)
  assert.equal(layout.height, 568)
  assert.ok(layout.padding > 0)
  assert.ok(layout.gap >= 10)
})

test('getViewport uses wx system info and falls back to defaults on missing or failing apis', () => {
  const viewport = getViewport({
    getSystemInfoSync() {
      return {
        windowWidth: 414,
        windowHeight: 896
      }
    }
  })

  assert.deepEqual(viewport, {
    width: 414,
    height: 896
  })

  assert.deepEqual(getViewport(null), DEFAULT_VIEWPORT)
  assert.deepEqual(getViewport({
    getSystemInfoSync() {
      throw new Error('boom')
    }
  }), DEFAULT_VIEWPORT)
})

test('createRowSlots distributes equally sized horizontal slots', () => {
  const slots = createRowSlots({
    left: 10,
    top: 20,
    width: 140,
    height: 30
  }, 3, 5)

  assert.equal(slots.length, 3)
  assert.deepEqual(slots[0], {
    left: 10,
    top: 20,
    width: 43,
    height: 30
  })
  assert.deepEqual(slots[2], {
    left: 106,
    top: 20,
    width: 43,
    height: 30
  })
})

test('createWrappedSlots wraps items across rows when the row width is exceeded', () => {
  const slots = createWrappedSlots({
    left: 8,
    top: 16,
    width: 220,
    height: 0
  }, 5, 96, 40, 10, 12)

  assert.equal(slots.length, 5)
  assert.deepEqual(slots[0], {
    left: 8,
    top: 16,
    width: 105,
    height: 40
  })
  assert.deepEqual(slots[1], {
    left: 123,
    top: 16,
    width: 105,
    height: 40
  })
  assert.deepEqual(slots[2], {
    left: 8,
    top: 68,
    width: 105,
    height: 40
  })
})
