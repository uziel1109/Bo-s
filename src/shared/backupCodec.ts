// Formato de respaldo común a escritorio y web (iPad): JSON comprimido con gzip y, si hay contraseña,
// cifrado con AES-256-GCM y clave derivada con PBKDF2-SHA256 (600 000 iteraciones).
// Solo usa Web Crypto y CompressionStream, disponibles en Node ≥ 18, Electron y Safari ≥ 16.4.

export interface BackupPayload {
  format: 'bodyos-backup';
  version: number;
  createdAt: string;
  source?: 'escritorio' | 'web';
  db: string; // base64
  photos: Record<string, string>; // nombre → base64 (sin cifrar dentro del respaldo; el respaldo completo se cifra)
}

const enc = new TextEncoder();
const MAGIC_PLAIN = 'BODYOS-BK0';
const MAGIC_V2 = 'BODYOS-BK2';
export const MAGIC_V1 = 'BODYOS-BK1'; // formato antiguo (scrypt), solo lo lee el escritorio
const ITER = 600_000;

async function pipe(data: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const blob = new Blob([data as BlobPart]);
  const out = await new Response(blob.stream().pipeThrough(stream)).arrayBuffer();
  return new Uint8Array(out);
}
export const gzip = (d: Uint8Array) => pipe(d, new CompressionStream('gzip'));
export const gunzip = (d: Uint8Array) => pipe(d, new DecompressionStream('gzip'));

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

const startsWith = (b: Uint8Array, magic: string) => new TextDecoder().decode(b.subarray(0, magic.length)) === magic;

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt as BufferSource, iterations: ITER, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function packBackup(payload: BackupPayload, password: string | null): Promise<Uint8Array> {
  const gz = await gzip(enc.encode(JSON.stringify(payload)));
  if (!password) return concat(enc.encode(MAGIC_PLAIN), gz);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, gz as BufferSource));
  return concat(enc.encode(MAGIC_V2), salt, iv, ct);
}

export function backupKind(buf: Uint8Array): 'plain' | 'v2' | 'v1' | 'unknown' {
  if (startsWith(buf, MAGIC_PLAIN)) return 'plain';
  if (startsWith(buf, MAGIC_V2)) return 'v2';
  if (startsWith(buf, MAGIC_V1)) return 'v1';
  return 'unknown';
}

export async function unpackBackup(buf: Uint8Array, password: string | null): Promise<BackupPayload> {
  const kind = backupKind(buf);
  let gz: Uint8Array;
  if (kind === 'plain') gz = buf.subarray(MAGIC_PLAIN.length);
  else if (kind === 'v2') {
    if (!password) throw new Error('Este respaldo está protegido con contraseña.');
    let o = MAGIC_V2.length;
    const salt = buf.subarray(o, (o += 16));
    const iv = buf.subarray(o, (o += 12));
    const key = await deriveKey(password, salt);
    try {
      gz = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, buf.subarray(o) as BufferSource));
    } catch {
      throw new Error('Contraseña incorrecta o archivo dañado.');
    }
  } else if (kind === 'v1') throw new Error('Este respaldo usa el formato anterior: restáuralo en la versión de escritorio.');
  else throw new Error('El archivo no es un respaldo de BODY OS.');
  const payload = JSON.parse(new TextDecoder().decode(await gunzip(gz))) as BackupPayload;
  if (payload.format !== 'bodyos-backup') throw new Error('Formato de respaldo desconocido.');
  return payload;
}

/** Base64 por bloques (evita desbordar la pila con imágenes grandes en el navegador). */
export function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export function fromBase64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
