# TODO

数字人后续完善清单（2026-09-01 记录）。按优先级排序，完成一项勾一项。

## P1 性能优化（纯前端，零风险）

- [x] **WebGL DPR 动态上限** — `DigitalHumanViewer.tsx` 的 `<Canvas dpr={[1, 2]}>`：高分屏 2x 全量渲染开销大，可降到 `[1, 1.5]` 或按设备动态。gl 选项 `powerPreference: 'high-performance'` 可保留。
- [x] **标签页不可见时暂停渲染循环** — 现在 `ModelAvatar`/`CyberAvatar` 有 `useIsTabVisibleRef` 跳过逻辑，但 Canvas 渲染循环仍在跑。可在 `DigitalHumanViewer` 里根据可见性切换 `frameloop`（`'always'` ↔ `'demand'`），或 `gl.setAnimationLoop(null)`。本轮用 `frameloop={isTabVisible ? 'always' : 'never'}`，比 demand 更彻底。
- [x] **释放 AnimationMixer 缓存** — 修复：同组件复用（custom↔builtin 都是 model 时 ModelAvatar 不卸载）导致 `actionsRef` 中绑旧 mixer 的僵尸 action 残留，会与程序化旋转打架。清理 effect 改为先 `uncacheClip` 每个 action，再 `clear()` + `stopAllAction` + `uncacheRoot`；同时 `if (!clip) return` 早返回导致 wave→think 时旧 action 不 fadeOut 的回归也修了。
- [x] **控制台警告清理** — `<Canvas shadows>` 默认 PCFSoftShadowMap 在 three 0.185 弃用，改 `shadows="percentage"`（映射 PCFShadowMap）。视觉差异由 ContactShadows 主导可忽略。

## P2 后端情绪/动作协议（前端侧补齐）

- [x] **流式回复的 emotion/action 解析链路** — 后端 `===META===` 段已约定携带 `emotion`/`action` JSON（见 CHANGELOG「真流式对话」），`handleDialogueResponse` 已支持读取，但当前后端返回 `neutral`/`idle`。前端侧确认流式 transport 是否正确解析 META 段并填充 `ChatResponsePayload.emotion/action`，后端加字段后可直接生效。本轮已验证链路通（mock 后端 done 事件 → `setEmotion` + `playAnimation` 生效），并修复了两条传输路径的归一化不一致：HTTP 的 `parseChatResponse` 原本直接 `as EmotionType` 强转、完全不校验 action，非法值会一路带进 store 再在 `DigitalHumanEngine` 里 warn 一次；现统一走 `normalizeAvatarEmotion` / `normalizeAvatarAction`，与 SSE 的 done 事件对齐。
- [ ] **本地情绪启发式兜底已上线** — `src/core/avatar/emotionHeuristics.ts`（`?`→surprised / 负面词→sad / 正面词→happy），后端标签优先。若后端协议落地，可评估该兜底是否需要收窄。

## P3 换模型实现真口型 — 【暂不实施，2026-09-02 拍板】

- [x] **决策：维持 RobotExpressive + 全息嘴覆盖层不变。**
      理由：① 写实 RPM 形象与现有「极简科技感 + 全息材质」风格冲突；② 体积从 453KB 涨到几 MB；③ RPM 分发条款未拿到确凿依据（官方文档页被网络策略拦截，只搜到中文教程）。
- [x] **RobotExpressive 无嘴部几何**，当前全息嘴覆盖层（`ModelAvatar` 的 `faceAnchor` + 发光嘴）是视觉模拟 — 保留。
- [x] **换模型的代码改动量已核实为零**：`avatarModelPrepare.ts:33` 的 mouth 通道候选名是 `['jawopen','mouthopen','mouth_open']`，`ModelAvatar.tsx:216` 的 `{!model.morphs.mouth && model.faceAnchor && ...}` 会在探测到真 mouth morph 时自动关闭覆盖层。将来若要换，只需替换 GLB 资源 + 走上传链路，无需改代码。
- 备选调研记录：`arkit-face-blendshapes.com`（VRoid + ARKit blendshapes）是 **VRM 格式**而非纯 GLB，需额外加载器，且 VRoid 有独立使用条款，不适配当前架构。

## 场景化表现（依赖 P2 的 action/emotion）

- [x] 开场 Wave 欢迎（已完成）
- [x] 提问时 think 姿态（已完成）
- [x] 答对/答错情绪反应 — 后端 `action`/`emotion` 驱动，如 excited/sad 时的肢体动作
- [x] 长回答分段肢体动作 — `src/core/avatar/speechActionPlanner.ts` 按句末标点切分回复，按字数估算每句触发时刻，逐句驱动 `playAnimation`（问句→think / 否定→shakeHead / 感叹→nod / 默认轮转 nod↔greet）。单句短回复完全不动，保持原有单次动作。新一轮调度前自动取消旧定时器，`cancelPendingTurn` 也清理。运行时验证 70 字回复播报期间行为持续变化（idle→greeting→listening→thinking→idle→listening）。

## 已归档（完成项，勿重复做）

- [x] 内置 3D 头像（CC0 RobotExpressive + 全息材质 + morph 自动探测）— v0.1.0
- [x] 活力增强：思考/说话联动、全息呼吸、入场显现、欢迎动作
- [x] 地面全息投影环 + ContactShadows 地面高度修正
- [x] 情绪自动机（本地兜底）
- [x] 注视相机
- [x] 真口型降级（全息嘴覆盖层）
- [x] 日志修复：manifest 路径 404、CSP 无效指令
- [x] 自托管字体接线（Resource Han Rounded CN + Code New Roman）
- [x] 技能安装：wsl-capture / shotframe / archify
- [x] P1 性能与控制台警告（详见 P1 段三条 + shadows 警告）

## 跟踪项

- [ ] `THREE.Clock` 弃用警告 — 来源 R3F 内部 `new THREE.Clock()`（`events-*.esm.js:1016`），需 R3F 18 升级到 `THREE.Timer`。本仓不降 three、不改 R3F 内部，先记账。
