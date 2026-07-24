# MetaHuman Engine

浏览器里的 3D 数字人。能听、能说、能对话，零配置即可运行。

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

打开 http://localhost:5173 即可使用。无需 API Key，无后端时自动降级到本地模拟回复。

## 架构

```text
┌─────────────────────────────────────────────────────────┐
│  Pages / Components（React 19 + Tailwind 4）            │
│  LandingPage · AdvancedDigitalHumanPage · ChatDock · HUD│
├─────────────────────────────────────────────────────────┤
│  Hooks（UI 编排）                                        │
│  useChatStream · useVoiceInteraction · useConnectionHealth│
├─────────────────────────────────────────────────────────┤
│  Services（React DI 容器）                               │
│  ServicesProvider → useEngine / useTTS / useASR / useDialogue│
├─────────────────────────────────────────────────────────┤
│  Core（纯 TS，不引入 React）                             │
│  ┌───────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Avatar    │  │ Dialogue     │  │ Audio            │  │
│  │ Engine    │  │ Service +    │  │ TTS + ASR        │  │
│  │ 表情/动画 │  │ Orchestrator │  │ 嘴型驱动         │  │
│  └───────────┘  └──────────────┘  └──────────────────┘  │
├─────────────────────────────────────────────────────────┤
│  Store（Zustand 5）                                      │
│  digitalHumanStore · chatSessionStore · systemStore      │
└─────────────────────────────────────────────────────────┘
```

Core 层通过适配器（`getState()`）读写 Zustand，不依赖 React。UI 层通过 hooks 编排 Core 服务。

## 核心能力

### 3D 形象

- 内置程序化 CyberAvatar（Three.js 几何体拼装，无需外部模型）
- 支持上传 GLB/GLTF 替换，加载失败自动回退内置形象
- 5 种情绪 → 11 种表情映射，10 种动作 → 15 种行为映射
- 骨骼动画自动定时复位，支持 `prefers-reduced-motion`

### 对话

- HTTP / SSE 双传输，环境变量或运行时面板切换
- SSE 真流式：逐字输出，`token` → `done` 事件协议
- 主/备端点故障切换（`EndpointRouter`），HUD 显示路由诊断
- 轮次隔离：单调递增 `turnId` + Symbol 令牌，防止跨轮次状态污染
- 4 种角色预设，前端只发 `characterId`，系统提示词由后端管控

### 语音

- TTS：浏览器原生 `speechSynthesis`，支持语速/音调/音量调节
- ASR：`webkitSpeechRecognition`（仅 Chrome/Edge），命令/听写双模式
- 嘴型同步：viseme 循环（≈16Hz 正弦 + 噪声）驱动 `mouthOpen` 状态通道
- 中文语音指令解析：播放、暂停、打招呼、跳舞、点头等

### 降级策略

每一层外部依赖都有明确退路：

| 场景                    | 降级行为                          |
| ----------------------- | --------------------------------- |
| 无后端                  | 本地模拟回复（区分问候/普通对话） |
| SSE 失败                | 回退到 HTTP 非流式请求            |
| 全部端点不可达          | 返回离线提示 + 情绪/动作          |
| 后端无 LLM Key          | 关键词匹配的智能回复              |
| 浏览器无 Web Speech API | 隐藏语音 UI，文字交互不受影响     |
| 自定义模型加载失败      | 回退程序化 CyberAvatar            |

## 浏览器兼容

| 能力                 | Chrome / Edge | Firefox | Safari |
| -------------------- | :-----------: | :-----: | :----: |
| 3D 渲染 + 对话 + TTS |      ✅       |   ✅    |   ✅   |
| ASR 语音识别         |      ✅       |   ❌    |   ❌   |

## 后端参考实现

`examples/backend-python/` 提供 FastAPI 参考后端，可选部署：

```bash
cd examples/backend-python
pip install -r requirements.txt
uvicorn app.main:app --reload
```

- 无 `OPENAI_API_KEY` 时以关键词匹配模式运行，无需任何外部服务
- 有 Key 时接入 OpenAI 兼容 API，`===META===` 标记协议分离文本流与情绪/动作元数据
- 内置会话管理（TTL 清理）、限流、CORS

前端通过 `VITE_API_BASE_URL` 或运行时设置面板指向后端。

## 开发

```bash
npm run typecheck    # 类型检查
npm run lint         # ESLint
npm run test:run     # Vitest 全量测试
npm run build        # 生产构建
```

架构约定、目录职责、护栏规则见 [AGENTS.md](AGENTS.md)。

## 许可证

[MIT](LICENSE) © LessUp
