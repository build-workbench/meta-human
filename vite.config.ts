import { defineConfig, Plugin, ResolvedConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

/**
 * HTML 转换插件：替换模板变量
 * 将 ${BASE_URL} 替换为完整的部署 URL
 */
function htmlTransformPlugin(): Plugin {
  let config: ResolvedConfig;

  return {
    name: 'html-transform',
    configResolved(resolvedConfig) {
      config = resolvedConfig;
    },
    transformIndexHtml(html) {
      // 根据构建 base 判断是否为 GitHub Pages 部署
      const isPages = config.base === '/meta-human/';
      const baseUrl = isPages
        ? 'https://vibe-knight.github.io/meta-human/'
        : 'http://localhost:5173/';

      return html.replace(/\$\{BASE_URL\}/g, baseUrl);
    },
  };
}

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production' || mode === 'pages';
  const isPages = mode === 'pages';

  return {
    base: isPages ? '/meta-human/' : '/',

    css: {
      transformer: 'lightningcss',
      lightningcss: {
        targets: {
          chrome: 105 << 16,
          safari: 16 << 16,
          ios_saf: 16 << 16,
          firefox: 105 << 16,
        },
      },
    },

    esbuild: {
      // 生产环境移除 debug/info/log，保留 warn/error（与 logger 设计一致）。
      pure: isProduction ? ['console.debug', 'console.info', 'console.log'] : [],
    },

    plugins: [
      react({
        jsxImportSource: 'react',
      }),
      tailwindcss(),
      htmlTransformPlugin(),
    ].filter(Boolean),

    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },

    build: {
      outDir: 'dist',
      sourcemap: false,
      cssCodeSplit: true,
      cssMinify: 'lightningcss',
      assetsInlineLimit: 5120,
      emptyOutDir: true,
      chunkSizeWarningLimit: 1500,
      target: 'es2020',
      minify: 'esbuild',
      rollupOptions: {
        output: {
          // 不做手工分包（manualChunks）：此前把 three 归入独立 chunk 时，
          // Rollup 共享 helper 也被塞进该 chunk，导致入口为拿 helper 静态 import
          // 整个 three-vendor（283KB gzip），落地页被迫首屏加载。
          // 交由 Rollup 按依赖图自动分包：three 自然落入 AdvancedDigitalHumanPage
          // 的 lazy chunk，首屏 388KB → 111KB gzip（2026-09-02 实测，见 ROADMAP.md）。
          entryFileNames: 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',
        },
      },
    },

    server: {
      host: '0.0.0.0',
      port: 5173,
      open: true,
    },

    preview: {
      host: '0.0.0.0',
      port: 4173,
    },
  };
});
