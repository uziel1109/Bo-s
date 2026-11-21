import { describe, expect, it } from 'vitest';
import { ANIMS, EXERCISE_ANIM, solve } from '../src/renderer/src/lib/exerciseRig';
import { EXERCISES } from '../src/shared/training/exercises';

describe('Animaciones de ejercicios', () => {
  it('cada ejercicio de la biblioteca tiene una animación válida', () => {
    for (const e of EXERCISES) {
      const k = EXERCISE_ANIM[e.id];
      expect(k, e.id).toBeDefined();
      expect(ANIMS[k], `${e.id} → ${k}`).toBeDefined();
    }
  });
  it('todas las posturas producen coordenadas finitas y segmentos de longitud constante', () => {
    for (const [k, a] of Object.entries(ANIMS)) {
      if (a.front) continue;
      for (const pose of [a.a, a.b]) {
        const j = solve(a.anchor, pose);
        for (const pt of Object.values(j)) if (pt) expect(Number.isFinite(pt.x) && Number.isFinite(pt.y), k).toBe(true);
        expect(Math.hypot(j.shoulder.x - j.hip.x, j.shoulder.y - j.hip.y)).toBeCloseTo(50, 5);
        expect(Math.hypot(j.knee.x - j.hip.x, j.knee.y - j.hip.y)).toBeCloseTo(42, 5);
      }
    }
  });
  it('en sentadilla el pie queda fijo y la cadera baja', () => {
    const a = ANIMS.squat_bar;
    const s0 = solve(a.anchor, a.a);
    const s1 = solve(a.anchor, a.b);
    expect(s1.ankle).toEqual(s0.ankle);
    expect(s1.hip.y).toBeLessThan(s0.hip.y - 30);
  });
});
