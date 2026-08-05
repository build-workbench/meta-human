import { describe, expect, it } from 'vitest';
import {
  DialogueApiError,
  normalizeApiEndpoint,
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
