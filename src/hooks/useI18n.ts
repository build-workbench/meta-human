import { useCallback } from 'react';
import { t, type TranslationKey } from '@/lib/i18n';

export function useI18n() {
  const translate = useCallback(
    (key: TranslationKey, replacements?: Record<string, string>) => t(key, replacements),
    [],
  );

  return { t: translate };
}
