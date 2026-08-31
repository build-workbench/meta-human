# AGENTS.md

MetaHuman Engine 贡献指南。

## 目标

保持仓库小巧、真实、可维护。优先删除过时的代码、工具和文档，而非增加新抽象。

## 技术栈

| 层   | 技术                                |
| ---- | ----------------------------------- |
| UI   | React 19 + TypeScript 5             |
| 构建 | Vite 6                              |
| 3D   | Three.js + React Three Fiber + Drei |
| 状态 | Zustand 5                           |
| 样式 | Tailwind CSS 4                      |
| 测试 | Vitest + Testing Library            |

## 架构

```text
src/
├── pages/       路由页面
├── components/  UI 和落地页组件
├── hooks/       UI 侧编排 hooks
├── services/    React 服务容器（ServicesProvider、useServices）
├── core/        运行时服务，不引入 React
├── store/       Zustand 状态
├── __tests__/   单元测试（Vitest）
└── lib/         工具函数
```

## 核心规则

1. 使用 `@/*` 路径别名。
2. `core/` 不得引入 React。
3. 服务通过 `useXStore.getState()` 读写 Zustand。
4. 每个外部集成都需要明确的降级路径。
5. 简化时优先删除和合并，而非新增封装。
6. 项目历史只记录在根目录 `CHANGELOG.md`。

## 关键运行时文件

| 文件                                           | 职责                                                                       |
| ---------------------------------------------- | -------------------------------------------------------------------------- |
| `src/core/avatar/DigitalHumanEngine.ts`        | 数字人控制门面                                                             |
| `src/core/dialogue/dialogueService.ts`         | 对话客户端入口：请求/流式/健康检查 + 路由（HTTP/SSE 传输在 transports.ts） |
| `src/core/dialogue/dialogueOrchestrator.ts`    | 轮次所有权与请求生命周期                                                   |
| `src/core/audio/audioService.ts`               | TTS / ASR 服务                                                             |
| `src/core/createServices.ts`                   | 服务容器工厂                                                               |
| `src/services/servicesContext.ts`              | React hooks：useEngine / useTTS / useASR / useDialogue                     |
| `src/store/digitalHumanStore.ts`               | 数字人运行时状态                                                           |
| `src/components/viewer/DigitalHumanViewer.tsx` | 主 3D 视口                                                                 |

## 命令

```bash
npm run dev
npm run typecheck
npm run lint
npm run test:run
npm run build
npm run build:pages
```

## 护栏

- 日常工作不创建新分支，保持在 `master`。
- 未经讨论不添加运行时依赖。
- 不重新引入 AI 工作流框架或生成的技能系统。
- 不文档化 Docker、Render、CLI 脚手架或模板，除非仓库实际包含它们。
- GitHub Pages 聚焦产品和文档，不做更新日志浏览。
