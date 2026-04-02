const { clamp, createLayout, createRowSlots, createWrappedSlots, getViewport, normalizeViewportSize } = require('./layout')
const { THEME } = require('../theme/theme')

function getCanvasContext(canvas) {
  if (!canvas || typeof canvas.getContext !== 'function') {
    return null
  }

  try {
    return canvas.getContext('2d')
  } catch (error) {
    return null
  }
}

function setFillStyle(ctx, color) {
  if (ctx) {
    ctx.fillStyle = color
  }
}

function setStrokeStyle(ctx, color) {
  if (ctx) {
    ctx.strokeStyle = color
  }
}

function setFont(ctx, size, weight) {
  if (ctx) {
    ctx.font = `${weight || 'normal'} ${size}px ${THEME.fontFamily}`
  }
}

function clearFrame(ctx, width, height) {
  if (!ctx) {
    return
  }

  ctx.clearRect(0, 0, width, height)
}

function drawRoundedRect(ctx, rect, fillColor, strokeColor) {
  if (!ctx) {
    return
  }

  const radius = Math.min(rect.radius || 0, rect.width / 2, rect.height / 2)
  ctx.beginPath()
  ctx.moveTo(rect.left + radius, rect.top)
  ctx.lineTo(rect.left + rect.width - radius, rect.top)
  ctx.quadraticCurveTo(rect.left + rect.width, rect.top, rect.left + rect.width, rect.top + radius)
  ctx.lineTo(rect.left + rect.width, rect.top + rect.height - radius)
  ctx.quadraticCurveTo(rect.left + rect.width, rect.top + rect.height, rect.left + rect.width - radius, rect.top + rect.height)
  ctx.lineTo(rect.left + radius, rect.top + rect.height)
  ctx.quadraticCurveTo(rect.left, rect.top + rect.height, rect.left, rect.top + rect.height - radius)
  ctx.lineTo(rect.left, rect.top + radius)
  ctx.quadraticCurveTo(rect.left, rect.top, rect.left + radius, rect.top)
  ctx.closePath()

  if (fillColor) {
    setFillStyle(ctx, fillColor)
    ctx.fill()
  }

  if (strokeColor) {
    setStrokeStyle(ctx, strokeColor)
    ctx.lineWidth = 1
    ctx.stroke()
  }
}

function drawText(ctx, text, x, y, options) {
  if (!ctx || !text) {
    return
  }

  const settings = Object.assign({
    size: 14,
    weight: 'normal',
    color: THEME.colors.text,
    align: 'left',
    baseline: 'top'
  }, options)

  setFont(ctx, settings.size, settings.weight)
  setFillStyle(ctx, settings.color)
  ctx.textAlign = settings.align
  ctx.textBaseline = settings.baseline
  ctx.fillText(text, x, y)
}

function measureTextWidth(ctx, text, size) {
  if (!text) {
    return 0
  }

  if (ctx && typeof ctx.measureText === 'function') {
    setFont(ctx, size, 'normal')
    return ctx.measureText(text).width
  }

  return text.length * size * 0.58
}

function wrapText(ctx, text, maxWidth, size) {
  if (!text) {
    return []
  }

  const paragraphs = String(text).split('\n')
  const lines = []

  paragraphs.forEach((paragraph) => {
    let line = ''

    paragraph.split('').forEach((char) => {
      const nextLine = line + char
      if (line && measureTextWidth(ctx, nextLine, size) > maxWidth) {
        lines.push(line)
        line = char
      } else {
        line = nextLine
      }
    })

    if (line) {
      lines.push(line)
    }
  })

  return lines.length ? lines : ['']
}

function drawTextBlock(ctx, text, rect, options) {
  const settings = Object.assign({
    size: 14,
    lineHeight: 20,
    maxLines: 3,
    color: THEME.colors.text,
    weight: 'normal'
  }, options)
  const lines = wrapText(ctx, text, rect.width, settings.size).slice(0, settings.maxLines)

  lines.forEach((line, index) => {
    drawText(ctx, line, rect.left, rect.top + index * settings.lineHeight, {
      size: settings.size,
      weight: settings.weight,
      color: settings.color
    })
  })
}

function drawCard(ctx, rect, title, lines, options) {
  const settings = Object.assign({
    insetX: 12,
    titleTop: 10,
    titleSize: 12,
    titleColor: THEME.colors.textMuted,
    lineTop: 30,
    lineSize: 14,
    lineHeight: 18,
    lineColor: THEME.colors.text,
    maxLines: 4
  }, options)

  drawRoundedRect(ctx, Object.assign({ radius: rect.radius || 14 }, rect), THEME.colors.panel, THEME.colors.outline)
  if (title) {
    drawText(ctx, title, rect.left + settings.insetX, rect.top + settings.titleTop, {
      size: settings.titleSize,
      color: settings.titleColor,
      weight: 'bold'
    })
  }

  ;(lines || []).slice(0, settings.maxLines).forEach((line, index) => {
    drawText(ctx, line, rect.left + settings.insetX, rect.top + settings.lineTop + index * settings.lineHeight, {
      size: settings.lineSize,
      color: settings.lineColor
    })
  })
}

function drawButton(ctx, rect, label, options) {
  const settings = Object.assign({
    disabled: false,
    primary: false,
    active: false,
    labelSize: 15
  }, options)
  const fillColor = settings.disabled
    ? THEME.colors.disabled
    : settings.primary
      ? THEME.colors.accent
      : settings.active
        ? THEME.colors.panelAlt
        : THEME.colors.panelMuted
  const textColor = settings.primary && !settings.disabled ? THEME.colors.tileText : THEME.colors.text

  drawRoundedRect(ctx, Object.assign({ radius: rect.radius || 12 }, rect), fillColor, THEME.colors.outline)
  drawText(ctx, label, rect.left + rect.width / 2, rect.top + rect.height / 2, {
    size: settings.labelSize,
    weight: 'bold',
    color: textColor,
    align: 'center',
    baseline: 'middle'
  })
}

function drawTile(ctx, rect, tile) {
  const fillColor = tile.disabled
    ? THEME.colors.disabled
    : tile.selected
      ? THEME.colors.selected
      : THEME.colors.tile
  const textColor = tile.disabled ? THEME.colors.textMuted : THEME.colors.tileText
  const tileRect = Object.assign({ radius: 10 }, rect)
  const labelSize = tile.small ? 13 : rect.width < 34 ? 12 : 16

  drawRoundedRect(ctx, tileRect, fillColor, THEME.colors.tileBorder)
  drawText(ctx, tile.label, tileRect.left + tileRect.width / 2, tileRect.top + tileRect.height / 2, {
    size: labelSize,
    weight: 'bold',
    color: textColor,
    align: 'center',
    baseline: 'middle'
  })
}

function buildInfoLines(view) {
  return [
    `${view.roundLabel} · 庄家 ${view.dealerLabel}`,
    `庄底 ${view.bankerBaseLabel} · 当前 ${view.activeLabel}`,
    `金牌 ${view.goldTileLabel}${view.goldDiceLabel ? ` · ${view.goldDiceLabel}` : ''}`,
    `剩余 ${view.remainingCount} 张`
  ]
}

function buildSeatLines(seat) {
  return [
    `${seat.displayName}${seat.isDealer ? ' · 庄' : ''}${seat.isActive ? ' · 当前' : ''}`,
    `手牌 ${seat.concealedCount} 张 · ${seat.scoreText}`,
    seat.specialStateLabel ? `状态 ${seat.specialStateLabel}` : '状态 无',
    `花 ${seat.flowerLabels.length} · 副露 ${seat.meldTexts.length}`
  ]
}

function buildSeatResultLines(seat) {
  const tags = []
  if (seat.isWinner) {
    tags.push('胡牌')
  }
  if (seat.isDiscarder) {
    tags.push('放炮')
  }
  if (seat.isNextDealer) {
    tags.push('下局庄家')
  }

  return [
    `${seat.displayName}${tags.length ? ` · ${tags.join(' / ')}` : ''}`,
    `${seat.scoreFlowText} · ${seat.deltaText}`,
    `${seat.fanText} · ${seat.fanItemsText}`,
    `手牌 ${seat.concealedLabels.join(' ') || '无'}`
  ]
}

function drawChip(ctx, rect, label, options) {
  const settings = Object.assign({
    size: 13,
    active: false
  }, options)
  const fillColor = settings.active ? THEME.colors.accentMuted : THEME.colors.panelMuted
  const textColor = settings.active ? THEME.colors.accent : THEME.colors.text

  drawRoundedRect(ctx, Object.assign({ radius: rect.radius || 14 }, rect), fillColor, THEME.colors.outline)
  drawText(ctx, label, rect.left + rect.width / 2, rect.top + rect.height / 2, {
    size: settings.size,
    weight: 'bold',
    color: textColor,
    align: 'center',
    baseline: 'middle'
  })
}

function drawHomeFeatureChips(ctx, rect, tags, options) {
  if (!tags || !tags.length) {
    return rect.top
  }

  const settings = Object.assign({
    minWidth: 84,
    itemHeight: 28,
    gapX: 8,
    gapY: 8,
    size: 13
  }, options)
  const slots = createWrappedSlots({
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: 0
  }, tags.length, settings.minWidth, settings.itemHeight, settings.gapX, settings.gapY)

  tags.forEach((tag, index) => {
    drawChip(ctx, slots[index], tag, {
      size: settings.size
    })
  })

  const lastRect = slots[slots.length - 1]
  return lastRect.top + lastRect.height
}

function drawHomeInfoItems(ctx, rect, items, options) {
  const settings = Object.assign({
    size: 11,
    lineHeight: 14,
    gap: 7,
    maxLinesPerItem: 2,
    color: THEME.colors.textMuted
  }, options)
  let currentTop = rect.top

  for (let index = 0; index < (items || []).length; index += 1) {
    const item = items[index]
    const lines = wrapText(ctx, item, rect.width, settings.size).slice(0, settings.maxLinesPerItem)
    const blockHeight = lines.length * settings.lineHeight

    if (currentTop + blockHeight > rect.top + rect.height) {
      break
    }

    lines.forEach((line, lineIndex) => {
      drawText(ctx, line, rect.left, currentTop + lineIndex * settings.lineHeight, {
        size: settings.size,
        color: settings.color
      })
    })

    currentTop += blockHeight + settings.gap
  }
}

function renderHomeLandscape(ctx, layout, model, targets) {
  const headerHeight = 34
  const totalWidth = layout.width - layout.padding * 2
  const bodyTop = layout.topInset + headerHeight + 6
  const bodyHeight = layout.height - bodyTop - layout.footerInset
  const infoPanelWidth = clamp(Math.round(totalWidth * 0.4), 230, 290)
  const mainRect = {
    left: layout.padding,
    top: bodyTop,
    width: totalWidth - infoPanelWidth - layout.sectionGap,
    height: bodyHeight,
    radius: layout.radius
  }
  const infoRect = {
    left: mainRect.left + mainRect.width + layout.sectionGap,
    top: bodyTop,
    width: infoPanelWidth,
    height: bodyHeight,
    radius: layout.radius
  }
  const selectedOption = model.bankerBaseOptions.find((item) => item.value === model.selectedBankerBase)

  drawText(ctx, model.title, layout.width / 2, layout.topInset + 2, {
    size: 22,
    weight: 'bold',
    align: 'center'
  })

  drawRoundedRect(ctx, mainRect, THEME.colors.panel, THEME.colors.outline)
  drawText(ctx, model.title, mainRect.left + layout.contentInset, mainRect.top + 16, {
    size: 28,
    weight: 'bold'
  })
  drawText(ctx, model.subtitle, mainRect.left + layout.contentInset, mainRect.top + 54, {
    size: 14,
    color: THEME.colors.textMuted
  })
  const featureBottom = drawHomeFeatureChips(ctx, {
    left: mainRect.left + layout.contentInset,
    top: mainRect.top + 84,
    width: mainRect.width - layout.contentInset * 2,
    height: 0
  }, model.featureTags, {
    minWidth: 86,
    itemHeight: 28,
    size: 12
  })
  drawText(ctx, '选择庄底', mainRect.left + layout.contentInset, featureBottom + 18, {
    size: 18,
    weight: 'bold'
  })

  const optionRects = createWrappedSlots({
    left: mainRect.left + layout.contentInset,
    top: featureBottom + 52,
    width: mainRect.width - layout.contentInset * 2,
    height: 0
  }, model.bankerBaseOptions.length, 108, 40, 10, 10)

  model.bankerBaseOptions.forEach((item, index) => {
    const rect = optionRects[index]
    const active = item.value === model.selectedBankerBase
    drawButton(ctx, rect, item.label, {
      active,
      disabled: model.starting,
      labelSize: 14
    })
    targets.push(Object.assign({
      id: `banker-base:${item.value}`,
      kind: 'bankerBase',
      value: item.value,
      disabled: model.starting
    }, rect))
  })

  drawRoundedRect(ctx, infoRect, THEME.colors.panelAlt, THEME.colors.outline)
  drawText(ctx, model.infoTitle, infoRect.left + layout.contentInset, infoRect.top + 16, {
    size: 18,
    weight: 'bold'
  })
  drawHomeInfoItems(ctx, {
    left: infoRect.left + layout.contentInset,
    top: infoRect.top + 50,
    width: infoRect.width - layout.contentInset * 2,
    height: infoRect.height - 122
  }, model.infoItems)
  drawText(ctx, selectedOption ? `当前庄底：${selectedOption.label}` : '请选择庄底', infoRect.left + layout.contentInset, infoRect.top + infoRect.height - 78, {
    size: 12,
    color: THEME.colors.textMuted
  })

  const startRect = {
    left: infoRect.left + layout.contentInset,
    top: infoRect.top + infoRect.height - 56,
    width: infoRect.width - layout.contentInset * 2,
    height: 44,
    radius: 14
  }
  drawButton(ctx, startRect, model.starting ? '正在开始...' : '开始对局', {
    primary: true,
    disabled: model.starting
  })
  targets.push(Object.assign({
    id: 'start-game',
    kind: 'startGame',
    disabled: model.starting
  }, startRect))
}

function renderHome(ctx, layout, model, targets) {
  if (layout.isLandscape) {
    renderHomeLandscape(ctx, layout, model, targets)
    return
  }

  const mainRect = {
    left: layout.padding,
    top: layout.topInset + 18,
    width: layout.width - layout.padding * 2,
    height: 314,
    radius: layout.radius
  }
  const infoRect = {
    left: layout.padding,
    top: mainRect.top + mainRect.height + layout.sectionGap,
    width: layout.width - layout.padding * 2,
    height: 170,
    radius: layout.radius
  }

  drawRoundedRect(ctx, mainRect, THEME.colors.panel, THEME.colors.outline)
  drawText(ctx, model.title, mainRect.left + 16, mainRect.top + 18, {
    size: 30,
    weight: 'bold'
  })
  drawText(ctx, model.subtitle, mainRect.left + 16, mainRect.top + 72, {
    size: 14,
    color: THEME.colors.textMuted
  })
  const featureBottom = drawHomeFeatureChips(ctx, {
    left: mainRect.left + 16,
    top: mainRect.top + 112,
    width: mainRect.width - 32,
    height: 0
  }, model.featureTags, {
    minWidth: 92,
    itemHeight: 34,
    gapX: 10,
    gapY: 10,
    size: 14
  })
  drawText(ctx, '选择庄底', mainRect.left + 16, featureBottom + 18, {
    size: 18,
    weight: 'bold'
  })

  const optionRects = createWrappedSlots({
    left: mainRect.left + 16,
    top: featureBottom + 56,
    width: mainRect.width - 32,
    height: 0
  }, model.bankerBaseOptions.length, 120, 44, 12, 12)

  model.bankerBaseOptions.forEach((item, index) => {
    const rect = optionRects[index]
    const active = item.value === model.selectedBankerBase
    drawButton(ctx, rect, item.label, {
      active,
      disabled: model.starting
    })
    targets.push(Object.assign({
      id: `banker-base:${item.value}`,
      kind: 'bankerBase',
      value: item.value,
      disabled: model.starting
    }, rect))
  })

  const startRect = {
    left: mainRect.left + Math.round(mainRect.width * 0.22),
    top: mainRect.top + mainRect.height - 64,
    width: Math.round(mainRect.width * 0.56),
    height: 48,
    radius: 14
  }
  drawButton(ctx, startRect, model.starting ? '正在开始...' : '开始对局', {
    primary: true,
    disabled: model.starting
  })
  targets.push(Object.assign({
    id: 'start-game',
    kind: 'startGame',
    disabled: model.starting
  }, startRect))

  drawRoundedRect(ctx, infoRect, THEME.colors.panel, THEME.colors.outline)
  drawText(ctx, model.infoTitle, infoRect.left + 16, infoRect.top + 18, {
    size: 18,
    weight: 'bold'
  })
  drawHomeInfoItems(ctx, {
    left: infoRect.left + 16,
    top: infoRect.top + 56,
    width: infoRect.width - 32,
    height: infoRect.height - 68
  }, model.infoItems, {
    size: 12,
    lineHeight: 16,
    gap: 10,
    maxLinesPerItem: 2,
    color: THEME.colors.text
  })
}

function renderTableLandscape(ctx, layout, model, targets) {
  const view = model.view

  if (!view) {
    drawText(ctx, '正在准备牌局...', layout.width / 2, layout.height / 2, {
      size: 18,
      align: 'center',
      baseline: 'middle'
    })
    return
  }

  const totalWidth = layout.width - layout.padding * 2
  const compactCardOptions = {
    insetX: 9,
    titleTop: 7,
    titleSize: 10,
    lineTop: 20,
    lineSize: 10,
    lineHeight: 10,
    maxLines: 3
  }
  const topBandHeight = clamp(Math.round(layout.height * 0.2), 64, 74)
  const handHeight = layout.handHeight
  const handTop = layout.height - layout.footerInset - handHeight
  const lowerBandHeight = clamp(Math.round(layout.height * 0.23), 72, 78)
  const lowerBandTop = handTop - layout.sectionGap - lowerBandHeight
  const middleTop = layout.topInset + topBandHeight + layout.sectionGap
  const middleHeight = Math.max(72, lowerBandTop - layout.sectionGap - middleTop)
  const statusWidth = clamp(Math.round(totalWidth * 0.35), 210, 280)
  const topCard = {
    left: layout.padding,
    top: layout.topInset,
    width: totalWidth - statusWidth - layout.gap,
    height: topBandHeight,
    radius: layout.radius
  }
  const statusCard = {
    left: topCard.left + topCard.width + layout.gap,
    top: layout.topInset,
    width: statusWidth,
    height: topBandHeight,
    radius: layout.radius
  }

  drawCard(ctx, topCard, '牌桌信息', buildInfoLines(view), {
    insetX: layout.contentInset,
    titleTop: 6,
    titleSize: 10,
    lineTop: 22,
    lineSize: 10,
    lineHeight: 10,
    maxLines: 4
  })
  drawRoundedRect(ctx, statusCard, THEME.colors.panelAlt, THEME.colors.outline)
  drawText(ctx, '状态', statusCard.left + layout.contentInset, statusCard.top + 8, {
    size: 11,
    color: THEME.colors.textMuted,
    weight: 'bold'
  })
  drawTextBlock(ctx, view.statusText, {
    left: statusCard.left + layout.contentInset,
    top: statusCard.top + 24,
    width: statusCard.width - layout.contentInset * 2,
    height: statusCard.height - 30
  }, {
    size: 12,
    lineHeight: 14,
    maxLines: 3
  })

  const sideSeatWidth = clamp(Math.round(totalWidth * 0.21), 118, 138)
  const centerWidth = totalWidth - sideSeatWidth * 2 - layout.gap * 2
  const topSeatHeight = clamp(Math.round(middleHeight * 0.45), 44, 56)
  const logHeight = Math.max(22, middleHeight - topSeatHeight - layout.gap)
  const leftSeatRect = {
    left: layout.padding,
    top: middleTop,
    width: sideSeatWidth,
    height: middleHeight,
    radius: layout.radius
  }
  const topSeatRect = {
    left: leftSeatRect.left + leftSeatRect.width + layout.gap,
    top: middleTop,
    width: centerWidth,
    height: topSeatHeight,
    radius: layout.radius
  }
  const logRect = {
    left: topSeatRect.left,
    top: topSeatRect.top + topSeatRect.height + layout.gap,
    width: centerWidth,
    height: logHeight,
    radius: layout.radius
  }
  const rightSeatRect = {
    left: logRect.left + logRect.width + layout.gap,
    top: middleTop,
    width: sideSeatWidth,
    height: middleHeight,
    radius: layout.radius
  }

  drawCard(ctx, topSeatRect, '对家', buildSeatLines(view.topSeat).slice(0, 3), compactCardOptions)
  drawCard(ctx, leftSeatRect, '左家', buildSeatLines(view.leftSeat).slice(0, 3), compactCardOptions)
  drawCard(ctx, rightSeatRect, '右家', buildSeatLines(view.rightSeat).slice(0, 3), compactCardOptions)

  drawRoundedRect(ctx, logRect, THEME.colors.panel, THEME.colors.outline)
  drawText(ctx, '最近日志', logRect.left + 10, logRect.top + 8, {
    size: 11,
    color: THEME.colors.textMuted,
    weight: 'bold'
  })
  view.recentLogs.slice(0, logHeight >= 50 ? 3 : logHeight >= 34 ? 2 : 1).forEach((item, index) => {
    drawText(ctx, item.text, logRect.left + 10, logRect.top + 20 + index * 12, {
      size: 10,
      color: THEME.colors.text
    })
  })

  const actionCount = view.availableActions.length
  const actionWidth = actionCount ? clamp(Math.round(totalWidth * 0.42), 240, 300) : 0
  const bottomSeatRect = {
    left: layout.padding,
    top: lowerBandTop,
    width: actionCount ? totalWidth - actionWidth - layout.gap : totalWidth,
    height: lowerBandHeight,
    radius: layout.radius
  }

  drawRoundedRect(ctx, bottomSeatRect, THEME.colors.panel, THEME.colors.outline)
  drawText(ctx, `你 · ${view.humanScoreText}${view.humanSpecialStateLabel ? ` · ${view.humanSpecialStateLabel}` : ''}`, bottomSeatRect.left + 10, bottomSeatRect.top + 10, {
    size: 15,
    weight: 'bold'
  })
  drawTextBlock(ctx, `副露 ${view.humanMeldTexts.join(' / ') || '无'}\n花牌 ${view.humanFlowers.join(' ') || '无'}`, {
    left: bottomSeatRect.left + 10,
    top: bottomSeatRect.top + 32,
    width: bottomSeatRect.width - 20,
    height: bottomSeatRect.height - 38
  }, {
    size: 10,
    lineHeight: 12,
    maxLines: lowerBandHeight >= 76 ? 3 : 2,
    color: THEME.colors.textMuted
  })

  if (actionCount) {
    const actionRect = {
      left: bottomSeatRect.left + bottomSeatRect.width + layout.gap,
      top: lowerBandTop,
      width: actionWidth,
      height: lowerBandHeight,
      radius: layout.radius
    }
    const actionGapX = 8
    const actionGapY = 4
    const columns = Math.max(1, Math.floor((actionRect.width + actionGapX) / (layout.actionMinWidth + actionGapX)))
    const rows = Math.ceil(actionCount / columns)
    const actionAreaHeight = rows * layout.actionHeight + Math.max(0, rows - 1) * actionGapY
    const actionSlots = createWrappedSlots({
      left: actionRect.left,
      top: actionRect.top + Math.max(0, Math.floor((actionRect.height - actionAreaHeight) / 2)),
      width: actionRect.width,
      height: actionAreaHeight
    }, actionCount, layout.actionMinWidth, layout.actionHeight, actionGapX, actionGapY)

    view.availableActions.forEach((action, index) => {
      const rect = actionSlots[index]
      drawButton(ctx, rect, action.label, {
        disabled: model.acting,
        labelSize: 14
      })
      targets.push(Object.assign({
        id: `action:${index}`,
        kind: 'action',
        index,
        disabled: model.acting
      }, rect))
    })
  }

  const handSlots = createRowSlots({
    left: layout.padding,
    top: handTop,
    width: totalWidth,
    height: handHeight
  }, view.humanHand.length, 4)

  view.humanHand.forEach((tile, index) => {
    const sourceRect = handSlots[index]
    const rect = {
      left: sourceRect.left,
      top: tile.selected ? sourceRect.top - 8 : sourceRect.top,
      width: sourceRect.width,
      height: sourceRect.height,
      radius: 10
    }
    drawTile(ctx, rect, tile)
    targets.push(Object.assign({
      id: `tile:${tile.id}`,
      kind: 'tile',
      tileId: tile.id,
      disabled: model.acting || tile.disabled
    }, rect))
  })
}

function renderTable(ctx, layout, model, targets) {
  if (layout.isLandscape) {
    renderTableLandscape(ctx, layout, model, targets)
    return
  }

  const view = model.view

  if (!view) {
    drawText(ctx, '正在准备牌局...', layout.width / 2, layout.height / 2, {
      size: 18,
      align: 'center',
      baseline: 'middle'
    })
    return
  }

  const topCard = {
    left: layout.padding,
    top: layout.topInset,
    width: layout.width - layout.padding * 2,
    height: 92,
    radius: layout.radius
  }
  drawCard(ctx, topCard, '牌桌信息', buildInfoLines(view))

  const statusCard = {
    left: layout.padding,
    top: topCard.top + topCard.height + layout.sectionGap,
    width: layout.width - layout.padding * 2,
    height: 64,
    radius: layout.radius
  }
  drawRoundedRect(ctx, statusCard, THEME.colors.panelAlt, THEME.colors.outline)
  drawTextBlock(ctx, view.statusText, {
    left: statusCard.left + 12,
    top: statusCard.top + 14,
    width: statusCard.width - 24,
    height: statusCard.height - 20
  }, {
    size: 14,
    lineHeight: 18,
    maxLines: 2
  })

  const topSeatRect = {
    left: layout.padding + 60,
    top: statusCard.top + statusCard.height + layout.sectionGap,
    width: layout.width - (layout.padding + 60) * 2,
    height: 86,
    radius: layout.radius
  }
  const leftSeatRect = {
    left: layout.padding,
    top: topSeatRect.top + topSeatRect.height + layout.sectionGap,
    width: 112,
    height: 94,
    radius: layout.radius
  }
  const rightSeatRect = {
    left: layout.width - layout.padding - 112,
    top: leftSeatRect.top,
    width: 112,
    height: 94,
    radius: layout.radius
  }
  const logRect = {
    left: leftSeatRect.left + leftSeatRect.width + layout.gap,
    top: leftSeatRect.top,
    width: layout.width - (layout.padding * 2 + leftSeatRect.width * 2 + layout.gap * 2),
    height: 94,
    radius: layout.radius
  }
  const bottomSeatRect = {
    left: layout.padding,
    top: leftSeatRect.top + leftSeatRect.height + layout.sectionGap,
    width: layout.width - layout.padding * 2,
    height: 92,
    radius: layout.radius
  }

  drawCard(ctx, topSeatRect, '对家', buildSeatLines(view.topSeat))
  drawCard(ctx, leftSeatRect, '左家', buildSeatLines(view.leftSeat).slice(0, 3))
  drawCard(ctx, rightSeatRect, '右家', buildSeatLines(view.rightSeat).slice(0, 3))
  drawRoundedRect(ctx, logRect, THEME.colors.panel, THEME.colors.outline)
  drawText(ctx, '最近日志', logRect.left + 12, logRect.top + 10, {
    size: 12,
    color: THEME.colors.textMuted,
    weight: 'bold'
  })
  view.recentLogs.slice(0, 4).forEach((item, index) => {
    drawText(ctx, item.text, logRect.left + 12, logRect.top + 30 + index * 15, {
      size: 12,
      color: THEME.colors.text
    })
  })

  drawRoundedRect(ctx, bottomSeatRect, THEME.colors.panel, THEME.colors.outline)
  drawText(ctx, `你 · ${view.humanScoreText}${view.humanSpecialStateLabel ? ` · ${view.humanSpecialStateLabel}` : ''}`, bottomSeatRect.left + 12, bottomSeatRect.top + 10, {
    size: 16,
    weight: 'bold'
  })
  drawTextBlock(ctx, `副露 ${view.humanMeldTexts.join(' / ') || '无'}\n花牌 ${view.humanFlowers.join(' ') || '无'}`, {
    left: bottomSeatRect.left + 12,
    top: bottomSeatRect.top + 36,
    width: bottomSeatRect.width - 24,
    height: bottomSeatRect.height - 44
  }, {
    size: 13,
    lineHeight: 18,
    maxLines: 2,
    color: THEME.colors.textMuted
  })

  const actionTop = bottomSeatRect.top + bottomSeatRect.height + layout.sectionGap
  const actionCount = view.availableActions.length
  const actionAreaHeight = actionCount ? 48 + Math.floor((Math.max(0, actionCount - 1)) / 3) * 58 : 0
  const actionSlots = actionCount
    ? createWrappedSlots({
      left: layout.padding,
      top: actionTop,
      width: layout.width - layout.padding * 2,
      height: actionAreaHeight
    }, actionCount, 96, 44, 10, 10)
    : []

  view.availableActions.forEach((action, index) => {
    const rect = actionSlots[index]
    drawButton(ctx, rect, action.label, {
      disabled: model.acting
    })
    targets.push(Object.assign({
      id: `action:${index}`,
      kind: 'action',
      index,
      disabled: model.acting
    }, rect))
  })

  const handTop = clamp(actionTop + actionAreaHeight + (actionCount ? layout.sectionGap : 0), bottomSeatRect.top + bottomSeatRect.height + 8, layout.height - 108)
  const handHeight = 70
  const handSlots = createRowSlots({
    left: layout.padding,
    top: handTop,
    width: layout.width - layout.padding * 2,
    height: handHeight
  }, view.humanHand.length, 4)

  view.humanHand.forEach((tile, index) => {
    const sourceRect = handSlots[index]
    const rect = {
      left: sourceRect.left,
      top: tile.selected ? sourceRect.top - 10 : sourceRect.top,
      width: sourceRect.width,
      height: sourceRect.height,
      radius: 10
    }
    drawTile(ctx, rect, tile)
    targets.push(Object.assign({
      id: `tile:${tile.id}`,
      kind: 'tile',
      tileId: tile.id,
      disabled: model.acting || tile.disabled
    }, rect))
  })
}

function renderResultLandscape(ctx, layout, model, targets) {
  const view = model.view

  if (!view) {
    drawText(ctx, '正在整理结算...', layout.width / 2, layout.height / 2, {
      size: 18,
      align: 'center',
      baseline: 'middle'
    })
    return
  }

  const totalWidth = layout.width - layout.padding * 2
  const leftWidth = clamp(Math.round(totalWidth * 0.4), 230, 280)
  const rightWidth = totalWidth - leftWidth - layout.sectionGap
  const leftColumn = {
    left: layout.padding,
    top: layout.topInset,
    width: leftWidth,
    height: layout.height - layout.topInset - layout.footerInset
  }
  const rightColumn = {
    left: leftColumn.left + leftColumn.width + layout.sectionGap,
    top: leftColumn.top,
    width: rightWidth,
    height: leftColumn.height
  }
  const buttonHeight = 44
  const buttonTop = leftColumn.top + leftColumn.height - buttonHeight
  const summaryRect = {
    left: leftColumn.left,
    top: leftColumn.top,
    width: leftColumn.width,
    height: view.pairwiseTransferTexts.length ? 126 : 148,
    radius: layout.radius
  }

  drawRoundedRect(ctx, summaryRect, THEME.colors.panel, THEME.colors.outline)
  drawText(ctx, `${view.typeLabel}${view.mainWinLabel ? ` · ${view.mainWinLabel}` : ''}`, summaryRect.left + 10, summaryRect.top + 10, {
    size: 18,
    weight: 'bold'
  })
  drawTextBlock(ctx, `${view.roundLabel} · 金牌 ${view.goldTileLabel}${view.goldDiceLabel ? ` · ${view.goldDiceLabel}` : ''}\n${view.summaryText}\n${view.mainSettlementText}`, {
    left: summaryRect.left + 10,
    top: summaryRect.top + 38,
    width: summaryRect.width - 20,
    height: summaryRect.height - 46
  }, {
    size: 12,
    lineHeight: 16,
    maxLines: 4
  })

  let currentTop = summaryRect.top + summaryRect.height + layout.sectionGap
  const pairwiseAvailableHeight = buttonTop - layout.sectionGap - currentTop

  if (view.pairwiseTransferTexts.length && pairwiseAvailableHeight >= 44) {
    const pairwiseHeight = Math.min(pairwiseAvailableHeight, Math.max(42, 24 + view.pairwiseTransferTexts.length * 14))
    const pairwiseRect = {
      left: leftColumn.left,
      top: currentTop,
      width: leftColumn.width,
      height: pairwiseHeight,
      radius: layout.radius
    }
    const visibleCount = Math.max(1, Math.floor((pairwiseRect.height - 24) / 14))

    drawRoundedRect(ctx, pairwiseRect, THEME.colors.panelAlt, THEME.colors.outline)
    drawText(ctx, '番差结算', pairwiseRect.left + 10, pairwiseRect.top + 8, {
      size: 11,
      color: THEME.colors.textMuted,
      weight: 'bold'
    })
    view.pairwiseTransferTexts.slice(0, visibleCount).forEach((text, index) => {
      drawText(ctx, text, pairwiseRect.left + 10, pairwiseRect.top + 24 + index * 14, {
        size: 11
      })
    })
  }

  const replayRect = {
    left: leftColumn.left,
    top: buttonTop,
    width: Math.floor((leftColumn.width - layout.gap) / 2),
    height: buttonHeight,
    radius: 12
  }
  const homeRect = {
    left: replayRect.left + replayRect.width + layout.gap,
    top: buttonTop,
    width: replayRect.width,
    height: buttonHeight,
    radius: 12
  }

  drawButton(ctx, replayRect, view.replayButtonText, {
    primary: true,
    disabled: model.navigating,
    labelSize: 14
  })
  drawButton(ctx, homeRect, '返回首页', {
    disabled: model.navigating,
    labelSize: 14
  })

  targets.push(Object.assign({
    id: 'replay',
    kind: 'replay',
    disabled: model.navigating
  }, replayRect))
  targets.push(Object.assign({
    id: 'home',
    kind: 'home',
    disabled: model.navigating
  }, homeRect))

  const seatGap = 8
  const seatCount = view.seatResults.length
  const seatHeight = seatCount
    ? Math.max(58, Math.floor((rightColumn.height - seatGap * Math.max(0, seatCount - 1)) / seatCount))
    : 0

  view.seatResults.forEach((seat, index) => {
    const seatRect = {
      left: rightColumn.left,
      top: rightColumn.top + index * (seatHeight + seatGap),
      width: rightColumn.width,
      height: seatHeight,
      radius: layout.radius
    }

    drawRoundedRect(ctx, seatRect, THEME.colors.panel, THEME.colors.outline)
    drawTextBlock(ctx, buildSeatResultLines(seat).join('\n'), {
      left: seatRect.left + 10,
      top: seatRect.top + 8,
      width: seatRect.width - 20,
      height: seatRect.height - 16
    }, {
      size: 11,
      lineHeight: 13,
      maxLines: 4,
      color: seat.isPositiveDelta ? THEME.colors.accent : seat.isNegativeDelta ? '#ffd5d0' : THEME.colors.text
    })
  })
}

function renderResult(ctx, layout, model, targets) {
  if (layout.isLandscape) {
    renderResultLandscape(ctx, layout, model, targets)
    return
  }

  const view = model.view

  if (!view) {
    drawText(ctx, '正在整理结算...', layout.width / 2, layout.height / 2, {
      size: 18,
      align: 'center',
      baseline: 'middle'
    })
    return
  }

  const summaryRect = {
    left: layout.padding,
    top: layout.topInset,
    width: layout.width - layout.padding * 2,
    height: 136,
    radius: layout.radius
  }
  drawRoundedRect(ctx, summaryRect, THEME.colors.panel, THEME.colors.outline)
  drawText(ctx, `${view.typeLabel}${view.mainWinLabel ? ` · ${view.mainWinLabel}` : ''}`, summaryRect.left + 12, summaryRect.top + 12, {
    size: 20,
    weight: 'bold'
  })
  drawTextBlock(ctx, `${view.roundLabel} · 金牌 ${view.goldTileLabel}${view.goldDiceLabel ? ` · ${view.goldDiceLabel}` : ''}\n${view.summaryText}\n${view.mainSettlementText}`, {
    left: summaryRect.left + 12,
    top: summaryRect.top + 44,
    width: summaryRect.width - 24,
    height: summaryRect.height - 52
  }, {
    size: 13,
    lineHeight: 18,
    maxLines: 4
  })

  let currentTop = summaryRect.top + summaryRect.height + layout.sectionGap

  if (view.pairwiseTransferTexts.length) {
    const pairwiseRect = {
      left: layout.padding,
      top: currentTop,
      width: layout.width - layout.padding * 2,
      height: 28 + view.pairwiseTransferTexts.length * 16,
      radius: layout.radius
    }
    drawRoundedRect(ctx, pairwiseRect, THEME.colors.panelAlt, THEME.colors.outline)
    drawText(ctx, '番差结算', pairwiseRect.left + 12, pairwiseRect.top + 10, {
      size: 12,
      color: THEME.colors.textMuted,
      weight: 'bold'
    })
    view.pairwiseTransferTexts.forEach((text, index) => {
      drawText(ctx, text, pairwiseRect.left + 12, pairwiseRect.top + 28 + index * 16, {
        size: 12
      })
    })
    currentTop = pairwiseRect.top + pairwiseRect.height + layout.sectionGap
  }

  view.seatResults.forEach((seat, index) => {
    const seatRect = {
      left: layout.padding,
      top: currentTop + index * 80,
      width: layout.width - layout.padding * 2,
      height: 72,
      radius: layout.radius
    }
    drawRoundedRect(ctx, seatRect, THEME.colors.panel, THEME.colors.outline)
    drawTextBlock(ctx, buildSeatResultLines(seat).join('\n'), {
      left: seatRect.left + 12,
      top: seatRect.top + 10,
      width: seatRect.width - 24,
      height: seatRect.height - 20
    }, {
      size: 12,
      lineHeight: 15,
      maxLines: 4,
      color: seat.isPositiveDelta ? THEME.colors.accent : seat.isNegativeDelta ? '#ffd5d0' : THEME.colors.text
    })
  })

  const buttonTop = layout.height - layout.footerInset - 52
  const replayRect = {
    left: layout.padding,
    top: buttonTop,
    width: Math.floor((layout.width - layout.padding * 2 - layout.gap) / 2),
    height: 44,
    radius: 12
  }
  const homeRect = {
    left: replayRect.left + replayRect.width + layout.gap,
    top: buttonTop,
    width: replayRect.width,
    height: 44,
    radius: 12
  }

  drawButton(ctx, replayRect, view.replayButtonText, {
    primary: true,
    disabled: model.navigating
  })
  drawButton(ctx, homeRect, '返回首页', {
    disabled: model.navigating
  })

  targets.push(Object.assign({
    id: 'replay',
    kind: 'replay',
    disabled: model.navigating
  }, replayRect))
  targets.push(Object.assign({
    id: 'home',
    kind: 'home',
    disabled: model.navigating
  }, homeRect))
}

function createRenderer(options) {
  const settings = options || {}
  const wxApi = settings.wxApi || global.wx
  const canvas = settings.canvas || null
  const viewport = getViewport(wxApi)
  const normalizedViewport = normalizeViewportSize(viewport.width, viewport.height)
  const ctx = settings.context || getCanvasContext(canvas)
  let width = normalizedViewport.width
  let height = normalizedViewport.height

  if (canvas) {
    canvas.width = width
    canvas.height = height
  }

  function resize(nextWidth, nextHeight) {
    const nextViewport = normalizeViewportSize(nextWidth || width, nextHeight || height)
    width = nextViewport.width
    height = nextViewport.height

    if (canvas) {
      canvas.width = width
      canvas.height = height
    }
  }

  function render(viewModel) {
    const layout = createLayout(width, height)
    const targets = []

    clearFrame(ctx, layout.width, layout.height)
    drawRoundedRect(ctx, {
      left: 0,
      top: 0,
      width: layout.width,
      height: layout.height,
      radius: 0
    }, THEME.colors.background)

    if (!viewModel || !viewModel.type) {
      return targets
    }

    if (viewModel.type === 'home') {
      renderHome(ctx, layout, viewModel, targets)
    } else if (viewModel.type === 'table') {
      renderTable(ctx, layout, viewModel, targets)
    } else if (viewModel.type === 'result') {
      renderResult(ctx, layout, viewModel, targets)
    }

    return targets
  }

  return {
    getSize() {
      return {
        width,
        height
      }
    },
    render,
    resize
  }
}

module.exports = {
  createRenderer
}
