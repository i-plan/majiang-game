function createTouchRouter() {
  let targets = []

  return {
    setTargets(nextTargets) {
      targets = Array.isArray(nextTargets) ? nextTargets.slice() : []
    },

    clear() {
      targets = []
    },

    pick(point) {
      if (!point) {
        return null
      }

      for (let index = targets.length - 1; index >= 0; index -= 1) {
        const target = targets[index]

        if (target.disabled) {
          continue
        }

        const withinX = point.x >= target.left && point.x <= target.left + target.width
        const withinY = point.y >= target.top && point.y <= target.top + target.height

        if (withinX && withinY) {
          return target
        }
      }

      return null
    }
  }
}

module.exports = {
  createTouchRouter
}
