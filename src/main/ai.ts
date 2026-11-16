// Integración OPCIONAL con la API de Claude (Anthropic). Desactivada por defecto.
// - La clave API nunca se incluye en el código: el usuario la introduce y se guarda cifrada con el llavero del sistema.
// - Solo se envía el resumen de datos que el usuario puede ver antes de activar la función; nunca fotos
//   de progreso. Las fotos de comida solo se envían cuando el usuario elige analizar una foto concreta.
import fs from 'node:fs';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import type { KeyStore } from './secure';

export const DEFAULT_MODEL = 'claude-opus-5-5';

const SYSTEM = `Eres el asistente de BODY OS, una aplicación personal de recomposición corporal (pérdida de grasa con preservación y ganancia de músculo).
Reglas:
- Responde en español, de forma concreta y breve, usando los datos del usuario que se te proporcionan.
- Distingue explícitamente entre DATOS (registrados), ESTIMACIONES (fórmulas), HIPÓTESIS y RECOMENDACIONES. Marca cada punto con [Dato], [Estimación], [Hipótesis] o [Recomendación].
- No inventes datos, estudios ni cifras. Si falta información, dilo.
- No sustituyes a un médico. Ante síntomas, condiciones de salud o medicamentos, recomienda valoración profesional.
- Nunca recomiendes dietas extremas, deshidratación, fármacos, hormonas, "quemadores" ni sustancias peligrosas.
- Los cambios al plan solo se sugieren; el usuario debe confirmarlos dentro de la app.`;

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

  private async send(content: Anthropic.Beta.BetaMessageContentParam, history: { role: 'user' | 'assistant'; content: string }[] = []): Promise<string> {
    const client = this.client();
    const model = this.config().model || DEFAULT_MODEL;
    // Respaldo del lado del servidor: si el modelo rechaza la solicitud, la API la reintenta con otro modelo.
    const response = await client.beta.messages.create({
      model,
      max_tokens: 4000,
      output_config: { effort: 'medium' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      messages: [...history.map((h) => ({ role: h.role, content: h.content })), { role: 'user', content }],
    });
    if (response.stop_reason === 'refusal') return 'La IA no pudo responder a esta solicitud.';
    return response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
  }

  async chat(question: string, context: string, history: { role: 'user' | 'assistant'; content: string }[]): Promise<string> {
    return this.send(`Datos actuales del usuario (generados por BODY OS):\n${context}\n\nPregunta: ${question}`, history.slice(-10));
  }

  /** Analiza una foto de comida. Devuelve candidatos que el usuario debe confirmar y editar. */
  async foodPhoto(imageBase64: string, mediaType: 'image/jpeg' | 'image/png' | 'image/webp', foodNames: string[]): Promise<{ items: { name: string; grams: number; matchName: string | null }[]; note: string }> {
    const text = await this.send([
      { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
      {
        type: 'text',
        text: `Identifica los alimentos de la foto y estima los gramos de cada uno. Las estimaciones visuales tienen error alto; sé conservador.
Si un alimento coincide con uno de esta lista, usa su nombre exacto en "matchName"; si no, null:
${foodNames.join('; ')}
Responde SOLO con JSON: {"items":[{"name":"...","grams":123,"matchName":"..."|null}],"note":"advertencias breves"}`,
      },
    ]);
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('La respuesta de la IA no tuvo el formato esperado.');
    const parsed = JSON.parse(m[0]);
    const items = Array.isArray(parsed.items) ? parsed.items : [];
    return {
      items: items
        .filter((i: { name?: unknown; grams?: unknown }) => typeof i.name === 'string' && Number(i.grams) > 0)
        .map((i: { name: string; grams: number; matchName?: string | null }) => ({ name: i.name, grams: Math.round(Number(i.grams)), matchName: i.matchName ?? null })),
      note: typeof parsed.note === 'string' ? parsed.note : '',
    };
  }
}
