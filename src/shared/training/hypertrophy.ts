// Motor de hipertrofia: mesociclos con RIR progresivo, volumen por músculo ajustado con tu retroalimentación,
// técnicas avanzadas, progreso por músculo y calibración de RIR.
//
// Evidencia (resumen):
// - Dosis-respuesta del volumen: más series semanales → más hipertrofia hasta ~10–20 series por músculo, con
//   rendimientos decrecientes (Schoenfeld 2017; Pelland 2024). La tolerancia es individual, por eso se ajusta
//   por músculo con señales de recuperación y rendimiento (enfoque de autorregulación).
// - Proximidad al fallo: la hipertrofia es similar entre ~0–3 RIR; acercarse al fallo de forma progresiva
//   dentro del bloque y descargar después controla la fatiga (Refalo 2023; Robinson 2024).
// - En déficit calórico la capacidad de recuperación es menor: se usa un techo de volumen más bajo.
// - Técnicas como myo-reps, series descendentes y parciales en estiramiento logran un estímulo similar en menos
//   tiempo (Sødal 2023; Coleman 2023; Wolf 2023), por eso se ofrecen solo en la última serie de aislamientos.
import type { Muscle, SetLog, WorkoutSession, BodyLog } from '../types';
import type { Routine, RoutineDay, RoutineExercise } from './generator';
import { getExercise, stretchOf, EXERCISES, isAvailable, type Exercise } from './exercises';
import { bestE1rm } from './progression';
import { addDays, daysBetween, mean, round } from '../utils';

// ───────────────────────── Mesociclo

export interface Mesocycle {
  id: string;
  start: string; // lunes de la semana 1
  weeks: number; // semanas de acumulación (3–6); después viene 1 de descarga
  techniques: boolean;
  createdAt: string;
  endedAt?: string | null;
  /** Series de más o de menos con las que arranca, aprendidas del bloque anterior. */
  carry?: Partial<Record<Muscle, number>>;
}

export interface MesoWeek {
  week: number; // 1-based; weeks+1 = descarga
  deload: boolean;
  finished: boolean;
}

export function mesoWeek(m: Mesocycle, date: string): MesoWeek {
  const d = daysBetween(m.start, date);
  const week = Math.floor(Math.max(0, d) / 7) + 1;
  return { week, deload: week === m.weeks + 1, finished: week > m.weeks + 1 || !!m.endedAt };
}

/** RIR objetivo: baja de 3 a 0 a lo largo del bloque; los compuestos nunca por debajo de 1 (seguridad). */
export function rirForWeek(week: number, weeks: number, compound: boolean): number {
  if (week > weeks) return 3; // descarga
  const base = weeks <= 1 ? 2 : Math.round(3 - (3 * (week - 1)) / (weeks - 1));
  return Math.max(compound ? 1 : 0, base);
}

export const VOLUME_LIMITS = { min: 6, maxDeficit: 20, max: 24 };

// ───────────────────────── Retroalimentación por músculo

export interface MuscleFeedback {
  id: string; // `${session_id}_${muscle}`
  date: string;
  session_id: string;
  muscle: Muscle;
  pump: 0 | 1 | 2; // poco · bien · mucho
  soreness: 0 | 1 | 2 | 3; // al llegar: nada · leve · justo a tiempo · todavía adolorido
  joint: 0 | 1; // molestia articular
}

export const PUMP_LABEL = ['Poco', 'Bien', 'Mucho'];
export const SORENESS_LABEL = ['Nada', 'Leve', 'Se me quitó justo', 'Todavía me dolía'];

export interface MuscleDecision {
  muscle: Muscle;
  delta: -1 | 0 | 1 | 2;
  reason: string;
}

/** Cambio de rendimiento del músculo en una sesión vs la vez anterior de cada ejercicio (fracción; null sin datos). */
export function performanceChange(sessions: WorkoutSession[], session: WorkoutSession, muscle: Muscle): number | null {
  const prior = sessions.filter((s) => s.completed && s.date < session.date).sort((a, b) => b.date.localeCompare(a.date));
  const changes: number[] = [];
  for (const e of session.exercises) {
    if (getExercise(e.exerciseId)?.primary !== muscle) continue;
    const now = bestE1rm(e.sets);
    if (now <= 0) continue;
    const prev = prior.map((s) => s.exercises.find((x) => x.exerciseId === e.exerciseId)).find((x) => x && bestE1rm(x.sets) > 0);
    if (prev) changes.push(now / bestE1rm(prev.sets) - 1);
  }
  return changes.length ? mean(changes) : null;
}

/** Decisión de volumen para un músculo a partir de la retroalimentación de una semana. */
export function decideMuscle(muscle: Muscle, fb: MuscleFeedback[], perf: number | null): MuscleDecision {
  if (!fb.length) return { muscle, delta: 0, reason: 'Sin retroalimentación: se mantiene.' };
  const joint = fb.some((f) => f.joint);
  const soreness = Math.max(...fb.map((f) => f.soreness));
  const pump = Math.round(mean(fb.map((f) => f.pump)));
  if (joint) return { muscle, delta: -1, reason: 'Molestia articular: −1 serie (y considera cambiar el ejercicio).' };
  if (soreness >= 3) return { muscle, delta: -1, reason: 'Llegaste todavía adolorido: −1 serie para recuperarte mejor.' };
  if (perf != null && perf < -0.02) return { muscle, delta: soreness >= 2 ? -1 : 0, reason: soreness >= 2 ? 'Bajó tu rendimiento y la recuperación fue justa: −1 serie.' : 'Bajó tu rendimiento: se mantiene el volumen.' };
  if (soreness === 2) return { muscle, delta: 0, reason: 'Te recuperaste justo a tiempo: volumen en su punto.' };
  if (pump === 0 && soreness === 0) return { muscle, delta: 2, reason: 'Poco estímulo y recuperación de sobra: +2 series.' };
  return { muscle, delta: 1, reason: 'Buena recuperación: +1 serie.' };
}

/** Series directas por músculo (solo músculo principal) de una rutina. */
export function directSets(r: Pick<Routine, 'days'>): Partial<Record<Muscle, number>> {
  const out: Partial<Record<Muscle, number>> = {};
  for (const d of r.days)
    for (const e of d.exercises) {
      const m = getExercise(e.exerciseId)?.primary;
      if (m) out[m] = (out[m] ?? 0) + e.sets;
    }
  return out;
}

export interface MesoVolume {
  base: Partial<Record<Muscle, number>>;
  delta: Partial<Record<Muscle, number>>;
  target: Partial<Record<Muscle, number>>;
  log: (MuscleDecision & { week: number })[];
}

/** Volumen de la semana actual: base de la rutina + decisiones acumuladas de las semanas anteriores del bloque. */
export function mesoVolume(routine: Routine, m: Mesocycle, feedback: MuscleFeedback[], sessions: WorkoutSession[], today: string, deficit: boolean): MesoVolume {
  const base = directSets(routine);
  const delta: Partial<Record<Muscle, number>> = { ...(m.carry ?? {}) };
  const log: MesoVolume['log'] = [];
  const cur = mesoWeek(m, today).week;
  const max = deficit ? VOLUME_LIMITS.maxDeficit : VOLUME_LIMITS.max;
  for (let w = 1; w < Math.min(cur, m.weeks + 1); w++) {
    const from = addDays(m.start, (w - 1) * 7);
    const to = addDays(from, 6);
    const weekSessions = sessions.filter((s) => s.completed && s.date >= from && s.date <= to);
    for (const muscle of Object.keys(base) as Muscle[]) {
      const fb = feedback.filter((f) => f.muscle === muscle && f.date >= from && f.date <= to);
      const perfs = weekSessions.map((s) => performanceChange(sessions, s, muscle)).filter((x): x is number => x != null);
      const dec = decideMuscle(muscle, fb, perfs.length ? mean(perfs) : null);
      if (!fb.length) continue;
      const now = (base[muscle] ?? 0) + (delta[muscle] ?? 0);
      // Piso: 6 series (o hasta 2 menos que la base si la rutina ya tenía poco volumen para ese músculo).
      const floor = Math.min(VOLUME_LIMITS.min, Math.max(2, (base[muscle] ?? 0) - 2));
      // Nunca se recorta por el tope si la decisión era subir, ni se sube por el piso si era bajar.
      const next = dec.delta > 0 ? Math.max(now, Math.min(max, now + dec.delta)) : Math.min(now, Math.max(floor, now + dec.delta));
      const applied = next - now;
      delta[muscle] = (delta[muscle] ?? 0) + applied;
      log.push({ ...dec, delta: applied as MuscleDecision['delta'], reason: applied === dec.delta ? dec.reason : `${dec.reason} (tope de ${max} series en ${deficit ? 'déficit' : 'esta fase'})`, week: w });
    }
  }
  const target: Partial<Record<Muscle, number>> = {};
  for (const k of Object.keys(base) as Muscle[]) target[k] = (base[k] ?? 0) + (delta[k] ?? 0);
  return { base, delta, target, log };
}

/**
 * Rutina de la semana del mesociclo: reparte las series extra (o de menos) de cada músculo entre sus ejercicios
 * de la semana, fija el RIR de la semana y aplica la descarga (mitad de series, RIR 3).
 */
export function mesoRoutine(routine: Routine, m: Mesocycle, vol: MesoVolume, today: string): Routine {
  const wk = mesoWeek(m, today);
  const days: RoutineDay[] = routine.days.map((d) => ({ ...d, exercises: d.exercises.map((e) => ({ ...e })) }));
  if (!wk.deload) {
    for (const muscle of Object.keys(vol.delta) as Muscle[]) {
      let left = vol.delta[muscle] ?? 0;
      const slots: RoutineExercise[] = [];
      for (const d of days) for (const e of d.exercises) if (getExercise(e.exerciseId)?.primary === muscle) slots.push(e);
      if (!slots.length) continue;
      // Más series primero en los ejercicios con mayor estiramiento.
      const order = [...slots].sort((a, b) => stretchOf(b.exerciseId) - stretchOf(a.exerciseId));
      let i = 0;
      let guard = 0;
      while (left !== 0 && guard++ < 60) {
        const e = order[i % order.length];
        if (left > 0 && e.sets < 6) {
          e.sets++;
          left--;
        } else if (left < 0 && e.sets > 1) {
          e.sets--;
          left++;
        }
        i++;
      }
    }
  }
  for (const d of days)
    for (const e of d.exercises) {
      const compound = !!getExercise(e.exerciseId)?.compound;
      e.rir = rirForWeek(wk.week, m.weeks, compound);
      if (wk.deload) e.sets = Math.max(1, Math.ceil(e.sets / 2));
    }
  return { ...routine, days };
}

/** Arranque del siguiente bloque: la mitad de lo que se sumó (o quitó) en el anterior, para empezar cerca de lo tolerado. */
export function carryFrom(vol: MesoVolume): Partial<Record<Muscle, number>> {
  const out: Partial<Record<Muscle, number>> = {};
  for (const [k, v] of Object.entries(vol.delta) as [Muscle, number][]) if (v) out[k] = v > 0 ? Math.floor(v / 2) : Math.ceil(v / 2);
  return out;
}

// ───────────────────────── Técnicas avanzadas

export type Technique = 'myo' | 'drop' | 'parciales';

export const TECHNIQUES: Record<Technique, { name: string; short: string; how: string[]; why: string }> = {
  myo: {
    name: 'Myo-reps',
    short: 'Serie al fallo y mini-series de 3–5 con 15 s de pausa',
    how: ['Haz la serie hasta 0–1 RIR.', 'Descansa 15 s (5 respiraciones profundas).', 'Haz 3–5 repeticiones más con el mismo peso.', 'Repite la pausa y mini-serie 2–4 veces, hasta que no salgan 3.'],
    why: 'Acumula repeticiones cerca del fallo (las más estimulantes) en poco tiempo.',
  },
  drop: {
    name: 'Serie descendente',
    short: 'Al fallo, baja 20–30 % el peso y sigue sin descanso',
    how: ['Haz la serie hasta 0–1 RIR.', 'Sin descansar, baja el peso 20–30 % (cambia el pin o toma otra mancuerna).', 'Repite hasta 0–1 RIR. Una o dos bajadas como máximo.'],
    why: 'Estímulo similar a varias series en menos tiempo; mejor en máquinas y poleas.',
  },
  parciales: {
    name: 'Parciales en estiramiento',
    short: 'Al fallo, sigue con medias repeticiones en la parte estirada',
    how: ['Haz la serie hasta el fallo con rango completo.', 'Sin soltar, sigue con 4–8 repeticiones solo en la mitad donde el músculo está estirado.', 'Controla la bajada; nada de rebotes.'],
    why: 'Las repeticiones en posición estirada son las que más hipertrofia producen.',
  },
};

/** ¿Este ejercicio admite técnica avanzada? Solo aislamientos sin carga axial ni zonas lesionadas. */
export function techniqueFor(ex: Exercise | undefined, injuries: string[] = []): Technique | null {
  if (!ex || ex.compound || ex.pattern === 'core') return null;
  if (ex.stress.some((r) => injuries.includes(r))) return null;
  if (stretchOf(ex.id) === 2) return 'parciales';
  if (ex.equipment.includes('maquinas') || ex.equipment.includes('poleas')) return 'drop';
  return 'myo';
}

/** Series que cuentan: una técnica en la última serie equivale aproximadamente a una serie extra. */
export function effectiveSetCount(sets: SetLog[]): number {
  return sets.filter((s) => s.done).reduce((a, s) => a + (s.technique ? 2 : 1), 0);
}

// ───────────────────────── Progreso por músculo

export interface MuscleProgress {
  muscle: Muscle;
  sessions: number;
  strengthPct: number | null; // cambio del 1RM estimado en las últimas 6 semanas
  stalled: boolean;
  suggestion: string | null;
}

export function muscleProgress(sessions: WorkoutSession[], today: string, equipment: string[] = [], injuries: string[] = [], excluded: string[] = []): MuscleProgress[] {
  const from = addDays(today, -42);
  const recent = sessions.filter((s) => s.completed && s.date >= from && s.date <= today).sort((a, b) => a.date.localeCompare(b.date));
  const byMuscle = new Map<Muscle, Map<string, { date: string; e1: number }[]>>();
  for (const s of recent)
    for (const e of s.exercises) {
      const ex = getExercise(e.exerciseId);
      const e1 = bestE1rm(e.sets);
      if (!ex || e1 <= 0) continue;
      const m = byMuscle.get(ex.primary) ?? new Map();
      m.set(e.exerciseId, [...(m.get(e.exerciseId) ?? []), { date: s.date, e1 }]);
      byMuscle.set(ex.primary, m);
    }
  const out: MuscleProgress[] = [];
  for (const [muscle, exs] of byMuscle) {
    const changes: number[] = [];
    let count = 0;
    let worst: { id: string; pct: number } | null = null;
    for (const [id, pts] of exs) {
      count = Math.max(count, pts.length);
      if (pts.length < 2) continue;
      const first = mean(pts.slice(0, Math.ceil(pts.length / 2)).map((p) => p.e1));
      const last = mean(pts.slice(Math.floor(pts.length / 2)).map((p) => p.e1));
      const pct = last / first - 1;
      changes.push(pct);
      if (!worst || pct < worst.pct) worst = { id, pct };
    }
    const strengthPct = changes.length ? round(mean(changes) * 100, 1) : null;
    const stalled = count >= 3 && strengthPct != null && strengthPct <= 0.5;
    let suggestion: string | null = null;
    if (stalled && worst) {
      const cur = getExercise(worst.id)!;
      const alt = EXERCISES.filter((e) => e.primary === muscle && e.id !== cur.id && stretchOf(e.id) > stretchOf(cur.id) && (!equipment.length || isAvailable(e, equipment as never, injuries, excluded))).sort((a, b) => stretchOf(b.id) - stretchOf(a.id))[0];
      suggestion = alt ? `Cambia ${cur.name} por ${alt.name} (más estiramiento) o suma 1 serie si te recuperas bien.` : `Suma 1 serie semanal si te recuperas bien, o revisa sueño y proteína.`;
    }
    out.push({ muscle, sessions: count, strengthPct, stalled, suggestion });
  }
  return out.sort((a, b) => Number(b.stalled) - Number(a.stalled) || (a.strengthPct ?? 0) - (b.strengthPct ?? 0));
}

/** Cambio de perímetros (cm) en las últimas 8 semanas: brazo, pecho, muslo, pantorrilla. */
export function circumferenceTrend(logs: BodyLog[], today: string): { key: 'arm' | 'chest' | 'thigh' | 'calf'; label: string; first: number; last: number; diff: number }[] {
  const from = addDays(today, -56);
  const keys = [
    ['arm', 'Brazo'],
    ['chest', 'Pecho'],
    ['thigh', 'Muslo'],
    ['calf', 'Pantorrilla'],
  ] as const;
  const out: { key: 'arm' | 'chest' | 'thigh' | 'calf'; label: string; first: number; last: number; diff: number }[] = [];
  for (const [k, label] of keys) {
    const pts = logs.filter((l) => l.date >= from && l.date <= today && l[k]).sort((a, b) => a.date.localeCompare(b.date));
    if (pts.length < 2) continue;
    const first = pts[0][k] as number;
    const last = pts[pts.length - 1][k] as number;
    out.push({ key: k, label, first, last, diff: round(last - first, 1) });
  }
  return out;
}

// ───────────────────────── Calibración de RIR

export interface RirTest {
  date: string;
  exerciseId: string;
  weight: number;
  repsAtGuess: number; // repeticiones hechas cuando creíste estar en el RIR indicado
  guessedRir: number;
  totalReps: number; // hasta el fallo real
}

/** Error = repeticiones que realmente te quedaban − las que creías. Positivo: te quedas lejos del fallo. */
export function rirBias(tests: RirTest[]): { bias: number; n: number; message: string } | null {
  const valid = tests.filter((t) => t.totalReps >= t.repsAtGuess).slice(-3);
  if (!valid.length) return null;
  const errs = valid.map((t) => t.totalReps - t.repsAtGuess - t.guessedRir);
  const bias = round(mean(errs), 1);
  const abs = Math.abs(bias);
  const message =
    abs < 1
      ? 'Tu RIR es preciso: confía en tus estimaciones.'
      : bias > 0
        ? `Sueles quedarte ~${abs} repeticiones más lejos del fallo de lo que crees. Cuando sientas RIR ${2}, probablemente estás en RIR ${round(2 + bias)}: empuja un poco más.`
        : `Sueles estar ~${abs} repeticiones más cerca del fallo de lo que crees: cuida la técnica en las últimas repeticiones.`;
  return { bias, n: valid.length, message };
}

/** Ejercicios seguros para ir al fallo en la prueba: máquinas o poleas, aislamiento o compuesto guiado. */
export const RIR_TEST_EXERCISES = ['press_maquina_pecho', 'extension_cuadriceps', 'curl_polea', 'triceps_polea', 'curl_femoral', 'remo_maquina', 'press_hombro_maquina', 'pec_deck'];
