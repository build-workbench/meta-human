import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ServicesProvider } from '@/services';
import type { Services } from '@/core/createServices';
import { useVoiceCommandHandler } from '@/hooks/useVoiceCommandHandler';
import { useDigitalHumanStore } from '@/store/digitalHumanStore';

function createTestServices(): Services {
  return {
    dialogue: {} as unknown as Services['dialogue'],
    engine: {
      dispose: vi.fn(),
      play: vi.fn(),
      pause: vi.fn(),
      reset: vi.fn(),
      setEmotion: vi.fn(),
      setExpression: vi.fn(),
      setBehavior: vi.fn(),
      playAnimation: vi.fn(),
    } as unknown as Services['engine'],
    tts: {
      dispose: vi.fn(),
      speak: vi.fn(() => Promise.resolve()),
    } as unknown as Services['tts'],
    asr: { dispose: vi.fn() } as unknown as Services['asr'],
  };
}

function setup(options: Parameters<typeof useVoiceCommandHandler>[0] = {}) {
  const services = createTestServices();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ServicesProvider services={services}>{children}</ServicesProvider>
  );
  const { result } = renderHook(() => useVoiceCommandHandler(options), { wrapper });
  return { services, handleVoiceCommand: result.current.handleVoiceCommand };
}

describe('useVoiceCommandHandler', () => {
  afterEach(() => {
    useDigitalHumanStore.setState({ isMuted: false });
    vi.useRealTimers();
  });

  it('maps 打招呼 to greeting animation with auto reset', () => {
    vi.useFakeTimers();
    const { services, handleVoiceCommand } = setup();

    act(() => {
      handleVoiceCommand('打招呼');
    });

    const engine = services.engine;
    expect(engine.setEmotion).toHaveBeenCalledWith('happy');
    expect(engine.setExpression).toHaveBeenCalledWith('smile');
    expect(engine.setBehavior).toHaveBeenCalledWith('greeting');
    expect(engine.playAnimation).toHaveBeenCalledWith('wave');
    expect(services.tts.speak).toHaveBeenCalled();

    // 定时器结束后行为复位到 idle
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(engine.setBehavior).toHaveBeenLastCalledWith('idle');
    expect(engine.playAnimation).toHaveBeenLastCalledWith('idle');
  });

  it('maps mute/unmute commands to the digital human store', () => {
    const { services, handleVoiceCommand } = setup();

    act(() => {
      handleVoiceCommand('静音');
    });
    expect(useDigitalHumanStore.getState().isMuted).toBe(true);

    act(() => {
      handleVoiceCommand('取消静音');
    });
    expect(useDigitalHumanStore.getState().isMuted).toBe(false);
    expect(services.engine.play).not.toHaveBeenCalled();
  });

  it('passes unrecognized commands to onChatSend', () => {
    const onChatSend = vi.fn();
    const { services, handleVoiceCommand } = setup({ onChatSend });

    act(() => {
      handleVoiceCommand('今天天气怎么样');
    });

    expect(onChatSend).toHaveBeenCalledWith('今天天气怎么样');
    expect(services.engine.playAnimation).not.toHaveBeenCalled();
  });
});
