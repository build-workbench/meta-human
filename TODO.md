# TODO

数字人后续完善清单（2026-09-01 记录）。按优先级排序，完成一项勾一项。

## P1 性能优化（纯前端，零风险）

- [ ] **WebGL DPR 动态上限** — `DigitalHumanViewer.tsx` 的 `<Canvas dpr={[1, 2]}>`：高分屏 2x 全量渲染开销大，可降到 `[1, 1.5]` 或按设备动态。gl 选项 `powerPreference: 'high-performance'` 可保留。
- [ ] **标签页不可见时暂停渲染循环** — 现在 `ModelAvatar`/`CyberAvatar` 有 `useIsTabVisibleRef` 跳过逻辑，但 Canvas 渲染循环仍在跑。可在 `DigitalHumanViewer` 里根据可见性切换 `frameloop`（`'always'` ↔ `'demand'`），或 `gl.setAnimationLoop(null)`。
- [ ] **释放 AnimationMixer 缓存** — `ModelAvatar` 卸载时已 `stopAllAction + uncacheRoot`；确认切模型（custom↔builtin）时旧 mixer 是否完全释放，`actionsRef` 中的 `AnimationAction` 是否需要显式 `mixer.uncacheClip`。

## P2 后端情绪/动作协议（前端侧补齐）

- [ ] **流式回复的 emotion/action 解析链路** — 后端 `===META===` 段已约定携带 `emotion`/`action` JSON（见 CHANGELOG「真流式对话」），`handleDialogueResponse` 已支持读取，但当前后端返回 `neutral`/`idle`。前端侧确认流式 transport 是否正确解析 META 段并填充 `ChatResponsePayload.emotion/action`，后端加字段后可直接生效。
- [ ] **本地情绪启发式兜底已上线** — `src/core/avatar/emotionHeuristics.ts`（`?`→surprised / 负面词→sad / 正面词→happy），后端标签优先。若后端协议落地，可评估该兜底是否需要收窄。

## P3 换模型实现真口型（需用户拍板）

- [ ] **RobotExpressive 无嘴部几何**，当前全息嘴覆盖层（`ModelAvatar` 的 `faceAnchor` + 发光嘴）是视觉模拟。
- [ ] 要驱动模型自身骨骼/形变口型需换带 **ARKit blendshape（jawOpen 等）** 的模型（如 Ready Player Me 导出 GLB）。卡点：**许可核实**（RPM 分发条款）与体积（几 MB vs 453KB）。上传链路已就绪——带 jawOpen 的模型会被 `avatarModelPrepare` 自动识别并走真 morph、覆盖层自动关闭。

## 场景化表现（依赖 P2 的 action/emotion）

- [ ] 开场 Wave 欢迎（已完成）
- [ ] 提问时 think 姿态（已完成）
- [ ] 答对/答错情绪反应 — 后端 `action`/`emotion` 驱动，如 excited/sad 时的肢体动作
- [ ] 长回答分段肢体动作 — 长回复按句切分触发不同 action

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
