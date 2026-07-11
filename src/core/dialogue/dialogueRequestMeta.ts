import type { Language } from '@/lib/i18n';

export type DialogueSpeechContext = {
  voiceName: string | null;
  rate: number;
  pitch: number;
  volume: number;
};

export type DialogueRequestMetaInput = {
  timestamp: number;
  language: Language;
  speech: DialogueSpeechContext;
  characterId?: string;
};

export function buildDialogueRequestMeta({
  timestamp,
  language,
  speech,
  characterId,
}: DialogueRequestMetaInput): Record<string, unknown> {
  const meta: Record<string, unknown> = {
    timestamp,
    language,
    speech: {
      voiceName: speech.voiceName,
      rate: speech.rate,
      pitch: speech.pitch,
      volume: speech.volume,
    },
  };
  if (characterId) {
    meta.characterId = characterId;
  }
  return meta;
}
