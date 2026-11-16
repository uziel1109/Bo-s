import { describe, expect, it } from 'vitest';
import { compareWithPlan, itemMacros, parsePhotoAnalysis } from '../src/shared/nutrition/photoAnalysis';
import { seedFoods } from '../src/shared/nutrition/foodsSeed';
import { macrosFor } from '../src/shared/nutrition/foods';

const foods = seedFoods();
const pollo = foods.find((f) => f.id === 'pollo_pechuga_cocida')!;

describe('Análisis de foto de comida', () => {
  const reply = `Aquí está el análisis:
  {"dish":"Pechuga asada con arroz y ensalada","items":[
    {"name":"Pechuga de pollo asada","grams":150,"foodId":"pollo_pechuga_cocida","confidence":"alta"},
    {"name":"Arroz blanco","grams":"120","foodId":"arroz_blanco_cocido","confidence":"media"},
    {"name":"Salsa verde","grams":30,"foodId":null,"per100g":{"kcal":30,"protein":1,"carbs":6,"fat":0.5,"fiber":1.5},"confidence":"baja"},
    {"name":"Aderezo misterioso","grams":20,"foodId":null,"per100g":{"kcal":5000,"protein":0,"carbs":0,"fat":0,"fiber":0}},
    {"name":"Inventado","grams":50,"foodId":"no_existe"},
    {"name":"","grams":10},{"name":"Gigante","grams":99999}
  ],"note":"Puede haber aceite no visible."}`;

  it('usa los valores verificados de la base cuando hay coincidencia', () => {
    const r = parsePhotoAnalysis(reply, foods);
    expect(r.dish).toBe('Pechuga asada con arroz y ensalada');
    const p = r.items[0];
    expect(p.source).toBe('base');
    expect(itemMacros(p, foods)).toEqual(macrosFor(pollo, 150));
    expect(r.items[1].grams).toBe(120); // número en texto se normaliza
  });

  it('acepta estimaciones de la IA solo si son válidas, y avisa de las inválidas', () => {
    const r = parsePhotoAnalysis(reply, foods);
    const salsa = r.items.find((i) => i.name === 'Salsa verde')!;
    expect(salsa.source).toBe('estimado_ia');
    expect(itemMacros(salsa, foods)!.kcal).toBe(9);
    const bad = r.items.find((i) => i.name === 'Aderezo misterioso')!;
    expect(bad.per100).toBeNull();
    expect(itemMacros(bad, foods)).toBeNull();
    expect(r.warnings.some((w) => w.includes('Aderezo misterioso'))).toBe(true);
    // id inexistente → sin coincidencia; vacíos y absurdos se descartan
    expect(r.items.find((i) => i.name === 'Inventado')!.foodId).toBeNull();
    expect(r.items.some((i) => i.name === '' || i.name === 'Gigante')).toBe(false);
  });

  it('rechaza respuestas sin JSON', () => {
    expect(() => parsePhotoAnalysis('No puedo ver la imagen', foods)).toThrow();
  });

  it('compara con el plan', () => {
    const r = parsePhotoAnalysis(reply, foods);
    const c = compareWithPlan(r.items, [
      { foodId: 'pollo_pechuga_cocida', name: 'Pechuga', grams: 180 },
      { foodId: 'frijol_negro_cocido', name: 'Frijol', grams: 100 },
    ]);
    expect(c.matched).toEqual([{ foodId: 'pollo_pechuga_cocida', name: 'Pechuga', planned: 180, detected: 150 }]);
    expect(c.missing.map((m) => m.foodId)).toEqual(['frijol_negro_cocido']);
    expect(c.extra).toContain('Arroz blanco');
  });
});
