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
  prep?: string; // plan sencillo: cómo se prepara ("Sin cocinar", "Del tupper"…)
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
  style?: PlanStyle;
}

/** "variado": un platillo distinto cada día. "sencillo": pocas comidas rápidas que se repiten (días de trabajo). */
export type PlanStyle = 'variado' | 'sencillo';

type Role = 'P' | 'C' | 'F' | 'V' | 'X';
interface Template {
  title: string;
  prep?: string;
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

const PROTEIN_POWDER = ['xgear_zero_carbs', 'proteina_whey'];
const MILK = ['leche_descremada', 'leche_entera'];

/** Plan sencillo: 3–4 ingredientes, sin cocinar o con lo que se cocinó una vez el fin de semana, para llevar. */
const QUICK: Record<'desayuno' | 'principal' | 'cena' | 'colacion', Template[]> = {
  desayuno: [
    {
      title: 'Licuado de proteína con avena y plátano',
      prep: 'Licuadora, 2 min · para llevar',
      roles: [
        { role: 'P', options: PROTEIN_POWDER, min: 20, max: 60 },
        { role: 'C', options: ['avena'], min: 20, max: 100 },
        { role: 'X', options: MILK, fixed: 250 },
        { role: 'V', options: ['platano', 'fresa', 'manzana'], fixed: 100 },
      ],
    },
    {
      title: 'Yogur griego con avena y fruta',
      prep: 'Sin cocinar, 2 min · para llevar',
      roles: [
        { role: 'P', options: ['yogur_griego_0', 'cottage_2'], min: 100, max: 450 },
        { role: 'C', options: ['avena'], min: 0, max: 100 },
        { role: 'V', options: FRUIT, fixed: 120 },
        { role: 'F', options: ['almendra', 'nuez', 'cacahuate', 'chia'], min: 0, max: 30 },
      ],
    },
    {
      title: 'Sándwich de pavo con queso',
      prep: 'Sin cocinar, 3 min · para llevar',
      roles: [
        { role: 'P', options: ['jamon_pavo', 'pavo_pechuga_cocida'], min: 40, max: 220 },
        { role: 'C', options: ['pan_integral', 'pan_blanco'], min: 0, max: 130 },
        { role: 'F', options: ['queso_fresco', 'queso_blanco', 'aguacate'], min: 0, max: 70 },
        { role: 'V', options: ['jitomate', 'lechuga_romana', 'pepino'], fixed: 60 },
      ],
    },
  ],
  principal: [
    {
      title: 'Tupper de pollo con arroz y verdura',
      prep: 'Del tupper · se cocina el fin de semana',
      roles: [
        { role: 'P', options: ['pollo_pechuga_cocida', 'pollo_muslo_cocido'], min: 80, max: 330 },
        { role: 'C', options: ['arroz_blanco_cocido', 'arroz_integral_cocido', 'papa_cocida'], min: 0, max: 400 },
        { role: 'V', options: ['brocoli_cocido', 'calabacita_cocida', 'ejote_cocido', 'zanahoria'], fixed: 150 },
        { role: 'F', options: ['aguacate', 'aceite_oliva'], min: 0, max: 80 },
      ],
    },
    {
      title: 'Tupper de carne molida con papa y verdura',
      prep: 'Del tupper · se cocina el fin de semana',
      roles: [
        { role: 'P', options: ['res_molida_90_cocida', 'pavo_pechuga_cocida'], min: 80, max: 300 },
        { role: 'C', options: ['papa_cocida', 'arroz_blanco_cocido', 'camote_horneado'], min: 0, max: 400 },
        { role: 'V', options: ['calabacita_cocida', 'zanahoria', 'chayote_cocido', 'ejote_cocido'], fixed: 150 },
        { role: 'F', options: ['aguacate', 'aceite_oliva'], min: 0, max: 60 },
      ],
    },
    {
      title: 'Tupper de pollo con frijoles y tortillas',
      prep: 'Del tupper · se cocina el fin de semana',
      roles: [
        { role: 'P', options: ['pollo_pechuga_cocida', 'pollo_muslo_cocido'], min: 80, max: 330 },
        { role: 'C', options: ['tortilla_maiz'], min: 0, max: 270 },
        { role: 'C', options: ['frijol_negro_cocido', 'frijol_pinto_cocido'], fixed: 100 },
        { role: 'V', options: ['nopal_cocido', 'lechuga_romana', 'jitomate'], fixed: 120 },
      ],
    },
  ],
  cena: [
    {
      title: 'Tostadas de atún',
      prep: 'Sin cocinar, 5 min',
      roles: [
        { role: 'P', options: ['atun_agua'], min: 70, max: 300 },
        { role: 'C', options: ['tostada_maiz', 'tortilla_maiz'], min: 0, max: 120 },
        { role: 'V', options: ['lechuga_romana', 'jitomate', 'pepino'], fixed: 120 },
        { role: 'F', options: ['aguacate'], min: 0, max: 100 },
      ],
    },
    {
      title: 'Quesadillas de pollo del tupper',
      prep: '5 min en el comal',
      roles: [
        { role: 'P', options: ['pollo_pechuga_cocida', 'pollo_muslo_cocido'], min: 60, max: 250 },
        { role: 'C', options: ['tortilla_maiz'], min: 0, max: 220 },
        { role: 'F', options: ['queso_fresco', 'queso_asadero', 'aguacate'], min: 0, max: 80 },
      ],
    },
    {
      title: 'Huevos revueltos con tortillas',
      prep: '5 min',
      roles: [
        { role: 'P', options: ['clara_huevo', 'huevo_entero'], min: 66, max: 400 },
        { role: 'X', options: ['huevo_entero'], fixed: 100 },
        { role: 'C', options: ['tortilla_maiz'], min: 0, max: 180 },
        { role: 'V', options: ['jitomate', 'espinaca', 'champinon'], fixed: 80 },
      ],
    },
  ],
  colacion: [
    {
      title: 'Yogur griego con fruta',
      prep: 'Sin cocinar · para llevar',
      roles: [
        { role: 'P', options: ['yogur_griego_0', 'cottage_2'], min: 100, max: 400 },
        { role: 'C', options: FRUIT, min: 0, max: 250 },
        { role: 'F', options: ['almendra', 'cacahuate', 'nuez'], min: 0, max: 30 },
      ],
    },
    {
      title: 'Atún con galletas saladas',
      prep: 'Sin cocinar · para llevar',
      roles: [
        { role: 'P', options: ['atun_agua'], min: 50, max: 200 },
        { role: 'C', options: ['galletas_saladas', 'tostada_maiz'], min: 0, max: 70 },
        { role: 'V', options: ['pepino', 'jitomate', 'zanahoria'], fixed: 80 },
      ],
    },
    {
      title: 'Licuado de proteína con fruta',
      prep: 'Shaker o licuadora, 1 min',
      roles: [
        { role: 'P', options: PROTEIN_POWDER, min: 20, max: 50 },
        { role: 'X', options: MILK, fixed: 250 },
        { role: 'C', options: ['platano', 'fresa', 'manzana'], min: 0, max: 200 },
      ],
    },
  ],
};

/** Cuántas versiones distintas de cada comida tiene el plan sencillo (lo demás se repite). */
const SIMPLE_VARIETY: Record<keyof typeof TEMPLATES, number> = { desayuno: 1, colacion: 1, principal: 2, cena: 2 };

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

function pick(options: string[], foods: Map<string, Food>, seed: number, preferred: Set<string>, budget: string, used: Set<string>, reuse = false): Food | null {
  const avail = options.map((id) => foods.get(id)).filter((f): f is Food => !!f);
  if (!avail.length) return null;
  const scored = avail.map((f, i) => {
    let s = ((i + seed) % avail.length) * 0.1; // rotación
    if (preferred.has(f.id)) s -= 1;
    if (budget === 'bajo' && foodTags(f).includes('economico')) s -= 0.5;
    if (used.has(f.id)) s += reuse ? -0.7 : 0.6; // variedad dentro del día, o (plan sencillo) reutilizar lo ya comprado
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
  style?: PlanStyle;
}

interface BuildArgs {
  foods: Map<string, Food>;
  slot: MealSlot;
  target: Macros;
  preferred: Set<string>;
  budget: string;
  used: Set<string>;
  templateSeed: number;
  pickSeed: number;
  avoidTitle?: string;
  simple?: boolean;
  week?: Set<string>; // plan sencillo: alimentos ya usados en la semana (se prefieren)
}

/** Arma una comida: elige plantilla viable, alimentos por rol y ajusta gramos al objetivo. */
function buildMeal(a: BuildArgs): PlannedMeal | null {
  const group = (a.simple ? QUICK : TEMPLATES)[templateGroup(a.slot)];
  // Elegir una plantilla viable (todos los roles obligatorios disponibles).
  let chosen: { t: Template; foods: (Food | null)[] } | null = null;
  for (let pass = 0; pass < 2 && !chosen; pass++) {
    for (let k = 0; k < group.length && !chosen; k++) {
      const t = group[(((a.templateSeed + k) % group.length) + group.length) % group.length];
      if (pass === 0 && a.avoidTitle && t.title === a.avoidTitle && group.length > 1) continue;
      const fs = t.roles.map((r) => pick(r.options, a.foods, a.pickSeed, a.preferred, a.budget, a.simple ? a.week ?? a.used : a.used, !!a.simple));
      const ok = t.roles.every((r, i) => fs[i] || r.role === 'X' || r.role === 'V' || r.fixed != null || r.role === 'F');
      if (ok && fs[t.roles.findIndex((r) => r.role === 'P')]) chosen = { t, foods: fs };
    }
  }
  if (!chosen) return null;
  const fixedItems: { food: Food; g: number }[] = [];
  const vars: Var[] = [];
  chosen.t.roles.forEach((r, i) => {
    const f = chosen!.foods[i];
    if (!f) return;
    a.used.add(f.id);
    a.week?.add(f.id);
    if (r.fixed != null) fixedItems.push({ food: f, g: r.fixed });
    else vars.push({ food: f, min: r.min ?? 0, max: r.max ?? 300, g: r.min ?? 0 });
  });
  const fixedM = sumMacros(fixedItems.map((x) => macrosFor(x.food, x.g)));
  solveGrams(vars, a.target, fixedM);
  const items: PlanItem[] = [];
  // Evita duplicados (misma comida elegida en dos roles): fusiona.
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
  const meal: PlannedMeal = { slot: a.slot, title: chosen.t.title, items, totals: sumMacros(items.map((i) => i.macros)), target: a.target };
  if (chosen.t.prep) meal.prep = chosen.t.prep;
  return meal;
}

export function generateMealPlan(opts: PlannerOptions): MealPlan {
  const foods = new Map(opts.foods.map((f) => [f.id, f]));
  const preferred = new Set(opts.preferred);
  const slots = mealSlots(opts.mealsPerDay);
  const per = distributeMacros(opts.targets, slots);
  const days: PlannedDay[] = [];
  const notes: string[] = [];
  const seed0 = opts.seed ?? 0;
  const simple = opts.style === 'sencillo';
  const week = new Set<string>();

  for (let d = 0; d < opts.days; d++) {
    const used = new Set<string>();
    const meals: PlannedMeal[] = [];
    slots.forEach((slot, si) => {
      // Plan sencillo: la misma versión de cada comida se repite (desayuno y colaciones iguales toda la semana;
      // comida y cena alternan entre 2), así se compra y se cocina una sola vez.
      const v = simple ? d % SIMPLE_VARIETY[templateGroup(slot)] : d;
      const normal = () => buildMeal({ foods, slot, target: per[si], preferred, budget: opts.budget, used, templateSeed: simple ? v + si + seed0 : d + si + seed0, pickSeed: simple ? v * 7 + si + seed0 : d * 7 + si + seed0 });
      // Si tus exclusiones no permiten ninguna opción rápida, se usa una del plan variado.
      const meal = simple ? (buildMeal({ foods, slot, target: per[si], preferred, budget: opts.budget, used, templateSeed: v + seed0, pickSeed: v * 3 + seed0, simple, week }) ?? normal()) : normal();
      if (!meal) {
        notes.push(`No hay suficientes alimentos compatibles para ${slot}; agrega alimentos o revisa exclusiones.`);
        return;
      }
      meals.push(meal);
    });
    days.push({ index: d, meals, totals: sumMacros(meals.map((m) => m.totals)) });
  }
  if (simple && days.length > 1)
    notes.push('Plan sencillo: casi todo se repite, así compras y cocinas una sola vez. El fin de semana cocina la proteína y el arroz o la papa de los tuppers (≈ 1 h, ve "Preparación"); entre semana solo armas o calientas.');
  const plan: MealPlan = { createdAt: new Date().toISOString(), targets: opts.targets, days, notes };
  if (simple) plan.style = 'sencillo';
  return plan;
}

export interface RegenerateOptions {
  foods: Food[]; // ya filtrados por alergias/exclusiones
  meal: PlannedMeal; // la comida a reemplazar (se conserva su tipo y objetivo)
  otherFoodIds?: string[]; // alimentos ya usados en las demás comidas del día (para variar)
  preferred: string[];
  budget: 'bajo' | 'medio' | 'alto';
  seed: number;
  style?: PlanStyle;
}

/**
 * Regenera una comida completa con el mismo objetivo de macros: prueba otra plantilla y otros alimentos.
 * Si es posible, el resultado no repite el mismo platillo ni la misma lista de alimentos.
 */
export function regenerateMeal(o: RegenerateOptions): PlannedMeal | null {
  const foods = new Map(o.foods.map((f) => [f.id, f]));
  const preferred = new Set(o.preferred);
  const before = o.meal.items.map((i) => i.foodId).sort().join(',');
  let fallback: PlannedMeal | null = null;
  for (let attempt = 0; attempt < 12; attempt++) {
    const used = new Set<string>([...(o.otherFoodIds ?? []), ...o.meal.items.map((i) => i.foodId)]);
    const s = o.seed + attempt * 5;
    const m = buildMeal({ foods, slot: o.meal.slot, target: o.meal.target, preferred, budget: o.budget, used, templateSeed: s, pickSeed: s * 3 + 1, avoidTitle: o.meal.title, simple: o.style === 'sencillo' }) ?? (o.style === 'sencillo' ? buildMeal({ foods, slot: o.meal.slot, target: o.meal.target, preferred, budget: o.budget, used, templateSeed: s, pickSeed: s * 3 + 1, avoidTitle: o.meal.title }) : null);
    if (!m) continue;
    const ids = m.items.map((i) => i.foodId).sort().join(',');
    if (ids !== before && m.title !== o.meal.title) return m;
    if (ids !== before && !fallback) fallback = m;
  }
  return fallback;
}

/** Desviación porcentual del día respecto al objetivo (para pruebas y para mostrar precisión). */
export function planAccuracy(day: PlannedDay, t: Macros) {
  const pct = (a: number, b: number) => (b > 0 ? round(((a - b) / b) * 100, 1) : 0);
  return { kcal: pct(day.totals.kcal, t.kcal), protein: pct(day.totals.protein, t.protein), carbs: pct(day.totals.carbs, t.carbs), fat: pct(day.totals.fat, t.fat) };
}
