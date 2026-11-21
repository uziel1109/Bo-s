// Hambre y saciedad: con tus calificaciones después de cada comida, detecta qué alimentos y qué
// combinaciones te dejan más satisfecho. Es un análisis personal y observacional (HIPÓTESIS), no causal.
//
// Referencias: la proteína y la fibra se asocian con mayor saciedad por caloría (Holt 1995, índice de
// saciedad; Leidy 2015); pero la respuesta individual varía mucho, por eso se usan tus propios datos.
import type { FoodLog, MealSlot } from '../types';
import { mean, round } from '../utils';

export interface MealRating {
  id: string; // `${date}_${meal}`
  date: string;
  meal: MealSlot;
  fullness: number; // 1 (me quedé con hambre) … 5 (me duró horas)
  notes?: string | null;
}

export const FULLNESS_LABEL = ['', 'Con hambre', 'Poco', 'Bien', 'Satisfecho', 'Me duró horas'];

export interface FoodSatiety {
  key: string; // food_id o nombre
  foodId: string | null;
  name: string;
  avg: number;
  n: number;
  delta: number; // diferencia con tu promedio general
}

export interface SatietyInsights {
  rated: number;
  overall: number | null;
  bySlot: { slot: MealSlot; avg: number; n: number }[];
  best: FoodSatiety[];
  worst: FoodSatiety[];
  protein: { high: number | null; low: number | null; nHigh: number; nLow: number; cut: number } | null;
  fiber: { high: number | null; low: number | null; nHigh: number; nLow: number; cut: number } | null;
  claims: string[];
}

export const MIN_RATINGS = 8;
const MIN_FOOD_N = 3;

export function satietyInsights(ratings: MealRating[], logs: FoodLog[], since?: string): SatietyInsights {
  const rs = ratings.filter((r) => r.fullness >= 1 && r.fullness <= 5 && (!since || r.date >= since));
  const byMeal = new Map<string, FoodLog[]>();
  for (const l of logs) {
    const k = `${l.date}_${l.meal}`;
    const a = byMeal.get(k) ?? [];
    a.push(l);
    byMeal.set(k, a);
  }
  const rated = rs.filter((r) => (byMeal.get(`${r.date}_${r.meal}`) ?? []).length > 0);
  const overall = rated.length ? round(mean(rated.map((r) => r.fullness)), 2) : null;
  const empty: SatietyInsights = { rated: rated.length, overall, bySlot: [], best: [], worst: [], protein: null, fiber: null, claims: [] };
  if (!rated.length) return empty;

  // Por comida del día
  const slots = new Map<MealSlot, number[]>();
  for (const r of rated) slots.set(r.meal, [...(slots.get(r.meal) ?? []), r.fullness]);
  const bySlot = [...slots.entries()].map(([slot, xs]) => ({ slot, avg: round(mean(xs), 2), n: xs.length }));

  // Por alimento: cada comida calificada cuenta una vez para cada alimento que contiene.
  const foods = new Map<string, { foodId: string | null; name: string; xs: number[] }>();
  for (const r of rated) {
    const seen = new Set<string>();
    for (const l of byMeal.get(`${r.date}_${r.meal}`)!) {
      const key = l.food_id ?? l.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const cur = foods.get(key) ?? { foodId: l.food_id ?? null, name: l.name, xs: [] };
      cur.xs.push(r.fullness);
      foods.set(key, cur);
    }
  }
  const list: FoodSatiety[] = [...foods.entries()]
    .filter(([, v]) => v.xs.length >= MIN_FOOD_N)
    .map(([key, v]) => {
      const avg = round(mean(v.xs), 2);
      return { key, foodId: v.foodId, name: v.name, avg, n: v.xs.length, delta: round(avg - overall!, 2) };
    });
  const best = list.filter((f) => f.delta >= 0.3).sort((a, b) => b.delta - a.delta || b.n - a.n).slice(0, 6);
  const worst = list.filter((f) => f.delta <= -0.3).sort((a, b) => a.delta - b.delta || b.n - a.n).slice(0, 4);

  // Proteína y fibra por comida
  const split = (pick: (ls: FoodLog[]) => number, cut: number) => {
    const hi: number[] = [];
    const lo: number[] = [];
    for (const r of rated) (pick(byMeal.get(`${r.date}_${r.meal}`)!) >= cut ? hi : lo).push(r.fullness);
    return { high: hi.length ? round(mean(hi), 2) : null, low: lo.length ? round(mean(lo), 2) : null, nHigh: hi.length, nLow: lo.length, cut };
  };
  const protein = split((ls) => ls.reduce((a, l) => a + l.protein, 0), 30);
  const fiber = split((ls) => ls.reduce((a, l) => a + l.fiber, 0), 8);

  const claims: string[] = [];
  if (rated.length < MIN_RATINGS) claims.push(`Llevas ${rated.length} comidas calificadas; con al menos ${MIN_RATINGS} empiezan a aparecer patrones confiables.`);
  if (protein.high != null && protein.low != null && protein.nHigh >= 3 && protein.nLow >= 3 && protein.high - protein.low >= 0.4)
    claims.push(`Las comidas con ≥ 30 g de proteína te dejan más satisfecho (${protein.high} vs ${protein.low} de 5).`);
  if (fiber.high != null && fiber.low != null && fiber.nHigh >= 3 && fiber.nLow >= 3 && fiber.high - fiber.low >= 0.4)
    claims.push(`Las comidas con ≥ 8 g de fibra te sacian más (${fiber.high} vs ${fiber.low} de 5).`);
  const lowSlot = bySlot.filter((s) => s.n >= 3).sort((a, b) => a.avg - b.avg)[0];
  if (lowSlot && overall != null && lowSlot.avg <= overall - 0.5) claims.push(`La comida que menos te llena es "${lowSlot.slot}". Prueba subir su proteína o verdura, o pasar calorías de otra comida a esa.`);
  return { rated: rated.length, overall, bySlot, best, worst, protein, fiber, claims };
}
