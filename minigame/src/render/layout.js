const DEFAULT_VIEWPORT = {
  width: 667,
  height: 375
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function normalizeViewportSize(width, height) {
  const rawWidth = Math.round(width || DEFAULT_VIEWPORT.width)
  const rawHeight = Math.round(height || DEFAULT_VIEWPORT.height)
  const isLandscape = rawWidth >= rawHeight

  return {
    width: Math.max(isLandscape ? 568 : 320, rawWidth),
    height: Math.max(isLandscape ? 320 : 568, rawHeight),
    isLandscape
  }
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
  const viewport = normalizeViewportSize(width, height)
  const padding = viewport.isLandscape
    ? clamp(Math.round(viewport.width * 0.02), 10, 18)
    : Math.round(viewport.width * 0.04)
  const gap = viewport.isLandscape
    ? clamp(Math.round(padding * 0.72), 8, 12)
    : Math.max(10, Math.round(padding * 0.75))
  const sectionGap = viewport.isLandscape
    ? clamp(Math.round(gap * 0.9), 8, 10)
    : gap

  return {
    width: viewport.width,
    height: viewport.height,
    isLandscape: viewport.isLandscape,
    padding,
    gap,
    radius: 14,
    sectionGap,
    footerInset: padding,
    topInset: padding,
    contentInset: viewport.isLandscape ? clamp(Math.round(viewport.height * 0.03), 8, 10) : 12,
    actionHeight: viewport.isLandscape ? clamp(Math.round(viewport.height * 0.11), 34, 36) : 44,
    actionMinWidth: viewport.isLandscape ? 74 : 96,
    handHeight: viewport.isLandscape ? clamp(Math.round(viewport.height * 0.16), 50, 58) : 70
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
  getViewport,
  normalizeViewportSize
}
