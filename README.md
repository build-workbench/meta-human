# MetaHuman 数字人引擎

浏览器原生 3D 数字人引擎，集成语音、对话能力。**零配置** · **离线可用** · **MIT 开源**

[![CI](https://img.shields.io/github/actions/workflow/status/LessUp/meta-human/ci.yml?branch=master&label=CI&style=flat-square)](https://github.com/LessUp/meta-human/actions)
[![Demo](https://img.shields.io/badge/Demo-在线-green?style=flat-square&logo=githubpages)](https://lessup.github.io/meta-human/)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

**[在线体验 →](https://lessup.github.io/meta-human/)**

<p align="center">
  <img src="public/preview.svg" width="720" alt="MetaHuman Engine 预览" />
</p>

## 快速开始

```bash
git clone https://github.com/LessUp/meta-human.git
cd meta-human
npm install
npm run dev
```

打开 **http://localhost:5173**。无需 API Key，引擎自动降级到本地模拟模式。

> 可选后端：`examples/backend-python/` 提供 FastAPI 参考实现。

## 功能

- **3D 数字人** — GLB/GLTF 自定义模型或内置程序化形象；情绪驱动表情（happy / surprised / sad / angry）；骨骼动画（挥手、点头、跳舞等）
- **语音交互** — 浏览器原生 TTS（SpeechSynthesis）和 ASR（SpeechRecognition，仅 Chrome/Edge）；智能静音、嘴型同步
- **对话系统** — HTTP/SSE 双传输；流式逐字响应；端点故障切换；离线降级
- **角色预设** — 4 种内置角色，后端控制系统提示词
- **自定义形象** — 上传 GLB 模型替换默认形象

```typescript
import { useEngine, useDialogue } from '@/services';

const engine = useEngine();
const dialogue = useDialogue();

const response = await dialogue.runDialogueTurn('讲个笑话');
engine.setEmotion(response.emotion);
engine.playAnimation(response.action);
```

## 架构

```
UI 层          ChatDock · TopHUD · ControlPanel · SettingsDrawer
                    │
服务容器层      ServicesProvider · useEngine · useDialogue · useTTS · useASR
                    │
核心引擎层      Avatar · Dialogue · Audio（纯运行时，不引入 React）
                    │
状态层          chatSessionStore · systemStore · digitalHumanStore（Zustand 5）
                    │
外部服务        Three.js · Web Speech API · 可选 FastAPI 后端
```

## 项目结构

```
src/
├── core/                          # 引擎模块（不引入 React）
│   ├── avatar/                    # 3D 渲染与动画
│   ├── audio/                     # TTS & ASR 服务
│   ├── dialogue/                  # 对话传输与编排
│   └── createServices.ts          # 服务容器工厂
├── services/                      # React 服务容器（ServicesProvider、useServices）
├── components/                    # React 组件
│   ├── viewer/                    # 3D 视口
│   └── landing/                   # 落地页
├── store/                         # Zustand 状态
├── hooks/                         # 自定义 Hooks
├── pages/                         # 路由页面
├── __tests__/                     # 单元测试（Vitest）
└── lib/                           # 工具函数
```

路径别名：`@/*` → `src/*`（配置在 `vite.config.ts` 和 `tsconfig.json`）。

## 脚本

```bash
npm run dev              # 开发服务器
npm run build            # 生产构建
npm run build:pages      # GitHub Pages 构建
npm run typecheck        # TypeScript 检查
npm run lint             # ESLint 检查
npm run test:run         # 运行测试
npm run test:coverage    # 覆盖率报告
```

## 浏览器支持

| 功能           | Chrome / Edge | Firefox | Safari |
| -------------- | ------------- | ------- | ------ |
| 核心引擎 + TTS | 90+ ✅        | 90+ ✅  | 15+ ✅ |
| ASR 语音识别   | 90+ ✅        | ❌      | ❌     |

## 贡献

遵循 [Conventional Commits](https://www.conventionalcommits.org/lang/zh-CN/) 规范，保持 `master` 分支。详见 [AGENTS.md](AGENTS.md)。

## 许可证

[MIT](LICENSE) © LessUp
