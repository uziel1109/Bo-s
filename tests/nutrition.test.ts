import { describe, expect, it } from 'vitest';
import { calculateTargets, distributeMacros, mealSlots, allowedScenario } from '../src/shared/nutrition/targets';
import { defaultProfile } from '../src/shared/profileDefaults';
import { screenProfile } from '../src/shared/safety/screening';
import { atwaterCheck, filterFoodsForProfile, macrosFor, substitutes, sumMacros, validateFood, searchFoods } from '../src/shared/nutrition/foods';
import { seedFoods } from '../src/shared/nutrition/foodsSeed';
import { generateMealPlan, planAccuracy } from '../src/shared/nutrition/mealPlanner';

const profile = { ...defaultProfile(), age: 30, sex: 'hombre' as const, heightCm: 178, weightKg: 95 };

describe('Objetivos de calorías y macros', () => {
  it('déficit moderado coherente', () => {
    const t = calculateTargets({ profile, weightKg: 95, bfPct: 30, tdee: 2800, bmr: 1900, tdeeMethod: 'x', scenario: 'moderado', flags: [] });
    // 0.75 % × 95 × 7700 / 7 ≈ 784 kcal; tope 25 % = 700 → 2100
    expect(t.kcal).toBe(2100);
    expect(t.deficit).toBe(700);
    expect(t.rationale.join(' ')).toMatch(/limitó/);
    // proteína = 2 g/kg del peso a 20 % (66.5/0.8 = 83.1 kg) ≈ 166 g
    expect(t.protein).toBe(166);
    // energía cuadra (redondeos de ± 30 kcal)
    expect(Math.abs(t.protein * 4 + t.carbs * 4 + t.fat * 9 - t.kcal)).toBeLessThan(30);
    expect(t.fat * 9).toBeGreaterThanOrEqual(t.kcal * 0.24);
    expect(t.fiber).toBe(29);
  });

  it('aplica el mínimo calórico', () => {
    const p = { ...profile, sex: 'mujer' as const, weightKg: 60, heightCm: 155 };
    const t = calculateTargets({ profile: { ...p, targetBodyFat: 25 }, weightKg: 60, bfPct: 32, tdee: 1500, bmr: 1200, tdeeMethod: 'x', scenario: 'agresivo', flags: [] });
    expect(t.kcal).toBeGreaterThanOrEqual(1200);
  });

  it('mantenimiento cuando ya se alcanzó el objetivo', () => {
    const t = calculateTargets({ profile, weightKg: 80, bfPct: 18, tdee: 2600, bmr: 1800, tdeeMethod: 'x', scenario: 'agresivo', flags: [] });
    expect(t.deficit).toBe(0);
  });

  it('las banderas de salud bloquean el déficit o el escenario agresivo', () => {
    const preg = screenProfile({ ...profile, conditions: ['embarazo'] });
    expect(allowedScenario('moderado', preg).scenario).toBe('mantenimiento');
    const gout = screenProfile({ ...profile, conditions: ['gota'] });
    expect(allowedScenario('agresivo', gout).scenario).toBe('moderado');
    const tca = screenProfile({ ...profile, conditions: ['tca'] });
    expect(allowedScenario('agresivo', tca).scenario).toBe('conservador');
    const renal = screenProfile({ ...profile, conditions: ['renal'] });
    const t = calculateTargets({ profile, weightKg: 95, bfPct: 30, tdee: 2800, bmr: 1900, tdeeMethod: 'x', scenario: 'moderado', flags: renal });
    expect(t.protein).toBe(76);
  });

  it('distribución por comida suma el total', () => {
    const t = { kcal: 2100, protein: 166, carbs: 200, fat: 65, fiber: 29 };
    const d = distributeMacros(t, mealSlots(4));
    expect(d.length).toBe(4);
    expect(Math.abs(d.reduce((a, x) => a + x.kcal, 0) - 2100)).toBeLessThanOrEqual(4);
    expect(Math.abs(d.reduce((a, x) => a + x.protein, 0) - 166)).toBeLessThanOrEqual(4);
  });
});

describe('Alimentos', () => {
  const foods = seedFoods();
  it('todos los alimentos iniciales son válidos y coherentes energéticamente', () => {
    for (const f of foods) {
      expect(validateFood(f), f.id).toEqual([]);
      expect(atwaterCheck(f).ok, `${f.id} ${atwaterCheck(f).diffPct}`).toBe(true);
    }
    expect(new Set(foods.map((f) => f.id)).size).toBe(foods.length);
  });

  it('macros por porción', () => {
    const pollo = foods.find((f) => f.id === 'pollo_pechuga_cocida')!;
    const m = macrosFor(pollo, 150);
    expect(m.kcal).toBe(248);
    expect(m.protein).toBeCloseTo(46.5, 1);
    expect(sumMacros([m, m]).protein).toBeCloseTo(93, 1);
  });

  it('filtra alérgenos (gluten incluye trazas de la avena)', () => {
    const f = filterFoodsForProfile(foods, ['gluten', 'lacteos'], ['atun_agua']);
    expect(f.find((x) => x.id === 'pan_integral')).toBeUndefined();
    expect(f.find((x) => x.id === 'avena')).toBeUndefined();
    expect(f.find((x) => x.id === 'yogur_griego_0')).toBeUndefined();
    expect(f.find((x) => x.id === 'atun_agua')).toBeUndefined();
    expect(f.find((x) => x.id === 'arroz_blanco_cocido')).toBeDefined();
  });

  it('búsqueda sin acentos', () => {
    expect(searchFoods(foods, 'platano')[0].id).toBe('platano');
    expect(searchFoods(foods, 'atun')[0].id).toBe('atun_agua');
  });

  it('sustituciones equivalentes conservan el macro principal', () => {
    const arroz = foods.find((f) => f.id === 'arroz_blanco_cocido')!;
    const subs = substitutes(arroz, 200, foods);
    expect(subs.length).toBeGreaterThan(3);
    for (const s of subs) expect(Math.abs(s.macros.carbs - 56.4)).toBeLessThan(4);
  });

  it('rechaza alimentos inválidos', () => {
    expect(validateFood({ name: '', kcal: -1, protein: 50, carbs: 50, fat: 10, fiber: 0 }).length).toBeGreaterThan(1);
  });
});

describe('Generador de dietas', () => {
  const foods = seedFoods();
  it('genera días que se acercan a los objetivos (±10 % kcal, proteína ±12 %)', () => {
    for (const meals of [3, 4, 5]) {
      const targets = { kcal: 2100, protein: 166, carbs: 200, fat: 65, fiber: 29 };
      const plan = generateMealPlan({ foods, targets, mealsPerDay: meals, days: 7, preferred: [], budget: 'medio' });
      expect(plan.days.length).toBe(7);
      for (const d of plan.days) {
        expect(d.meals.length).toBe(meals === 3 ? 3 : meals === 4 ? 4 : 5);
        const acc = planAccuracy(d, targets);
        expect(Math.abs(acc.kcal), JSON.stringify(acc)).toBeLessThanOrEqual(10);
        expect(Math.abs(acc.protein), JSON.stringify(acc)).toBeLessThanOrEqual(12);
        for (const m of d.meals) for (const i of m.items) expect(i.grams).toBeGreaterThan(0);
      }
    }
  });

  it('respeta las exclusiones', () => {
    const filtered = filterFoodsForProfile(foods, ['huevo', 'lacteos'], []);
    const plan = generateMealPlan({ foods: filtered, targets: { kcal: 2000, protein: 150, carbs: 200, fat: 65, fiber: 28 }, mealsPerDay: 4, days: 3, preferred: [], budget: 'bajo' });
    const ids = plan.days.flatMap((d) => d.meals.flatMap((m) => m.items.map((i) => i.foodId)));
    expect(ids.some((i) => ['huevo_entero', 'clara_huevo', 'yogur_griego_0', 'cottage_2', 'queso_fresco'].includes(i))).toBe(false);
    expect(plan.days.every((d) => d.meals.length === 4)).toBe(true);
  });
});

import { adjustTargetsKcal } from '../src/shared/nutrition/targets';
describe('Ajuste de calorías aceptado', () => {
  it('conserva la proteína y cuadra la energía', () => {
    const t = calculateTargets({ profile, weightKg: 95, bfPct: 30, tdee: 2800, bmr: 1900, tdeeMethod: 'x', scenario: 'moderado', flags: [] });
    const n = adjustTargetsKcal(t, t.kcal - 150, 'estancamiento');
    expect(n.protein).toBe(t.protein);
    expect(n.kcal).toBe(t.kcal - 150);
    expect(Math.abs(n.protein * 4 + n.carbs * 4 + n.fat * 9 - n.kcal)).toBeLessThan(15);
    expect(n.deficit).toBe(t.deficit + 150);
  });
});
