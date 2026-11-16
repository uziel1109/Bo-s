// Generador de planes alimenticios con alimentos accesibles en México.
// Para cada comida se elige una plantilla (fuente de proteína + carbohidrato + grasa + verdura/fruta) y se
// resuelven los gramos con descenso por coordenadas acotado, minimizando el error frente a los macros objetivo.
import type { Food, Macros, MealSlot } from '../types';
import { foodTags, macrosFor, sumMacros } from './foods';
import { distributeMacros, mealSlots } from './targets';
import { round } from '../utils';

export interface PlanItem {
  foodId: string;
  name: string;
  grams: number;
  unitHint?: string;
  macros: Macros;
}

export interface PlannedMeal {
  slot: MealSlot;
  title: string;
  items: PlanItem[];
  totals: Macros;
  target: Macros;
}

export interface PlannedDay {
  index: number;
  meals: PlannedMeal[];
  totals: Macros;
}

export interface MealPlan {
  createdAt: string;
  targets: Macros;
  days: PlannedDay[];
  notes: string[];
}

type Role = 'P' | 'C' | 'F' | 'V' | 'X';
interface Template {
  title: string;
  roles: { role: Role; options: string[]; fixed?: number; min?: number; max?: number }[];
}

const VEG = ['nopal_cocido', 'calabacita_cocida', 'brocoli_cocido', 'ejote_cocido', 'chayote_cocido', 'espinaca', 'lechuga_romana', 'jitomate', 'pepino', 'champinon'];
const FRUIT = ['papaya', 'manzana', 'platano', 'fresa', 'naranja', 'pina', 'melon', 'guayaba', 'mango', 'kiwi', 'pera'];

const TEMPLATES: Record<'desayuno' | 'principal' | 'cena' | 'colacion', Template[]> = {
  desayuno: [
    {
      title: 'Huevos a la mexicana con tortillas y frijoles',
      roles: [
        { role: 'P', options: ['clara_huevo', 'huevo_entero'], min: 66, max: 400 },
        { role: 'X', options: ['huevo_entero'], fixed: 100 },
        { role: 'C', options: ['tortilla_maiz', 'pan_integral'], min: 0, max: 180 },
        { role: 'C', options: ['frijol_negro_cocido', 'frijol_pinto_cocido'], fixed: 80 },
        { role: 'V', options: ['jitomate', 'nopal_cocido', 'espinaca', 'champinon'], fixed: 100 },
        { role: 'F', options: ['aguacate'], min: 0, max: 120 },
      ],
    },
    {
      title: 'Avena con yogur griego y fruta',
      roles: [
        { role: 'P', options: ['yogur_griego_0', 'cottage_2'], min: 100, max: 450 },
        { role: 'C', options: ['avena'], min: 20, max: 120 },
        { role: 'V', options: FRUIT, fixed: 120 },
        { role: 'F', options: ['almendra', 'crema_cacahuate', 'nuez', 'chia', 'cacahuate'], min: 0, max: 35 },
      ],
    },
    {
      title: 'Molletes integrales de frijol con huevo',
      roles: [
        { role: 'P', options: ['clara_huevo', 'huevo_entero'], min: 66, max: 400 },
        { role: 'C', options: ['pan_integral'], min: 0, max: 130 },
        { role: 'C', options: ['frijol_negro_cocido', 'frijol_pinto_cocido'], fixed: 80 },
        { role: 'V', options: ['jitomate', 'pepino', 'lechuga_romana'], fixed: 100 },
        { role: 'F', options: ['aguacate', 'queso_fresco'], min: 0, max: 100 },
      ],
    },
    {
      title: 'Tacos de desayuno con frijoles y verdura',
      roles: [
        { role: 'P', options: ['pollo_pechuga_cocida', 'pavo_pechuga_cocida', 'res_bistec_magro_cocido', 'atun_agua', 'tofu_firme'], min: 60, max: 250 },
        { role: 'C', options: ['tortilla_maiz'], min: 0, max: 180 },
        { role: 'C', options: ['frijol_negro_cocido', 'frijol_pinto_cocido'], fixed: 80 },
        { role: 'V', options: ['nopal_cocido', 'jitomate', 'cebolla', 'calabacita_cocida'], fixed: 100 },
        { role: 'F', options: ['aguacate'], min: 0, max: 120 },
      ],
    },
  ],
  principal: [
    {
      title: 'Plato fuerte con arroz, frijoles y verduras',
      roles: [
        { role: 'P', options: ['pollo_pechuga_cocida', 'res_bistec_magro_cocido', 'cerdo_lomo_cocido', 'tilapia_cocida', 'pavo_pechuga_cocida', 'res_molida_90_cocida', 'salmon_cocido'], min: 80, max: 330 },
        { role: 'C', options: ['arroz_blanco_cocido', 'arroz_integral_cocido', 'papa_cocida', 'camote_horneado', 'pasta_cocida', 'quinoa_cocida'], min: 0, max: 400 },
        { role: 'C', options: ['frijol_negro_cocido', 'frijol_pinto_cocido', 'lenteja_cocida'], fixed: 100 },
        { role: 'V', options: VEG, fixed: 150 },
        { role: 'F', options: ['aguacate', 'aceite_oliva', 'aceite_vegetal'], min: 0, max: 120 },
      ],
    },
    {
      title: 'Tacos de proteína con tortilla de maíz y ensalada',
      roles: [
        { role: 'P', options: ['pollo_pechuga_cocida', 'res_bistec_magro_cocido', 'cerdo_lomo_cocido', 'pollo_muslo_cocido', 'tilapia_cocida', 'camaron_cocido'], min: 80, max: 330 },
        { role: 'C', options: ['tortilla_maiz'], min: 0, max: 270 },
        { role: 'V', options: ['nopal_cocido', 'lechuga_romana', 'pepino', 'jitomate', 'cebolla'], fixed: 150 },
        { role: 'F', options: ['aguacate'], min: 0, max: 150 },
      ],
    },
  ],
  cena: [
    {
      title: 'Tostadas/tacos ligeros de atún o pollo',
      roles: [
        { role: 'P', options: ['atun_agua', 'pollo_pechuga_cocida', 'tilapia_cocida', 'sardina_aceite', 'camaron_cocido'], min: 70, max: 300 },
        { role: 'C', options: ['tortilla_maiz', 'pan_integral', 'camote_horneado'], min: 0, max: 220 },
        { role: 'V', options: ['lechuga_romana', 'jitomate', 'pepino', 'calabacita_cocida', 'nopal_cocido'], fixed: 150 },
        { role: 'F', options: ['aguacate', 'aceite_oliva'], min: 0, max: 120 },
      ],
    },
    {
      title: 'Omelette de claras con verduras',
      roles: [
        { role: 'P', options: ['clara_huevo'], min: 99, max: 450 },
        { role: 'X', options: ['huevo_entero'], fixed: 50 },
        { role: 'C', options: ['tortilla_maiz', 'pan_integral', 'papa_cocida'], min: 0, max: 220 },
        { role: 'V', options: ['espinaca', 'champinon', 'calabacita_cocida', 'pimiento_rojo', 'jitomate'], fixed: 150 },
        { role: 'F', options: ['aguacate', 'queso_fresco'], min: 0, max: 100 },
      ],
    },
  ],
  colacion: [
    {
      title: 'Yogur griego con fruta y semillas',
      roles: [
        { role: 'P', options: ['yogur_griego_0', 'cottage_2'], min: 100, max: 400 },
        { role: 'C', options: FRUIT, min: 0, max: 250 },
        { role: 'F', options: ['almendra', 'cacahuate', 'nuez', 'pepita', 'chia'], min: 0, max: 30 },
      ],
    },
    {
      title: 'Colación de proteína con carbohidrato',
      roles: [
        { role: 'P', options: ['atun_agua', 'pollo_pechuga_cocida', 'huevo_entero'], min: 50, max: 200 },
        { role: 'C', options: ['tortilla_maiz', 'platano', 'manzana', 'jicama'], min: 0, max: 200 },
        { role: 'F', options: ['aguacate', 'cacahuate', 'almendra'], min: 0, max: 60 },
      ],
    },
  ],
};

function templateGroup(slot: MealSlot): keyof typeof TEMPLATES {
  if (slot === 'desayuno') return 'desayuno';
  if (slot === 'comida') return 'principal';
  if (slot === 'cena') return 'cena';
  return 'colacion';
}

/** Cantidades redondeadas a unidades prácticas. */
function practicalGrams(f: Food, g: number): number {
  if (g <= 0) return 0;
  if (f.unit_grams && ['tortilla_maiz', 'huevo_entero', 'clara_huevo', 'pan_integral', 'pan_blanco'].includes(f.id)) {
    return Math.max(1, Math.round(g / f.unit_grams)) * f.unit_grams;
  }
  if (f.fat >= 90) return Math.max(5, Math.round(g / 5) * 5);
  return Math.max(5, Math.round(g / 5) * 5);
}

function unitHint(f: Food, g: number): string | undefined {
  if (!f.unit_name || !f.unit_grams) return undefined;
  const n = g / f.unit_grams;
  if (n < 0.24) return undefined;
  const r = Math.round(n * 4) / 4;
  return `≈ ${r} ${f.unit_name}`;
}

interface Var {
  food: Food;
  min: number;
  max: number;
  g: number;
}

/** Descenso por coordenadas con cotas: minimiza el error cuadrático en kcal de proteína, carbohidrato y grasa. */
export function solveGrams(vars: Var[], target: { protein: number; carbs: number; fat: number }, fixed: Macros): void {
  const w = { protein: 4, carbs: 4, fat: 9 };
  for (let it = 0; it < 300; it++) {
    let moved = 0;
    for (let i = 0; i < vars.length; i++) {
      const v = vars[i];
      // residuo sin la variable i
      const res = { protein: target.protein - fixed.protein, carbs: target.carbs - fixed.carbs, fat: target.fat - fixed.fat };
      for (let j = 0; j < vars.length; j++) {
        if (j === i) continue;
        const u = vars[j];
        res.protein -= (u.food.protein * u.g) / 100;
        res.carbs -= (u.food.carbs * u.g) / 100;
        res.fat -= (u.food.fat * u.g) / 100;
      }
      const a = { protein: v.food.protein / 100, carbs: v.food.carbs / 100, fat: v.food.fat / 100 };
      let num = 0;
      let den = 0;
      for (const k of ['protein', 'carbs', 'fat'] as const) {
        num += w[k] ** 2 * a[k] * res[k];
        den += w[k] ** 2 * a[k] ** 2;
      }
      const g = den > 0 ? Math.min(v.max, Math.max(v.min, num / den)) : v.min;
      moved += Math.abs(g - v.g);
      v.g = g;
    }
    if (moved < 0.01) break;
  }
}

function pick(options: string[], foods: Map<string, Food>, seed: number, preferred: Set<string>, budget: string, used: Set<string>): Food | null {
  const avail = options.map((id) => foods.get(id)).filter((f): f is Food => !!f);
  if (!avail.length) return null;
  const scored = avail.map((f, i) => {
    let s = ((i + seed) % avail.length) * 0.1; // rotación
    if (preferred.has(f.id)) s -= 1;
    if (budget === 'bajo' && foodTags(f).includes('economico')) s -= 0.5;
    if (used.has(f.id)) s += 0.6; // variedad dentro del día
    return { f, s };
  });
  scored.sort((a, b) => a.s - b.s);
  return scored[0].f;
}

export interface PlannerOptions {
  foods: Food[]; // ya filtrados por alergias/exclusiones
  targets: Macros;
  mealsPerDay: number;
  days: number;
  preferred: string[];
  budget: 'bajo' | 'medio' | 'alto';
  seed?: number;
}

export function generateMealPlan(opts: PlannerOptions): MealPlan {
  const foods = new Map(opts.foods.map((f) => [f.id, f]));
  const preferred = new Set(opts.preferred);
  const slots = mealSlots(opts.mealsPerDay);
  const per = distributeMacros(opts.targets, slots);
  const days: PlannedDay[] = [];
  const notes: string[] = [];
  const seed0 = opts.seed ?? 0;

  for (let d = 0; d < opts.days; d++) {
    const used = new Set<string>();
    const meals: PlannedMeal[] = [];
    slots.forEach((slot, si) => {
      const target = per[si];
      const group = TEMPLATES[templateGroup(slot)];
      // Elegir una plantilla viable (todos los roles obligatorios disponibles).
      let chosen: { t: Template; foods: (Food | null)[] } | null = null;
      for (let k = 0; k < group.length && !chosen; k++) {
        const t = group[(d + si + seed0 + k) % group.length];
        const fs = t.roles.map((r) => pick(r.options, foods, d * 7 + si + seed0, preferred, opts.budget, used));
        const ok = t.roles.every((r, i) => fs[i] || r.role === 'X' || r.role === 'V' || r.fixed != null || r.role === 'F');
        if (ok && fs[t.roles.findIndex((r) => r.role === 'P')]) chosen = { t, foods: fs };
      }
      if (!chosen) {
        notes.push(`No hay suficientes alimentos compatibles para ${slot}; agrega alimentos o revisa exclusiones.`);
        return;
      }
      const fixedItems: { food: Food; g: number }[] = [];
      const vars: Var[] = [];
      chosen.t.roles.forEach((r, i) => {
        const f = chosen!.foods[i];
        if (!f) return;
        used.add(f.id);
        if (r.fixed != null) fixedItems.push({ food: f, g: r.fixed });
        else vars.push({ food: f, min: r.min ?? 0, max: r.max ?? 300, g: r.min ?? 0 });
      });
      // Evita duplicados (misma comida elegida en dos roles): fusiona.
      const fixedM = sumMacros(fixedItems.map((x) => macrosFor(x.food, x.g)));
      solveGrams(vars, target, fixedM);
      const items: PlanItem[] = [];
      const add = (f: Food, g: number) => {
        const pg = practicalGrams(f, g);
        if (pg <= 0) return;
        const existing = items.find((x) => x.foodId === f.id);
        if (existing) {
          existing.grams += pg;
          existing.macros = macrosFor(f, existing.grams);
          existing.unitHint = unitHint(f, existing.grams);
        } else items.push({ foodId: f.id, name: f.name, grams: pg, unitHint: unitHint(f, pg), macros: macrosFor(f, pg) });
      };
      for (const v of vars) if (v.g >= 4) add(v.food, v.g);
      for (const x of fixedItems) add(x.food, x.g);
      meals.push({ slot, title: chosen.t.title, items, totals: sumMacros(items.map((i) => i.macros)), target });
    });
    days.push({ index: d, meals, totals: sumMacros(meals.map((m) => m.totals)) });
  }
  return { createdAt: new Date().toISOString(), targets: opts.targets, days, notes };
}

/** Desviación porcentual del día respecto al objetivo (para pruebas y para mostrar precisión). */
export function planAccuracy(day: PlannedDay, t: Macros) {
  const pct = (a: number, b: number) => (b > 0 ? round(((a - b) / b) * 100, 1) : 0);
  return { kcal: pct(day.totals.kcal, t.kcal), protein: pct(day.totals.protein, t.protein), carbs: pct(day.totals.carbs, t.carbs), fat: pct(day.totals.fat, t.fat) };
}
