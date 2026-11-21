// Fases de la dieta: descansos de dieta, días de recarga, eventos sociales y fase de mantenimiento
// al llegar a la meta. Funciones puras: dado el plan base y la configuración, calculan el objetivo de cada día.
//
// Evidencia (resumen):
// - Descansos de dieta de 1–2 semanas en mantenimiento: MATADOR (Byrne 2018) mostró mejor pérdida de grasa
//   por semana de déficit; otros ensayos (Peos 2021, ICECAP) no encontraron ventaja en grasa, pero sí menos
//   hambre y mejor adherencia. Se presentan como herramienta de adherencia, no como "reinicio del metabolismo".
// - Días de recarga (carbohidratos a mantenimiento): evidencia limitada; posible beneficio en rendimiento
//   y adherencia (Campbell 2020). La leptina vuelve a bajar en 1–2 días.
// - Repartir calorías en la semana para un evento mantiene el promedio semanal, que es lo que determina
//   el cambio de peso.
// - Al terminar la dieta: subir a mantenimiento de forma controlada y vigilar la tendencia de peso.
//   Se espera recuperar 1–2 kg de agua y glucógeno, que no es grasa (Trexler 2014; Peos 2019).
import type { NutritionTargets } from '../types';
import { addDays, daysBetween, parseISODate, round } from '../utils';
import { adjustTargetsKcal } from './targets';

export interface DietEvent {
  id: string;
  date: string;
  name: string;
  extraKcal: number; // calorías extra deseadas ese día
  bankDays: number; // días previos en los que se ahorran
}

export interface DietBreakConfig {
  enabled: boolean;
  everyWeeks: number; // semanas de déficit entre descansos (6–12)
  lengthDays: 7 | 14;
  anchor: string; // fecha desde la que se cuentan las semanas
}

export interface RefeedConfig {
  enabled: boolean;
  mode: 'dias_pierna' | 'dias_fijos';
  weekdays: number[]; // solo para 'dias_fijos'
  compensate: boolean; // repartir la diferencia en los demás días para mantener el promedio semanal
}

export interface MaintenancePhase {
  start: string;
  fromKcal: number;
  toKcal: number;
  mode: 'gradual' | 'directo';
  goalWeight: number;
}

export interface PhaseSettings {
  dietBreak?: DietBreakConfig | null;
  refeed?: RefeedConfig | null;
  events?: DietEvent[];
  maintenance?: MaintenancePhase | null;
}

export type DayKind = 'deficit' | 'descanso_dieta' | 'recarga' | 'evento' | 'ahorro' | 'mantenimiento';

export const DAY_KIND_LABEL: Record<DayKind, string> = {
  deficit: 'Día normal',
  descanso_dieta: 'Descanso de dieta',
  recarga: 'Día de recarga',
  evento: 'Evento',
  ahorro: 'Ahorro para evento',
  mantenimiento: 'Fase de mantenimiento',
};

export interface DayPlan {
  date: string;
  kind: DayKind;
  label: string;
  kcal: number;
  delta: number; // diferencia frente al plan base
  notes: string[];
  targets: NutritionTargets;
}

export interface PhaseContext {
  tdee: number;
  floor: number;
  legWeekdays: number[];
}

/** Paso semanal de la fase de mantenimiento. */
export function maintenanceStep(m: MaintenancePhase): number {
  const diff = Math.max(0, m.toKcal - m.fromKcal);
  if (m.mode === 'directo') return diff;
  // Gradual: ≈100–150 kcal por semana, entre 2 y 6 semanas.
  const weeks = Math.min(6, Math.max(2, Math.round(diff / 125)));
  return Math.ceil(diff / weeks / 10) * 10;
}

/** Calorías de la fase de mantenimiento en una fecha. */
export function maintenanceKcalOn(m: MaintenancePhase, date: string): number {
  const d = daysBetween(m.start, date);
  if (d < 0) return m.fromKcal;
  const diff = m.toKcal - m.fromKcal;
  if (m.mode === 'directo') {
    // Dos pasos: ~70 % la primera semana y el resto después (evita un salto brusco de peso por glucógeno).
    return d < 7 ? Math.round((m.fromKcal + diff * 0.7) / 10) * 10 : m.toKcal;
  }
  const step = maintenanceStep(m);
  return Math.min(m.toKcal, m.fromKcal + step * (Math.floor(d / 7) + 1));
}

export function maintenanceWeeks(m: MaintenancePhase): number {
  if (m.mode === 'directo') return 2;
  const step = maintenanceStep(m);
  return step > 0 ? Math.ceil((m.toKcal - m.fromKcal) / step) : 1;
}

/** ¿La fecha cae en un descanso de dieta? */
export function inDietBreak(c: DietBreakConfig | null | undefined, date: string): boolean {
  if (!c?.enabled || date < c.anchor) return false;
  const cycle = c.everyWeeks * 7 + c.lengthDays;
  const pos = daysBetween(c.anchor, date) % cycle;
  return pos >= c.everyWeeks * 7;
}

/** Próximo descanso de dieta a partir de una fecha (inicio y fin). */
export function nextDietBreak(c: DietBreakConfig | null | undefined, from: string): { start: string; end: string } | null {
  if (!c?.enabled) return null;
  for (let i = 0; i < 400; i++) {
    const d = addDays(from, i);
    if (inDietBreak(c, d)) {
      let end = d;
      while (inDietBreak(c, addDays(end, 1))) end = addDays(end, 1);
      // Si hoy ya está a la mitad de un descanso, el inicio real es anterior.
      let start = d;
      while (inDietBreak(c, addDays(start, -1)) && addDays(start, -1) >= c.anchor) start = addDays(start, -1);
      return { start, end };
    }
  }
  return null;
}

function refeedDays(c: RefeedConfig | null | undefined, ctx: PhaseContext): number[] {
  if (!c?.enabled) return [];
  return c.mode === 'dias_pierna' ? ctx.legWeekdays : c.weekdays;
}

/** Cambia solo carbohidratos (recarga): la grasa y la proteína se mantienen. */
function withCarbDelta(t: NutritionTargets, newKcal: number, why: string): NutritionTargets {
  const delta = newKcal - t.kcal;
  return { ...t, kcal: Math.round(newKcal), carbs: Math.max(0, Math.round(t.carbs + delta / 4)), deficit: Math.round(t.tdee - newKcal), deficitPct: round(((t.tdee - newKcal) / t.tdee) * 100, 1), rationale: [...t.rationale, why] };
}

/** Ahorro diario que se aplica en los días previos a un evento (con tope por día). */
export function eventBanking(e: DietEvent, base: number, floor: number): { perDay: number; banked: number; shortfall: number } {
  const days = Math.max(0, Math.min(6, Math.round(e.bankDays)));
  if (!days || e.extraKcal <= 0) return { perDay: 0, banked: 0, shortfall: Math.max(0, e.extraKcal) };
  const room = Math.max(0, base - floor);
  const perDay = Math.min(300, room, Math.ceil(e.extraKcal / days / 10) * 10);
  const banked = perDay * days;
  return { perDay, banked, shortfall: Math.max(0, e.extraKcal - banked) };
}

/** Objetivo del día aplicando la fase activa. `base` son los objetivos del plan vigente. */
export function dayPlanFor(date: string, base: NutritionTargets, ps: PhaseSettings | null | undefined, ctx: PhaseContext): DayPlan {
  const mk = (kind: DayKind, targets: NutritionTargets, notes: string[], label = DAY_KIND_LABEL[kind]): DayPlan => ({ date, kind, label, kcal: targets.kcal, delta: targets.kcal - base.kcal, notes, targets });
  if (!ps) return mk('deficit', base, []);

  // 1) Fase de mantenimiento: sustituye todo lo demás.
  const m = ps.maintenance;
  if (m && date >= m.start) {
    const kcal = maintenanceKcalOn(m, date);
    const week = Math.floor(daysBetween(m.start, date) / 7) + 1;
    const done = kcal >= m.toKcal;
    return mk('mantenimiento', adjustTargetsKcal(base, kcal, `fase de mantenimiento, semana ${week}`), [
      done ? 'Ya estás en tus calorías de mantenimiento estimadas.' : `Semana ${week}: subes calorías de forma gradual hasta ${m.toKcal} kcal.`,
      `Mantén tu peso entre ${round(m.goalWeight * 0.985, 1)} y ${round(m.goalWeight * 1.015, 1)} kg (tendencia). Es normal subir 1–2 kg de agua y glucógeno al inicio.`,
    ]);
  }

  // 2) Descanso de dieta: mantenimiento estimado.
  if (inDietBreak(ps.dietBreak, date)) {
    return mk('descanso_dieta', adjustTargetsKcal(base, Math.max(base.kcal, Math.round(ctx.tdee / 10) * 10), 'descanso de dieta'), ['Calorías de mantenimiento. La proteína no cambia. Sigue entrenando igual.', 'Es normal subir 0.5–1.5 kg de agua y glucógeno; se va al retomar el déficit.']);
  }

  let t = base;
  const notes: string[] = [];
  let kind: DayKind = 'deficit';
  const dow = parseISODate(date).getDay();

  // 3) Recargas: carbohidratos hasta mantenimiento en los días elegidos.
  const rDays = [...new Set(refeedDays(ps.refeed, ctx))].filter((d) => d >= 0 && d <= 6);
  const refeedExtra = Math.max(0, Math.round(ctx.tdee / 10) * 10 - base.kcal);
  if (rDays.length && refeedExtra > 0) {
    if (rDays.includes(dow)) {
      t = withCarbDelta(base, base.kcal + refeedExtra, 'día de recarga de carbohidratos');
      kind = 'recarga';
      notes.push(`+${refeedExtra} kcal en carbohidratos (arroz, papa, tortilla, avena, fruta). Grasa y proteína igual.`);
    } else if (ps.refeed?.compensate && rDays.length < 7) {
      const cut = Math.min(Math.round((refeedExtra * rDays.length) / (7 - rDays.length) / 10) * 10, Math.max(0, base.kcal - ctx.floor));
      if (cut > 0) {
        t = adjustTargetsKcal(base, base.kcal - cut, 'compensación de los días de recarga');
        notes.push(`−${cut} kcal para compensar las recargas y mantener el promedio semanal.`);
      }
    }
  }

  // 4) Eventos: el día del evento suma calorías; los días previos ahorran.
  const events = ps.events ?? [];
  const today = events.find((e) => e.date === date);
  if (today) {
    const b = eventBanking(today, base.kcal, ctx.floor);
    const extra = Math.max(0, today.extraKcal);
    t = adjustTargetsKcal(t, t.kcal + extra, `evento: ${today.name}`);
    kind = 'evento';
    notes.push(`${today.name}: +${extra} kcal${b.banked ? ` (ahorraste ${b.banked} kcal en los días previos)` : ''}.`, 'Prioriza proteína en las comidas del día; el alcohol aporta 7 kcal/g.');
    if (b.shortfall > 0) notes.push(`Esta semana quedará ≈${b.shortfall} kcal por encima del plan: equivale a ≈${round(b.shortfall / 7700, 2)} kg, nada grave.`);
  } else {
    for (const e of events) {
      const until = daysBetween(date, e.date);
      if (until >= 1 && until <= Math.min(6, e.bankDays)) {
        const b = eventBanking(e, base.kcal, ctx.floor);
        if (b.perDay > 0) {
          const k = Math.max(ctx.floor, t.kcal - b.perDay);
          t = adjustTargetsKcal(t, k, `ahorro para ${e.name}`);
          if (kind === 'deficit') kind = 'ahorro';
          notes.push(`−${t.kcal === ctx.floor ? base.kcal - k : b.perDay} kcal para ${e.name} (${until === 1 ? 'mañana' : `en ${until} días`}).`);
        }
      }
    }
  }
  if (kind !== 'evento' && t.kcal < ctx.floor) t = adjustTargetsKcal(t, ctx.floor, 'mínimo de seguridad');
  return mk(kind, t, notes, kind === 'evento' && today ? `Evento: ${today.name}` : DAY_KIND_LABEL[kind]);
}

export function weekPlan(start: string, base: NutritionTargets, ps: PhaseSettings | null | undefined, ctx: PhaseContext): DayPlan[] {
  return Array.from({ length: 7 }, (_, i) => dayPlanFor(addDays(start, i), base, ps, ctx));
}

/** Días de descanso de dieta entre dos fechas (inclusive). */
export function breakDaysBetween(c: DietBreakConfig | null | undefined, from: string, to: string): number {
  if (!c?.enabled || to < from) return 0;
  let n = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) if (inDietBreak(c, d)) n++;
  return n;
}

/** Fecha estimada que tiene en cuenta los descansos de dieta (no se pierde grasa durante ellos). */
export function etaWithBreaks(c: DietBreakConfig | null | undefined, from: string, eta: string): { eta: string; extraDays: number } {
  if (!c?.enabled) return { eta, extraDays: 0 };
  const deficitDays = daysBetween(from, eta);
  let d = from;
  let counted = 0;
  let extra = 0;
  while (counted < deficitDays && extra < 3650) {
    d = addDays(d, 1);
    if (inDietBreak(c, d)) extra++;
    else counted++;
  }
  return { eta: d, extraDays: extra };
}

/** Días de la semana con entrenamiento de pierna (cuádriceps, glúteos o isquiotibiales como músculo principal). */
export function legDaysFromRoutine(routine: { days: { weekday: number; exercises: { exerciseId: string }[] }[] } | null, primaryOf: (id: string) => string | undefined): number[] {
  if (!routine) return [];
  return routine.days
    .filter((d) => {
      const legs = d.exercises.filter((e) => ['cuadriceps', 'gluteos', 'isquiotibiales'].includes(primaryOf(e.exerciseId) ?? '')).length;
      return legs >= 2;
    })
    .map((d) => d.weekday);
}

/** ¿Conviene ofrecer la fase de mantenimiento? (a ≤ 1 punto de grasa o ≤ 1 kg del peso meta). */
export function nearGoal(bf: number, targetBf: number, weight: number, goalWeight: number): boolean {
  return bf <= targetBf + 1 || weight <= goalWeight + 1;
}
