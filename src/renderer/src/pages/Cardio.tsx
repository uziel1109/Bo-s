import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Hero } from '../components/visual';
import { useApp } from '../store';
import { Alert, Card, Claims, DetailsHint, Field, fmt, NumInput, Stat, Bar } from '../components/ui';
import { SimpleBars } from '../components/charts';
import { StepsInput } from '../components/QuickLogs';
import { cardioPlan, estimateCardioKcal, heartRateZones, MODALITY_LABEL, stepsTarget, weeklyCardioSummary } from '@shared/cardio/cardio';
import type { CardioLog, CardioModality } from '@shared/types';
import { addDays, dateRange, formatDateShort, uid } from '@shared/utils';
import { api } from '../api';
import { withBonus } from '../store';
import { takePendingDate } from '../lib/pendingDate';

export function Cardio() {
  const { data, state: st, profile, today, reload, toast, settings } = useApp();
  const plan = cardioPlan(profile, st.flags);
  const zones = heartRateZones(profile.age);
  const steps = withBonus(stepsTarget(data.stepsLogs, today), settings.steps_bonus);
  const stepsToday = data.stepsLogs.find((s) => s.date === today)?.steps ?? 0;
  const week = weeklyCardioSummary(data.cardioLogs, today);
  const [f, setF] = useState<Partial<CardioLog>>(() => ({ date: takePendingDate('cardio') ?? today, modality: 'caminata', minutes: 30, intensity: 'baja' }));
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
      <Hero module="cardio" title="Cardio y actividad diaria" sub="Muévete todos los días; el cardio es un complemento." />
      <div className="grid g2 mb16">
        <Card tight>
          <Stat label="Pasos hoy" value={fmt(stepsToday)} foot={`Meta: ${fmt(steps.target)}`} />
          <div className="mt8 mb12">
            <Bar value={stepsToday} max={steps.target} color="var(--s3)" />
          </div>
          <StepsInput />
        </Card>
        <Card tight>
          <Stat label="Cardio esta semana" value={week.minutes} unit="min" foot={`Meta: ~${plan.weeklyMinutesTarget} min · ${week.sessions} sesiones`} />
          <div className="mt8">
            <Bar value={week.minutes} max={plan.weeklyMinutesTarget} color="var(--m-pink)" />
          </div>
        </Card>
      </div>
      <Card title="Tu plan semanal" className="mb16">
        <div className="plan-tiles">
          <div className="plan-tile" style={{ ['--pc' as string]: 'var(--m-lime)' }}>
            <div className="plan-tile-title">Pasos diarios</div>
            <div className="plan-tile-value mono">{fmt(steps.target)}</div>
            <div className="tiny muted">todos los días</div>
          </div>
          {plan.sessions.map((s) => (
            <div key={s.type} className="plan-tile" style={{ ['--pc' as string]: s.type.startsWith('Intervalos') ? 'var(--m-orange)' : 'var(--m-pink)' }}>
              <div className="plan-tile-title">{s.type.startsWith('LISS') ? 'Cardio suave' : s.type}</div>
              <div className="plan-tile-value mono">
                {s.minutes} min <span className="muted" style={{ fontSize: 14 }}>× {s.perWeek}/sem</span>
              </div>
              <div className="tiny muted">{s.modality}</div>
              <div className="tiny muted tech mt4">
                {s.intensity}. {s.notes}
              </div>
            </div>
          ))}
        </div>
        <p className="small muted mt12">Cardio suave = puedes hablar en frases completas mientras lo haces.</p>
        <div className="mt12 tech">
          <p className="tiny muted mb8">{steps.reason}</p>
          <Claims items={plan.notes.map((n) => ({ kind: 'recomendacion' as const, text: n }))} />
        </div>
        <DetailsHint what="intensidad, zonas cardiacas y notas" />
      </Card>
      <Card title="Zonas de frecuencia cardiaca" className="tech mb16">
        <p className="small muted mb8">FC máxima estimada: {zones.max} lpm (Tanaka: 208 − 0.7 × edad; error ±10 lpm).</p>
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
      </Card>
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
          </div>
          <details className="mt12">
            <summary className="small muted" style={{ cursor: 'pointer' }}>Más datos (opcional)</summary>
            <div className="grid g2 mt8">
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
          </details>
          {est != null && <p className="small muted mt8 tech">Gasto estimado por MET: ≈ {est} kcal (orientativo, error amplio; no modifica tu objetivo de comida).</p>}
          <button className="btn primary mt16" onClick={save} data-testid="cardio-save">
            <Plus /> Registrar
          </button>
        </Card>
        <Card title="Pasos de los últimos 14 días">
          <SimpleBars data={last14} x="date" y="steps" name="Pasos" xFmt={(d) => formatDateShort(String(d))} height={220} color="var(--s3)" />
        </Card>
      </div>
      {data.cardioLogs.length > 0 && <Card title="Historial de cardio" className="mt16">
        <table className="table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Modalidad</th>
              <th className="right">Min</th>
              <th>Intensidad</th>
              <th className="right tech">FC</th>
              <th className="right tech">RPE</th>
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
                  <td className="right tech">{c.avg_hr ?? '—'}</td>
                  <td className="right tech">{c.rpe ?? '—'}</td>
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
      </Card>}
    </div>
  );
}
