// "Hoy entreno en otro lado": adapta la sesión del día al equipo disponible (hotel, casa, parque…),
// cambiando cada ejercicio que no se pueda hacer por el equivalente más parecido para los mismos músculos.
import type { BodyRegion, Equipment } from '../types';
import { EXERCISES, getExercise, isAvailable, type Exercise } from './exercises';
import type { RoutineDay, RoutineExercise } from './generator';

export type LocationKey = 'gimnasio' | 'hotel' | 'casa' | 'cuerpo' | 'parque' | 'personalizado';

export const LOCATIONS: Record<Exclude<LocationKey, 'gimnasio' | 'personalizado'>, { label: string; equipment: Equipment[] }> = {
  hotel: { label: 'Gimnasio de hotel', equipment: ['mancuernas', 'banco', 'maquinas', 'poleas', 'peso_corporal', 'bandas'] },
  casa: { label: 'Casa con mancuernas', equipment: ['mancuernas', 'bandas', 'peso_corporal'] },
  cuerpo: { label: 'Peso corporal y bandas', equipment: ['peso_corporal', 'bandas'] },
  parque: { label: 'Parque (barras y bandas)', equipment: ['peso_corporal', 'barra_dominadas', 'bandas'] },
};

export interface Substitution {
  from: RoutineExercise;
  to: Exercise | null; // null = no hay equivalente; se omite
  reason: string;
}

/** Mejor sustituto disponible para un ejercicio con el equipo indicado. */
export function substituteFor(id: string, equipment: Equipment[], injuries: BodyRegion[] = [], excluded: string[] = [], taken: Set<string> = new Set()): Exercise | null {
  const ex = getExercise(id);
  if (!ex) return null;
  if (isAvailable(ex, equipment, injuries, excluded)) return ex;
  const candidates = EXERCISES.filter((c) => c.id !== ex.id && !taken.has(c.id) && isAvailable(c, equipment, injuries, excluded))
    .map((c) => {
      let s = 0;
      if (ex.alternatives.includes(c.id)) s += 2;
      if (c.primary === ex.primary) s += 6;
      else if (c.secondary.includes(ex.primary)) s += 1.5;
      if (c.pattern === ex.pattern) s += 3;
      if (c.compound === ex.compound) s += 1;
      s += c.secondary.filter((m) => ex.secondary.includes(m)).length * 0.3;
      return { c, s };
    })
    .filter((x) => x.s >= 5)
    .sort((a, b) => b.s - a.s);
  return candidates[0]?.c ?? null;
}

/** Adapta el día de la rutina al equipo disponible. */
export function adaptDay(day: RoutineDay, equipment: Equipment[], injuries: BodyRegion[] = [], excluded: string[] = []): { day: RoutineDay; changes: Substitution[] } {
  // Los ejercicios que se conservan se reservan desde el inicio para que ningún sustituto los repita.
  const taken = new Set<string>(day.exercises.filter((e) => { const ex = getExercise(e.exerciseId); return ex && isAvailable(ex, equipment, injuries, excluded); }).map((e) => e.exerciseId));
  const changes: Substitution[] = [];
  const exercises: RoutineExercise[] = [];
  for (const e of day.exercises) {
    const to = substituteFor(e.exerciseId, equipment, injuries, excluded, taken);
    if (to && to.id === e.exerciseId) {
      taken.add(to.id);
      exercises.push(e);
      continue;
    }
    if (!to) {
      changes.push({ from: e, to: null, reason: 'Sin equivalente con ese equipo: se omite hoy.' });
      continue;
    }
    taken.add(to.id);
    const bodyweight = to.equipment.every((q) => q === 'peso_corporal' || q === 'bandas' || q === 'barra_dominadas');
    const rep = bodyweight ? { repMin: Math.max(e.repMin, 10), repMax: Math.max(e.repMax, 20) } : { repMin: e.repMin, repMax: e.repMax };
    exercises.push({ ...e, exerciseId: to.id, name: to.name, ...rep, caution: bodyweight ? 'Con peso corporal o banda: llega cerca del fallo (RIR 1–2); si es fácil, baja más lento (3 s) o haz pausa abajo.' : e.caution });
    changes.push({ from: e, to, reason: to.primary === getExercise(e.exerciseId)?.primary ? 'Mismo músculo principal' : 'Músculos parecidos' });
  }
  return { day: { ...day, exercises, name: `${day.name} (adaptado)` }, changes };
}
