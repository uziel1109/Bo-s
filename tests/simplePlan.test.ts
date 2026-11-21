import { describe, expect, it } from 'vitest';
import { seedFoods } from '../src/shared/nutrition/foodsSeed';
import { BRAND_FOODS } from '../src/shared/nutrition/brandFoods';
import { filterFoodsForProfile } from '../src/shared/nutrition/foods';
import { generateMealPlan, planAccuracy, regenerateMeal } from '../src/shared/nutrition/mealPlanner';
import type { Food } from '../src/shared/types';

const foods = [...seedFoods(), ...BRAND_FOODS] as Food[];
const targets = { kcal: 2200, protein: 170, carbs: 220, fat: 70, fiber: 30 };

describe('Plan sencillo (días de trabajo)', () => {
  for (const meals of [3, 4, 5])
    it(`${meals} comidas: pocas comidas distintas, rápidas y que dan los macros`, () => {
      for (const seed of [0, 3, 11]) {
        const plan = generateMealPlan({ foods, targets, mealsPerDay: meals, days: 7, preferred: [], budget: 'medio', seed, style: 'sencillo' });
        expect(plan.style).toBe('sencillo');
        expect(plan.days.length).toBe(7);
        const bySlot = new Map<string, Set<string>>();
        for (const d of plan.days) {
          const acc = planAccuracy(d, targets);
          expect(Math.abs(acc.kcal), `${meals}/${seed} ${JSON.stringify(acc)}`).toBeLessThanOrEqual(10);
          expect(Math.abs(acc.protein), `${meals}/${seed} ${JSON.stringify(acc)}`).toBeLessThanOrEqual(12);
          for (const m of d.meals) {
            expect(m.prep, m.title).toBeTruthy();
            expect(m.items.length, m.title).toBeLessThanOrEqual(4);
            const key = m.slot;
            if (!bySlot.has(key)) bySlot.set(key, new Set());
            bySlot.get(key)!.add(JSON.stringify(m.items.map((i) => [i.foodId, i.grams])));
          }
        }
        // Desayuno y colaciones: siempre lo mismo. Comida y cena: alternan entre 2.
        for (const [slot, variants] of bySlot) expect(variants.size, slot).toBeLessThanOrEqual(slot === 'comida' || slot === 'cena' ? 2 : 1);
        // Solo hay 2 tipos de día.
        expect(new Set(plan.days.map((d) => JSON.stringify(d.meals.map((m) => m.items)))).size).toBeLessThanOrEqual(2);
        expect(plan.notes.join(' ')).toMatch(/fin de semana/);
      }
    });

  it('necesita muchos menos ingredientes que el plan variado', () => {
    const count = (style: 'variado' | 'sencillo') => new Set(generateMealPlan({ foods, targets, mealsPerDay: 4, days: 7, preferred: [], budget: 'medio', seed: 2, style }).days.flatMap((d) => d.meals.flatMap((m) => m.items.map((i) => i.foodId)))).size;
    const simple = count('sencillo');
    const varied = count('variado');
    expect(simple).toBeLessThanOrEqual(18);
    expect(simple).toBeLessThan(varied * 0.7);
  });

  it('con alergias a huevo y lácteos sigue armando todas las comidas', () => {
    const pool = filterFoodsForProfile(foods, ['huevo', 'lacteos'], []);
    const plan = generateMealPlan({ foods: pool, targets, mealsPerDay: 5, days: 7, preferred: [], budget: 'bajo', style: 'sencillo' });
    expect(plan.days.every((d) => d.meals.length === 5)).toBe(true);
    const ids = plan.days.flatMap((d) => d.meals.flatMap((m) => m.items.map((i) => i.foodId)));
    expect(ids.some((i) => ['huevo_entero', 'clara_huevo', 'yogur_griego_0', 'cottage_2', 'queso_fresco', 'leche_descremada', 'leche_entera', 'xgear_zero_carbs', 'proteina_whey'].includes(i))).toBe(false);
  });

  it('regenerar una comida del plan sencillo da otra opción rápida', () => {
    const plan = generateMealPlan({ foods, targets, mealsPerDay: 4, days: 7, preferred: [], budget: 'medio', style: 'sencillo' });
    for (const meal of plan.days[0].meals) {
      const fresh = regenerateMeal({ foods, meal, preferred: [], budget: 'medio', seed: 7, style: 'sencillo' })!;
      expect(fresh.prep, meal.title).toBeTruthy();
      expect(fresh.title).not.toBe(meal.title);
    }
  });
});
