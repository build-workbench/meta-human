/**
 * 服务容器 Provider + Context + Hooks。
 *
 * 通过 React Context 提供应用级单例服务。
 */

import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { createServices, disposeServices, type Services } from '@/core/createServices';
import { applyRuntimeApiEndpoints } from '@/core/dialogue/dialogueService';
import { useSystemStore } from '@/store/systemStore';
import { DigitalHumanEngine } from '@/core/avatar/DigitalHumanEngine';
import { TTSService, ASRService } from '@/core/audio/audioService';
import { DialogueOrchestrator } from '@/core/dialogue/dialogueOrchestrator';

export const ServicesContext = createContext<Services | null>(null);

interface ServicesProviderProps {
  children: ReactNode;
  services?: Services;
}

export function ServicesProvider({ children, services }: ServicesProviderProps) {
  const ownedRef = useRef<Services | null>(null);

  if (services === undefined && ownedRef.current === null) {
    ownedRef.current = createServices();
  }

  const svc = services ?? ownedRef.current!;

  useEffect(() => {
    if (services) return;
    const { runtimeApiConfig } = useSystemStore.getState();
    if (runtimeApiConfig?.baseUrl) {
      applyRuntimeApiEndpoints(runtimeApiConfig.baseUrl, runtimeApiConfig.fallbacks ?? '');
    }
  }, [services]);

  useEffect(() => {
    if (services) return;
    return () => {
      if (ownedRef.current) {
        disposeServices(ownedRef.current);
        ownedRef.current = null;
      }
    };
  }, [services]);

  return <ServicesContext.Provider value={svc}>{children}</ServicesContext.Provider>;
}

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
