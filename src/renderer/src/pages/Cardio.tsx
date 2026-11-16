import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Hero } from '../components/visual';
import { useApp } from '../store';
import { Alert, Card, Claims, Field, fmt, NumInput, Stat, Bar } from '../components/ui';
import { SimpleBars } from '../components/charts';
import { StepsInput } from '../components/QuickLogs';
import { cardioPlan, estimateCardioKcal, heartRateZones, MODALITY_LABEL, stepsTarget, weeklyCardioSummary } from '@shared/cardio/cardio';
import type { CardioLog, CardioModality } from '@shared/types';
import { addDays, dateRange, formatDateShort, uid } from '@shared/utils';
import { api } from '../api';
import { withBonus } from '../store';

export function Cardio() {
  const { data, state: st, profile, today, reload, toast, settings } = useApp();
  const plan = cardioPlan(profile, st.flags);
  const zones = heartRateZones(profile.age);
  const steps = withBonus(stepsTarget(data.stepsLogs, today), settings.steps_bonus);
  const stepsToday = data.stepsLogs.find((s) => s.date === today)?.steps ?? 0;
  const week = weeklyCardioSummary(data.cardioLogs, today);
  const [f, setF] = useState<Partial<CardioLog>>({ date: today, modality: 'caminata', minutes: 30, intensity: 'baja' });
  const betaBlocker = /metoprolol|propranolol|atenolol|bisoprolol|carvedilol|nebivolol/i.test(profile.medications);
  const last14 = dateRange(addDays(today, -13), today).map((d) => ({ date: d, steps: data.stepsLogs.find((s) => s.date === d)?.steps ?? 0 }));
  const est = f.modality && f.intensity && f.minutes ? estimateCardioKcal(f.modality, f.intensity, f.minutes, st.currentWeight) : null;

  const save = async () => {
    if (!f.minutes || f.minutes <= 0 || f.minutes > 600) return toast('Duración inválida.', 'error');
    await api.upsert('cardio_logs', { ...f, id: uid('c_') });
    await reload();
    toast('Sesión de cardio registrada.');
  };

  return (
    <div className="page">
      <Hero module="cardio" title="Cardio y actividad diaria" sub="El cardio complementa al entrenamiento de fuerza; la actividad diaria es la base del gasto." />
      <div className="grid g4 mb16">
        <Card tight>
          <Stat label="Pasos hoy" value={fmt(stepsToday)} foot={`Meta: ${fmt(steps.target)}`} />
          <div className="mt8">
            <Bar value={stepsToday} max={steps.target} color="var(--s3)" />
          </div>
        </Card>
        <Card tight>
          <Stat label="Cardio esta semana" value={week.minutes} unit="min" foot={`Plan: ~${plan.weeklyMinutesTarget} min · ${week.sessions} sesiones`} />
        </Card>
        <Card tight className="tech">
          <Stat label="FC máxima estimada" value={zones.max} unit="lpm" foot="Tanaka: 208 − 0.7 × edad" />
        </Card>
        <Card tight>
          <div className="field-label mb8">Registrar pasos de hoy</div>
          <StepsInput />
        </Card>
      </div>
      <div className="grid g2 mb16">
        <Card title="Tu plan semanal recomendado">
          <table className="table">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Modalidad</th>
                <th className="right">Duración</th>
                <th className="right">Por semana</th>
              </tr>
            </thead>
            <tbody>
              {plan.sessions.map((s) => (
                <tr key={s.type}>
                  <td>
                    <b>{s.type}</b>
                    <div className="tiny muted">{s.intensity}</div>
                    <div className="tiny muted">{s.notes}</div>
                  </td>
                  <td className="small">{s.modality}</td>
                  <td className="right">{s.minutes} min</td>
                  <td className="right">{s.perWeek}×</td>
                </tr>
              ))}
              <tr>
                <td>
                  <b>Pasos diarios</b>
                  <div className="tiny muted">{steps.reason}</div>
                </td>
                <td className="small">Caminar durante el día</td>
                <td className="right">{fmt(steps.target)}</td>
                <td className="right">diario</td>
              </tr>
            </tbody>
          </table>
          <div className="mt16">
            <Claims items={plan.notes.map((n) => ({ kind: 'recomendacion' as const, text: n }))} />
          </div>
        </Card>
        <Card title="Zonas de frecuencia cardiaca" className="tech">
          {betaBlocker && <Alert kind="warn">Tomas un betabloqueador: las zonas por frecuencia cardiaca no son válidas. Usa la escala de esfuerzo percibido (RPE).</Alert>}
          <table className="table">
            <tbody>
              {zones.zones.map((z) => (
                <tr key={z.key}>
                  <td>
                    <b>{z.label}</b>
                    <div className="tiny muted">{z.desc}</div>
                  </td>
                  <td className="right mono">
                    {z.range[0]}–{z.range[1]} lpm
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="tiny muted mt8">La FC máxima estimada tiene un error de ±10 lpm; ajusta según tu percepción de esfuerzo.</p>
        </Card>
      </div>
      <div className="grid g2">
        <Card title="Registrar sesión de cardio">
          <div className="grid g2">
            <Field label="Fecha">
              <input type="date" className="input" value={f.date} max={today} onChange={(e) => setF({ ...f, date: e.target.value })} />
            </Field>
            <Field label="Modalidad">
              <select className="input" value={f.modality} onChange={(e) => setF({ ...f, modality: e.target.value as CardioModality })}>
                {(Object.keys(MODALITY_LABEL) as CardioModality[]).map((m) => (
                  <option key={m} value={m}>
                    {MODALITY_LABEL[m]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Duración">
              <NumInput value={f.minutes} onChange={(v) => setF({ ...f, minutes: v ?? 0 })} suffix="min" />
            </Field>
            <Field label="Intensidad">
              <select className="input" value={f.intensity} onChange={(e) => setF({ ...f, intensity: e.target.value as CardioLog['intensity'] })}>
                <option value="baja">Baja (zona 2)</option>
                <option value="moderada">Moderada</option>
                <option value="alta">Alta</option>
                <option value="intervalos" disabled={!plan.hiitAllowed}>
                  Intervalos {plan.hiitAllowed ? '' : '(requiere valoración)'}
                </option>
              </select>
            </Field>
            <Field label="FC promedio (opcional)">
              <NumInput value={f.avg_hr} onChange={(v) => setF({ ...f, avg_hr: v })} suffix="lpm" />
            </Field>
            <Field label="Distancia (opcional)">
              <NumInput value={f.distance_km} onChange={(v) => setF({ ...f, distance_km: v })} suffix="km" step={0.1} />
            </Field>
            <Field label="Esfuerzo percibido (1–10)">
              <NumInput value={f.rpe} onChange={(v) => setF({ ...f, rpe: v })} min={1} max={10} />
            </Field>
            <Field label="kcal del reloj/máquina (opcional)" help="Solo como referencia; no se suma a tus calorías.">
              <NumInput value={f.device_kcal} onChange={(v) => setF({ ...f, device_kcal: v })} />
            </Field>
          </div>
          {est != null && <p className="small muted mt8">Gasto estimado por MET: ≈ {est} kcal (orientativo, error amplio; no modifica tu objetivo de comida).</p>}
          <button className="btn primary mt16" onClick={save} data-testid="cardio-save">
            <Plus /> Registrar
          </button>
        </Card>
        <Card title="Pasos de los últimos 14 días">
          <SimpleBars data={last14} x="date" y="steps" name="Pasos" xFmt={(d) => formatDateShort(String(d))} height={220} color="var(--s3)" />
        </Card>
      </div>
      <Card title="Historial de cardio" className="mt16">
        <table className="table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Modalidad</th>
              <th className="right">Min</th>
              <th>Intensidad</th>
              <th className="right">FC</th>
              <th className="right">RPE</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {[...data.cardioLogs]
              .sort((a, b) => b.date.localeCompare(a.date))
              .slice(0, 50)
              .map((c) => (
                <tr key={c.id}>
                  <td>{formatDateShort(c.date)}</td>
                  <td>{MODALITY_LABEL[c.modality]}</td>
                  <td className="right">{c.minutes}</td>
                  <td>{c.intensity}</td>
                  <td className="right">{c.avg_hr ?? '—'}</td>
                  <td className="right">{c.rpe ?? '—'}</td>
                  <td className="right">
                    <button
                      className="btn ghost icon sm"
                      onClick={async () => {
                        await api.remove('cardio_logs', c.id);
                        await reload();
                      }}
                    >
                      <Trash2 />
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        {!data.cardioLogs.length && <p className="muted small">Sin sesiones registradas.</p>}
      </Card>
    </div>
  );
}
