import { resolve } from 'path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import pkg from './package.json';
import { cspPlugin, DESKTOP_CSP } from './build/csp';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: { '@shared': resolve('src/shared') } },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    root: 'src/renderer',
    resolve: { alias: { '@shared': resolve('src/shared'), '@renderer': resolve('src/renderer/src') } },
    plugins: [react(), cspPlugin(DESKTOP_CSP)],
    define: { __APP_VERSION__: JSON.stringify(pkg.version) },
    build: { rollupOptions: { input: resolve('src/renderer/index.html') } },
  },
});
