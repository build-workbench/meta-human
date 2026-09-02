/**
 * 对话服务瘦入口。
 *
 * 保留公共类型与函数式 API（sendUserInput/streamUserInput/checkServerHealth/
 * clearRemoteSession/getDefaultChatTransport），并通过模块级 `defaultRouting`
 * 懒单例承载路由状态。原有模块级可变 `endpointRouter`/`transportOverride`
 * 已收进 DialogueRouting 实例。
 */
import { sleep } from '@/lib/utils';
import { loggers } from '@/lib/logger';
import {
  normalizeAvatarAction,
  normalizeAvatarEmotion,
  type EmotionType,
} from '@/core/avatar/avatarContract';

import {
  fetchWithTimeout,
  sendDialogueHttpRequest,
  sendDialogueStreamRequest,
  classifyAttemptError,
  parseApiEndpoints,
  validateApiUrl,
  getLatestUserMessage,
  DialogueApiError,
} from './httpClient';
import type { ChatTransport } from './transports';
import { DialogueRouting } from './dialogueRouting';

const logger = loggers.dialogue;

// ============================================================================
// Types
// ============================================================================

export type DialogueMessageRole = 'system' | 'user' | 'assistant';

export interface DialogueMessage {
  role: DialogueMessageRole;
  content: string;
}

export interface ChatRequestPayload {
  sessionId?: string;
  userText: string;
  meta?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  context?: Record<string, unknown>;
  messages?: DialogueMessage[];
}

export interface ChatResponsePayload {
  replyText: string;
  emotion: EmotionType;
  action: string;
}

export interface DialogueServiceResult {
  response: ChatResponsePayload;
  connectionStatus: 'connected' | 'error';
  error: string | null;
}

export interface DialogueServiceConfig {
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
  endpoint?: string;
}

export interface StreamCallbacks {
  onConnected?: () => void;
  onError?: (message: string) => void;
  onDone?: (response: ChatResponsePayload) => void;
  /**
   * 流在 yield 过部分 token 后失败并即将重试/降级时触发。
   * 调用方应丢弃已累计的部分文本，避免与新请求的内容拼接出重复回复。
   */
  onRetry?: () => void;
}

export type ChatTransportMode = 'auto' | 'http' | 'sse';

// ============================================================================
// Re-exports (public API surface consumed outside this module)
// ============================================================================

export { DialogueApiError } from './httpClient';
export type { ChatTransport } from './transports';
export { getPreferredChatTransportMode } from './transports';
export { evaluateConnectionRecovery } from './connectionRecovery';
export type { DialogueTurnSnapshot } from './dialogueTurnSnapshot';
export { createIdleDialogueTurnSnapshot } from './dialogueTurnSnapshot';

// ============================================================================
// Default routing singleton (lazy)
// ============================================================================

const ORIGINAL_API_BASE_URL = validateApiUrl(
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
);
const ORIGINAL_API_BASE_FALLBACKS = import.meta.env.VITE_API_BASE_URL_FALLBACKS || '';
const API_BASE_URLS = parseApiEndpoints(ORIGINAL_API_BASE_URL, ORIGINAL_API_BASE_FALLBACKS);

/**
 * 模块级懒路由单例。这是必要的，因为 SettingsDrawer/ServicesProvider/
 * useConnectionHealth 直接 import 函数式 API。可通过 configureDialogueRouting
 * 注入实例（由 createServices 提供）。
 */
let defaultRouting: DialogueRouting | null = null;

function createDefaultRouting(): DialogueRouting {
  return new DialogueRouting(API_BASE_URLS);
}

/**
 * 创建基于初始环境变量的默认 DialogueRouting 实例，
 * 供 createServices 注入使用。
 */
export function createDefaultDialogueRouting(): DialogueRouting {
  return createDefaultRouting();
}

function getRouting(): DialogueRouting {
  if (!defaultRouting) {
    defaultRouting = createDefaultRouting();
  }
  return defaultRouting;
}

/**
 * 注入 DialogueRouting 实例（由 createServices 调用）。
 * 未注入时使用懒默认实例。
 */
export function configureDialogueRouting(routing: DialogueRouting | null): void {
  defaultRouting = routing;
}

// ============================================================================
// Service configuration
// ============================================================================

const DEFAULT_CONFIG: Required<Omit<DialogueServiceConfig, 'endpoint'>> = {
  maxRetries: 3,
  retryDelay: 1000,
  timeout: 15000,
};

const HEALTH_CHECK_TIMEOUT_MS = 5000;
const SESSION_DELETE_TIMEOUT_MS = 5000;
// 流式 body 单次 read 的空闲上限。SSE 正常会持续产出 token/心跳；
// 超过此间隔无任何字节视为连接停摆。
const STREAM_IDLE_TIMEOUT_MS = 30000;

// ============================================================================
// Payload normalization & response helpers
// ============================================================================

export function normalizeDialogueRequestPayload(payload: ChatRequestPayload): ChatRequestPayload {
  const userText = payload.userText.trim() || getLatestUserMessage(payload.messages);
  const messages =
    payload.messages && payload.messages.length > 0
      ? payload.messages
      : userText
        ? [{ role: 'user' as const, content: userText }]
        : undefined;

  const metadata = {
    ...(payload.metadata ?? payload.meta ?? {}),
    ...(payload.context ? { context: payload.context } : {}),
  };
  const normalizedMetadata = Object.keys(metadata).length > 0 ? metadata : undefined;

  return { ...payload, userText, messages, metadata: normalizedMetadata, meta: normalizedMetadata };
}

function buildEmptyResponse(): ChatResponsePayload {
  return { replyText: '', emotion: 'neutral', action: 'idle' };
}

/**
 * 从一个 SSE 事件块中提取 data 负载。
 *
 * 兼容标准 SSE 格式：块内可含 `event:`/`id:`/注释等字段行（一律忽略），
 * 多行 `data:` 按规范以换行拼接；`data:` 后允许无空格。
 */
function extractSSEData(block: string): string | null {
  const dataParts: string[] = [];
  for (const line of block.split('\n')) {
    if (!line.startsWith('data:')) continue;
    dataParts.push(line.slice(5).replace(/^ /, ''));
  }
  if (dataParts.length === 0) return null;
  const joined = dataParts.join('\n').trim();
  return joined || null;
}

function getFallbackResponse(userText: string): ChatResponsePayload {
  const lower = userText.toLowerCase();
  const chineseGreetings = ['你好', '您好', '嗨'];
  const englishGreetings = ['hello', 'hi'];
  const isGreeting =
    chineseGreetings.some((g) => userText.includes(g)) ||
    englishGreetings.some((g) => new RegExp(`\\b${g}\\b`).test(lower));
  if (isGreeting) {
    return {
      replyText: '您好！很高兴见到您。由于网络问题，我目前处于离线模式，但仍然可以进行简单的交互。',
      emotion: 'happy',
      action: 'wave',
    };
  }
  return {
    replyText: '抱歉，我暂时无法连接到服务器。请检查网络连接后重试，或者稍后再来。',
    emotion: 'neutral',
    action: 'idle',
  };
}

// ============================================================================
// Transport routing public API
// ============================================================================

export function getDefaultChatTransport(): ChatTransport {
  return getRouting().getTransport();
}

export function applyRuntimeApiEndpoints(baseUrl: string, fallbacks: string = ''): void {
  getRouting().applyEndpoints(baseUrl, fallbacks);
}

export function resetRuntimeApiEndpoints(): void {
  getRouting().applyEndpoints(ORIGINAL_API_BASE_URL, ORIGINAL_API_BASE_FALLBACKS);
}

export function resetDialogueServiceRoutingForTests(): void {
  defaultRouting = null;
}

// ============================================================================
// Public API: health check, session cleanup, send, stream
// ============================================================================

export async function checkServerHealth(): Promise<boolean> {
  const routing = getRouting();
  for (const endpoint of routing.getCandidates()) {
    try {
      const response = await fetchWithTimeout(
        `${endpoint}/health`,
        { method: 'GET' },
        HEALTH_CHECK_TIMEOUT_MS,
      );
      if (response.ok) {
        routing.reportSuccess(endpoint);
        return true;
      }
      routing.reportFailure(endpoint);
    } catch {
      routing.reportFailure(endpoint);
    }
  }
  return false;
}

export async function clearRemoteSession(sessionId: string): Promise<void> {
  if (!sessionId) return;
  try {
    await fetchWithTimeout(
      `${getRouting().selectPrimary()}/v1/session/${encodeURIComponent(sessionId)}`,
      { method: 'DELETE' },
      SESSION_DELETE_TIMEOUT_MS,
    );
  } catch {
    // Best-effort cleanup.
  }
}

export async function sendUserInput(
  payload: ChatRequestPayload,
  config: DialogueServiceConfig = {},
  signal?: AbortSignal,
): Promise<DialogueServiceResult> {
  const routing = getRouting();
  const normalized = normalizeDialogueRequestPayload(payload);
  const { maxRetries, retryDelay, timeout, endpoint } = { ...DEFAULT_CONFIG, ...config };
  let lastError: Error | null = null;

  attemptLoop: for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (signal?.aborted) {
      return { response: buildEmptyResponse(), connectionStatus: 'error', error: '请求被取消' };
    }

    const candidates = routing.getCandidates(endpoint);
    for (let ci = 0; ci < candidates.length; ci++) {
      const candidate = candidates[ci];
      try {
        const response = await sendDialogueHttpRequest(normalized, {
          endpoint: candidate,
          timeout,
          signal,
        });
        routing.reportSuccess(candidate);
        return { response, connectionStatus: 'connected', error: null };
      } catch (error: unknown) {
        const { decision, lastError: err } = classifyAttemptError(
          error,
          signal,
          candidate,
          ci,
          candidates.length,
          attempt,
          maxRetries,
          (ep) => routing.reportFailure(ep),
        );
        lastError = err;
        if (decision === 'abort') {
          return { response: buildEmptyResponse(), connectionStatus: 'error', error: '请求被取消' };
        }
        if (decision === 'next-candidate') continue;
        if (decision === 'fail') break attemptLoop;
        await sleep(retryDelay * (attempt + 1));
        continue attemptLoop;
      }
    }
  }

  logger.error('对话服务所有重试都失败:', lastError);
  return {
    response: getFallbackResponse(normalized.userText),
    connectionStatus: 'error',
    error: lastError?.message || '对话服务不可用',
  };
}

export async function* streamUserInput(
  payload: ChatRequestPayload,
  config: DialogueServiceConfig = {},
  callbacks: StreamCallbacks = {},
  signal?: AbortSignal,
): AsyncGenerator<string, DialogueServiceResult, unknown> {
  const routing = getRouting();
  const normalized = normalizeDialogueRequestPayload(payload);
  const { timeout, maxRetries, retryDelay, endpoint } = { ...DEFAULT_CONFIG, ...config };

  let finalResponse: ChatResponsePayload | null = null;
  let streamError: string | null = null;
  let lastError: Error | null = null;
  // 是否已向调用方 yield 过 token：中途失败重试时须通知调用方丢弃已累计文本。
  let hasYieldedTokens = false;

  if (signal?.aborted) {
    return { response: buildEmptyResponse(), connectionStatus: 'error', error: '请求被取消' };
  }

  attemptLoop: for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (signal?.aborted) {
      return { response: buildEmptyResponse(), connectionStatus: 'error', error: '请求被取消' };
    }

    const candidates = routing.getCandidates(endpoint);
    for (let ci = 0; ci < candidates.length; ci++) {
      const candidate = candidates[ci];
      try {
        const response = await sendDialogueStreamRequest(normalized, {
          endpoint: candidate,
          timeout,
          signal,
        });
        routing.reportSuccess(candidate);
        callbacks.onConnected?.();

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        try {
          while (true) {
            if (signal?.aborted) {
              reader.cancel().catch(() => undefined);
              return {
                response: finalResponse ?? buildEmptyResponse(),
                connectionStatus: 'error',
                error: '请求被取消',
              };
            }
            // 流式 body 阶段没有 HTTP 层超时（fetch 超时只覆盖到响应头），
            // 单次 read() 挂起会永久卡住整轮对话。对每次 read 加空闲超时，
            // 超时按可重试错误处理，走既有重试/故障转移/降级路径。
            const readResult = await Promise.race([
              reader.read(),
              sleep(STREAM_IDLE_TIMEOUT_MS).then(() => 'timeout' as const),
            ]);
            if (readResult === 'timeout') {
              reader.cancel().catch(() => undefined);
              throw new DialogueApiError('流式响应超时', 408, true);
            }
            const { done, value } = readResult;
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            // 兼容 CRLF 行尾：某些代理/服务器会改写为 \r\n\r\n。
            const blocks = buffer.replace(/\r\n/g, '\n').split('\n\n');
            buffer = blocks.pop() || '';
            for (const block of blocks) {
              const raw = extractSSEData(block);
              if (!raw) continue;
              try {
                const event = JSON.parse(raw);
                if (event.type === 'token' && event.content) {
                  hasYieldedTokens = true;
                  yield event.content;
                } else if (event.type === 'error') {
                  streamError = event.message || '流式响应错误';
                } else if (event.type === 'done') {
                  finalResponse = {
                    replyText: event.replyText ?? '',
                    emotion: normalizeAvatarEmotion(event.emotion ?? 'neutral') as EmotionType,
                    action: normalizeAvatarAction(event.action ?? 'idle'),
                  };
                  callbacks.onDone?.(finalResponse);
                }
              } catch {
                logger.warn('SSE 事件解析失败:', raw);
              }
            }
          }
        } finally {
          reader.releaseLock();
        }

        if (streamError) callbacks.onError?.(streamError);
        if (!finalResponse) finalResponse = buildEmptyResponse();
        return {
          response: finalResponse,
          connectionStatus: streamError ? 'error' : 'connected',
          error: streamError,
        };
      } catch (error: unknown) {
        const { decision, lastError: err } = classifyAttemptError(
          error,
          signal,
          candidate,
          ci,
          candidates.length,
          attempt,
          maxRetries,
          (ep) => routing.reportFailure(ep),
        );
        lastError = err;
        if (decision === 'abort') {
          return {
            response: finalResponse ?? buildEmptyResponse(),
            connectionStatus: 'error',
            error: '请求被取消',
          };
        }
        if (decision === 'fail') break attemptLoop;
        // 重试/故障转移前：若已 yield 过 token，通知调用方丢弃累计文本，
        // 避免新旧请求的内容拼接出重复回复。
        if (hasYieldedTokens) {
          hasYieldedTokens = false;
          streamError = null;
          callbacks.onRetry?.();
        }
        if (decision === 'next-candidate') continue;
        await sleep(retryDelay * (attempt + 1));
        continue attemptLoop;
      }
    }
  }

  logger.warn('流式请求失败，降级到普通请求:', lastError);
  if (hasYieldedTokens) callbacks.onRetry?.();
  const fallback = await sendUserInput(normalized, { ...config, endpoint }, signal);
  if (fallback.response.replyText) yield fallback.response.replyText;
  return {
    ...fallback,
    connectionStatus: fallback.connectionStatus === 'error' ? 'error' : 'connected',
  };
}
