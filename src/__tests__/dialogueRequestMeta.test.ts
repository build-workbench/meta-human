import { describe, expect, it } from 'vitest';
import { buildDialogueRequestMeta } from '@/core/dialogue/dialogueRequestMeta';

describe('buildDialogueRequestMeta', () => {
  it('collects language and speech settings', () => {
    const meta = buildDialogueRequestMeta({
      timestamp: 1_700_000_000_000,
      language: 'en',
      speech: {
        voiceName: 'English Voice',
        rate: 1.1,
        pitch: 0.9,
        volume: 0.7,
      },
    });

    expect(meta).toEqual({
      timestamp: 1_700_000_000_000,
      language: 'en',
      speech: {
        voiceName: 'English Voice',
        rate: 1.1,
        pitch: 0.9,
        volume: 0.7,
      },
    });
  });

  it('includes characterId when provided', () => {
    const meta = buildDialogueRequestMeta({
      timestamp: 1_700_000_000_000,
      language: 'zh-CN',
      speech: { voiceName: null, rate: 1, pitch: 1, volume: 0.8 },
      characterId: 'serious-advisor',
    });

    expect(meta.characterId).toBe('serious-advisor');
  });

  it('omits characterId when not provided', () => {
    const meta = buildDialogueRequestMeta({
      timestamp: 1_700_000_000_000,
      language: 'zh-CN',
      speech: { voiceName: null, rate: 1, pitch: 1, volume: 0.8 },
    });

    expect('characterId' in meta).toBe(false);
  });
});
