import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ServicesProvider } from '@/services';
import type { Services } from '@/core/createServices';
import { useVoiceInteraction } from '@/hooks/useVoiceInteraction';
import { useDigitalHumanStore } from '@/store/digitalHumanStore';

function createVoice(name: string, lang: string): SpeechSynthesisVoice {
  return {
    default: false,
    lang,
    localService: true,
    name,
    voiceURI: name,
  } as SpeechSynthesisVoice;
}

function createTestServices(voices: SpeechSynthesisVoice[]): Services {
  return {
    dialogue: {
      abortPendingTurn: vi.fn(),
    } as unknown as Services['dialogue'],
    engine: {
      dispose: vi.fn(),
    } as unknown as Services['engine'],
    tts: {
      dispose: vi.fn(),
      getVoices: vi.fn(() => voices),
      speakWithOptions: vi.fn(),
    } as unknown as Services['tts'],
    asr: {
      dispose: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    } as unknown as Services['asr'],
  };
}

describe('useVoiceInteraction', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('prefers Chinese voices and speaks with zh-CN', () => {
    const services = createTestServices([
      createVoice('Chinese Voice', 'zh-CN'),
      createVoice('English Voice', 'en-US'),
    ]);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ServicesProvider services={services}>{children}</ServicesProvider>
    );

    const { result } = renderHook(() => useVoiceInteraction(), { wrapper });

    expect(result.current.voice?.name).toBe('Chinese Voice');

    act(() => {
      result.current.speak('你好');
    });

    expect(services.tts.speakWithOptions).toHaveBeenCalledWith(
      '你好',
      expect.objectContaining({
        lang: 'zh-CN',
        voiceName: 'Chinese Voice',
      }),
    );
  });

  it('persists speech preferences across remounts', () => {
    const chineseVoice = createVoice('Chinese Voice', 'zh-CN');
    const englishVoice = createVoice('English Voice', 'en-US');
    const services = createTestServices([chineseVoice, englishVoice]);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ServicesProvider services={services}>{children}</ServicesProvider>
    );

    const firstMount = renderHook(() => useVoiceInteraction(), { wrapper });

    act(() => {
      firstMount.result.current.setVoice(englishVoice);
      firstMount.result.current.setRate(1.4);
      firstMount.result.current.setPitch(0.8);
      firstMount.result.current.setVolume(0.6);
    });

    firstMount.unmount();

    const secondMount = renderHook(() => useVoiceInteraction(), { wrapper });

    expect(secondMount.result.current.voice?.name).toBe('English Voice');
    expect(secondMount.result.current.rate).toBe(1.4);
    expect(secondMount.result.current.pitch).toBe(0.8);
    expect(secondMount.result.current.volume).toBe(0.6);
  });

  it('refreshes the voice list and auto-selects a zh voice when voices load late', () => {
    // 隔离前置用例残留的 store 状态（voiceName 会被其他用例写入）
    useDigitalHumanStore.setState({
      speechConfig: { voiceName: null, rate: 1, pitch: 1, volume: 0.8 },
    });

    // 模拟 Chrome 的异步 voiceschanged：挂载时列表为空，稍后才就绪
    let voices: SpeechSynthesisVoice[] = [];
    let subscriber: ((next: SpeechSynthesisVoice[]) => void) | null = null;

    const services = createTestServices([]);
    services.tts = {
      ...services.tts,
      getVoices: vi.fn(() => voices),
      subscribeVoices: vi.fn((next: (v: SpeechSynthesisVoice[]) => void) => {
        subscriber = next;
        return () => {
          subscriber = null;
        };
      }),
    } as unknown as Services['tts'];

    const wrapper = ({ children }: { children: ReactNode }) => (
      <ServicesProvider services={services}>{children}</ServicesProvider>
    );

    const { result } = renderHook(() => useVoiceInteraction(), { wrapper });

    expect(result.current.availableVoices).toEqual([]);
    expect(result.current.voice).toBeNull();

    act(() => {
      voices = [createVoice('English Voice', 'en-US'), createVoice('Chinese Voice', 'zh-CN')];
      subscriber?.(voices);
    });

    expect(result.current.availableVoices).toHaveLength(2);
    expect(result.current.voice?.name).toBe('Chinese Voice');
  });
});
