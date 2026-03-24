Component({
  options: {
    addGlobalClass: true
  },

  properties: {
    actions: {
      type: Array,
      value: []
    }
  },

  methods: {
    handleTap(event) {
      const index = event.currentTarget.dataset.index
      this.triggerEvent('actiontap', {
        index
      })
    }
  }
})
