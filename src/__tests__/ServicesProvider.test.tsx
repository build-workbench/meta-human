import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ServicesProvider, useDialogue } from '@/services';
import type { Services } from '@/core/createServices';

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
});
