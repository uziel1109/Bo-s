// "Mis platillos": cada comida analizada con IA (foto y/o respuesta pegada) se guarda con su foto, sus
// elementos y sus macros, para verla después y volver a registrarla con un toque. Los elementos que no
// estaban en la base (valores estimados por la IA) se agregan como alimentos propios, para reutilizarlos.
import type { Food, Macros, MealSlot } from '../types';
import { macrosFor, sumMacros } from './foods';
import type { DetectedItem } from './photoAnalysis';
import { round } from '../utils';

export interface DishItem {
  foodId: string | null;
  name: string;
  grams: number;
  macros: Macros;
}

export interface Dish {
  id: string;
  name: string;
  date: string;
  meal: MealSlot;
  photo_id: string | null;
  photo_file: string | null;
  items: DishItem[];
  totals: Macros;
  source: 'claude_app' | 'api';
  raw: string | null; // respuesta pegada tal cual, por si quieres revisarla
  created_at: string;
}

const plain = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
const slug = (s: string) =>
  plain(s)
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);

/** Id estable del alimento estimado por IA: el mismo nombre reutiliza el mismo alimento. */
export const aiFoodId = (name: string) => `ia_${slug(name) || 'alimento'}`;

/** Alimento propio creado a partir de valores por 100 g estimados por la IA (no verificado). */
export function aiFood(name: string, per100: Macros): Food {
  const clean = name.replace(/\s*\(estimado por IA\)\s*$/i, '').trim() || 'Alimento';
  return {
    id: aiFoodId(clean),
    name: `${clean} (estimado por IA)`,
    category: 'otro',
    kcal: round(per100.kcal, 1),
    protein: round(per100.protein, 1),
    carbs: round(per100.carbs, 1),
    fat: round(per100.fat, 1),
    fiber: round(per100.fiber ?? 0, 1),
    unit_name: null,
    unit_grams: null,
    source: 'Estimado por IA',
    verified: 0,
    custom: 1,
    barcode: null,
    tags: '[]',
    price_per_kg: null,
  };
}

/**
 * Prepara lo que se guarda: los alimentos nuevos (estimados por IA y que aún no existen) y los elementos del
 * platillo, todos ligados a un alimento de la base. Ignora elementos sin valores o con 0 g.
 */
export function prepareDish(items: DetectedItem[], foods: Food[]): { newFoods: Food[]; items: DishItem[] } {
  const byId = new Map(foods.map((f) => [f.id, f]));
  const newFoods: Food[] = [];
  const out: DishItem[] = [];
  for (const it of items) {
    if (!(it.grams > 0)) continue;
    let f = it.foodId ? byId.get(it.foodId) : undefined;
    if (!f && it.per100) {
      const id = aiFoodId(it.name.replace(/\s*\(estimado por IA\)\s*$/i, ''));
      f = byId.get(id);
      if (!f) {
        f = aiFood(it.name, it.per100);
        byId.set(f.id, f);
        newFoods.push(f);
      }
    }
    if (!f) continue;
    out.push({ foodId: f.id, name: f.name, grams: Math.round(it.grams), macros: macrosFor(f, it.grams) });
  }
  return { newFoods, items: out };
}

export const dishTotals = (items: DishItem[]): Macros => sumMacros(items.map((i) => i.macros));

/** Filas del registro de comida para un platillo guardado (con porciones: 0.5, 1, 1.5…). */
export function dishLogRows(dish: Pick<Dish, 'id' | 'items'>, date: string, meal: MealSlot, portions = 1, ids: () => string, now = new Date().toISOString()) {
  const k = portions > 0 ? portions : 1;
  return dish.items.map((it) => ({
    id: ids(),
    date,
    meal,
    food_id: it.foodId,
    name: it.name,
    grams: Math.round(it.grams * k),
    kcal: round(it.macros.kcal * k, 1),
    protein: round(it.macros.protein * k, 1),
    carbs: round(it.macros.carbs * k, 1),
    fat: round(it.macros.fat * k, 1),
    fiber: round((it.macros.fiber ?? 0) * k, 1),
    dish_id: dish.id,
    created_at: now,
  }));
}

/** Búsqueda sin acentos por nombre del platillo o de sus alimentos. */
export function searchDishes<T extends Pick<Dish, 'name' | 'items'>>(dishes: T[], q: string): T[] {
  const words = plain(q).split(/[^a-z0-9]+/).filter(Boolean);
  if (!words.length) return dishes;
  return dishes.filter((d) => {
    const text = plain([d.name, ...d.items.map((i) => i.name)].join(' '));
    return words.every((w) => text.includes(w));
  });
}

const GENERIC = /^(comida|platillo|plato|desayuno|cena|colaci[oó]n.*|extra)$/i;

/** Nombre sugerido: el de la IA; si es genérico, lo que escribiste; si no, los 2–3 alimentos principales. */
export function suggestDishName(dish: string, description: string, items: { name: string; grams: number }[]): string {
  if (dish.trim() && !GENERIC.test(dish.trim())) return dish.trim();
  const d = description.trim();
  if (d) return (d.charAt(0).toUpperCase() + d.slice(1)).slice(0, 60);
  const main = [...items].sort((a, b) => b.grams - a.grams).slice(0, 3).map((i) => i.name.split(/[,(+]/)[0].trim().toLowerCase());
  if (!main.length) return dish.trim() || 'Platillo';
  const s = main.length > 1 ? `${main.slice(0, -1).join(', ')} y ${main[main.length - 1]}` : main[0];
  return s.charAt(0).toUpperCase() + s.slice(1);
}
