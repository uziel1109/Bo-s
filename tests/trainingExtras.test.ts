import { describe, expect, it } from 'vitest';
import { adaptDay, LOCATIONS, substituteFor } from '../src/shared/training/travel';
import { mobilityFor, DRILLS } from '../src/shared/training/mobility';
import { generateRoutine } from '../src/shared/training/generator';
import { getExercise, isAvailable } from '../src/shared/training/exercises';
import { defaultProfile } from '../src/shared/profileDefaults';
import { ANIMS } from '../src/renderer/src/lib/exerciseRig';

const p = { ...defaultProfile(), trainingDays: [1, 2, 4, 5], experience: 'intermedio' as const, equipment: ['barra', 'mancuernas', 'maquinas', 'poleas', 'banco', 'barra_dominadas', 'rack'] as const };

describe('Entreno en otro lado', () => {
  const routine = generateRoutine({ ...p, equipment: [...p.equipment] });

  it('cada ejercicio queda disponible con el equipo elegido y conserva el músculo principal cuando se puede', () => {
    for (const [key, loc] of Object.entries(LOCATIONS)) {
      for (const day of routine.days) {
        const { day: d, changes } = adaptDay(day, loc.equipment);
        for (const e of d.exercises) expect(isAvailable(getExercise(e.exerciseId)!, loc.equipment, [], []), `${key}: ${e.exerciseId}`).toBe(true);
        // Sin repetidos dentro del día.
        expect(new Set(d.exercises.map((e) => e.exerciseId)).size).toBe(d.exercises.length);
        const kept = changes.filter((c) => c.to);
        const samePrimary = kept.filter((c) => c.to!.primary === getExercise(c.from.exerciseId)!.primary).length;
        if (kept.length && (key === 'hotel' || key === 'casa')) expect(samePrimary / kept.length, key).toBeGreaterThanOrEqual(0.6);
        // La mayoría de la sesión se conserva (con muy poco equipo algunos ejercicios se omiten y se avisa).
        expect(d.exercises.length / day.exercises.length, key).toBeGreaterThanOrEqual(key === 'hotel' || key === 'casa' ? 0.8 : 0.4);
        for (const c of changes.filter((x) => !x.to)) expect(c.reason).toMatch(/omite/);
      }
    }
  });

  it('sentadilla con barra → variante con mancuerna en casa; con equipo completo no cambia nada', () => {
    expect(substituteFor('sentadilla', LOCATIONS.casa.equipment)?.primary).toBe('cuadriceps');
    expect(substituteFor('sentadilla', LOCATIONS.casa.equipment)?.equipment.includes('barra')).toBe(false);
    const { changes } = adaptDay(routine.days[0], [...p.equipment]);
    expect(changes).toEqual([]);
  });

  it('con peso corporal sube el rango de repeticiones', () => {
    const { day } = adaptDay(routine.days[0], LOCATIONS.cuerpo.equipment);
    const changed = day.exercises.filter((e) => !routine.days[0].exercises.some((o) => o.exerciseId === e.exerciseId));
    for (const e of changed) if (getExercise(e.exerciseId)!.equipment.every((q) => q === 'peso_corporal')) expect(e.repMax).toBeGreaterThanOrEqual(20);
  });
});

describe('Movilidad guiada', () => {
  it('elige ejercicios según el día y dura 5–8 minutos', () => {
    const legs = mobilityFor(['sentadilla', 'bisagra', 'zancada', 'gemelos']);
    expect(legs.focus).toBe('Tren inferior');
    expect(legs.drills.some((d) => d.id === 'rodilla_pared')).toBe(true);
    expect(legs.drills.some((d) => d.id === 'dislocaciones')).toBe(false);
    expect(legs.seconds).toBeGreaterThanOrEqual(240);
    expect(legs.seconds).toBeLessThanOrEqual(480);
    const upper = mobilityFor(['empuje_horizontal', 'empuje_vertical', 'traccion_vertical']);
    expect(upper.focus).toBe('Tren superior');
    expect(upper.drills.every((d) => d.regions.includes('hombro'))).toBe(true);
    const full = mobilityFor(['sentadilla', 'empuje_horizontal', 'traccion_horizontal', 'bisagra']);
    expect(full.focus).toBe('Cuerpo completo');
    expect(full.drills.some((d) => d.regions.includes('hombro')) && full.drills.some((d) => d.regions.includes('tobillo') || d.regions.includes('cadera'))).toBe(true);
    // Los ejercicios en el piso van al final.
    const ids = full.drills.map((d) => d.id);
    const firstFloor = ids.findIndex((x) => ['puente', 'bicho_muerto', 'flexor_cadera'].includes(x));
    if (firstFloor >= 0) expect(ids.slice(firstFloor).every((x) => ['puente', 'bicho_muerto', 'flexor_cadera'].includes(x))).toBe(true);
  });

  it('todos los ejercicios de movilidad tienen animación', () => {
    for (const d of DRILLS) expect(ANIMS[d.anim], d.id).toBeTruthy();
  });
});
