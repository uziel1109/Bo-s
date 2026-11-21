// Uso de recetas dentro del plan de comidas: calcula cuántas porciones caben en una comida y la convierte
// en una comida planificada con sus ingredientes en gramos.
import type { Food, Macros, MealSlot } from '../types';
import type { PlannedDay, PlannedMeal } from './mealPlanner';
import { macrosFor, sumMacros } from './foods';
import { clamp, round } from '../utils';

export interface RecipeLike {
  id: string;
  name: string;
  servings: number;
  items: { foodId: string; grams: number }[];
}

export function recipePerServing(r: RecipeLike, foods: Food[]): Macros {
  const byId = new Map(foods.map((f) => [f.id, f]));
  const t = sumMacros(r.items.map((i) => (byId.get(i.foodId) ? macrosFor(byId.get(i.foodId)!, i.grams) : {})));
  const s = Math.max(0.25, r.servings);
  return { kcal: Math.round(t.kcal / s), protein: round(t.protein / s, 1), carbs: round(t.carbs / s, 1), fat: round(t.fat / s, 1), fiber: round(t.fiber / s, 1) };
}

/** Porciones (en cuartos, 0.5–2.5) que mejor se ajustan a las calorías de la comida. */
export function portionsFor(perServing: Macros, target: Macros): number {
  if (perServing.kcal <= 0) return 1;
  return clamp(Math.round((target.kcal / perServing.kcal) * 4) / 4, 0.5, 2.5);
}

/** Qué tan bien encaja una receta en la comida (0 = perfecto). Pesa más la proteína. */
export function recipeFit(perServing: Macros, target: Macros): { portions: number; error: number; macros: Macros } {
  const portions = portionsFor(perServing, target);
  const m = { kcal: perServing.kcal * portions, protein: perServing.protein * portions, carbs: perServing.carbs * portions, fat: perServing.fat * portions, fiber: perServing.fiber * portions };
  const rel = (a: number, b: number) => (b > 0 ? Math.abs(a - b) / b : 0);
  const error = rel(m.kcal, target.kcal) + 1.5 * rel(m.protein, target.protein) + 0.5 * rel(m.carbs, target.carbs) + 0.5 * rel(m.fat, target.fat);
  return { portions, error: round(error, 3), macros: { kcal: Math.round(m.kcal), protein: round(m.protein, 1), carbs: round(m.carbs, 1), fat: round(m.fat, 1), fiber: round(m.fiber, 1) } };
}

export function recipeToMeal(r: RecipeLike, foods: Food[], slot: MealSlot, target: Macros, portions?: number): PlannedMeal {
  const byId = new Map(foods.map((f) => [f.id, f]));
  const p = portions ?? portionsFor(recipePerServing(r, foods), target);
  const k = p / Math.max(0.25, r.servings);
  const items = r.items
    .filter((i) => byId.has(i.foodId))
    .map((i) => {
      const f = byId.get(i.foodId)!;
      const grams = Math.round(i.grams * k);
      return { foodId: f.id, name: f.name, grams, macros: macrosFor(f, grams) };
    });
  return { slot, title: `${r.name} (${p.toLocaleString('es-MX')} porción${p === 1 ? '' : 'es'})`, items, totals: sumMacros(items.map((i) => i.macros)), target };
}

export function replaceMeal(day: PlannedDay, mealIndex: number, meal: PlannedMeal): PlannedDay {
  const meals = day.meals.map((m, i) => (i === mealIndex ? meal : m));
  const t = sumMacros(meals.map((m) => m.totals));
  return { ...day, meals, totals: { kcal: Math.round(t.kcal), protein: round(t.protein, 1), carbs: round(t.carbs, 1), fat: round(t.fat, 1), fiber: round(t.fiber, 1) } };
}
