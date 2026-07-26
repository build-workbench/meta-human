import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAdvancedDigitalHumanController } from '../hooks/useAdvancedDigitalHumanController';
import { useDigitalHumanStore } from '../store/digitalHumanStore';
import { useChatSessionStore } from '../store/chatSessionStore';
import { useSystemStore } from '../store/systemStore';

const mocks = vi.hoisted(() => ({
  setChatInputMock: vi.fn(),
  handleChatSendMock: vi.fn(),
  reconnectMock: vi.fn(),
  asrStartMock: vi.fn(),
  asrStopMock: vi.fn(),
  dialogueAbortPendingTurnMock: vi.fn(),
  clearRemoteSessionMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastInfoMock: vi.fn(),
  digitalHumanDisposeMock: vi.fn(),
  digitalHumanPauseMock: vi.fn(),
  digitalHumanPlayMock: vi.fn(),
  digitalHumanResetMock: vi.fn(),
  digitalHumanSetExpressionMock: vi.fn(),
  digitalHumanSetExpressionIntensityMock: vi.fn(),
  digitalHumanSetBehaviorMock: vi.fn(),
  createObjectUrlMock: vi.fn(),
  revokeObjectUrlMock: vi.fn(),
}));

vi.mock('../hooks/useChatStream', () => ({
  useChatStream: () => ({
    chatInput: 'draft',
    setChatInput: mocks.setChatInputMock,
    isChatLoading: false,
    handleChatSend: mocks.handleChatSendMock,
  }),
}));

vi.mock('../hooks/useConnectionHealth', () => ({
  useConnectionHealth: () => ({
    reconnect: mocks.reconnectMock,
  }),
}));

vi.mock('@/services', () => ({
  useEngine: () => ({
    dispose: mocks.digitalHumanDisposeMock,
    pause: mocks.digitalHumanPauseMock,
    play: mocks.digitalHumanPlayMock,
    reset: mocks.digitalHumanResetMock,
    setExpression: mocks.digitalHumanSetExpressionMock,
    setExpressionIntensity: mocks.digitalHumanSetExpressionIntensityMock,
    setBehavior: mocks.digitalHumanSetBehaviorMock,
    setEmotion: vi.fn(),
    playAnimation: vi.fn(),
  }),
  useASR: () => ({
    start: mocks.asrStartMock,
    stop: mocks.asrStopMock,
  }),
  useDialogue: () => ({
    abortPendingTurn: mocks.dialogueAbortPendingTurnMock,
  }),
  useTTS: () => ({
    speak: vi.fn(),
  }),
  useServices: () => ({
    engine: {},
    asr: {},
    dialogue: {},
    tts: {},
  }),
}));

vi.mock('../core/dialogue/dialogueService', () => ({
  clearRemoteSession: (...args: unknown[]) => mocks.clearRemoteSessionMock(...args),
}));

vi.mock('sonner', () => ({
  toast: {
    success: mocks.toastSuccessMock,
    info: mocks.toastInfoMock,
  },
}));

describe('useAdvancedDigitalHumanController', () => {
  beforeEach(() => {
    vi.useRealTimers();
    mocks.setChatInputMock.mockReset();
    mocks.handleChatSendMock.mockReset();
    mocks.reconnectMock.mockReset();
    mocks.asrStartMock.mockReset();
    mocks.asrStopMock.mockReset();
    mocks.dialogueAbortPendingTurnMock.mockReset();
    mocks.clearRemoteSessionMock.mockReset();
    mocks.clearRemoteSessionMock.mockResolvedValue(undefined);
    mocks.toastSuccessMock.mockReset();
    mocks.toastInfoMock.mockReset();
    mocks.digitalHumanDisposeMock.mockReset();
    mocks.digitalHumanPauseMock.mockReset();
    mocks.digitalHumanPlayMock.mockReset();
    mocks.digitalHumanResetMock.mockReset();
    mocks.digitalHumanSetExpressionMock.mockReset();
    mocks.digitalHumanSetExpressionIntensityMock.mockReset();
    mocks.digitalHumanSetBehaviorMock.mockReset();
    mocks.createObjectUrlMock.mockReset();
    mocks.revokeObjectUrlMock.mockReset();
    mocks.asrStartMock.mockReturnValue(true);
    mocks.createObjectUrlMock.mockReturnValue('blob:new-avatar');
    vi.stubGlobal('URL', {
      createObjectURL: mocks.createObjectUrlMock,
      revokeObjectURL: mocks.revokeObjectUrlMock,
    });

    useDigitalHumanStore.setState({
      isPlaying: false,
      isRecording: false,
      isMuted: false,
      autoRotate: false,
      isSpeaking: false,
      currentEmotion: 'neutral',
      currentExpression: 'neutral',
      expressionIntensity: 0.8,
      currentBehavior: 'idle',
      avatarSource: { kind: 'procedural' },
      avatarLoadStatus: 'ready',
      avatarLoadError: null,
    });
    useChatSessionStore.setState({
      sessionId: 'session_old',
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

  it('starts a new session and clears remote session', () => {
    const { result } = renderHook(() => useAdvancedDigitalHumanController());

    act(() => {
      result.current.handleNewSession();
    });

    expect(mocks.clearRemoteSessionMock).toHaveBeenCalledWith('session_old');
    expect(useChatSessionStore.getState().sessionId).not.toBe('session_old');
    expect(mocks.toastSuccessMock).toHaveBeenCalledWith('已开启新会话');
  });

  it('toggles settings from keyboard shortcuts and ignores input fields', () => {
    const { result, rerender } = renderHook(() => useAdvancedDigitalHumanController());

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 's' }));
    });

    rerender();

    expect(result.current.showSettings).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    rerender();

    expect(result.current.showSettings).toBe(false);

    const input = document.createElement('input');
    document.body.appendChild(input);

    try {
      act(() => {
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 's', bubbles: true }));
      });

      rerender();

      expect(result.current.showSettings).toBe(false);
    } finally {
      input.remove();
    }
  });

  it('starts recording when idle and stops recording when already recording', () => {
    const onTranscript = vi.fn();
    const { result, rerender } = renderHook(() =>
      useAdvancedDigitalHumanController({ onTranscript }),
    );

    act(() => {
      result.current.handleToggleRecording();
    });

    expect(mocks.asrStartMock).toHaveBeenCalledTimes(1);
    expect(mocks.asrStartMock).toHaveBeenCalledWith(
      expect.objectContaining({ onResult: expect.any(Function) }),
    );
    expect(mocks.toastSuccessMock).toHaveBeenCalledWith('正在聆听...');

    // 识别出文本时应通过 onTranscript 上报，由上层统一走 chat stream
    const startArg = mocks.asrStartMock.mock.calls[0]?.[0] as { onResult: (t: string) => void };
    act(() => startArg.onResult('你好'));
    expect(onTranscript).toHaveBeenCalledWith('你好');

    act(() => {
      useDigitalHumanStore.getState().setRecording(true);
    });

    rerender();

    act(() => {
      result.current.handleToggleRecording();
    });

    expect(mocks.asrStopMock).toHaveBeenCalledTimes(1);
    expect(useDigitalHumanStore.getState().isRecording).toBe(false);
    expect(mocks.toastInfoMock).toHaveBeenCalledWith('录音已停止');
  });

  it('uploads a custom avatar and revokes the previous custom model url', () => {
    useDigitalHumanStore.setState({
      avatarSource: {
        kind: 'custom',
        fileName: 'old.glb',
        modelUrl: 'blob:old-avatar',
      },
    });
    const { result } = renderHook(() => useAdvancedDigitalHumanController());
    const file = new File(['avatar'], 'next.glb', { type: 'model/gltf-binary' });

    act(() => {
      result.current.handleAvatarUpload(file);
    });

    expect(mocks.createObjectUrlMock).toHaveBeenCalledWith(file);
    expect(mocks.revokeObjectUrlMock).toHaveBeenCalledWith('blob:old-avatar');
    expect(useDigitalHumanStore.getState() as unknown as Record<string, unknown>).toMatchObject({
      avatarSource: {
        kind: 'custom',
        fileName: 'next.glb',
        modelUrl: 'blob:new-avatar',
      },
      avatarLoadStatus: 'idle',
      avatarLoadError: null,
    });
    expect(mocks.toastSuccessMock).toHaveBeenCalledWith('已切换到自定义头像');
  });

  it('falls back to the built-in avatar when custom model loading fails', () => {
    useDigitalHumanStore.setState({
      avatarSource: {
        kind: 'custom',
        fileName: 'broken.glb',
        modelUrl: 'blob:broken-avatar',
      },
      avatarLoadStatus: 'idle',
      avatarLoadError: null,
    });
    const { result } = renderHook(() => useAdvancedDigitalHumanController());

    act(() => {
      result.current.handleModelLoad({
        type: 'procedural-fallback',
        error: 'bad avatar',
      });
    });

    expect(mocks.revokeObjectUrlMock).toHaveBeenCalledWith('blob:broken-avatar');
    expect(useDigitalHumanStore.getState() as unknown as Record<string, unknown>).toMatchObject({
      avatarSource: {
        kind: 'procedural',
      },
      avatarLoadStatus: 'error',
      avatarLoadError: 'bad avatar',
    });
    expect(useSystemStore.getState().error).toBe('bad avatar');
  });

  it('clears transient errors after five seconds', () => {
    vi.useFakeTimers();
    useSystemStore.setState({ error: 'temporary error', lastErrorTime: Date.now() });

    renderHook(() => useAdvancedDigitalHumanController());

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(useSystemStore.getState().error).toBeNull();
  });

  it('does not dispose the avatar engine on unmount', () => {
    const { unmount } = renderHook(() => useAdvancedDigitalHumanController());

    unmount();

    expect(mocks.digitalHumanDisposeMock).not.toHaveBeenCalled();
  });
});
