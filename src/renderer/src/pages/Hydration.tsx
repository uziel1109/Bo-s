import { useState } from 'react';
import { Droplets, Plus, Trash2 } from 'lucide-react';
import { Hero } from '../components/visual';
import { useApp } from '../store';
import { Alert, Card, Claims, fmt, NumInput, Ring, Seg, Stat } from '../components/ui';
import { SimpleBars } from '../components/charts';
import { hourlyDistribution, QUICK_AMOUNTS, hydrationTarget } from '@shared/hydration/hydration';
import { addDays, uid } from '@shared/utils';
import { api } from '../api';

export function Hydration() {
  const { data, state: st, profile, today, reload, toast } = useApp();
  const [custom, setCustom] = useState<number | null>(null);
  const [day, setDay] = useState(today);
  const [ctx, setCtx] = useState<'general' | 'entreno'>('general');
  const [trainMin, setTrainMin] = useState<number | null>(null);
  const h = trainMin != null ? hydrationTarget({ ...profile, weightKg: st.currentWeight }, trainMin, st.flags) : st.hydration;
  const logs = data.waterLogs.filter((w) => w.date === day).sort((a, b) => a.time.localeCompare(b.time));
  const total = logs.reduce((a, w) => a + w.ml, 0);
  const remaining = Math.max(0, h.totalMl - total);

  const add = async (ml: number) => {
    if (!ml || ml <= 0 || ml > 3000) return toast('Cantidad inválida.', 'error');
    const now = new Date();
    const time = day === today ? `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}` : '12:00';
    await api.upsert('water_logs', { id: uid('w_'), date: day, time, ml, context: ctx });
    await reload();
  };

  return (
    <div className="page">
      <Hero module="hidratacion" title="Hidratación" sub="Una guía orientativa, no una cantidad obligatoria." />
      <div className="row mb16" style={{ gap: 8 }}>
        <span className="small muted">Día:</span>
        <Seg value={day === today ? 'hoy' : day === addDays(today, -1) ? 'ayer' : 'otro'} onChange={(v) => v !== 'otro' && setDay(v === 'hoy' ? today : addDays(today, -1))} options={[{ value: 'hoy', label: 'Hoy' }, { value: 'ayer', label: 'Ayer' }, { value: 'otro', label: 'Otra fecha' }]} />
        <input type="date" className="input" style={{ width: 170 }} value={day} max={today} onChange={(e) => e.target.value && setDay(e.target.value)} data-testid="water-day" />
      </div>
      {h.restricted && (
        <div className="mb16">
          <Alert kind="warn">Tienes una condición o indicación médica que limita los líquidos: sigue la cifra de tu médico.</Alert>
        </div>
      )}
      <div className="grid g3 mb16">
        <Card>
          <div className="row nowrap" style={{ gap: 20 }}>
            <Ring value={total} max={h.totalMl} size={140} color="var(--water)">
              <div>
                <Droplets color="var(--water)" size={18} />
                <div className="mono" style={{ fontSize: 22, fontWeight: 700 }} data-testid="water-total">
                  {fmt(total)}
                </div>
                <div className="tiny muted">de {fmt(h.totalMl)} ml</div>
              </div>
            </Ring>
            <div className="col">
              <Stat label="Restante orientativo" value={fmt(remaining)} unit="ml" />
            </div>
          </div>
        </Card>
        <Card title="Registrar">
          <div className="row mb8">
            <div className="seg">
              <button className={ctx === 'general' ? 'on' : ''} onClick={() => setCtx('general')}>
                General
              </button>
              <button className={ctx === 'entreno' ? 'on' : ''} onClick={() => setCtx('entreno')}>
                Durante el entreno
              </button>
            </div>
          </div>
          <div className="row">
            {QUICK_AMOUNTS.map((q) => (
              <button key={q.ml} className="btn" onClick={() => add(q.ml)} data-testid={`water-${q.ml}`}>
                <Plus /> {q.label} · {q.ml} ml
              </button>
            ))}
          </div>
          <div className="row nowrap mt16">
            <NumInput value={custom} onChange={setCustom} suffix="ml" placeholder="Cantidad personalizada" />
            <button className="btn primary" onClick={() => custom && add(custom)}>
              Agregar
            </button>
          </div>
        </Card>
        <Card title="Cómo se calcula" className="tech">
          <table className="table">
            <tbody>
              <tr>
                <td>Base (EFSA, ajustada por peso; ~80 % del agua total viene de bebidas)</td>
                <td className="right mono">{fmt(h.baseMl)} ml</td>
              </tr>
              <tr>
                <td>Entrenamiento ({profile.sweatLevel === 'alto' ? 'sudoración alta' : profile.sweatLevel === 'medio' ? 'sudoración media' : 'sudoración baja'})</td>
                <td className="right mono">+{fmt(h.exerciseMl)} ml</td>
              </tr>
              <tr>
                <td>Calor ({profile.ambientTempC} °C)</td>
                <td className="right mono">+{fmt(h.heatMl)} ml</td>
              </tr>
            </tbody>
          </table>
          <div className="row nowrap mt8 small">
            <span className="muted">Minutos de entreno hoy:</span>
            <div style={{ width: 120 }}>
              <NumInput value={trainMin} onChange={setTrainMin} suffix="min" placeholder="auto" />
            </div>
          </div>
        </Card>
      </div>
      <div className="grid g2">
        <Card title="Distribución por hora">
          <SimpleBars data={hourlyDistribution(data.waterLogs, today).filter((x) => x.hour >= 5)} x="hour" y="ml" name="Agua" unit="ml" xFmt={(v) => `${v}h`} color="var(--water)" />
        </Card>
        <Card title="Registro de hoy">
          <table className="table">
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="mono">{l.time}</td>
                  <td>{l.context === 'entreno' ? 'Durante el entrenamiento' : 'General'}</td>
                  <td className="right mono">{l.ml} ml</td>
                  <td className="right">
                    <button
                      className="btn ghost icon sm"
                      onClick={async () => {
                        await api.remove('water_logs', l.id);
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
          {!logs.length && <p className="muted small">Sin registros hoy.</p>}
        </Card>
      </div>
      <Card title="Electrolitos y recomendaciones" className="mt16">
        <Claims items={[{ kind: h.electrolytes.recommended ? 'recomendacion' : 'dato', text: h.electrolytes.reason }, ...h.notes.map((n) => ({ kind: 'recomendacion' as const, text: n }))]} />
      </Card>
    </div>
  );
}
