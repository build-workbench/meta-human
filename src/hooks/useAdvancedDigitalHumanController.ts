/**
 * 高级数字人控制器 Hook。
 *
 * 协调播放控制、会话管理、语音命令等子 hooks。
 * 注意：聊天流已移到页面层，键盘快捷键在此处理。
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useDigitalHumanStore } from '@/store/digitalHumanStore';
import { useSystemStore } from '@/store/systemStore';
import { useEngine, useASR, useDialogue } from '@/services';
import { useVoiceCommandHandler } from './useVoiceCommandHandler';
import { revokeCustomAvatarObjectUrl } from '@/core/avatar/avatarSourceAdapter';
import { useChatSessionStore } from '@/store/chatSessionStore';
import { clearRemoteSession } from '@/core/dialogue/dialogueService';

export function useAdvancedDigitalHumanController() {
  // 服务
  const engine = useEngine();
  const asr = useASR();
  const dialogue = useDialogue();

  // 直接访问 store
  const isPlaying = useDigitalHumanStore((s) => s.isPlaying);
  const autoRotate = useDigitalHumanStore((s) => s.autoRotate);
  const toggleAutoRotate = useDigitalHumanStore((s) => s.toggleAutoRotate);
  const toggleMute = useDigitalHumanStore((s) => s.toggleMute);
  const setRecording = useDigitalHumanStore((s) => s.setRecording);
  const avatarSource = useDigitalHumanStore((s) => s.avatarSource);
  const setCustomAvatar = useDigitalHumanStore((s) => s.setCustomAvatar);
  const activateProceduralAvatar = useDigitalHumanStore((s) => s.useProceduralAvatar);
  const setAvatarLoadState = useDigitalHumanStore((s) => s.setAvatarLoadState);
  const error = useSystemStore((s) => s.error);
  const clearError = useSystemStore((s) => s.clearError);
  const setConnectionStatus = useSystemStore((s) => s.setConnectionStatus);
  const setError = useSystemStore((s) => s.setError);
  const resetSystemState = useSystemStore((s) => s.resetSystemState);
  const sessionId = useChatSessionStore((s) => s.sessionId);
  const initChatSession = useChatSessionStore((s) => s.initSession);

  // 本地状态
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');

  // 播放控制（内联自 usePlaybackController）
  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      engine.pause();
      toast.info('已暂停');
    } else {
      engine.play();
      toast.success('已播放');
    }
  }, [isPlaying, engine]);

  const handleReset = useCallback(() => {
    engine.reset();
    toast.info('系统已重置');
  }, [engine]);

  // 会话管理（内联自 useSessionManager）
  const handleNewSession = useCallback(() => {
    const oldSessionId = sessionId;
    dialogue.abortPendingTurn();
    initChatSession();
    resetSystemState();
    toast.success('已开启新会话');
    void clearRemoteSession(oldSessionId);
  }, [dialogue, sessionId, initChatSession, resetSystemState]);

  // 设置面板控制
  const toggleSettings = useCallback(() => {
    setShowSettings((prev) => !prev);
  }, []);

  const closeSettings = useCallback(() => {
    setShowSettings(false);
  }, []);

  // 键盘快捷键处理
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 忽略输入框中的按键
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key.toLowerCase()) {
        case 's':
          if (!e.ctrlKey && !e.metaKey) {
            toggleSettings();
          }
          break;
        case 'escape':
          closeSettings();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleSettings, closeSettings]);

  // 错误自动清除
  useEffect(() => {
    if (!error) return;
    const id = setTimeout(() => clearError(), 5000);
    return () => clearTimeout(id);
  }, [error, clearError]);

  // 模型加载回调
  const handleModelLoad = useCallback(() => {
    setAvatarLoadState('ready');
  }, [setAvatarLoadState]);

  const handleAvatarUpload = useCallback(
    (file: File) => {
      const nextModelUrl = URL.createObjectURL(file);
      revokeCustomAvatarObjectUrl(avatarSource, URL.revokeObjectURL);
      setCustomAvatar({
        modelUrl: nextModelUrl,
        fileName: file.name,
      });
      setAvatarLoadState('idle');
      toast.success('已切换到自定义头像');
    },
    [avatarSource, setAvatarLoadState, setCustomAvatar],
  );

  const handleUseBuiltInAvatar = useCallback(() => {
    revokeCustomAvatarObjectUrl(avatarSource, URL.revokeObjectURL);
    activateProceduralAvatar();
    setAvatarLoadState('ready');
    toast.success('已切换到内置头像');
  }, [activateProceduralAvatar, avatarSource, setAvatarLoadState]);

  const handleAvatarLoad = useCallback(
    (model: unknown) => {
      if (
        model &&
        typeof model === 'object' &&
        'type' in model &&
        (model as { type: unknown }).type === 'procedural-fallback'
      ) {
        const error =
          'error' in model && typeof (model as { error?: unknown }).error === 'string'
            ? (model as { error: string }).error
            : '自定义头像加载失败';
        revokeCustomAvatarObjectUrl(avatarSource, URL.revokeObjectURL);
        activateProceduralAvatar();
        setAvatarLoadState('error', error);
        setError(error);
        return;
      }

      handleModelLoad();
    },
    [activateProceduralAvatar, avatarSource, handleModelLoad, setAvatarLoadState, setError],
  );

  // 录音控制
  const handleToggleRecording = useCallback(() => {
    const isRecording = useDigitalHumanStore.getState().isRecording;
    if (isRecording) {
      asr.stop();
      setRecording(false);
      toast.info('录音已停止');
      return;
    }

    const started = asr.start();
    if (started) {
      setRecording(true);
      toast.success('正在聆听...');
    }
  }, [asr, setRecording]);

  // 表情控制
  const handleExpressionChange = useCallback(
    (expression: string, intensity: number) => {
      engine.setExpression(expression);
      engine.setExpressionIntensity(intensity);
    },
    [engine],
  );

  // 行为控制
  const handleBehaviorChange = useCallback(
    (behavior: string, params: Record<string, unknown>) => {
      engine.setBehavior(behavior, params);
    },
    [engine],
  );

  // 语音命令处理（需要外部传入 handleChatSend）
  const { handleVoiceCommand } = useVoiceCommandHandler();

  return useMemo(
    () => ({
      // 播放控制
      isPlaying,
      handlePlayPause,
      handleReset,

      // 会话管理
      sessionId,
      handleNewSession,

      // 本地状态
      activeTab,
      autoRotate,
      showSettings,

      // 回调
      closeSettings,
      handleBehaviorChange,
      handleExpressionChange,
      handleAvatarLoad,
      handleAvatarUpload,
      handleModelLoad: handleAvatarLoad,
      handleUseBuiltInAvatar,
      handleToggleRecording,
      handleVoiceCommand,
      setActiveTab,
      toggleAutoRotate,
      toggleMute,
      toggleSettings,

      // 服务访问（供 useChatStream 使用）
      setConnectionStatus,
      setError,
      clearError,
    }),
    [
      isPlaying,
      handlePlayPause,
      handleReset,
      sessionId,
      handleNewSession,
      activeTab,
      autoRotate,
      showSettings,
      closeSettings,
      handleBehaviorChange,
      handleExpressionChange,
      handleAvatarLoad,
      handleAvatarUpload,
      handleUseBuiltInAvatar,
      handleToggleRecording,
      handleVoiceCommand,
      toggleAutoRotate,
      toggleMute,
      toggleSettings,
      setConnectionStatus,
      setError,
      clearError,
    ],
  );
}
