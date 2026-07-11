/**
 * 服务容器 Provider。
 */

import { useEffect, useRef, type ReactNode } from 'react';
import { createServices, disposeServices, type Services } from '@/core/createServices';
import { applyRuntimeApiEndpoints } from '@/core/dialogue/dialogueService';
import { useSystemStore } from '@/store/systemStore';
import { ServicesContext } from './servicesContext';

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
