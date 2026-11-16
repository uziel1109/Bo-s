// Movilidad guiada antes de entrenar, con las mismas figuras animadas de los ejercicios.
import { useEffect, useMemo, useState } from 'react';
import { Pause, Play, SkipForward, StretchHorizontal, X } from 'lucide-react';
import { Card, Modal, Ring } from './ui';
import { IconTile } from './visual';
import { ExerciseAnimation } from './ExerciseAnimation';
import { mobilityFor, type MobilityRoutine } from '@shared/training/mobility';
import { getExercise } from '@shared/training/exercises';
import type { RoutineDay } from '@shared/training/generator';
import type { BodyRegion } from '@shared/types';
import { restDoneAlert, unlockAudio, keepScreenOn } from '../lib/gym';

export function useMobility(day: RoutineDay | null | undefined, injuries: BodyRegion[]): MobilityRoutine | null {
  return useMemo(() => {
    if (!day) return null;
    const patterns = day.exercises.map((e) => getExercise(e.exerciseId)?.pattern).filter((p): p is NonNullable<typeof p> => !!p);
    return mobilityFor(patterns, injuries);
  }, [day, injuries]);
}

export function MobilityCard({ routine }: { routine: MobilityRoutine }) {
  const [guide, setGuide] = useState(false);
  return (
    <Card
      title={`Movilidad antes de entrenar · ${Math.round(routine.seconds / 60)} min`}
      icon={<IconTile icon={StretchHorizontal} color="var(--m-violet)" size={28} />}
      hint={routine.focus}
      actions={
        <button
          className="btn sm primary"
          onClick={() => {
            unlockAudio();
            setGuide(true);
          }}
          data-testid="mobility-start"
        >
          <Play size={14} /> Guiada
        </button>
      }
    >
      <div className="grid g2" data-testid="mobility-list">
        {routine.drills.map((d) => (
          <div key={d.id} className="row nowrap" style={{ gap: 10, alignItems: 'flex-start' }}>
            <ExerciseAnimation animKey={d.anim} size={64} still />
            <div>
              <b className="small">{d.name}</b>
              <div className="tiny muted">{d.dose}</div>
            </div>
          </div>
        ))}
      </div>
      {guide && <MobilityGuide routine={routine} onClose={() => setGuide(false)} />}
    </Card>
  );
}

function MobilityGuide({ routine, onClose }: { routine: MobilityRoutine; onClose: () => void }) {
  const [i, setI] = useState(0);
  const [left, setLeft] = useState(routine.drills[0].seconds);
  const [paused, setPaused] = useState(false);
  const d = routine.drills[i];
  useEffect(() => {
    const k = keepScreenOn();
    return () => k.stop();
  }, []);
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setLeft((x) => x - 1), 1000);
    return () => clearInterval(t);
  }, [paused, i]);
  useEffect(() => {
    if (left > 0) return;
    restDoneAlert();
    if (i < routine.drills.length - 1) {
      setI(i + 1);
      setLeft(routine.drills[i + 1].seconds);
    } else setPaused(true);
  }, [left, i, routine.drills]);
  const finished = i === routine.drills.length - 1 && left <= 0;
  return (
    <Modal title={`Movilidad · ${i + 1} de ${routine.drills.length}`} onClose={onClose}>
      <div className="col" style={{ alignItems: 'center', gap: 12, textAlign: 'center' }} data-testid="mobility-guide">
        <ExerciseAnimation animKey={d.anim} size={200} />
        <h3>{d.name}</h3>
        <div className="small">{d.dose}</div>
        <p className="small muted">{d.cue}</p>
        {finished ? (
          <b style={{ color: 'var(--m-green)' }}>¡Listo! Ya puedes empezar tu entrenamiento.</b>
        ) : (
          <Ring value={Math.max(0, left)} max={d.seconds} size={120} stroke={10} color="var(--m-violet)">
            <div className="mono" style={{ fontSize: 26, fontWeight: 800 }}>
              {Math.max(0, left)}
            </div>
          </Ring>
        )}
        <div className="row" style={{ gap: 10 }}>
          {!finished && (
            <button className="btn" onClick={() => setPaused(!paused)}>
              {paused ? <Play size={14} /> : <Pause size={14} />} {paused ? 'Reanudar' : 'Pausa'}
            </button>
          )}
          {i < routine.drills.length - 1 && (
            <button
              className="btn"
              onClick={() => {
                setI(i + 1);
                setLeft(routine.drills[i + 1].seconds);
              }}
              data-testid="mobility-next"
            >
              <SkipForward size={14} /> Siguiente
            </button>
          )}
          <button className="btn primary" onClick={onClose}>
            <X size={14} /> Cerrar
          </button>
        </div>
      </div>
    </Modal>
  );
}
