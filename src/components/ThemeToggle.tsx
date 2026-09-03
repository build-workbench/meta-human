import { useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme, type Theme } from '@/hooks';

interface ThemeToggleProps {
  className?: string;
  /**
   * dropdown（默认）：图标按钮 + 弹出三档菜单，用于导航栏/抽屉头部。
   * segmented：内联三键分段控件，无弹出层——用于 overflow-hidden 容器内
   * （如移动端折叠菜单），弹出菜单会被裁剪。
   */
  variant?: 'dropdown' | 'segmented';
}

const OPTIONS: Array<{ value: Theme; label: string; icon: typeof Sun }> = [
  { value: 'light', label: '浅色', icon: Sun },
  { value: 'dark', label: '深色', icon: Moon },
  { value: 'system', label: '跟随系统', icon: Monitor },
];

export default function ThemeToggle({ className = '', variant = 'dropdown' }: ThemeToggleProps) {
  const { theme = 'system', isDark, setTheme } = useTheme();
  const [open, setOpen] = useState(false);

  if (variant === 'segmented') {
    return (
      <div
        role="radiogroup"
        aria-label="主题"
        className={`inline-flex items-center gap-0.5 rounded-lg border border-white/10 bg-white/5 p-0.5 light:border-zinc-900/10 light:bg-zinc-900/5 ${className}`}
      >
        {OPTIONS.map(({ value, label, icon: Icon }) => {
          const active = theme === value;
          return (
            <button
              key={value}
              role="radio"
              aria-checked={active}
              title={label}
              aria-label={label}
              onClick={() => setTheme(value)}
              className={`rounded-md p-1.5 transition-colors ${
                active
                  ? 'bg-blue-500/20 text-blue-400 light:bg-blue-500/15 light:text-blue-700'
                  : 'text-gray-400 hover:text-white light:text-zinc-500 light:hover:text-zinc-900'
              }`}
            >
              <Icon className="h-4 w-4" />
            </button>
          );
        })}
      </div>
    );
  }

  const label = isDark ? '切换到浅色模式' : '切换到深色模式';

  const pick = (value: Theme) => {
    setTheme(value);
    setOpen(false);
  };

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-white/10 hover:text-white light:text-zinc-500 light:hover:bg-zinc-900/5 light:hover:text-zinc-900"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </button>

      {open && (
        <>
          {/* 点击菜单外任意处关闭 */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            role="menu"
            aria-label="主题"
            className="absolute right-0 top-full z-50 mt-2 w-32 rounded-xl border border-white/10 bg-black/90 p-1 shadow-xl backdrop-blur-md light:border-zinc-900/10 light:bg-white light:shadow-zinc-900/10"
          >
            {OPTIONS.map(({ value, label: text, icon: Icon }) => (
              <button
                key={value}
                role="menuitemradio"
                aria-checked={theme === value}
                onClick={() => pick(value)}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
                  theme === value
                    ? 'bg-blue-500/15 text-blue-400 light:bg-blue-500/10 light:text-blue-700'
                    : 'text-gray-300 hover:bg-white/10 light:text-zinc-700 light:hover:bg-zinc-900/5'
                }`}
              >
                <Icon className="h-4 w-4" />
                {text}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
