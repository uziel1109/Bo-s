// Cifrado local: fotos cifradas en reposo (AES-256-GCM) y respaldos protegidos con contraseña (scrypt + AES-256-GCM).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const MAGIC_BACKUP = Buffer.from('BODYOS-BK1');
const MAGIC_PHOTO = Buffer.from('BOP1');

export interface KeyStore {
  isEncryptionAvailable(): boolean;
  encryptString(s: string): Buffer;
  decryptString(b: Buffer): string;
}

/**
 * Clave de cifrado de fotos: 32 bytes aleatorios, guardados protegidos por el llavero del sistema
 * (Electron safeStorage) cuando está disponible; si no, en un archivo con permisos restringidos.
 */
export function loadOrCreatePhotoKey(dir: string, ks: KeyStore | null): Buffer {
  fs.mkdirSync(dir, { recursive: true });
  const fProt = path.join(dir, 'photo.key.enc');
  const fPlain = path.join(dir, 'photo.key');
  if (fs.existsSync(fProt) && ks?.isEncryptionAvailable()) return Buffer.from(ks.decryptString(fs.readFileSync(fProt)), 'base64');
  if (fs.existsSync(fPlain)) return fs.readFileSync(fPlain);
  const key = crypto.randomBytes(32);
  if (ks?.isEncryptionAvailable()) fs.writeFileSync(fProt, ks.encryptString(key.toString('base64')));
  else fs.writeFileSync(fPlain, key, { mode: 0o600 });
  return key;
}

export function encryptBytes(key: Buffer, data: Buffer): Buffer {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([c.update(data), c.final()]);
  return Buffer.concat([MAGIC_PHOTO, iv, c.getAuthTag(), enc]);
}

export function decryptBytes(key: Buffer, data: Buffer): Buffer {
  if (!data.subarray(0, MAGIC_PHOTO.length).equals(MAGIC_PHOTO)) return data; // archivo sin cifrar (compatibilidad)
  const o = MAGIC_PHOTO.length;
  const iv = data.subarray(o, o + 12);
  const tag = data.subarray(o + 12, o + 28);
  const d = crypto.createDecipheriv('aes-256-gcm', key, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(data.subarray(o + 28)), d.final()]);
}

export interface BackupPayload {
  format: 'bodyos-backup';
  version: number;
  createdAt: string;
  db: string; // base64
  photos: Record<string, string>; // nombre → base64 (descifrado)
}

export function packBackup(payload: BackupPayload, password: string | null): Buffer {
  const json = Buffer.from(JSON.stringify(payload));
  const gz = zlib.gzipSync(json);
  if (!password) return Buffer.concat([Buffer.from('BODYOS-BK0'), gz]);
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, 32, { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([c.update(gz), c.final()]);
  return Buffer.concat([MAGIC_BACKUP, salt, iv, c.getAuthTag(), enc]);
}

export function unpackBackup(buf: Buffer, password: string | null): BackupPayload {
  let gz: Buffer;
  if (buf.subarray(0, 10).toString() === 'BODYOS-BK0') gz = buf.subarray(10);
  else if (buf.subarray(0, MAGIC_BACKUP.length).equals(MAGIC_BACKUP)) {
    if (!password) throw new Error('Este respaldo está protegido con contraseña.');
    let o = MAGIC_BACKUP.length;
    const salt = buf.subarray(o, (o += 16));
    const iv = buf.subarray(o, (o += 12));
    const tag = buf.subarray(o, (o += 16));
    const key = crypto.scryptSync(password, salt, 32, { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
    const d = crypto.createDecipheriv('aes-256-gcm', key, iv);
    d.setAuthTag(tag);
    try {
      gz = Buffer.concat([d.update(buf.subarray(o)), d.final()]);
    } catch {
      throw new Error('Contraseña incorrecta o archivo dañado.');
    }
  } else throw new Error('El archivo no es un respaldo de BODY OS.');
  const payload = JSON.parse(zlib.gunzipSync(gz).toString()) as BackupPayload;
  if (payload.format !== 'bodyos-backup') throw new Error('Formato de respaldo desconocido.');
  return payload;
}
