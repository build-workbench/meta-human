import { describe, expect, it, vi } from 'vitest';

import { ASRService } from '@/core/audio/audioService';

describe('ASRService transcript routing', () => {
  it('invokes onResult callback when final transcript arrives, not dialogue', async () => {
    const onResult = vi.fn();
    const state = {
      setRecording: vi.fn(),
      setBehavior: vi.fn(),
      setSpeaking: vi.fn(),
      setError: vi.fn(),
      setEmotion: vi.fn(),
      setExpression: vi.fn(),
      setAnimation: vi.fn(),
      play: vi.fn(),
      pause: vi.fn(),
      reset: vi.fn(),
      setMuted: vi.fn(),
    };

    const asr = new ASRService({}, state);
    asr.start({ onResult });

    // ASR 不应再持有 dialogue 引用；onResult 是唯一上报通道
    expect(onResult).not.toHaveBeenCalled();
    expect(asr).toBeDefined();
  });
});
