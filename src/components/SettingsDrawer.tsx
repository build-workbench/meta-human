import { Settings, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useDigitalHumanStore } from '@/store/digitalHumanStore';
import { useSystemStore } from '@/store/systemStore';
import { useFocusTrap } from '@/hooks';
import ThemeToggle from '@/components/ThemeToggle';
import ControlPanel from './ControlPanel';
import ExpressionControlPanel from './ExpressionControlPanel';
import BehaviorControlPanel from './BehaviorControlPanel';
import VoiceInteractionPanel from './VoiceInteractionPanel';
import { CHARACTER_PRESETS } from '@/core/dialogue/characterPresets';
import {
  applyRuntimeApiEndpoints,
  resetRuntimeApiEndpoints,
} from '@/core/dialogue/dialogueService';

interface SettingsDrawerProps {
  show: boolean;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onClose: () => void;
  onPlayPause: () => void;
  onReset: () => void;
  onToggleRecording: () => void;
  onToggleMute: () => void;
  onToggleAutoRotate: () => void;
  onVoiceCommand: (cmd: string) => void;
  onChatSend: (text?: string) => void;
  onExpressionChange: (expression: string, intensity: number) => void;
  onBehaviorChange: (behavior: string, params: Record<string, unknown>) => void;
  onAvatarUpload: (file: File) => void;
  onUseBuiltInAvatar: () => void;
  avatarFileName: string | null;
  avatarLoadStatus: 'idle' | 'ready' | 'error';
  avatarLoadError: string | null;
}

const TABS = ['basic', 'expression', 'behavior', 'avatar', 'voice', 'config'] as const;

export default function SettingsDrawer({
  show,
  activeTab,
  onTabChange,
  onClose,
  onPlayPause,
  onReset,
  onToggleRecording,
  onToggleMute,
  onToggleAutoRotate,
  onVoiceCommand,
  onChatSend,
  onExpressionChange,
  onBehaviorChange,
  onAvatarUpload,
  onUseBuiltInAvatar,
  avatarFileName,
  avatarLoadStatus,
  avatarLoadError,
}: SettingsDrawerProps) {
  const isPlaying = useDigitalHumanStore((s) => s.isPlaying);
  const isRecording = useDigitalHumanStore((s) => s.isRecording);
  const isMuted = useDigitalHumanStore((s) => s.isMuted);
  const autoRotate = useDigitalHumanStore((s) => s.autoRotate);
  const currentExpression = useDigitalHumanStore((s) => s.currentExpression);
  const currentBehavior = useDigitalHumanStore((s) => s.currentBehavior);
  const activeCharacterId = useDigitalHumanStore((s) => s.activeCharacterId);
  const setActiveCharacter = useDigitalHumanStore((s) => s.setActiveCharacter);

  const drawerRef = useFocusTrap<HTMLDivElement>(show, activeTab);

  return (
    <>
      {show && (
        <div
          className="fixed inset-0 z-30 bg-black/50 light:bg-zinc-900/20 backdrop-blur-[2px]"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="设置面板"
        className={`fixed inset-y-0 right-0 z-40 h-[100dvh] w-full max-w-full border-l border-white/10 light:border-zinc-900/10 bg-black/85 light:bg-white/90 backdrop-blur-xl transition-transform duration-500 ease-out sm:w-80 md:w-96 ${show ? 'translate-x-0' : 'pointer-events-none translate-x-full'}`}
      >
        <div className="flex h-full flex-col p-5 sm:p-6">
          <div className="mb-6 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-medium text-white/90 light:text-zinc-900">
              <Settings className="h-4 w-4" /> Control Systems
            </h2>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <button
                onClick={onClose}
                aria-label="关闭设置"
                className="rounded-lg p-2 transition-colors light:hover:bg-zinc-900/5"
              >
                <X className="h-5 w-5 text-gray-400 light:text-zinc-600" />
              </button>
            </div>
          </div>

          <div
            role="tablist"
            className="mb-6 flex gap-1 overflow-x-auto rounded-lg bg-white/5 light:bg-zinc-900/[0.04] p-1 shadow-[inset_-12px_0_10px_-10px_rgba(255,255,255,0.35)] light:shadow-[inset_-12px_0_10px_-10px_rgba(0,0,0,0.18)]"
          >
            {TABS.map((tab) => (
              <button
                key={tab}
                role="tab"
                aria-selected={activeTab === tab}
                onClick={() => onTabChange(tab)}
                className={`min-w-[4.5rem] flex-1 rounded-md px-2 py-2 text-xs font-medium capitalize transition-colors ${activeTab === tab ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-gray-400 light:text-zinc-600 light:hover:bg-zinc-900/5 light:hover:text-zinc-900'}`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div
            role="tabpanel"
            aria-label={activeTab}
            className="custom-scrollbar flex-1 space-y-6 overflow-y-auto pr-1 sm:pr-2"
          >
            {activeTab === 'basic' && (
              <div className="space-y-4">
                <div className="rounded-xl border border-white/5 light:border-zinc-900/5 bg-white/5 light:bg-zinc-900/[0.04] p-4">
                  <ControlPanel
                    isPlaying={isPlaying}
                    isRecording={isRecording}
                    isMuted={isMuted}
                    autoRotate={autoRotate}
                    onPlayPause={onPlayPause}
                    onReset={onReset}
                    onToggleRecording={onToggleRecording}
                    onToggleMute={onToggleMute}
                    onToggleAutoRotate={onToggleAutoRotate}
                    onVoiceCommand={onVoiceCommand}
                  />
                </div>
                <div className="rounded-xl border border-white/5 light:border-zinc-900/5 bg-white/5 light:bg-zinc-900/[0.04] p-4">
                  <div className="space-y-1">
                    <h3 className="text-sm font-medium text-white light:text-zinc-900">角色预设</h3>
                    <p className="text-xs text-gray-400 light:text-zinc-600">
                      切换数字人对话人设，下一轮对话生效。
                    </p>
                  </div>
                  <div className="mt-3 grid gap-2">
                    {CHARACTER_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setActiveCharacter(preset.id)}
                        className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                          activeCharacterId === preset.id
                            ? 'border-blue-500 bg-blue-500/15 text-white light:text-zinc-900'
                            : 'border-white/10 light:border-zinc-900/10 bg-black/20 light:bg-zinc-900/[0.03] text-gray-300 light:text-zinc-700 light:hover:bg-zinc-900/5'
                        }`}
                      >
                        <div className="text-sm font-medium">{preset.name}</div>
                        <div className="text-xs text-gray-400 light:text-zinc-600">
                          {preset.description}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'expression' && (
              <ExpressionControlPanel
                currentExpression={currentExpression}
                onExpressionChange={onExpressionChange}
              />
            )}
            {activeTab === 'behavior' && (
              <BehaviorControlPanel
                currentBehavior={currentBehavior}
                onBehaviorChange={onBehaviorChange}
              />
            )}
            {activeTab === 'avatar' && (
              <div className="space-y-4 rounded-xl border border-white/10 light:border-zinc-900/10 bg-white/5 light:bg-zinc-900/[0.04] p-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-medium text-white light:text-zinc-900">头像来源</h3>
                  <p className="text-xs text-gray-400 light:text-zinc-600">
                    上传 GLB/GLTF 模型。加载失败时自动回退到内置程序化头像。
                  </p>
                </div>

                <div className="rounded-lg border border-dashed border-white/15 light:border-zinc-900/15 bg-black/20 light:bg-zinc-900/[0.03] p-3 text-xs text-gray-300 light:text-zinc-700">
                  当前头像: {avatarFileName ?? '内置 3D 模型（RobotExpressive）'}
                </div>

                <label
                  className="block text-sm font-medium text-gray-300 light:text-zinc-700"
                  htmlFor="avatar-upload"
                >
                  上传自定义头像
                </label>
                <input
                  id="avatar-upload"
                  type="file"
                  accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) {
                      return;
                    }
                    onAvatarUpload(file);
                    event.currentTarget.value = '';
                  }}
                  className="block w-full rounded-lg border border-white/10 light:border-zinc-900/10 bg-black/30 light:bg-white px-3 py-2 text-sm text-gray-200 light:text-zinc-800 file:mr-3 file:rounded-md file:border-0 file:bg-blue-500/20 file:px-3 file:py-1 file:text-blue-200 light:file:text-blue-700 hover:file:bg-blue-500/30"
                />

                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-gray-400 light:text-zinc-600">
                    状态:
                    <span className="ml-2 text-white light:text-zinc-900">
                      {avatarLoadStatus === 'ready'
                        ? '已就绪'
                        : avatarLoadStatus === 'error'
                          ? '加载失败，已回退'
                          : '等待加载'}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={onUseBuiltInAvatar}
                    className="rounded-lg border border-white/10 light:border-zinc-900/10 px-3 py-1.5 text-gray-200 light:text-zinc-800 transition-colors light:hover:bg-zinc-900/5"
                  >
                    使用内置头像
                  </button>
                </div>

                {avatarLoadError && (
                  <div
                    className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200 light:text-red-700"
                    role="alert"
                  >
                    {avatarLoadError}
                  </div>
                )}
              </div>
            )}
            {activeTab === 'voice' && (
              <div className="space-y-4">
                <VoiceInteractionPanel onTranscript={(text) => onChatSend(text)} />
              </div>
            )}
            {activeTab === 'config' && <RuntimeConfigPanel />}
          </div>
        </div>
      </div>
    </>
  );
}

function RuntimeConfigPanel() {
  const runtimeApiConfig = useSystemStore((s) => s.runtimeApiConfig);
  const setRuntimeApiConfig = useSystemStore((s) => s.setRuntimeApiConfig);

  const [baseUrl, setBaseUrl] = useState(runtimeApiConfig?.baseUrl ?? '');
  const [fallbacks, setFallbacks] = useState(runtimeApiConfig?.fallbacks ?? '');
  const [saved, setSaved] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  const markSaved = () => {
    setSaved(true);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => {
      savedTimerRef.current = null;
      setSaved(false);
    }, 1500);
  };

  const handleApply = () => {
    const trimmed = baseUrl.trim();
    if (!trimmed) return;
    const config = { baseUrl: trimmed, fallbacks: fallbacks.trim() };
    setRuntimeApiConfig(config);
    applyRuntimeApiEndpoints(config.baseUrl, config.fallbacks);
    markSaved();
  };

  const handleReset = () => {
    setRuntimeApiConfig(null);
    resetRuntimeApiEndpoints();
    setBaseUrl('');
    setFallbacks('');
    markSaved();
  };

  return (
    <div className="space-y-4 rounded-xl border border-white/10 light:border-zinc-900/10 bg-white/5 light:bg-zinc-900/[0.04] p-4">
      <div className="space-y-1">
        <h3 className="text-sm font-medium text-white light:text-zinc-900">API 端点</h3>
        <p className="text-xs text-gray-400 light:text-zinc-600">
          运行时覆盖后端地址（优先于 env 配置），刷新后仍生效。
        </p>
      </div>

      <div className="space-y-2">
        <label
          className="block text-sm font-medium text-gray-300 light:text-zinc-700"
          htmlFor="runtime-api-base"
        >
          主端点 Base URL
        </label>
        <input
          id="runtime-api-base"
          type="text"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="http://localhost:8000"
          className="block w-full rounded-lg border border-white/10 light:border-zinc-900/10 bg-black/30 light:bg-white px-3 py-2 text-sm text-gray-200 light:text-zinc-800 light:placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none"
        />
      </div>

      <div className="space-y-2">
        <label
          className="block text-sm font-medium text-gray-300 light:text-zinc-700"
          htmlFor="runtime-api-fallbacks"
        >
          备用端点（逗号分隔）
        </label>
        <input
          id="runtime-api-fallbacks"
          type="text"
          value={fallbacks}
          onChange={(e) => setFallbacks(e.target.value)}
          placeholder="http://localhost:8001,http://backup:8000"
          className="block w-full rounded-lg border border-white/10 light:border-zinc-900/10 bg-black/30 light:bg-white px-3 py-2 text-sm text-gray-200 light:text-zinc-800 light:placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none"
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleApply}
          disabled={!baseUrl.trim()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          应用
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="rounded-lg border border-white/10 light:border-zinc-900/10 px-4 py-2 text-sm text-gray-200 light:text-zinc-800 transition-colors light:hover:bg-zinc-900/5"
        >
          恢复 env 默认
        </button>
        {saved && <span className="text-xs text-green-400 light:text-green-600">已保存</span>}
      </div>

      {runtimeApiConfig && (
        <div className="rounded-lg border border-white/10 light:border-zinc-900/10 bg-black/20 light:bg-zinc-900/[0.03] p-3 text-xs text-gray-400 light:text-zinc-600">
          当前覆盖: {runtimeApiConfig.baseUrl}
          {runtimeApiConfig.fallbacks && <> + 备用端点（逗号分隔）: {runtimeApiConfig.fallbacks}</>}
        </div>
      )}
    </div>
  );
}
