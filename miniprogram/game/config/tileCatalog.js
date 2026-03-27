const TILE_META = {}
const TILE_ORDER = {}
const FLOWER_CODES = new Set()
const ORDERED_DEFINITIONS = []

function registerTile(meta) {
  const definition = Object.assign({
    copies: 4,
    category: 'suit',
    suit: '',
    rank: 0
  }, meta)

  ORDERED_DEFINITIONS.push(definition)
  TILE_META[definition.code] = definition
  TILE_ORDER[definition.code] = ORDERED_DEFINITIONS.length - 1

  if (definition.category === 'flower') {
    FLOWER_CODES.add(definition.code)
  }
}

for (let rank = 1; rank <= 9; rank += 1) {
  registerTile({ code: `wan-${rank}`, label: `${rank}万`, suit: 'wan', rank })
}

for (let rank = 1; rank <= 9; rank += 1) {
  registerTile({ code: `tong-${rank}`, label: `${rank}筒`, suit: 'tong', rank })
}

for (let rank = 1; rank <= 9; rank += 1) {
  registerTile({ code: `bamboo-${rank}`, label: `${rank}条`, suit: 'bamboo', rank })
}

[
  { code: 'east', label: '东', category: 'honor' },
  { code: 'south', label: '南', category: 'honor' },
  { code: 'west', label: '西', category: 'honor' },
  { code: 'north', label: '北', category: 'honor' },
  { code: 'red', label: '中', category: 'honor' },
  { code: 'green', label: '发', category: 'honor' },
  { code: 'white', label: '白', category: 'honor' }
].forEach(registerTile)

;[
  { code: 'plum', label: '梅' },
  { code: 'orchid', label: '兰' },
  { code: 'flower-bamboo', label: '竹' },
  { code: 'chrysanthemum', label: '菊' },
  { code: 'spring', label: '春' },
  { code: 'summer', label: '夏' },
  { code: 'autumn', label: '秋' },
  { code: 'winter', label: '冬' }
].forEach((item) => {
  registerTile(Object.assign({ category: 'flower', copies: 1 }, item))
})

function normalizeCode(tileOrCode) {
  if (!tileOrCode) {
    return ''
  }

  return typeof tileOrCode === 'string' ? tileOrCode : tileOrCode.code
}

function getTileMeta(tileOrCode) {
  return TILE_META[normalizeCode(tileOrCode)] || null
}

function getTileLabel(tileOrCode) {
  const meta = getTileMeta(tileOrCode)
  return meta ? meta.label : ''
}

function isFlowerTile(tileOrCode) {
  const meta = getTileMeta(tileOrCode)
  return Boolean(meta && meta.category === 'flower')
}

function isHonorTile(tileOrCode) {
  const meta = getTileMeta(tileOrCode)
  return Boolean(meta && meta.category === 'honor')
}

function isSuitTile(tileOrCode) {
  const meta = getTileMeta(tileOrCode)
  return Boolean(meta && meta.category === 'suit')
}

function isTerminalTile(tileOrCode) {
  const meta = getTileMeta(tileOrCode)
  return Boolean(meta && meta.category === 'suit' && (meta.rank === 1 || meta.rank === 9))
}

function getTileSortKey(tileOrCode) {
  const code = normalizeCode(tileOrCode)
  const order = TILE_ORDER[code]
  return typeof order === 'number' ? order : Number.MAX_SAFE_INTEGER
}

function compareTiles(a, b) {
  return getTileSortKey(a) - getTileSortKey(b)
}

function sortTiles(tiles) {
  return tiles.slice().sort(compareTiles)
}

function buildTileDeck(options) {
  const includeFlowers = !options || options.includeFlowers !== false
  const deck = []
  let counter = 0

  ORDERED_DEFINITIONS.forEach((definition) => {
    if (!includeFlowers && definition.category === 'flower') {
      return
    }

    for (let index = 0; index < definition.copies; index += 1) {
      counter += 1
      deck.push({
        id: `${definition.code}-${counter}`,
        code: definition.code,
        label: definition.label,
        suit: definition.suit,
        rank: definition.rank,
        category: definition.category,
        flower: definition.category === 'flower'
      })
    }
  })

  return deck
}

module.exports = {
  FLOWER_CODES: Array.from(FLOWER_CODES),
  TILE_CODES: ORDERED_DEFINITIONS.map((item) => item.code),
  buildTileDeck,
  compareTiles,
  getTileLabel,
  getTileMeta,
  getTileSortKey,
  isFlowerTile,
  isHonorTile,
  isSuitTile,
  isTerminalTile,
  sortTiles
}
