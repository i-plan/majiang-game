const { buildTileDeck } = require('../config/tileCatalog')

function shuffleTiles(tiles) {
  const shuffled = tiles.slice()

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    const temp = shuffled[index]
    shuffled[index] = shuffled[swapIndex]
    shuffled[swapIndex] = temp
  }

  return shuffled
}

function createWall(rules) {
  const tiles = shuffleTiles(buildTileDeck({ includeFlowers: rules.includeFlowers }))

  return {
    tiles,
    liveIndex: 0,
    supplementIndex: tiles.length - 1
  }
}

function drawLiveTile(wall) {
  if (!wall || wall.liveIndex > wall.supplementIndex) {
    return null
  }

  const tile = wall.tiles[wall.liveIndex]
  wall.liveIndex += 1
  return tile
}

function drawSupplementTile(wall) {
  if (!wall || wall.liveIndex > wall.supplementIndex) {
    return null
  }

  const tile = wall.tiles[wall.supplementIndex]
  wall.supplementIndex -= 1
  return tile
}

function getRemainingCount(wall) {
  if (!wall || wall.liveIndex > wall.supplementIndex) {
    return 0
  }

  return wall.supplementIndex - wall.liveIndex + 1
}

function hasTilesRemaining(wall) {
  return getRemainingCount(wall) > 0
}

module.exports = {
  createWall,
  drawLiveTile,
  drawSupplementTile,
  getRemainingCount,
  hasTilesRemaining,
  shuffleTiles
}
