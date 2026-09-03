import { DigitalHumanViewer } from '@/components/viewer';
import TopHUD from '@/components/TopHUD';
import SettingsDrawer from '@/components/SettingsDrawer';
import ChatDock from '@/components/ChatDock';
import { useAdvancedDigitalHumanController } from '@/hooks/useAdvancedDigitalHumanController';
import { useChatStream } from '@/hooks/useChatStream';
import { useConnectionHealth } from '@/hooks/useConnectionHealth';
import { useDigitalHumanStore } from '@/store/digitalHumanStore';
import { useChatSessionStore } from '@/store/chatSessionStore';
import { useSystemStore } from '@/store/systemStore';
import { getAvatarViewerModelUrl } from '@/core/avatar/avatarSourceAdapter';

export default function AdvancedDigitalHumanPage() {
  const isMuted = useDigitalHumanStore((s) => s.isMuted);
  const avatarSource = useDigitalHumanStore((s) => s.avatarSource);
  const avatarLoadStatus = useDigitalHumanStore((s) => s.avatarLoadStatus);
  const avatarLoadError = useDigitalHumanStore((s) => s.avatarLoadError);

  // 聊天流 hook（先调，以便 handleChatSend 可注入 controller）
  const sessionId = useChatSessionStore((s) => s.sessionId);
  const setConnectionStatus = useSystemStore((s) => s.setConnectionStatus);
  const setError = useSystemStore((s) => s.setError);
  const clearError = useSystemStore((s) => s.clearError);
  const { chatInput, setChatInput, isChatLoading, handleChatSend } = useChatStream({
    sessionId,
    isMuted,
    onConnectionChange: (status) => setConnectionStatus(status),
    onClearError: () => clearError(),
    onError: (msg) => setError(msg),
  });

  // 控制器 hook（录音识别出的文本统一走 handleChatSend）
  const {
    activeTab,
    autoRotate,
    closeSettings,
    handleBehaviorChange,
    handleAvatarUpload,
    handleExpressionChange,
    handleModelLoad,
    handleNewSession,
    handlePlayPause,
    handleReset,
    handleToggleRecording,
    handleUseBuiltInAvatar,
    handleVoiceCommand,
    setActiveTab,
    showSettings,
    toggleMute,
    toggleSettings,
    toggleAutoRotate,
  } = useAdvancedDigitalHumanController({
    onTranscript: (text) => handleChatSend(text),
  });

  // 连接健康检查
  const { reconnect } = useConnectionHealth();

  return (
    <div className="relative isolate h-[100dvh] min-h-screen w-full overflow-hidden bg-black font-sans text-white selection:bg-blue-500/30 light:bg-[#f4f5f9] light:text-zinc-900">
      {/* Background 3D Viewer */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/80 z-10 pointer-events-none light:from-white/50 light:to-white/75" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-black/0 to-black/0 z-0 pointer-events-none light:from-blue-200/50" />
        <DigitalHumanViewer
          modelUrl={getAvatarViewerModelUrl(avatarSource)}
          autoRotate={autoRotate}
          showControls={false}
          onModelLoad={handleModelLoad}
        />
      </div>

      <TopHUD
        onToggleSettings={toggleSettings}
        onReconnect={reconnect}
        onNewSession={handleNewSession}
      />

      <SettingsDrawer
        show={showSettings}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onClose={closeSettings}
        onPlayPause={handlePlayPause}
        onReset={handleReset}
        onToggleRecording={handleToggleRecording}
        onToggleMute={toggleMute}
        onToggleAutoRotate={toggleAutoRotate}
        onVoiceCommand={handleVoiceCommand}
        onChatSend={handleChatSend}
        onExpressionChange={handleExpressionChange}
        onBehaviorChange={handleBehaviorChange}
        onAvatarUpload={handleAvatarUpload}
        onUseBuiltInAvatar={handleUseBuiltInAvatar}
        avatarFileName={avatarSource.kind === 'custom' ? avatarSource.fileName : null}
        avatarLoadStatus={avatarLoadStatus}
        avatarLoadError={avatarLoadError}
      />

      <ChatDock
        chatInput={chatInput}
        onChatInputChange={setChatInput}
        onSend={handleChatSend}
        onToggleRecording={handleToggleRecording}
        isChatLoading={isChatLoading}
      />
    </div>
  );
}
