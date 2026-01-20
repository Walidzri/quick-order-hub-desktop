import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import { copyFileSync, existsSync } from 'fs';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';

export default defineConfig(({ mode }) => ({
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  plugins: [
    react(),
    electron([
      {
        entry: 'electron/main.ts',
        onstart(options) {
          // Start Electron when Vite dev server is ready
          options.startup();
        },
        vite: {
          build: {
            sourcemap: mode === 'development', // Only sourcemaps in dev
            minify: mode === 'production',
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['electron'],
            },
          },
        },
      },
      {
        entry: 'electron/preload.ts',
        onstart(options) {
          options.reload();
          // Always copy preload.cjs to dist-electron (CommonJS version)
          const preloadCjs = path.resolve(__dirname, 'electron/preload.cjs');
          const distPreloadCjs = path.resolve(__dirname, 'dist-electron/preload.cjs');
          if (existsSync(preloadCjs)) {
            try {
              copyFileSync(preloadCjs, distPreloadCjs);
              console.log('[VITE] ✅ Copied preload.cjs to dist-electron');
            } catch (error) {
              console.error('[VITE] ❌ Failed to copy preload.cjs:', error);
            }
          } else {
            console.warn('[VITE] ⚠️ preload.cjs not found in electron/ directory');
          }
        },
        vite: {
          build: {
            sourcemap: 'inline',
            minify: mode === 'production',
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['electron'],
              output: {
                format: 'cjs',
                entryFileNames: 'preload.js',
                exports: 'auto',
              },
            },
            commonjsOptions: {
              transformMixedEsModules: true,
            },
          },
        },
      },
    ]),
    renderer(),
  ].filter(Boolean),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Use relative paths for assets in production (Electron)
    base: './',
  },
}));
