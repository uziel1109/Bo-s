// Animaciones originales de ejercicios: figura articulada en SVG (cinemática directa) que se mueve entre la
// posición inicial y final de cada patrón de movimiento, con el equipo dibujado. Ilustrativas: muestran el
// recorrido y la postura general, no sustituyen la supervisión de un entrenador.
import { useEffect, useRef, useState } from 'react';

import { add, ANIMS, EXERCISE_ANIM, L, lerp, mix, rad, solve, sub, v, type Anim, type Equip, type P } from '../lib/exerciseRig';
export { ANIMS, EXERCISE_ANIM, solve };

function useClock(period: number, playing: boolean) {
  const [t, setT] = useState(0);
  const raf = useRef(0);
  useEffect(() => {
    if (!playing) return;
    const start = performance.now();
    const tick = (now: number) => {
      const ph = (((now - start) / 1000) % period) / period;
      // ida y vuelta con pausa breve en cada extremo y aceleración suave
      const tri = ph < 0.5 ? ph * 2 : 2 - ph * 2;
      const held = Math.min(1, Math.max(0, (tri - 0.08) / 0.84));
      setT(0.5 - Math.cos(held * Math.PI) / 2);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [period, playing]);
  return t;
}

const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function ExerciseAnimation({ exerciseId, animKey, size = 220, autoplay = true, phase, still }: { exerciseId?: string; animKey?: string; size?: number; autoplay?: boolean; phase?: number; still?: boolean }) {
  const key = animKey ?? (exerciseId ? EXERCISE_ANIM[exerciseId] : undefined);
  const anim = key ? ANIMS[key] : null;
  const [playing, setPlaying] = useState(autoplay && !reduceMotion());
  const clock = useClock(anim?.period ?? 2.4, playing && phase == null);
  if (!anim) return null;
  const t = phase ?? (playing ? clock : 0.5);
  if (still)
    // Miniatura estática (dentro de otro botón): sin controles.
    return (
      <span className="ex-anim" style={{ width: size, height: size, display: 'inline-block' }} aria-hidden>
        {anim.front ? <FrontFigure kind={anim.front} t={0.7} equip={anim.equip} /> : <SideFigure anim={anim} t={0.7} />}
      </span>
    );
  return (
    <button className="ex-anim" style={{ width: size, height: size }} onClick={() => setPlaying(!playing)} title={playing ? 'Pausar' : 'Reproducir'} aria-label="Animación del ejercicio" type="button">
      {anim.front ? <FrontFigure kind={anim.front} t={anim.hold ? 0.5 : t} equip={anim.equip} /> : <SideFigure anim={anim} t={anim.hold ? t * 0.3 : t} />}
      {!playing && phase == null && <span className="ex-anim-play">▶</span>}
    </button>
  );
}

const STROKE = { body: 'var(--anim-body)', arm: 'var(--anim-arm)', limb2: 'var(--anim-body-2)', equip: 'var(--anim-equip)', prop: 'var(--anim-prop)' };

function SideFigure({ anim, t }: { anim: Anim; t: number }) {
  const p = mix(anim.a, anim.b, t);
  const j = solve(anim.anchor, p);
  // Encuadre fijo calculado con ambas poses para que la figura no "salte".
  const ja = solve(anim.anchor, anim.a);
  const jb = solve(anim.anchor, anim.b);
  const pts = [ja, jb].flatMap((s) => [s.hip, s.knee, s.ankle, s.toe, s.shoulder, s.elbow, s.wrist, s.head, ...(s.knee2 ? [s.knee2, s.ankle2!] : [])]);
  const minX = Math.min(...pts.map((q) => q.x)) - 22;
  const maxX = Math.max(...pts.map((q) => q.x)) + 22;
  const minY = Math.min(...pts.map((q) => q.y)) - 22;
  const maxY = Math.max(...pts.map((q) => q.y)) + 22;
  const w = Math.max(maxX - minX, maxY - minY);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const X = (q: P) => q.x;
  const Y = (q: P) => -q.y;
  const vb = `${cx - w / 2} ${-(cy + w / 2)} ${w} ${w}`;
  const floorY = Math.min(ja.ankle.y, jb.ankle.y, ja.toe.y, jb.toe.y, ...(ja.ankle2 ? [ja.ankle2.y, jb.ankle2!.y] : []));
  const seg = (a: P, b: P, width: number, color = STROKE.body) => <line x1={X(a)} y1={Y(a)} x2={X(b)} y2={Y(b)} stroke={color} strokeWidth={width} strokeLinecap="round" />;
  const props = anim.props ?? [];
  const hipRest = anim.anchor === 'hip' || anim.anchor === 'shoulder' ? (anim.anchor === 'hip' ? ja.hip : ja.shoulder) : null;
  return (
    <svg viewBox={vb} width="100%" height="100%">
      {/* Accesorios */}
      {props.includes('floor') && <line x1={cx - w} y1={-floorY + 1} x2={cx + w} y2={-floorY + 1} stroke={STROKE.prop} strokeWidth={2} />}
      {props.includes('bench_flat') && (
        <g>
          <rect x={(anim.anchor === 'hip' ? ja.hip.x : anim.anchor === 'shoulder' ? ja.shoulder.x : ja.knee.x) - (anim.anchor === 'shoulder' ? 34 : 40)} y={-(hipRest ? hipRest.y : ja.hip.y - 20) + 4} width={anim.anchor === 'shoulder' ? 30 : 62} height={7} rx={3} fill={STROKE.prop} />
          <line x1={(hipRest ? hipRest.x : ja.knee.x) - 10} y1={-(hipRest ? hipRest.y : ja.hip.y - 20) + 10} x2={(hipRest ? hipRest.x : ja.knee.x) - 10} y2={-floorY} stroke={STROKE.prop} strokeWidth={4} />
        </g>
      )}
      {props.includes('bench_incline') && <line x1={ja.hip.x + 4} y1={-ja.hip.y + 6} x2={ja.hip.x + Math.cos(rad(150)) * 60} y2={-(ja.hip.y + Math.sin(rad(150)) * 60) + 6} stroke={STROKE.prop} strokeWidth={7} strokeLinecap="round" />}
      {props.includes('seat') && (
        <g>
          <rect x={ja.hip.x - 14} y={-ja.hip.y + 5} width={30} height={6} rx={3} fill={STROKE.prop} />
          <line x1={ja.hip.x - 12} y1={-ja.hip.y + 4} x2={ja.hip.x - 12 + Math.cos(rad(ja.shoulder.x < ja.hip.x - 10 ? 135 : 100)) * 46} y2={-ja.hip.y + 4 - Math.sin(rad(ja.shoulder.x < ja.hip.x - 10 ? 135 : 100)) * 46} stroke={STROKE.prop} strokeWidth={5} strokeLinecap="round" />
        </g>
      )}
      {props.includes('platform') &&
        (() => {
          const d = sub(j.ankle, j.hip);
          const n = Math.hypot(d.x, d.y) || 1;
          const u = { x: d.x / n, y: d.y / n };
          const c = add(j.ankle, { x: u.x * 7, y: u.y * 7 });
          const q = { x: -u.y * 22, y: u.x * 22 };
          return <line x1={c.x - q.x} y1={-(c.y - q.y)} x2={c.x + q.x} y2={-(c.y + q.y)} stroke={STROKE.prop} strokeWidth={6} strokeLinecap="round" />;
        })()}
      {props.includes('pad_front') && <rect x={ja.shoulder.x + 6} y={-ja.shoulder.y - 4} width={6} height={30} rx={3} fill={STROKE.prop} />}
      {props.includes('bar_top') && <line x1={ja.wrist.x - 30} y1={-ja.wrist.y} x2={ja.wrist.x + 30} y2={-ja.wrist.y} stroke={STROKE.prop} strokeWidth={5} strokeLinecap="round" />}
      {props.includes('parallel_bars') && <line x1={ja.wrist.x - 26} y1={-ja.wrist.y + 2} x2={ja.wrist.x + 26} y2={-ja.wrist.y + 2} stroke={STROKE.prop} strokeWidth={5} strokeLinecap="round" />}
      {/* Cables */}
      {anim.equip === 'cable_high' && <line x1={X(j.wrist)} y1={Y(j.wrist)} x2={ja.wrist.x + 20} y2={-(Math.max(ja.wrist.y, jb.wrist.y, ja.head.y) + 18)} stroke={STROKE.equip} strokeWidth={1.5} />}
      {anim.equip === 'cable_low' && <line x1={X(j.wrist)} y1={Y(j.wrist)} x2={ja.wrist.x + 30} y2={-floorY} stroke={STROKE.equip} strokeWidth={1.5} />}
      {anim.equip === 'cable_front' && <line x1={X(j.wrist)} y1={Y(j.wrist)} x2={Math.max(ja.wrist.x, jb.wrist.x) + 40} y2={Y(ja.wrist)} stroke={STROKE.equip} strokeWidth={1.5} />}
      {/* Pierna trasera y brazo/pierna lejanos (más tenues) */}
      {j.knee2 && j.ankle2 && (
        <g>
          {seg(j.hip, j.knee2, 8, STROKE.limb2)}
          {seg(j.knee2, j.ankle2, 7, STROKE.limb2)}
        </g>
      )}
      {/* Cuerpo */}
      {seg(j.hip, j.shoulder, 12)}
      {seg(j.hip, j.knee, 10)}
      {seg(j.knee, j.ankle, 8)}
      {seg(j.ankle, j.toe, 6)}
      <circle cx={X(j.head)} cy={Y(j.head)} r={L.head} fill={STROKE.body} />
      {/* Brazo cercano con contorno para que se distinga sobre el torso */}
      {seg(j.shoulder, j.elbow, 12, 'var(--surface-2)')}
      {seg(j.elbow, j.wrist, 11, 'var(--surface-2)')}
      {seg(j.shoulder, j.elbow, 7, STROKE.arm)}
      {seg(j.elbow, j.wrist, 6, STROKE.arm)}
      {/* Equipo en las manos */}
      {anim.equip === 'barbell' && (
        <g>
          <line x1={X(j.wrist) - 2} y1={Y(j.wrist)} x2={X(j.wrist) + 2} y2={Y(j.wrist)} stroke={STROKE.equip} strokeWidth={3} />
          <circle cx={X(j.wrist)} cy={Y(j.wrist)} r={11} fill="none" stroke={STROKE.equip} strokeWidth={4} />
        </g>
      )}
      {anim.equip === 'dumbbell' && <rect x={X(j.wrist) - 7} y={Y(j.wrist) - 4} width={14} height={8} rx={3} fill={STROKE.equip} />}
      {anim.equip === 'kettle' && <circle cx={X(j.wrist)} cy={Y(j.wrist) + 6} r={6} fill={STROKE.equip} />}
    </svg>
  );
}

/** Vista frontal para movimientos laterales (elevaciones laterales, aperturas). */
function FrontFigure({ kind, t, equip }: { kind: 'lateral' | 'fly'; t: number; equip: Equip }) {
  const Y = (y: number) => -y;
  const line = (a: P, b: P, w: number, c = STROKE.body) => <line x1={a.x} y1={Y(a.y)} x2={b.x} y2={Y(b.y)} stroke={c} strokeWidth={w} strokeLinecap="round" />;
  const arm = (side: 1 | -1) => {
    const s = { x: 16 * side, y: 50 };
    if (kind === 'lateral') {
      // del costado (casi vertical) a la altura del hombro, codo apenas flexionado
      const a = lerp(-82, -2, t);
      const ang = side === 1 ? a : 180 - a;
      const el = add(s, v(ang, L.upperArm));
      const wr = add(el, v(side === 1 ? a + 6 : 180 - a - 6, L.forearm));
      return { s, el, wr };
    }
    // aperturas: brazos abiertos a la altura del pecho → manos al frente (el brazo se acorta en perspectiva)
    const k = lerp(1, 0.28, t);
    const ang = side === 1 ? lerp(8, 20, t) : 180 - lerp(8, 20, t);
    const el = add(s, v(ang, L.upperArm * k));
    const wr = add(el, v(side === 1 ? ang + lerp(10, 150, t) : 180 - (lerp(8, 20, t) + lerp(10, 150, t)), L.forearm * k));
    return { s, el, wr };
  };
  const r = arm(1);
  const l = arm(-1);
  return (
    <svg viewBox="-80 -100 160 160" width="100%" height="100%">
      <line x1={-80} y1={42} x2={80} y2={42} stroke={STROKE.prop} strokeWidth={2} />
      {line({ x: -9, y: 0 }, { x: -11, y: -40 }, 10)}
      {line({ x: 9, y: 0 }, { x: 11, y: -40 }, 10)}
      <rect x={-18} y={Y(56)} width={36} height={58} rx={10} fill={STROKE.body} />
      <circle cx={0} cy={Y(70)} r={L.head} fill={STROKE.body} />
      {kind === 'fly' && equip !== 'dumbbell' && (
        <g>
          <line x1={r.wr.x} y1={Y(r.wr.y)} x2={74} y2={Y(62)} stroke={STROKE.equip} strokeWidth={1.5} />
          <line x1={l.wr.x} y1={Y(l.wr.y)} x2={-74} y2={Y(62)} stroke={STROKE.equip} strokeWidth={1.5} />
        </g>
      )}
      {[r, l].map((a, i) => (
        <g key={i}>
          {line(a.s, a.el, 8)}
          {line(a.el, a.wr, 7)}
          {equip === 'dumbbell' && <rect x={a.wr.x - 4} y={Y(a.wr.y) - 7} width={8} height={14} rx={3} fill={STROKE.equip} />}
        </g>
      ))}
    </svg>
  );
}

/** Vista de depuración: todas las animaciones en su posición inicial y final (#anim-debug). */
export function AnimDebug() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${location.hash.includes('=') ? 3 : 6}, 1fr)`, gap: 8, padding: 12 }}>
      {Object.keys(ANIMS).filter((k) => !location.hash.includes('=') || location.hash.split('=')[1].split(',').includes(k)).map((k) => {
        return (
          <div key={k} className="card tight" style={{ padding: 6 }}>
            <div className="tiny">{k}</div>
            <div className="row nowrap" style={{ gap: 2 }}>
              <ExerciseAnimation animKey={k} size={location.hash.includes('=') ? 190 : 92} phase={0} />
              <ExerciseAnimation animKey={k} size={location.hash.includes('=') ? 190 : 92} phase={1} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
