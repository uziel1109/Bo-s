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

import { gramsFromQuantity, parseFoodTable, parsePastedAnswer } from '../src/shared/nutrition/photoAnalysis';
import { foodAnalysisPrompt } from '../src/shared/ai/prompts';

describe('Respuestas pegadas (modo gratis)', () => {
  const table = `Cantidad aprox.	kcal	Proteína	Carbos	Grasa
Arroz blanco cocido	~250 g (1½ taza)	325	7 g	70 g	1 g
Pollo + aceite	~130 g cocido	260	32 g	0 g	13 g
Papa y zanahoria	~110 g	70	2 g	16 g	0 g
Salsa de V8 + verduras	~150 ml	40	1 g	8 g	0 g
Sriracha	~2 cdas	30	1 g	6 g	0 g
Total		~725	~43 g	~100 g	~14 g`;

  it('cantidades escritas a gramos', () => {
    expect(gramsFromQuantity('~250 g (1½ taza)')).toBe(250);
    expect(gramsFromQuantity('~150 ml')).toBe(150);
    expect(gramsFromQuantity('~2 cdas')).toBe(30);
    expect(gramsFromQuantity('1½ taza')).toBe(360);
    expect(gramsFromQuantity('1 cdita')).toBe(5);
    expect(gramsFromQuantity('una pieza')).toBeNull();
  });

  it('lee la tabla, ignora encabezado y total, y conserva los macros', () => {
    const r = parseFoodTable(table)!;
    expect(r.items.map((i) => i.name)).toEqual(['Arroz blanco cocido', 'Pollo + aceite', 'Papa y zanahoria', 'Salsa de V8 + verduras', 'Sriracha']);
    expect(r.items.map((i) => i.grams)).toEqual([250, 130, 110, 150, 30]);
    const tot = r.items.reduce((a, i) => a + ((i.per100!.kcal * i.grams) / 100), 0);
    expect(Math.abs(tot - 725)).toBeLessThan(5);
    const p = r.items.reduce((a, i) => a + ((i.per100!.protein * i.grams) / 100), 0);
    expect(Math.abs(p - 43)).toBeLessThan(1);
  });

  it('prefiere el JSON si la respuesta lo trae, y tabla en markdown también funciona', () => {
    const json = 'Aquí está:\n```json\n{"dish":"Tacos","items":[{"name":"Tortilla","grams":90,"foodId":"tortilla_maiz","per100g":null,"confidence":"alta"}],"note":""}\n```';
    const r = parsePastedAnswer(json, [{ id: 'tortilla_maiz', name: 'Tortilla de maíz', category: 'cereal', kcal: 218, protein: 5.7, carbs: 44.6, fat: 2.9, fiber: 6.3, source: 'x', verified: 1, custom: 0 }]);
    expect(r.dish).toBe('Tacos');
    expect(r.items[0].foodId).toBe('tortilla_maiz');
    const md = '| Alimento | Cantidad | kcal | P | C | G |\n|---|---|---|---|---|---|\n| Huevo | 100 g | 143 | 12.6 | 0.7 | 9.5 |';
    expect(parsePastedAnswer(md, []).items[0]).toMatchObject({ name: 'Huevo', grams: 100 });
    expect(() => parsePastedAnswer('hola', [])).toThrow(/formato/);
  });

  it('las instrucciones del modo gratis incluyen la lista de alimentos y piden JSON', () => {
    const t = foodAnalysisPrompt([{ id: 'avena', name: 'Avena' }], { manual: true, description: 'avena con leche' });
    expect(t).toContain('avena: Avena');
    expect(t).toContain('avena con leche');
    expect(t).toMatch(/JSON/);
  });
});
