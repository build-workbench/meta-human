import { loggers } from '../../lib/logger';
import type { TTSCallbacks, ASRStateAdapter } from './audioAdapters';
import type { DialogueOrchestrator } from '../dialogue/dialogueOrchestrator';

const logger = loggers.audio;

type DialogueRuntime = Pick<DialogueOrchestrator, 'runDialogueTurn'>;

// TTS 配置接口
export interface TTSConfig {
  lang?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
}

type SpeechRecognitionResultItem = { transcript: string; isFinal?: boolean };
type SpeechRecognitionResultLike = ArrayLike<SpeechRecognitionResultItem>;
type SpeechRecognitionResultListLike = ArrayLike<SpeechRecognitionResultLike>;

type SpeechRecognitionEventLike = {
  results: SpeechRecognitionResultListLike;
  resultIndex?: number;
};

type SpeechRecognitionErrorEventLike = {
  error: string;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

// 语音合成服务
export class TTSService {
  private synth: SpeechSynthesis | null;
  private voices: SpeechSynthesisVoice[];
  private config: TTSConfig;
  private isInitialized: boolean = false;
  private callbacks: TTSCallbacks;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private cancelling = false;
  private voiceLoadHandler: (() => void) | null = null;
  private visemeTimer: ReturnType<typeof setInterval> | null = null;
  private visemeStartTime = 0;

  constructor(config: TTSConfig = {}, callbacks: TTSCallbacks = {}) {
    this.synth =
      typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
    this.voices = [];
    this.config = {
      lang: config.lang ?? 'zh-CN',
      rate: config.rate ?? 1.0,
      pitch: config.pitch ?? 1.0,
      volume: config.volume ?? 0.8,
    };
    this.callbacks = callbacks;
    this.loadVoices();
  }

  private loadVoices(): void {
    if (!this.synth) {
      this.isInitialized = false;
      this.voices = [];
      return;
    }

    const loadVoiceList = () => {
      this.voices = this.synth!.getVoices();
      this.isInitialized = this.voices.length > 0;
    };

    loadVoiceList();
    if (!this.isInitialized) {
      this.voiceLoadHandler = loadVoiceList;
      this.synth.onvoiceschanged = this.voiceLoadHandler;
    }
  }

  dispose(): void {
    if (this.synth && this.voiceLoadHandler) {
      this.synth.onvoiceschanged = null;
      this.voiceLoadHandler = null;
    }
    this.stopVisemeLoop();
    this.stop();
  }

  updateConfig(config: Partial<TTSConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getVoices(): SpeechSynthesisVoice[] {
    return this.voices;
  }

  isSupported(): boolean {
    return !!this.synth;
  }

  isSpeaking(): boolean {
    return this.synth?.speaking ?? false;
  }

  speak(text: string, config?: Partial<TTSConfig>): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!text.trim()) {
        resolve();
        return;
      }

      const utterance = this.prepareUtterance(text, config ?? {}, {
        onEnd: () => resolve(),
        onError: (msg) => reject(new Error(msg)),
        includeErrorDetail: true,
      });
      if (utterance) this.synth!.speak(utterance);
    });
  }

  speakWithOptions(
    text: string,
    options: {
      lang?: string;
      rate?: number;
      pitch?: number;
      volume?: number;
      voiceName?: string;
    } = {},
  ) {
    const utterance = this.prepareUtterance(text, options, { includeErrorDetail: false });
    if (utterance) this.synth!.speak(utterance);
  }

  private prepareUtterance(
    text: string,
    config: {
      lang?: string;
      rate?: number;
      pitch?: number;
      volume?: number;
      voiceName?: string;
    },
    hooks: { onEnd?: () => void; onError?: (msg: string) => void; includeErrorDetail: boolean },
  ): SpeechSynthesisUtterance | null {
    if (!this.synth || typeof SpeechSynthesisUtterance === 'undefined') {
      const message = '浏览器不支持语音合成功能';
      this.callbacks.onError?.(message);
      hooks.onError?.(message);
      return null;
    }

    if (this.synth.speaking) {
      this.cancelCurrentUtterance();
      this.synth.cancel();
    }

    const lang = config.lang ?? this.config.lang ?? 'zh-CN';
    const rate = config.rate ?? this.config.rate ?? 1.0;
    const pitch = config.pitch ?? this.config.pitch ?? 1.0;
    const volume = config.volume ?? this.config.volume ?? 0.8;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = volume;

    const selectedVoice = config.voiceName
      ? this.voices.find((v) => v.name === config.voiceName)
      : this.voices.find((v) => v.lang.includes(lang.split('-')[0]));
    if (selectedVoice) utterance.voice = selectedVoice;

    utterance.onstart = () => {
      this.callbacks.onSpeakStart?.();
      this.startVisemeLoop();
    };

    utterance.onend = () => {
      const wasCancelled = this.cancelling;
      this.cancelling = false;
      this.currentUtterance = null;
      this.stopVisemeLoop();
      // 被 cancelCurrentUtterance 主动触发时，onSpeakEnd 由 stop() 统一调用，
      // 此处仅 settle Promise，避免重复 onViseme(0)。
      if (!wasCancelled) {
        this.callbacks.onSpeakEnd?.();
      }
      hooks.onEnd?.();
    };

    utterance.onerror = (event) => {
      this.cancelling = false;
      this.currentUtterance = null;
      this.stopVisemeLoop();
      logger.error('语音合成错误:', event);
      const msg = hooks.includeErrorDetail ? `语音合成失败: ${event.error}` : '语音合成失败';
      this.callbacks.onError?.(msg);
      hooks.onError?.(event.error);
    };

    this.currentUtterance = utterance;
    return utterance;
  }

  private cancelCurrentUtterance(): void {
    const previous = this.currentUtterance;
    if (previous) {
      // 标记正在 cancel，使 onend 跳过 onSpeakEnd（由 stop() 统一调用），
      // 仅 settle Promise，避免重复 onViseme(0)。
      // onend 内会调 stopVisemeLoop，此处不再调，避免二次 onViseme(0)。
      this.cancelling = true;
      previous.onstart = null;
      previous.onerror = null;
      const onEnd = previous.onend;
      previous.onend = null;
      this.currentUtterance = null;
      if (typeof onEnd === 'function') {
        try {
          onEnd.call(previous, new Event('end') as SpeechSynthesisEvent);
        } catch (error) {
          logger.warn('Failed to settle previous utterance onend:', error);
        }
      }
      return;
    }
    this.stopVisemeLoop();
  }

  private startVisemeLoop(): void {
    this.stopVisemeLoop();
    this.visemeStartTime = Date.now();
    this.visemeTimer = setInterval(() => {
      const elapsed = (Date.now() - this.visemeStartTime) / 1000;
      const base = Math.abs(Math.sin(elapsed * Math.PI * 5));
      const wobble = 0.3 * Math.sin(elapsed * Math.PI * 1.5);
      const noise = (Math.random() - 0.5) * 0.2;
      const open = Math.max(0, Math.min(1, base * 0.7 + wobble * 0.2 + noise + 0.1));
      this.callbacks.onViseme?.(open);
    }, 60);
  }

  private stopVisemeLoop(): void {
    if (this.visemeTimer) {
      clearInterval(this.visemeTimer);
      this.visemeTimer = null;
    }
    this.callbacks.onViseme?.(0);
  }

  stop(): void {
    this.cancelCurrentUtterance();
    this.synth?.cancel();
    this.callbacks.onSpeakEnd?.();
  }

  pause(): void {
    this.synth?.pause();
  }

  resume(): void {
    this.synth?.resume();
  }
}

// ASR 配置接口
export interface ASRConfig {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
  maxAlternatives?: number;
}

type ASRStartOptions = {
  onResult?: (text: string) => void;
  mode?: 'command' | 'dictation';
};

// 语音识别服务
export class ASRService {
  private recognition: SpeechRecognitionLike | null = null;
  private isSupportedFlag: boolean;
  private config: ASRConfig;
  private sendToBackend: boolean = true;
  private tts: TTSService;
  private state: ASRStateAdapter;
  private onResultCallback: ((text: string) => void) | null = null;
  private mode: 'command' | 'dictation' = 'command';
  private pendingRestartTimer: ReturnType<typeof setTimeout> | null = null;
  private recognitionGeneration = 0;
  private dialogue: DialogueRuntime;

  constructor(
    config: ASRConfig = {},
    state: ASRStateAdapter,
    tts: TTSService,
    dialogue: DialogueRuntime,
  ) {
    this.isSupportedFlag =
      typeof window !== 'undefined' &&
      ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window);
    this.config = {
      lang: config.lang ?? 'zh-CN',
      continuous: config.continuous ?? false,
      interimResults: config.interimResults ?? true,
      maxAlternatives: config.maxAlternatives ?? 1,
    };
    this.state = state;
    this.tts = tts;
    this.dialogue = dialogue;

    if (this.isSupportedFlag && typeof window !== 'undefined') {
      this.initRecognition();
    }
  }

  setSendToBackend(send: boolean): void {
    this.sendToBackend = send;
  }

  checkSupport(): boolean {
    return this.isSupportedFlag;
  }

  private initRecognition(): void {
    const SpeechRecognition =
      (
        window as unknown as {
          webkitSpeechRecognition?: SpeechRecognitionConstructor;
          SpeechRecognition?: SpeechRecognitionConstructor;
        }
      ).webkitSpeechRecognition ||
      (window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor }).SpeechRecognition;
    if (!SpeechRecognition) return;

    this.recognitionGeneration++;
    const currentGeneration = this.recognitionGeneration;

    this.recognition = new SpeechRecognition();

    this.recognition.continuous = this.config.continuous!;
    this.recognition.interimResults = this.config.interimResults!;
    this.recognition.lang = this.config.lang!;
    this.recognition.maxAlternatives = this.config.maxAlternatives!;

    this.recognition.onstart = () => {
      if (currentGeneration !== this.recognitionGeneration) return;
      this.state.setBehavior('listening');
    };

    this.recognition.onresult = (event: SpeechRecognitionEventLike) => {
      if (currentGeneration !== this.recognitionGeneration) return;

      let finalTranscript = '';

      const startIndex = event.resultIndex ?? 0;
      for (let i = startIndex; i < event.results.length; i++) {
        const result = event.results[i] as SpeechRecognitionResultLike & { isFinal?: boolean };
        const transcript = result?.[0]?.transcript ?? '';
        const isFinal = result?.isFinal ?? false;
        if (isFinal) {
          finalTranscript += transcript;
        }
      }

      if (finalTranscript) {
        if (this.onResultCallback) {
          this.onResultCallback(finalTranscript);
        }
        if (this.mode === 'command') {
          void this.processVoiceInput(finalTranscript);
        }
      }
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
      if (currentGeneration !== this.recognitionGeneration) return;

      logger.error('语音识别错误:', event.error);
      const errorMsg = this.getErrorMessage(event.error);
      this.state.setRecording(false);
      this.state.setBehavior('idle');
      this.state.setError(errorMsg);
    };

    this.recognition.onend = () => {
      if (currentGeneration !== this.recognitionGeneration) return;

      this.state.setRecording(false);
      this.state.setBehavior('idle');
    };
  }

  private getErrorMessage(error: string): string {
    const errorMessages: Record<string, string> = {
      'no-speech': '未检测到语音，请重试',
      'audio-capture': '无法访问麦克风，请检查权限',
      'not-allowed': '麦克风权限被拒绝',
      network: '网络错误，请检查连接',
      aborted: '语音识别被中断',
      'language-not-supported': '不支持当前语言',
    };
    return errorMessages[error] || `语音识别失败: ${error}`;
  }

  start(options?: ASRStartOptions): boolean {
    if (!this.isSupportedFlag) {
      logger.warn('浏览器不支持语音识别');
      this.state.setError('浏览器不支持语音识别功能，请使用 Chrome 或 Edge 浏览器');
      return false;
    }

    if (!this.recognition) {
      this.initRecognition();
    }

    if (!this.recognition) {
      this.state.setError('语音识别初始化失败');
      return false;
    }

    if (this.pendingRestartTimer) {
      clearTimeout(this.pendingRestartTimer);
      this.pendingRestartTimer = null;
    }

    this.onResultCallback = options?.onResult ?? null;
    this.mode = options?.mode ?? 'command';

    try {
      this.recognition.start();
      this.state.setRecording(true);
      return true;
    } catch (error: unknown) {
      logger.error('启动语音识别失败:', error);
      this.state.setRecording(false);

      if (error instanceof Error && error.message?.includes('already started')) {
        this.recognition.stop();
        this.pendingRestartTimer = setTimeout(() => {
          this.pendingRestartTimer = null;
          this.start(options);
        }, 100);
        return true;
      }

      this.state.setError('启动语音识别失败');
      return false;
    }
  }

  stop(): void {
    if (this.pendingRestartTimer) {
      clearTimeout(this.pendingRestartTimer);
      this.pendingRestartTimer = null;
    }
    // 先递增 generation，使异步 onend/onerror 回调早退，
    // 再由这里统一重置状态（与 abort() 对齐）。
    this.recognitionGeneration++;
    if (this.recognition && this.isSupportedFlag) {
      try {
        this.recognition.stop();
      } catch (_e) {
        // 忽略停止错误
      }
    }
    this.onResultCallback = null;
    this.mode = 'command';
    this.state.setRecording(false);
    this.state.setBehavior('idle');
  }

  dispose(): void {
    this.stop();
    this.recognition = null;
    this.onResultCallback = null;

    if (this.pendingRestartTimer) {
      clearTimeout(this.pendingRestartTimer);
      this.pendingRestartTimer = null;
    }

    this.recognitionGeneration++;
  }

  abort(): void {
    if (this.pendingRestartTimer) {
      clearTimeout(this.pendingRestartTimer);
      this.pendingRestartTimer = null;
    }
    if (this.recognition && this.isSupportedFlag) {
      try {
        this.recognition.abort();
      } catch (_e) {
        // 忽略中断错误
      }
    }
    this.state.setRecording(false);
    this.state.setBehavior('idle');
  }

  private async processVoiceInput(text: string): Promise<void> {
    if (this.sendToBackend) {
      await this.sendToDialogueService(text);
    }
  }

  private async sendToDialogueService(text: string): Promise<void> {
    try {
      await this.dialogue.runDialogueTurn(text, {
        sessionId: this.state.sessionId,
        isMuted: this.state.isMuted,
        speakWith: (textToSpeak) => this.tts.speak(textToSpeak),
        onAddUserMessage: (t) => {
          this.state.addChatMessage?.('user', t);
        },
        onAddAssistantMessage: (replyText) => {
          this.state.addChatMessage?.('assistant', replyText);
        },
        onResetBehavior: () => {
          if (this.state.currentBehavior === 'thinking') {
            this.state.setBehavior('idle');
          }
        },
      });
    } catch (error: unknown) {
      logger.error('对话服务错误:', error);
      this.state.setError('对话服务暂时不可用，请稍后重试');
      this.state.setBehavior('idle');
    }
  }
}
