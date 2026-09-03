import { useCallback, useEffect } from 'react';
import { create } from 'zustand';

export type Theme = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';
const VALID_THEMES: ReadonlySet<Theme> = new Set(['light', 'dark', 'system']);
const THEME_STORAGE_KEY = 'theme';

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveTheme(theme: Theme, systemTheme: ResolvedTheme): ResolvedTheme {
  return theme === 'system' ? systemTheme : theme;
}

function isValidTheme(value: string | null): value is Theme {
  return value !== null && VALID_THEMES.has(value as Theme);
}

function getStoredTheme(): Theme {
  try {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    return isValidTheme(storedTheme) ? storedTheme : 'system';
  } catch {
    return 'system';
  }
}

function setStoredTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore storage write failures
  }
}

interface ThemeState {
  theme: Theme;
  systemTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  setSystemTheme: (systemTheme: ResolvedTheme) => void;
}

/**
 * 模块级单例：落地页导航栏、设置抽屉、Toaster 等多个消费者共享同一状态。
 * 若各自 useState，后挂载的实例会在 effect 里覆盖先挂载实例写入的 class。
 */
export const useThemeStore = create<ThemeState>()((set) => ({
  theme: getStoredTheme(),
  systemTheme: getSystemTheme(),
  setTheme: (theme) => {
    setStoredTheme(theme);
    set({ theme });
  },
  setSystemTheme: (systemTheme) => set({ systemTheme }),
}));

function applyThemeClass(resolved: ResolvedTheme): void {
  document.documentElement.classList.remove('light', 'dark');
  document.documentElement.classList.add(resolved);
  // 移动端浏览器状态栏颜色跟随主题
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', resolved === 'light' ? '#f4f5f9' : '#000000');
}

export function useTheme() {
  const theme = useThemeStore((s) => s.theme);
  const systemTheme = useThemeStore((s) => s.systemTheme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const setSystemTheme = useThemeStore((s) => s.setSystemTheme);

  const resolved = resolveTheme(theme, systemTheme);

  // 同步 <html> class；顺带把存储值归一化（启动时清除非法值）
  useEffect(() => {
    applyThemeClass(resolved);
    setStoredTheme(theme);
  }, [theme, resolved]);

  // system 模式下跟随系统偏好变化
  useEffect(() => {
    if (theme !== 'system') return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => setSystemTheme(getSystemTheme());
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [theme, setSystemTheme]);

  const toggleTheme = useCallback(() => {
    const { theme: prev, systemTheme: sys, setTheme: set } = useThemeStore.getState();
    set(resolveTheme(prev, sys) === 'light' ? 'dark' : 'light');
  }, []);

  return {
    theme,
    resolvedTheme: resolved,
    setTheme,
    toggleTheme,
    isDark: resolved === 'dark',
  };
}
