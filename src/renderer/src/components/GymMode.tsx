// Modo gimnasio: pantalla completa con botones grandes, una serie a la vez, temporizador de descanso
// visible, pantalla siempre encendida y aviso sonoro/vibración al terminar el descanso.
import { useEffect, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Minus, Plus, SkipForward, Sun, X } from 'lucide-react';
import type { SetLog, WorkoutSession } from '@shared/types';
import { getExercise } from '@shared/training/exercises';
import { ExerciseAnimation } from './ExerciseAnimation';
import { Ring } from './ui';
import { enterFullscreen, exitFullscreen, keepScreenOn } from '../lib/gym';

export interface GymModeProps {
  session: WorkoutSession;
  rest: { until: number; total: number } | null;
  restSecFor: (ei: number) => number;
  lastFor: (ei: number) => string | null;
  onUpdateSet: (ei: number, si: number, patch: Partial<SetLog>) => void;
  onStartRest: (sec: number) => void;
  onAddRest: (sec: number) => void;
  onSkipRest: () => void;
  onExit: () => void;
  onFinish: () => void;
}

export function GymMode(p: GymModeProps) {
  const ref = useRef<HTMLDivElement>(null);
  const firstOpen = p.session.exercises.findIndex((e) => e.sets.some((s) => !s.done));
  const [ei, setEi] = useState(Math.max(0, firstOpen));
  const [awake, setAwake] = useState<boolean | null>(null);
  const [flash, setFlash] = useState(false);
  const [, tick] = useState(0);
  const prevRest = useRef(p.rest);

  useEffect(() => {
    const k = keepScreenOn();
    setAwake(k.supported);
    if (ref.current) void enterFullscreen(ref.current);
    return () => {
      k.stop();
      void exitFullscreen();
    };
  }, []);

  useEffect(() => {
    if (!p.rest) return;
    const t = setInterval(() => tick((x) => x + 1), 250);
    return () => clearInterval(t);
  }, [p.rest]);

  // Al terminar el descanso, destello de "siguiente serie".
  useEffect(() => {
    if (prevRest.current && !p.rest) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 2200);
      prevRest.current = p.rest;
      return () => clearTimeout(t);
    }
    prevRest.current = p.rest;
  }, [p.rest]);

  const e = p.session.exercises[ei];
  const ex = getExercise(e.exerciseId);
  const si = Math.max(0, e.sets.findIndex((s) => !s.done));
  const allDone = e.sets.every((s) => s.done);
  const set = e.sets[allDone ? e.sets.length - 1 : si];
  const step = ex?.loadStep && ex.loadStep > 0 ? ex.loadStep : 2.5;
  const sessionDone = p.session.exercises.every((x) => x.sets.every((s) => s.done));
  const restLeft = p.rest ? Math.max(0, Math.ceil((p.rest.until - Date.now()) / 1000)) : 0;

  const markDone = () => {
    if (allDone) return;
    const reps = set.reps > 0 ? set.reps : e.repMin;
    p.onUpdateSet(ei, si, { done: true, reps, rest_s: p.restSecFor(ei) });
    const last = si === e.sets.length - 1;
    // Prellenar la siguiente serie con el mismo peso.
    if (!last && !e.sets[si + 1].weight) p.onUpdateSet(ei, si + 1, { weight: set.weight });
    if (last && ei < p.session.exercises.length - 1) setTimeout(() => setEi(ei + 1), 400);
    if (!(last && ei === p.session.exercises.length - 1)) p.onStartRest(p.restSecFor(ei));
  };

  return (
    <div className="gym" ref={ref} data-testid="gym-mode">
      <div className="gym-top">
        <button className="gym-icon" onClick={p.onExit} aria-label="Salir del modo gimnasio" data-testid="gym-exit">
          <X />
        </button>
        <div className="gym-title">
          <div className="tiny muted">
            Ejercicio {ei + 1} de {p.session.exercises.length}
          </div>
          <div className="gym-name">{e.name}</div>
        </div>
        <div className="tiny muted gym-awake" title={awake ? 'La pantalla no se apagará' : 'Este navegador no permite mantener la pantalla encendida'}>
          <Sun size={14} /> {awake ? 'Pantalla encendida' : awake === false ? 'Sin bloqueo de pantalla' : ''}
        </div>
      </div>

      {p.rest ? (
        <div className="gym-rest" data-testid="gym-rest">
          <div className="muted">Descanso</div>
          <Ring value={restLeft} max={p.rest.total} size={260} stroke={16} color="var(--m-cyan)">
            <div className="gym-count mono">
              {Math.floor(restLeft / 60)}:{String(restLeft % 60).padStart(2, '0')}
            </div>
          </Ring>
          <div className="muted mt12">
            Siguiente: {allDone ? (p.session.exercises[ei + 1]?.name ?? 'terminar') : `serie ${si + 1} de ${e.sets.length}`}
          </div>
          <div className="row mt16" style={{ gap: 12, justifyContent: 'center' }}>
            <button className="gym-btn" onClick={() => p.onAddRest(30)}>
              +30 s
            </button>
            <button className="gym-btn primary" onClick={p.onSkipRest} data-testid="gym-skip">
              <SkipForward /> Saltar
            </button>
          </div>
        </div>
      ) : (
        <div className="gym-body">
          {flash && <div className="gym-flash">¡Siguiente serie!</div>}
          <div className="gym-anim">{ex && <ExerciseAnimation exerciseId={ex.id} size={170} />}</div>
          <div className="gym-target">
            {allDone ? (
              <b style={{ color: 'var(--m-green)' }}>Ejercicio completado ✓</b>
            ) : (
              <>
                Serie <b>{si + 1}</b> de {e.sets.length} · {e.repMin}–{e.repMax} reps · RIR {e.targetRir}
              </>
            )}
            {p.lastFor(ei) && <div className="tiny muted">Última vez: {p.lastFor(ei)}</div>}
          </div>
          {!allDone && (
            <>
              <div className="gym-steppers">
                <Stepper label="Peso (kg)" value={set.weight} onChange={(v) => p.onUpdateSet(ei, si, { weight: Math.max(0, Math.round(v * 100) / 100) })} step={step} testId="gym-weight" />
                <Stepper label="Repeticiones" value={set.reps || e.repMin} onChange={(v) => p.onUpdateSet(ei, si, { reps: Math.max(0, Math.round(v)) })} step={1} testId="gym-reps" />
              </div>
              <div className="gym-rir">
                <span className="tiny muted">RIR</span>
                {[0, 1, 2, 3, 4].map((n) => (
                  <button key={n} className={`gym-chip ${set.rir === n ? 'on' : ''}`} onClick={() => p.onUpdateSet(ei, si, { rir: set.rir === n ? null : n })}>
                    {n}
                  </button>
                ))}
              </div>
              <button className="gym-done" onClick={markDone} data-testid="gym-done">
                <Check size={30} /> Serie hecha
              </button>
            </>
          )}
          {sessionDone && (
            <button className="gym-done" onClick={p.onFinish} data-testid="gym-finish">
              <Check size={30} /> Terminar sesión
            </button>
          )}
        </div>
      )}

      <div className="gym-nav">
        <button className="gym-btn" disabled={ei === 0} onClick={() => setEi(ei - 1)}>
          <ChevronLeft /> Anterior
        </button>
        <div className="gym-dots">
          {p.session.exercises.map((x, i) => (
            <span key={i} className={`gym-dot ${i === ei ? 'cur' : ''} ${x.sets.every((s) => s.done) ? 'done' : ''}`} onClick={() => setEi(i)} />
          ))}
        </div>
        <button className="gym-btn" disabled={ei >= p.session.exercises.length - 1} onClick={() => setEi(ei + 1)} data-testid="gym-next">
          Siguiente <ChevronRight />
        </button>
      </div>
    </div>
  );
}

function Stepper({ label, value, onChange, step, testId }: { label: string; value: number; onChange: (v: number) => void; step: number; testId?: string }) {
  return (
    <div className="gym-stepper">
      <div className="tiny muted">{label}</div>
      <div className="row nowrap" style={{ gap: 10, justifyContent: 'center' }}>
        <button className="gym-round" onClick={() => onChange(value - step)} aria-label={`Menos ${label}`}>
          <Minus />
        </button>
        <input className="gym-value mono" type="number" inputMode="decimal" value={value || ''} onChange={(e) => onChange(Number(e.target.value))} data-testid={testId} />
        <button className="gym-round" onClick={() => onChange(value + step)} aria-label={`Más ${label}`}>
          <Plus />
        </button>
      </div>
    </div>
  );
}
