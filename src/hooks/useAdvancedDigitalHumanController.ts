/**
 * 高级数字人控制器 Hook。
 *
 * 协调播放控制、会话管理、语音命令等子 hooks。
 * 聊天流与语音识别文本上报走 useChatStream（页面层），键盘快捷键在此处理。
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useDigitalHumanStore } from '@/store/digitalHumanStore';
import { useSystemStore } from '@/store/systemStore';
import { useEngine, useDialogue } from '@/services';
import { useRecorder } from './useRecorder';
import { useVoiceCommandHandler } from './useVoiceCommandHandler';
import { revokeCustomAvatarObjectUrl } from '@/core/avatar/avatarSourceAdapter';
import { useChatSessionStore } from '@/store/chatSessionStore';
import { clearRemoteSession } from '@/core/dialogue/dialogueService';
import { useIsTabVisibleRef } from './useMediaQuery';

interface UseAdvancedDigitalHumanControllerOptions {
  /** 录音识别出文本后，上报给聊天流处理（统一走 useChatStream） */
  onTranscript?: (text: string) => void;
}

export function useAdvancedDigitalHumanController(
  options: UseAdvancedDigitalHumanControllerOptions = {},
) {
  const { onTranscript } = options;
  // 服务
  const engine = useEngine();
  const dialogue = useDialogue();

  // 直接访问 store
  const isPlaying = useDigitalHumanStore((s) => s.isPlaying);
  const autoRotate = useDigitalHumanStore((s) => s.autoRotate);
  const toggleAutoRotate = useDigitalHumanStore((s) => s.toggleAutoRotate);
  const toggleMute = useDigitalHumanStore((s) => s.toggleMute);
  const avatarSource = useDigitalHumanStore((s) => s.avatarSource);
  const setCustomAvatar = useDigitalHumanStore((s) => s.setCustomAvatar);
  const activateProceduralAvatar = useDigitalHumanStore((s) => s.useProceduralAvatar);
  const activateBuiltinAvatar = useDigitalHumanStore((s) => s.useBuiltinAvatar);
  const setAvatarLoadState = useDigitalHumanStore((s) => s.setAvatarLoadState);
  const error = useSystemStore((s) => s.error);
  const clearError = useSystemStore((s) => s.clearError);
  const setError = useSystemStore((s) => s.setError);
  const resetSystemState = useSystemStore((s) => s.resetSystemState);
  const sessionId = useChatSessionStore((s) => s.sessionId);
  const initChatSession = useChatSessionStore((s) => s.initSession);

  // 本地状态
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');

  // 播放控制
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

  // 会话管理
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
  const isVisibleRef = useIsTabVisibleRef();
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 与 KeyboardControls 对齐：标签页不可见或输入框聚焦时忽略快捷键
      if (!isVisibleRef.current) return;
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
  }, [toggleSettings, closeSettings, isVisibleRef]);

  // 错误自动清除
  useEffect(() => {
    if (!error) return;
    const id = setTimeout(() => clearError(), 5000);
    return () => clearTimeout(id);
  }, [error, clearError]);

  // 模型加载回调（首次加载完成后播放 Wave 欢迎动作，每次会话仅一次）
  const hasGreetedRef = useRef(false);
  const handleModelLoad = useCallback(() => {
    setAvatarLoadState('ready');
    if (!hasGreetedRef.current) {
      hasGreetedRef.current = true;
      engine.playAnimation('wave');
    }
  }, [engine, setAvatarLoadState]);

  const handleAvatarUpload = useCallback(
    (file: File) => {
      const MAX_AVATAR_SIZE = 50 * 1024 * 1024; // 50 MB
      const ACCEPTED_AVATAR_TYPES = [
        'model/gltf-binary',
        'model/gltf+json',
        'application/octet-stream',
      ];
      const ACCEPTED_AVATAR_EXTS = ['.glb', '.gltf'];

      const lowerName = file.name.toLowerCase();
      const hasValidExt = ACCEPTED_AVATAR_EXTS.some((ext) => lowerName.endsWith(ext));
      const hasValidType =
        ACCEPTED_AVATAR_TYPES.includes(file.type) || file.type === '' || hasValidExt;

      if (!hasValidType || !hasValidExt) {
        toast.error('仅支持 GLB/GLTF 格式');
        return;
      }

      if (file.size > MAX_AVATAR_SIZE) {
        toast.error('头像文件不能超过 50MB');
        return;
      }

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
    activateBuiltinAvatar();
    setAvatarLoadState('idle');
    toast.success('已切换到内置头像');
  }, [activateBuiltinAvatar, avatarSource, setAvatarLoadState]);

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
            : '模型加载失败，已回退到程序化头像';
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

  // 录音控制（与设置面板共用同一 ASR 入口，见 useRecorder）
  const { startRecording, stopRecording } = useRecorder({ onTranscript });
  const handleToggleRecording = useCallback(() => {
    if (useDigitalHumanStore.getState().isRecording) {
      stopRecording();
      toast.info('录音已停止');
      return;
    }
    if (startRecording()) {
      toast.success('正在聆听...');
    }
  }, [startRecording, stopRecording]);

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

  // 语音命令处理
  const { handleVoiceCommand } = useVoiceCommandHandler();

  return {
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
  };
}
