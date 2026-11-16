// Capa de base de datos: SQLite (sql.js/WebAssembly) persistida en un archivo local.
// Escritura atómica (archivo temporal + rename) y guardado diferido para no bloquear la interfaz.
import fs from 'node:fs';
import path from 'node:path';
import type { Database, SqlJsStatic } from 'sql.js';
import { SCHEMA, SCHEMA_VERSION, type ListQuery, type TableName } from '../shared/schema';

type Row = Record<string, unknown>;

export class LocalDB {
  private db: Database;
  private saveTimer: NodeJS.Timeout | null = null;
  private dirty = false;
  private closed = false;

  constructor(
    private SQL: SqlJsStatic,
    private file: string,
  ) {
    let data: Uint8Array | undefined;
    if (fs.existsSync(file)) data = fs.readFileSync(file);
    this.db = data ? new SQL.Database(data) : new SQL.Database();
    this.migrate();
  }

  private migrate() {
    this.db.run('PRAGMA foreign_keys = ON;');
    for (const [name, spec] of Object.entries(SCHEMA)) {
      const cols = Object.entries(spec.columns)
        .map(([c, t]) => `"${c}" ${t === 'JSON' ? 'TEXT' : t}${c === spec.pk ? ' PRIMARY KEY' : ''}`)
        .join(', ');
      this.db.run(`CREATE TABLE IF NOT EXISTS "${name}" (${cols});`);
      // Columnas nuevas en versiones posteriores
      const existing = new Set(this.all(`PRAGMA table_info("${name}")`).map((r) => r.name as string));
      for (const [c, t] of Object.entries(spec.columns)) if (!existing.has(c)) this.db.run(`ALTER TABLE "${name}" ADD COLUMN "${c}" ${t === 'JSON' ? 'TEXT' : t};`);
      for (const idx of spec.indexes ?? []) this.db.run(`CREATE INDEX IF NOT EXISTS "idx_${name}_${idx}" ON "${name}"("${idx}");`);
    }
    this.db.run(`INSERT OR REPLACE INTO settings(key, value) VALUES ('schema_version', '${SCHEMA_VERSION}')`);
    this.scheduleSave();
  }

  private all(sql: string, params: (string | number | null)[] = []): Row[] {
    const st = this.db.prepare(sql);
    try {
      st.bind(params);
      const out: Row[] = [];
      while (st.step()) out.push(st.getAsObject() as Row);
      return out;
    } finally {
      st.free();
    }
  }

  private spec(table: string) {
    const s = SCHEMA[table];
    if (!s) throw new Error(`Tabla no permitida: ${table}`);
    return s;
  }

  private checkCol(table: string, col: string) {
    if (!(col in this.spec(table).columns)) throw new Error(`Columna no permitida: ${table}.${col}`);
  }

  private decode(table: string, r: Row): Row {
    const s = this.spec(table);
    const out: Row = {};
    for (const [c, t] of Object.entries(s.columns)) {
      const v = r[c];
      if (t === 'JSON') {
        try {
          out[c] = v == null ? null : JSON.parse(v as string);
        } catch {
          out[c] = null;
        }
      } else out[c] = v ?? null;
    }
    return out;
  }

  private encode(table: string, row: Row): { cols: string[]; vals: (string | number | null)[] } {
    const s = this.spec(table);
    const cols: string[] = [];
    const vals: (string | number | null)[] = [];
    for (const [c, v] of Object.entries(row)) {
      if (!(c in s.columns)) continue; // ignora campos desconocidos
      const t = s.columns[c];
      cols.push(c);
      if (v === undefined || v === null) vals.push(null);
      else if (t === 'JSON') vals.push(JSON.stringify(v));
      else if (t === 'REAL' || t === 'INTEGER') {
        const n = typeof v === 'boolean' ? (v ? 1 : 0) : Number(v);
        if (Number.isNaN(n)) throw new Error(`Valor numérico inválido en ${table}.${c}`);
        vals.push(t === 'INTEGER' ? Math.round(n) : n);
      } else vals.push(String(v));
    }
    if (!cols.includes(s.pk)) throw new Error(`Falta la clave primaria ${s.pk} en ${table}`);
    return { cols, vals };
  }

  list(table: TableName, q: ListQuery = {}): Row[] {
    this.spec(table);
    const where: string[] = [];
    const params: (string | number | null)[] = [];
    for (const [c, v] of Object.entries(q.where ?? {})) {
      this.checkCol(table, c);
      if (v === null) where.push(`"${c}" IS NULL`);
      else {
        where.push(`"${c}" = ?`);
        params.push(v);
      }
    }
    if (q.range) {
      this.checkCol(table, q.range.column);
      if (q.range.from != null) {
        where.push(`"${q.range.column}" >= ?`);
        params.push(q.range.from);
      }
      if (q.range.to != null) {
        where.push(`"${q.range.column}" <= ?`);
        params.push(q.range.to);
      }
    }
    let sql = `SELECT * FROM "${table}"`;
    if (where.length) sql += ` WHERE ${where.join(' AND ')}`;
    if (q.orderBy) {
      this.checkCol(table, q.orderBy.column);
      sql += ` ORDER BY "${q.orderBy.column}" ${q.orderBy.dir === 'DESC' ? 'DESC' : 'ASC'}`;
    }
    if (q.limit) sql += ` LIMIT ${Math.max(1, Math.floor(q.limit))}`;
    return this.all(sql, params).map((r) => this.decode(table, r));
  }

  get(table: TableName, id: string | number): Row | null {
    const s = this.spec(table);
    const r = this.all(`SELECT * FROM "${table}" WHERE "${s.pk}" = ?`, [id]);
    return r[0] ? this.decode(table, r[0]) : null;
  }

  upsert(table: TableName, row: Row): Row {
    const { cols, vals } = this.encode(table, row);
    const s = this.spec(table);
    const updates = cols.filter((c) => c !== s.pk).map((c) => `"${c}" = excluded."${c}"`);
    const sql = `INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})` + (updates.length ? ` ON CONFLICT("${s.pk}") DO UPDATE SET ${updates.join(', ')}` : ` ON CONFLICT("${s.pk}") DO NOTHING`);
    this.db.run(sql, vals);
    this.scheduleSave();
    return this.get(table, row[s.pk] as string)!;
  }

  bulkUpsert(table: TableName, rows: Row[]): number {
    this.db.run('BEGIN');
    try {
      for (const r of rows) {
        const { cols, vals } = this.encode(table, r);
        const s = this.spec(table);
        const updates = cols.filter((c) => c !== s.pk).map((c) => `"${c}" = excluded."${c}"`);
        this.db.run(`INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})` + (updates.length ? ` ON CONFLICT("${s.pk}") DO UPDATE SET ${updates.join(', ')}` : ''), vals);
      }
      this.db.run('COMMIT');
    } catch (e) {
      this.db.run('ROLLBACK');
      throw e;
    }
    this.scheduleSave();
    return rows.length;
  }

  remove(table: TableName, id: string | number): void {
    const s = this.spec(table);
    this.db.run(`DELETE FROM "${table}" WHERE "${s.pk}" = ?`, [id]);
    this.scheduleSave();
  }

  /** Marca todas las filas de una tabla con active=0 excepto la indicada (planes, rutinas). */
  setActive(table: 'nutrition_plans' | 'meal_plans' | 'routines', id: string): void {
    this.db.run(`UPDATE "${table}" SET active = CASE WHEN id = ? THEN 1 ELSE 0 END`, [id]);
    this.scheduleSave();
  }

  count(table: TableName): number {
    this.spec(table);
    return Number(this.all(`SELECT COUNT(*) AS n FROM "${table}"`)[0].n);
  }

  clearAll(): void {
    for (const t of Object.keys(SCHEMA)) this.db.run(`DELETE FROM "${t}"`);
    this.migrate();
    this.flush();
  }

  exportBytes(): Uint8Array {
    return this.db.export();
  }

  replaceWith(bytes: Uint8Array): void {
    const test = new this.SQL.Database(bytes);
    test.prepare('SELECT 1 FROM settings').free(); // valida que sea una base de BODY OS
    this.db.close();
    this.db = test;
    this.migrate();
    this.flush();
  }

  dump(): Record<string, Row[]> {
    const out: Record<string, Row[]> = {};
    for (const t of Object.keys(SCHEMA)) out[t] = this.list(t as TableName);
    return out;
  }

  private scheduleSave() {
    this.dirty = true;
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.flush();
    }, 250);
  }

  flush(): void {
    if (this.closed) return;
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    if (!this.dirty && fs.existsSync(this.file)) return;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, Buffer.from(this.db.export()));
    fs.renameSync(tmp, this.file);
    this.dirty = false;
  }

  close(): void {
    if (this.closed) return;
    this.flush();
    this.closed = true;
    this.db.close();
  }
}
