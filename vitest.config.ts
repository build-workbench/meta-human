import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

// 宿主 shell 可能导出 NODE_ENV=production，会让 jsdom 加载 React 生产构建
// （无 act API，Testing Library 全部报 React.act is not a function）。
// 在配置加载期强制为 test，保证测试在任何环境下行为一致。
process.env.NODE_ENV = 'test';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/__tests__/**',
        '**/*.d.ts',
        '**/*.config.ts',
        '**/*.config.js',
      ],
      include: ['src/**/*.{ts,tsx}'],
      // 阈值设在实际水平略下方，防止覆盖率无声回退（当前实际约 67/78/74/67）。
      thresholds: {
        lines: 60,
        functions: 68,
        branches: 73,
        statements: 60,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
