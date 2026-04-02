const { createRenderer } = require('./src/render/renderer')
const { createSceneManager } = require('./src/sceneManager')

let activeManager = null

function getViewportFromResizeEvent(wxApi, event) {
  const resizeInfo = event && event.size ? event.size : event || {}
  const width = Number(resizeInfo.windowWidth || resizeInfo.width || 0)
  const height = Number(resizeInfo.windowHeight || resizeInfo.height || 0)

  if (width && height) {
    return {
      width,
      height
    }
  }

  if (wxApi && typeof wxApi.getSystemInfoSync === 'function') {
    try {
      const info = wxApi.getSystemInfoSync()
      return {
        width: Number(info.windowWidth) || 0,
        height: Number(info.windowHeight) || 0
      }
    } catch (error) {
      return null
    }
  }

  return null
}

function bindTouchEvents(wxApi, manager, renderer) {
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

  if (renderer && typeof renderer.resize === 'function' && typeof wxApi.onWindowResize === 'function') {
    wxApi.onWindowResize((event) => {
      const viewport = getViewportFromResizeEvent(wxApi, event)

      if (!viewport) {
        return
      }

      renderer.resize(viewport.width, viewport.height)
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

  bindTouchEvents(wxApi, activeManager, renderer)
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
