import { describe, expect, it } from 'vitest';
import initSqlJs from 'sql.js';
import { LocalDB } from '../src/shared/db/localdb';
import { seedFoods } from '../src/shared/nutrition/foodsSeed';
import { SEED_RECIPES } from '../src/shared/nutrition/recipesSeed';
import { BRAND_FOODS } from '../src/shared/nutrition/brandFoods';
import { syncSeedFoods } from '../src/shared/nutrition/seedSync';
import { syncSeedRecipes } from '../src/shared/nutrition/seedSync';
import { recipeFit, recipePerServing, recipeToMeal, replaceMeal } from '../src/shared/nutrition/recipeUse';
import { buildMealPrep } from '../src/shared/nutrition/mealPrep';
import { generateMealPlan, regenerateMeal } from '../src/shared/nutrition/mealPlanner';
import { satietyInsights, type MealRating } from '../src/shared/analytics/satiety';
import type { Food, FoodLog } from '../src/shared/types';
import { addDays } from '../src/shared/utils';

const foods = [...seedFoods(), ...BRAND_FOODS] as Food[];
const ids = new Set(foods.map((f) => f.id));

describe('Recetas incluidas', () => {
  it('todos los ingredientes existen en la base verificada y los macros por porción son razonables', () => {
    expect(SEED_RECIPES.length).toBeGreaterThanOrEqual(20);
    expect(new Set(SEED_RECIPES.map((r) => r.id)).size).toBe(SEED_RECIPES.length);
    for (const r of SEED_RECIPES) {
      for (const i of r.items) expect(ids.has(i.foodId), `${r.name}: ${i.foodId}`).toBe(true);
      const per = recipePerServing(r, foods);
      expect(per.kcal, r.name).toBeGreaterThan(180);
      expect(per.kcal, r.name).toBeLessThan(800);
      expect(per.protein, r.name).toBeGreaterThanOrEqual(15);
      expect(r.notes.length).toBeGreaterThan(10);
    }
  });

  it('se insertan una sola vez: si el usuario borra una, no reaparece', async () => {
    const SQL = await initSqlJs();
    const db = new LocalDB(SQL, null, () => {});
    expect(syncSeedRecipes(db)).toBe(SEED_RECIPES.length);
    db.remove('recipes', SEED_RECIPES[0].id);
    expect(syncSeedRecipes(db)).toBe(0);
    expect(db.get('recipes', SEED_RECIPES[0].id)).toBeNull();
    expect(db.list('recipes').length).toBe(SEED_RECIPES.length - 1);
  });

  it('ajusta las porciones a la comida y reemplaza la comida del plan', () => {
    const tinga = SEED_RECIPES.find((r) => r.id === 'rec_seed_tinga')!;
    const per = recipePerServing(tinga, foods);
    const target = { kcal: per.kcal * 1.5, protein: per.protein * 1.5, carbs: per.carbs * 1.5, fat: per.fat * 1.5, fiber: 8 };
    const fit = recipeFit(per, target);
    expect(fit.portions).toBe(1.5);
    expect(fit.error).toBeLessThan(0.1);
    const meal = recipeToMeal(tinga, foods, 'comida', target, fit.portions);
    expect(Math.abs(meal.totals.kcal - target.kcal)).toBeLessThan(target.kcal * 0.03);
    const plan = generateMealPlan({ foods, targets: { kcal: 2200, protein: 170, carbs: 220, fat: 70, fiber: 30 }, mealsPerDay: 4, days: 2, preferred: [], budget: 'medio', seed: 3 });
    const mi = plan.days[0].meals.findIndex((m) => m.slot === 'comida');
    const day = replaceMeal(plan.days[0], mi, meal);
    expect(day.meals[mi].title).toContain('Tinga');
    const sum = day.meals.reduce((a, m) => a + m.totals.kcal, 0);
    expect(Math.abs(day.totals.kcal - sum)).toBeLessThan(2);
  });
});

describe('Preparación de comidas', () => {
  const plan = generateMealPlan({ foods, targets: { kcal: 2200, protein: 170, carbs: 220, fat: 70, fiber: 30 }, mealsPerDay: 4, days: 7, preferred: [], budget: 'medio', seed: 7 });

  it('suma los cocidos de los días elegidos y convierte a crudo/seco', () => {
    const prep = buildMealPrep(plan, foods, [0, 1, 2]);
    expect(prep.days).toEqual([0, 1, 2]);
    expect(prep.batches.length).toBeGreaterThan(0);
    for (const b of prep.batches) {
      let expected = 0;
      for (const d of plan.days.filter((x) => x.index <= 2)) for (const m of d.meals) for (const it of m.items) if (it.foodId === b.foodId) expected += it.grams;
      expect(Math.abs(b.cookedGrams - expected)).toBeLessThanOrEqual(1);
      if (b.foodId === 'arroz_blanco_cocido') expect(b.rawGrams).toBe(Math.round(b.cookedGrams * 0.38));
    }
    // Los más tardados (leguminosas) van primero.
    const orders = prep.batches.map((b) => b.info.order);
    expect([...orders].sort((a, b) => a - b)).toEqual(orders);
    expect(prep.containers.every((c) => c.cooked.length > 0)).toBe(true);
    expect(prep.warnings.some((w) => w.includes('día 5'))).toBe(false);
  });

  it('marca para congelar lo que se come después del día 4', () => {
    const prep = buildMealPrep(plan, foods, [0, 1, 2, 3, 4, 5]);
    expect(prep.containers.filter((c) => c.dayNumber >= 5).every((c) => c.freeze)).toBe(true);
    expect(prep.containers.filter((c) => c.dayNumber <= 2).some((c) => c.freeze)).toBe(false);
    expect(prep.warnings.join(' ')).toMatch(/congela/i);
  });
});

describe('Saciedad', () => {
  it('detecta los alimentos y patrones que más llenan', () => {
    const logs: FoodLog[] = [];
    const ratings: MealRating[] = [];
    const base = '2026-11-01';
    for (let i = 0; i < 12; i++) {
      const date = addDays(base, i);
      // Comida con pollo y frijol (alta proteína y fibra): llena más.
      logs.push({ id: `a${i}`, date, meal: 'comida', food_id: 'pollo_pechuga_cocida', name: 'Pollo', grams: 150, kcal: 250, protein: 46, carbs: 0, fat: 5, fiber: 0 });
      logs.push({ id: `b${i}`, date, meal: 'comida', food_id: 'frijol_negro_cocido', name: 'Frijol', grams: 150, kcal: 200, protein: 13, carbs: 35, fat: 1, fiber: 13 });
      ratings.push({ id: `${date}_comida`, date, meal: 'comida', fullness: 5 });
      // Colación de pan dulce: poca saciedad.
      logs.push({ id: `c${i}`, date, meal: 'colacion2', food_id: 'pan_dulce', name: 'Pan dulce', grams: 80, kcal: 320, protein: 5, carbs: 50, fat: 12, fiber: 1 });
      ratings.push({ id: `${date}_colacion2`, date, meal: 'colacion2', fullness: 2 });
    }
    ratings.push({ id: 'x', date: '2026-10-01', meal: 'cena', fullness: 4 }); // sin alimentos: se ignora
    const ins = satietyInsights(ratings, logs);
    expect(ins.rated).toBe(24);
    expect(ins.overall).toBe(3.5);
    expect(ins.best.map((b) => b.foodId)).toContain('pollo_pechuga_cocida');
    expect(ins.worst.map((b) => b.foodId)).toEqual(['pan_dulce']);
    expect(ins.claims.join(' ')).toMatch(/proteína/);
    expect(ins.claims.join(' ')).toMatch(/fibra/);
  });

  it('pocos datos: no inventa patrones', () => {
    const ins = satietyInsights([{ id: 'a', date: '2026-11-01', meal: 'comida', fullness: 4 }], [{ id: 'l', date: '2026-11-01', meal: 'comida', food_id: 'x', name: 'X', grams: 1, kcal: 1, protein: 1, carbs: 0, fat: 0, fiber: 0 }]);
    expect(ins.best).toEqual([]);
    expect(ins.claims[0]).toMatch(/Llevas 1/);
  });
});

describe('Recetas nuevas al actualizar', () => {
  it('al pasar de la versión 1 solo se agrega lo nuevo; lo borrado no reaparece', async () => {
    const SQL = await initSqlJs();
    const db = new LocalDB(SQL, null, () => {});
    // Simula una instalación en la versión 1 con una receta borrada por el usuario.
    db.upsert('settings', { key: 'seed_recipes_version', value: 1 });
    expect(syncSeedRecipes(db)).toBe(SEED_RECIPES.filter((r) => (r.since ?? 1) > 1).length);
    expect(db.get('recipes', 'rec_seed_licuado_avena_leche')).toBeTruthy();
    expect(db.get('recipes', 'rec_seed_tinga')).toBeNull();
    expect(syncSeedRecipes(db)).toBe(0);
  });

  it('el licuado usa X-Gear Zero Carbs: 37 g de proteína del polvo, ≈ 50 g en total', () => {
    const lic = SEED_RECIPES.find((r) => r.id === 'rec_seed_licuado_avena_leche')!;
    const xg = foods.find((f) => f.id === 'xgear_zero_carbs')!;
    // Etiqueta: 40 g = 150 kcal y 34 g de proteína.
    expect(Math.round((xg.kcal * 40) / 100)).toBe(150);
    expect(Math.round((xg.protein * 40) / 100)).toBe(34);
    expect(lic.items[0].foodId).toBe('xgear_zero_carbs');
    expect(Math.round((xg.protein * lic.items[0].grams) / 100)).toBe(37);
    const per = recipePerServing(lic, foods);
    expect(per.protein).toBeGreaterThan(48);
    expect(per.protein).toBeLessThan(52);
    expect(per.carbs).toBeLessThan(42); // la proteína no aporta carbohidratos
  });

  it('de la versión 2 a la 3: el licuado se corrige si no lo editaste, y se respeta si lo editaste', async () => {
    const SQL = await initSqlJs();
    const lic = SEED_RECIPES.find((r) => r.id === 'rec_seed_licuado_avena_leche')!;
    for (const edited of [false, true]) {
      const db = new LocalDB(SQL, null, () => {});
      db.upsert('settings', { key: 'seed_recipes_version', value: 2 });
      const old = edited ? [{ foodId: 'proteina_whey', grams: 30 }] : lic.previousItems!;
      db.upsert('recipes', { id: lic.id, name: 'Licuado', servings: 1, items: old, notes: 'x', created_at: 'x' });
      syncSeedFoods(db);
      syncSeedRecipes(db);
      expect(db.get('foods', 'xgear_zero_carbs')).toBeTruthy();
      const items = (db.get('recipes', lic.id) as { items: { foodId: string }[] }).items;
      expect(items[0].foodId).toBe(edited ? 'proteina_whey' : 'xgear_zero_carbs');
    }
  });
});

describe('Regenerar una comida completa', () => {
  const targets = { kcal: 2200, protein: 170, carbs: 220, fat: 70, fiber: 30 };
  const plan = generateMealPlan({ foods, targets, mealsPerDay: 4, days: 3, preferred: [], budget: 'medio', seed: 5 });

  it('conserva tipo y objetivo, cambia el platillo y respeta las calorías', () => {
    for (const day of plan.days)
      for (const meal of day.meals)
        for (const seed of [0, 17, 123]) {
          const others = day.meals.filter((m) => m !== meal).flatMap((m) => m.items.map((i) => i.foodId));
          const fresh = regenerateMeal({ foods, meal, otherFoodIds: others, preferred: [], budget: 'medio', seed })!;
          expect(fresh, `${meal.slot} ${seed}`).toBeTruthy();
          expect(fresh.slot).toBe(meal.slot);
          expect(fresh.target).toEqual(meal.target);
          expect(fresh.items.map((i) => i.foodId).sort()).not.toEqual(meal.items.map((i) => i.foodId).sort());
          expect(Math.abs(fresh.totals.kcal - meal.target.kcal) / meal.target.kcal, `${meal.slot} ${fresh.title}`).toBeLessThan(0.15);
        }
  });

  it('el plan generado no cambia con la refactorización (misma semilla, mismo resultado)', () => {
    const again = generateMealPlan({ foods, targets, mealsPerDay: 4, days: 3, preferred: [], budget: 'medio', seed: 5 });
    expect(again.days).toEqual(plan.days);
  });

  it('respeta los alimentos permitidos', () => {
    const meal = plan.days[0].meals.find((m) => m.slot === 'comida')!;
    const allowed = foods.filter((f) => f.id !== 'pollo_pechuga_cocida');
    for (let seed = 0; seed < 10; seed++) {
      const fresh = regenerateMeal({ foods: allowed, meal, preferred: [], budget: 'medio', seed });
      expect(fresh?.items.some((i) => i.foodId === 'pollo_pechuga_cocida')).toBe(false);
    }
  });
});
