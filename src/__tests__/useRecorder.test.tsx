import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ServicesProvider } from '@/services';
import type { Services } from '@/core/createServices';
import { useDigitalHumanStore } from '@/store/digitalHumanStore';
import { useRecorder } from '@/hooks/useRecorder';

const createTestServices = () => ({
  dialogue: { abortPendingTurn: vi.fn() } as unknown as Services['dialogue'],
  engine: { dispose: vi.fn() } as unknown as Services['engine'],
  tts: { dispose: vi.fn() } as unknown as Services['tts'],
  asr: {
    dispose: vi.fn(),
    start: vi.fn(() => true),
    stop: vi.fn(),
  } as unknown as Services['asr'],
});

describe('useRecorder', () => {
  beforeEach(() => {
    useDigitalHumanStore.getState().setRecording(false);
  });

  const setup = (onTranscript?: (text: string) => void) => {
    const services = createTestServices();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ServicesProvider services={services}>{children}</ServicesProvider>
    );
    return { ...renderHook(() => useRecorder({ onTranscript }), { wrapper }), services };
  };

  it('starts ASR and routes transcripts to onTranscript', () => {
    const onTranscript = vi.fn();
    const { result, services } = setup(onTranscript);

    let started = false;
    act(() => {
      started = result.current.startRecording();
    });

    expect(started).toBe(true);
    expect(services.asr.start).toHaveBeenCalledTimes(1);

    const options = (services.asr.start as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      onResult: (text: string) => void;
    };
    options.onResult('你好');
    expect(onTranscript).toHaveBeenCalledWith('你好');
  });

  it('toggleRecording stops and returns false when already recording', () => {
    const { result, services } = setup();
    act(() => {
      useDigitalHumanStore.getState().setRecording(true);
    });

    let returnValue = true;
    act(() => {
      returnValue = result.current.toggleRecording();
    });

    expect(returnValue).toBe(false);
    expect(services.asr.stop).toHaveBeenCalledTimes(1);
    expect(useDigitalHumanStore.getState().isRecording).toBe(false);
  });

  it('toggleRecording starts and returns true when idle', () => {
    const { result, services } = setup();

    let returnValue = false;
    act(() => {
      returnValue = result.current.toggleRecording();
    });

    expect(returnValue).toBe(true);
    expect(services.asr.start).toHaveBeenCalledTimes(1);
  });

  it('uses the latest onTranscript without re-binding ASR', () => {
    const first = vi.fn();
    const services = createTestServices();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ServicesProvider services={services}>{children}</ServicesProvider>
    );
    const onTranscriptRef = { current: first };
    const { result, rerender } = renderHook(
      ({ onTranscript }: { onTranscript: (text: string) => void }) => useRecorder({ onTranscript }),
      { wrapper, initialProps: { onTranscript: onTranscriptRef.current } },
    );

    act(() => {
      result.current.startRecording();
    });

    const second = vi.fn();
    rerender({ onTranscript: second });

    const options = (services.asr.start as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      onResult: (text: string) => void;
    };
    options.onResult('你好');
    expect(second).toHaveBeenCalledWith('你好');
    expect(first).not.toHaveBeenCalled();
    expect(services.asr.start).toHaveBeenCalledTimes(1);
  });

  it('does not stop ASR when the consuming component unmounts', () => {
    const { result, services, unmount } = setup();
    act(() => {
      result.current.startRecording();
    });

    unmount();

    // ASRService 是单例服务，生命周期由 ServicesProvider 的 disposeServices 管理；
    // 单个消费者卸载（如关闭设置面板）不得中断其他入口发起的录音。
    expect(services.asr.stop).not.toHaveBeenCalled();
  });
});
