# MetaHuman 数字人引擎

浏览器里的 3D 数字人，能听、能说、能对话。零配置，离线可用。

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

打开 http://localhost:5173，无需 API Key，自动降级到本地模拟。

可选后端：`examples/backend-python/` 有 FastAPI 参考实现。

## 功能

- **3D 形象** — GLB/GLTF 模型或内置程序化形象，情绪驱动表情，骨骼动画
- **语音交互** — 浏览器原生 TTS + ASR（ASR 仅 Chrome/Edge），嘴型同步
- **对话** — HTTP/SSE 双传输，流式响应，端点故障切换，离线降级
- **角色预设** — 4 种内置角色，运行时切换
- **自定义模型** — 上传 GLB 替换默认形象

## 浏览器支持

| 功能         | Chrome / Edge | Firefox | Safari |
| ------------ | :-----------: | :-----: | :----: |
| 核心 + TTS   |      ✅       |   ✅    |   ✅   |
| ASR 语音识别 |      ✅       |   ❌    |   ❌   |

## 贡献

架构、目录结构、开发命令见 [AGENTS.md](AGENTS.md)。遵循 Conventional Commits，保持 `master` 分支。

## 许可证

[MIT](LICENSE) © LessUp
