import { useEffect, useState } from 'react';
// Acceso tipado al proceso principal.
import type { ListQuery, TableName } from '@shared/schema';

const inv = <T,>(ch: string, ...args: unknown[]) => window.bodyos.invoke(ch, ...args) as Promise<T>;

export const api = {
  list: <T,>(table: TableName, q?: ListQuery) => inv<T[]>('db:list', table, q),
  get: <T,>(table: TableName, id: string | number) => inv<T | null>('db:get', table, id),
  upsert: <T,>(table: TableName, row: object) => inv<T>('db:upsert', table, row),
  bulkUpsert: (table: TableName, rows: object[]) => inv<number>('db:bulkUpsert', table, rows),
  remove: (table: TableName, id: string | number) => inv<boolean>('db:remove', table, id),
  setActive: (table: 'nutrition_plans' | 'meal_plans' | 'routines', id: string) => inv<boolean>('db:setActive', table, id),
  pickPhoto: (meta: object) => inv<Record<string, unknown> | null>('photos:pick', meta),
  addPhotoFromPath: (p: string, meta: object) => inv<Record<string, unknown>>('photos:addFromPath', p, meta),
  backupCreate: (password: string | null) => inv<string | null>('backup:create', password),
  backupRestore: (password: string | null) => inv<string | null>('backup:restore', password),
  exportJson: () => inv<string | null>('export:json'),
  exportCsv: () => inv<string | null>('export:csv'),
  importCsv: (kind: 'body_logs' | 'food_logs' | 'steps_logs') => inv<{ imported: number; errors: string[] } | null>('import:csv', kind),
  importJson: () => inv<number | null>('import:json'),
  deleteAll: () => inv<boolean>('data:deleteAll'),
  barcode: (code: string) => inv<{ name: string; kcal: number | null; protein: number | null; carbs: number | null; fat: number | null; fiber: number | null; barcode: string } | null>('food:barcode', code),
  aiConfig: () => inv<{ enabled: boolean; model: string; hasKey: boolean; secureStorage: boolean }>('ai:config'),
  aiSetConfig: (c: { enabled?: boolean; model?: string }) => inv<void>('ai:setConfig', c),
  aiSetKey: (k: string) => inv<void>('ai:setKey', k),
  aiClearKey: () => inv<void>('ai:clearKey'),
  aiChat: (q: string, ctx: string, history: { role: 'user' | 'assistant'; content: string }[]) => inv<string>('ai:chat', q, ctx, history),
  aiAnalyzeFood: (b64: string, mediaType: 'image/jpeg', foods: { id: string; name: string }[], planHint?: string) => inv<string>('ai:analyzeFood', b64, mediaType, foods, planHint),
  info: () => inv<{ version: string; dataDir: string; photoEncryption: string; platform: string; persisted?: boolean }>('app:info'),
  openDataFolder: () => inv<string>('app:openDataFolder'),
  saveFile: (name: string, content: string | Uint8Array, mime: string) => inv<string | null>('file:save', name, content, mime),
  pathForFile: (f: File) => window.bodyos.pathForFile(f),
  /** Agrega una foto desde un archivo arrastrado o seleccionado. */
  addPhotoFile: (f: File, meta: object) => (isWeb() ? inv<Record<string, unknown>>('photos:addFile', f, meta) : inv<Record<string, unknown>>('photos:addFromPath', window.bodyos.pathForFile(f), meta)),
  cameraAccess: () => inv<boolean>('camera:access'),
  /** Foto tomada con la cámara de la app (JPEG). */
  addPhotoBytes: (bytes: Uint8Array, meta: object) => inv<Record<string, unknown>>('photos:addBytes', bytes, meta),
  photoObjectUrl: (fileName: string) => inv<string>('photos:url', fileName),
};

export const isWeb = () => window.bodyos?.platform === 'web';

export const photoUrl = (fileName: string) => `bodyos-photo://${encodeURIComponent(fileName)}`;

/** URL de una foto: protocolo interno en escritorio; objeto descifrado en memoria en la versión web. */
export function usePhotoUrl(fileName: string): string {
  const [url, setUrl] = useState(() => (isWeb() ? '' : photoUrl(fileName)));
  useEffect(() => {
    if (!isWeb()) return;
    let alive = true;
    api.photoObjectUrl(fileName).then((u) => alive && setUrl(u)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [fileName]);
  return url;
}
