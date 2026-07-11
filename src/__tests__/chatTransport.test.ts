import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  httpChatTransport,
  sseChatTransport,
  getDefaultChatTransport,
  setChatTransportOverride,
} from '../core/dialogue/dialogueService';

describe('chatTransport', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn();
    setChatTransportOverride(null);
  });

  it('http transport streams the full reply as a single token', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ replyText: '完整回复', emotion: 'neutral', action: 'idle' }),
    } as unknown as Response);

    const iterator = httpChatTransport.stream({ userText: 'hi' });

    expect(await iterator.next()).toEqual({ value: '完整回复', done: false });
    const final = await iterator.next();
    expect(final.done).toBe(true);
    if (typeof final.value === 'object' && final.value !== null && 'response' in final.value) {
      expect(final.value.response.replyText).toBe('完整回复');
    }
  });

  it('sse transport delegates to dialogueService stream implementation', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"type":"token","content":"streamed"}\n\n'));
        controller.enqueue(
          encoder.encode(
            'data: {"type":"done","replyText":"streamed","emotion":"happy","action":"wave"}\n\n',
          ),
        );
        controller.close();
      },
    });

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      body: stream,
    } as unknown as Response);

    const iterator = sseChatTransport.stream({ userText: 'hi' });

    expect(await iterator.next()).toEqual({ value: 'streamed', done: false });
    const final = await iterator.next();
    expect(final.done).toBe(true);
    if (typeof final.value === 'object' && final.value !== null && 'response' in final.value) {
      expect(final.value.response.replyText).toBe('streamed');
    }
  });

  it('returns override transport when one is registered', () => {
    const overrideTransport = {
      mode: 'http' as const,
      send: vi.fn(),
      stream: vi.fn(),
    };

    setChatTransportOverride(overrideTransport);
    expect(getDefaultChatTransport()).toBe(overrideTransport);
    setChatTransportOverride(null);
  });
});
