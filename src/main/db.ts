// Base de datos del escritorio: LocalDB persistida en un archivo con escritura atómica (temporal + rename).
import fs from 'node:fs';
import path from 'node:path';
import type { SqlJsStatic } from 'sql.js';
import { LocalDB } from '../shared/db/localdb';

export { LocalDB };

export function openFileDB(SQL: SqlJsStatic, file: string): LocalDB {
  const initial = fs.existsSync(file) ? new Uint8Array(fs.readFileSync(file)) : null;
  return new LocalDB(SQL, initial, (bytes) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, Buffer.from(bytes));
    fs.renameSync(tmp, file);
  });
}
