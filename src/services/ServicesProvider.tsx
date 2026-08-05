/**
 * 服务容器 Provider。
 *
 * 自有服务在 effect 中创建：StrictMode 双挂载时 cleanup 销毁旧实例后，
 * 第二次 setup 会重建新实例，消费者不会拿到已 dispose 的服务。
 */

import { useEffect, useState, type ReactNode } from 'react';
import { createServices, disposeServices, type Services } from '@/core/createServices';
import { applyRuntimeApiEndpoints } from '@/core/dialogue/dialogueService';
import { useSystemStore } from '@/store/systemStore';
import { ServicesContext } from './servicesContext';

interface ServicesProviderProps {
  children: ReactNode;
  services?: Services;
}

export function ServicesProvider({ children, services }: ServicesProviderProps) {
  const [owned, setOwned] = useState<Services | null>(null);

  useEffect(() => {
    if (services) return;
    const created = createServices();
    setOwned(created);
    return () => {
      disposeServices(created);
      setOwned(null);
    };
  }, [services]);

  useEffect(() => {
    if (services) return;
    const { runtimeApiConfig } = useSystemStore.getState();
    if (runtimeApiConfig?.baseUrl) {
      applyRuntimeApiEndpoints(runtimeApiConfig.baseUrl, runtimeApiConfig.fallbacks ?? '');
    }
  }, [services]);

  const svc = services ?? owned;
  if (!svc) return null;

  return <ServicesContext.Provider value={svc}>{children}</ServicesContext.Provider>;
}
