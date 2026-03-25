const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const rules = require(path.join(ROOT, 'game', 'config', 'rules', 'mvp'))
const session = require(path.join(ROOT, 'game', 'runtime', 'gameSession'))
const simpleAi = require(path.join(ROOT, 'game', 'ai', 'simpleAi'))
const { getSelfActions } = require(path.join(ROOT, 'game', 'core', 'actionEvaluator'))

function autoPlayUntilRoundEnds(options) {
  session.startNewMatch(options)

  for (let step = 0; step < 400; step += 1) {
    const snapshot = session.getSnapshot()

    if (snapshot.result) {
      return {
        snapshot,
        steps: step
      }
    }

    const reactionPrompt = session.getCurrentReactionPrompt(snapshot)

    if (reactionPrompt && reactionPrompt.seatId === session.HUMAN_SEAT) {
      const action = simpleAi.chooseReactionAction(snapshot, session.HUMAN_SEAT, reactionPrompt.actions)
      if (action) {
        session.takeHumanReaction(action)
      } else {
        session.passHumanReaction()
      }
      continue
    }

    if (!reactionPrompt && snapshot.activeSeat === session.HUMAN_SEAT) {
      const selfActions = getSelfActions(snapshot, session.HUMAN_SEAT)
      const selfAction = simpleAi.chooseTurnAction(snapshot, session.HUMAN_SEAT, selfActions)

      if (selfAction) {
        session.takeHumanSelfAction(selfAction)
        continue
      }

      const tileId = simpleAi.chooseDiscardTile(snapshot, session.HUMAN_SEAT)
      assert.notEqual(tileId, '', '人类座位在可出牌阶段必须能选出一张弃牌')
      session.discardHumanTile(tileId)
      continue
    }

    session.advanceAi()
  }

  assert.fail('smoke test exceeded 400 steps without finishing the round')
}

test('full round smoke test reaches settlement and next round reuses the correct state', () => {
  const bankerBase = 2
  const { snapshot, steps } = autoPlayUntilRoundEnds({ bankerBase })
  const result = snapshot.result

  assert.ok(steps > 0)
  assert.equal(snapshot.phase, 'ended')
  assert.ok(result)
  assert.ok(['selfDraw', 'discardWin', 'qiangGang', 'drawGame'].includes(result.type))
  assert.ok(typeof result.summaryText === 'string' && result.summaryText.length > 0)

  const nextRound = session.startNextRound()

  if (result.matchEnded) {
    assert.equal(nextRound.roundIndex, 1)
    assert.equal(nextRound.dealerSeat, rules.fixedDealerSeat || 0)
    assert.deepEqual(
      nextRound.seats.map((seat) => seat.score),
      new Array(rules.seatCount).fill(rules.match.initialScore)
    )
  } else {
    assert.equal(nextRound.roundIndex, snapshot.roundIndex + 1)
    assert.equal(nextRound.dealerSeat, result.nextDealerSeat)
    assert.deepEqual(nextRound.seats.map((seat) => seat.score), result.nextScores)
  }

  assert.equal(nextRound.bankerBase, bankerBase)
  assert.equal(nextRound.result, null)
})
