// Diagrama muscular esquemático (vista frontal y posterior) que resalta músculos principales y secundarios.
// Es una ilustración anatómica simplificada, no una demostración de la técnica del ejercicio.
import type { Muscle } from '@shared/types';

type Shape = { d?: string; e?: [number, number, number, number]; r?: [number, number, number, number, number] };

// Coordenadas en un lienzo de 120 × 240 por vista.
const FRONT: Partial<Record<Muscle, Shape[]>> = {
  pecho: [{ e: [48, 62, 11, 8] }, { e: [72, 62, 11, 8] }],
  hombro_anterior: [{ e: [35, 56, 6, 7] }, { e: [85, 56, 6, 7] }],
  hombro_lateral: [{ e: [31, 58, 4, 7] }, { e: [89, 58, 4, 7] }],
  biceps: [{ e: [30, 80, 5, 11] }, { e: [90, 80, 5, 11] }],
  antebrazo: [{ e: [27, 104, 4.5, 12] }, { e: [93, 104, 4.5, 12] }],
  abdomen: [{ r: [51, 74, 18, 34, 5] }],
  cuadriceps: [{ e: [50, 140, 8, 22] }, { e: [70, 140, 8, 22] }],
  aductores: [{ e: [57, 132, 3, 12] }, { e: [63, 132, 3, 12] }],
  pantorrillas: [{ e: [49, 190, 5, 15] }, { e: [71, 190, 5, 15] }],
};
const BACK: Partial<Record<Muscle, Shape[]>> = {
  espalda_alta: [{ d: 'M46 48 L60 44 L74 48 L72 66 L60 70 L48 66 Z' }],
  hombro_posterior: [{ e: [36, 57, 6, 7] }, { e: [84, 57, 6, 7] }],
  hombro_lateral: [{ e: [31, 58, 4, 7] }, { e: [89, 58, 4, 7] }],
  dorsales: [{ d: 'M44 64 L58 72 L56 98 L46 92 Z' }, { d: 'M76 64 L62 72 L64 98 L74 92 Z' }],
  triceps: [{ e: [30, 80, 5, 11] }, { e: [90, 80, 5, 11] }],
  antebrazo: [{ e: [27, 104, 4.5, 12] }, { e: [93, 104, 4.5, 12] }],
  lumbares: [{ r: [53, 98, 14, 14, 4] }],
  gluteos: [{ e: [52, 122, 9, 9] }, { e: [68, 122, 9, 9] }],
  isquiotibiales: [{ e: [51, 150, 7, 18] }, { e: [69, 150, 7, 18] }],
  pantorrillas: [{ e: [50, 190, 5.5, 15] }, { e: [70, 190, 5.5, 15] }],
};

function Silhouette() {
  return (
    <g fill="var(--surface-3)" stroke="var(--border-strong)" strokeWidth="0.8">
      <circle cx="60" cy="24" r="12" />
      <rect x="54" y="35" width="12" height="8" rx="3" />
      <path d="M38 46 Q60 38 82 46 L84 108 Q60 116 36 108 Z" />
      <rect x="24" y="50" width="12" height="70" rx="6" />
      <rect x="84" y="50" width="12" height="70" rx="6" />
      <path d="M40 110 L59 112 L58 215 L44 215 Z" />
      <path d="M80 110 L61 112 L62 215 L76 215 Z" />
    </g>
  );
}

function draw(shapes: Shape[] | undefined, fill: string, key: string) {
  return (shapes ?? []).map((s, i) =>
    s.e ? <ellipse key={key + i} cx={s.e[0]} cy={s.e[1]} rx={s.e[2]} ry={s.e[3]} fill={fill} /> : s.r ? <rect key={key + i} x={s.r[0]} y={s.r[1]} width={s.r[2]} height={s.r[3]} rx={s.r[4]} fill={fill} /> : <path key={key + i} d={s.d} fill={fill} />,
  );
}

export function MuscleMap({ primary, secondary = [], size = 180 }: { primary: Muscle[]; secondary?: Muscle[]; size?: number }) {
  const view = (map: Partial<Record<Muscle, Shape[]>>, label: string) => (
    <figure style={{ margin: 0, textAlign: 'center' }}>
      <svg viewBox="0 0 120 230" width={size * 0.6} height={size * 1.15} role="img" aria-label={label}>
        <Silhouette />
        {(Object.keys(map) as Muscle[]).map((m) => draw(map[m], primary.includes(m) ? 'var(--accent)' : secondary.includes(m) ? 'color-mix(in srgb, var(--accent) 38%, transparent)' : 'transparent', m))}
      </svg>
      <figcaption className="tiny muted">{label}</figcaption>
    </figure>
  );
  return (
    <div>
      <div className="row" style={{ justifyContent: 'center', gap: 4 }}>
        {view(FRONT, 'Frontal')}
        {view(BACK, 'Posterior')}
      </div>
      <div className="row tiny muted" style={{ justifyContent: 'center', gap: 12 }}>
        <span className="row" style={{ gap: 5 }}>
          <span className="dot" style={{ background: 'var(--accent)' }} /> Principal
        </span>
        <span className="row" style={{ gap: 5 }}>
          <span className="dot" style={{ background: 'color-mix(in srgb, var(--accent) 38%, transparent)' }} /> Secundario
        </span>
      </div>
    </div>
  );
}
