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
