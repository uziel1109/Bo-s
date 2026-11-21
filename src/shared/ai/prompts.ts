// Instrucciones para la IA compartidas por la conexión directa (clave de API) y el modo gratis de copiar y pegar
// con la app de Claude. No dependen del SDK.

/** Instrucciones para analizar una comida (foto adjunta y/o descripción escrita). */
export function foodAnalysisPrompt(foods: { id: string; name: string }[], opts: { planHint?: string; description?: string; manual?: boolean } = {}): string {
  const intro = opts.manual
    ? `Analiza mi comida${opts.description ? ` (lo que comí: ${opts.description})` : ''}. Si adjunto una foto, úsala; si no, usa solo mi descripción.`
    : 'Analiza la foto de este plato de comida.';
  return `${intro}
1. Identifica el platillo (nombre común en México) y cada elemento por separado (proteína, guarnición, tortillas, salsa, aceite, bebida…).
2. Estima los gramos de cada elemento tal como se sirvió (cocinado). Usa referencias visuales (plato ~26 cm, cubiertos, tortilla ~14 cm) o las cantidades que te di. Si dudas, elige un valor intermedio y baja la confianza.
3. Si el elemento corresponde a un alimento de esta lista, pon su "foodId" exacto (elige la preparación correcta, p. ej. cocido vs crudo); si no corresponde a ninguno, foodId = null y da "per100g" aproximado (kcal, protein, carbs, fat, fiber por 100 g) con valores de referencia típicos.
Lista (id: nombre):
${foods.map((f) => `${f.id}: ${f.name}`).join('\n')}
${opts.planHint ? `\nPlan de esta comida (solo como contexto, NO asumas que coincide): ${opts.planHint}` : ''}
Responde SOLO con JSON válido${opts.manual ? ' dentro de un bloque de código' : ', sin texto adicional'}:
{"dish":"nombre del platillo","items":[{"name":"...","grams":120,"foodId":"id"|null,"per100g":{"kcal":0,"protein":0,"carbs":0,"fat":0,"fiber":0}|null,"confidence":"alta"|"media"|"baja"}],"note":"advertencias breves (aceite oculto, salsas, porción no visible)"}`;
}

/** Texto para pegar en la app de Claude con tus datos, para hacer preguntas sin usar la API. */
export function coachPrompt(summary: string, question?: string): string {
  return `Eres mi asistente de recomposición corporal (bajar grasa conservando y ganando músculo). Responde en español, breve y concreto, usando solo mis datos. Marca cada punto como [Dato], [Estimación], [Hipótesis] o [Recomendación]. No inventes cifras ni estudios; si falta información, dilo. No sustituyes a un médico y no recomiendes dietas extremas, fármacos ni "quemadores".

Mis datos actuales (exportados de mi app BODY OS):
${summary}

${question ? `Mi pregunta: ${question}` : 'Mi pregunta: '}`;
}
