const gameSession = require('../../game/runtime/gameSession')
const { buildResultView } = require('../../game/selectors/resultView')

Page({
  data: {
    view: null
  },

  onShow() {
    const snapshot = gameSession.getSnapshot()

    if (!snapshot || !snapshot.result) {
      wx.reLaunch({
        url: '/pages/home/home'
      })
      return
    }

    this.setData({
      view: buildResultView(snapshot)
    })
  },

  onReplay() {
    gameSession.startNewRound()
    wx.redirectTo({
      url: '/pages/table/table'
    })
  },

  onBackHome() {
    wx.reLaunch({
      url: '/pages/home/home'
    })
  }
})
