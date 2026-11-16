import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import initSqlJs from 'sql.js';
import { seedFoods, USDA_FDC_IDS, LEGACY_SEED_SOURCE } from '../src/shared/nutrition/foodsSeed';
import { syncSeedFoods } from '../src/shared/nutrition/seedSync';
import { LocalDB } from '../src/shared/db/localdb';
import { buildShoppingList, COOKED_TO_RAW, shoppingListText } from '../src/shared/nutrition/shopping';
import { generateMealPlan } from '../src/shared/nutrition/mealPlanner';
import type { MealPlan } from '../src/shared/nutrition/mealPlanner';

// Valores extraídos del archivo oficial USDA FoodData Central SR Legacy (2018-04), food_nutrient.csv.
const usda = JSON.parse(fs.readFileSync(new URL('./fixtures-usda-sr-legacy.json', import.meta.url), 'utf8')) as Record<string, { fdc: number; desc: string; kcal: number; protein: number; carbs: number; fat: number; fiber: number }>;

describe('Alimentos verificados contra USDA FoodData Central', () => {
  it('cada alimento base coincide con su registro oficial (FDC ID)', () => {
    const foods = seedFoods();
    expect(foods.length).toBe(Object.keys(usda).length);
    for (const f of foods) {
      const u = usda[f.id];
      expect(u, f.id).toBeDefined();
      expect(USDA_FDC_IDS[f.id]).toBe(u.fdc);
      expect(f.source).toContain(String(u.fdc));
      expect(f.verified).toBe(1);
      for (const k of ['kcal', 'protein', 'carbs', 'fat', 'fiber'] as const) expect(Math.abs(f[k] - u[k]), `${f.id}.${k}`).toBeLessThanOrEqual(0.051);
    }
  });

  it('actualiza los valores antiguos sin tocar lo editado por el usuario', async () => {
    const SQL = await initSqlJs();
    const db = new LocalDB(SQL, null, () => {});
    // Simula una base de una versión anterior
    db.bulkUpsert('foods', [
      { id: 'atun_agua', name: 'Atún', category: 'proteina', kcal: 116, protein: 25.5, carbs: 0, fat: 0.8, fiber: 0, source: LEGACY_SEED_SOURCE, verified: 0, custom: 0, price_per_kg: 180 },
      { id: 'pollo_pechuga_cocida', name: 'Pollo', category: 'proteina', kcal: 170, protein: 30, carbs: 0, fat: 4, fiber: 0, source: LEGACY_SEED_SOURCE, verified: 1, custom: 0 },
      { id: 'mi_tortilla', name: 'Mi tortilla', category: 'cereal', kcal: 200, protein: 5, carbs: 40, fat: 2, fiber: 5, source: 'Etiqueta', verified: 1, custom: 1 },
    ]);
    const r = syncSeedFoods(db);
    expect(r.updated).toBe(1);
    expect(r.inserted).toBe(seedFoods().length - 2);
    const atun = db.get('foods', 'atun_agua')!;
    expect(atun.kcal).toBe(usda.atun_agua.kcal);
    expect(atun.price_per_kg).toBe(180); // conserva el precio del usuario
    expect(db.get('foods', 'pollo_pechuga_cocida')!.kcal).toBe(170); // el usuario lo verificó: no se toca
    expect(db.get('foods', 'mi_tortilla')!.kcal).toBe(200);
    expect(syncSeedFoods(db)).toEqual({ inserted: 0, updated: 0 });
  });
});

describe('Lista del supermercado', () => {
  const foods = seedFoods();
  const plan: MealPlan = {
    createdAt: 'x',
    targets: { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
    notes: [],
    days: [0, 1].map((index) => ({
      index,
      totals: { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
      meals: [
        {
          slot: 'comida' as const,
          title: 't',
          target: { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
          totals: { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
          items: [
            { foodId: 'pollo_pechuga_cocida', name: 'Pollo', grams: 200, macros: { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 } },
            { foodId: 'arroz_blanco_cocido', name: 'Arroz', grams: 150, macros: { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 } },
            { foodId: 'huevo_entero', name: 'Huevo', grams: 100, macros: { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 } },
            { foodId: 'clara_huevo', name: 'Clara', grams: 99, macros: { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 } },
            { foodId: 'tortilla_maiz', name: 'Tortilla', grams: 90, macros: { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 } },
            { foodId: 'platano', name: 'Plátano', grams: 118, macros: { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 } },
          ],
        },
      ],
    })),
  };

  it('convierte cocido a crudo y agrupa por sección', () => {
    const l = buildShoppingList(plan, foods, [0, 1], 1);
    const pollo = l.items.find((i) => i.key === 'pollo_pechuga_cruda')!;
    expect(pollo.grams).toBe(Math.round(400 * COOKED_TO_RAW.pollo_pechuga_cocida.factor)); // 552 g crudos
    expect(pollo.section).toBe('Carnes, pescados y mariscos');
    const arroz = l.items.find((i) => i.key === 'arroz_blanco_crudo')!;
    expect(arroz.grams).toBe(Math.round(300 * 0.38));
    // 2 huevos/día + 3 claras/día → 4 + 6 = 10 huevos
    expect(l.items.find((i) => i.key === 'huevo_entero')!.qty).toBe('10 piezas');
    expect(l.items.find((i) => i.key === 'tortilla_maiz')!.detail).toContain('6 tortillas');
    expect(l.items.find((i) => i.key === 'platano')!.qty).toBe('2 piezas');
    expect(l.items.every((i) => !i.checked)).toBe(true);
    expect(shoppingListText(l)).toContain('☐ Huevo — 10 piezas');
  });

  it('repite el plan y filtra días', () => {
    const l = buildShoppingList(plan, foods, [0], 3);
    expect(l.items.find((i) => i.key === 'huevo_entero')!.qty).toBe('15 piezas');
  });

  it('funciona con un plan generado real', () => {
    const p = generateMealPlan({ foods, targets: { kcal: 2100, protein: 166, carbs: 200, fat: 65, fiber: 29 }, mealsPerDay: 4, days: 7, preferred: [], budget: 'medio' });
    const l = buildShoppingList(p, foods, p.days.map((d) => d.index), 1);
    expect(l.items.length).toBeGreaterThan(8);
    for (const i of l.items) {
      expect(i.grams).toBeGreaterThan(0);
      expect(i.qty).toMatch(/\d/);
    }
    // Ningún alimento cocido aparece como tal en la lista (se compra crudo/seco)
    for (const k of Object.keys(COOKED_TO_RAW)) expect(l.items.some((i) => i.key === k)).toBe(false);
  });
});
