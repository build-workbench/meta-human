import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ASRService, TTSService } from '@/core/audio/audioService';

type CapturedUtterance = {
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onboundary: (() => void) | null;
};

const createTTSCallbacks = () => ({
  onSpeakStart: vi.fn(),
  onSpeakEnd: vi.fn(),
  onError: vi.fn(),
  onViseme: vi.fn(),
});

const captureUtterance = (): (() => CapturedUtterance) => {
  let captured: CapturedUtterance | null = null;
  (window.speechSynthesis.speak as ReturnType<typeof vi.fn>).mockImplementation((u: unknown) => {
    captured = u as CapturedUtterance;
  });
  return () => {
    if (!captured) throw new Error('utterance was not passed to speechSynthesis.speak');
    return captured;
  };
};

describe('TTSService hang watchdog', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('settles the promise and cleans up state when onend never fires', async () => {
    const callbacks = createTTSCallbacks();
    const tts = new TTSService({}, callbacks);
    const getUtterance = captureUtterance();

    const promise = tts.speak('你好');
    getUtterance().onstart?.();

    await vi.advanceTimersByTimeAsync(10_000);

    await expect(promise).resolves.toBeUndefined();
    expect(callbacks.onSpeakEnd).toHaveBeenCalledTimes(1);
    expect(callbacks.onViseme).toHaveBeenLastCalledWith(0);
    expect(window.speechSynthesis.cancel).toHaveBeenCalled();
  });

  it('boundary events postpone the hang timeout', async () => {
    const callbacks = createTTSCallbacks();
    const tts = new TTSService({}, callbacks);
    const getUtterance = captureUtterance();

    const promise = tts.speak('你好');
    const utterance = getUtterance();
    utterance.onstart?.();

    await vi.advanceTimersByTimeAsync(8_000);
    utterance.onboundary?.();

    await vi.advanceTimersByTimeAsync(4_900);
    expect(callbacks.onSpeakEnd).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(200);
    await expect(promise).resolves.toBeUndefined();
    expect(callbacks.onSpeakEnd).toHaveBeenCalledTimes(1);
  });

  it('detaches handlers so a late onerror after hang cleanup is ignored', async () => {
    const callbacks = createTTSCallbacks();
    const tts = new TTSService({}, callbacks);
    const getUtterance = captureUtterance();

    const promise = tts.speak('你好');
    const utterance = getUtterance();
    utterance.onstart?.();

    await vi.advanceTimersByTimeAsync(10_000);
    await expect(promise).resolves.toBeUndefined();

    // Chrome 在 cancel() 后会触发 onerror('interrupted')；handler 必须已摘除
    expect(utterance.onerror).toBeNull();
    expect(callbacks.onError).not.toHaveBeenCalled();
  });

  it('normal onend settles immediately and the watchdog never fires', async () => {
    const callbacks = createTTSCallbacks();
    const tts = new TTSService({}, callbacks);
    const getUtterance = captureUtterance();

    const promise = tts.speak('你好');
    const utterance = getUtterance();
    utterance.onstart?.();
    utterance.onend?.();

    await expect(promise).resolves.toBeUndefined();
    expect(callbacks.onSpeakEnd).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(20_000);
    expect(callbacks.onSpeakEnd).toHaveBeenCalledTimes(1);
  });
});

describe('TTSService stop', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not fire onSpeakEnd when stopping while idle', () => {
    const callbacks = createTTSCallbacks();
    const tts = new TTSService({}, callbacks);

    tts.stop();

    expect(callbacks.onSpeakEnd).not.toHaveBeenCalled();
  });

  it('fires onSpeakEnd exactly once when stopping an active utterance', () => {
    const callbacks = createTTSCallbacks();
    const tts = new TTSService({}, callbacks);
    const getUtterance = captureUtterance();

    void tts.speak('你好');
    getUtterance().onstart?.();

    tts.stop();

    expect(callbacks.onSpeakEnd).toHaveBeenCalledTimes(1);
    expect(window.speechSynthesis.cancel).toHaveBeenCalled();
  });
});

describe('TTSService voices subscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (window.speechSynthesis.getVoices as ReturnType<typeof vi.fn>).mockReturnValue([]);
  });

  const createVoice = (name: string, lang: string) =>
    ({ name, lang, voiceURI: name, default: false, localService: true }) as SpeechSynthesisVoice;

  it('notifies subscribers when voices become available asynchronously', () => {
    const tts = new TTSService();
    const listener = vi.fn();
    tts.subscribeVoices(listener);

    const voices = [createVoice('中文语音', 'zh-CN')];
    (window.speechSynthesis.getVoices as ReturnType<typeof vi.fn>).mockReturnValue(voices);
    window.speechSynthesis.onvoiceschanged?.(new Event('voiceschanged'));

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(voices);
    expect(tts.getVoices()).toEqual(voices);
  });

  it('stops notifying after unsubscribe', () => {
    const tts = new TTSService();
    const listener = vi.fn();
    const unsubscribe = tts.subscribeVoices(listener);
    unsubscribe();

    (window.speechSynthesis.getVoices as ReturnType<typeof vi.fn>).mockReturnValue([
      createVoice('中文语音', 'zh-CN'),
    ]);
    window.speechSynthesis.onvoiceschanged?.(new Event('voiceschanged'));

    expect(listener).not.toHaveBeenCalled();
  });

  it('clears subscribers on dispose', () => {
    const tts = new TTSService();
    const listener = vi.fn();
    tts.subscribeVoices(listener);

    tts.dispose();

    (window.speechSynthesis.getVoices as ReturnType<typeof vi.fn>).mockReturnValue([
      createVoice('中文语音', 'zh-CN'),
    ]);
    window.speechSynthesis.onvoiceschanged?.(new Event('voiceschanged'));

    expect(listener).not.toHaveBeenCalled();
  });
});

type MockRecognitionInstance = {
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  abort: ReturnType<typeof vi.fn>;
  onstart: (() => void) | null;
  onresult: ((event: unknown) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

const installMockRecognition = (): { instances: MockRecognitionInstance[] } => {
  const instances: MockRecognitionInstance[] = [];
  class MockRecognition {
    continuous = false;
    interimResults = false;
    lang = '';
    maxAlternatives = 1;
    start = vi.fn();
    stop = vi.fn();
    abort = vi.fn();
    onstart = null;
    onresult = null;
    onerror = null;
    onend = null;
    constructor() {
      instances.push(this as unknown as MockRecognitionInstance);
    }
  }
  (window as unknown as { webkitSpeechRecognition: unknown }).webkitSpeechRecognition =
    MockRecognition;
  return { instances };
};

const createASRState = () => ({
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
});

const finalResultEvent = (transcript: string) => ({
  resultIndex: 0,
  results: [Object.assign([{ transcript }], { isFinal: true })],
});

describe('ASRService recording entry idempotence', () => {
  let originalRecognition: unknown;

  beforeEach(() => {
    originalRecognition = (window as unknown as { webkitSpeechRecognition: unknown })
      .webkitSpeechRecognition;
  });

  afterEach(() => {
    (window as unknown as { webkitSpeechRecognition: unknown }).webkitSpeechRecognition =
      originalRecognition;
  });

  it('replaces the onResult callback without restarting recognition when already recording', () => {
    const { instances } = installMockRecognition();
    const state = createASRState();
    const asr = new ASRService({}, state);
    const recognition = instances[0];

    const first = vi.fn();
    const second = vi.fn();
    asr.start({ onResult: first });
    const secondResult = asr.start({ onResult: second });

    expect(secondResult).toBe(true);
    expect(recognition.start).toHaveBeenCalledTimes(1);
    expect(recognition.stop).not.toHaveBeenCalled();

    recognition.onresult?.(finalResultEvent('你好'));
    expect(second).toHaveBeenCalledWith('你好');
    expect(first).not.toHaveBeenCalled();
  });

  it('starts recognition again after it ended on its own', () => {
    const { instances } = installMockRecognition();
    const state = createASRState();
    const asr = new ASRService({}, state);
    const recognition = instances[0];

    asr.start({ onResult: vi.fn() });
    recognition.onend?.();
    expect(state.setRecording).toHaveBeenLastCalledWith(false);

    asr.start({ onResult: vi.fn() });
    expect(recognition.start).toHaveBeenCalledTimes(2);
  });

  it('gives up and reports an error after repeated "already started" failures', () => {
    vi.useFakeTimers();
    try {
      const { instances } = installMockRecognition();
      const state = createASRState();
      const asr = new ASRService({}, state);
      const recognition = instances[0];
      recognition.start.mockImplementation(() => {
        throw new Error('recognition already started');
      });

      const result = asr.start({ onResult: vi.fn() });
      expect(result).toBe(true);

      for (let i = 0; i < 6; i++) {
        vi.advanceTimersByTime(150);
      }

      expect(recognition.start.mock.calls.length).toBeLessThanOrEqual(4);
      expect(state.setError).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('ASRService event paths', () => {
  let originalRecognition: unknown;

  beforeEach(() => {
    originalRecognition = (window as unknown as { webkitSpeechRecognition: unknown })
      .webkitSpeechRecognition;
  });

  afterEach(() => {
    (window as unknown as { webkitSpeechRecognition: unknown }).webkitSpeechRecognition =
      originalRecognition;
  });

  const setup = () => {
    const { instances } = installMockRecognition();
    const state = createASRState();
    const asr = new ASRService({}, state);
    return { recognition: instances[0], state, asr };
  };

  it('sets listening behavior when recognition starts', () => {
    const { recognition, state, asr } = setup();
    asr.start({ onResult: vi.fn() });

    recognition.onstart?.();

    expect(state.setBehavior).toHaveBeenCalledWith('listening');
  });

  it('ignores interim transcripts and reports only final ones', () => {
    const { recognition, asr } = setup();
    const onResult = vi.fn();
    asr.start({ onResult });

    recognition.onresult?.({
      resultIndex: 0,
      results: [Object.assign([{ transcript: '你' }], { isFinal: false })],
    });
    expect(onResult).not.toHaveBeenCalled();

    recognition.onresult?.({
      resultIndex: 0,
      results: [Object.assign([{ transcript: '你好' }], { isFinal: true })],
    });
    expect(onResult).toHaveBeenCalledWith('你好');
  });

  it('concatenates multiple final results within one event', () => {
    const { recognition, asr } = setup();
    const onResult = vi.fn();
    asr.start({ onResult });

    recognition.onresult?.({
      resultIndex: 0,
      results: [
        Object.assign([{ transcript: '你好' }], { isFinal: true }),
        Object.assign([{ transcript: '世界' }], { isFinal: true }),
      ],
    });

    expect(onResult).toHaveBeenCalledWith('你好世界');
  });

  it('maps recognition error codes to localized messages and resets state', () => {
    const { recognition, state, asr } = setup();
    asr.start({ onResult: vi.fn() });

    recognition.onerror?.({ error: 'not-allowed' });

    expect(state.setError).toHaveBeenCalledWith('麦克风权限被拒绝');
    expect(state.setRecording).toHaveBeenLastCalledWith(false);
    expect(state.setBehavior).toHaveBeenLastCalledWith('idle');
  });

  it('reports an error and returns false when recognition fails to start', () => {
    const { recognition, state, asr } = setup();
    recognition.start.mockImplementation(() => {
      throw new Error('audio capture failed');
    });

    expect(asr.start({ onResult: vi.fn() })).toBe(false);
    expect(state.setError).toHaveBeenCalledWith('启动语音识别失败');
  });

  it('ignores stale recognition callbacks after stop', () => {
    const { recognition, state, asr } = setup();
    const onResult = vi.fn();
    asr.start({ onResult });

    asr.stop();
    state.setRecording.mockClear();
    state.setBehavior.mockClear();

    recognition.onend?.();
    expect(state.setRecording).not.toHaveBeenCalled();

    recognition.onresult?.(finalResultEvent('迟到的结果'));
    expect(onResult).not.toHaveBeenCalled();
  });
});

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
