import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useTheme, useThemeStore } from '@/hooks/useTheme';

// setup.ts 的 matchMedia mock 恒返回 matches: false → 系统主题为 light
describe('useTheme', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.className = '';
    useThemeStore.setState({ theme: 'system', systemTheme: 'light' });
  });

  it('falls back to system theme when persisted theme is invalid', () => {
    window.localStorage.setItem('theme', 'sepia');

    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe('system');
    expect(result.current.resolvedTheme).toBe('light');
    expect(document.documentElement.classList.contains('sepia')).toBe(false);
    expect(window.localStorage.getItem('theme')).toBe('system');
  });

  it('toggles between light and dark, applying class and persisting', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.isDark).toBe(false);

    act(() => result.current.toggleTheme());

    expect(result.current.theme).toBe('dark');
    expect(result.current.resolvedTheme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('light')).toBe(false);
    expect(window.localStorage.getItem('theme')).toBe('dark');

    act(() => result.current.toggleTheme());

    expect(result.current.resolvedTheme).toBe('light');
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(window.localStorage.getItem('theme')).toBe('light');
  });

  it('shares state across consumers', () => {
    const first = renderHook(() => useTheme());
    const second = renderHook(() => useTheme());

    act(() => first.result.current.toggleTheme());

    expect(second.result.current.isDark).toBe(true);
  });

  it('resolves system theme from matchMedia and persists the choice', () => {
    const { result } = renderHook(() => useTheme());

    act(() => result.current.setTheme('system'));

    expect(result.current.theme).toBe('system');
    expect(result.current.resolvedTheme).toBe('light');
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(window.localStorage.getItem('theme')).toBe('system');
  });
});
