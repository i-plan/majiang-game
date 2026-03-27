const gameSession = require('../../game/runtime/gameSession')
const { buildTableView } = require('../../game/selectors/tableView')

const DOUBLE_TAP_INTERVAL = 350

Page({
  data: {
    view: null,
    selectedTileId: '',
    acting: false
  },

  onLoad(options) {
    this._replayRequested = Boolean(options && options.replay === '1')
  },

  onShow() {
    this._destroyed = false
    this._navigating = false
    this.resetPendingDiscardTap()

    if (!this.unsubscribe) {
      this.unsubscribe = gameSession.subscribe(() => {
        this.refreshView()
      })
    }

    const snapshot = gameSession.getSnapshot()

    if (!snapshot) {
      this._replayRequested = false
      gameSession.startNewRound()
      return
    }

    if (snapshot.result && this._replayRequested) {
      this._replayRequested = false
      gameSession.startNextRound()
      return
    }

    this._replayRequested = false
    this.refreshView()
  },

  onHide() {
    this.cleanup()
  },

  onUnload() {
    this.cleanup()
  },

  cleanup() {
    clearTimeout(this.aiTimer)
    this._destroyed = true
    this.resetPendingDiscardTap()

    if (this.unsubscribe) {
      this.unsubscribe()
      this.unsubscribe = null
    }
  },

  resetPendingDiscardTap() {
    this._lastTileTapId = ''
    this._lastTileTapAt = 0
  },

  discardSelectedTile(tileId) {
    if (this.data.acting || !this.data.view || !this.data.view.canDiscard || this.data.view.discardDisabled) {
      return
    }

    this.resetPendingDiscardTap()
    this.setData({
      selectedTileId: '',
      acting: true
    })

    const changed = gameSession.discardHumanTile(tileId)
    if (!changed) {
      this.refreshView()
    }
  },

  refreshView() {
    const snapshot = gameSession.getSnapshot()

    if (!snapshot) {
      return
    }

    let selectedTileId = this.data.selectedTileId
    const humanTiles = snapshot.seats && snapshot.seats[0] ? snapshot.seats[0].concealedTiles : []

    if (selectedTileId && !humanTiles.some((tile) => tile.id === selectedTileId)) {
      selectedTileId = ''
    }

    const view = buildTableView(snapshot, { selectedTileId })
    this.resetPendingDiscardTap()
    this.setData({
      view,
      selectedTileId: view.selectedTileId,
      acting: false
    })

    if (view.roundEnded && !this._navigating) {
      this._navigating = true
      clearTimeout(this.aiTimer)

      setTimeout(() => {
        if (!this._destroyed) {
          wx.redirectTo({
            url: '/pages/result/result'
          })
        }
      }, 650)
      return
    }

    this.scheduleAiIfNeeded(view)
  },

  scheduleAiIfNeeded(view) {
    clearTimeout(this.aiTimer)

    if (!view || !view.autoAdvance) {
      return
    }

    this.aiTimer = setTimeout(() => {
      if (!this._destroyed) {
        gameSession.advanceAi()
      }
    }, 500)
  },

  onTileTap(event) {
    const tileId = event.detail.tileId || event.currentTarget.dataset.tileId
    const view = this.data.view

    if (this.data.acting || !view || !view.canSelectHandTile) {
      return
    }

    if (view.lockedDiscardTileId && tileId !== view.lockedDiscardTileId) {
      return
    }

    const now = Date.now()
    const isDoubleTapDiscard = this.data.selectedTileId === tileId && this._lastTileTapId === tileId && now - this._lastTileTapAt <= DOUBLE_TAP_INTERVAL

    if (isDoubleTapDiscard && view.canDiscard && !view.discardDisabled) {
      this.discardSelectedTile(tileId)
      return
    }

    const selectedTileId = view.lockedDiscardTileId || tileId
    const nextView = buildTableView(gameSession.getSnapshot(), { selectedTileId })

    this._lastTileTapId = tileId
    this._lastTileTapAt = now
    this.setData({
      selectedTileId: nextView.selectedTileId,
      view: nextView
    })
  },

  onDiscardTap() {
    this.discardSelectedTile(this.data.selectedTileId)
  },

  onActionTap(event) {
    if (this.data.acting) {
      return
    }

    const index = Number(event.detail.index)
    const actions = this.data.view ? this.data.view.availableActions : []
    const action = actions[index]

    if (!action) {
      return
    }

    this.setData({
      selectedTileId: '',
      acting: true
    })

    let changed = false

    if (action.type === 'pass') {
      changed = gameSession.passHumanReaction()
    } else if (this.data.view.promptType === 'reaction') {
      changed = gameSession.takeHumanReaction(action)
    } else {
      changed = gameSession.takeHumanSelfAction(action)
    }

    if (!changed) {
      this.refreshView()
    }
  }
})
