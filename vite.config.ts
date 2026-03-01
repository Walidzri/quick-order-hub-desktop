import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import { copyFileSync, existsSync, readFileSync } from 'fs';
import { builtinModules } from 'module';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';

// Tous les modules Node.js natifs + packages npm du main process
// doivent être externalisés (non bundlés) pour Electron main process.
const electronExternals = [
  'electron',
  ...builtinModules,
  ...builtinModules.map(m => `node:${m}`),
  'fastify',
  '@fastify/cors',
  '@fastify/websocket',
  '@fastify/websocket/types',
  'ws',
];

// Read version from package.json
const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'));
const appVersion = packageJson.version;

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
          resolve: {
            alias: {
              // L'alias @shared doit être déclaré ici car le build du main process
              // n'hérite pas automatiquement du resolve.alias du config racine
              '@shared': path.resolve(__dirname, './packages/shared'),
            },
          },
          build: {
            sourcemap: mode === 'development', // Only sourcemaps in dev
            minify: mode === 'production',
            outDir: 'dist-electron',
            rollupOptions: {
              // Externaliser electron + tous les builtins Node.js + packages Fastify
              // Les imports relatifs (./) et les chemins absolus (alias résolus) sont bundlés
              external: electronExternals,
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
      '@shared': path.resolve(__dirname, './packages/shared'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Use relative paths for assets in production (Electron)
    base: './',
  },
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
}));
