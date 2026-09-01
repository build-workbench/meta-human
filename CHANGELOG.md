# 更新日志

记录 MetaHuman Engine 的所有重要变更。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循[语义化版本](https://semver.org/lang/zh-CN/)。

---

## [Unreleased]

### ✨ 新增

- **数字人活力增强** — 四项联动让模型"活起来"：
  - **思考联动** — 等待 LLM 回复期间（`behavior: 'thinking'`，编排器已有信号）持续歪头思考摆动，回复到达自动恢复
  - **说话联动** — TTS 播报时头部微摆由 `isSpeaking` 直接触发（原先只有 `speak` 动画才摆）
  - **全息呼吸** — 说话时扫描线加速（×1+1.8·speech）、Fresnel 边缘光增强，强度平滑跟随口型信号
  - **入场显现** — 模型加载后自下而上"全息聚合"（约 1.3s，带扫描亮边），reduced motion 直接跳过；首次加载完成播放 Wave 欢迎动作（每次会话一次）
- **地面全息投影环** — 模型脚下静态底盘环 + 淡光盘 + 说话声呐脉冲（强度跟随口型），reduced motion 静止；同时修正 `ContactShadows` 平面从 y=0 移到脚底地面高度（原平面横穿身体、下半身投不上影）
- **情绪自动机** — 后端未返回有效情绪标签（缺失/neutral）时，从回复文本本地推导兜底（`core/avatar/emotionHeuristics.ts`）：问号收尾→surprised、负面词→sad、正面词→happy；后端明确给出的情绪永远优先
- **注视相机** — 内层 gaze group 朝相机方位小幅偏转（最大 ±0.5 rad，独立于摆动 group，互不打架），OrbitControls 转视角/自动旋转时机器人"跟着看"
- **真口型降级** — 无 jawOpen morph 时渲染全息嘴覆盖层：从表情 morph 网格包围盒推导 `faceAnchor` 锚定下颌，开合与亮度实时跟随口型信号（配合说话头摆观感即为真口型）；上传带 jawOpen 的模型时走真 morph、覆盖层自动关闭

### 🐛 修复与清理

- **manifest 路径去硬编码** — `public/manifest.json` 的 `start_url`/`scope`/图标路径从绝对 `/meta-human/` 改为相对路径，dev（base `/`）不再 404，且任意部署子路径都可用
- **CSP 清理** — 移除 `<meta>` CSP 中无效的 `frame-ancestors` 指令（meta 方式强制不了该指令，浏览器直接忽略并告警；如需禁 iframe 嵌入须走 HTTP 响应头）

---

## [0.1.0] - 2026-09-01

> 版本基线重置：删除全部历史 tag（原最新 `v2.3.0`），以本次形象重做为新起点重新从 `v0.1.0` 计版本。

### ✨ 新增

- **内置 3D 头像** — 默认形象从程序化几何体升级为自托管 CC0 模型 `RobotExpressive.glb`（453KB，Tomás Laulhé / Don McCurdy，无贴图纯材质），加载后整体覆盖全息材质（Fresnel 边缘光 + 流动扫描线，`onBeforeCompile` 注入标准管线，蒙皮/阴影不受影响）。能力自动探测 + 降级：表情走 morph target（`Angry`/`Surprised`/`Sad`，缺失的 smile/blink 静默降级）；口型优先 jawOpen 类 morph，缺失时借 surprise 通道 ×0.3 模拟；动作优先播放模型剪辑（`Idle`/`Yes`/`No`/`Wave`/`Dance`），无剪辑的 think/speak 降级为程序化旋转；模型加载失败仍回退程序化 `CyberAvatar`。上传自定义 GLB 的既有链路不变，新增 `AvatarSource kind: 'builtin'`

### 🔧 变更

- **版本基线** — `package.json` 与落地页徽章版本统一为 `0.1.0`

### 🐛 修复与清理（基线内并入的历史项）

- **连接状态收口** — `systemStore.recordConnectionHealth` 改由 `setConnectionStatus` 统一维护 `connectionStatus`/`isConnected`，消除双写漂移
- **复位语义补全** — `digitalHumanStore.reset()` 复位范围扩至录音/静音/说话/自动旋转等运行时状态（保留角色预设与头像来源）
- **ASR 竞态加固** — `'already started'` 重启路径中 `recognition.stop()` 包 try/catch，避免停止阶段抛错导致录音状态残留
- **对话错误可见** — `useChatStream` 异常路径补写系统错误（ChatDock 错误条可显示）
- **移除伪功能** — 行为面板删除 Auto-Pilot 随机行为模拟循环
- **默认值收口** — TTS 默认 lang/rate/pitch/volume 收敛到 `core/audio/ttsConfig.ts` 单一来源
- **动作映射去重** — 删除 `avatarContract.ACTION_TO_BEHAVIOR` 冗余表，统一由 `constants.ANIMATION_TO_BEHAVIOR` 提供
- **键盘行为对齐** — 控制器快捷键监听补标签页可见性守卫
- **死代码清理** — 删除 `dialogueService.getChatTransport`、`DialogueRouting.setTransportOverride`、`LoadingSpinner.fullScreen`、`KeyboardControls.onCommand`
- **文案更新** — 行为/表情控制面板中文化；落地页徽章 `v2.2`→`v2.3.0`、测试数 `183`→`248`
- **工程** — 新增 `tsconfig.node.json` 让 vite/vitest/eslint 配置文件纳入 typecheck；prettier 格式化对齐
- **测试补强** — 新增 `createServices` / `systemStore` / `digitalHumanStore.reset` / `useVoiceCommandHandler` 测试（248 → 258）

---

## [2.3.0] - 2026-08-07

### 🛠️ 工程与测试

- **依赖升级** — react / react-dom 升至 19.2.8，three 升至 0.185，vite 6.4.3，zustand 5.0.14，eslint 9.39，typescript-eslint 8.66 等全部升至当前最新 minor；大版本（vite 8、vitest 4、eslint 10、typescript 7）保持延后，避免无必要的迁移成本
- **3D 渲染层测试** — 新增 `CyberAvatar`（嘴型跟随、表情、动画、reducedMotion 跳过）、`Scene`（编排与 prop 透传）、`KeyboardControls`（按键映射、输入框/不可见守卫、卸载清理）冒烟测试，+16 个（232 → 248）；`CyberAvatar` 覆盖率 5.4% → 90.1%，`Scene` 10.1% → 100%，全量 62.7% → 67.7%

### 🛠️ 健壮性与质量

- **TTS 挂起兜底** — `TTSService.speak()` 增加 watchdog：Chrome `speechSynthesis` 在已知缺陷下 `onend`/`onerror` 永不触发，导致 Promise 挂起、`isSpeaking` 与嘴型循环卡死，现在超时后强制清理并正常 settle。词边界事件（`onboundary`）会重置 watchdog，长文本不会误杀。
- **ASR 录音入口统一** — 新增 `useRecorder` hook 作为管理识别的唯一 React 入口，顶栏 / 聊天坞 / 设置面板录音按钮共用，消除多入口各自调 `asr.start()` 导致的回调覆盖与 stop→restart 竞态。`ASRService.start()` 在录音中仅替换回调；`'already started'` 重试增加 3 次上限，不再无限递归。关闭设置面板不再中断其他入口发起的录音。
- **嘴型数据通道** — `mouthOpen` 移出 Zustand store，改为模块级 `mouthOpenSignal`，`CyberAvatar` 在 `useFrame` 中直读。≈16Hz 的 viseme 高频数据不再写穿 React 状态层。
- **环境贴图离线化** — `Scene` 环境反射从 `Environment preset="city"`（运行时从外部 CDN 拉取 HDR，弱网/离线失效）改为 `Lightformer` 程序化光带，与赛博主题配色一致；反射内容随之变化。
- 新增 TTS watchdog、ASR 幂等 / 事件路径 / generation 竞态、`useRecorder`、`connectionRecovery` 测试（+24 个，183 → 207）；覆盖率阈值从 lines 40 / functions 34 / branches 30 上调至 60 / 68 / 73，门禁重新生效。

### 🎭 流式对话与嘴型同步

- **真流式对话** — Python 后端从假流式改为真逐字流式。LLM 先输出纯文本回复，随后以 `===META===` 标记行携带 emotion/action JSON，用户在 LLM 生成过程中即可看到逐字输出。
- **嘴型同步** — 新增 `mouthOpen` 状态通道，由 `TTSService` 中基于时间的 viseme 循环驱动（≈16Hz 正弦 + 噪声模拟）。程序化 `CyberAvatar` 渲染嘴部网格，随 TTS 播放张合，`onSpeakEnd` 重置为闭嘴。

### 🧑‍🎤 角色预设

- **内置角色预设** — 提供 4 种角色人设（`lively-assistant`、`serious-advisor`、`cute-companion`、`pro-service`），后端控制系统提示词映射。前端仅发送 `characterId`，避免注入。设置面板基础标签页新增预设选择器。
- **对话元数据携带 `characterId`** — `buildDialogueRequestMeta` 新增可选 `characterId` 字段，`useChatStream` 在每次流式轮次中转发当前预设。

### ⚙️ 运行时配置

- **运行时 API 端点覆盖** — 设置面板新增 `config` 标签页，可在运行时覆盖对话后端 base URL 和备用端点。覆盖值持久化到 `localStorage`，启动时由 `ServicesProvider` 重新应用，优先于 `VITE_API_BASE_URL` 环境配置。重置按钮恢复环境默认值。

### 🧪 测试

- 新增嘴型同步（`mouthOpen` 钳位、TTS 回调接线、viseme 循环生命周期）、角色预设（唯一性、默认回退、校验）、运行时 API 配置（`localStorage` 持久化、端点路由）测试。
- 扩展 `dialogueRequestMeta` 和后端对话服务的 `characterId` 处理测试。

### ✨ 运行时能力

- 新增结构化对话请求元数据，语言偏好、语音配置和近期视觉上下文随每个对话轮次一起发送
- 在 `digitalHumanStore` 中持久化语音偏好和近期视觉上下文，语音交互面板支持多语言 TTS
- 新增自定义形象上传、替换、回退到内置形象处理，设置面板新增形象管理控件
- 新增端点发现与主/备故障切换，覆盖健康检查、标准对话请求和流式对话请求
- 新增运维端点路由诊断，HUD 显示当前服务端点和故障切换次数
- 新增共享形象源适配器，页面组合、设置 UI 和控制器回退逻辑复用相同的源/状态/对象 URL 决策

### 🧹 仓库精简

- README 重写：砍掉与 AGENTS.md 重复的架构图、项目结构、脚本命令，从 ~120 行压到 ~50 行
- CLAUDE.md 缩为一行，指向 AGENTS.md 作为唯一规范来源
- i18n 只保留中文：删除 `en` 语言包（~140 行）、语言切换逻辑和落地页英文翻译
- `package.json` description 和 GitHub About 改为中文
- `components/ui/` 合并到 `components/`，`viewer/utils/` 上移到 `viewer/`，减少薄目录层
- 移除 `.trellis/`、`.claude/`、`.opencode/` 中的 AI 工作流框架和生成自动化
- 贡献指南精简为最小化 `AGENTS.md` / `CLAUDE.md`
- 移除 `docs/agents/` 残留 AI 工作流文档，删除仓库 Copilot 指令文件
- 删除重复的根目录 `docs/api/`、`docs/architecture/`、`docs/guide/`，保留规范化本地化文档
- 移除遗留 `/advanced` 和 `/digital-human` 应用别名，产品运行时统一为 `/app` 入口
- 移除已废弃的模块级对话编排器封装，编排保持实例作用域
- 落地页和文档站不再暴露更新日志导航
- 修正仍声称 Docker、Render、CLI 脚手架、模板和旧后端路径的过时文档
- 将已删除 `changelog/` 目录的历史笔记合并到本文件
- 删除 `docs/` 目录和 VitePress 文档站，文档精简为根目录中文文件
- 删除英文 README，仅保留中文 `README.md`
- 删除未使用的 barrel index 和死代码（`core/adapters.ts` 等）
- 修正 README 和落地页中编造的 API 示例（`perform()`、`dialogueService.send()` 等）
- 删除 i18n 抽象层（`lib/i18n.ts`、`hooks/useI18n.ts`），45 处 `t()` 调用内联为直接中文字符串；合并空壳页 `AdvancedDigitalHumanAppPage` 到 `App.tsx`，`/app` 路由内联 `ServicesProvider`
- 精简 `examples/backend-python/`：删除前端未使用的 WebSocket 端点、Redis 会话存储、本地 faster-whisper ASR、`DialogueService._parse_llm_response` 死代码与名不副实的 `requirements.lock`；`ChatRequest` 三通道元数据（`meta`/`metadata`/`context`）收敛为单一 `meta`；默认模型统一为 `gpt-4o-mini`；新增 README 说明定位、端点、契约与环境变量

### 🗂️ 历史笔记

- **2026-05** — 对话运行时限定到服务容器，移除死导出和已废弃语音命令处理器，集中化服务适配器，新增 GitHub Pages 语言检测。

---

## [2.2.0] - 2026-04-29

### 🏗️ 架构

- **Python 后端** — `server/` 移至 `examples/backend-python/` 作为可选参考实现
- **项目结构** — 明确后端可选，前端默认零配置

### 📚 文档

- README 新增后端可选说明，统一 Node.js ≥22 要求
- 移除 Python 前置要求，更新项目结构
- 修复版本号（v1.0.0 → v2.1.0），删除重复 CHANGELOG.zh-CN.md

### 🛠️ 工程

- `build-pages.sh` 新增站点地图生成、构建时间戳、体积输出
- `.gitignore` 新增 `*.tsbuildinfo`
- `.vscode/` 新增 settings.json 和 mcp.json

---

## [2.1.0] - 2026-04-29

### 🏗️ 架构大改

- **对话编排器** — 引入 `turnId` 所有权隔离，`finalizeDialogueTurn` 仅在当前 turnId 匹配时执行清理，防止跨轮次状态污染
- **会话存储** — 新增本地持久化（sessionId + 聊天记录）、消息上限（100 条）、流式占位符过滤、类型守卫反序列化
- **系统存储** — 新增 `ConnectionDiagnostics`（健康检查延迟、降级状态跟踪）
- **音频服务** — 修复 ASR 配置可选属性赋值
- **清理 20+ 死文件**：`.omc/`、`Dockerfile`、`docker/`、`docker-compose.yml`、`render.yaml` 等
- **清理 3 个 worktree、4 个过时分支**，仅保留 `master`
- **重写 `.gitignore`**：分类结构，去重
- **CI** — 发布说明改用 `generate_release_notes: true`

### 🐛 修复

- 修复 `speakWith` 变为 fire-and-forget 导致的 2 个测试失败
- 修复 audioService.ts 中未使用 catch 变量的 ESLint 错误

---

## [1.1.0] - 2026-04-27

- 启用 TypeScript strict 模式（`strict`、`noUnusedLocals`、`noUnusedParameters`、`noFallthroughCasesInSwitch`），修复 31 个类型错误
- 统一 `buildEmptyResponse` 函数，消除 `dialogueService.ts` 和 `chatTransport.ts` 间的重复
- 统一 Node.js 版本要求为 ≥20，新增 `.nvmrc`

---

## [1.0.0] - 2025-04-22

首个稳定版本。

- **3D 数字人引擎** — Three.js 实时渲染，情绪驱动表情，骨骼动画
- **语音交互** — Web Speech API TTS 合成与 ASR 识别
- **对话系统** — OpenAI 兼容对话，SSE 流式支持
- **状态管理** — 三个独立 Zustand store（chatSession / system / digitalHuman）
- **传输抽象** — HTTP/SSE 统一接口，自动选择
- **性能优化** — 低端设备跳帧、可见性暂停、自适应 DPR/阴影/粒子数

---

## [0.9.0] - 2025-03-18

- 架构重构，状态域分离
- 抽象 `ChatTransport` 接口，HTTP/SSE 传输实现

## [0.8.0] - 2025-02-25

- SSE 流式对话集成，渐进式消息展示

## [0.7.0] - 2025-01-24

- Web Speech API TTS 集成，浏览器原生 ASR，命令/听写模式

## [0.6.0] - 2025-01-23

- 组件结构：`DigitalHumanViewer`、`ChatDock`、`TopHUD`、`ControlPanel`
- Tailwind CSS 集成，暗色模式，响应式布局

---

## 版本规则

遵循[语义化版本](https://semver.org/lang/zh-CN/)：

- **MAJOR** — 不兼容的 API 变更
- **MINOR** — 向后兼容的新功能
- **PATCH** — 向后兼容的缺陷修复

---

[0.1.0]: https://github.com/build-workbench/meta-human/releases/tag/v0.1.0
[2.3.0]: https://github.com/vibe-knight/meta-human/releases/tag/v2.3.0
[2.2.0]: https://github.com/vibe-knight/meta-human/releases/tag/v2.2.0
[2.1.0]: https://github.com/vibe-knight/meta-human/releases/tag/v2.1.0
[1.1.0]: https://github.com/vibe-knight/meta-human/releases/tag/v1.1.0
[1.0.0]: https://github.com/vibe-knight/meta-human/releases/tag/v1.0.0
[0.9.0]: https://github.com/vibe-knight/meta-human/releases/tag/v0.9.0
[0.8.0]: https://github.com/vibe-knight/meta-human/releases/tag/v0.8.0
[0.7.0]: https://github.com/vibe-knight/meta-human/releases/tag/v0.7.0
[0.6.0]: https://github.com/vibe-knight/meta-human/releases/tag/v0.6.0
