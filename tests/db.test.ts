import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import initSqlJs from 'sql.js';
import { LocalDB } from '../src/main/db';
import { packBackup, unpackBackup, encryptBytes, decryptBytes } from '../src/main/secure';
import { seedFoods } from '../src/shared/nutrition/foodsSeed';

describe('Base de datos local', () => {
  it('persiste registros después de cerrar y reabrir', async () => {
    const SQL = await initSqlJs();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bodyos-'));
    const file = path.join(dir, 'test.db');
    const db = new LocalDB(SQL, file);
    db.bulkUpsert('foods', seedFoods() as unknown as Record<string, unknown>[]);
    db.upsert('profile', { id: 1, data: { name: 'Prueba', weightKg: 90 }, created_at: 'x', updated_at: 'x' });
    db.upsert('body_logs', { id: 'a', date: '2026-11-01', weight: 90.4, waist: 100 });
    db.upsert('body_logs', { id: 'a', date: '2026-11-01', weight: 90.2 });
    db.close();
    const db2 = new LocalDB(SQL, file);
    expect((db2.get('profile', 1)!.data as { name: string }).name).toBe('Prueba');
    const logs = db2.list('body_logs');
    expect(logs.length).toBe(1);
    expect(logs[0].weight).toBe(90.2);
    expect(logs[0].waist).toBe(100); // el upsert parcial conserva columnas
    expect(db2.count('foods')).toBe(seedFoods().length);
    expect(db2.list('body_logs', { range: { column: 'date', from: '2026-11-02' } }).length).toBe(0);
    db2.close();
  });

  it('rechaza tablas y columnas no permitidas', async () => {
    const SQL = await initSqlJs();
    const db = new LocalDB(SQL, path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'bodyos-')), 't.db'));
    expect(() => db.list('usuarios' as never)).toThrow();
    expect(() => db.list('body_logs', { where: { 'weight; DROP TABLE x': 1 } })).toThrow();
    expect(() => db.upsert('body_logs', { id: 'x', date: '2026-01-01', weight: 'abc' })).toThrow();
  });
});

describe('Cifrado', () => {
  it('respaldo con contraseña', () => {
    const payload = { format: 'bodyos-backup' as const, version: 1, createdAt: 'x', db: 'AAAA', photos: { 'a.jpg.enc': 'BBBB' } };
    const buf = packBackup(payload, 'secreta');
    expect(buf.includes(Buffer.from('AAAA'))).toBe(false);
    expect(unpackBackup(buf, 'secreta')).toEqual(payload);
    expect(() => unpackBackup(buf, 'otra')).toThrow(/Contraseña incorrecta/);
    expect(unpackBackup(packBackup(payload, null), null)).toEqual(payload);
  });

  it('fotos cifradas sin alterar el contenido', () => {
    const key = Buffer.alloc(32, 7);
    const img = Buffer.from([1, 2, 3, 4, 5, 250]);
    const enc = encryptBytes(key, img);
    expect(enc.equals(img)).toBe(false);
    expect(decryptBytes(key, enc).equals(img)).toBe(true);
  });
});
