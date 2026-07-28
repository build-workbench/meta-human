import { useDigitalHumanStore } from '@/store/digitalHumanStore';
import { useSystemStore } from '@/store/systemStore';
import type { BehaviorType, EmotionType, ExpressionType } from '@/core/avatar/avatarContract';
import { mouthOpenSignal } from '@/core/avatar/mouthOpenSignal';

export interface TTSCallbacks {
  onSpeakStart?: () => void;
  onSpeakEnd?: () => void;
  onError?: (message: string) => void;
  onViseme?: (open: number) => void;
}

export interface SpeechRecognitionStateAdapter {
  setRecording(recording: boolean): void;
  setBehavior(behavior: string): void;
  setError(message: string): void;
}

export interface SpeechPlaybackStateAdapter {
  setSpeaking(speaking: boolean): void;
  play(): void;
  pause(): void;
  reset(): void;
  setMuted(muted: boolean): void;
}

export interface SpeechAvatarStateAdapter {
  setEmotion(emotion: string): void;
  setExpression(expression: string): void;
  setAnimation(animation: string): void;
}

export type ASRStateAdapter = SpeechRecognitionStateAdapter &
  SpeechPlaybackStateAdapter &
  SpeechAvatarStateAdapter;

export function createTTSCallbacks(): TTSCallbacks {
  return {
    onSpeakStart: () => {
      useDigitalHumanStore.getState().setSpeaking(true);
      useDigitalHumanStore.getState().setBehavior('speaking');
    },
    onSpeakEnd: () => {
      useDigitalHumanStore.getState().setSpeaking(false);
      useDigitalHumanStore.getState().setBehavior('idle');
      mouthOpenSignal.reset();
    },
    onError: (message) => {
      useSystemStore.getState().setError(message);
    },
    onViseme: (open) => {
      mouthOpenSignal.set(open);
    },
  };
}

export function createASRStateAdapter(): ASRStateAdapter {
  return {
    setRecording: (recording) => useDigitalHumanStore.getState().setRecording(recording),
    setBehavior: (behavior) =>
      useDigitalHumanStore.getState().setBehavior(behavior as BehaviorType),
    setSpeaking: (speaking) => useDigitalHumanStore.getState().setSpeaking(speaking),
    setError: (message) => useSystemStore.getState().setError(message),
    setEmotion: (emotion) => useDigitalHumanStore.getState().setEmotion(emotion as EmotionType),
    setExpression: (expression) =>
      useDigitalHumanStore.getState().setExpression(expression as ExpressionType),
    setAnimation: (animation) => useDigitalHumanStore.getState().setAnimation(animation),
    play: () => useDigitalHumanStore.getState().play(),
    pause: () => useDigitalHumanStore.getState().pause(),
    reset: () => useDigitalHumanStore.getState().reset(),
    setMuted: (muted) => useDigitalHumanStore.getState().setMuted(muted),
  };
}
