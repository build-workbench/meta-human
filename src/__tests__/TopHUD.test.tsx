import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import TopHUD from '@/components/TopHUD';
import { useDigitalHumanStore } from '@/store/digitalHumanStore';
import { useChatSessionStore } from '@/store/chatSessionStore';
import { useSystemStore } from '@/store/systemStore';

describe('TopHUD', () => {
  beforeEach(() => {
    useDigitalHumanStore.setState({
      currentBehavior: 'idle',
    });
    useChatSessionStore.setState({
      sessionId: 'session_test',
      chatHistory: [],
    });
    useSystemStore.setState({
      isConnected: true,
      connectionStatus: 'connected',
      isLoading: false,
      error: null,
      lastErrorTime: null,
      chatTransportMode: 'sse',
    });
  });

  it('shows the current transport mode from system store', () => {
    render(<TopHUD onToggleSettings={vi.fn()} onReconnect={vi.fn()} onNewSession={vi.fn()} />);

    expect(screen.getByText('协议:')).toBeInTheDocument();
    expect(screen.getByText('SSE')).toBeInTheDocument();
  });

  it('maps http mode to a user-facing label', () => {
    useSystemStore.setState({ chatTransportMode: 'http' });

    render(<TopHUD onToggleSettings={vi.fn()} onReconnect={vi.fn()} onNewSession={vi.fn()} />);

    expect(screen.getByText('HTTP')).toBeInTheDocument();
  });

  it('shows the active service endpoint and failover count when routing diagnostics are available', () => {
    useSystemStore.setState({
      connectionDiagnostics: {
        lastHealthCheckAt: null,
        lastHealthCheckLatencyMs: null,
        activeEndpoint: 'http://backup:8000',
        failoverCount: 2,
        lastFailoverAt: 123456,
      },
    });

    render(<TopHUD onToggleSettings={vi.fn()} onReconnect={vi.fn()} onNewSession={vi.fn()} />);

    expect(screen.getByText('backup:8000')).toBeInTheDocument();
    expect(screen.getByText('2次')).toBeInTheDocument();
  });
});
