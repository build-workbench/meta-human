import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useConnectionHealth } from '@/hooks/useConnectionHealth';
import { useSystemStore } from '@/store/systemStore';

const mocks = vi.hoisted(() => ({
  checkServerHealthMock: vi.fn(),
  getPreferredChatTransportModeMock: vi.fn(),
  toastWarningMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
  toastLoadingMock: vi.fn(),
}));

vi.mock('@/core/dialogue/dialogueService', () => ({
  checkServerHealth: (...args: unknown[]) => mocks.checkServerHealthMock(...args),
  evaluateConnectionRecovery: vi.fn(async (options: any, deps: any) => {
    const isHealthy = await deps.checkServerHealth();
    if (!isHealthy) {
      return {
        status: options.unhealthyStatus,
        checkedAt: Date.now(),
        latencyMs: 0,
        degradedReason: options.unhealthyReason,
        transportMode: null,
        transportIssue: null,
      };
    }
    const mode = await deps.resolveTransportMode({
      forceProbe: options.forceTransportProbe ?? false,
    });
    return {
      status: 'connected',
      checkedAt: Date.now(),
      latencyMs: 0,
      degradedReason: null,
      transportMode: mode,
      transportIssue: null,
    };
  }),
  getPreferredChatTransportMode: () => mocks.getPreferredChatTransportModeMock(),
}));

vi.mock('sonner', () => ({
  toast: {
    warning: (...args: unknown[]) => mocks.toastWarningMock(...args),
    success: (...args: unknown[]) => mocks.toastSuccessMock(...args),
    error: (...args: unknown[]) => mocks.toastErrorMock(...args),
    loading: (...args: unknown[]) => mocks.toastLoadingMock(...args),
  },
}));

describe('useConnectionHealth', () => {
  beforeEach(() => {
    useSystemStore.getState().resetSystemState();
    mocks.checkServerHealthMock.mockReset();
    mocks.getPreferredChatTransportModeMock.mockReset();
    mocks.getPreferredChatTransportModeMock.mockReturnValue('sse');
    mocks.toastWarningMock.mockReset();
    mocks.toastSuccessMock.mockReset();
    mocks.toastErrorMock.mockReset();
    mocks.toastLoadingMock.mockReset();
    mocks.toastLoadingMock.mockReturnValue('toast-1');
  });

  it('degrades periodic checks to disconnected when backend health checks fail', async () => {
    mocks.checkServerHealthMock.mockResolvedValue(false);

    const { unmount } = renderHook(() => useConnectionHealth());

    await waitFor(() => {
      expect(useSystemStore.getState().connectionStatus).toBe('disconnected');
    });

    expect(useSystemStore.getState().error).toBe('服务器连接不稳定，部分功能可能受限');
    expect(mocks.toastWarningMock).toHaveBeenCalledWith(
      '服务器连接不稳定，部分功能可能受限',
      expect.objectContaining({
        action: expect.objectContaining({ label: '重连', onClick: expect.any(Function) }),
      }),
    );

    unmount();
  });

  it('keeps reconnects connected when health check succeeds', async () => {
    mocks.checkServerHealthMock.mockResolvedValue(true);

    const { result, unmount } = renderHook(() => useConnectionHealth());

    await waitFor(() => {
      expect(useSystemStore.getState().connectionStatus).toBe('connected');
    });

    await act(async () => {
      await result.current.reconnect();
    });

    expect(useSystemStore.getState().connectionStatus).toBe('connected');
    expect(mocks.toastLoadingMock).toHaveBeenCalledWith('正在重新连接...');
    expect(mocks.toastSuccessMock).toHaveBeenCalledWith('连接成功', { id: 'toast-1' });

    unmount();
  });
});
