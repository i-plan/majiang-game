# 项目续接记录

## 项目概况
- 项目名称：泉州麻将微信小游戏项目
- 技术栈：原生微信小游戏 + 原生微信小程序（保留）+ JavaScript + CommonJS
- 项目目录：`minigame/` 为当前运行主版本，`miniprogram/` 为保留的小程序版本，`tests/` 与 `package.json` 保留在仓库根目录
- 当前范围：单机演示，1 名玩家 + 3 个 AI，不接后端，不做联机
- 当前主线：`project.config.json` 已指向 `minigame/`，小游戏 scene/runtime 已接通并通过回归，小程序代码仅保留作参考与 page 回归

## 2026-03-27 上午固定基线（后续 agent 必看）
- 今天早上的迁移收口结果已经确认，后续工作默认在这套基线上继续，不要回退到旧的小程序根目录架构。
- `project.config.json` 继续保持 `compileType: "minigame"`，默认运行目录是 `minigame/`。
- `miniprogram/` 仅作为保留版与 page 回归来源，不再作为默认主开发目录。
- 自动化测试继续保留在仓库根目录，固定分组为 `tests/minigame/...` 与 `tests/miniprogram/page/...`。
- 当前稳定回归基线：`npm test` 已通过（`tests/minigame/...` 102 条），`npm run test:miniprogram:page` 已通过（`tests/miniprogram/page/...` 46 条）。
- 如果继续做功能或修复，优先修改 `minigame/` 并同步补对应 `tests/minigame/...` 覆盖。

## 当前已完成的核心能力
- 首页、牌桌页、结果页已接通
- `gameSession + stateMachine + selectors` 主结构已建立
- 已支持：
  - 144 张牌
  - 花牌 / 补花
  - 开金 / 金牌百搭
  - 庄家 17 张、闲家 16 张
  - 剩余 16 张流局
  - 吃、碰、杠、胡、过
  - 抢杠胡
  - 三金倒
  - 天胡
  - 天听（当前为保守实现）
  - 游金 / 双游 / 三游
  - 主结算 + 三家番差结算
- 近期已修复首页字体对比度问题
- 已建立固定测试入口与分组脚本（`test / test:core / test:view / test:scene / test:smoke / test:ai / test:miniprogram:page`）
- 首页、牌桌页、结果页的关键跳转/操作已补防重复触发保护

## 2026-03-24 完成的事情
1. 把之前保留的两处规则缺口补完：
   - 游金 / 双游 / 三游 / 天听
   - 按轮次补花
2. 在 `game/core/stateMachine.js` 中接入：
   - `youJinLevel`
   - `tianTingActive`
   - `tianTingEligible`
   - `lastDrawSource`
3. 完成：
   - 游金进入与升级动作
   - 天听激活逻辑
   - 游金/天听状态下只能打摸到的牌
   - 按轮次补花逻辑
4. 调整 `game/ai/simpleAi.js`，让 AI 在可选时优先走 `youJin`
5. 调整展示层：
   - `game/selectors/tableView.js`
   - `pages/table/table.js`
   - `components/seat-summary/index.wxml`
   - `pages/table/table.wxml`
   让牌桌显示游金/双游/三游/天听状态，并锁定合法弃牌
6. 生成了项目总规划文档：`项目总规划.md`

## 2026-03-24 已验证的内容
- 语法检查通过
- 特殊规则专项测试通过
- 完整一局冒烟测试通过
- table view 展示测试通过

## 2026-03-25 完成的事情
1. 修复开局发牌计数问题，保证补花后仍满足庄家 17 张、闲家 16 张。
2. 建立并整理固定测试入口：
   - 新增 `package.json`
   - 固化 `test / test:core / test:view / test:smoke / test:ai / test:miniprogram:page`
   - 使用 Node 内建 `node:test`，未引入额外依赖
3. 补核心高风险自动化测试：
   - `tests/minigame/core/action-evaluator.test.js`
   - `tests/minigame/core/settlement.test.js`
   - `tests/minigame/core/game-session.test.js`
   - `tests/minigame/core/rules.test.js`
   - `tests/minigame/smoke/smoke.test.js`
4. 补展示层和页面交互测试：
   - `tests/minigame/view/table-view.test.js`
   - `tests/minigame/view/table-view-status.test.js`
   - `tests/minigame/view/result-view.test.js`
   - `tests/miniprogram/page/home-page.test.js`
   - `tests/miniprogram/page/table-page.test.js`
   - `tests/miniprogram/page/result-page.test.js`
5. 修复/收紧页面交互与展示问题：
   - 首页开始对局防连点
   - 牌桌动作防重复点击
   - 结果页“下一局 / 返回首页”防重复点击
   - replay 改为通过 `?replay=1` 明确触发，避免结果页跳转失败时 session 提前推进
   - 结果页区分 `放炮` / `被抢杠`，按真实分数变化高亮
   - 流局隐藏赢家型标签
   - 牌桌状态文案与真实动作集合保持一致（含 `youJin / gang / hu` 组合）
   - 多种吃法保持可区分标签
6. 其它同步完善：
   - 牌桌庄家标记、金牌/骰子、游金/天听特殊状态展示同步
   - AI 在游金/天听锁牌时只打 `lastDrawTile`
   - `gameSession.startNextRound()` 的续局与整场结束重开分支补测试覆盖

## 2026-03-25 已验证的内容
- `npm run test:ai` 通过
- `npm run test:core` 通过
- `npm run test:view` 通过
- `npm run test:miniprogram:page` 通过
- `npm run test:smoke` 通过
- `npm test` 全量通过
- 当时共 38 条测试，全部通过

## 2026-03-26 已完成的事情
1. 修复 `minigame/game/runtime/gameSession.js` 中 `advanceAi()` 对 AI 无效动作的误判，确保 `applySelfAction` / `applyReactionAction` / `passReaction` 返回 `false` 时按 no-op 处理，不再误通知订阅者或误推进循环。
2. 补充运行时与规则回归：
   - `tests/minigame/core/game-session.test.js` 新增 AI self action / reaction action 失败时的 no-op 契约测试
   - `tests/minigame/core/rules.test.js` 新增“多家同时可胡时，过牌后后续玩家仍可胡”的级联测试
3. 调整牌桌交互：
   - 保留版页面 `miniprogram/pages/table/table.js` 改为“双击同一张手牌出牌”
   - 移除 `miniprogram/pages/table/table.wxml` 中独立出牌按钮
   - `tests/miniprogram/page/table-page.test.js` 增补双击出牌与锁牌场景测试
4. 微信开发者工具手测已完成，首页/牌桌/结果页关键跳转与交互已人工验证。
5. 已明确后续迁移方向：
   - 下一阶段不是单纯改目录名，而是把当前小程序工程迁移为 `minigame/` 下的微信小游戏工程
   - 云开发仅创建模板骨架，不接入 `wx.cloud` 运行时代码
   - `tests/` 与 `package.json` 继续保留在仓库根目录
6. 已创建 `minigame/` 与 `cloudfunctions/helloWorld/` 的初始骨架文件，但迁移实现已暂缓，后续需按小游戏方案继续完成 scene 壳、逻辑迁移、测试替换和项目配置切换。

## 2026-03-26 已验证的内容
- `node --test tests/minigame/core/game-session.test.js` 通过
- `node --test tests/minigame/core/rules.test.js` 通过
- `node --test tests/miniprogram/page/table-page.test.js` 通过
- `npm test` 全量通过
- 当前共 111 条测试，全部通过
- 微信开发者工具手测完成

## 2026-03-27 已完成的事情
1. 完成小游戏主线迁移收口：
   - `project.config.json` 已切为 `compileType: "minigame"` 并指向 `minigame/`
   - 旧小程序运行时代码统一保留到 `miniprogram/`
   - 测试目录整理为 `tests/minigame/...` 与 `tests/miniprogram/page/...`
2. 为小游戏胶水层补直接测试覆盖：
   - `tests/minigame/scene/game-bootstrap.test.js`
   - `tests/minigame/scene/scene-manager.test.js`
   - `tests/minigame/view/layout.test.js`
   - `tests/minigame/view/renderer.test.js`
   - `tests/minigame/view/touch-router.test.js`
3. 更新 `CLAUDE.md`、`项目总规划.md` 和 `.claude/agents/test-case-writer.md`，统一当前工程目录、脚本分组和测试路径认知。

## 2026-03-27 已验证的内容
- `npm test` 通过（`tests/minigame/...` 当前共 102 条测试）
- `npm run test:miniprogram:page` 通过（`tests/miniprogram/page/...` 当前共 46 条测试）

## 2026-04-02 已完成的事情
1. 按“只动 `minigame/`、暂不处理 `miniprogram/`、天听先保留不优先做”的约束继续推进规则与展示回归补强。
2. 修复抢杠胡与游金边界一致性：
   - `minigame/game/core/actionEvaluator.js` 导出 `isReactionHuBlockedByYouJin`
   - `minigame/game/core/stateMachine.js` 在抢杠胡反应窗口中复用游金限制，阻止已处于游金或被其他座位双游压制的 seat 抢杠胡
3. 补核心规则、运行时与 helper 契约回归：
   - `tests/minigame/core/rules.test.js` 新增抢杠胡多家级联、开副露手牌配合 `extraTile`、开金跳过尾部花牌、`selfHu` 终局、`youJin/doubleYouJin/tripleYouJin` 型别来源、`threeGoldDown` 优先级、`findWinningCodes()` / `getTianTingDiscardCodes()` 排序与去重边界
   - `tests/minigame/core/action-evaluator.test.js` 新增当前响应 seat 只暴露最高优先级动作、同优先级动作并存的过滤契约
   - `tests/minigame/core/game-session.test.js` 新增 AI 缺失出牌选择 / 出牌失败时按 no-op 处理的契约
   - `tests/minigame/scene/table-scene.test.js` 新增人类出牌 / 自身动作 / 响应动作失败后的 scene 解锁 no-op 契约
4. 收紧 `settlement` 结算契约：
   - 保持 `discardWin` / `qiangGang` 主结算按三家均摊
   - `tests/minigame/core/settlement.test.js` 新增金牌与荣和张不进入暗刻/字牌暗刻来源、普通 `暗杠` 单点、`tianHu` 负向边界等回归
5. 收紧结果页 selector 契约：
   - `tests/minigame/view/result-view.test.js` 新增 `fanItemsText` 空值/多项拼接格式、`scoreFlowText` / `deltaText` 字符串格式、真实 `qiangGang` 结算快照展示
6. 当前这一批工作全部落在 `minigame/` 与 `tests/minigame/...`，没有继续改 `miniprogram/`。

## 2026-04-02 已验证的内容
- `node --test tests/minigame/core/settlement.test.js` 通过（当前 17 条）
- `node --test tests/minigame/view/result-view.test.js` 通过（当前 11 条）
- `npm run test:core` 通过（当前 70 条）
- `npm run test:view` 通过（当前 28 条）

## 当前已知注意点
- 天听的原始规则定义还不够完整，当前实现是保守推断：
  - 庄家首弃成听后进入 `tianTingActive`
  - 后续按天听处理
  - 未胡时只能打摸到的牌
- 如果后续拿到更完整的规则原文，这一块可能需要调整；但当前用户已明确“天听先保留不做”，后续默认不优先推进这部分。
- 仓库当前运行主版本已切为 `minigame/` 微信小游戏工程；`miniprogram/` 仅作为保留版本与 page 回归来源
- 当前续做默认只处理 `minigame/` 与 `tests/minigame/...`，不再主动扩展 `miniprogram/` 侧改动。
- `minigame/game/` 与 `miniprogram/game/` 当前保留两份逻辑副本，后续若继续迭代规则，需要明确同步策略，避免实现漂移

## 明天继续时建议先做什么
1. 如果继续开发功能，优先在 `minigame/` 上迭代，并同步补 `tests/minigame/core|scene|view|smoke` 对应覆盖。
2. `miniprogram/` 当前仅保留作历史参考与 page 回归来源，默认不要再作为本轮迭代目标。
3. 可以继续补高价值但低歧义的边界：
   - `settlement` 与番差细则的剩余单点分支
   - `resultView / tableView / scene` 的真实快照 selector 契约
   - `scene / runtime` 的 no-op 与状态切换回归
4. 如果准备收口，再继续保持通过固定脚本回归：
   - `npm run test:core`
   - `npm run test:view`
   - `npm run test:scene`
   - `npm run test:smoke`
   - `npm run test:miniprogram:page`
   - `npm test`

## 关键文件
- `minigame/game/core/stateMachine.js`
- `minigame/game/core/actionEvaluator.js`
- `minigame/game/core/winChecker.js`
- `minigame/game/core/settlement.js`
- `minigame/game/runtime/gameSession.js`
- `minigame/game/selectors/tableView.js`
- `minigame/game/selectors/resultView.js`
- `minigame/src/scenes/tableScene.js`
- `minigame/src/sceneManager.js`
- `miniprogram/pages/table/table.js`
- `项目总规划.md`

## 工作约束
- 继续保持“页面只负责展示和交互，规则放在纯逻辑层”
- 不要提前接后端或联机
- 不要引入额外构建链
- 不要把规则逻辑散落到页面层
