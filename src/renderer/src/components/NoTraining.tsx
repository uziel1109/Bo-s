// Modo sin entrenamiento: pausa la rutina y baja las calorías al gasto real sin pesas ni cardio.
import { useMemo, useState } from 'react';
import { BedDouble, Pause, Play } from 'lucide-react';
import { useApp } from '../store';
import { Alert, Field, fmt, Modal, Seg } from './ui';
import { computeState, type NoTrainingMode } from '@shared/engine';
import { addDays, formatDateShort } from '@shared/utils';

export function useNoTraining() {
  const { settings, state: st } = useApp();
  const mode = (settings.no_training as NoTrainingMode | undefined) ?? null;
  return { mode, active: st.noTraining.active, kcalDelta: st.noTraining.kcalDelta, floorLimited: st.noTraining.floorLimited };
}

/** Aviso cuando el modo está activo, con el efecto en calorías y el botón para volver a entrenar. */
export function NoTrainingBanner() {
  const { setSetting, toast, state: st } = useApp();
  const nt = useNoTraining();
  if (!nt.active || !nt.mode) return null;
  return (
    <div className="nt-banner" data-testid="no-training-banner">
      <BedDouble size={22} />
      <div className="grow">
        <b>Modo sin entrenamiento</b>
        <span className="small muted">
          {' '}
          desde el {formatDateShort(nt.mode.since)}
          {nt.mode.until ? ` hasta el ${formatDateShort(nt.mode.until)}` : ''}
        </span>
        <div className="small">
          Calorías: <b>{fmt(st.targets.kcal)} kcal/día</b>
          {nt.kcalDelta < 0 && <> ({fmt(nt.kcalDelta)} kcal por no entrenar)</>}. Proteína igual: {fmt(st.targets.protein)} g.
          {nt.floorLimited && <span className="muted"> Ya estás en el mínimo seguro de calorías, así que no bajan más.</span>}
        </div>
      </div>
      <button
        className="btn sm primary"
        onClick={async () => {
          await setSetting('no_training', { ...nt.mode, enabled: false });
          toast('Rutina reactivada. ¡A entrenar!');
        }}
        data-testid="no-training-off"
      >
        <Play size={14} /> Volver a entrenar
      </button>
    </div>
  );
}

/** Botón y ventana para activar el modo, con vista previa del cambio de calorías. */
export function NoTrainingButton() {
  const nt = useNoTraining();
  const [open, setOpen] = useState(false);
  if (nt.active) return null;
  return (
    <>
      <button className="btn sm" onClick={() => setOpen(true)} data-testid="no-training-open">
        <Pause size={14} /> Modo sin entrenamiento
      </button>
      {open && <NoTrainingModal onClose={() => setOpen(false)} />}
    </>
  );
}

function NoTrainingModal({ onClose }: { onClose: () => void }) {
  const { data, state: st, today, setSetting, toast } = useApp();
  const [len, setLen] = useState<'indef' | '7' | '14' | '28'>('indef');
  const until = len === 'indef' ? null : addDays(today, Number(len) - 1);
  const preview = useMemo(() => computeState({ ...data, noTraining: { enabled: true, since: today, until } }, today), [data, today, until]);
  const delta = preview.targets.kcal - st.targets.kcal;
  const activate = async () => {
    await setSetting('no_training', { enabled: true, since: today, until });
    toast('Modo sin entrenamiento activado.');
    onClose();
  };
  return (
    <Modal
      title="Modo sin entrenamiento"
      onClose={onClose}
      footer={
        <button className="btn primary" onClick={activate} data-testid="no-training-confirm">
          <Pause size={14} /> Activar
        </button>
      }
    >
      <p className="small">Para temporadas en las que no vas a entrenar (viaje, lesión, trabajo o porque así lo prefieres). Tu rutina queda en pausa y tus calorías bajan a lo que gastas sin pesas ni cardio.</p>
      <Field label="¿Por cuánto tiempo?">
        <Seg value={len} onChange={setLen} options={[{ value: 'indef', label: 'Hasta que lo quite' }, { value: '7', label: '1 semana' }, { value: '14', label: '2 semanas' }, { value: '28', label: '4 semanas' }]} />
      </Field>
      <div className="nt-preview mt12" data-testid="no-training-preview">
        <div>
          <div className="tiny muted">Calorías ahora</div>
          <div className="mono" style={{ fontSize: 22, fontWeight: 750 }}>{fmt(st.targets.kcal)}</div>
        </div>
        <div className="nt-arrow">→</div>
        <div>
          <div className="tiny muted">Sin entrenar</div>
          <div className="mono" style={{ fontSize: 22, fontWeight: 750, color: 'var(--m-orange)' }}>{fmt(preview.targets.kcal)}</div>
        </div>
        <div className="small muted">{delta < 0 ? `${fmt(delta)} kcal/día` : 'sin cambio'}</div>
      </div>
      {preview.noTraining.floorLimited && <Alert kind="warn">Ya estás en el mínimo seguro de calorías ({fmt(preview.targets.kcal)} kcal): no bajan más. Para compensar, camina más.</Alert>}
      <ul className="small mt12 rec-list">
        <li>La proteína no cambia ({fmt(st.targets.protein)} g): sin entrenamiento es todavía más importante para conservar músculo.</li>
        <li>Los pasos diarios siguen contando. Caminar es la forma más fácil de gastar más sin “hacer ejercicio”.</li>
        <li>Sin pesas, parte del peso que bajes puede ser músculo. Cuando quieras, vuelves a entrenar con un toque.</li>
      </ul>
    </Modal>
  );
}
