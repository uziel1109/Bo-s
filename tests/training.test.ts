import { describe, expect, it } from 'vitest';
import { generateRoutine, chooseSplit } from '../src/shared/training/generator';
import { EXERCISES, getExercise } from '../src/shared/training/exercises';
import { e1rm, progressionAdvice, muscleWeekStats, deloadAdvice, isEffective } from '../src/shared/training/progression';
import { defaultProfile } from '../src/shared/profileDefaults';
import type { ExerciseLog, WorkoutSession } from '../src/shared/types';

const base = defaultProfile();

describe('Biblioteca de ejercicios', () => {
  it('todas las alternativas existen y cada ejercicio tiene contenido completo', () => {
    for (const e of EXERCISES) {
      for (const a of e.alternatives) expect(getExercise(a), `${e.id} → ${a}`).toBeDefined();
      expect(e.instructions.length).toBeGreaterThan(0);
      expect(e.technique.length).toBeGreaterThan(0);
      expect(e.mistakes.length).toBeGreaterThan(0);
    }
  });
});

describe('Generador de rutinas', () => {
  it('elige la división según días', () => {
    expect(chooseSplit(3, 'principiante').split).toBe('full_body');
    expect(chooseSplit(4, 'intermedio').split).toBe('upper_lower');
    expect(chooseSplit(5, 'intermedio').split).toBe('ul_ppl');
    expect(chooseSplit(6, 'avanzado').split).toBe('ppl');
    expect(chooseSplit(6, 'principiante').split).toBe('upper_lower');
  });

  it('genera días en los días de la semana elegidos y respeta el tiempo', () => {
    const r = generateRoutine({ ...base, trainingDays: [1, 3, 5], sessionMinutes: 60 });
    expect(r.days.map((d) => d.weekday)).toEqual([1, 3, 5]);
    for (const d of r.days) {
      expect(d.exercises.length).toBeGreaterThanOrEqual(4);
      expect(d.estMinutes).toBeLessThanOrEqual(62);
    }
  });

  it('solo usa equipo disponible (casa con mancuernas y bandas)', () => {
    const r = generateRoutine({ ...base, equipment: ['mancuernas', 'bandas', 'banco'], trainingDays: [1, 2, 4, 5] });
    for (const d of r.days)
      for (const e of d.exercises) {
        const ex = getExercise(e.exerciseId)!;
        for (const eq of ex.equipment) expect(['mancuernas', 'bandas', 'banco', 'peso_corporal']).toContain(eq);
      }
  });

  it('evita ejercicios que comprometen zonas lesionadas', () => {
    const r = generateRoutine({ ...base, injuries: ['lumbar'], trainingDays: [1, 2, 4, 5] });
    for (const d of r.days)
      for (const e of d.exercises) {
        const ex = getExercise(e.exerciseId)!;
        if (!e.caution) expect(ex.stress).not.toContain('lumbar');
      }
    expect(r.rationale.join(' ')).toMatch(/lesiones/);
  });

  it('más series para músculos prioritarios', () => {
    const a = generateRoutine({ ...base, trainingDays: [1, 2, 4, 5], sessionMinutes: 120 });
    const b = generateRoutine({ ...base, trainingDays: [1, 2, 4, 5], sessionMinutes: 120, priorityMuscles: ['hombro_lateral'] });
    expect(b.weeklySets.hombro_lateral!).toBeGreaterThan(a.weeklySets.hombro_lateral!);
  });
});

const log = (weight: number, reps: number[], rir = 2, extra: Partial<ExerciseLog> = {}): ExerciseLog => ({
  exerciseId: 'press_banca',
  name: 'Press',
  targetSets: reps.length,
  repMin: 6,
  repMax: 10,
  targetRir: 2,
  sets: reps.map((r) => ({ weight, reps: r, rir, done: true })),
  ...extra,
});

describe('Sobrecarga progresiva', () => {
  it('e1RM (Epley con RIR)', () => {
    expect(e1rm(100, 5, 0)).toBeCloseTo(116.67, 1);
    expect(e1rm(100, 5, 2)).toBeCloseTo(123.33, 1);
    expect(e1rm(100, 1, 0)).toBe(100);
  });

  it('sube el peso solo cuando se completa el rango en todas las series', () => {
    const adv = progressionAdvice([log(80, [10, 10, 10])])!;
    expect(adv.action).toBe('subir_peso');
    expect(adv.suggestedWeight).toBe(82.5);
    expect(progressionAdvice([log(80, [10, 10, 9])])!.action).toBe('subir_reps');
  });

  it('no sube si el esfuerzo fue máximo (RIR 0 con objetivo 2)', () => {
    expect(progressionAdvice([log(80, [10, 10, 10], 0)])!.action).toBe('subir_reps');
  });

  it('mantiene tras una mala sesión y reduce tras dos', () => {
    expect(progressionAdvice([log(80, [8, 8, 8]), log(80, [5, 5, 6])])!.action).toBe('mantener');
    const two = progressionAdvice([log(80, [5, 5, 6]), log(80, [5, 4, 5])])!;
    expect(two.action).toBe('reducir_carga');
    expect(two.suggestedWeight!).toBeLessThan(80);
  });

  it('no progresa con dolor', () => {
    expect(progressionAdvice([log(80, [10, 10, 10], 2, { pain: 'hombro' })])!.action).toBe('revisar_dolor');
  });

  it('series efectivas', () => {
    expect(isEffective({ weight: 50, reps: 8, rir: 2, done: true })).toBe(true);
    expect(isEffective({ weight: 50, reps: 8, rir: 6, done: true })).toBe(false);
    expect(isEffective({ weight: 50, reps: 8, rpe: 8, done: true })).toBe(true);
    expect(isEffective({ weight: 50, reps: 8, done: false })).toBe(false);
  });
});

describe('Estadísticas musculares y descarga', () => {
  const session = (date: string, weight: number, completed = 1, rpe = 7): WorkoutSession => ({
    id: date,
    date,
    exercises: [log(weight, [8, 8, 8])],
    completed,
    session_rpe: rpe,
  });

  it('cuenta series primarias y secundarias', () => {
    const st = muscleWeekStats([session('2026-11-09', 80), session('2026-11-12', 80)], '2026-11-12', '2026-11-12');
    expect(st.pecho.sets).toBe(6);
    expect(st.triceps.sets).toBe(3);
    expect(st.pecho.frequency).toBe(2);
    expect(st.pecho.recoveryPct).toBe(0);
  });

  it('recomienda descarga con estancamiento + fatiga', () => {
    const sessions = ['2026-10-01', '2026-10-05', '2026-10-08'].map((d) => ({
      ...session(d, 80, 1, 9),
      exercises: ['press_banca', 'sentadilla', 'remo_barra'].map((id) => ({ ...log(80, [6, 6, 6]), exerciseId: id })),
    }));
    const rec = [{ date: '2026-10-07', energy: 2, soreness: 4, sleep_quality: 2 }];
    const d = deloadAdvice(sessions, rec, '2026-10-09');
    expect(d.recommended).toBe(true);
    const noFatigue = deloadAdvice(sessions.map((s) => ({ ...s, session_rpe: 7 })), [], '2026-10-09');
    expect(noFatigue.recommended).toBe(false);
  });
});
