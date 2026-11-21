import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import initSqlJs from 'sql.js';
import { openFileDB } from '../src/main/db';
import { LocalDB } from '../src/shared/db/localdb';
import { packBackup, unpackBackup, encryptBytes, decryptBytes, packLegacyV1 } from '../src/main/secure';
import { packBackup as packShared, unpackBackup as unpackShared, toBase64, fromBase64 } from '../src/shared/backupCodec';
import { importRows, parseCsv, toCsv, importJsonTables } from '../src/shared/dataIO';
import { seedFoods } from '../src/shared/nutrition/foodsSeed';

const tmpFile = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'bodyos-')), 'test.db');

describe('Base de datos local', () => {
  it('persiste registros después de cerrar y reabrir', async () => {
    const SQL = await initSqlJs();
    const file = tmpFile();
    const db = openFileDB(SQL, file);
    db.bulkUpsert('foods', seedFoods() as unknown as Record<string, unknown>[]);
    db.upsert('profile', { id: 1, data: { name: 'Prueba', weightKg: 90 }, created_at: 'x', updated_at: 'x' });
    db.upsert('body_logs', { id: 'a', date: '2026-11-01', weight: 90.4, waist: 100 });
    db.upsert('body_logs', { id: 'a', date: '2026-11-01', weight: 90.2 });
    db.close();
    const db2 = openFileDB(SQL, file);
    expect((db2.get('profile', 1)!.data as { name: string }).name).toBe('Prueba');
    const logs = db2.list('body_logs');
    expect(logs.length).toBe(1);
    expect(logs[0].weight).toBe(90.2);
    expect(logs[0].waist).toBe(100); // el upsert parcial conserva columnas
    expect(db2.count('foods')).toBe(seedFoods().length);
    expect(db2.list('body_logs', { range: { column: 'date', from: '2026-11-02' } }).length).toBe(0);
    db2.close();
  });

  it('funciona con cualquier almacenamiento (como IndexedDB en la versión web)', async () => {
    const SQL = await initSqlJs();
    let stored: Uint8Array | null = null;
    const db = new LocalDB(SQL, null, (b) => (stored = b));
    db.upsert('steps_logs', { date: '2026-11-01', steps: 8000 });
    db.flush();
    expect(stored).not.toBeNull();
    const db2 = new LocalDB(SQL, stored, () => {});
    expect(db2.get('steps_logs', '2026-11-01')!.steps).toBe(8000);
  });

  it('rechaza tablas y columnas no permitidas', async () => {
    const SQL = await initSqlJs();
    const db = openFileDB(SQL, tmpFile());
    expect(() => db.list('usuarios' as never)).toThrow();
    expect(() => db.list('body_logs', { where: { 'weight; DROP TABLE x': 1 } })).toThrow();
    expect(() => db.upsert('body_logs', { id: 'x', date: '2026-01-01', weight: 'abc' })).toThrow();
  });
});

describe('Importación y exportación', () => {
  it('CSV de ida y vuelta, con validación de filas', async () => {
    const SQL = await initSqlJs();
    const db = new LocalDB(SQL, null, () => {});
    const csv = 'fecha,peso,cintura\n2026-11-01,"90,5",100\n2026-13-01,90,\n2026-11-02,abc,99\n';
    const r = importRows(db, 'body_logs', parseCsv(csv));
    expect(r.imported).toBe(1);
    expect(r.errors.length).toBe(2);
    expect(db.list('body_logs')[0].weight).toBe(90.5);
    const back = parseCsv(toCsv(db.list('body_logs')));
    expect(back[0].date).toBe('2026-11-01');
    expect(importJsonTables(db, { tables: { steps_logs: [{ date: '2026-11-03', steps: 5000 }], usuarios: [{}] } })).toBe(1);
  });
});

describe('Respaldos', () => {
  const payload = { format: 'bodyos-backup' as const, version: 2, createdAt: 'x', db: 'AAAA', photos: { 'a.jpg.enc': 'BBBB' } };

  it('con contraseña (formato común escritorio/iPad)', async () => {
    const buf = await packBackup(payload, 'secreta');
    expect(buf.includes(Buffer.from('AAAA'))).toBe(false);
    expect(await unpackBackup(buf, 'secreta')).toEqual(payload);
    await expect(unpackBackup(buf, 'otra')).rejects.toThrow(/Contraseña incorrecta/);
    expect(await unpackBackup(await packBackup(payload, null), null)).toEqual(payload);
    // El códec compartido (el que usa el iPad) lee lo que genera el escritorio y viceversa.
    expect(await unpackShared(new Uint8Array(buf), 'secreta')).toEqual(payload);
    expect(await unpackBackup(Buffer.from(await packShared(payload, 'x1')), 'x1')).toEqual(payload);
  });

  it('el escritorio sigue leyendo el formato anterior', async () => {
    const old = packLegacyV1(payload, 'vieja');
    expect(await unpackBackup(old, 'vieja')).toEqual(payload);
    await expect(unpackShared(new Uint8Array(old), 'vieja')).rejects.toThrow(/escritorio/);
  });

  it('base64 por bloques', () => {
    const big = new Uint8Array(200_000).map((_, i) => i % 256);
    expect(fromBase64(toBase64(big))).toEqual(big);
    expect(toBase64(big)).toBe(Buffer.from(big).toString('base64'));
  });

  it('fotos cifradas sin alterar el contenido', () => {
    const key = Buffer.alloc(32, 7);
    const img = Buffer.from([1, 2, 3, 4, 5, 250]);
    const enc = encryptBytes(key, img);
    expect(enc.equals(img)).toBe(false);
    expect(decryptBytes(key, enc).equals(img)).toBe(true);
  });
});
