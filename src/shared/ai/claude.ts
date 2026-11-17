// Llamadas a Claude (Anthropic) compartidas por escritorio y web. Reciben un cliente ya configurado.
import type Anthropic from '@anthropic-ai/sdk';
import { foodAnalysisPrompt } from './prompts';

export const DEFAULT_MODEL = 'claude-opus-5-5';

const SYSTEM = `Eres el asistente de BODY OS, una aplicación personal de recomposición corporal (pérdida de grasa con preservación y ganancia de músculo).
Reglas:
- Responde en español, de forma concreta y breve, usando los datos del usuario que se te proporcionan.
- Distingue explícitamente entre DATOS (registrados), ESTIMACIONES (fórmulas), HIPÓTESIS y RECOMENDACIONES. Marca cada punto con [Dato], [Estimación], [Hipótesis] o [Recomendación].
- No inventes datos, estudios ni cifras. Si falta información, dilo.
- No sustituyes a un médico. Ante síntomas, condiciones de salud o medicamentos, recomienda valoración profesional.
- Nunca recomiendes dietas extremas, deshidratación, fármacos, hormonas, "quemadores" ni sustancias peligrosas.
- Los cambios al plan solo se sugieren; el usuario debe confirmarlos dentro de la app.`;

type History = { role: 'user' | 'assistant'; content: string }[];

async function send(client: Anthropic, model: string, content: Anthropic.Beta.BetaMessageContentParam, history: History = []): Promise<string> {
  // Respaldo del lado del servidor: si el modelo rechaza la solicitud, la API la reintenta con otro modelo.
  const response = await client.beta.messages.create({
    model: model || DEFAULT_MODEL,
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

export function chat(client: Anthropic, model: string, question: string, context: string, history: History): Promise<string> {
  return send(client, model, `Datos actuales del usuario (generados por BODY OS):\n${context}\n\nPregunta: ${question}`, history.slice(-10));
}

/**
 * Analiza la foto de un plato. La IA identifica el platillo y sus elementos, estima los gramos y,
 * cuando puede, los asocia a un alimento de la base del usuario (por id). Para lo que no está en la base
 * da valores aproximados por 100 g. El resultado se normaliza y valida en photoAnalysis.ts.
 */
export async function analyzeFoodPhoto(
  client: Anthropic,
  model: string,
  imageBase64: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp',
  foods: { id: string; name: string }[],
  planHint?: string,
): Promise<string> {
  return send(client, model, [
    { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
    {
      type: 'text',
      text: foodAnalysisPrompt(foods, { planHint }),
    },
  ]);
}
