// Normalización y validación de la respuesta de la IA al analizar la foto de un plato.
// Las calorías y macros se calculan con los alimentos verificados de la base cuando hay coincidencia;
// solo lo que no existe en la base usa los valores aproximados de la IA (marcados como estimados).
import type { Food, Macros } from '../types';
import { macrosFor, validateFood } from './foods';

export type Confidence = 'alta' | 'media' | 'baja';

export interface DetectedItem {
  name: string;
  grams: number;
  foodId: string | null; // coincidencia con la base (valores verificados)
  per100: Omit<Macros, never> | null; // solo si no hay coincidencia
  confidence: Confidence;
  source: 'base' | 'estimado_ia';
}

export interface PhotoAnalysis {
  dish: string;
  items: DetectedItem[];
  note: string;
  warnings: string[];
}

function extractJson(text: string): unknown {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('La respuesta de la IA no tuvo el formato esperado.');
  try {
    return JSON.parse(m[0]);
  } catch {
    throw new Error('La respuesta de la IA no es JSON válido.');
  }
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v));

export function parsePhotoAnalysis(text: string, foods: Food[]): PhotoAnalysis {
  const raw = extractJson(text) as { dish?: unknown; items?: unknown; note?: unknown };
  const byId = new Map(foods.map((f) => [f.id, f]));
  const warnings: string[] = [];
  const items: DetectedItem[] = [];
  for (const it of Array.isArray(raw.items) ? raw.items : []) {
    const r = it as Record<string, unknown>;
    const name = typeof r.name === 'string' ? r.name.trim() : '';
    const grams = Math.round(num(r.grams));
    if (!name || !(grams > 0) || grams > 2000) continue;
    const confidence: Confidence = r.confidence === 'alta' || r.confidence === 'baja' ? r.confidence : 'media';
    const id = typeof r.foodId === 'string' && byId.has(r.foodId) ? r.foodId : null;
    if (id) {
      items.push({ name, grams, foodId: id, per100: null, confidence, source: 'base' });
      continue;
    }
    const p = (r.per100g ?? null) as Record<string, unknown> | null;
    const per100 = p ? { kcal: num(p.kcal), protein: num(p.protein), carbs: num(p.carbs), fat: num(p.fat), fiber: num(p.fiber ?? 0) || 0 } : null;
    if (!per100 || validateFood({ name, ...per100 }).length) {
      warnings.push(`"${name}": la IA no dio valores nutricionales válidos; asígnale un alimento de tu base o edítalo.`);
      items.push({ name, grams, foodId: null, per100: null, confidence: 'baja', source: 'estimado_ia' });
    } else items.push({ name, grams, foodId: null, per100, confidence, source: 'estimado_ia' });
  }
  if (!items.length) warnings.push('No se identificaron alimentos en la foto.');
  return { dish: typeof raw.dish === 'string' ? raw.dish : 'Platillo', items, note: typeof raw.note === 'string' ? raw.note : '', warnings };
}

/** Macros de un elemento detectado (con el alimento verificado de la base si existe). */
export function itemMacros(it: Pick<DetectedItem, 'foodId' | 'per100' | 'grams'>, foods: Food[]): Macros | null {
  const f = it.foodId ? foods.find((x) => x.id === it.foodId) : null;
  if (f) return macrosFor(f, it.grams);
  if (it.per100) return macrosFor(it.per100, it.grams);
  return null;
}

export interface PlanComparison {
  matched: { foodId: string; name: string; planned: number; detected: number }[];
  missing: { foodId: string; name: string; planned: number }[];
  extra: string[];
}

/** Qué del plan está en el plato y qué no (por alimento). */
export function compareWithPlan(items: DetectedItem[], plan: { foodId: string; name: string; grams: number }[]): PlanComparison {
  const matched: PlanComparison['matched'] = [];
  const missing: PlanComparison['missing'] = [];
  const used = new Set<number>();
  for (const p of plan) {
    const idx = items.findIndex((i, k) => !used.has(k) && i.foodId === p.foodId);
    if (idx >= 0) {
      used.add(idx);
      matched.push({ foodId: p.foodId, name: p.name, planned: p.grams, detected: items[idx].grams });
    } else missing.push({ foodId: p.foodId, name: p.name, planned: p.grams });
  }
  const extra = items.filter((_, k) => !used.has(k)).map((i) => i.name);
  return { matched, missing, extra };
}

// ───────────────────────── Respuestas pegadas (modo gratis con la app de Claude)

const FRACTIONS: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 };

/** "1½" → 1.5, "2,5" → 2.5, "~250" → 250. */
function parseAmount(s: string): number | null {
  const m = s.match(/(\d+(?:[.,]\d+)?)?\s*([½¼¾⅓⅔])?/);
  if (!m || (!m[1] && !m[2])) return null;
  return (m[1] ? Number(m[1].replace(',', '.')) : 0) + (m[2] ? FRACTIONS[m[2]] : 0);
}

/** Gramos a partir de una cantidad escrita: "~250 g (1½ taza)", "150 ml", "2 cdas", "1 taza". */
export function gramsFromQuantity(q: string): number | null {
  const t = q.toLowerCase();
  const g = t.match(/(\d+(?:[.,]\d+)?)\s*(g|gr|grs|gramos|ml)\b/);
  if (g) return Number(g[1].replace(',', '.'));
  const kg = t.match(/(\d+(?:[.,]\d+)?)\s*(kg|l|litros?)\b/);
  if (kg) return Number(kg[1].replace(',', '.')) * 1000;
  const unit = t.match(/([\d.,½¼¾⅓⅔\s]+)\s*(cditas?|cucharaditas?|cdas?|cucharadas?|tazas?|vasos?)/);
  if (unit) {
    const n = parseAmount(unit[1].trim());
    if (n == null) return null;
    const u = unit[2];
    const per = /cdita|cucharadita/.test(u) ? 5 : /cda|cucharada/.test(u) ? 15 : /vaso/.test(u) ? 250 : 240;
    return Math.round(n * per);
  }
  return null;
}

/**
 * Lee una tabla pegada (columnas: alimento, cantidad, kcal, proteína, carbohidratos, grasa), como las que
 * escribe una IA en el chat. Ignora encabezados y la fila de total. Los macros se toman tal cual de la tabla.
 */
export function parseFoodTable(text: string): PhotoAnalysis | null {
  const items: DetectedItem[] = [];
  const warnings: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*\|?\s*:?-{2,}/.test(line)) continue; // separador de tabla markdown
    const cells = line
      .split(/\t|\s{2,}|\|/)
      .map((c) => c.trim())
      .filter(Boolean);
    if (cells.length < 5) continue;
    const name = cells[0].replace(/\*\*/g, '').trim();
    if (!name || /^(total|totales|suma)\b/i.test(name) || !/\d/.test(cells.slice(1).join(' '))) continue;
    const nums = cells.slice(-4).map((c) => Number((c.match(/-?\d+(?:[.,]\d+)?/)?.[0] ?? 'NaN').replace(',', '.')));
    if (nums.some((n) => !Number.isFinite(n) || n < 0)) continue;
    const [kcal, protein, carbs, fat] = nums;
    const qty = cells.length >= 6 ? cells[1] : '';
    let grams = gramsFromQuantity(qty);
    let note = false;
    if (!grams || grams <= 0) {
      grams = 100;
      note = true;
    }
    const k = 100 / grams;
    const per100 = { kcal: Math.round(kcal * k), protein: Math.round(protein * k * 10) / 10, carbs: Math.round(carbs * k * 10) / 10, fat: Math.round(fat * k * 10) / 10, fiber: 0 };
    if (per100.kcal > 900 || per100.protein + per100.carbs + per100.fat > 100.5) {
      warnings.push(`"${name}": los valores no son coherentes con la cantidad; revísalo.`);
      continue;
    }
    if (note) warnings.push(`"${name}": no se entendió la cantidad; se registra como 1 porción con los macros de la tabla.`);
    items.push({ name, grams: Math.round(grams), foodId: null, per100, confidence: 'media', source: 'estimado_ia' });
  }
  if (!items.length) return null;
  return { dish: 'Comida', items, note: 'Valores tomados de la tabla que pegaste.', warnings };
}

/** Respuesta pegada de la app de Claude: primero intenta el JSON; si no hay, una tabla. */
export function parsePastedAnswer(text: string, foods: Food[]): PhotoAnalysis {
  if (/\{[\s\S]*"items"[\s\S]*\}/.test(text)) {
    try {
      return parsePhotoAnalysis(text, foods);
    } catch {
      /* se intenta como tabla */
    }
  }
  const t = parseFoodTable(text);
  if (t) return t;
  throw new Error('No se encontró el formato esperado. Copia la respuesta completa de Claude (el bloque de código) o una tabla con alimento, cantidad, kcal, proteína, carbohidratos y grasa.');
}
