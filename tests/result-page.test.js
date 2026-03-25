const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const gameSession = require(path.join(ROOT, 'game', 'runtime', 'gameSession'))

const resultPagePath = path.join(ROOT, 'pages', 'result', 'result.js')

function loadResultPageDefinition() {
  const resolvedResultPagePath = require.resolve(resultPagePath)
  delete require.cache[resolvedResultPagePath]

  const originalPage = global.Page
  const originalWx = global.wx
  let capturedDefinition = null

  global.Page = (definition) => {
    capturedDefinition = definition
  }
  global.wx = {
    redirectTo() {},
    reLaunch() {}
  }

  require(resolvedResultPagePath)

  global.Page = originalPage
  global.wx = originalWx

  return capturedDefinition
}

function createPageInstance() {
  const definition = loadResultPageDefinition()
  const page = {
    data: JSON.parse(JSON.stringify(definition.data)),
    setData(patch) {
      this.data = Object.assign({}, this.data, patch)
    }
  }

  Object.keys(definition).forEach((key) => {
    if (typeof definition[key] === 'function') {
      page[key] = definition[key].bind(page)
    }
  })

  return page
}

test('result page sends replay requests through an explicit replay flag without advancing the session first', () => {
  const page = createPageInstance()
  const originalStartNextRound = gameSession.startNextRound
  const originalWx = global.wx

  let startNextRoundCalls = 0
  let redirectedUrl = ''

  gameSession.startNextRound = () => {
    startNextRoundCalls += 1
  }
  global.wx = {
    redirectTo({ url, fail }) {
      redirectedUrl = url
      fail()
    },
    reLaunch() {}
  }

  try {
    page.onReplay()

    assert.equal(redirectedUrl, '/pages/table/table?replay=1')
    assert.equal(startNextRoundCalls, 0)
    assert.equal(page.data.navigating, false)
    assert.equal(page._navigating, false)
  } finally {
    gameSession.startNextRound = originalStartNextRound
    global.wx = originalWx
  }
})

test('result page returns to home when shown without a settled snapshot', () => {
  const page = createPageInstance()
  const originalGetSnapshot = gameSession.getSnapshot
  const originalWx = global.wx

  let relaunchedUrl = ''

  gameSession.getSnapshot = () => null
  global.wx = {
    redirectTo() {},
    reLaunch({ url }) {
      relaunchedUrl = url
    }
  }

  try {
    page.onShow()

    assert.equal(relaunchedUrl, '/pages/home/home')
  } finally {
    gameSession.getSnapshot = originalGetSnapshot
    global.wx = originalWx
  }
})

test('result page releases the navigating lock when returning home fails', () => {
  const page = createPageInstance()
  const originalWx = global.wx

  global.wx = {
    redirectTo() {},
    reLaunch({ fail }) {
      fail()
    }
  }

  try {
    page.onBackHome()

    assert.equal(page.data.navigating, false)
    assert.equal(page._navigating, false)
  } finally {
    global.wx = originalWx
  }
})
