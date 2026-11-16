// Mantiene al día la base inicial de alimentos sin tocar lo que el usuario creó o editó.
import type { LocalDB } from '../db/localdb';
import { LEGACY_SEED_SOURCE, seedFoods } from './foodsSeed';

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
  if (rows.length) db.bulkUpsert('foods', rows);
  return { inserted, updated };
}
