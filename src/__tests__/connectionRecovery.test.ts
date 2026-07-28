import { describe, expect, it, vi } from 'vitest';
import { evaluateConnectionRecovery } from '@/core/dialogue/connectionRecovery';

const baseOptions = {
  unhealthyStatus: 'disconnected' as const,
  unhealthyReason: '服务器连接不稳定，部分功能可能受限',
  transportProbeFailureMessage: '协议探测失败，已保留当前连接模式',
};

describe('evaluateConnectionRecovery', () => {
  it('returns the unhealthy status with reason when the health check fails', async () => {
    const resolveTransportMode = vi.fn().mockResolvedValue('sse');

    const result = await evaluateConnectionRecovery(baseOptions, {
      checkServerHealth: vi.fn().mockResolvedValue(false),
      resolveTransportMode,
      performanceNow: () => 0,
      now: () => 1234,
    });

    expect(result).toEqual({
      status: 'disconnected',
      checkedAt: 1234,
      latencyMs: 0,
      degradedReason: baseOptions.unhealthyReason,
      transportMode: null,
      transportIssue: null,
    });
    expect(resolveTransportMode).not.toHaveBeenCalled();
  });

  it('propagates the error status variant when requested', async () => {
    const result = await evaluateConnectionRecovery(
      { ...baseOptions, unhealthyStatus: 'error', unhealthyReason: '连接失败，请稍后重试' },
      {
        checkServerHealth: vi.fn().mockResolvedValue(false),
        resolveTransportMode: vi.fn(),
        performanceNow: () => 0,
        now: () => 0,
      },
    );

    expect(result.status).toBe('error');
    expect(result.degradedReason).toBe('连接失败，请稍后重试');
  });

  it('resolves the transport mode and passes the forceProbe flag when healthy', async () => {
    const resolveTransportMode = vi.fn().mockResolvedValue('http');

    const result = await evaluateConnectionRecovery(
      { ...baseOptions, forceTransportProbe: true },
      {
        checkServerHealth: vi.fn().mockResolvedValue(true),
        resolveTransportMode,
        performanceNow: () => 0,
        now: () => 0,
      },
    );

    expect(resolveTransportMode).toHaveBeenCalledWith({ forceProbe: true });
    expect(result).toMatchObject({
      status: 'connected',
      degradedReason: null,
      transportMode: 'http',
      transportIssue: null,
    });
  });

  it('keeps connected status but reports the probe failure when transport probe throws', async () => {
    const result = await evaluateConnectionRecovery(baseOptions, {
      checkServerHealth: vi.fn().mockResolvedValue(true),
      resolveTransportMode: vi.fn().mockRejectedValue(new Error('probe failed')),
      performanceNow: () => 0,
      now: () => 0,
    });

    expect(result).toMatchObject({
      status: 'connected',
      transportMode: null,
      transportIssue: baseOptions.transportProbeFailureMessage,
    });
  });

  it('computes latency from the injected clock', async () => {
    let calls = 0;
    const result = await evaluateConnectionRecovery(baseOptions, {
      checkServerHealth: vi.fn().mockResolvedValue(false),
      resolveTransportMode: vi.fn(),
      performanceNow: () => [100, 142][calls++],
      now: () => 0,
    });

    expect(result.latencyMs).toBe(42);
  });

  it('clamps negative latency to zero', async () => {
    let calls = 0;
    const result = await evaluateConnectionRecovery(baseOptions, {
      checkServerHealth: vi.fn().mockResolvedValue(false),
      resolveTransportMode: vi.fn(),
      performanceNow: () => [100, 90][calls++],
      now: () => 0,
    });

    expect(result.latencyMs).toBe(0);
  });
});
