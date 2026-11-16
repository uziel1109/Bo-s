// Compilación de la versión web instalable (PWA) para iPad y navegadores.
import { resolve } from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import pkg from './package.json';
import { cspPlugin, WEB_CSP } from './build/csp';

export default defineConfig({
  root: 'src/renderer',
  base: './',
  publicDir: 'public',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  resolve: { alias: { '@shared': resolve('src/shared'), '@renderer': resolve('src/renderer/src') } },
  plugins: [react(), cspPlugin(WEB_CSP)],
  build: { outDir: resolve('dist-web'), emptyOutDir: true, target: 'safari16' },
});
