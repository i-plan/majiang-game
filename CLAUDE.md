# 项目续接记录

## 项目概况
- 项目名称：泉州麻将微信小程序
- 技术栈：原生微信小程序 + JavaScript + CommonJS
- 项目目录：直接使用根目录，不使用 `miniprogram/`
- 当前范围：单机演示，1 名玩家 + 3 个 AI，不接后端，不做联机

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
- 已建立固定测试入口与分组脚本（`test:core / test:view / test:page / test:smoke / test:ai`）
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

## 今天（2026-03-25）完成的事情
1. 修复开局发牌计数问题，保证补花后仍满足庄家 17 张、闲家 16 张。
2. 建立并整理固定测试入口：
   - 新增 `package.json`
   - 固化 `test / test:core / test:view / test:page / test:smoke / test:ai`
   - 使用 Node 内建 `node:test`，未引入额外依赖
3. 补核心高风险自动化测试：
   - `tests/action-evaluator.test.js`
   - `tests/settlement.test.js`
   - `tests/game-session.test.js`
   - `tests/rules.test.js`
   - `tests/smoke.test.js`
4. 补展示层和页面交互测试：
   - `tests/table-view.test.js`
   - `tests/table-view-status.test.js`
   - `tests/result-view.test.js`
   - `tests/home-page.test.js`
   - `tests/table-page.test.js`
   - `tests/result-page.test.js`
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

## 今天已经验证过的内容
- `npm run test:ai` 通过
- `npm run test:core` 通过
- `npm run test:view` 通过
- `npm run test:page` 通过
- `npm run test:smoke` 通过
- `npm test` 全量通过
- 当前共 38 条测试，全部通过

## 当前已知注意点
- 天听的原始规则定义还不够完整，当前实现是保守推断：
  - 庄家首弃成听后进入 `tianTingActive`
  - 后续按天听处理
  - 未胡时只能打摸到的牌
- 如果后续拿到更完整的规则原文，这一块可能需要调整
- 当前自动化已覆盖核心规则、selector、page 交互和 smoke，但微信开发者工具中的真实点击/跳转/渲染手测还需要补

## 明天继续时建议先做什么
1. 在微信开发者工具手工验证：
   - 首页开始对局防连点
   - 结果页“下一局 / 返回首页”跳转
   - 牌桌多种吃法按钮文案与顺序
   - 庄家 / 金牌 / 骰子 / 游金 / 天听展示同步
2. 如果手测发现问题，优先修正页面交互和展示偏差，并补对应测试
3. 如果手测稳定，继续校准规则边界：
   - 天听原始规则
   - 游金 / 双游 / 三游限制
   - 番差与结算细则
4. 继续保持通过固定脚本回归：
   - `npm run test:core`
   - `npm run test:view`
   - `npm run test:page`
   - `npm run test:smoke`
   - `npm test`

## 关键文件
- `game/core/stateMachine.js`
- `game/core/actionEvaluator.js`
- `game/core/winChecker.js`
- `game/core/settlement.js`
- `game/runtime/gameSession.js`
- `game/selectors/tableView.js`
- `game/selectors/resultView.js`
- `pages/table/table.js`
- `项目总规划.md`

## 工作约束
- 继续保持“页面只负责展示和交互，规则放在纯逻辑层”
- 不要提前接后端或联机
- 不要引入额外构建链
- 不要把规则逻辑散落到页面层
