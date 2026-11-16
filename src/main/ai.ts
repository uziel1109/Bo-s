// Integración OPCIONAL con la API de Claude (Anthropic). Desactivada por defecto.
// - La clave API nunca se incluye en el código: el usuario la introduce y se guarda cifrada con el llavero del sistema.
// - Solo se envía el resumen de datos que el usuario puede ver antes de activar la función; nunca fotos
//   de progreso. Las fotos de comida solo se envían cuando el usuario elige analizar una foto concreta.
import fs from 'node:fs';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import type { KeyStore } from './secure';
import * as claude from '../shared/ai/claude';
import { DEFAULT_MODEL } from '../shared/ai/claude';

export { DEFAULT_MODEL } from '../shared/ai/claude';

export class AIService {
  private keyFile: string;
  private cfgFile: string;

  constructor(
    private dir: string,
    private ks: KeyStore | null,
  ) {
    this.keyFile = path.join(dir, 'ai.key.enc');
    this.cfgFile = path.join(dir, 'ai.json');
  }

  config(): { enabled: boolean; model: string; hasKey: boolean; secureStorage: boolean } {
    let cfg = { enabled: false, model: DEFAULT_MODEL };
    try {
      cfg = { ...cfg, ...JSON.parse(fs.readFileSync(this.cfgFile, 'utf8')) };
    } catch {
      /* sin configuración */
    }
    return { ...cfg, hasKey: fs.existsSync(this.keyFile), secureStorage: !!this.ks?.isEncryptionAvailable() };
  }

  setConfig(c: { enabled?: boolean; model?: string }) {
    const cur = this.config();
    fs.mkdirSync(this.dir, { recursive: true });
    fs.writeFileSync(this.cfgFile, JSON.stringify({ enabled: c.enabled ?? cur.enabled, model: (c.model || cur.model).trim() }));
  }

  setKey(key: string) {
    if (!this.ks?.isEncryptionAvailable()) throw new Error('El llavero del sistema no está disponible: no es posible guardar la clave de forma segura en este equipo.');
    if (!key.trim()) throw new Error('Clave vacía.');
    fs.mkdirSync(this.dir, { recursive: true });
    fs.writeFileSync(this.keyFile, this.ks.encryptString(key.trim()));
  }

  clearKey() {
    if (fs.existsSync(this.keyFile)) fs.rmSync(this.keyFile);
  }

  private client(): Anthropic {
    const c = this.config();
    if (!c.enabled) throw new Error('La integración de IA está desactivada.');
    if (!c.hasKey || !this.ks) throw new Error('No hay una clave API configurada.');
    const apiKey = this.ks.decryptString(fs.readFileSync(this.keyFile));
    return new Anthropic({ apiKey });
  }

  async chat(question: string, context: string, history: { role: 'user' | 'assistant'; content: string }[]): Promise<string> {
    return claude.chat(this.client(), this.config().model, question, context, history);
  }

  async foodPhoto(imageBase64: string, mediaType: 'image/jpeg' | 'image/png' | 'image/webp', foodNames: string[]) {
    return claude.foodPhoto(this.client(), this.config().model, imageBase64, mediaType, foodNames);
  }
}
