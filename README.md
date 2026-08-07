# MetaHuman Engine

浏览器里的 3D 数字人。能听、能说、能对话，零配置即可运行。

[![CI](https://img.shields.io/github/actions/workflow/status/vibe-knight/meta-human/ci.yml?branch=master&label=CI&style=flat-square)](https://github.com/vibe-knight/meta-human/actions)
[![Demo](https://img.shields.io/badge/Demo-在线-green?style=flat-square&logo=githubpages)](https://vibe-knight.github.io/meta-human/)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

**[在线体验 →](https://vibe-knight.github.io/meta-human/)**

<p align="center">
  <img src="public/preview.svg" width="720" alt="MetaHuman Engine 预览" />
</p>

打开页面，一个赛博风格的 3D 数字人站在场景中央。你在底部输入框打字或按下麦克风说话，它会逐字回复你，说话时嘴巴跟着张合，语气带上表情和肢体动作。你也可以让它打招呼、跳舞、点头，或者换一套自己的 GLB 模型上去。

不需要后端、不需要 API Key，克隆下来就能跑。接入后端后解锁 LLM 对话。

## 特性

- **开箱即用** — 内置程序化 3D 形象，不依赖任何外部模型文件
- **流式对话** — 回复逐字输出，不用等整句生成完
- **表情联动** — 对话时数字人自动切换情绪、表情和肢体动作
- **嘴型同步** — TTS 朗读时嘴部实时张合
- **语音交互** — 支持语音输入（Chrome/Edge）和语音播报，可调语速、音调、音量
- **角色预设** — 4 种人设一键切换，活泼助手、严肃顾问、可爱伙伴、专业客服
- **自定义形象** — 上传 GLB/GLTF 模型替换默认形象，加载失败自动回退
- **离线可用** — 无后端时本地模拟回复，所有功能不受影响

## 快速开始

```bash
git clone https://github.com/vibe-knight/meta-human.git
cd meta-human
npm install
npm run dev
```

打开 http://localhost:5173，直接开始对话。

## 接入后端

前端自带模拟回复，接后端可以获得真实的 LLM 对话能力。`examples/backend-python/` 有一个 FastAPI 参考实现：

```bash
cd examples/backend-python
pip install -r requirements.txt
uvicorn app.main:app --reload
```

- 不配 `OPENAI_API_KEY` 也能跑，走关键词匹配
- 配了 Key 就接入 OpenAI 兼容 API，支持流式输出
- 前端在设置面板填后端地址，或写进 `VITE_API_BASE_URL` 环境变量

## 浏览器兼容

| 能力                 | Chrome / Edge | Firefox | Safari |
| -------------------- | :-----------: | :-----: | :----: |
| 3D 渲染 + 对话 + TTS |      ✅       |   ✅    |   ✅   |
| ASR 语音识别         |      ✅       |   ❌    |   ❌   |

## 开发

```bash
npm run typecheck    # 类型检查
npm run lint         # ESLint
npm run test:run     # Vitest 全量测试
npm run build        # 生产构建
```

架构分层、目录职责、贡献规则见 [AGENTS.md](AGENTS.md)。

## 许可证

[MIT](LICENSE) © LessUp
