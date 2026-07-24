# MetaHuman 后端参考实现（FastAPI）

为前端 `src/core/dialogue/dialogueService.ts` 提供**对话与 SSE 流式**接口的可选 Python 后端。

> 前端默认零配置：未部署本后端时自动降级到本地 Mock 模式。前端 TTS/ASR 走浏览器 Web Speech API，**不依赖**本后端的 `/v1/tts`、`/v1/asr`——它们是后端独立提供的能力，可按需使用。

## 运行

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # 填 OPENAI_API_KEY；留空则进入 Mock 模式
uvicorn app.main:app --reload --port 8000
```

启动后访问 `http://localhost:8000/docs` 查看完整 OpenAPI 文档。

**Mock 模式**：未配置 `OPENAI_API_KEY` 时，后端用本地智能回复（基于关键词匹配），便于无 Key 开发与前端联调。

## 端点

| Method | Path                       | 功能                             | 前端使用 |
| :----- | :------------------------- | :------------------------------- | :------: |
| GET    | `/`                        | 服务信息与端点清单               |    —     |
| GET    | `/health`                  | 健康检查（uptime、各服务可用性） |    —     |
| POST   | `/v1/chat`                 | 同步对话                         |    ✅    |
| POST   | `/v1/chat/stream`          | SSE 流式对话                     |    ✅    |
| GET    | `/v1/sessions`             | 列出活跃会话                     |    ✅    |
| GET    | `/v1/session/{id}/history` | 会话历史                         |    ✅    |
| DELETE | `/v1/session/{id}`         | 清除会话历史                     |    ✅    |
| POST   | `/v1/tts`                  | 文字转语音（音频流）             |    ❌    |
| GET    | `/v1/tts/voices`           | 可用 TTS 语音列表                |    ❌    |
| POST   | `/v1/asr`                  | 语音识别（Whisper API）          |    ❌    |
| GET    | `/v1/asr/status`           | ASR 服务状态                     |    ❌    |

## 与前端对接契约

### `POST /v1/chat`

请求体（`userText` 与 `messages` 至少传其一）：

```json
{
  "sessionId": "string | null",
  "userText": "你好",
  "messages": [{ "role": "user", "content": "你好" }],
  "meta": { "characterId": "lively-assistant" }
}
```

响应：

```json
{
  "replyText": "您好！很高兴见到您。",
  "emotion": "happy",
  "action": "wave"
}
```

- `emotion`：`neutral` | `happy` | `surprised` | `sad` | `angry`
- `action`：`idle` | `wave` | `greet` | `think` | `nod` | `shakeHead` | `dance` | `speak`
- `meta.characterId`：角色预设，见 `app/services/dialogue.py` 的 `CHARACTER_PROMPTS`（前端仅传 ID，后端控制 system prompt，避免注入）。

### `POST /v1/chat/stream`（SSE）

请求体同上。响应 `Content-Type: text/event-stream`，每行 `data: {json}`，事件类型：

| 事件                                                               | 说明                                     |
| :----------------------------------------------------------------- | :--------------------------------------- |
| `{"type":"token","content":"..."}`                                 | 逐块文本（真流式，按 LLM 分块）          |
| `{"type":"done","replyText":"...","emotion":"...","action":"..."}` | 完成                                     |
| `{"type":"error","message":"..."}`                                 | 错误（随后仍发一个 done 携带 Mock 回复） |

流式协议：LLM 先输出 `replyText` 纯文本，新起一行以 `===META===` 标记携带 `{"emotion","action"}` JSON，后端据此分离文本与驱动元数据。

> 前端消费方：`src/core/dialogue/dialogueService.ts`（`ChatRequestPayload` 只用 `userText`/`sessionId`/`meta`）。

## 环境变量

见 `.env.example`。关键项：

| 变量                          | 默认                        | 说明                                                    |
| :---------------------------- | :-------------------------- | :------------------------------------------------------ |
| `OPENAI_API_KEY`              | 空                          | 留空则 Mock 模式                                        |
| `OPENAI_MODEL`                | `gpt-4o-mini`               | LLM 模型                                                |
| `OPENAI_BASE_URL`             | `https://api.openai.com/v1` | 需以 `/v1` 结尾                                         |
| `TTS_PROVIDER`                | `edge`                      | `edge`（edge-tts）或 `openai`                           |
| `ASR_PROVIDER`                | `whisper`                   | 仅 `whisper`（OpenAI Whisper API）                      |
| `DIALOGUE_MAX_HISTORY_LENGTH` | `20`                        | 历史截断阈值                                            |
| `RATE_LIMIT_RPM`              | `60`                        | 每 IP 每分钟请求上限                                    |
| `CORS_ALLOW_ORIGINS`          | `https://lessup.github.io`  | 逗号分隔；留空则用默认 dev+Pages 白名单                 |
| `AUTH_ENABLED` / `API_KEYS`   | `false` / 空                | 启用后需 `X-API-Key` 头（`/health`、`/`、`/docs` 豁免） |

## 测试

```bash
pytest tests/    # 需已安装 requirements.txt
```

- `test_dialogue_service.py` / `test_dialogue_service_extended.py`：`DialogueService` 单元测试（mock LLM，无网络）
- `test_api.py`：API 集成测试（`TestClient`）

## 目录结构

```
app/
├── main.py            应用入口、中间件、路由挂载
├── config.py          环境变量集中读取（@dataclass + lru_cache）
├── exceptions.py      统一异常体系
├── middleware.py      异常处理 / 限速 / 日志 / API Key 认证
├── api/               路由：chat、session、speech
├── services/          dialogue（核心）、tts、asr
└── stores/            会话存储（SessionStore ABC + InMemory 实现）
```

## 不包含

按 AGENTS.md 护栏，本参考实现**不提供**：

- Docker / 部署脚本、CI 集成（前端 CI 不跑后端测试）
- 传递依赖锁文件（仅 `requirements.txt` 宽版本；如需可复现请自行 `pip-compile`）
- Redis 会话存储、本地 faster-whisper ASR、WebSocket 端点（均已移除：前端不使用，且无对应依赖）
