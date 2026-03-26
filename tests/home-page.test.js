const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const gameSession = require(path.join(ROOT, 'game', 'runtime', 'gameSession'))

const homePagePath = path.join(ROOT, 'pages', 'home', 'home.js')
const homePageWxmlPath = path.join(ROOT, 'pages', 'home', 'home.wxml')

function loadHomePageDefinition() {
  const resolvedHomePagePath = require.resolve(homePagePath)
  delete require.cache[resolvedHomePagePath]

  const originalPage = global.Page
  const originalWx = global.wx
  let capturedDefinition = null

  global.Page = (definition) => {
    capturedDefinition = definition
  }
  global.wx = {
    navigateTo() {}
  }

  require(resolvedHomePagePath)

  global.Page = originalPage
  global.wx = originalWx

  return capturedDefinition
}

function createPageInstance() {
  const definition = loadHomePageDefinition()
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

function readHomeTemplate() {
  return fs.readFileSync(homePageWxmlPath, 'utf8')
}

test('home page ignores repeated start taps while a navigation is already in flight', () => {
  const page = createPageInstance()
  const originalStartNewMatch = gameSession.startNewMatch
  const originalWx = global.wx

  const matchCalls = []
  let navigateCalls = 0

  gameSession.startNewMatch = (options) => {
    matchCalls.push(options)
  }
  global.wx = {
    navigateTo({ url }) {
      navigateCalls += 1
      page.lastNavigatedUrl = url
    }
  }

  try {
    page.setData({ selectedBankerBase: 2 })

    page.startGame()
    page.startGame()

    assert.deepEqual(matchCalls, [{ bankerBase: 2 }])
    assert.equal(navigateCalls, 1)
    assert.equal(page.lastNavigatedUrl, '/pages/table/table')
    assert.equal(page.data.starting, true)
    assert.equal(page._starting, true)
  } finally {
    gameSession.startNewMatch = originalStartNewMatch
    global.wx = originalWx
  }
})

test('home page releases the starting lock when navigation fails', () => {
  const page = createPageInstance()
  const originalStartNewMatch = gameSession.startNewMatch
  const originalWx = global.wx

  let startNewMatchCalls = 0

  gameSession.startNewMatch = () => {
    startNewMatchCalls += 1
  }
  global.wx = {
    navigateTo({ fail }) {
      fail()
    }
  }

  try {
    page.startGame()

    assert.equal(startNewMatchCalls, 1)
    assert.equal(page.data.starting, false)
    assert.equal(page._starting, false)

    page.startGame()

    assert.equal(startNewMatchCalls, 2)
  } finally {
    gameSession.startNewMatch = originalStartNewMatch
    global.wx = originalWx
  }
})

test('home page onShow clears a stale starting state after returning to the page', () => {
  const page = createPageInstance()

  page.data.starting = true
  page._starting = true

  page.onShow()

  assert.equal(page.data.starting, false)
  assert.equal(page._starting, false)
})

test('home page selectBankerBase updates the selected banker base and ignores taps while starting', () => {
  const page = createPageInstance()

  page.selectBankerBase({
    currentTarget: {
      dataset: {
        value: 20
      }
    }
  })

  assert.equal(page.data.selectedBankerBase, 20)

  page._starting = true
  page.selectBankerBase({
    currentTarget: {
      dataset: {
        value: 5
      }
    }
  })

  assert.equal(page.data.selectedBankerBase, 20)
})

test('home page starts a new match with the banker base chosen through the selection handler', () => {
  const page = createPageInstance()
  const originalStartNewMatch = gameSession.startNewMatch
  const originalWx = global.wx

  const matchCalls = []
  let navigatedUrl = ''

  gameSession.startNewMatch = (options) => {
    matchCalls.push(options)
  }
  global.wx = {
    navigateTo({ url }) {
      navigatedUrl = url
    }
  }

  try {
    page.selectBankerBase({
      currentTarget: {
        dataset: {
          value: 15
        }
      }
    })

    page.startGame()

    assert.deepEqual(matchCalls, [{ bankerBase: 15 }])
    assert.equal(navigatedUrl, '/pages/table/table')
    assert.equal(page.data.starting, true)
    assert.equal(page._starting, true)
  } finally {
    gameSession.startNewMatch = originalStartNewMatch
    global.wx = originalWx
  }
})

test('home page template binds banker-base options and start button state', () => {
  const template = readHomeTemplate()

  assert.match(template, /wx:for="\{\{bankerBaseOptions\}\}"/)
  assert.match(template, /class="option-chip \{\{item\.value === selectedBankerBase \? 'option-chip-active' : ''\}\}"/)
  assert.match(template, /data-value="\{\{item\.value\}\}"/)
  assert.match(template, /bindtap="selectBankerBase"/)
  assert.match(template, /bindtap="startGame" disabled="\{\{starting\}\}">开始对局<\/button>/)
})
