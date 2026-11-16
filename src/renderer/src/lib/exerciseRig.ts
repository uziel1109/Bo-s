// Esqueleto articulado y biblioteca de patrones de movimiento para las animaciones de ejercicios.
// Pose = ángulos de cada segmento (grados, 0 = derecha, 90 = arriba) + punto de anclaje.
export type Anchor = 'ankle' | 'hip' | 'wrist' | 'shoulder' | 'toe';
export type Equip = 'barbell' | 'dumbbell' | 'none' | 'cable_high' | 'cable_low' | 'cable_front' | 'kettle';
export type Prop = 'bench_flat' | 'bench_incline' | 'seat' | 'bar_top' | 'parallel_bars' | 'platform' | 'pad_front' | 'floor';

/** Pose en ángulos (grados, 0 = derecha, 90 = arriba) de cada segmento y posición del punto de anclaje. */
export interface Pose {
  trunk: number; // cadera → hombro
  thigh: number; // cadera → rodilla
  shin: number; // rodilla → tobillo
  upperArm: number; // hombro → codo
  forearm: number; // codo → muñeca
  foot?: number; // tobillo → punta del pie
  thigh2?: number; // pierna trasera (zancadas)
  shin2?: number;
  ax?: number; // desplazamiento del ancla
  ay?: number;
}

export interface Anim {
  anchor: Anchor;
  a: Pose;
  b: Pose;
  equip: Equip;
  props?: Prop[];
  front?: 'lateral' | 'fly'; // vista frontal
  period?: number; // segundos
  hold?: boolean; // ejercicio isométrico (movimiento mínimo)
}

export const L = { trunk: 50, neck: 8, head: 9, upperArm: 28, forearm: 26, thigh: 42, shin: 40, foot: 13 };
export const rad = (d: number) => (d * Math.PI) / 180;
export const v = (ang: number, len: number) => ({ x: Math.cos(rad(ang)) * len, y: Math.sin(rad(ang)) * len });

export const STAND: Pose = { trunk: 90, thigh: -90, shin: -90, upperArm: -90, forearm: -90, foot: 0 };

/** Biblioteca de patrones (vista lateral, mirando a la derecha). */
export const ANIMS: Record<string, Anim> = {
  squat_bar: { anchor: 'ankle', equip: 'barbell', props: ['floor'], a: { ...STAND, upperArm: -140, forearm: 70 }, b: { ...STAND, trunk: 58, thigh: -12, shin: -122, upperArm: -165, forearm: 40 } },
  squat_goblet: { anchor: 'ankle', equip: 'dumbbell', props: ['floor'], a: { ...STAND, upperArm: -75, forearm: 110 }, b: { ...STAND, trunk: 72, thigh: -8, shin: -120, upperArm: -60, forearm: 125 } },
  leg_press: { anchor: 'hip', equip: 'none', props: ['seat', 'platform'], a: { trunk: 140, thigh: 25, shin: 28, upperArm: -60, forearm: -10 }, b: { trunk: 140, thigh: 72, shin: -30, upperArm: -60, forearm: -10 } },
  hack: { anchor: 'ankle', equip: 'none', props: ['floor'], a: { ...STAND, trunk: 98, upperArm: -70, forearm: 100 }, b: { ...STAND, trunk: 98, thigh: -5, shin: -125, upperArm: -70, forearm: 100 } },
  leg_ext: { anchor: 'hip', equip: 'none', props: ['seat'], a: { trunk: 95, thigh: 0, shin: -90, upperArm: -95, forearm: -30 }, b: { trunk: 95, thigh: 3, shin: -8, upperArm: -95, forearm: -30 } },
  lunge: { anchor: 'ankle', equip: 'dumbbell', props: ['floor'], a: { ...STAND, thigh: -95, shin: -88, thigh2: -112, shin2: -105 }, b: { ...STAND, thigh: -12, shin: -100, thigh2: -95, shin2: -175 } },
  bulgarian: { anchor: 'ankle', equip: 'dumbbell', props: ['floor', 'bench_flat'], a: { ...STAND, trunk: 88, thigh: -100, shin: -85, thigh2: -125, shin2: -160 }, b: { ...STAND, trunk: 80, thigh: -15, shin: -105, thigh2: -100, shin2: -170 } },
  hinge_bar: { anchor: 'ankle', equip: 'barbell', props: ['floor'], a: { ...STAND }, b: { ...STAND, trunk: 12, thigh: -78, shin: -100 } },
  hinge_db: { anchor: 'ankle', equip: 'dumbbell', props: ['floor'], a: { ...STAND }, b: { ...STAND, trunk: 12, thigh: -78, shin: -100 } },
  deadlift: { anchor: 'ankle', equip: 'barbell', props: ['floor'], a: { ...STAND, trunk: 38, thigh: -25, shin: -112, upperArm: -88, forearm: -90 }, b: { ...STAND } },
  leg_curl: { anchor: 'hip', equip: 'none', props: ['bench_flat'], a: { trunk: 180, thigh: 0, shin: 0, upperArm: -100, forearm: -90 }, b: { trunk: 180, thigh: 0, shin: 100, upperArm: -100, forearm: -90 } },
  hip_thrust: { anchor: 'shoulder', equip: 'barbell', props: ['bench_flat', 'floor'], a: { trunk: 150, thigh: -35, shin: -95, upperArm: -60, forearm: 0 }, b: { trunk: 178, thigh: 5, shin: -90, upperArm: -40, forearm: 10 } },
  glute_bridge: { anchor: 'shoulder', equip: 'none', props: ['floor'], a: { trunk: 172, thigh: 25, shin: -70, upperArm: 0, forearm: 0 }, b: { trunk: 200, thigh: 5, shin: -90, upperArm: 0, forearm: 0 } },
  calf: { anchor: 'toe', equip: 'none', props: ['floor'], a: { ...STAND, foot: 0 }, b: { ...STAND, foot: -55 } },
  bench: { anchor: 'hip', equip: 'barbell', props: ['bench_flat'], a: { trunk: 180, thigh: -10, shin: -100, upperArm: 90, forearm: 90 }, b: { trunk: 180, thigh: -10, shin: -100, upperArm: -60, forearm: 75 } },
  bench_db: { anchor: 'hip', equip: 'dumbbell', props: ['bench_flat'], a: { trunk: 180, thigh: -10, shin: -100, upperArm: 90, forearm: 90 }, b: { trunk: 180, thigh: -10, shin: -100, upperArm: -70, forearm: 85 } },
  incline: { anchor: 'hip', equip: 'dumbbell', props: ['bench_incline'], a: { trunk: 150, thigh: -5, shin: -100, upperArm: 100, forearm: 100 }, b: { trunk: 150, thigh: -5, shin: -100, upperArm: -40, forearm: 100 } },
  incline_bar: { anchor: 'hip', equip: 'barbell', props: ['bench_incline'], a: { trunk: 150, thigh: -5, shin: -100, upperArm: 100, forearm: 100 }, b: { trunk: 150, thigh: -5, shin: -100, upperArm: -40, forearm: 100 } },
  chest_press: { anchor: 'hip', equip: 'none', props: ['seat'], a: { trunk: 95, thigh: 0, shin: -90, upperArm: -150, forearm: 0 }, b: { trunk: 95, thigh: 0, shin: -90, upperArm: -5, forearm: 0 } },
  pushup: { anchor: 'ankle', equip: 'none', props: ['floor'], a: { trunk: 17, thigh: 197, shin: 197, upperArm: -90, forearm: -90, foot: 55 }, b: { trunk: 8, thigh: 188, shin: 188, upperArm: -150, forearm: -75, foot: 55 } },
  dips: { anchor: 'wrist', equip: 'none', props: ['parallel_bars'], a: { trunk: 82, thigh: -80, shin: -140, upperArm: -92, forearm: -88 }, b: { trunk: 70, thigh: -80, shin: -140, upperArm: -165, forearm: -55 } },
  ohp: { anchor: 'ankle', equip: 'barbell', props: ['floor'], a: { ...STAND, upperArm: -70, forearm: 100 }, b: { ...STAND, upperArm: 88, forearm: 90 } },
  ohp_seated: { anchor: 'hip', equip: 'dumbbell', props: ['seat'], a: { trunk: 92, thigh: 0, shin: -90, upperArm: -75, forearm: 100 }, b: { trunk: 92, thigh: 0, shin: -90, upperArm: 88, forearm: 90 } },
  pullup: { anchor: 'wrist', equip: 'none', props: ['bar_top'], period: 2.8, a: { trunk: 92, thigh: -88, shin: -100, upperArm: 88, forearm: 90 }, b: { trunk: 98, thigh: -80, shin: -110, upperArm: -95, forearm: 70 } },
  pulldown: { anchor: 'hip', equip: 'cable_high', props: ['seat'], a: { trunk: 100, thigh: 0, shin: -90, upperArm: 85, forearm: 88 }, b: { trunk: 105, thigh: 0, shin: -90, upperArm: -105, forearm: 75 } },
  row_bar: { anchor: 'ankle', equip: 'barbell', props: ['floor'], a: { ...STAND, trunk: 25, thigh: -70, shin: -105 }, b: { ...STAND, trunk: 25, thigh: -70, shin: -105, upperArm: -160, forearm: -100 } },
  row_db: { anchor: 'ankle', equip: 'dumbbell', props: ['floor', 'bench_flat'], a: { ...STAND, trunk: 15, thigh: -80, shin: -100 }, b: { ...STAND, trunk: 15, thigh: -80, shin: -100, upperArm: -170, forearm: -95 } },
  row_cable: { anchor: 'hip', equip: 'cable_front', props: ['floor'], a: { trunk: 75, thigh: 5, shin: -20, upperArm: 0, forearm: 0 }, b: { trunk: 92, thigh: 5, shin: -20, upperArm: -170, forearm: 5 } },
  row_machine: { anchor: 'hip', equip: 'none', props: ['seat', 'pad_front'], a: { trunk: 80, thigh: 0, shin: -90, upperArm: -5, forearm: 0 }, b: { trunk: 80, thigh: 0, shin: -90, upperArm: -170, forearm: 5 } },
  face_pull: { anchor: 'ankle', equip: 'cable_front', props: ['floor'], a: { ...STAND, upperArm: 5, forearm: 5 }, b: { ...STAND, upperArm: 175, forearm: 80 } },
  rear_fly: { anchor: 'ankle', equip: 'dumbbell', props: ['floor'], a: { ...STAND, trunk: 20, thigh: -75, shin: -100, upperArm: -88, forearm: -90 }, b: { ...STAND, trunk: 20, thigh: -75, shin: -100, upperArm: -175, forearm: -175 } },
  curl: { anchor: 'ankle', equip: 'dumbbell', props: ['floor'], a: { ...STAND, upperArm: -90, forearm: -85 }, b: { ...STAND, upperArm: -85, forearm: 85 } },
  curl_bar: { anchor: 'ankle', equip: 'barbell', props: ['floor'], a: { ...STAND, upperArm: -90, forearm: -85 }, b: { ...STAND, upperArm: -85, forearm: 85 } },
  curl_cable: { anchor: 'ankle', equip: 'cable_low', props: ['floor'], a: { ...STAND, upperArm: -90, forearm: -80 }, b: { ...STAND, upperArm: -85, forearm: 85 } },
  pushdown: { anchor: 'ankle', equip: 'cable_high', props: ['floor'], a: { ...STAND, trunk: 84, upperArm: -95, forearm: 25 }, b: { ...STAND, trunk: 84, upperArm: -95, forearm: -88 } },
  overhead_ext: { anchor: 'ankle', equip: 'dumbbell', props: ['floor'], a: { ...STAND, upperArm: 95, forearm: -105 }, b: { ...STAND, upperArm: 95, forearm: 92 } },
  close_bench: { anchor: 'hip', equip: 'barbell', props: ['bench_flat'], a: { trunk: 180, thigh: -10, shin: -100, upperArm: 90, forearm: 90 }, b: { trunk: 180, thigh: -10, shin: -100, upperArm: -80, forearm: 70 } },
  plank: { anchor: 'ankle', equip: 'none', props: ['floor'], hold: true, a: { trunk: 4, thigh: 184, shin: 184, upperArm: -90, forearm: 0, foot: 60 }, b: { trunk: 6, thigh: 186, shin: 186, upperArm: -90, forearm: 0, foot: 60 } },
  dead_bug: { anchor: 'hip', equip: 'none', props: ['floor'], a: { trunk: 180, thigh: 90, shin: 0, upperArm: 90, forearm: 90 }, b: { trunk: 180, thigh: 10, shin: 5, upperArm: 160, forearm: 165 } },
  cable_crunch: { anchor: 'hip', equip: 'cable_high', props: ['floor'], a: { trunk: 75, thigh: -90, shin: 180, upperArm: 120, forearm: 60, ay: 0 }, b: { trunk: 20, thigh: -90, shin: 180, upperArm: 60, forearm: 10 } },
  leg_raise: { anchor: 'wrist', equip: 'none', props: ['bar_top'], a: { trunk: 90, thigh: -90, shin: -90, upperArm: 90, forearm: 90 }, b: { trunk: 100, thigh: -5, shin: -35, upperArm: 90, forearm: 90 } },
  lateral: { anchor: 'ankle', equip: 'dumbbell', front: 'lateral', a: STAND, b: STAND },
  fly: { anchor: 'ankle', equip: 'none', front: 'fly', a: STAND, b: STAND },
};

/** Animación de cada ejercicio de la biblioteca. */
export const EXERCISE_ANIM: Record<string, string> = {
  press_banca: 'bench', press_mancuernas: 'bench_db', press_inclinado_mancuernas: 'incline', press_inclinado_barra: 'incline_bar', press_maquina_pecho: 'chest_press',
  aperturas_polea: 'fly', aperturas_mancuernas: 'fly', pec_deck: 'fly', lagartijas: 'pushup', fondos: 'dips',
  dominadas: 'pullup', dominadas_asistidas: 'pullup', jalon_pecho: 'pulldown', jalon_banda: 'pulldown',
  remo_barra: 'row_bar', remo_mancuerna: 'row_db', remo_polea: 'row_cable', remo_maquina: 'row_machine', remo_banda: 'row_cable',
  face_pull: 'face_pull', face_pull_banda: 'face_pull', pajaros: 'rear_fly', reverse_pec_deck: 'rear_fly',
  press_militar: 'ohp', press_hombro_mancuernas: 'ohp_seated', press_hombro_maquina: 'ohp_seated',
  elevaciones_laterales: 'lateral', elevaciones_laterales_polea: 'lateral', elevaciones_laterales_banda: 'lateral',
  curl_barra: 'curl_bar', curl_mancuernas: 'curl', curl_martillo: 'curl', curl_polea: 'curl_cable', curl_banda: 'curl_cable',
  triceps_polea: 'pushdown', triceps_frances: 'overhead_ext', triceps_banda: 'pushdown', press_cerrado: 'close_bench',
  sentadilla: 'squat_bar', sentadilla_goblet: 'squat_goblet', prensa: 'leg_press', hack_squat: 'hack', extension_cuadriceps: 'leg_ext',
  sentadilla_bulgara: 'bulgarian', zancadas: 'lunge', peso_muerto_rumano: 'hinge_bar', peso_muerto_rumano_mancuernas: 'hinge_db', peso_muerto: 'deadlift',
  curl_femoral: 'leg_curl', curl_femoral_banda: 'leg_curl', hip_thrust: 'hip_thrust', puente_gluteo: 'glute_bridge',
  gemelos_pie: 'calf', gemelos_maquina: 'calf', plancha: 'plank', dead_bug: 'dead_bug', crunch_polea: 'cable_crunch', elevacion_piernas: 'leg_raise',
};

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export function mix(a: Pose, b: Pose, t: number): Pose {
  const k = (x?: number, y?: number) => (x == null && y == null ? undefined : lerp(x ?? 0, y ?? x ?? 0, t));
  return {
    trunk: lerp(a.trunk, b.trunk, t),
    thigh: lerp(a.thigh, b.thigh, t),
    shin: lerp(a.shin, b.shin, t),
    upperArm: lerp(a.upperArm, b.upperArm, t),
    forearm: lerp(a.forearm, b.forearm, t),
    foot: k(a.foot, b.foot),
    thigh2: k(a.thigh2, b.thigh2),
    shin2: k(a.shin2, b.shin2),
    ax: k(a.ax, b.ax),
    ay: k(a.ay, b.ay),
  };
}

export type P = { x: number; y: number };
export const add = (p: P, q: P): P => ({ x: p.x + q.x, y: p.y + q.y });
export const sub = (p: P, q: P): P => ({ x: p.x - q.x, y: p.y - q.y });

/** Cinemática directa desde el ancla. Coordenadas con y hacia arriba. */
export function solve(anchor: Anchor, p: Pose) {
  const A: P = { x: p.ax ?? 0, y: p.ay ?? 0 };
  const T = v(p.trunk, L.trunk);
  const TH = v(p.thigh, L.thigh);
  const SH = v(p.shin, L.shin);
  const UA = v(p.upperArm, L.upperArm);
  const FA = v(p.forearm, L.forearm);
  const FT = v(p.foot ?? 0, L.foot);
  let hip: P, knee: P, ankle: P, shoulder: P, elbow: P, wrist: P;
  if (anchor === 'ankle' || anchor === 'toe') {
    ankle = anchor === 'toe' ? sub(A, FT) : A;
    knee = sub(ankle, SH);
    hip = sub(knee, TH);
    shoulder = add(hip, T);
    elbow = add(shoulder, UA);
    wrist = add(elbow, FA);
  } else if (anchor === 'hip') {
    hip = A;
    knee = add(hip, TH);
    ankle = add(knee, SH);
    shoulder = add(hip, T);
    elbow = add(shoulder, UA);
    wrist = add(elbow, FA);
  } else if (anchor === 'shoulder') {
    shoulder = A;
    hip = sub(shoulder, T);
    knee = add(hip, TH);
    ankle = add(knee, SH);
    elbow = add(shoulder, UA);
    wrist = add(elbow, FA);
  } else {
    wrist = A;
    elbow = sub(wrist, FA);
    shoulder = sub(elbow, UA);
    hip = sub(shoulder, T);
    knee = add(hip, TH);
    ankle = add(knee, SH);
  }
  const toe = add(ankle, FT);
  const head = add(shoulder, v(p.trunk, L.neck + L.head));
  let knee2: P | null = null;
  let ankle2: P | null = null;
  if (p.thigh2 != null && p.shin2 != null) {
    knee2 = add(hip, v(p.thigh2, L.thigh));
    ankle2 = add(knee2, v(p.shin2, L.shin));
  }
  return { hip, knee, ankle, toe, shoulder, elbow, wrist, head, knee2, ankle2 };
}

