// Llamadas a Claude (Anthropic) compartidas por escritorio y web. Reciben un cliente ya configurado.
import type Anthropic from '@anthropic-ai/sdk';

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

export type FoodPhotoResult = { items: { name: string; grams: number; matchName: string | null }[]; note: string };

/** Analiza una foto de comida. Devuelve candidatos que el usuario debe confirmar y editar. */
export async function foodPhoto(client: Anthropic, model: string, imageBase64: string, mediaType: 'image/jpeg' | 'image/png' | 'image/webp', foodNames: string[]): Promise<FoodPhotoResult> {
  const text = await send(client, model, [
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
