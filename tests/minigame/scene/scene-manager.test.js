const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '../../..')
const { createSceneManager } = require(path.join(ROOT, 'minigame', 'src', 'sceneManager'))

function createFixture() {
  const calls = {
    homeEnter: [],
    homeExit: 0,
    homeHandle: [],
    render: [],
    tableEnter: []
  }

  const renderer = {
    render(viewModel) {
      calls.render.push(viewModel)
      if (viewModel.type === 'home') {
        return [{
          id: 'start',
          kind: 'startGame',
          left: 0,
          top: 0,
          width: 30,
          height: 30
        }]
      }

      return [{
        id: 'table-action',
        kind: 'action',
        index: 0,
        left: 10,
        top: 10,
        width: 30,
        height: 30
      }]
    }
  }

  const scenes = {
    home() {
      return {
        enter(options) {
          calls.homeEnter.push(options)
        },
        exit() {
          calls.homeExit += 1
        },
        handleTarget(target, point) {
          calls.homeHandle.push({ target, point })
          return true
        },
        getViewModel() {
          return { type: 'home' }
        }
      }
    },
    table() {
      return {
        enter(options) {
          calls.tableEnter.push(options)
        },
        exit() {},
        handleTarget() {
          return true
        },
        getViewModel() {
          return { type: 'table' }
        }
      }
    }
  }

  return {
    calls,
    manager: createSceneManager({
      renderer,
      scenes
    })
  }
}

test('scene manager starts a scene, renders it, and routes taps through touch targets', () => {
  const { calls, manager } = createFixture()

  assert.equal(manager.start('home', { from: 'boot' }), true)
  assert.equal(manager.getCurrentSceneName(), 'home')
  assert.deepEqual(calls.homeEnter, [{ from: 'boot' }])
  assert.deepEqual(manager.getCurrentTargets().map((target) => target.id), ['start'])

  assert.equal(manager.handleTap({ x: 12, y: 12 }), true)
  assert.deepEqual(calls.homeHandle, [{
    target: {
      id: 'start',
      kind: 'startGame',
      left: 0,
      top: 0,
      width: 30,
      height: 30
    },
    point: { x: 12, y: 12 }
  }])
  assert.ok(calls.render.length >= 2)
})

test('scene manager normalizes touch events and exits the previous scene when navigating', () => {
  const { calls, manager } = createFixture()

  manager.start('home')
  assert.equal(manager.handleTouchEvent({
    changedTouches: [{ clientX: 18, clientY: 24 }]
  }), true)
  assert.deepEqual(calls.homeHandle[0].point, { x: 18, y: 24 })

  assert.equal(manager.goTo('table', { replay: true }), true)
  assert.equal(calls.homeExit, 1)
  assert.deepEqual(calls.tableEnter, [{ replay: true }])
  assert.equal(manager.getCurrentSceneName(), 'table')
})

test('scene manager rejects unknown scenes and clears state on destroy', () => {
  const { manager } = createFixture()

  assert.equal(manager.goTo('missing'), false)

  manager.start('home')
  manager.destroy()

  assert.equal(manager.getCurrentSceneName(), '')
  assert.equal(manager.getCurrentScene(), null)
  assert.deepEqual(manager.getCurrentTargets(), [])
  assert.equal(manager.handleTouchEvent({ touches: [{ x: 5, y: 5 }] }), false)
})
