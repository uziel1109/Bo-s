// Registros rápidos reutilizables (peso/medidas, pasos, recuperación).
import { useEffect, useState } from 'react';
import type { BodyLog, RecoveryLog } from '@shared/types';
import { Field, Modal, NumInput } from './ui';
import { api } from '../api';
import { useApp } from '../store';
import { formatDateShort, uid } from '@shared/utils';

const MEASURES: { key: keyof BodyLog; label: string }[] = [
  { key: 'waist', label: 'Cintura' },
  { key: 'abdomen', label: 'Abdomen' },
  { key: 'neck', label: 'Cuello' },
  { key: 'chest', label: 'Pecho' },
  { key: 'hip', label: 'Cadera' },
  { key: 'arm', label: 'Brazo' },
  { key: 'thigh', label: 'Muslo' },
  { key: 'calf', label: 'Pantorrilla' },
];

export function BodyLogModal({ onClose, date: initialDate }: { onClose: () => void; date?: string }) {
  const { data, today, reload, toast } = useApp();
  const [date, setDate] = useState(initialDate ?? today);
  const existing = data.bodyLogs.find((l) => l.date === date);
  const [row, setRow] = useState<Partial<BodyLog>>(existing ?? {});
  const [showAll, setShowAll] = useState(!!existing && MEASURES.some((m) => existing[m.key] != null && m.key !== 'waist'));

  const save = async () => {
    const vals = [row.weight, ...MEASURES.map((m) => row[m.key] as number | null | undefined)];
    if (vals.every((v) => v == null)) return toast('Ingresa al menos un valor.', 'error');
    if (row.weight != null && (row.weight < 30 || row.weight > 300)) return toast('Peso fuera de rango.', 'error');
    if (row.bf_percent != null && !row.bf_method) return toast('Indica el método con el que se midió el % de grasa.', 'error');
    const cur = data.bodyLogs.find((l) => l.date === date);
    await api.upsert('body_logs', { ...cur, ...row, id: cur?.id ?? uid('b_'), date });
    await reload();
    toast('Registro guardado.');
    onClose();
  };

  return (
    <Modal
      title="Registrar peso y medidas"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn primary" onClick={save} data-testid="bodylog-save">
            Guardar
          </button>
        </>
      }
    >
      <div className="col" style={{ gap: 14 }}>
        <div className="grid g2">
          <Field label="Fecha">
            <input type="date" className="input" value={date} max={today} onChange={(e) => { setDate(e.target.value); setRow(data.bodyLogs.find((l) => l.date === e.target.value) ?? {}); }} />
          </Field>
          <Field label="Peso (en ayunas)">
            <NumInput value={row.weight} onChange={(v) => setRow({ ...row, weight: v })} suffix="kg" step={0.1} testId="bodylog-weight" />
          </Field>
          <Field label="Cintura">
            <NumInput value={row.waist} onChange={(v) => setRow({ ...row, waist: v })} suffix="cm" step={0.1} testId="bodylog-waist" />
          </Field>
        </div>
        {!showAll ? (
          <button className="btn sm ghost" style={{ alignSelf: 'flex-start' }} onClick={() => setShowAll(true)}>
            + Más medidas y % de grasa
          </button>
        ) : (
          <>
            <div className="grid g3">
              {MEASURES.filter((m) => m.key !== 'waist').map((m) => (
                <Field key={m.key} label={m.label}>
                  <NumInput value={row[m.key] as number | null} onChange={(v) => setRow({ ...row, [m.key]: v })} suffix="cm" step={0.1} />
                </Field>
              ))}
            </div>
            <div className="grid g2">
              <Field label="% de grasa medido (opcional)">
                <NumInput value={row.bf_percent} onChange={(v) => setRow({ ...row, bf_percent: v })} suffix="%" step={0.1} />
              </Field>
              <Field label="Método">
                <select className="input" value={row.bf_method ?? ''} onChange={(e) => setRow({ ...row, bf_method: (e.target.value || null) as BodyLog['bf_method'] })}>
                  <option value="">—</option>
                  <option value="dexa">DEXA</option>
                  <option value="bodpod">BOD POD</option>
                  <option value="pesaje_hidrostatico">Pesaje hidrostático</option>
                  <option value="bioimpedancia">Bioimpedancia</option>
                  <option value="plicometria">Plicometría</option>
                  <option value="visual">Estimación visual</option>
                </select>
              </Field>
            </div>
          </>
        )}
        <Field label="Notas">
          <input className="input" value={row.notes ?? ''} onChange={(e) => setRow({ ...row, notes: e.target.value })} placeholder="p. ej., comida salada la noche anterior" />
        </Field>
      </div>
    </Modal>
  );
}

export function RecoveryModal({ onClose, date: initialDate }: { onClose: () => void; date?: string }) {
  const { data, today, reload, toast } = useApp();
  const [date, setDate] = useState(initialDate ?? today);
  const [r, setR] = useState<Partial<RecoveryLog>>(data.recoveryLogs.find((x) => x.date === date) ?? { sleep_hours: null });
  const scale = (k: keyof RecoveryLog, label: string, low: string, high: string) => (
    <Field label={label} help={`1 = ${low} · 5 = ${high}`}>
      <div className="seg">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} className={r[k] === n ? 'on' : ''} onClick={() => setR({ ...r, [k]: n })}>
            {n}
          </button>
        ))}
      </div>
    </Field>
  );
  return (
    <Modal
      title={date === today ? 'Recuperación de hoy' : `Recuperación del ${formatDateShort(date)}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn primary"
            onClick={async () => {
              await api.upsert('recovery_logs', { ...r, date });
              await reload();
              toast('Recuperación registrada.');
              onClose();
            }}
          >
            Guardar
          </button>
        </>
      }
    >
      <div className="grid g2">
        <Field label="Fecha" help="La noche que dormiste antes de ese día.">
          <input type="date" className="input" value={date} max={today} onChange={(e) => { setDate(e.target.value); setR(data.recoveryLogs.find((x) => x.date === e.target.value) ?? { sleep_hours: null }); }} data-testid="recovery-date" />
        </Field>
        <Field label="Horas de sueño">
          <NumInput value={r.sleep_hours} onChange={(v) => setR({ ...r, sleep_hours: v })} suffix="h" step={0.25} />
        </Field>
        {scale('sleep_quality', 'Calidad del sueño', 'muy mala', 'excelente')}
        {scale('energy', 'Energía', 'agotado', 'excelente')}
        {scale('soreness', 'Dolor muscular', 'nada', 'mucho')}
        {scale('stress', 'Estrés', 'bajo', 'muy alto')}
      </div>
    </Modal>
  );
}

export function StepsInput({ date: forDate }: { date?: string } = {}) {
  const { data, today, reload, toast } = useApp();
  const date = forDate ?? today;
  const cur = data.stepsLogs.find((s) => s.date === date)?.steps ?? null;
  const [v, setV] = useState<number | null>(cur);
  useEffect(() => setV(cur), [date]);
  return (
    <div className="row nowrap">
      <NumInput value={v} onChange={setV} suffix="pasos" testId="steps-input" />
      <button
        className="btn"
        onClick={async () => {
          if (v == null || v < 0 || v > 100000) return toast('Valor de pasos inválido.', 'error');
          await api.upsert('steps_logs', { date, steps: Math.round(v) });
          await reload();
          toast('Pasos guardados.');
        }}
      >
        Guardar
      </button>
    </div>
  );
}
