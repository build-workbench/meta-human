import { describe, expect, it } from 'vitest';
import {
  DialogueApiError,
  normalizeApiEndpoint,
  parseChatResponse,
  shouldAbort,
  validateApiUrl,
} from '@/core/dialogue/httpClient';

describe('normalizeApiEndpoint', () => {
  it('accepts http/https endpoints and strips trailing slashes', () => {
    expect(normalizeApiEndpoint('https://api.example.com/')).toBe('https://api.example.com');
    expect(normalizeApiEndpoint('http://localhost:8000')).toBe('http://localhost:8000');
  });

  it('rejects non-http(s) protocols', () => {
    expect(normalizeApiEndpoint('javascript:alert(1)')).toBeNull();
    expect(normalizeApiEndpoint('file:///etc/passwd')).toBeNull();
  });
});

describe('validateApiUrl', () => {
  it('keeps valid http(s) URLs and strips trailing slashes', () => {
    expect(validateApiUrl('https://api.example.com///')).toBe('https://api.example.com');
  });

  it('falls back to localhost for malformed URLs', () => {
    expect(validateApiUrl('not a url')).toBe('http://localhost:8000');
  });

  it('falls back to localhost for non-http(s) protocols', () => {
    expect(validateApiUrl('javascript:alert(1)')).toBe('http://localhost:8000');
  });
});

describe('shouldAbort', () => {
  it('returns true when the signal is aborted', () => {
    const controller = new AbortController();
    controller.abort();
    expect(shouldAbort(new Error('任意错误'), controller.signal)).toBe(true);
  });

  it('returns true for AbortError exceptions', () => {
    expect(shouldAbort(new DOMException('aborted', 'AbortError'))).toBe(true);
  });

  it('returns false for ordinary errors without an aborted signal', () => {
    expect(shouldAbort(new TypeError('fetch failed'))).toBe(false);
  });

  it('does not treat timeout DialogueApiError as an abort', () => {
    // 408 超时错误应继续走重试/故障转移，而不是被当作主动取消
    expect(shouldAbort(new DialogueApiError('请求超时，请重试', 408, true))).toBe(false);
    expect(shouldAbort(new DialogueApiError('请求被取消', 408, true))).toBe(false);
  });
});

describe('parseChatResponse', () => {
  it('passes valid emotion/action through unchanged', () => {
    const result = parseChatResponse({ replyText: 'hi', emotion: 'happy', action: 'wave' });
    expect(result).toEqual({ replyText: 'hi', emotion: 'happy', action: 'wave' });
  });

  it('defaults missing emotion/action to neutral/idle', () => {
    const result = parseChatResponse({ replyText: 'hi' });
    expect(result.emotion).toBe('neutral');
    expect(result.action).toBe('idle');
  });

  it('downgrades out-of-whitelist emotion to neutral', () => {
    // LLM 可能吐出白名单外的词；不归一化会一路带进 store 再在 engine 里 warn 一次
    expect(parseChatResponse({ emotion: 'confused' }).emotion).toBe('neutral');
    expect(parseChatResponse({ emotion: 'HAPPY' }).emotion).toBe('neutral');
    expect(parseChatResponse({ emotion: '' }).emotion).toBe('neutral');
  });

  it('downgrades out-of-whitelist action to idle', () => {
    expect(parseChatResponse({ action: 'jump' }).action).toBe('idle');
    expect(parseChatResponse({ action: 'WAVE' }).action).toBe('idle');
    expect(parseChatResponse({ action: '' }).action).toBe('idle');
  });

  it('tolerates null / non-object payloads', () => {
    expect(parseChatResponse(null)).toEqual({
      replyText: '',
      emotion: 'neutral',
      action: 'idle',
    });
    expect(parseChatResponse('garbage').replyText).toBe('');
  });
});
