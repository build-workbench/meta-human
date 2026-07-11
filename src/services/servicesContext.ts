import { createContext, useContext } from 'react';
import type { Services } from '@/core/createServices';
import { DigitalHumanEngine } from '@/core/avatar/DigitalHumanEngine';
import { TTSService, ASRService } from '@/core/audio/audioService';
import { DialogueOrchestrator } from '@/core/dialogue/dialogueOrchestrator';

export const ServicesContext = createContext<Services | null>(null);

export function useServices(): Services {
  const services = useContext(ServicesContext);
  if (!services) {
    throw new Error('useServices must be used within ServicesProvider');
  }
  return services;
}

export function useEngine(): DigitalHumanEngine {
  return useServices().engine;
}

export function useTTS(): TTSService {
  return useServices().tts;
}

export function useASR(): ASRService {
  return useServices().asr;
}

export function useDialogue(): DialogueOrchestrator {
  return useServices().dialogue;
}
