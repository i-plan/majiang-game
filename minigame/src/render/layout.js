const DEFAULT_VIEWPORT = {
  width: 375,
  height: 667
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function getViewport(wxApi) {
  const api = wxApi || global.wx

  if (api && typeof api.getSystemInfoSync === 'function') {
    try {
      const info = api.getSystemInfoSync()
      return {
        width: Number(info.windowWidth) || DEFAULT_VIEWPORT.width,
        height: Number(info.windowHeight) || DEFAULT_VIEWPORT.height
      }
    } catch (error) {
      return Object.assign({}, DEFAULT_VIEWPORT)
    }
  }

  return Object.assign({}, DEFAULT_VIEWPORT)
}

function createLayout(width, height) {
  const safeWidth = Math.max(320, Math.round(width || DEFAULT_VIEWPORT.width))
  const safeHeight = Math.max(568, Math.round(height || DEFAULT_VIEWPORT.height))
  const padding = Math.round(safeWidth * 0.04)
  const gap = Math.max(10, Math.round(padding * 0.75))

  return {
    width: safeWidth,
    height: safeHeight,
    padding,
    gap,
    radius: 14,
    sectionGap: gap,
    footerInset: padding,
    topInset: padding
  }
}

function createRowSlots(rect, count, gap) {
  if (!count) {
    return []
  }

  const totalGap = Math.max(0, count - 1) * gap
  const slotWidth = Math.max(1, Math.floor((rect.width - totalGap) / count))
  const slots = []

  for (let index = 0; index < count; index += 1) {
    slots.push({
      left: rect.left + index * (slotWidth + gap),
      top: rect.top,
      width: slotWidth,
      height: rect.height
    })
  }

  return slots
}

function createWrappedSlots(rect, count, minWidth, itemHeight, gapX, gapY) {
  if (!count) {
    return []
  }

  const safeMinWidth = Math.max(1, minWidth)
  const columns = Math.max(1, Math.floor((rect.width + gapX) / (safeMinWidth + gapX)))
  const slotWidth = Math.max(safeMinWidth, Math.floor((rect.width - gapX * (columns - 1)) / columns))
  const slots = []

  for (let index = 0; index < count; index += 1) {
    const column = index % columns
    const row = Math.floor(index / columns)

    slots.push({
      left: rect.left + column * (slotWidth + gapX),
      top: rect.top + row * (itemHeight + gapY),
      width: slotWidth,
      height: itemHeight
    })
  }

  return slots
}

module.exports = {
  DEFAULT_VIEWPORT,
  clamp,
  createLayout,
  createRowSlots,
  createWrappedSlots,
  getViewport
}
