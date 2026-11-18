// "Registrar un día anterior": un solo lugar para anotar lo que olvidaste (comida, peso, agua, pasos, sueño,
// suplementos, entrenamiento y cardio) en cualquier fecha pasada.
import { useState } from 'react';
import { CalendarClock, Droplets, Dumbbell, HeartPulse, Moon, Pill, Scale, UtensilsCrossed } from 'lucide-react';
import { useApp } from '../store';
import { fmt, Modal, NumInput, Seg } from './ui';
import { BodyLogModal, RecoveryModal, StepsInput } from './QuickLogs';
import { api } from '../api';
import { navigate } from '../App';
import { setPendingDate } from '../lib/pendingDate';
import { addDays, formatDateLong, uid } from '@shared/utils';
import { sumMacros } from '@shared/nutrition/foods';

export function PastDayButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn sm ghost past-day-btn" onClick={() => setOpen(true)} data-testid="past-day-open">
        <CalendarClock size={15} /> ¿Olvidaste registrar algo? Registrar un día anterior
      </button>
      {open && <PastDayModal onClose={() => setOpen(false)} />}
    </>
  );
}

export function PastDayModal({ onClose }: { onClose: () => void }) {
  const { data, today, stack, supplementLogs, reload, toast } = useApp();
  const [date, setDate] = useState(addDays(today, -1));
  const [sub, setSub] = useState<'peso' | 'sueno' | null>(null);
  const [water, setWater] = useState<number | null>(250);
  const quick = date === addDays(today, -1) ? 'ayer' : date === addDays(today, -2) ? 'anteayer' : 'otro';
  const food = sumMacros(data.foodLogs.filter((l) => l.date === date));
  const waterTotal = data.waterLogs.filter((w) => w.date === date).reduce((a, w) => a + w.ml, 0);
  const body = data.bodyLogs.find((l) => l.date === date);
  const rec = data.recoveryLogs.find((r) => r.date === date);
  const sessions = data.sessions.filter((s) => s.date === date && s.completed);
  const cardio = data.cardioLogs.filter((c) => c.date === date);
  const go = (page: 'nutricion' | 'entrenamiento' | 'cardio', target: 'comida' | 'entreno' | 'cardio') => {
    setPendingDate(target, date);
    onClose();
    navigate(page);
  };
  const takenOn = (key: string) => supplementLogs.find((l) => l.date === date && l.supplement_key === key);

  return (
    <Modal title="Registrar un día anterior" onClose={onClose} wide>
      <div className="col" style={{ gap: 14 }} data-testid="past-day">
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <Seg
            value={quick}
            onChange={(v) => v !== 'otro' && setDate(addDays(today, v === 'ayer' ? -1 : -2))}
            options={[
              { value: 'ayer', label: 'Ayer' },
              { value: 'anteayer', label: 'Anteayer' },
              { value: 'otro', label: 'Otra fecha' },
            ]}
          />
          <input type="date" className="input" style={{ width: 170 }} value={date} max={addDays(today, -1)} onChange={(e) => e.target.value && setDate(e.target.value)} data-testid="past-day-date" />
          <b className="cap-first">{formatDateLong(date)}</b>
        </div>

        <div className="past-grid">
          <div className="past-item">
            <div className="past-head">
              <UtensilsCrossed size={16} color="var(--m-orange)" /> Comida
            </div>
            <div className="tiny muted">{food.kcal ? `${fmt(food.kcal)} kcal · P ${fmt(food.protein)} g registrados` : 'Sin registros'}</div>
            <button className="btn sm" onClick={() => go('nutricion', 'comida')} data-testid="past-food">
              Registrar comida de ese día
            </button>
          </div>

          <div className="past-item">
            <div className="past-head">
              <Scale size={16} color="var(--m-cyan)" /> Peso y medidas
            </div>
            <div className="tiny muted">{body?.weight ? `${fmt(body.weight, 1)} kg` : 'Sin registro'}{body?.waist ? ` · cintura ${fmt(body.waist, 1)} cm` : ''}</div>
            <button className="btn sm" onClick={() => setSub('peso')}>
              {body ? 'Editar' : 'Registrar'}
            </button>
          </div>

          <div className="past-item">
            <div className="past-head">
              <Droplets size={16} color="var(--m-blue)" /> Agua
            </div>
            <div className="tiny muted">{waterTotal ? `${fmt(waterTotal)} ml registrados` : 'Sin registros'}</div>
            <div className="row nowrap" style={{ gap: 6 }}>
              <NumInput value={water} onChange={setWater} suffix="ml" step={50} testId="past-water" />
              <button
                className="btn sm"
                onClick={async () => {
                  if (!water || water <= 0 || water > 6000) return toast('Cantidad de agua inválida.', 'error');
                  await api.upsert('water_logs', { id: uid('w_'), date, time: '12:00', ml: Math.round(water), context: 'general' });
                  await reload();
                  toast(`+${Math.round(water)} ml el ${formatDateLong(date)}.`);
                }}
                data-testid="past-water-add"
              >
                Agregar
              </button>
            </div>
          </div>

          <div className="past-item">
            <div className="past-head">
              <HeartPulse size={16} color="var(--m-lime)" /> Pasos
            </div>
            <StepsInput date={date} key={date} />
          </div>

          <div className="past-item">
            <div className="past-head">
              <Moon size={16} color="var(--m-violet)" /> Sueño y recuperación
            </div>
            <div className="tiny muted">{rec?.sleep_hours ? `${fmt(rec.sleep_hours, 1)} h de sueño` : 'Sin registro'}</div>
            <button className="btn sm" onClick={() => setSub('sueno')}>
              {rec ? 'Editar' : 'Registrar'}
            </button>
          </div>

          <div className="past-item">
            <div className="past-head">
              <Dumbbell size={16} color="var(--m-lime)" /> Entrenamiento
            </div>
            <div className="tiny muted">{sessions.length ? sessions.map((s) => s.day_name).join(', ') : 'Sin sesiones'}</div>
            <div className="row" style={{ gap: 6 }}>
              <button className="btn sm" onClick={() => go('entrenamiento', 'entreno')} data-testid="past-training">
                Pesas
              </button>
              <button className="btn sm" onClick={() => go('cardio', 'cardio')}>
                Cardio{cardio.length ? ` (${cardio.length})` : ''}
              </button>
            </div>
          </div>

          {stack.filter((s) => s.active).length > 0 && (
            <div className="past-item span-all">
              <div className="past-head">
                <Pill size={16} color="var(--m-pink)" /> Suplementos tomados
              </div>
              <div className="chips">
                {stack
                  .filter((s) => s.active)
                  .map((s) => {
                    const t = takenOn(s.supplement_key);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        className={`chip ${t ? 'on' : ''}`}
                        onClick={async () => {
                          if (t) await api.remove('supplement_logs', t.id);
                          else await api.upsert('supplement_logs', { id: uid('sl_'), date, supplement_key: s.supplement_key, name: s.name, dose: s.dose });
                          await reload();
                        }}
                      >
                        {t ? '✓ ' : ''}
                        {s.name}
                      </button>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      </div>
      {sub === 'peso' && <BodyLogModal date={date} onClose={() => setSub(null)} />}
      {sub === 'sueno' && <RecoveryModal date={date} onClose={() => setSub(null)} />}
    </Modal>
  );
}
