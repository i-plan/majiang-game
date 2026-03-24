const gameSession = require('../../game/runtime/gameSession')

Page({
  startGame() {
    gameSession.startNewRound()
    wx.navigateTo({
      url: '/pages/table/table'
    })
  }
})
