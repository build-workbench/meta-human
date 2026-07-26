/**
 * 连接恢复评估。
 *
 * 纯函数，所有副作用通过依赖注入回调执行。
 */

export interface ConnectionRecoveryResult {
  status: 'connected' | 'disconnected' | 'error';
  checkedAt: number;
  latencyMs: number;
  degradedReason: string | null;
  transportMode: 'http' | 'sse' | null;
  transportIssue: string | null;
}

export async function evaluateConnectionRecovery(
  options: {
    unhealthyStatus: 'disconnected' | 'error';
    unhealthyReason: string;
    transportProbeFailureMessage: string;
    forceTransportProbe?: boolean;
  },
  dependencies: {
    checkServerHealth: () => Promise<boolean>;
    resolveTransportMode: (opts: { forceProbe: boolean }) => Promise<'http' | 'sse'>;
    performanceNow?: () => number;
    now?: () => number;
  },
): Promise<ConnectionRecoveryResult> {
  const startedAt = (dependencies.performanceNow ?? performance.now.bind(performance))();
  const isHealthy = await dependencies.checkServerHealth();
  const checkedAt = (dependencies.now ?? Date.now)();
  const latencyMs = Math.max(
    0,
    Math.round((dependencies.performanceNow ?? performance.now.bind(performance))() - startedAt),
  );

  if (!isHealthy) {
    return {
      status: options.unhealthyStatus,
      checkedAt,
      latencyMs,
      degradedReason: options.unhealthyReason,
      transportMode: null,
      transportIssue: null,
    };
  }

  try {
    const transportMode = await dependencies.resolveTransportMode({
      forceProbe: options.forceTransportProbe ?? false,
    });
    return {
      status: 'connected',
      checkedAt,
      latencyMs,
      degradedReason: null,
      transportMode,
      transportIssue: null,
    };
  } catch {
    return {
      status: 'connected',
      checkedAt,
      latencyMs,
      degradedReason: null,
      transportMode: null,
      transportIssue: options.transportProbeFailureMessage,
    };
  }
}
