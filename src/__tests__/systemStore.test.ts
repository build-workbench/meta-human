import { describe, expect, it, beforeEach } from 'vitest';
import { useSystemStore } from '@/store/systemStore';

describe('systemStore 连接状态收口', () => {
  beforeEach(() => {
    useSystemStore.setState({
      connectionStatus: 'connected',
      isConnected: true,
      connectionDiagnostics: {
        lastHealthCheckAt: null,
        lastHealthCheckLatencyMs: null,
        activeEndpoint: null,
        failoverCount: 0,
        lastFailoverAt: null,
      },
    });
  });

  it('setConnectionStatus 同步维护 isConnected', () => {
    useSystemStore.getState().setConnectionStatus('disconnected');
    expect(useSystemStore.getState().connectionStatus).toBe('disconnected');
    expect(useSystemStore.getState().isConnected).toBe(false);

    useSystemStore.getState().setConnectionStatus('connected');
    expect(useSystemStore.getState().connectionStatus).toBe('connected');
    expect(useSystemStore.getState().isConnected).toBe(true);
  });

  it('recordConnectionHealth 通过 setConnectionStatus 收口并写入诊断', () => {
    useSystemStore.getState().recordConnectionHealth({
      status: 'disconnected',
      checkedAt: 1234,
      latencyMs: 42,
    });

    const state = useSystemStore.getState();
    // 状态收口：connectionStatus 与 isConnected 必须同步
    expect(state.connectionStatus).toBe('disconnected');
    expect(state.isConnected).toBe(false);
    // 诊断字段单独写入
    expect(state.connectionDiagnostics.lastHealthCheckAt).toBe(1234);
    expect(state.connectionDiagnostics.lastHealthCheckLatencyMs).toBe(42);
  });

  it('recordConnectionHealth 在 connected 时恢复 isConnected', () => {
    useSystemStore.getState().recordConnectionHealth({ status: 'disconnected' });
    useSystemStore.getState().recordConnectionHealth({ status: 'connected' });

    const state = useSystemStore.getState();
    expect(state.connectionStatus).toBe('connected');
    expect(state.isConnected).toBe(true);
  });
});
