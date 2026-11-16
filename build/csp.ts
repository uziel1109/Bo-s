// Políticas de seguridad de contenido (CSP) de cada plataforma, insertadas en index.html al compilar.
import type { Plugin } from 'vite';

export const DESKTOP_CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: bodyos-photo:; font-src 'self' data:; connect-src 'self'";
// Web: SQLite en WebAssembly necesita compilar wasm; fotos como blob:; únicas conexiones externas: Open Food Facts y Anthropic (opcionales).
export const WEB_CSP = "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; worker-src 'self'; manifest-src 'self'; connect-src 'self' https://world.openfoodfacts.org https://api.anthropic.com";

export function cspPlugin(csp: string): Plugin {
  return { name: 'bodyos-csp', transformIndexHtml: (html) => html.replace('%BODYOS_CSP%', csp) };
}
