const defaultGameSession = require('../game/runtime/gameSession')
const { createTouchRouter } = require('./input/touchRouter')
const { createRenderer } = require('./render/renderer')
const { createHomeScene } = require('./scenes/homeScene')
const { createResultScene } = require('./scenes/resultScene')
const { createTableScene } = require('./scenes/tableScene')

function normalizeTouch(event) {
  const touch = event && event.changedTouches && event.changedTouches[0]
    ? event.changedTouches[0]
    : event && event.touches && event.touches[0]
      ? event.touches[0]
      : event

  if (!touch) {
    return null
  }

  return {
    x: Number(touch.clientX || touch.pageX || touch.x || 0),
    y: Number(touch.clientY || touch.pageY || touch.y || 0)
  }
}

function createSceneManager(options) {
  const settings = options || {}
  const gameSession = settings.gameSession || defaultGameSession
  const timerApi = settings.timerApi || {
    setTimeout,
    clearTimeout
  }
  const now = settings.now || (() => Date.now())
  const wxApi = settings.wxApi || global.wx
  const renderer = settings.renderer || createRenderer({ wxApi })
  const touchRouter = createTouchRouter()
  const sceneFactories = Object.assign({
    home: createHomeScene,
    table: createTableScene,
    result: createResultScene
  }, settings.scenes)

  let currentSceneName = ''
  let currentScene = null
  let currentTargets = []

  function requestRender() {
    return render()
  }

  function createScene(name) {
    const factory = sceneFactories[name]

    if (!factory) {
      return null
    }

    return factory({
      manager: managerApi,
      gameSession,
      now,
      timerApi,
      wxApi
    })
  }

  function goTo(name, sceneOptions) {
    const nextScene = createScene(name)

    if (!nextScene) {
      return false
    }

    if (currentScene && typeof currentScene.exit === 'function') {
      currentScene.exit()
    }

    currentSceneName = name
    currentScene = nextScene

    if (typeof currentScene.enter === 'function') {
      currentScene.enter(sceneOptions || {})
    }

    render()
    return true
  }

  function render() {
    if (!currentScene) {
      currentTargets = []
      touchRouter.clear()
      return currentTargets
    }

    const viewModel = typeof currentScene.getViewModel === 'function'
      ? currentScene.getViewModel()
      : { type: 'empty' }

    currentTargets = renderer.render(viewModel) || []
    touchRouter.setTargets(currentTargets)
    return currentTargets
  }

  function handleTap(point) {
    const target = touchRouter.pick(point)

    if (!target || !currentScene || typeof currentScene.handleTarget !== 'function') {
      return false
    }

    currentScene.handleTarget(target, point)
    render()
    return true
  }

  function handleTouchEvent(event) {
    const point = normalizeTouch(event)

    if (!point) {
      return false
    }

    return handleTap(point)
  }

  function destroy() {
    if (currentScene && typeof currentScene.exit === 'function') {
      currentScene.exit()
    }

    currentSceneName = ''
    currentScene = null
    currentTargets = []
    touchRouter.clear()
  }

  const managerApi = {
    destroy,
    getCurrentScene() {
      return currentScene
    },
    getCurrentSceneName() {
      return currentSceneName
    },
    getCurrentTargets() {
      return currentTargets.slice()
    },
    goTo,
    handleTap,
    handleTouchEvent,
    render,
    requestRender,
    start(initialSceneName, sceneOptions) {
      return goTo(initialSceneName || 'home', sceneOptions)
    }
  }

  return managerApi
}

module.exports = {
  createSceneManager
}
