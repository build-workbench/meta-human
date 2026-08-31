import { describe, expect, it, beforeEach } from 'vitest';
import { useDigitalHumanStore } from '@/store/digitalHumanStore';

describe('digitalHumanStore.reset', () => {
  beforeEach(() => {
    useDigitalHumanStore.setState({
      isPlaying: false,
      autoRotate: false,
      currentAnimation: 'idle',
      isRecording: false,
      isMuted: false,
      isSpeaking: false,
      currentEmotion: 'neutral',
      currentExpression: 'neutral',
      expressionIntensity: 0.8,
      currentBehavior: 'idle',
    });
  });

  it('resets runtime state to defaults while keeping avatar & character choices', () => {
    const store = useDigitalHumanStore;
    store.setState({
      isPlaying: true,
      autoRotate: true,
      currentAnimation: 'dance',
      isRecording: true,
      isMuted: true,
      isSpeaking: true,
      currentEmotion: 'happy',
      currentExpression: 'smile',
      expressionIntensity: 1,
      currentBehavior: 'excited',
      activeCharacterId: 'serious-advisor',
      avatarSource: { kind: 'custom', modelUrl: 'blob:x', fileName: 'a.glb' },
    });

    store.getState().reset();

    const state = store.getState();
    expect(state.isPlaying).toBe(false);
    expect(state.autoRotate).toBe(false);
    expect(state.currentAnimation).toBe('idle');
    expect(state.isRecording).toBe(false);
    expect(state.isMuted).toBe(false);
    expect(state.isSpeaking).toBe(false);
    expect(state.currentEmotion).toBe('neutral');
    expect(state.currentExpression).toBe('neutral');
    expect(state.expressionIntensity).toBe(0.8);
    expect(state.currentBehavior).toBe('idle');

    // 用户主动选择的角色与头像来源保留
    expect(state.activeCharacterId).toBe('serious-advisor');
    expect(state.avatarSource).toEqual({
      kind: 'custom',
      modelUrl: 'blob:x',
      fileName: 'a.glb',
    });
  });
});
