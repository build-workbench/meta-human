import { sleep } from '../../lib/utils';
import { loggers } from '../../lib/logger';
import type { EmotionType } from '../../store/digitalHumanStore';
import { useSystemStore } from '../../store/systemStore';
import { normalizeAvatarEmotion } from '../avatar/avatarContract';

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
}

export type ChatTransportMode = 'auto' | 'http' | 'sse';

export class DialogueApiError extends Error {
  status: number;
  isRetryable: boolean;

  constructor(message: string, status: number, isRetryable = false) {
    super(message);
    this.name = 'DialogueApiError';
    this.status = status;
    this.isRetryable = isRetryable;
  }
}

// ============================================================================
// Turn lifecycle (inlined from dialogueTurnLifecycle.ts)
// ============================================================================

export type {
  DialogueTurnStatus,
  DialogueTurnMode,
  DialogueTurnSnapshot,
} from './dialogueTurnSnapshot';
export { createIdleDialogueTurnSnapshot } from './dialogueTurnSnapshot';

// ============================================================================
// Endpoint parsing (inlined from endpointDiscovery.ts)
// ============================================================================

const ALLOWED_API_PROTOCOLS = ['http:', 'https:'];

function normalizeApiEndpoint(url: string): string | null {
  const normalized = url.trim().replace(/\/+$/, '');
  if (!normalized) return null;
  try {
    const parsed = new URL(normalized);
    if (!ALLOWED_API_PROTOCOLS.includes(parsed.protocol)) return null;
    return normalized;
  } catch {
    return null;
  }
}

export function parseApiEndpoints(primaryUrl: string, fallbackUrls = ''): string[] {
  const candidates = [primaryUrl, ...fallbackUrls.split(',')];
  const parsed = candidates
    .map((c) => normalizeApiEndpoint(c))
    .filter((c): c is string => c !== null);
  return Array.from(new Set(parsed));
}

// ============================================================================
// Endpoint router (inlined from dialogueEndpointRouter.ts)
// ============================================================================

class EndpointRouter {
  private readonly endpoints: string[];
  private activeEndpoint: string;

  constructor(endpoints: string[]) {
    const unique = Array.from(new Set(endpoints.filter(Boolean)));
    this.endpoints = unique.length > 0 ? unique : ['http://localhost:8000'];
    this.activeEndpoint = this.endpoints[0];
  }

  selectPrimary(): string {
    return this.activeEndpoint;
  }

  getCandidates(preferred?: string): string[] {
    if (preferred && this.endpoints.includes(preferred)) {
      return [preferred, ...this.endpoints.filter((e) => e !== preferred)];
    }
    return [this.activeEndpoint, ...this.endpoints.filter((e) => e !== this.activeEndpoint)];
  }

  reportSuccess(endpoint: string): { activeEndpoint: string; didFailover: boolean } {
    if (!this.endpoints.includes(endpoint)) {
      return { activeEndpoint: this.activeEndpoint, didFailover: false };
    }
    const didFailover = endpoint !== this.activeEndpoint;
    this.activeEndpoint = endpoint;
    return { activeEndpoint: this.activeEndpoint, didFailover };
  }

  reportFailure(endpoint: string): { activeEndpoint: string; didFailover: boolean } {
    if (endpoint !== this.activeEndpoint) {
      return { activeEndpoint: this.activeEndpoint, didFailover: false };
    }
    const next = this.endpoints.find((e) => e !== endpoint);
    if (!next) return { activeEndpoint: this.activeEndpoint, didFailover: false };
    this.activeEndpoint = next;
    return { activeEndpoint: this.activeEndpoint, didFailover: true };
  }

  reset(endpoint?: string): void {
    if (endpoint && this.endpoints.includes(endpoint)) {
      this.activeEndpoint = endpoint;
      return;
    }
    this.activeEndpoint = this.endpoints[0];
  }
}

// ============================================================================
// Payload normalization (inlined from dialoguePayload.ts)
// ============================================================================

function getLatestUserMessage(messages?: DialogueMessage[]): string {
  if (!messages || messages.length === 0) return '';
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') return messages[i].content.trim();
  }
  return '';
}

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

// ============================================================================
// HTTP client (inlined from dialogueHttpClient.ts)
// ============================================================================

export async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout: number,
  externalSignal?: AbortSignal,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  if (externalSignal?.aborted) {
    clearTimeout(timeoutId);
    throw new DOMException('The operation was aborted.', 'AbortError');
  }

  let abortHandler: (() => void) | null = null;
  if (externalSignal) {
    abortHandler = () => controller.abort();
    externalSignal.addEventListener('abort', abortHandler, { once: true });
  }

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
    if (abortHandler && externalSignal) {
      externalSignal.removeEventListener('abort', abortHandler);
    }
  }
}

function isRetryableStatus(status: number): boolean {
  return status >= 500 || status === 429 || status === 408;
}

function getErrorMessage(status: number, defaultMessage: string): string {
  const messages: Record<number, string> = {
    400: '请求格式错误，请重试',
    401: '认证失败，请刷新页面',
    403: '访问被拒绝',
    404: '服务不可用，请稍后重试',
    408: '请求超时，请重试',
    429: '请求过于频繁，请稍后重试',
    500: '服务器内部错误，请稍后重试',
    502: '网关错误，请稍后重试',
    503: '服务暂时不可用，请稍后重试',
    504: '网关超时，请稍后重试',
  };
  return messages[status] || defaultMessage;
}

export function normalizeDialogueError(error: unknown): Error {
  if (error instanceof DialogueApiError) return error;
  if (error instanceof DOMException && error.name === 'AbortError') {
    return new DialogueApiError('请求超时，请重试', 408, true);
  }
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return new DialogueApiError('网络连接失败，请检查网络', 0, true);
  }
  if (error instanceof Error) return error;
  return new Error(String(error));
}

function parseChatResponse(data: unknown): ChatResponsePayload {
  const r = (data as Partial<ChatResponsePayload>) || {};
  return {
    replyText: r.replyText ?? '',
    emotion: (r.emotion as EmotionType) ?? 'neutral',
    action: r.action ?? 'idle',
  };
}

export async function sendDialogueHttpRequest(
  payload: ChatRequestPayload,
  options: { endpoint: string; timeout: number; signal?: AbortSignal },
): Promise<ChatResponsePayload> {
  const response = await fetchWithTimeout(
    `${options.endpoint}/v1/chat`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    options.timeout,
    options.signal,
  );

  if (!response.ok) {
    throw new DialogueApiError(
      getErrorMessage(response.status, `服务错误: ${response.status}`),
      response.status,
      isRetryableStatus(response.status),
    );
  }

  return parseChatResponse(await response.json());
}

export async function sendDialogueStreamRequest(
  payload: ChatRequestPayload,
  options: { endpoint: string; timeout: number; signal?: AbortSignal },
): Promise<Response> {
  const response = await fetchWithTimeout(
    `${options.endpoint}/v1/chat/stream`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    options.timeout,
    options.signal,
  );

  if (!response.ok || !response.body) {
    throw new DialogueApiError(
      getErrorMessage(response.status, `流式服务错误: ${response.status}`),
      response.status,
      isRetryableStatus(response.status) || !response.body,
    );
  }

  return response;
}

// ============================================================================
// Chat transport (slimmed from chatTransport.ts — HTTP + SSE only, no WebSocket)
// ============================================================================

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

let transportOverride: ChatTransport | null = null;

export function getPreferredChatTransportMode(): ChatTransportMode {
  const raw = import.meta.env.VITE_CHAT_TRANSPORT;
  if (!raw) return 'auto';
  const mode = raw.toLowerCase();
  return mode === 'http' || mode === 'sse' ? mode : 'auto';
}

export function setChatTransportOverride(transport: ChatTransport | null): void {
  transportOverride = transport;
}

export function getChatTransport(
  mode: ChatTransportMode = getPreferredChatTransportMode(),
): ChatTransport {
  if (transportOverride) return transportOverride;
  if (mode === 'http') return httpChatTransport;
  return sseChatTransport;
}

export function getDefaultChatTransport(): ChatTransport {
  return getChatTransport();
}

// ============================================================================
// Connection recovery (inlined from connectionRecovery.ts)
// ============================================================================

export interface ConnectionRecoveryResult {
  status: 'connected' | 'disconnected' | 'error';
  checkedAt: number;
  latencyMs: number;
  degradedReason: string | null;
  transportMode: 'http' | 'sse' | null;
  transportIssue: string | null;
}

export async function evaluateConnectionRecovery(
  options: {
    unhealthyStatus: 'disconnected' | 'error';
    unhealthyReason: string;
    transportProbeFailureMessage: string;
    forceTransportProbe?: boolean;
  },
  dependencies: {
    checkServerHealth: () => Promise<boolean>;
    resolveTransportMode: (opts: { forceProbe: boolean }) => Promise<'http' | 'sse'>;
    performanceNow?: () => number;
    now?: () => number;
  },
): Promise<ConnectionRecoveryResult> {
  const startedAt = (dependencies.performanceNow ?? performance.now.bind(performance))();
  const isHealthy = await dependencies.checkServerHealth();
  const checkedAt = (dependencies.now ?? Date.now)();
  const latencyMs = Math.max(
    0,
    Math.round((dependencies.performanceNow ?? performance.now.bind(performance))() - startedAt),
  );

  if (!isHealthy) {
    return {
      status: options.unhealthyStatus,
      checkedAt,
      latencyMs,
      degradedReason: options.unhealthyReason,
      transportMode: null,
      transportIssue: null,
    };
  }

  try {
    const transportMode = await dependencies.resolveTransportMode({
      forceProbe: options.forceTransportProbe ?? false,
    });
    return {
      status: 'connected',
      checkedAt,
      latencyMs,
      degradedReason: null,
      transportMode,
      transportIssue: null,
    };
  } catch {
    return {
      status: 'connected',
      checkedAt,
      latencyMs,
      degradedReason: null,
      transportMode: null,
      transportIssue: options.transportProbeFailureMessage,
    };
  }
}

// ============================================================================
// Service configuration & routing state
// ============================================================================

function validateApiUrl(url: string): string {
  const normalized = url.replace(/\/+$/, '');
  try {
    new URL(normalized);
    return normalized;
  } catch {
    logger.error(`Invalid API URL: ${url}`);
    return 'http://localhost:8000';
  }
}

const API_BASE_URLS = parseApiEndpoints(
  validateApiUrl(import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'),
  import.meta.env.VITE_API_BASE_URL_FALLBACKS || '',
);
let endpointRouter = new EndpointRouter(API_BASE_URLS);

const DEFAULT_CONFIG: Required<Omit<DialogueServiceConfig, 'endpoint'>> = {
  maxRetries: 3,
  retryDelay: 1000,
  timeout: 15000,
};

const HEALTH_CHECK_TIMEOUT_MS = 5000;
const SESSION_DELETE_TIMEOUT_MS = 5000;

function recordRoutingState(activeEndpoint: string, didFailover = false): void {
  useSystemStore.getState().recordEndpointRouting({ activeEndpoint, didFailover });
}

function reportEndpointSuccess(endpoint: string): void {
  const r = endpointRouter.reportSuccess(endpoint);
  recordRoutingState(r.activeEndpoint, r.didFailover);
}

function reportEndpointFailure(endpoint: string): void {
  const r = endpointRouter.reportFailure(endpoint);
  if (r.didFailover) recordRoutingState(r.activeEndpoint, true);
}

function getEndpointCandidates(preferred?: string): string[] {
  return endpointRouter.getCandidates(preferred);
}

function isRetryableDialogueError(error: Error): boolean {
  return error instanceof DialogueApiError ? error.isRetryable : true;
}

type FailoverDecision = 'abort' | 'next-candidate' | 'retry' | 'fail';

function classifyAttemptError(
  error: unknown,
  signal: AbortSignal | undefined,
  candidate: string,
  ci: number,
  candidateCount: number,
  attempt: number,
  maxRetries: number,
): { decision: FailoverDecision; lastError: Error } {
  const normalizedError = normalizeDialogueError(error);
  if (signal?.aborted || shouldAbort(normalizedError, signal)) {
    return { decision: 'abort', lastError: normalizedError };
  }
  const retryable = isRetryableDialogueError(normalizedError);
  if (retryable) reportEndpointFailure(candidate);
  if (retryable && ci < candidateCount - 1)
    return { decision: 'next-candidate', lastError: normalizedError };
  if (!retryable || attempt >= maxRetries) return { decision: 'fail', lastError: normalizedError };
  return { decision: 'retry', lastError: normalizedError };
}

function shouldAbort(error: unknown, signal?: AbortSignal): boolean {
  return (
    signal?.aborted === true ||
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error &&
      error.message === '请求被取消' &&
      error instanceof DialogueApiError &&
      error.status === 408)
  );
}

function buildEmptyResponse(): ChatResponsePayload {
  return { replyText: '', emotion: 'neutral', action: 'idle' };
}

function getFallbackResponse(userText: string): ChatResponsePayload {
  const greetings = ['你好', '您好', 'hello', 'hi', '嗨'];
  const isGreeting = greetings.some((g) => userText.toLowerCase().includes(g));
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

export function resetDialogueServiceRoutingForTests(): void {
  endpointRouter = new EndpointRouter(API_BASE_URLS);
  endpointRouter.reset(API_BASE_URLS[0]);
}

export function applyRuntimeApiEndpoints(baseUrl: string, fallbacks: string = ''): void {
  const urls = parseApiEndpoints(baseUrl, fallbacks);
  if (urls.length > 0) endpointRouter = new EndpointRouter(urls);
}

export function resetRuntimeApiEndpoints(): void {
  endpointRouter = new EndpointRouter(API_BASE_URLS);
}

// ============================================================================
// Public API: health check, session cleanup, send, stream
// ============================================================================

export async function checkServerHealth(): Promise<boolean> {
  for (const endpoint of getEndpointCandidates()) {
    try {
      const response = await fetchWithTimeout(
        `${endpoint}/health`,
        { method: 'GET' },
        HEALTH_CHECK_TIMEOUT_MS,
      );
      if (response.ok) {
        reportEndpointSuccess(endpoint);
        return true;
      }
      reportEndpointFailure(endpoint);
    } catch {
      reportEndpointFailure(endpoint);
    }
  }
  return false;
}

export async function clearRemoteSession(sessionId: string): Promise<void> {
  if (!sessionId) return;
  try {
    await fetchWithTimeout(
      `${endpointRouter.selectPrimary()}/v1/session/${encodeURIComponent(sessionId)}`,
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
  const normalized = normalizeDialogueRequestPayload(payload);
  const { maxRetries, retryDelay, timeout, endpoint } = { ...DEFAULT_CONFIG, ...config };
  let lastError: Error | null = null;

  attemptLoop: for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (signal?.aborted) {
      return { response: buildEmptyResponse(), connectionStatus: 'error', error: '请求被取消' };
    }

    const candidates = getEndpointCandidates(endpoint);
    for (let ci = 0; ci < candidates.length; ci++) {
      const candidate = candidates[ci];
      try {
        const response = await sendDialogueHttpRequest(normalized, {
          endpoint: candidate,
          timeout,
          signal,
        });
        reportEndpointSuccess(candidate);
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
  const normalized = normalizeDialogueRequestPayload(payload);
  const { timeout, maxRetries, retryDelay, endpoint } = { ...DEFAULT_CONFIG, ...config };

  let finalResponse: ChatResponsePayload | null = null;
  let streamError: string | null = null;
  let lastError: Error | null = null;

  if (signal?.aborted) {
    return { response: buildEmptyResponse(), connectionStatus: 'error', error: '请求被取消' };
  }

  attemptLoop: for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const candidates = getEndpointCandidates(endpoint);
    for (let ci = 0; ci < candidates.length; ci++) {
      const candidate = candidates[ci];
      try {
        const response = await sendDialogueStreamRequest(normalized, {
          endpoint: candidate,
          timeout,
          signal,
        });
        reportEndpointSuccess(candidate);
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
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const raw = line.slice(6).trim();
              if (!raw) continue;
              try {
                const event = JSON.parse(raw);
                if (event.type === 'token' && event.content) {
                  yield event.content;
                } else if (event.type === 'error') {
                  streamError = event.message || '流式响应错误';
                } else if (event.type === 'done') {
                  finalResponse = {
                    replyText: event.replyText ?? '',
                    emotion: normalizeAvatarEmotion(event.emotion ?? 'neutral') as EmotionType,
                    action: event.action ?? 'idle',
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
        );
        lastError = err;
        if (decision === 'abort') {
          return {
            response: finalResponse ?? buildEmptyResponse(),
            connectionStatus: 'error',
            error: '请求被取消',
          };
        }
        if (decision === 'next-candidate') continue;
        if (decision === 'fail') break attemptLoop;
        await sleep(retryDelay * (attempt + 1));
        continue attemptLoop;
      }
    }
  }

  logger.warn('流式请求失败，降级到普通请求:', lastError);
  const fallback = await sendUserInput(normalized, { ...config, endpoint }, signal);
  if (fallback.response.replyText) yield fallback.response.replyText;
  return {
    ...fallback,
    connectionStatus: fallback.connectionStatus === 'error' ? 'error' : 'connected',
  };
}
