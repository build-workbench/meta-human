/**
 * HTTP 客户端：fetch 封装、错误归一化与重试/故障转移决策辅助。
 *
 * 纯函数工具，不持有模块级可变状态。故障转移副作用通过回调注入。
 */
import { loggers } from '@/lib/logger';
import type { EmotionType } from '@/core/avatar/avatarContract';
import type { ChatRequestPayload, ChatResponsePayload, DialogueMessage } from './dialogueService';

const logger = loggers.dialogue;

const ALLOWED_API_PROTOCOLS = ['http:', 'https:'];

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
// Endpoint parsing
// ============================================================================

export function normalizeApiEndpoint(url: string): string | null {
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

export function validateApiUrl(url: string): string {
  const normalized = url.replace(/\/+$/, '');
  try {
    new URL(normalized);
    return normalized;
  } catch {
    logger.error(`Invalid API URL: ${url}`);
    return 'http://localhost:8000';
  }
}

// ============================================================================
// Fetch helpers
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

export function isRetryableDialogueError(error: Error): boolean {
  return error instanceof DialogueApiError ? error.isRetryable : true;
}

export function shouldAbort(error: unknown, signal?: AbortSignal): boolean {
  return (
    signal?.aborted === true ||
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error &&
      error.message === '请求被取消' &&
      error instanceof DialogueApiError &&
      error.status === 408)
  );
}

// ============================================================================
// Response parsing & HTTP requests
// ============================================================================

export function parseChatResponse(data: unknown): ChatResponsePayload {
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
// Payload helpers shared with dialogueService
// ============================================================================

export function getLatestUserMessage(messages?: DialogueMessage[]): string {
  if (!messages || messages.length === 0) return '';
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') return messages[i].content.trim();
  }
  return '';
}

// ============================================================================
// Failover decision
// ============================================================================

export type FailoverDecision = 'abort' | 'next-candidate' | 'retry' | 'fail';

export interface AttemptClassification {
  decision: FailoverDecision;
  lastError: Error;
}

/**
 * 对单次尝试的错误进行分类，决定后续重试/故障转移策略。
 *
 * `onRetryableFailure` 回调由调用方注入，用于将故障转移副作用委托给
 * DialogueRouting 实例，避免本模块依赖路由状态。
 */
export function classifyAttemptError(
  error: unknown,
  signal: AbortSignal | undefined,
  candidate: string,
  ci: number,
  candidateCount: number,
  attempt: number,
  maxRetries: number,
  onRetryableFailure?: (endpoint: string) => void,
): AttemptClassification {
  const normalizedError = normalizeDialogueError(error);
  if (signal?.aborted || shouldAbort(normalizedError, signal)) {
    return { decision: 'abort', lastError: normalizedError };
  }
  const retryable = isRetryableDialogueError(normalizedError);
  if (retryable) onRetryableFailure?.(candidate);
  if (retryable && ci < candidateCount - 1)
    return { decision: 'next-candidate', lastError: normalizedError };
  if (!retryable || attempt >= maxRetries) return { decision: 'fail', lastError: normalizedError };
  return { decision: 'retry', lastError: normalizedError };
}
