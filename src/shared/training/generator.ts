// Generador de rutinas: elige la división según días disponibles y experiencia, y rellena cada sesión
// con los mejores ejercicios disponibles para el equipo, lesiones y exclusiones del usuario.
import type { Equipment, Experience, Muscle, Profile } from '../types';
import { EXERCISES, isAvailable, type Exercise, type Pattern, stretchOf } from './exercises';

export type SplitKey = 'full_body' | 'upper_lower' | 'ppl' | 'ul_ppl';

export const SPLIT_LABEL: Record<SplitKey, string> = {
  full_body: 'Full Body',
  upper_lower: 'Upper / Lower',
  ppl: 'Push / Pull / Legs',
  ul_ppl: 'Upper / Lower + Push / Pull / Legs',
};

export interface RoutineExercise {
  exerciseId: string;
  name: string;
  sets: number;
  repMin: number;
  repMax: number;
  rir: number;
  restSec: number;
  caution?: string;
}

export interface RoutineDay {
  key: string;
  name: string;
  focus: string;
  weekday: number; // 0=Dom
  exercises: RoutineExercise[];
  estMinutes: number;
}

export interface Routine {
  id?: string;
  split: SplitKey;
  splitLabel: string;
  daysPerWeek: number;
  rationale: string[];
  days: RoutineDay[];
  weeklySets: Partial<Record<Muscle, number>>;
  createdAt: string;
}

interface Slot {
  pattern?: Pattern;
  muscle?: Muscle;
  sets: number;
  compound: boolean;
  priority?: number; // menor = más importante (se conserva si falta tiempo)
}

const DAY_TEMPLATES: Record<string, { name: string; focus: string; slots: Slot[] }> = {
  fbA: {
    name: 'Full Body A', focus: 'Cuerpo completo (sentadilla, empuje horizontal, tracción vertical)',
    slots: [
      { pattern: 'sentadilla', sets: 3, compound: true, priority: 1 },
      { pattern: 'empuje_horizontal', sets: 3, compound: true, priority: 1 },
      { pattern: 'traccion_vertical', sets: 3, compound: true, priority: 1 },
      { pattern: 'bisagra', sets: 2, compound: true, priority: 2 },
      { muscle: 'hombro_lateral', sets: 2, compound: false, priority: 3 },
      { muscle: 'biceps', sets: 2, compound: false, priority: 4 },
      { pattern: 'core', sets: 2, compound: false, priority: 5 },
    ],
  },
  fbB: {
    name: 'Full Body B', focus: 'Cuerpo completo (bisagra, empuje vertical, tracción horizontal)',
    slots: [
      { pattern: 'bisagra', sets: 3, compound: true, priority: 1 },
      { pattern: 'traccion_horizontal', sets: 3, compound: true, priority: 1 },
      { pattern: 'empuje_vertical', sets: 3, compound: true, priority: 1 },
      { pattern: 'zancada', sets: 2, compound: true, priority: 2 },
      { muscle: 'pecho', sets: 2, compound: false, priority: 3 },
      { muscle: 'triceps', sets: 2, compound: false, priority: 4 },
      { pattern: 'gemelos', sets: 2, compound: false, priority: 5 },
    ],
  },
  fbC: {
    name: 'Full Body C', focus: 'Cuerpo completo (variantes y accesorios)',
    slots: [
      { pattern: 'sentadilla', sets: 3, compound: true, priority: 1 },
      { pattern: 'empuje_horizontal', sets: 3, compound: true, priority: 1 },
      { pattern: 'traccion_horizontal', sets: 3, compound: true, priority: 1 },
      { muscle: 'isquiotibiales', sets: 2, compound: false, priority: 2 },
      { muscle: 'hombro_posterior', sets: 2, compound: false, priority: 3 },
      { muscle: 'hombro_lateral', sets: 2, compound: false, priority: 4 },
      { pattern: 'core', sets: 2, compound: false, priority: 5 },
    ],
  },
  upper1: {
    name: 'Torso 1', focus: 'Pecho, espalda, hombros y brazos (énfasis fuerza)',
    slots: [
      { pattern: 'empuje_horizontal', sets: 3, compound: true, priority: 1 },
      { pattern: 'traccion_horizontal', sets: 3, compound: true, priority: 1 },
      { pattern: 'empuje_vertical', sets: 3, compound: true, priority: 2 },
      { pattern: 'traccion_vertical', sets: 3, compound: true, priority: 2 },
      { muscle: 'hombro_lateral', sets: 3, compound: false, priority: 3 },
      { muscle: 'biceps', sets: 2, compound: false, priority: 4 },
      { muscle: 'triceps', sets: 2, compound: false, priority: 4 },
    ],
  },
  lower1: {
    name: 'Pierna 1', focus: 'Cuádriceps, glúteos, isquiotibiales (énfasis sentadilla)',
    slots: [
      { pattern: 'sentadilla', sets: 3, compound: true, priority: 1 },
      { pattern: 'bisagra', sets: 3, compound: true, priority: 1 },
      { pattern: 'zancada', sets: 2, compound: true, priority: 2 },
      { muscle: 'isquiotibiales', sets: 2, compound: false, priority: 3 },
      { pattern: 'gemelos', sets: 3, compound: false, priority: 4 },
      { pattern: 'core', sets: 2, compound: false, priority: 5 },
    ],
  },
  upper2: {
    name: 'Torso 2', focus: 'Pecho, espalda, hombros y brazos (énfasis hipertrofia)',
    slots: [
      { pattern: 'traccion_vertical', sets: 3, compound: true, priority: 1 },
      { pattern: 'empuje_horizontal', sets: 3, compound: true, priority: 1 },
      { pattern: 'traccion_horizontal', sets: 3, compound: true, priority: 2 },
      { muscle: 'pecho', sets: 2, compound: false, priority: 3 },
      { muscle: 'hombro_posterior', sets: 2, compound: false, priority: 3 },
      { muscle: 'hombro_lateral', sets: 3, compound: false, priority: 3 },
      { muscle: 'triceps', sets: 2, compound: false, priority: 4 },
      { muscle: 'biceps', sets: 2, compound: false, priority: 4 },
    ],
  },
  lower2: {
    name: 'Pierna 2', focus: 'Cadena posterior y glúteos',
    slots: [
      { pattern: 'bisagra', sets: 3, compound: true, priority: 1 },
      { pattern: 'sentadilla', sets: 3, compound: true, priority: 1 },
      { muscle: 'gluteos', sets: 3, compound: true, priority: 2 },
      { muscle: 'cuadriceps', sets: 2, compound: false, priority: 3 },
      { pattern: 'gemelos', sets: 3, compound: false, priority: 4 },
      { pattern: 'core', sets: 2, compound: false, priority: 5 },
    ],
  },
  push: {
    name: 'Empuje (Push)', focus: 'Pecho, hombros y tríceps',
    slots: [
      { pattern: 'empuje_horizontal', sets: 3, compound: true, priority: 1 },
      { pattern: 'empuje_vertical', sets: 3, compound: true, priority: 1 },
      { muscle: 'pecho', sets: 3, compound: false, priority: 2 },
      { muscle: 'hombro_lateral', sets: 3, compound: false, priority: 3 },
      { muscle: 'triceps', sets: 3, compound: false, priority: 4 },
    ],
  },
  pull: {
    name: 'Tirón (Pull)', focus: 'Espalda, deltoides posterior y bíceps',
    slots: [
      { pattern: 'traccion_vertical', sets: 3, compound: true, priority: 1 },
      { pattern: 'traccion_horizontal', sets: 3, compound: true, priority: 1 },
      { muscle: 'hombro_posterior', sets: 3, compound: false, priority: 3 },
      { muscle: 'biceps', sets: 3, compound: false, priority: 3 },
      { pattern: 'core', sets: 2, compound: false, priority: 5 },
    ],
  },
  legs: {
    name: 'Pierna (Legs)', focus: 'Cuádriceps, glúteos, isquiotibiales y pantorrillas',
    slots: [
      { pattern: 'sentadilla', sets: 3, compound: true, priority: 1 },
      { pattern: 'bisagra', sets: 3, compound: true, priority: 1 },
      { pattern: 'zancada', sets: 2, compound: true, priority: 2 },
      { muscle: 'isquiotibiales', sets: 2, compound: false, priority: 3 },
      { muscle: 'cuadriceps', sets: 2, compound: false, priority: 3 },
      { pattern: 'gemelos', sets: 3, compound: false, priority: 4 },
    ],
  },
};

export function chooseSplit(days: number, exp: Experience, preferred?: Profile['preferredSplit']): { split: SplitKey; why: string } {
  if (preferred && preferred !== 'auto') {
    const map: Record<string, SplitKey> = { full_body: 'full_body', upper_lower: 'upper_lower', ppl: 'ppl' };
    return { split: map[preferred], why: 'División elegida manualmente en tu perfil.' };
  }
  if (days <= 3) return { split: 'full_body', why: `Con ${days} días, Full Body permite estimular cada músculo 2–3 veces por semana.` };
  if (days === 4) return { split: 'upper_lower', why: 'Con 4 días, Torso/Pierna da frecuencia 2× por músculo con buena recuperación.' };
  if (days === 5)
    return exp === 'principiante'
      ? { split: 'upper_lower', why: 'Con 5 días y experiencia inicial, Torso/Pierna con un día extra de torso; menos volumen por sesión.' }
      : { split: 'ul_ppl', why: 'Con 5 días, Torso/Pierna + Push/Pull/Legs mantiene frecuencia 2× por músculo.' };
  return exp === 'principiante'
    ? { split: 'upper_lower', why: 'Con 6 días y experiencia inicial se recomienda Torso/Pierna (no más de 4–5 sesiones intensas); los días restantes son de cardio o descanso.' }
    : { split: 'ppl', why: 'Con 6 días, Push/Pull/Legs dos veces por semana.' };
}

function dayKeysFor(split: SplitKey, days: number): string[] {
  switch (split) {
    case 'full_body':
      return ['fbA', 'fbB', 'fbC', 'fbA', 'fbB', 'fbC'].slice(0, Math.max(1, Math.min(days, 6)));
    case 'upper_lower':
      return ['upper1', 'lower1', 'upper2', 'lower2', 'upper1'].slice(0, Math.max(2, Math.min(days, 5)));
    case 'ul_ppl':
      return ['upper1', 'lower1', 'push', 'pull', 'legs'];
    case 'ppl':
      return ['push', 'pull', 'legs', 'push', 'pull', 'legs'].slice(0, Math.max(3, Math.min(days, 6)));
  }
}

/** Ordena los ejercicios candidatos: preferencias por nivel, por compuesto y por estabilidad (máquinas) si hay restricciones. */
function candidates(slot: Slot, p: { equipment: Equipment[]; injuries: string[]; excluded: string[]; experience: Experience; cautious: boolean }): { ex: Exercise; caution?: string }[] {
  const match = (e: Exercise) => (slot.pattern ? e.pattern === slot.pattern : e.primary === slot.muscle);
  const levelRank: Record<Experience, number> = { principiante: 0, intermedio: 1, avanzado: 2 };
  const ok = EXERCISES.filter((e) => match(e) && isAvailable(e, p.equipment, p.injuries, p.excluded) && levelRank[e.level] <= levelRank[p.experience] + (p.experience === 'principiante' ? 0 : 1));
  const score = (e: Exercise) => {
    let s = 0;
    if (slot.compound !== e.compound) s += 2;
    if (p.cautious && e.equipment.includes('maquinas')) s -= 1;
    if (e.equipment.includes('barra') && p.experience === 'principiante') s += 0.5;
    if (e.equipment.includes('bandas') || e.equipment.includes('peso_corporal')) s += 0.8; // preferir carga externa si existe
    s -= 0.6 * (stretchOf(e.id) - 1); // hipertrofia: preferir ejercicios que cargan el músculo estirado
    return s;
  };
  const list = ok.sort((a, b) => score(a) - score(b)).map((ex) => ({ ex }));
  if (list.length) return list;
  // Sin opciones seguras: alternativa con menos zonas comprometidas, marcada con precaución.
  const fallback = EXERCISES.filter((e) => match(e) && isAvailable(e, p.equipment, [], p.excluded)).sort(
    (a, b) => a.stress.filter((r) => p.injuries.includes(r)).length - b.stress.filter((r) => p.injuries.includes(r)).length,
  );
  return fallback.slice(0, 1).map((ex) => ({ ex, caution: 'Compromete una zona con lesión registrada: úsalo solo si tu médico/fisioterapeuta lo autoriza y sin dolor.' }));
}

export function weeklySetTarget(exp: Experience): number {
  return exp === 'principiante' ? 10 : exp === 'intermedio' ? 14 : 16;
}

const SET_SECONDS = { compound: 45, isolation: 35 };

export function generateRoutine(p: Pick<Profile, 'trainingDays' | 'sessionMinutes' | 'experience' | 'equipment' | 'injuries' | 'excludedExercises' | 'priorityMuscles' | 'preferredSplit' | 'conditions'>): Routine {
  const days = Math.max(2, Math.min(6, p.trainingDays.length || 3));
  const { split, why } = chooseSplit(days, p.experience, p.preferredSplit);
  const keys = dayKeysFor(split, days);
  const rationale = [why];
  const cautious = p.injuries.length > 0 || (p.conditions ?? []).some((c) => ['hernia', 'osteoporosis'].includes(c));
  if (cautious) rationale.push('Por tus lesiones o condiciones, se priorizan máquinas y ejercicios con soporte, y se excluyen los que comprometen las zonas afectadas.');
  const weekdays = [...p.trainingDays].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  const usedNames = new Map<string, number>();

  const routineDays: RoutineDay[] = keys.map((k, i) => {
    const tpl = DAY_TEMPLATES[k];
    const exs: (RoutineExercise & { priority: number; compound: boolean })[] = [];
    for (const slot of tpl.slots) {
      const cands = candidates(slot, { equipment: p.equipment, injuries: p.injuries, excluded: p.excludedExercises, experience: p.experience, cautious });
      if (!cands.length) continue;
      // Evita repetir el mismo ejercicio en la misma sesión; varía entre sesiones del mismo patrón.
      const seen = usedNames.get(`${k}-${slot.pattern ?? slot.muscle}`) ?? 0;
      const filtered = cands.filter((c) => !exs.some((x) => x.exerciseId === c.ex.id));
      if (!filtered.length) continue;
      const choice = filtered[(i + seen) % Math.min(filtered.length, 2)] ?? filtered[0];
      usedNames.set(`${k}-${slot.pattern ?? slot.muscle}`, seen + 1);
      const ex = choice.ex;
      let sets = slot.sets;
      if (p.priorityMuscles.includes(ex.primary)) sets += 1;
      if (p.experience === 'avanzado' && !ex.compound) sets += 1;
      const compound = ex.compound;
      exs.push({
        exerciseId: ex.id,
        name: ex.name,
        sets,
        repMin: compound ? (ex.pattern === 'sentadilla' || ex.pattern === 'bisagra' ? 6 : 6) : ex.pattern === 'core' ? 10 : 10,
        repMax: compound ? 10 : 15,
        rir: compound ? 2 : 1,
        restSec: compound ? (p.experience === 'principiante' ? 120 : 150) : 75,
        caution: choice.caution,
        priority: slot.priority ?? 3,
        compound,
      });
    }
    // Ajuste al tiempo disponible: se quitan series de los accesorios de menor prioridad.
    const est = () => exs.reduce((a, e) => a + e.sets * ((e.compound ? SET_SECONDS.compound : SET_SECONDS.isolation) + e.restSec), 0) / 60 + 8; // +8 min calentamiento
    let guard = 0;
    while (est() > p.sessionMinutes && guard++ < 40) {
      const cand = [...exs].sort((a, b) => b.priority - a.priority || a.sets - b.sets)[0];
      if (!cand) break;
      if (cand.sets > 2) cand.sets -= 1;
      else if (cand.priority >= 3) exs.splice(exs.indexOf(cand), 1);
      else break;
    }
    // Músculos prioritarios primero (más frescos = más estímulo); el resto conserva su orden.
    exs.sort((a, b) => Number(p.priorityMuscles.includes(EXERCISES.find((x) => x.id === b.exerciseId)!.primary)) - Number(p.priorityMuscles.includes(EXERCISES.find((x) => x.id === a.exerciseId)!.primary)));
    return {
      key: `${k}-${i}`,
      name: tpl.name,
      focus: tpl.focus,
      weekday: weekdays[i] ?? i + 1,
      exercises: exs.map(({ priority: _p, compound: _c, ...rest }) => rest),
      estMinutes: Math.round(est()),
    };
  });

  const weeklySets: Partial<Record<Muscle, number>> = {};
  for (const d of routineDays)
    for (const e of d.exercises) {
      const ex = EXERCISES.find((x) => x.id === e.exerciseId)!;
      weeklySets[ex.primary] = (weeklySets[ex.primary] ?? 0) + e.sets;
      for (const s of ex.secondary) weeklySets[s] = (weeklySets[s] ?? 0) + e.sets * 0.5;
    }
  const tgt = weeklySetTarget(p.experience);
  rationale.push(`Volumen orientativo: ~${tgt} series efectivas por músculo y semana (rango basado en evidencia: 10–20).`);
  rationale.push('Repeticiones: compuestos 6–10 a RIR 2; aislamientos 10–15 a RIR 1. En déficit se mantiene la intensidad para preservar fuerza y músculo.');
  rationale.push('Se prefieren ejercicios que cargan el músculo en estiramiento (más hipertrofia según la evidencia reciente).');
  if (p.priorityMuscles.length) rationale.push('Tus músculos prioritarios llevan una serie extra y van al inicio de la sesión.');
  return { split, splitLabel: SPLIT_LABEL[split], daysPerWeek: routineDays.length, rationale, days: routineDays, weeklySets, createdAt: new Date().toISOString() };
}
