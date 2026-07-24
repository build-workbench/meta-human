import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { ChatTransportMode } from '../core/dialogue/dialogueService';

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

export interface ConnectionDiagnostics {
  lastHealthCheckAt: number | null;
  lastHealthCheckLatencyMs: number | null;
  activeEndpoint: string | null;
  failoverCount: number;
  lastFailoverAt: number | null;
}

export interface RuntimeApiConfig {
  baseUrl: string;
  fallbacks: string;
}

interface SystemState {
  isConnected: boolean;
  connectionStatus: ConnectionStatus;
  isLoading: boolean;
  error: string | null;
  lastErrorTime: number | null;
  chatTransportMode: Exclude<ChatTransportMode, 'auto'>;
  connectionDiagnostics: ConnectionDiagnostics;
  runtimeApiConfig: RuntimeApiConfig | null;
  setConnected: (connected: boolean) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setChatTransportMode: (mode: Exclude<ChatTransportMode, 'auto'>) => void;
  recordConnectionHealth: (input: {
    status: ConnectionStatus;
    checkedAt?: number;
    latencyMs?: number | null;
    degradedReason?: string | null;
  }) => void;
  recordEndpointRouting: (input: {
    activeEndpoint: string;
    didFailover?: boolean;
    recordedAt?: number;
  }) => void;
  clearError: () => void;
  setRuntimeApiConfig: (config: RuntimeApiConfig | null) => void;
  resetSystemState: () => void;
}

const ERROR_THROTTLE_MS = 2000;
const ENABLE_DEVTOOLS = import.meta.env.DEV && import.meta.env.MODE !== 'test';
const RUNTIME_API_CONFIG_KEY = 'metahuman_runtime_api_config';

function loadRuntimeApiConfig(): RuntimeApiConfig | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(RUNTIME_API_CONFIG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RuntimeApiConfig>;
    if (typeof parsed?.baseUrl === 'string' && parsed.baseUrl.trim()) {
      return { baseUrl: parsed.baseUrl.trim(), fallbacks: parsed.fallbacks ?? '' };
    }
  } catch {
    // ignore malformed storage
  }
  return null;
}

function persistRuntimeApiConfig(config: RuntimeApiConfig | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (config) {
      window.localStorage.setItem(RUNTIME_API_CONFIG_KEY, JSON.stringify(config));
    } else {
      window.localStorage.removeItem(RUNTIME_API_CONFIG_KEY);
    }
  } catch {
    // ignore quota / privacy mode errors
  }
}

const createInitialConnectionDiagnostics = (): ConnectionDiagnostics => ({
  lastHealthCheckAt: null,
  lastHealthCheckLatencyMs: null,
  activeEndpoint: null,
  failoverCount: 0,
  lastFailoverAt: null,
});

export const useSystemStore = create<SystemState>()(
  devtools(
    (set, get) => ({
      isConnected: true,
      connectionStatus: 'connected',
      isLoading: false,
      error: null,
      lastErrorTime: null,
      chatTransportMode: 'sse',
      connectionDiagnostics: createInitialConnectionDiagnostics(),
      runtimeApiConfig: loadRuntimeApiConfig(),

      setConnected: (connected) => set({ isConnected: connected }),

      setConnectionStatus: (status) =>
        set({
          connectionStatus: status,
          isConnected: status === 'connected',
        }),

      setLoading: (loading) => set({ isLoading: loading }),

      setChatTransportMode: (chatTransportMode) => set({ chatTransportMode }),

      recordConnectionHealth: ({ status, checkedAt = Date.now(), latencyMs = null }) =>
        set((state) => ({
          connectionStatus: status,
          isConnected: status === 'connected',
          connectionDiagnostics: {
            ...state.connectionDiagnostics,
            lastHealthCheckAt: checkedAt,
            lastHealthCheckLatencyMs: latencyMs,
          },
        })),

      recordEndpointRouting: ({ activeEndpoint, didFailover = false, recordedAt = Date.now() }) =>
        set((state) => ({
          connectionDiagnostics: {
            ...state.connectionDiagnostics,
            activeEndpoint,
            failoverCount: didFailover
              ? state.connectionDiagnostics.failoverCount + 1
              : state.connectionDiagnostics.failoverCount,
            lastFailoverAt: didFailover ? recordedAt : state.connectionDiagnostics.lastFailoverAt,
          },
        })),

      setError: (error) => {
        if (!error) {
          set({ error: null, lastErrorTime: null });
          return;
        }

        const { error: prevError, lastErrorTime } = get();
        const now = Date.now();

        if (prevError === error && lastErrorTime && now - lastErrorTime < ERROR_THROTTLE_MS) {
          return;
        }

        set({ error, lastErrorTime: now });
      },

      clearError: () => set({ error: null, lastErrorTime: null }),

      setRuntimeApiConfig: (config) => {
        persistRuntimeApiConfig(config);
        set({ runtimeApiConfig: config });
      },

      resetSystemState: () =>
        set({
          error: null,
          lastErrorTime: null,
          connectionStatus: 'connected',
          isConnected: true,
          isLoading: false,
          chatTransportMode: 'sse',
          connectionDiagnostics: createInitialConnectionDiagnostics(),
        }),
    }),
    { name: 'system-store', enabled: ENABLE_DEVTOOLS },
  ),
);
