const gameSession = require('../../game/runtime/gameSession')
const { buildTableView } = require('../../game/selectors/tableView')

Page({
  data: {
    view: null,
    selectedTileId: ''
  },

  onShow() {
    this._destroyed = false
    this._navigating = false

    if (!this.unsubscribe) {
      this.unsubscribe = gameSession.subscribe(() => {
        this.refreshView()
      })
    }

    if (!gameSession.hasState()) {
      gameSession.startNewRound()
      return
    }

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

    if (this.unsubscribe) {
      this.unsubscribe()
      this.unsubscribe = null
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
    this.setData({
      view,
      selectedTileId
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

    if (!view || !view.canSelectHandTile) {
      return
    }

    const selectedTileId = this.data.selectedTileId === tileId ? '' : tileId
    const nextView = buildTableView(gameSession.getSnapshot(), { selectedTileId })

    this.setData({
      selectedTileId,
      view: nextView
    })
  },

  onDiscardTap() {
    if (!this.data.view || !this.data.view.canDiscard || this.data.view.discardDisabled) {
      return
    }

    const tileId = this.data.selectedTileId

    this.setData({
      selectedTileId: ''
    })

    gameSession.discardHumanTile(tileId)
  },

  onActionTap(event) {
    const index = Number(event.detail.index)
    const actions = this.data.view ? this.data.view.availableActions : []
    const action = actions[index]

    if (!action) {
      return
    }

    if (action.type === 'pass') {
      gameSession.passHumanReaction()
      return
    }

    if (this.data.view.promptType === 'reaction') {
      gameSession.takeHumanReaction(action)
      return
    }

    gameSession.takeHumanSelfAction(action)
  }
})
