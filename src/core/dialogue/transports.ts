/**
 * 聊天传输层：HTTP 与 SSE 两种 ChatTransport 实现。
 *
 * 传输对象在调用时延迟解析 dialogueService 的 sendUserInput/streamUserInput，
 * 因此与 dialogueService 之间的循环 import 依赖是安全的（live binding）。
 */
import type {
  ChatRequestPayload,
  ChatTransportMode,
  DialogueServiceConfig,
  DialogueServiceResult,
  StreamCallbacks,
} from './dialogueService';
import { sendUserInput, streamUserInput } from './dialogueService';

export interface ChatTransport {
  mode: 'http' | 'sse';
  send: (
    payload: ChatRequestPayload,
    config?: DialogueServiceConfig,
    signal?: AbortSignal,
  ) => Promise<DialogueServiceResult>;
  stream: (
    payload: ChatRequestPayload,
    config?: DialogueServiceConfig,
    callbacks?: StreamCallbacks,
    signal?: AbortSignal,
  ) => AsyncGenerator<string, DialogueServiceResult, unknown>;
}

export const httpChatTransport: ChatTransport = {
  mode: 'http',
  send(payload, config, signal) {
    return sendUserInput(payload, config, signal);
  },
  async *stream(payload, config = {}, callbacks = {}, signal?) {
    const result = await sendUserInput(payload, config, signal);
    if (result.connectionStatus === 'connected') callbacks.onConnected?.();
    if (result.error) callbacks.onError?.(result.error);
    callbacks.onDone?.(result.response);
    if (result.response.replyText) yield result.response.replyText;
    return result;
  },
};

export const sseChatTransport: ChatTransport = {
  mode: 'sse',
  send(payload, config, signal) {
    return sendUserInput(payload, config, signal);
  },
  stream(payload, config, callbacks, signal) {
    return streamUserInput(payload, config, callbacks, signal);
  },
};

export function getPreferredChatTransportMode(): ChatTransportMode {
  const raw = import.meta.env.VITE_CHAT_TRANSPORT;
  if (!raw) return 'auto';
  const mode = raw.toLowerCase();
  return mode === 'http' || mode === 'sse' ? mode : 'auto';
}
