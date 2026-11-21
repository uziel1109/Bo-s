// Movilidad guiada antes de entrenar: 5–8 minutos elegidos según los ejercicios del día.
// Se priorizan ejercicios dinámicos (no estiramientos estáticos largos), que preparan sin reducir la fuerza
// (Behm 2016: el estiramiento estático > 60 s por músculo puede bajar el rendimiento; el dinámico no).
import type { BodyRegion } from '../types';
import type { Pattern } from './exercises';

export interface MobilityDrill {
  id: string;
  name: string;
  anim: string; // clave de animación
  seconds: number; // duración del bloque
  dose: string; // "10 por lado", "30 s"…
  cue: string;
  regions: BodyRegion[];
  patterns: Pattern[];
}

export const DRILLS: MobilityDrill[] = [
  { id: 'balanceo_piernas', name: 'Balanceos de pierna', anim: 'mob_leg_swing', seconds: 60, dose: '10 por pierna', cue: 'Apóyate en la pared; balancea la pierna adelante y atrás, cada vez un poco más alto, sin arquear la espalda.', regions: ['cadera'], patterns: ['sentadilla', 'zancada', 'bisagra'] },
  { id: 'rodilla_pared', name: 'Movilidad de tobillo (rodilla a la pared)', anim: 'mob_ankle', seconds: 60, dose: '10 por lado', cue: 'Pie a un palmo de la pared; lleva la rodilla hacia la pared sin despegar el talón.', regions: ['tobillo', 'rodilla'], patterns: ['sentadilla', 'zancada', 'gemelos'] },
  { id: 'sentadilla_profunda', name: 'Sentadilla profunda con pausa', anim: 'mob_deep_squat', seconds: 60, dose: '6 lentas, 3 s abajo', cue: 'Baja lo más que puedas con la espalda neutra; empuja las rodillas hacia afuera con los codos.', regions: ['cadera', 'tobillo', 'rodilla'], patterns: ['sentadilla', 'zancada'] },
  { id: 'flexor_cadera', name: 'Estocada para flexor de cadera', anim: 'mob_hip_flexor', seconds: 60, dose: '5 × 5 s por lado', cue: 'Rodilla trasera en el piso, aprieta el glúteo de atrás y lleva la cadera adelante sin arquear.', regions: ['cadera', 'lumbar'], patterns: ['sentadilla', 'zancada', 'bisagra'] },
  { id: 'bisagra_sin_peso', name: 'Bisagra de cadera sin peso', anim: 'mob_hinge', seconds: 45, dose: '10 repeticiones', cue: 'Manos en la cadera; lleva la cadera atrás con rodillas ligeramente flexionadas hasta sentir los isquiotibiales.', regions: ['lumbar', 'cadera'], patterns: ['bisagra'] },
  { id: 'puente', name: 'Puente de glúteo', anim: 'glute_bridge', seconds: 45, dose: '12 con 2 s arriba', cue: 'Empuja con los talones y aprieta glúteos arriba sin arquear la zona lumbar.', regions: ['cadera', 'lumbar'], patterns: ['bisagra', 'sentadilla'] },
  { id: 'dislocaciones', name: 'Pases de hombro con palo o banda', anim: 'mob_shoulder_pass', seconds: 60, dose: '10 lentos', cue: 'Agarre ancho; pasa el palo de enfrente hacia atrás con los brazos estirados. Abre más el agarre si duele.', regions: ['hombro'], patterns: ['empuje_vertical', 'empuje_horizontal', 'traccion_vertical'] },
  { id: 'deslizamientos', name: 'Deslizamientos en pared (W a Y)', anim: 'mob_wall_slide', seconds: 45, dose: '10 repeticiones', cue: 'Espalda y brazos pegados a la pared; sube de W a Y sin despegar los codos.', regions: ['hombro'], patterns: ['empuje_vertical', 'traccion_vertical', 'empuje_horizontal'] },
  { id: 'aperturas_banda', name: 'Aperturas con banda', anim: 'fly', seconds: 45, dose: '15 repeticiones', cue: 'Brazos al frente a la altura del pecho; separa la banda juntando omóplatos.', regions: ['hombro'], patterns: ['empuje_horizontal', 'traccion_horizontal', 'empuje_vertical'] },
  { id: 'bicho_muerto', name: 'Bicho muerto (activación de core)', anim: 'dead_bug', seconds: 45, dose: '8 por lado', cue: 'Espalda baja pegada al piso; extiende brazo y pierna contrarios lentamente.', regions: ['lumbar'], patterns: ['bisagra', 'sentadilla', 'core'] },
];

export interface MobilityRoutine {
  drills: MobilityDrill[];
  seconds: number;
  focus: string;
}

/**
 * Elige 4–7 ejercicios según los patrones del día (los que aparecen en más ejercicios primero) y las
 * zonas con lesión registrada. Tiempo objetivo: 5–8 minutos.
 */
export function mobilityFor(patterns: Pattern[], injuries: BodyRegion[] = [], maxSeconds = 480): MobilityRoutine {
  const count = new Map<Pattern, number>();
  for (const p of patterns) count.set(p, (count.get(p) ?? 0) + 1);
  const lower = ['sentadilla', 'zancada', 'bisagra', 'gemelos'].some((p) => count.has(p as Pattern));
  const upper = ['empuje_horizontal', 'empuje_vertical', 'traccion_horizontal', 'traccion_vertical'].some((p) => count.has(p as Pattern));
  const scored = DRILLS.map((d, i) => {
    let s = d.patterns.reduce((a, p) => a + (count.get(p) ?? 0), 0);
    s += d.regions.filter((r) => injuries.includes(r)).length * 1.5;
    return { d, s, i };
  })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.i - b.i);
  const out: MobilityDrill[] = [];
  let total = 0;
  // Si el día combina tren superior e inferior, alterna para cubrir ambos.
  const queue = upper && lower ? interleave(scored.filter((x) => isLower(x.d)).map((x) => x.d), scored.filter((x) => !isLower(x.d)).map((x) => x.d)) : scored.map((x) => x.d);
  for (const d of queue) {
    if (out.length >= 7 || total + d.seconds > maxSeconds) continue;
    out.push(d);
    total += d.seconds;
  }
  if (!out.length) {
    const fallback = DRILLS.filter((d) => ['balanceo_piernas', 'dislocaciones', 'bicho_muerto', 'sentadilla_profunda'].includes(d.id));
    return { drills: fallback, seconds: fallback.reduce((a, d) => a + d.seconds, 0), focus: 'General' };
  }
  // Mínimo 5 minutos: se completa con ejercicios generales (core y cadera calientan para cualquier sesión).
  for (const id of ['bicho_muerto', 'balanceo_piernas', 'sentadilla_profunda', 'puente']) {
    if (total >= 300) break;
    const d = DRILLS.find((x) => x.id === id)!;
    if (out.includes(d) || total + d.seconds > maxSeconds) continue;
    out.push(d);
    total += d.seconds;
  }
  // Orden práctico: de pie primero, en el piso al final.
  const floor = new Set(['puente', 'bicho_muerto', 'flexor_cadera']);
  out.sort((a, b) => Number(floor.has(a.id)) - Number(floor.has(b.id)));
  return { drills: out, seconds: total, focus: upper && lower ? 'Cuerpo completo' : lower ? 'Tren inferior' : 'Tren superior' };
}

function isLower(d: MobilityDrill): boolean {
  return d.patterns.some((p) => ['sentadilla', 'zancada', 'bisagra', 'gemelos'].includes(p));
}

function interleave<T>(a: T[], b: T[]): T[] {
  const out: T[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i]) out.push(a[i]);
    if (b[i]) out.push(b[i]);
  }
  return out;
}
