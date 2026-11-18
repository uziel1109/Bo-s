import { describe, expect, it } from 'vitest';
import initSqlJs from 'sql.js';
import { LocalDB } from '../src/shared/db/localdb';
import { seedFoods } from '../src/shared/nutrition/foodsSeed';
import { BRAND_FOODS } from '../src/shared/nutrition/brandFoods';
import { aiFoodId, dishLogRows, dishTotals, prepareDish, searchDishes, suggestDishName } from '../src/shared/nutrition/dishes';
import { parsePastedAnswer } from '../src/shared/nutrition/photoAnalysis';
import type { Food } from '../src/shared/types';

const foods = [...seedFoods(), ...BRAND_FOODS] as Food[];
const TABLE = `| Alimento | Cantidad | kcal | P | C | G |
|---|---|---|---|---|---|
| Arroz blanco cocido | ~250 g | 325 | 7 | 70 | 1 |
| Pollo + aceite | ~130 g | 260 | 32 | 0 | 13 |
| Salsa de V8 + verduras | ~150 ml | 40 | 1 | 8 | 0 |
| Total | | ~625 | 40 | 78 | 14 |`;

describe('Mis platillos', () => {
  it('la tabla pegada se guarda: lo que no está en la base se vuelve alimento propio (una sola vez)', () => {
    const r = parsePastedAnswer(TABLE, foods);
    const a = prepareDish(r.items, foods);
    expect(a.items.length).toBe(3);
    expect(a.items.every((i) => i.foodId)).toBe(true);
    const ai = a.newFoods.map((f) => f.id);
    expect(ai.length).toBeGreaterThan(0);
    for (const f of a.newFoods) {
      expect(f.verified).toBe(0);
      expect(f.custom).toBe(1);
      expect(f.name).toMatch(/estimado por IA/);
    }
    // Las kcal se conservan respecto a lo pegado (±3 %).
    expect(Math.abs(dishTotals(a.items).kcal - 625) / 625).toBeLessThan(0.03);
    // Segunda vez: los alimentos de IA ya existen y se reutilizan.
    const b = prepareDish(parsePastedAnswer(TABLE, [...foods, ...a.newFoods]).items, [...foods, ...a.newFoods]);
    expect(b.newFoods).toEqual([]);
    expect(b.items.map((i) => i.foodId)).toEqual(a.items.map((i) => i.foodId));
  });

  it('ids estables sin acentos y sin la marca "(estimado por IA)"', () => {
    expect(aiFoodId('Salsa de V8 + verduras')).toBe('ia_salsa_de_v8_verduras');
    expect(aiFoodId('Plátano macho frito (estimado por IA)')).toBe(aiFoodId('platano macho frito'));
  });

  it('volver a registrar un platillo: porciones y vínculo con el platillo', () => {
    const { items } = prepareDish(parsePastedAnswer(TABLE, foods).items, foods);
    let n = 0;
    const rows = dishLogRows({ id: 'dish_1', items }, '2026-11-18', 'comida', 1.5, () => `f${n++}`);
    expect(rows.length).toBe(3);
    expect(rows.every((r) => r.dish_id === 'dish_1' && r.meal === 'comida')).toBe(true);
    const k = rows.reduce((s, r) => s + r.kcal, 0);
    expect(Math.abs(k - dishTotals(items).kcal * 1.5)).toBeLessThan(2);
    expect(rows[0].grams).toBe(Math.round(items[0].grams * 1.5));
  });

  it('se guarda en la base de datos (tabla dishes y food_logs.dish_id)', async () => {
    const SQL = await initSqlJs();
    const db = new LocalDB(SQL, null, () => {});
    const { items } = prepareDish(parsePastedAnswer(TABLE, foods).items, foods);
    db.upsert('dishes', { id: 'd1', name: 'Arroz con pollo', date: '2026-11-18', meal: 'comida', photo_id: null, photo_file: null, items, totals: dishTotals(items), source: 'claude_app', raw: TABLE, created_at: 'x' });
    db.bulkUpsert('food_logs', dishLogRows({ id: 'd1', items }, '2026-11-18', 'comida', 1, () => Math.random().toString(36)));
    const d = db.get('dishes', 'd1') as { items: unknown[]; raw: string };
    expect(d.items.length).toBe(3);
    expect(d.raw).toContain('Arroz blanco');
    expect((db.list('food_logs') as { dish_id: string }[]).every((l) => l.dish_id === 'd1')).toBe(true);
  });

  it('búsqueda por platillo o ingrediente, sin acentos', () => {
    const list = [
      { name: 'Arroz con pollo', items: [{ name: 'Pollo', foodId: 'x', grams: 1, macros: { kcal: 1, protein: 0, carbs: 0, fat: 0, fiber: 0 } }] },
      { name: 'Licuado', items: [{ name: 'Plátano', foodId: 'y', grams: 1, macros: { kcal: 1, protein: 0, carbs: 0, fat: 0, fiber: 0 } }] },
    ];
    expect(searchDishes(list, 'platano').map((d) => d.name)).toEqual(['Licuado']);
    expect(searchDishes(list, 'ARROZ').map((d) => d.name)).toEqual(['Arroz con pollo']);
    expect(searchDishes(list, '').length).toBe(2);
    // Ingredientes al final de una lista larga también se encuentran.
    const long = [{ name: 'Comida', items: ['Arroz blanco, cocido', 'Pechuga de pollo, asada', 'Papa y zanahoria', 'Salsa de V8 + verduras'].map((name) => ({ name, foodId: 'z', grams: 1, macros: { kcal: 1, protein: 0, carbs: 0, fat: 0, fiber: 0 } })) }];
    expect(searchDishes(long, 'v8').length).toBe(1);
    expect(searchDishes(long, 'salsa verduras').length).toBe(1);
  });
});

describe('Nombre del platillo', () => {
  it('usa el de la IA, o tu descripción, o los alimentos principales', () => {
    const items = [{ name: 'Arroz blanco cocido', grams: 250 }, { name: 'Pollo + aceite', grams: 130 }, { name: 'Sriracha', grams: 10 }, { name: 'Papa y zanahoria', grams: 110 }];
    expect(suggestDishName('Tacos al pastor', '', items)).toBe('Tacos al pastor');
    expect(suggestDishName('Comida', 'arroz con pollo', items)).toBe('Arroz con pollo');
    expect(suggestDishName('Comida', '', items)).toBe('Arroz blanco cocido, pollo y papa y zanahoria');
  });
});
