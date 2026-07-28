import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { useDigitalHumanStore } from '@/store/digitalHumanStore';
import { createTTSCallbacks } from '@/core/audio/audioAdapters';
import { TTSService } from '@/core/audio/audioService';
import { mouthOpenSignal } from '@/core/avatar/mouthOpenSignal';

describe('Lipsync: mouthOpenSignal', () => {
  beforeEach(() => {
    mouthOpenSignal.reset();
  });

  it('set clamps to [0, 1]', () => {
    mouthOpenSignal.set(-0.5);
    expect(mouthOpenSignal.value).toBe(0);

    mouthOpenSignal.set(1.5);
    expect(mouthOpenSignal.value).toBe(1);

    mouthOpenSignal.set(0.4);
    expect(mouthOpenSignal.value).toBe(0.4);
  });

  it('reset clears the value', () => {
    mouthOpenSignal.set(0.8);
    mouthOpenSignal.reset();
    expect(mouthOpenSignal.value).toBe(0);
  });
});

describe('Lipsync: createTTSCallbacks', () => {
  beforeEach(() => {
    mouthOpenSignal.reset();
    useDigitalHumanStore.getState().setSpeaking(false);
  });

  it('onViseme writes the mouth signal, bypassing the React state layer', () => {
    const callbacks = createTTSCallbacks();
    callbacks.onViseme?.(0.6);
    expect(mouthOpenSignal.value).toBe(0.6);
    // mouthOpen 不再存在于 store，杜绝常规订阅引发高频重渲染
    expect(useDigitalHumanStore.getState()).not.toHaveProperty('mouthOpen');
  });

  it('onSpeakStart sets speaking + behavior', () => {
    const callbacks = createTTSCallbacks();
    callbacks.onSpeakStart?.();
    expect(useDigitalHumanStore.getState().isSpeaking).toBe(true);
    expect(useDigitalHumanStore.getState().currentBehavior).toBe('speaking');
  });

  it('onSpeakEnd clears speaking + mouth signal', () => {
    const callbacks = createTTSCallbacks();
    mouthOpenSignal.set(0.7);
    useDigitalHumanStore.getState().setSpeaking(true);

    callbacks.onSpeakEnd?.();

    expect(useDigitalHumanStore.getState().isSpeaking).toBe(false);
    expect(mouthOpenSignal.value).toBe(0);
  });
});

describe('Lipsync: TTSService viseme loop', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('drives onViseme while speaking and stops on end', async () => {
    const onViseme = vi.fn();
    const onSpeakStart = vi.fn();
    const onSpeakEnd = vi.fn();
    const tts = new TTSService({}, { onViseme, onSpeakStart, onSpeakEnd });

    // Mock synth.speak to capture utterance and trigger onstart synchronously
    const synth = (window as any).speechSynthesis;
    synth.speaking = false;
    synth.speak = vi.fn((utterance: any) => {
      utterance.onstart?.();
    });

    const speakPromise = tts.speak('你好世界');

    // onstart triggered → viseme loop running
    expect(onSpeakStart).toHaveBeenCalled();

    // Advance 120ms (2 ticks at 60ms interval)
    vi.advanceTimersByTime(120);
    expect(onViseme.mock.calls.length).toBeGreaterThanOrEqual(2);
    // Each call value in [0, 1]
    for (const call of onViseme.mock.calls) {
      expect(call[0]).toBeGreaterThanOrEqual(0);
      expect(call[0]).toBeLessThanOrEqual(1);
    }

    // Trigger onend → loop stops, onViseme(0) called once more
    const utterance = (tts as any).currentUtterance;
    utterance.onend?.();

    const callsBeforeEnd = onViseme.mock.calls.length;
    vi.advanceTimersByTime(200);
    expect(onViseme.mock.calls.length).toBe(callsBeforeEnd); // no more calls after end

    expect(onSpeakEnd).toHaveBeenCalled();
    // Final onViseme call is 0
    expect(onViseme.mock.calls[onViseme.mock.calls.length - 1]?.[0]).toBe(0);

    await speakPromise;
  });

  it('stop halts viseme loop', () => {
    const onViseme = vi.fn();
    const tts = new TTSService({}, { onViseme });

    const synth = (window as any).speechSynthesis;
    synth.speaking = false;
    synth.speak = vi.fn((utterance: any) => {
      utterance.onstart?.();
    });

    tts.speak('测试');

    vi.advanceTimersByTime(60);
    const callsBeforeStop = onViseme.mock.calls.length;
    expect(callsBeforeStop).toBeGreaterThan(0);

    tts.stop();

    vi.advanceTimersByTime(300);
    // After stop, only the final 0 call may have been added by stopVisemeLoop
    const callsAfterStop = onViseme.mock.calls.length;
    expect(callsAfterStop).toBeLessThanOrEqual(callsBeforeStop + 1);
  });
});
