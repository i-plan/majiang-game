const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '../../..')
const rules = require(path.join(ROOT, 'minigame', 'game', 'config', 'rules', 'mvp'))
const { createHomeScene } = require(path.join(ROOT, 'minigame', 'src', 'scenes', 'homeScene'))

function createFixture(options) {
  const settings = options || {}
  const calls = {
    goTo: [],
    renderCount: 0,
    startNewMatch: []
  }

  const manager = {
    requestRender() {
      calls.renderCount += 1
      return true
    },
    goTo(name, sceneOptions) {
      calls.goTo.push({ name, sceneOptions })
      if (typeof settings.goTo === 'function') {
        return settings.goTo(name, sceneOptions)
      }
      return true
    }
  }

  const gameSession = {
    startNewMatch(sceneOptions) {
      calls.startNewMatch.push(sceneOptions)
      if (typeof settings.startNewMatch === 'function') {
        return settings.startNewMatch(sceneOptions)
      }
      return true
    }
  }

  return {
    calls,
    scene: createHomeScene({
      manager,
      gameSession
    })
  }
}

test('home scene enter clears stale starting state', () => {
  const { scene } = createFixture()

  scene.startGame()
  assert.equal(scene.getState().starting, true)

  scene.enter()

  assert.equal(scene.getState().starting, false)
})

test('home scene selectBankerBase updates the selected banker base and ignores changes while starting', () => {
  const { scene } = createFixture()

  scene.selectBankerBase(20)
  assert.equal(scene.getState().selectedBankerBase, 20)

  scene.startGame()
  scene.selectBankerBase(5)

  assert.equal(scene.getState().selectedBankerBase, 20)
})

test('home scene starts a new match with the selected banker base and navigates to table', () => {
  const { calls, scene } = createFixture()

  scene.handleTarget({
    kind: 'bankerBase',
    value: 15
  })
  scene.handleTarget({
    kind: 'startGame'
  })

  assert.deepEqual(calls.startNewMatch, [{ bankerBase: 15 }])
  assert.deepEqual(calls.goTo, [{ name: 'table', sceneOptions: undefined }])
  assert.equal(scene.getState().starting, true)
})

test('home scene ignores repeated start requests while navigation is already in flight', () => {
  const { calls, scene } = createFixture()

  scene.startGame()
  scene.startGame()

  assert.deepEqual(calls.startNewMatch, [{ bankerBase: rules.match.defaultBankerBase }])
  assert.deepEqual(calls.goTo, [{ name: 'table', sceneOptions: undefined }])
  assert.equal(scene.getState().starting, true)
})

test('home scene releases the starting lock when navigation fails', () => {
  let goToCalls = 0
  const { calls, scene } = createFixture({
    goTo() {
      goToCalls += 1
      return false
    }
  })

  scene.startGame()

  assert.equal(goToCalls, 1)
  assert.deepEqual(calls.startNewMatch, [{ bankerBase: rules.match.defaultBankerBase }])
  assert.equal(scene.getState().starting, false)

  scene.startGame()

  assert.equal(goToCalls, 2)
  assert.deepEqual(calls.startNewMatch, [
    { bankerBase: rules.match.defaultBankerBase },
    { bankerBase: rules.match.defaultBankerBase }
  ])
})

test('home scene exposes a home view model for renderer consumption', () => {
  const { scene } = createFixture()
  const viewModel = scene.getViewModel()

  assert.equal(viewModel.type, 'home')
  assert.equal(viewModel.title, '泉州麻将')
  assert.equal(viewModel.subtitle, '1 名玩家 + 3 个 AI 单机演示')
  assert.equal(viewModel.selectedBankerBase, rules.match.defaultBankerBase)
  assert.deepEqual(viewModel.bankerBaseOptions.map((item) => item.value), rules.match.bankerBaseOptions)
})
