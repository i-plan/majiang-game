Component({
  options: {
    addGlobalClass: true
  },

  properties: {
    actions: {
      type: Array,
      value: []
    },
    disabled: {
      type: Boolean,
      value: false
    }
  },

  methods: {
    handleTap(event) {
      if (this.properties.disabled) {
        return
      }

      const index = event.currentTarget.dataset.index
      this.triggerEvent('actiontap', {
        index
      })
    }
  }
})
