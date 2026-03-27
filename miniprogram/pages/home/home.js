const rules = require('../../game/config/rules/mvp')
const gameSession = require('../../game/runtime/gameSession')

Page({
  data: {
    bankerBaseOptions: rules.match.bankerBaseOptions.map((value) => ({
      value,
      label: `庄底 ${value}`
    })),
    selectedBankerBase: rules.match.defaultBankerBase,
    starting: false
  },

  onShow() {
    this._starting = false

    if (this.data.starting) {
      this.setData({
        starting: false
      })
    }
  },

  selectBankerBase(event) {
    if (this._starting) {
      return
    }

    const bankerBase = Number(event.currentTarget.dataset.value)

    this.setData({
      selectedBankerBase: bankerBase
    })
  },

  startGame() {
    if (this._starting) {
      return
    }

    this._starting = true
    this.setData({
      starting: true
    })

    gameSession.startNewMatch({
      bankerBase: this.data.selectedBankerBase
    })

    wx.navigateTo({
      url: '/pages/table/table',
      fail: () => {
        this._starting = false
        this.setData({
          starting: false
        })
      }
    })
  }
})
