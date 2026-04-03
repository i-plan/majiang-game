# 项目续接记录

## 项目概况
- 项目名称：泉州麻将微信小游戏项目
- 技术栈：原生微信小游戏 + 原生微信小程序（保留）+ JavaScript + CommonJS
- 主版本目录：`minigame/`
- 保留目录：`miniprogram/`
- 当前范围：单机演示，1 名玩家 + 3 个 AI，不接后端，不做联机

## 当前固定基线
- `project.config.json` 保持 `compileType: "minigame"`
- 默认开发与运行都以 `minigame/` 为准
- `miniprogram/` 仅保留作历史参考与 page 行为对照
- 仓库当前不保留 `tests/` 目录，也不维护 `npm test` / `node --test` 脚本
- 验证方式以微信开发者工具手工验证关键流程为主

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
- 首页、牌桌页、结果页的关键跳转与防重复触发保护已接通
- 小游戏 scene/runtime 主线已接通

## 最近一次有效收口
- 继续以 `minigame/` 作为唯一主开发目录
- 抢杠胡、游金限制、结算展示和 scene no-op 锁定等边界已收紧
- 当前不再维护自动化测试资产，默认只做手工回归

## 当前已知注意点
- 天听的原始规则定义仍偏保守，后续若拿到更完整规则原文再调整
- `minigame/game/` 与 `miniprogram/game/` 仍保留两份逻辑副本，如需继续迭代规则需明确同步策略
- 默认只处理 `minigame/`，不主动扩展 `miniprogram/` 侧改动

## 明天继续时建议先做什么
1. 在微信开发者工具手工验证首页、牌桌、结果页完整闭环
2. 继续校准天听、游金、番差等低歧义规则边界
3. 收紧 scene/runtime 的状态切换和 no-op 分支
4. 优化牌桌与结果页的展示细节和交互提示
5. 整理规则说明与项目文档，保证当前基线口径一致

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
- `项目总规划.md`

## 工作约束
- 继续保持“页面只负责展示和交互，规则放在纯逻辑层”
- 不要提前接后端或联机
- 不要引入额外构建链
- 不要把规则逻辑散落到页面层
- 默认不新增测试用例，不恢复测试脚本，优先手工验证
