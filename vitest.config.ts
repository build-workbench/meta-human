import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

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
        'src/__tests__/setup.ts',
        '**/*.d.ts',
        '**/*.config.ts',
        '**/*.config.js',
      ],
      include: ['src/**/*.{ts,tsx}'],
      // 阈值设在实际水平略下方，防止覆盖率无声回退（当前实际约 62/70/75/62）。
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
