// Mantiene al día la base inicial de alimentos sin tocar lo que el usuario creó o editó.
import type { LocalDB } from '../db/localdb';
import { LEGACY_SEED_SOURCE, seedFoods } from './foodsSeed';
import { SEED_RECIPES, SEED_RECIPES_VERSION } from './recipesSeed';
import { BRAND_FOODS } from './brandFoods';

/**
 * - Inserta los alimentos base que falten.
 * - Reemplaza los que aún tienen los valores de versiones anteriores (fuente antigua y sin verificar).
 * - Nunca modifica alimentos personalizados ni los que el usuario marcó como verificados o editó la fuente.
 */
export function syncSeedFoods(db: LocalDB): { inserted: number; updated: number } {
  let inserted = 0;
  let updated = 0;
  const rows: Record<string, unknown>[] = [];
  for (const f of seedFoods()) {
    const cur = db.get('foods', f.id);
    if (!cur) {
      rows.push(f as unknown as Record<string, unknown>);
      inserted++;
    } else if (!cur.custom && cur.source === LEGACY_SEED_SOURCE && !cur.verified) {
      // Se conservan precio y código de barras que el usuario haya agregado.
      rows.push({ ...f, price_per_kg: cur.price_per_kg ?? null, barcode: cur.barcode ?? null });
      updated++;
    }
  }
  // Productos de marca: solo se insertan si faltan (nunca se pisan las ediciones con tu etiqueta).
  for (const f of BRAND_FOODS)
    if (!db.get('foods', f.id)) {
      rows.push(f as unknown as Record<string, unknown>);
      inserted++;
    }
  if (rows.length) db.bulkUpsert('foods', rows);
  return { inserted, updated };
}

/**
 * Inserta las recetas incluidas una sola vez por versión: si el usuario borra o edita una, no se vuelve a crear.
 */
export function syncSeedRecipes(db: LocalDB): number {
  const cur = db.get('settings', 'seed_recipes_version') as { value?: unknown } | null;
  const v = Number(cur?.value ?? 0);
  if (v >= SEED_RECIPES_VERSION) return 0;
  const now = new Date().toISOString();
  // Solo las recetas agregadas después de la última versión instalada: las que borraste no reaparecen.
  const rows: Record<string, unknown>[] = SEED_RECIPES.filter((r) => (r.since ?? 1) > v && !db.get('recipes', r.id)).map(({ since: _s, updatedIn: _u, previousItems: _p, ...r }) => ({ ...r, created_at: now }));
  // Recetas incluidas que se corrigieron: se actualizan solo si siguen tal cual las dejó la app.
  for (const r of SEED_RECIPES) {
    if (!r.updatedIn || r.updatedIn <= v || !r.previousItems) continue;
    const cur = db.get('recipes', r.id) as { items?: unknown } | null;
    if (cur && JSON.stringify(cur.items) === JSON.stringify(r.previousItems)) {
      const { since: _s, updatedIn: _u, previousItems: _p, ...clean } = r;
      rows.push({ ...cur, ...clean });
    }
  }
  if (rows.length) db.bulkUpsert('recipes', rows);
  db.upsert('settings', { key: 'seed_recipes_version', value: SEED_RECIPES_VERSION });
  return rows.length;
}
