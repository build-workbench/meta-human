# MetaHuman Engine 开发路线图

> 制定日期：2026-09-02 · 定位：**开源展示项目**（作品集 / 技术展示向）
>
> 职责划分：本文是路线图、技术方案与**中长期任务清单**的唯一来源；`TODO.md` 保留历史条目与完成归档；版本历史只记在 `CHANGELOG.md`。

---

## 一、定位与目标

**定位**：开源展示项目 —— 访客从 GitHub 或 Pages 链接进入，先看落地页，再进 `/app` 体验数字人。

这个定位决定了优先级排序与生产级产品**完全不同**：

| 维度     | 展示项目（本项目）             | 生产级产品     |
| -------- | ------------------------------ | -------------- |
| 首屏速度 | **生命线** —— 访客等不了 3 秒  | 重要但可容忍   |
| 视觉打磨 | **核心卖点**                   | 够用即可       |
| 文档     | **可传播性的载体**             | 内部 Wiki 即可 |
| 工程质量 | **可信度凭证**（徽章、覆盖率） | 稳定性、监控   |
| 功能广度 | 够演示即可，重"亮点密度"       | 重覆盖与稳定   |

**三条设计原则**（贯穿全路线图）：

1. **访客动线优先** —— 落地页 → `/app` 的每一步都要快、要能看懂
2. **零后端可运行** —— 不启动 Python 后端也能完整体验（含对话降级文案）
3. **每个外部集成都有降级路径** —— AGENTS.md 规则 4，新增能力同样适用

---

## 二、现状基线（2026-09-02 实测）

### 2.1 体积构成

`npm run build` 实测输出：

| chunk                      | 原始        | gzip          | 是否在首屏 |
| -------------------------- | ----------- | ------------- | ---------- |
| `three-vendor`             | 1,026.94 kB | **283.08 kB** | ⚠️ 是      |
| `react-vendor`             | 193.87 kB   | 60.58 kB      | 是         |
| `AdvancedDigitalHumanPage` | 73.09 kB    | 21.88 kB      | 否（lazy） |
| `ui-vendor`                | 56.35 kB    | 14.39 kB      | 是         |
| `router-vendor`            | 37.51 kB    | 13.62 kB      | 是         |
| `index`                    | 39.04 kB    | 13.13 kB      | 是         |
| `LandingPage`              | 33.15 kB    | 8.74 kB       | 按需       |
| `state-vendor`             | 7.83 kB     | 3.29 kB       | 是         |
| CSS                        | 83.08 kB    | 12.74 kB      | 是         |

**首屏实测合计 ≈ 388 kB gzip**（6 个 `modulepreload` + entry）。

### 2.2 🔴 已定位的头号问题：`manualChunks` 把 three 拖进首屏

`vite.config.ts:80-89` 的 `manualChunks` 正则把 `three|@react-three` 归入 `three-vendor`，但 Rollup 的共享 helper（`_` 等）也被塞进了这个 chunk。结果入口 `index.js` 为了拿一个 helper 而**静态 import 整个 three-vendor**：

```js
// dist/assets/index-*.js 中的实际代码
import { _ as gt } from './three-vendor-C5QOkZs8.js';
```

落地页根本不需要 three，却要下载 283 kB gzip。

**已实测验证**：去掉 `manualChunks` 后重新构建（临时配置，产物已清理）：

|                    | 现状                 | 去掉 manualChunks | 变化          |
| ------------------ | -------------------- | ----------------- | ------------- |
| 首屏 gzip          | 388 kB               | **111 kB**        | **−71%**      |
| 首屏请求数         | 6 个 preload + entry | 1 个 entry        | −6            |
| `/app` 总加载 gzip | ≈ 410 kB             | ≈ 418 kB          | +8 kB（持平） |

three 本身仍留在 `AdvancedDigitalHumanPage` chunk 里按需加载，`/app` 体验不受影响。

### 2.3 其他实测数据

| 项             | 现状                                                                        |
| -------------- | --------------------------------------------------------------------------- |
| 测试           | 42 文件 / **317 例** 全过                                                   |
| 覆盖率         | lines 72.8 / branch 79.79 / funcs 73.66 / stmts 72.8                        |
| 覆盖率门禁     | 60 / 68 / 73 / 60（`vitest.config.ts:27-32`）                               |
| CI             | 1 个 workflow，3 job（ci / deploy / release）                               |
| 生产依赖       | 9 个（three / drei / fiber / react×2 / router / zustand / lucide / sonner） |
| `public/` 字体 | ~~1.2 MB 全量~~ → 切片后两页 UI 实测下载 303 KB（-74%，见 Phase 1）         |
| `docs/`        | 仅 2 张截图，**零技术文档**                                                 |
| E2E            | 无                                                                          |
| bundle 分析    | 无（仅 `chunkSizeWarningLimit: 1500`）                                      |

### 2.4 待清的债

| 债                | 位置                                              | 说明                                                                                                          |
| ----------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 仓库元数据过期    | `package.json:73-80`                              | `repository`/`homepage`/`bugs` 仍指向 `vibe-knight/meta-human`，实际 remote 已是 `build-workbench/meta-human` |
| description 单语  | `package.json:4`                                  | 只有中文，组织规范要求 `中文简介 \| English summary` 双语                                                     |
| coverage 注释过时 | `vitest.config.ts:26`                             | 写「当前实际约 67/78/74/67」，实测已是 72.8/79.79/73.66/72.8                                                  |
| flaky 测试        | `digitalHuman.test.tsx:600-620`                   | 两个 `performance.now()` 硬阈值断言（100ms / 50ms），CI 负载下随机失败                                        |
| CHANGELOG 滞后    | `CHANGELOG.md:9`                                  | Unreleased 段未记录 2026-09-02 的 3 个 commit（P1 性能 / 归一化 / 分段动作）                                  |
| 双份默认端点      | `endpointRouter.ts:19` + `dialogueService.ts:100` | 两处硬编码 `http://localhost:8000`                                                                            |
| 平行实现          | `ModelAvatar` / `CyberAvatar`                     | 两份驱动逻辑；两个控制面板（Behavior/Expression）结构同构                                                     |

---

## 三、技术架构

### 3.1 分层（现状，来自 AGENTS.md）

```text
src/
├── pages/       路由页面（LandingPage / AdvancedDigitalHumanPage，均 lazy）
├── components/  UI 与落地页组件
├── hooks/       UI 侧编排 hooks
├── services/    React 服务容器（ServicesProvider / useServices）
├── core/        运行时服务，不引入 React  ← 硬约束
├── store/       Zustand（chatSession / system / digitalHuman）
└── lib/         工具函数
```

**关键约束**（新增代码必须遵守）：

- `core/` 不得 import React —— 保证运行时服务可脱离 UI 测试
- 服务通过 `useXStore.getState()` 读写 Zustand，避免高频数据写穿 React（`mouthOpenSignal` 已是范例）
- 简化时优先删除合并，不新增封装层

### 3.2 渲染与驱动链路

```text
DigitalHumanViewer (Canvas: shadows/dpr/frameloop)
  └── Scene (相机 / 光照 / Environment / ContactShadows / Sparkles)
        ├── ModelAvatar  ← GLB 模型（有 model 时）
        └── CyberAvatar  ← 程序化几何（降级回退）

驱动信号：
  store (低频)  → 表情 / 情绪 / 行为 / 动画剪辑
  mouthOpenSignal (≈16Hz，模块级)  → 口型，useFrame 直读，不进 React
  speechActionPlanner  → 长回复按句切分，逐句 playAnimation
```

### 3.3 对话链路

```text
useChatStream → DialogueOrchestrator (turnId 所有权隔离)
  → ChatTransport { http | sse }
      → HTTP: parseChatResponse（emotion/action 归一化）
      → SSE:  streamUserInput（done 事件，同样归一化）
  → handleDialogueResponse
      → setEmotion（后端优先，本地启发式兜底）
      → playAnimation / startSegmentedSpeechActions
      → speakWith（TTS，带 hang watchdog）
```

---

## 四、分阶段路线图

> 阶段间有依赖：Phase 1 的 bundle 分析要先落地，后续优化才有衡量依据。
> 不列时间估算，按 Phase 顺序推进，每个 Phase 结束打个 tag。

### Phase 0 — 清债与基线校正

**目标**：把已知瑕疵清干净，让后续每个 Phase 有干净的基线和可信的衡量工具。

| Task               | 文件                                              | 验收                                                                                               |
| ------------------ | ------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 修正仓库元数据     | `package.json:73-80`                              | `repository`/`homepage`/`bugs` 改为 `build-workbench/meta-human`                                   |
| description 双语化 | `package.json:4`                                  | 改为 `中文简介 \| English summary`                                                                 |
| 修正过时注释       | `vitest.config.ts:26`                             | 更新为实测覆盖率数字                                                                               |
| 修复 flaky 测试    | `digitalHuman.test.tsx:600-620`                   | 去掉 `performance.now()` 硬阈值，改为结构性断言（渲染成功 + 状态正确）或放宽到不依赖机器负载的量级 |
| 补记 CHANGELOG     | `CHANGELOG.md:9`                                  | Unreleased 段补 2026-09-02 的 3 个 commit                                                          |
| 收敛默认端点       | `endpointRouter.ts:19` / `dialogueService.ts:100` | 抽单一常量源                                                                                       |
| 加 bundle 分析     | `vite.config.ts`                                  | 新增 devDep `rollup-plugin-visualizer`，产物出 `stats.html`（不进仓库）                            |

### Phase 1 — 首屏体验（最高优先级）

**目标**：落地页首屏 gzip 从 388 kB 降到 120 kB 以内。这是展示项目的生命线。

| Task                         | 技术方案                                                                                                                                                                                                                                                                            | 预期                       |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| **移除/重构 `manualChunks`** | 删掉 `vite.config.ts:80-89` 的手工分包，让 Rollup 按依赖图自动分包；three 自然落入 `AdvancedDigitalHumanPage` 的 lazy chunk。**已实测 −71%**                                                                                                                                        | 388 → 111 kB gzip          |
| 字体切片（✅ 2026-09-02）    | 原字体已是 GB2312 一级字库（3782 字），字符集子集化无收益；改为 Google Fonts 式切片：片 0 = 源码 UI 实际用字（932 字含全角标点），片 1-7 按码点 450 字/片，`unicode-range` 按需加载。字形全集保留，聊天生僻字自动拉对应片、永不 fallback。再生成：`python3 scripts/subset-fonts.py` | 实测 1188 → 303 KB（-74%） |
| 字体加载策略                 | 已有 `font-display: swap`；子集化后加 `<link rel="preload">` 关键字重，其余按需                                                                                                                                                                                                     | 消除 FOUT 抖动             |
| 落地页图片优化               | 当前 `public/` 无位图，`docs/` 的 PNG 不参与构建。若后续加预览图需走 WebP/AVIF + 响应式 `srcset`                                                                                                                                                                                    | 预防回归                   |
| 首屏骨架                     | 落地页已有 lazy fallback；评估是否加轻量骨架屏替代全黑 loading                                                                                                                                                                                                                      | 感知速度                   |

**验收**：`npm run build` 后首屏 gzip < 120 kB；Lighthouse Performance ≥ 90（桌面端）。

### Phase 2 — 文档与可传播性

**目标**：让访客 5 分钟看懂架构、10 分钟跑起来。当前 `docs/` 零技术文档，是最大的传播瓶颈。

| Task                   | 内容                                                                                               |
| ---------------------- | -------------------------------------------------------------------------------------------------- |
| `docs/architecture.md` | 分层架构、渲染链路、对话链路、状态分层（低频 store vs 高频 signal）、降级矩阵                      |
| `docs/quickstart.md`   | 零后端启动、接 Python 后端、接自有 OpenAI 兼容端点的三种路径                                       |
| `docs/protocol.md`     | HTTP `/v1/chat` 与 SSE `/v1/chat/stream` 契约、emotion/action 白名单与归一化规则、错误码与故障转移 |
| `docs/extension.md`    | 换模型（含 jawOpen 自动识别机制）、加表情/动作、接第三方 TTS 的扩展点                              |
| README 增强            | 技术亮点清单、架构图（用 `archify` skill 生成 SVG）、徽章、截图更新                                |
| 示例后端文档           | `examples/backend-python/README.md` 补充环境变量表与 Mock 模式说明                                 |

**验收**：新访客按 `docs/quickstart.md` 能在无指导下跑通零后端体验。

### Phase 3 — 工程质量与可信度

**目标**：把"工程质量"变成可展示的凭证 —— 覆盖率徽章、CI 全绿、无 flaky。

| Task           | 目标                                                      | 说明                                                                                                           |
| -------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 补覆盖率空洞   | 见下表                                                    | 按"展示价值"排序，不追求 100%                                                                                  |
| E2E 冒烟       | 新增 devDep `@playwright/test`                            | 覆盖 3 条关键路径：落地页渲染 → 进 `/app` → 发消息收到回复（用 mock 后端）；用项目已有的 Playwright 浏览器缓存 |
| CI 增强        | `.github/workflows/ci.yml`                                | 加体积门禁（首屏 gzip 超阈值即 fail）、PR 预览部署、E2E job                                                    |
| 覆盖率门禁上调 | `vitest.config.ts:27-32`                                  | 补齐空洞后上调至 lines 75 / branch 80 / funcs 78                                                               |
| 重复代码收敛   | `ModelAvatar`/`CyberAvatar`、Behavior/Expression 控制面板 | 提取共享驱动逻辑；**注意不要为了 DRY 而增加抽象层**（AGENTS.md 规则 5）                                        |

**覆盖率空洞（实测）**：

| 模块                     | 现状                 | 目标 | 优先级                                   |
| ------------------------ | -------------------- | ---- | ---------------------------------------- |
| `LandingPage.tsx`        | 0%                   | 40%  | 中（纯展示，但零覆盖不好看）             |
| `useFocusTrap.ts`        | 10.81%               | 70%  | **高**（无障碍，回归风险大）             |
| `transports.ts`          | 56.25%（branch 25%） | 85%  | **高**（HTTP/SSE 双路径分支）            |
| `DigitalHumanViewer.tsx` | 55.42%               | 80%  | 中（本轮已加 3 例，继续补 dispose 路径） |
| `cameraControls.ts`      | 58.62%               | 80%  | 中                                       |
| `chatSessionStore.ts`    | 66.66%               | 85%  | 中（持久化逻辑）                         |
| `endpointRouter.ts`      | 72.72%               | 85%  | 中（故障转移）                           |

### Phase 4 — 功能增强

**目标**：提高"亮点密度"，让 demo 更有看点。按展示价值排序，非全部必做。

| Task        | 技术方案                                                                                                          | 展示价值                   |
| ----------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------- |
| 会话持久化  | IndexedDB 存 sessionId + 聊天记录（现仅内存 + 部分 localStorage）；沿用 `chatSessionStore` 已有的类型守卫反序列化 | 中                         |
| 移动端适配  | 当前 OrbitControls + 快捷键面向桌面。加触摸手势映射、响应式布局断点、移动端 HUD 折叠                              | **高**（手机访客占比高）   |
| 形象库      | 内置多套 CC0 GLB + 一键切换。复用现有上传链路与 `avatarModelPrepare` 自动探测                                     | **高**                     |
| 对话导出    | 导出 Markdown / JSON 对话记录                                                                                     | 低                         |
| 视觉预设    | 全息配色主题切换（青 / 紫 / 琥珀），走 CSS 变量 + `holo` uniform                                                  | 中                         |
| 截图/录屏   | 用 `MediaRecorder` + `canvas.captureStream()` 导出 webm，供社交传播                                               | **高**（展示项目传播利器） |
| 英文 README | 展示项目面向国际访客；注意 i18n 抽象层已被有意删除，只做 README 级双语，不重建运行时 i18n                         | 中                         |

---

## 五、Tasks 总清单

> 可直接复制到 `TODO.md` 逐项勾选。标记含义：**P0** = Phase 1 阻塞项，**S** = 小改动（< 1 文件）。

### Phase 0 — 清债

- [ ] **[S]** 修正 `package.json` 的 `repository`/`homepage`/`bugs` 为 `build-workbench/meta-human`
- [ ] **[S]** `package.json` description 改为双语 `中文简介 | English summary`
- [ ] **[S]** 更新 `vitest.config.ts:26` 过时覆盖率注释
- [ ] **[S]** 修复 `digitalHuman.test.tsx:600-620` 两处 `performance.now()` 硬阈值 flaky
- [ ] **[S]** CHANGELOG Unreleased 补记 2026-09-02 的 3 个 commit
- [ ] **[S]** 收敛 `endpointRouter.ts:19` 与 `dialogueService.ts:100` 的双份默认端点
- [ ] 接入 `rollup-plugin-visualizer`（devDep），产物 `stats.html` 加进 `.gitignore`

### Phase 1 — 首屏体验（P0）

- [x] **[P0]** 移除 `vite.config.ts:80-89` 的 `manualChunks`，改由 Rollup 自动分包 — **已实测 388 → 111 kB gzip**
- [x] **[P0]** 验证落地页首屏不再加载 three（检查 `dist/index.html` 无 three 相关 `modulepreload`）
- [x] 中文字体切片（UI 片 0 + 码点片 1-7）+ `unicode-range` 分片 — 实测 1188 → 303 KB；顺带修复落地页字体从未生效的 bug（index.html 内联 unlayered 规则压掉 @layer base 的 :root 声明）
- [ ] 关键字重 `preload`（可选优化：`font-display: swap` 已消除 FOUT，不阻塞验收）
- [ ] CI 加首屏体积门禁（gzip 超阈值 fail）
- [ ] Lighthouse 桌面端 Performance ≥ 90 验收

### Phase 2 — 文档

- [ ] `docs/architecture.md` — 分层、渲染链路、对话链路、降级矩阵
- [ ] `docs/quickstart.md` — 零后端 / Python 后端 / 自有端点三条路径
- [ ] `docs/protocol.md` — HTTP+SSE 契约、emotion/action 白名单与归一化、错误码
- [ ] `docs/extension.md` — 换模型（jawOpen 自动识别）、加表情动作、接第三方 TTS
- [ ] README 增强：技术亮点 + 架构图（`archify` skill）+ 徽章
- [ ] `examples/backend-python/README.md` 补环境变量表与 Mock 模式

### Phase 3 — 工程质量

- [ ] 补 `useFocusTrap.ts` 覆盖（10.81% → 70%）
- [ ] 补 `transports.ts` 覆盖（56.25% → 85%，重点 branch）
- [ ] 补 `DigitalHumanViewer.tsx` 覆盖（55.42% → 80%，含 dispose 路径）
- [ ] 补 `cameraControls.ts`（58.62%）、`chatSessionStore.ts`（66.66%）、`endpointRouter.ts`（72.72%）
- [ ] 补 `LandingPage.tsx`（0% → 40%）
- [ ] E2E：新增 `@playwright/test`，覆盖 落地页 → `/app` → 发消息收回复 三条路径
- [ ] CI：加 E2E job + PR 预览部署
- [ ] 覆盖率门禁上调至 lines 75 / branch 80 / funcs 78
- [ ] 收敛 `ModelAvatar`/`CyberAvatar` 共享驱动逻辑（谨慎，不为 DRY 加抽象）

### Phase 4 — 功能增强

- [ ] 移动端适配：触摸手势 + 响应式布局 + HUD 折叠
- [ ] 形象库：多套 CC0 GLB 一键切换
- [ ] 录屏导出：`MediaRecorder` + `canvas.captureStream()` → webm
- [ ] 全息配色主题切换（青 / 紫 / 琥珀）
- [ ] 会话持久化到 IndexedDB
- [ ] 对话记录导出 Markdown / JSON
- [ ] 英文 README（仅文档级双语，不重建运行时 i18n）

---

## 六、关键技术决策

| 决策           | 选择                                              | 理由                                                                                                                      |
| -------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 分包策略       | 删手工 `manualChunks`，交 Rollup 自动分           | 手工分包把 helper 塞进 `three-vendor`，导致落地页白下载 283 kB；自动分包已实测更优                                        |
| 高频信号通道   | 模块级 signal（如 `mouthOpenSignal`）而非 Zustand | ≈16Hz 的 viseme 数据写穿 React 会导致每帧重渲                                                                             |
| 服务容器       | `ServicesProvider` 只挂在 `/app` 路由             | 落地页不需要服务实例                                                                                                      |
| 形象方向       | RobotExpressive + 全息材质，**不换写实模型**      | 2026-09-02 拍板：风格、体积、许可三方面均不划算。换模型代码改动为零（`avatarModelPrepare` 自动识别 jawOpen 并关闭覆盖层） |
| 长回复动作     | 按句切分 + 定时推进，**不依赖 TTS `onboundary`**  | `onboundary` 在静音模式/headless 下不可用；定时方案静音也能工作，且可测                                                   |
| emotion/action | 两条传输路径统一归一化                            | 避免非法值一路带进 store 再在 engine 里二次 warn                                                                          |
| i18n           | 不重建运行时 i18n，只做文档级双语                 | 抽象层已被有意删除（CHANGELOG 2.3.0），重建是倒退                                                                         |

---

## 七、明确不做的事

避免范围蔓延，以下不在路线图内：

- **重建运行时 i18n / 多语言切换** —— 已删除的抽象，重建是倒退
- **引入 AI 工作流框架或生成的技能系统** —— AGENTS.md 明令禁止
- **文档化 Docker / Render / CLI 脚手架** —— 仓库已不含这些，AGENTS.md 禁止虚构
- **真实骨骼/blendshape 口型** —— 2026-09-02 拍板维持全息覆盖层，见 `feedback_avatar_style.md`
- **后端能力扩展**（多轮记忆、RAG、工具调用）—— 后端仅为可选参考实现，前端才是本项目
- **追求 100% 测试覆盖率** —— 展示类组件（落地页、装饰件）覆盖到 40% 即可
- ** Pages 做更新日志浏览** —— AGENTS.md 规定 Pages 聚焦产品与文档

---

## 八、推进建议

1. **先清债再优化** —— Phase 0 的 flaky 测试和体积门禁是后续所有验收的前提
2. **Phase 1 优先于一切** —— 首屏 −71% 是投入产出比最高的一项，且已实测验证
3. **文档与代码同步** —— Phase 2 的 `docs/protocol.md` 应在 Phase 3 改 `transports.ts` 之前写，避免文档追着代码跑
4. **每个 Phase 结束打 tag** —— 版本从 `v0.1.x` 起算（旧 `v2.x` 命名不恢复）
