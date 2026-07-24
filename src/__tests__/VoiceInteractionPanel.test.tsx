import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import VoiceInteractionPanel from '@/components/VoiceInteractionPanel';

vi.mock('@/hooks/useVoiceInteraction', () => ({
  useVoiceInteraction: () => ({
    isSupported: true,
    isRecording: false,
    isMuted: false,
    transcript: '',
    availableVoices: [],
    voice: null,
    volume: 0.8,
    pitch: 1,
    rate: 1,
    setVolume: vi.fn(),
    setPitch: vi.fn(),
    setRate: vi.fn(),
    setVoice: vi.fn(),
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
    toggleRecording: vi.fn(),
    toggleMute: vi.fn(),
    speak: vi.fn(),
  }),
}));

describe('VoiceInteractionPanel', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders Chinese quick test content', () => {
    render(<VoiceInteractionPanel onTranscript={vi.fn()} />);

    expect(screen.getByRole('button', { name: '您好！我是数字人助手。' })).toBeInTheDocument();
  });
});
