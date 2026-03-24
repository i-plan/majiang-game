Component({
  options: {
    addGlobalClass: true
  },

  properties: {
    tile: {
      type: Object,
      value: {}
    },
    disabled: {
      type: Boolean,
      value: false
    }
  },

  methods: {
    handleTap() {
      if (this.properties.disabled || !this.properties.tile || this.properties.tile.hidden) {
        return
      }

      this.triggerEvent('tiletap', {
        tileId: this.properties.tile.id
      })
    }
  }
})
