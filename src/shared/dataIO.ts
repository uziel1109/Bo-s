// Exportación/importación de datos (CSV y JSON), común a escritorio y web.
import type { LocalDB } from './db/localdb';
import { SCHEMA, type TableName } from './schema';

export type ImportKind = 'body_logs' | 'food_logs' | 'steps_logs';

const newId = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`);

export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    if (v == null) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
}

export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') q = false;
      else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',' || ch === ';') {
      cur.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      cur.push(field);
      rows.push(cur);
      cur = [];
      field = '';
    } else field += ch;
  }
  if (field || cur.length) {
    cur.push(field);
    rows.push(cur);
  }
  const [head, ...body] = rows.filter((r) => r.some((x) => x.trim()));
  if (!head) return [];
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim().toLowerCase(), (r[i] ?? '').trim()])));
}

export function importRows(db: LocalDB, kind: ImportKind, rows: Record<string, string>[]): { imported: number; errors: string[] } {
  const num = (v?: string) => (v == null || v === '' ? null : Number(v.replace(',', '.')));
  const okDate = (d?: string) => {
    if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
    const [y, m, dd] = d.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, dd));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === dd;
  };
  let n = 0;
  const errors: string[] = [];
  rows.forEach((r, i) => {
    const date = r.date ?? r.fecha;
    if (!okDate(date)) {
      errors.push(`Fila ${i + 2}: fecha inválida (usa AAAA-MM-DD).`);
      return;
    }
    if (kind === 'body_logs') {
      const existing = db.list('body_logs', { where: { date } })[0];
      const row: Record<string, unknown> = { id: existing?.id ?? newId(), date };
      const map: Record<string, string[]> = { weight: ['weight', 'peso'], waist: ['waist', 'cintura'], abdomen: ['abdomen'], neck: ['neck', 'cuello'], chest: ['chest', 'pecho'], hip: ['hip', 'cadera'], arm: ['arm', 'brazo'], thigh: ['thigh', 'muslo'], calf: ['calf', 'pantorrilla'], bf_percent: ['bf_percent', 'grasa'] };
      for (const [col, keys] of Object.entries(map)) {
        const k = keys.find((x) => r[x] != null && r[x] !== '');
        if (k) {
          const v = num(r[k]);
          if (v == null || Number.isNaN(v) || v <= 0) {
            errors.push(`Fila ${i + 2}: valor inválido en ${k}.`);
            return;
          }
          row[col] = v;
        }
      }
      db.upsert('body_logs', { ...(existing ?? {}), ...row });
    } else if (kind === 'steps_logs') {
      const s = num(r.steps ?? r.pasos);
      if (s == null || Number.isNaN(s) || s < 0) {
        errors.push(`Fila ${i + 2}: pasos inválidos.`);
        return;
      }
      db.upsert('steps_logs', { date, steps: Math.round(s) });
    } else {
      const vals = ['grams', 'kcal', 'protein', 'carbs', 'fat'].map((k) => num(r[k]));
      if (!r.name || vals.some((v) => v == null || Number.isNaN(v) || v < 0)) {
        errors.push(`Fila ${i + 2}: faltan name, grams, kcal, protein, carbs o fat.`);
        return;
      }
      db.upsert('food_logs', { id: newId(), date, meal: r.meal || 'extra', name: r.name, grams: vals[0], kcal: vals[1], protein: vals[2], carbs: vals[3], fat: vals[4], fiber: num(r.fiber) ?? 0, created_at: new Date().toISOString() });
    }
    n++;
  });
  return { imported: n, errors };
}


/** Importa una exportación JSON de BODY OS (las fotos no se incluyen en ese formato). */
export function importJsonTables(db: LocalDB, parsed: unknown): number {
  const tables = (parsed as { tables?: Record<string, Record<string, unknown>[]> })?.tables;
  if (!tables) throw new Error('El archivo no es una exportación de BODY OS.');
  let n = 0;
  for (const [t, rows] of Object.entries(tables)) {
    if (!(t in SCHEMA) || !Array.isArray(rows) || t === 'photos') continue;
    n += db.bulkUpsert(t as TableName, rows);
  }
  return n;
}
