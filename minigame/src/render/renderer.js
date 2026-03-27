const { clamp, createLayout, createRowSlots, createWrappedSlots, getViewport } = require('./layout')
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

function drawCard(ctx, rect, title, lines) {
  drawRoundedRect(ctx, Object.assign({ radius: rect.radius || 14 }, rect), THEME.colors.panel, THEME.colors.outline)
  if (title) {
    drawText(ctx, title, rect.left + 12, rect.top + 10, {
      size: 12,
      color: THEME.colors.textMuted,
      weight: 'bold'
    })
  }

  (lines || []).forEach((line, index) => {
    drawText(ctx, line, rect.left + 12, rect.top + 30 + index * 18, {
      size: 14,
      color: THEME.colors.text
    })
  })
}

function drawButton(ctx, rect, label, options) {
  const settings = Object.assign({
    disabled: false,
    primary: false,
    active: false
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
    size: 15,
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

  drawRoundedRect(ctx, tileRect, fillColor, THEME.colors.tileBorder)
  drawText(ctx, tile.label, tileRect.left + tileRect.width / 2, tileRect.top + tileRect.height / 2, {
    size: tile.small ? 13 : 16,
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

function renderHome(ctx, layout, model, targets) {
  drawText(ctx, model.title, layout.width / 2, layout.topInset + 18, {
    size: 28,
    weight: 'bold',
    align: 'center'
  })
  drawText(ctx, model.subtitle, layout.width / 2, layout.topInset + 58, {
    size: 14,
    color: THEME.colors.textMuted,
    align: 'center'
  })

  const cardRect = {
    left: layout.padding,
    top: layout.height * 0.26,
    width: layout.width - layout.padding * 2,
    height: 210,
    radius: layout.radius
  }
  drawRoundedRect(ctx, cardRect, THEME.colors.panel, THEME.colors.outline)
  drawText(ctx, '选择庄底', cardRect.left + 16, cardRect.top + 18, {
    size: 18,
    weight: 'bold'
  })

  const optionRects = createWrappedSlots({
    left: cardRect.left + 16,
    top: cardRect.top + 58,
    width: cardRect.width - 32,
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
    left: layout.padding,
    top: layout.height - layout.footerInset - 58,
    width: layout.width - layout.padding * 2,
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
}

function renderTable(ctx, layout, model, targets) {
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

function renderResult(ctx, layout, model, targets) {
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
  const ctx = settings.context || getCanvasContext(canvas)
  let width = viewport.width
  let height = viewport.height

  if (canvas) {
    canvas.width = width
    canvas.height = height
  }

  function resize(nextWidth, nextHeight) {
    width = Math.max(320, Math.round(nextWidth || width))
    height = Math.max(568, Math.round(nextHeight || height))

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
