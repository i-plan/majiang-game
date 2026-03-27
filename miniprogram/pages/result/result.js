const gameSession = require('../../game/runtime/gameSession')
const { buildResultView } = require('../../game/selectors/resultView')

Page({
  data: {
    view: null,
    navigating: false
  },

  onShow() {
    this._navigating = false

    const snapshot = gameSession.getSnapshot()

    if (!snapshot || !snapshot.result) {
      wx.reLaunch({
        url: '/pages/home/home'
      })
      return
    }

    this.setData({
      view: buildResultView(snapshot),
      navigating: false
    })
  },

  onReplay() {
    if (this._navigating) {
      return
    }

    this._navigating = true
    this.setData({
      navigating: true
    })

    wx.redirectTo({
      url: '/pages/table/table?replay=1',
      fail: () => {
        this._navigating = false
        this.setData({
          navigating: false
        })
      }
    })
  },

  onBackHome() {
    if (this._navigating) {
      return
    }

    this._navigating = true
    this.setData({
      navigating: true
    })

    wx.reLaunch({
      url: '/pages/home/home',
      fail: () => {
        this._navigating = false
        this.setData({
          navigating: false
        })
      }
    })
  }
})
