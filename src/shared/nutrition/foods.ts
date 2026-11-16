// Cálculos con alimentos: macros por porción, sumas, filtros por alergias y sustituciones equivalentes.
import type { Food, FoodLog, Macros } from '../types';
import { round } from '../utils';

export function foodTags(f: Food): string[] {
  try {
    return f.tags ? (JSON.parse(f.tags) as string[]) : [];
  } catch {
    return [];
  }
}

export function macrosFor(f: Pick<Food, 'kcal' | 'protein' | 'carbs' | 'fat' | 'fiber'>, grams: number): Macros {
  const k = grams / 100;
  return {
    kcal: round(f.kcal * k),
    protein: round(f.protein * k, 1),
    carbs: round(f.carbs * k, 1),
    fat: round(f.fat * k, 1),
    fiber: round(f.fiber * k, 1),
  };
}

export function sumMacros(items: Partial<Macros>[]): Macros {
  const t = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  for (const i of items) {
    t.kcal += i.kcal ?? 0;
    t.protein += i.protein ?? 0;
    t.carbs += i.carbs ?? 0;
    t.fat += i.fat ?? 0;
    t.fiber += i.fiber ?? 0;
  }
  return { kcal: round(t.kcal), protein: round(t.protein, 1), carbs: round(t.carbs, 1), fat: round(t.fat, 1), fiber: round(t.fiber, 1) };
}

/** Coherencia energética: kcal declaradas vs. 4/4/9 (Atwater). Útil para validar alimentos personalizados. */
export function atwaterCheck(f: Pick<Food, 'kcal' | 'protein' | 'carbs' | 'fat'>): { computed: number; diffPct: number; ok: boolean } {
  const computed = f.protein * 4 + f.carbs * 4 + f.fat * 9;
  const diffPct = f.kcal > 0 ? ((computed - f.kcal) / f.kcal) * 100 : 0;
  // Margen amplio: la fibra, el alcohol y los factores específicos de Atwater generan diferencias legítimas.
  return { computed: round(computed), diffPct: round(diffPct, 1), ok: Math.abs(diffPct) <= 20 || Math.abs(computed - f.kcal) <= 12 };
}

export function validateFood(f: Partial<Food>): string[] {
  const errs: string[] = [];
  if (!f.name || !f.name.trim()) errs.push('El nombre es obligatorio.');
  for (const k of ['kcal', 'protein', 'carbs', 'fat', 'fiber'] as const) {
    const v = f[k];
    if (v == null || Number.isNaN(Number(v)) || Number(v) < 0) errs.push(`Valor inválido en ${k}.`);
  }
  if ((f.protein ?? 0) + (f.carbs ?? 0) + (f.fat ?? 0) > 100.5) errs.push('Proteína + carbohidratos + grasa no pueden superar 100 g por cada 100 g.');
  if ((f.kcal ?? 0) > 900) errs.push('Las kcal por 100 g no pueden superar 900.');
  if ((f.fiber ?? 0) > (f.carbs ?? 0) + 0.5 && (f.carbs ?? 0) > 0) errs.push('La fibra no debería superar los carbohidratos totales (verifica si la etiqueta los separa).');
  return errs;
}

/** Excluye alimentos con alérgenos o exclusiones del perfil. */
export function filterFoodsForProfile(foods: Food[], allergies: string[], excluded: string[]): Food[] {
  const blocked = new Set(allergies);
  if (blocked.has('gluten')) blocked.add('gluten_trazas');
  const excl = new Set(excluded);
  return foods.filter((f) => !excl.has(f.id) && !foodTags(f).some((t) => blocked.has(t)));
}

export function logFromFood(f: Food, grams: number): Omit<FoodLog, 'id' | 'date' | 'meal'> {
  const m = macrosFor(f, grams);
  return { food_id: f.id, name: f.name, grams, ...m };
}

export function searchFoods(foods: Food[], q: string): Food[] {
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const terms = norm(q).split(/\s+/).filter(Boolean);
  if (!terms.length) return foods;
  return foods
    .map((f) => {
      const n = norm(f.name);
      const score = terms.reduce((s, t) => s + (n.startsWith(t) ? 3 : n.includes(t) ? 1 : -100), 0);
      return { f, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.f);
}

export type MainMacro = 'protein' | 'carbs' | 'fat';

export function mainMacro(f: Food): MainMacro {
  const p = f.protein * 4;
  const c = f.carbs * 4;
  const fa = f.fat * 9;
  if (p >= c && p >= fa) return 'protein';
  if (fa >= c) return 'fat';
  return 'carbs';
}

export interface Substitute {
  food: Food;
  grams: number;
  macros: Macros;
  diff: Macros;
}

/**
 * Sustituciones equivalentes: alimentos de la misma categoría (o con el mismo macro principal)
 * en la cantidad que iguala el macronutriente principal del original.
 */
export function substitutes(original: Food, grams: number, pool: Food[], limit = 8): Substitute[] {
  const macro = mainMacro(original);
  const base = macrosFor(original, grams);
  const target = base[macro];
  if (target <= 0) return [];
  return pool
    .filter((f) => f.id !== original.id && (f.category === original.category || mainMacro(f) === macro) && f[macro] > 0)
    .map((f) => {
      const g = Math.round(((target / f[macro]) * 100) / 5) * 5;
      const m = macrosFor(f, g);
      return {
        food: f,
        grams: g,
        macros: m,
        diff: { kcal: round(m.kcal - base.kcal), protein: round(m.protein - base.protein, 1), carbs: round(m.carbs - base.carbs, 1), fat: round(m.fat - base.fat, 1), fiber: round(m.fiber - base.fiber, 1) },
      };
    })
    .filter((s) => s.grams > 0 && s.grams <= 600)
    .sort((a, b) => Math.abs(a.diff.kcal) - Math.abs(b.diff.kcal))
    .slice(0, limit);
}
