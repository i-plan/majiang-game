const { createRenderer } = require('./src/render/renderer')
const { createSceneManager } = require('./src/sceneManager')

let activeManager = null

function bindTouchEvents(wxApi, manager) {
  if (!wxApi || typeof wxApi.onTouchStart !== 'function') {
    return
  }

  wxApi.onTouchStart((event) => {
    manager.handleTouchEvent(event)
  })

  if (typeof wxApi.onShow === 'function') {
    wxApi.onShow(() => {
      manager.render()
    })
  }
}

function bootGame(options) {
  if (activeManager) {
    return activeManager
  }

  const settings = options || {}
  const wxApi = settings.wxApi || global.wx
  const canvas = settings.canvas || (wxApi && typeof wxApi.createCanvas === 'function' ? wxApi.createCanvas() : null)
  const renderer = settings.renderer || createRenderer({
    canvas,
    wxApi
  })

  activeManager = createSceneManager({
    gameSession: settings.gameSession,
    now: settings.now,
    renderer,
    scenes: settings.scenes,
    timerApi: settings.timerApi,
    wxApi
  })

  bindTouchEvents(wxApi, activeManager)
  activeManager.start('home')
  return activeManager
}

if (typeof wx !== 'undefined') {
  bootGame({ wxApi: wx })
}

module.exports = {
  bootGame,
  getManager() {
    return activeManager
  }
}
