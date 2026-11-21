import { describe, expect, it } from 'vitest';
import { decideMuscle, directSets, effectiveSetCount, mesoRoutine, mesoVolume, mesoWeek, muscleProgress, rirBias, rirForWeek, techniqueFor, circumferenceTrend, type Mesocycle, type MuscleFeedback } from '../src/shared/training/hypertrophy';
import { generateRoutine } from '../src/shared/training/generator';
import { getExercise, stretchOf, EXERCISES, STRETCH } from '../src/shared/training/exercises';
import { defaultProfile } from '../src/shared/profileDefaults';
import { addDays } from '../src/shared/utils';
import type { Muscle, WorkoutSession } from '../src/shared/types';

const MON = '2026-11-02';
const meso: Mesocycle = { id: 'm', start: MON, weeks: 4, techniques: true, createdAt: MON };
const profile = { ...defaultProfile(), trainingDays: [1, 2, 4, 5], experience: 'intermedio' as const, equipment: ['barra', 'mancuernas', 'maquinas', 'poleas', 'banco', 'barra_dominadas', 'rack'] as never };
const routine = generateRoutine(profile);
const fb = (date: string, muscle: Muscle, pump: 0 | 1 | 2, soreness: 0 | 1 | 2 | 3, joint: 0 | 1 = 0): MuscleFeedback => ({ id: `${date}_${muscle}`, date, session_id: date, muscle, pump, soreness, joint });

describe('Mesociclo', () => {
  it('semanas, descarga y RIR progresivo (compuestos nunca a 0)', () => {
    expect(mesoWeek(meso, MON)).toEqual({ week: 1, deload: false, finished: false });
    expect(mesoWeek(meso, addDays(MON, 27)).week).toBe(4);
    expect(mesoWeek(meso, addDays(MON, 28)).deload).toBe(true);
    expect(mesoWeek(meso, addDays(MON, 35)).finished).toBe(true);
    expect([1, 2, 3, 4].map((w) => rirForWeek(w, 4, false))).toEqual([3, 2, 1, 0]);
    expect([1, 2, 3, 4].map((w) => rirForWeek(w, 4, true))).toEqual([3, 2, 1, 1]);
    expect(rirForWeek(5, 4, false)).toBe(3);
  });

  it('decisiones por músculo según bombeo, dolor, articulaciones y rendimiento', () => {
    expect(decideMuscle('pecho', [fb(MON, 'pecho', 0, 0)], null).delta).toBe(2);
    expect(decideMuscle('pecho', [fb(MON, 'pecho', 1, 1)], 0.01).delta).toBe(1);
    expect(decideMuscle('pecho', [fb(MON, 'pecho', 2, 2)], 0).delta).toBe(0);
    expect(decideMuscle('pecho', [fb(MON, 'pecho', 2, 3)], 0).delta).toBe(-1);
    expect(decideMuscle('pecho', [fb(MON, 'pecho', 1, 0, 1)], 0.05).delta).toBe(-1);
    expect(decideMuscle('pecho', [fb(MON, 'pecho', 1, 2)], -0.05).delta).toBe(-1);
    expect(decideMuscle('pecho', [fb(MON, 'pecho', 1, 1)], -0.05).delta).toBe(0);
    expect(decideMuscle('pecho', [], 0).delta).toBe(0);
  });

  it('el volumen se acumula semana a semana con tope en déficit y se reparte en la rutina', () => {
    const feedback = [fb(addDays(MON, 1), 'pecho', 0, 0), fb(addDays(MON, 8), 'pecho', 0, 0), fb(addDays(MON, 15), 'pecho', 0, 0), fb(addDays(MON, 1), 'biceps', 1, 3)];
    const base = directSets(routine);
    const vol = mesoVolume(routine, meso, feedback, [], addDays(MON, 21), true);
    expect(vol.delta.pecho).toBe(Math.min(6, 20 - (base.pecho ?? 0)));
    expect(vol.target.pecho).toBeLessThanOrEqual(20);
    expect(vol.delta.biceps).toBe(-1);
    expect(vol.log.filter((l) => l.muscle === 'pecho').map((l) => l.week)).toEqual([1, 2, 3]);
    const r = mesoRoutine(routine, meso, vol, addDays(MON, 21));
    expect(directSets(r).pecho).toBe(vol.target.pecho);
    expect(directSets(r).biceps).toBe(vol.target.biceps);
    // RIR de la semana 4 en aislamientos
    const iso = r.days.flatMap((d) => d.exercises).find((e) => !getExercise(e.exerciseId)!.compound)!;
    expect(iso.rir).toBe(0);
    // Descarga: mitad de series y RIR 3
    const dl = mesoRoutine(routine, meso, vol, addDays(MON, 29));
    const total = (x: typeof routine) => x.days.reduce((a, d) => a + d.exercises.reduce((b, e) => b + e.sets, 0), 0);
    expect(total(dl)).toBeLessThan(total(routine) * 0.65);
    expect(dl.days.every((d) => d.exercises.every((e) => e.rir === 3))).toBe(true);
  });

  it('sin retroalimentación el volumen no cambia', () => {
    const vol = mesoVolume(routine, meso, [], [], addDays(MON, 21), true);
    expect(Object.values(vol.delta).every((d) => !d)).toBe(true);
  });
});

describe('Ejercicios y técnicas para hipertrofia', () => {
  it('todos los ejercicios tienen etiqueta de estiramiento y el generador prefiere los de mayor estiramiento', () => {
    for (const e of EXERCISES) expect(STRETCH[e.id], e.id).toBeDefined();
    const all = routine.days.flatMap((d) => d.exercises.map((e) => stretchOf(e.exerciseId)));
    expect(all.filter((s) => s === 2).length).toBeGreaterThan(all.filter((s) => s === 0).length);
  });

  it('los músculos prioritarios van primero', () => {
    const r = generateRoutine({ ...profile, priorityMuscles: ['hombro_lateral'] });
    const day = r.days.find((d) => d.exercises.some((e) => getExercise(e.exerciseId)!.primary === 'hombro_lateral'))!;
    expect(getExercise(day.exercises[0].exerciseId)!.primary).toBe('hombro_lateral');
  });

  it('técnicas solo en aislamientos; las series con técnica cuentan doble', () => {
    expect(techniqueFor(getExercise('sentadilla'))).toBeNull();
    expect(techniqueFor(getExercise('triceps_frances'))).toBe('parciales');
    expect(techniqueFor(getExercise('pec_deck'))).toBe('drop');
    expect(techniqueFor(getExercise('elevaciones_laterales'))).toBe('myo');
    expect(techniqueFor(getExercise('plancha'))).toBeNull();
    expect(effectiveSetCount([{ weight: 10, reps: 12, done: true }, { weight: 10, reps: 10, done: true, technique: 'myo', extraReps: 9 }, { weight: 10, reps: 0, done: false }])).toBe(3);
  });
});

describe('Progreso por músculo y calibración de RIR', () => {
  const s = (date: string, id: string, w: number): WorkoutSession => ({ id: date + id, date, completed: 1, exercises: [{ exerciseId: id, name: id, targetSets: 1, repMin: 8, repMax: 12, targetRir: 2, sets: [{ weight: w, reps: 10, rir: 2, done: true }] }] });
  const today = '2026-11-30';
  const sessions = [0, 7, 14, 21, 28].flatMap((d, i) => [s(addDays('2026-10-26', d), 'press_mancuernas', 30 + i * 2), s(addDays('2026-10-26', d), 'curl_barra', 30)]);

  it('detecta músculos que progresan y estancados con sugerencia de ejercicio con más estiramiento', () => {
    const p = muscleProgress(sessions, today);
    const chest = p.find((x) => x.muscle === 'pecho')!;
    const bi = p.find((x) => x.muscle === 'biceps')!;
    expect(chest.strengthPct!).toBeGreaterThan(5);
    expect(chest.stalled).toBe(false);
    expect(bi.stalled).toBe(true);
    expect(bi.suggestion).toBeTruthy();
    expect(p[0].muscle).toBe('biceps');
  });

  it('perímetros de las últimas 8 semanas', () => {
    const t = circumferenceTrend([{ id: 'a', date: '2026-10-10', arm: 35 }, { id: 'b', date: '2026-11-28', arm: 35.6 }], today);
    expect(t).toEqual([{ key: 'arm', label: 'Brazo', first: 35, last: 35.6, diff: 0.6 }]);
  });

  it('sesgo de RIR', () => {
    expect(rirBias([])).toBeNull();
    const b = rirBias([{ date: today, exerciseId: 'curl_polea', weight: 20, repsAtGuess: 10, guessedRir: 2, totalReps: 15 }])!;
    expect(b.bias).toBe(3);
    expect(b.message).toMatch(/lejos del fallo/);
    expect(rirBias([{ date: today, exerciseId: 'curl_polea', weight: 20, repsAtGuess: 10, guessedRir: 2, totalReps: 12 }])!.message).toMatch(/preciso/);
  });
});
