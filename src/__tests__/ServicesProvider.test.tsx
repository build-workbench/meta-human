import { render } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ServicesProvider, useDialogue, useServices } from '@/services';
import type { Services } from '@/core/createServices';

// 追踪自有服务实例的创建/销毁，用于 StrictMode 生命周期断言
const createdInstances: Services[] = [];
const disposedInstances: Services[] = [];

vi.mock('@/core/createServices', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/core/createServices')>();
  return {
    ...actual,
    createServices: vi.fn(() => {
      const svc = {
        engine: { dispose: vi.fn() } as unknown as Services['engine'],
        tts: { dispose: vi.fn() } as unknown as Services['tts'],
        asr: { dispose: vi.fn() } as unknown as Services['asr'],
        dialogue: { reset: vi.fn() } as unknown as Services['dialogue'],
      } as unknown as Services;
      createdInstances.push(svc);
      return svc;
    }),
    disposeServices: vi.fn((svc: Services) => {
      disposedInstances.push(svc);
    }),
  };
});

function buildServices(overrides: Partial<Services> = {}): Services {
  return {
    engine: {
      dispose: vi.fn(),
    } as unknown as Services['engine'],
    tts: {
      dispose: vi.fn(),
    } as unknown as Services['tts'],
    asr: {
      dispose: vi.fn(),
    } as unknown as Services['asr'],
    dialogue: {
      abortPendingTurn: vi.fn(),
      isTurnPending: vi.fn(() => false),
      reset: vi.fn(),
      runDialogueTurn: vi.fn(),
      runDialogueTurnStream: vi.fn(),
    } as unknown as Services['dialogue'],
    ...overrides,
  };
}

describe('ServicesProvider', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    createdInstances.length = 0;
    disposedInstances.length = 0;
  });

  it('exposes provided dialogue runtime through service hooks', () => {
    const dialogue = {
      abortPendingTurn: vi.fn(),
      isTurnPending: vi.fn(() => false),
      reset: vi.fn(),
      runDialogueTurn: vi.fn(),
      runDialogueTurnStream: vi.fn(),
    } as unknown as Services['dialogue'];
    const services = buildServices({ dialogue });
    const captured = { current: null as unknown };

    function Consumer() {
      captured.current = useDialogue();
      return null;
    }

    render(
      <ServicesProvider services={services}>
        <Consumer />
      </ServicesProvider>,
    );

    expect(captured.current).toBe(dialogue);
  });

  it('does not dispose externally provided services on unmount', () => {
    const services = buildServices();

    const { unmount } = render(
      <ServicesProvider services={services}>
        <div>child</div>
      </ServicesProvider>,
    );

    unmount();

    expect(services.asr.dispose).not.toHaveBeenCalled();
  });

  it('recreates owned services after StrictMode remount so consumers keep a live instance', () => {
    const captured: Services[] = [];

    function Consumer() {
      captured.push(useServices());
      return null;
    }

    const { unmount } = render(
      <StrictMode>
        <ServicesProvider>
          <Consumer />
        </ServicesProvider>
      </StrictMode>,
    );

    // StrictMode 双挂载：首个实例被 dispose 后必须重建，
    // 消费者最终持有的必须是没有被 dispose 过的新实例
    expect(createdInstances).toHaveLength(2);
    expect(disposedInstances).toEqual([createdInstances[0]]);
    expect(captured[captured.length - 1]).toBe(createdInstances[1]);

    unmount();

    // 真实卸载时销毁最后创建的实例
    expect(disposedInstances).toContain(createdInstances[1]);
  });
});
