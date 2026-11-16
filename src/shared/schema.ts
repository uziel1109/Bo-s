// Esquema de la base de datos local. Lo usa el proceso principal para crear tablas y para validar
// cualquier lectura/escritura que llegue desde la interfaz (lista blanca de tablas y columnas).

export type ColType = 'TEXT' | 'REAL' | 'INTEGER' | 'JSON';

export interface TableSpec {
  pk: string;
  columns: Record<string, ColType>;
  indexes?: string[];
}

export const SCHEMA: Record<string, TableSpec> = {
  settings: { pk: 'key', columns: { key: 'TEXT', value: 'JSON' } },
  profile: { pk: 'id', columns: { id: 'INTEGER', data: 'JSON', created_at: 'TEXT', updated_at: 'TEXT' } },
  body_logs: {
    pk: 'id',
    columns: { id: 'TEXT', date: 'TEXT', weight: 'REAL', waist: 'REAL', abdomen: 'REAL', neck: 'REAL', chest: 'REAL', hip: 'REAL', arm: 'REAL', thigh: 'REAL', calf: 'REAL', bf_percent: 'REAL', bf_method: 'TEXT', notes: 'TEXT' },
    indexes: ['date'],
  },
  foods: {
    pk: 'id',
    columns: { id: 'TEXT', name: 'TEXT', category: 'TEXT', kcal: 'REAL', protein: 'REAL', carbs: 'REAL', fat: 'REAL', fiber: 'REAL', unit_name: 'TEXT', unit_grams: 'REAL', source: 'TEXT', verified: 'INTEGER', custom: 'INTEGER', barcode: 'TEXT', tags: 'TEXT', price_per_kg: 'REAL' },
    indexes: ['name', 'barcode'],
  },
  recipes: { pk: 'id', columns: { id: 'TEXT', name: 'TEXT', items: 'JSON', servings: 'REAL', notes: 'TEXT', created_at: 'TEXT' } },
  favorites: { pk: 'id', columns: { id: 'TEXT', name: 'TEXT', items: 'JSON', created_at: 'TEXT' } },
  food_logs: {
    pk: 'id',
    columns: { id: 'TEXT', date: 'TEXT', meal: 'TEXT', food_id: 'TEXT', name: 'TEXT', grams: 'REAL', kcal: 'REAL', protein: 'REAL', carbs: 'REAL', fat: 'REAL', fiber: 'REAL', created_at: 'TEXT' },
    indexes: ['date'],
  },
  nutrition_plans: { pk: 'id', columns: { id: 'TEXT', created_at: 'TEXT', active: 'INTEGER', scenario: 'TEXT', targets: 'JSON', reason: 'TEXT' } },
  meal_plans: { pk: 'id', columns: { id: 'TEXT', created_at: 'TEXT', active: 'INTEGER', data: 'JSON' } },
  adjustments: {
    pk: 'id',
    columns: { id: 'TEXT', created_at: 'TEXT', kind: 'TEXT', title: 'TEXT', justification: 'JSON', payload: 'JSON', status: 'TEXT', resolved_at: 'TEXT' },
  },
  routines: { pk: 'id', columns: { id: 'TEXT', created_at: 'TEXT', active: 'INTEGER', data: 'JSON' } },
  workout_sessions: {
    pk: 'id',
    columns: { id: 'TEXT', date: 'TEXT', routine_id: 'TEXT', day_key: 'TEXT', day_name: 'TEXT', exercises: 'JSON', notes: 'TEXT', duration_min: 'REAL', session_rpe: 'REAL', completed: 'INTEGER' },
    indexes: ['date'],
  },
  cardio_logs: {
    pk: 'id',
    columns: { id: 'TEXT', date: 'TEXT', modality: 'TEXT', minutes: 'REAL', intensity: 'TEXT', avg_hr: 'REAL', distance_km: 'REAL', rpe: 'REAL', device_kcal: 'REAL', notes: 'TEXT' },
    indexes: ['date'],
  },
  steps_logs: { pk: 'date', columns: { date: 'TEXT', steps: 'INTEGER' } },
  water_logs: { pk: 'id', columns: { id: 'TEXT', date: 'TEXT', time: 'TEXT', ml: 'REAL', context: 'TEXT' }, indexes: ['date'] },
  recovery_logs: { pk: 'date', columns: { date: 'TEXT', sleep_hours: 'REAL', sleep_quality: 'INTEGER', energy: 'INTEGER', soreness: 'INTEGER', stress: 'INTEGER', notes: 'TEXT' } },
  supplement_stack: { pk: 'id', columns: { id: 'TEXT', supplement_key: 'TEXT', name: 'TEXT', dose: 'TEXT', timing: 'TEXT', started_at: 'TEXT', active: 'INTEGER', notes: 'TEXT' } },
  supplement_logs: { pk: 'id', columns: { id: 'TEXT', date: 'TEXT', supplement_key: 'TEXT', name: 'TEXT', dose: 'TEXT' }, indexes: ['date'] },
  photos: { pk: 'id', columns: { id: 'TEXT', date: 'TEXT', pose: 'TEXT', file_name: 'TEXT', conditions: 'JSON', notes: 'TEXT' }, indexes: ['date'] },
  calendar_tasks: { pk: 'id', columns: { id: 'TEXT', date: 'TEXT', task_key: 'TEXT', title: 'TEXT', type: 'TEXT', done: 'INTEGER', custom: 'INTEGER' }, indexes: ['date'] },
  weekly_reports: { pk: 'id', columns: { id: 'TEXT', week_start: 'TEXT', created_at: 'TEXT', data: 'JSON' } },
};

export type TableName = keyof typeof SCHEMA;

export const SCHEMA_VERSION = 1;

export interface ListQuery {
  where?: Record<string, string | number | null>;
  range?: { column: string; from?: string; to?: string };
  orderBy?: { column: string; dir?: 'ASC' | 'DESC' };
  limit?: number;
}
