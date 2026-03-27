const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '../../..')
const { createTouchRouter } = require(path.join(ROOT, 'minigame', 'src', 'input', 'touchRouter'))

test('touch router picks the top-most enabled target and skips disabled overlaps', () => {
  const router = createTouchRouter()
  router.setTargets([
    {
      id: 'bottom',
      left: 0,
      top: 0,
      width: 40,
      height: 40
    },
    {
      id: 'disabled-top',
      left: 0,
      top: 0,
      width: 40,
      height: 40,
      disabled: true
    },
    {
      id: 'top',
      left: 4,
      top: 4,
      width: 30,
      height: 30
    }
  ])

  assert.equal(router.pick({ x: 10, y: 10 }).id, 'top')
  assert.equal(router.pick({ x: 2, y: 2 }).id, 'bottom')
})

test('touch router returns null for misses and after clear', () => {
  const router = createTouchRouter()
  router.setTargets([
    {
      id: 'only',
      left: 5,
      top: 5,
      width: 20,
      height: 20
    }
  ])

  assert.equal(router.pick(null), null)
  assert.equal(router.pick({ x: 100, y: 100 }), null)

  router.clear()

  assert.equal(router.pick({ x: 10, y: 10 }), null)
})
