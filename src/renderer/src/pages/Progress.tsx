import { useMemo, useState } from 'react';
import { Camera, Flame, Moon, Trash2, Upload } from 'lucide-react';
import { useApp, type PhotoRow } from '../store';
import { Alert, Card, Empty, Field, fmt, PageHead, Seg, Stat, Tabs } from '../components/ui';
import { SimpleLine, WeightTrendChart } from '../components/charts';
import { RecoveryModal } from '../components/QuickLogs';
import { weightTrend, isCompleteDay } from '@shared/analytics/trend';
import { estimateBodyFat } from '@shared/body/composition';
import { bestE1rm, exerciseHistory } from '@shared/training/progression';
import { getExercise } from '@shared/training/exercises';
import type { BodyLog } from '@shared/types';
import { addDays, formatDateShort, round } from '@shared/utils';
import { api, usePhotoUrl } from '../api';

type Tab = 'graficas' | 'fotos' | 'comparar' | 'estadisticas' | 'recuperacion';

export function Progress() {
  const [tab, setTab] = useState<Tab>('graficas');
  return (
    <div className="page">
      <PageHead title="Progreso" sub="Tus datos reales a lo largo del tiempo." />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'graficas', label: 'Gráficas' },
          { value: 'fotos', label: 'Fotos' },
          { value: 'comparar', label: 'Comparar fotos' },
          { value: 'estadisticas', label: 'Estadísticas' },
          { value: 'recuperacion', label: 'Recuperación' },
        ]}
      />
      {tab === 'graficas' && <Charts />}
      {tab === 'fotos' && <Photos />}
      {tab === 'comparar' && <Compare />}
      {tab === 'estadisticas' && <Stats />}
      {tab === 'recuperacion' && <Recovery />}
    </div>
  );
}

const MEASURE_KEYS: { key: keyof BodyLog; label: string }[] = [
  { key: 'waist', label: 'Cintura' },
  { key: 'abdomen', label: 'Abdomen' },
  { key: 'neck', label: 'Cuello' },
  { key: 'chest', label: 'Pecho' },
  { key: 'hip', label: 'Cadera' },
  { key: 'arm', label: 'Brazo' },
  { key: 'thigh', label: 'Muslo' },
  { key: 'calf', label: 'Pantorrilla' },
];

function Charts() {
  const { data, profile, state: st } = useApp();
  const [range, setRange] = useState<'30' | '90' | '365' | 'all'>('90');
  const from = range === 'all' ? '0000' : addDays(st.today, -Number(range));
  const logs = data.bodyLogs.filter((l) => l.date >= from);
  const trend = weightTrend(data.bodyLogs).filter((t) => t.date >= from);
  // Tendencia de % de grasa estimado con las medidas disponibles en cada fecha (arrastrando la última conocida).
  const bfSeries = useMemo(() => {
    let neck = profile.neckCm ?? null;
    let hip = profile.hipCm ?? null;
    let waist = profile.waistCm ?? null;
    const out: { date: string; bf: number }[] = [];
    for (const l of [...data.bodyLogs].sort((a, b) => a.date.localeCompare(b.date))) {
      neck = l.neck ?? neck;
      hip = l.hip ?? hip;
      waist = l.waist ?? waist;
      if (!l.weight) continue;
      const e = estimateBodyFat({ sex: profile.sex, age: profile.age, heightCm: profile.heightCm, weightKg: l.weight, waistCm: waist, neckCm: neck, hipCm: hip, measured: l.bf_percent && l.bf_method ? { value: l.bf_percent, method: l.bf_method } : null });
      out.push({ date: l.date, bf: round(e.value, 1) });
    }
    return out.filter((x) => x.date >= from);
  }, [data.bodyLogs, profile, from]);
  const intake = Array.from(st.intake.values())
    .filter((d) => d.date >= from && isCompleteDay(d))
    .sort((a, b) => a.date.localeCompare(b.date));
  return (
    <div className="col" style={{ gap: 16 }}>
      <Seg value={range} onChange={setRange} options={[{ value: '30', label: '30 días' }, { value: '90', label: '90 días' }, { value: '365', label: '1 año' }, { value: 'all', label: 'Todo' }]} />
      <div className="grid g2">
        <Card title="Peso" hint="Puntos = registros · línea = tendencia">
          <WeightTrendChart data={trend} goal={st.composition.goalWeight} />
        </Card>
        <Card title="% de grasa (estimado)" hint="Navy/RFM/CUN-BAE según medidas disponibles; mediciones si existen">
          <SimpleLine data={bfSeries} dataKey="bf" name="% grasa" unit="%" height={240} color="var(--s2)" />
        </Card>
        <Card title="Proteína diaria (días con registro completo)">
          <SimpleLine data={intake.map((d) => ({ date: d.date, protein: d.protein }))} dataKey="protein" name="Proteína" unit="g" height={220} color="var(--protein)" />
        </Card>
        <Card title="Calorías diarias (días con registro completo)">
          <SimpleLine data={intake.map((d) => ({ date: d.date, kcal: d.kcal }))} dataKey="kcal" name="Calorías" unit="kcal" height={220} />
        </Card>
      </div>
      <h2 className="mt16">Medidas</h2>
      <div className="grid g4">
        {MEASURE_KEYS.map((m) => (
          <Card key={m.key} title={m.label} tight>
            <SimpleLine data={logs.map((l) => ({ date: l.date, v: l[m.key] }))} dataKey="v" name={m.label} unit="cm" height={160} color="var(--s3)" />
          </Card>
        ))}
      </div>
    </div>
  );
}

function Photos() {
  const { photos, today, reload, toast } = useApp();
  const [meta, setMeta] = useState({ date: today, pose: 'frente' as PhotoRow['pose'], light: 'luz natural', time: 'mañana en ayunas', clothing: '', distance: '2 m' });
  const [over, setOver] = useState(false);
  const [pose, setPose] = useState<'todas' | PhotoRow['pose']>('todas');
  const metaObj = () => ({ date: meta.date, pose: meta.pose, conditions: { light: meta.light, time: meta.time, clothing: meta.clothing, distance: meta.distance } });
  const byDate = [...photos].filter((p) => pose === 'todas' || p.pose === pose).sort((a, b) => b.date.localeCompare(a.date));
  const dates = [...new Set(byDate.map((p) => p.date))];
  return (
    <div className="col" style={{ gap: 16 }}>
      <Alert kind="info">Las fotos se guardan cifradas en este equipo, sin ninguna modificación, y nunca se envían a servicios externos.</Alert>
      <Card title="Agregar foto">
        <div className="grid g3">
          <Field label="Fecha">
            <input type="date" className="input" value={meta.date} max={today} onChange={(e) => setMeta({ ...meta, date: e.target.value })} />
          </Field>
          <Field label="Vista">
            <Seg value={meta.pose} onChange={(v) => setMeta({ ...meta, pose: v })} options={[{ value: 'frente', label: 'Frente' }, { value: 'perfil', label: 'Perfil' }, { value: 'espalda', label: 'Espalda' }]} />
          </Field>
          <Field label="Iluminación">
            <input className="input" value={meta.light} onChange={(e) => setMeta({ ...meta, light: e.target.value })} />
          </Field>
          <Field label="Momento">
            <input className="input" value={meta.time} onChange={(e) => setMeta({ ...meta, time: e.target.value })} />
          </Field>
          <Field label="Ropa">
            <input className="input" value={meta.clothing} onChange={(e) => setMeta({ ...meta, clothing: e.target.value })} placeholder="la misma en cada sesión" />
          </Field>
          <Field label="Distancia a la cámara">
            <input className="input" value={meta.distance} onChange={(e) => setMeta({ ...meta, distance: e.target.value })} />
          </Field>
        </div>
        <div
          className={`dropzone mt16 ${over ? 'over' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={async (e) => {
            e.preventDefault();
            setOver(false);
            const files = Array.from(e.dataTransfer.files);
            for (const f of files) {
              try {
                await api.addPhotoFile(f, metaObj());
              } catch (err) {
                toast(err instanceof Error ? err.message : String(err), 'error');
              }
            }
            await reload();
          }}
        >
          <Upload /> Arrastra aquí tus fotos o{' '}
          <button
            className="btn sm"
            onClick={async () => {
              try {
                const r = await api.pickPhoto(metaObj());
                if (r) {
                  await reload();
                  toast('Foto guardada.');
                }
              } catch (err) {
                toast(err instanceof Error ? err.message : String(err), 'error');
              }
            }}
          >
            <Camera /> Seleccionar archivo
          </button>
        </div>
        <p className="tiny muted mt8">Consejo: misma hora, luz, distancia, ropa y postura relajada para que las comparaciones sean consistentes.</p>
      </Card>
      <Seg value={pose} onChange={setPose} options={[{ value: 'todas', label: 'Todas' }, { value: 'frente', label: 'Frente' }, { value: 'perfil', label: 'Perfil' }, { value: 'espalda', label: 'Espalda' }]} />
      {!dates.length && <Empty>Aún no hay fotos.</Empty>}
      {dates.map((d) => (
        <div key={d}>
          <h3 className="mb8">{formatDateShort(d)}</h3>
          <div className="photo-grid">
            {byDate
              .filter((p) => p.date === d)
              .map((p) => (
                <div className="photo" key={p.id}>
                  <PhotoImg file={p.file_name} alt={`${p.pose} ${p.date}`} />
                  <div className="cap row between">
                    <span className="cap-first">{p.pose}</span>
                    <button
                      className="btn ghost icon sm"
                      style={{ color: '#fff' }}
                      onClick={async () => {
                        if (!confirm('¿Eliminar esta foto de forma permanente?')) return;
                        await api.remove('photos', p.id);
                        await reload();
                      }}
                    >
                      <Trash2 />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Compare() {
  const { photos, data } = useApp();
  const dates = [...new Set(photos.map((p) => p.date))].sort();
  const [a, setA] = useState(dates[0] ?? '');
  const [b, setB] = useState(dates[dates.length - 1] ?? '');
  const [pose, setPose] = useState<PhotoRow['pose']>('frente');
  if (dates.length < 2) return <Empty>Necesitas fotos de al menos dos fechas para compararlas.</Empty>;
  const pa = photos.find((p) => p.date === a && p.pose === pose);
  const pb = photos.find((p) => p.date === b && p.pose === pose);
  const wa = data.bodyLogs.find((l) => l.date <= a && l.weight && l.date >= addDays(a, -3));
  const wb = data.bodyLogs.find((l) => l.date <= b && l.weight && l.date >= addDays(b, -3));
  const cond = (p?: PhotoRow) => (p?.conditions ? Object.values(p.conditions).filter(Boolean).join(' · ') : '');
  const mismatch = pa && pb && JSON.stringify(pa.conditions) !== JSON.stringify(pb.conditions);
  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="row">
        <select className="input" style={{ width: 180 }} value={a} onChange={(e) => setA(e.target.value)}>
          {dates.map((d) => (
            <option key={d} value={d}>
              {formatDateShort(d)}
            </option>
          ))}
        </select>
        <span className="muted">vs</span>
        <select className="input" style={{ width: 180 }} value={b} onChange={(e) => setB(e.target.value)}>
          {dates.map((d) => (
            <option key={d} value={d}>
              {formatDateShort(d)}
            </option>
          ))}
        </select>
        <Seg value={pose} onChange={setPose} options={[{ value: 'frente', label: 'Frente' }, { value: 'perfil', label: 'Perfil' }, { value: 'espalda', label: 'Espalda' }]} />
      </div>
      {mismatch && <Alert kind="warn">Las condiciones de las fotos no coinciden (luz, hora, ropa o distancia). La comparación puede ser engañosa.</Alert>}
      <div className="grid g2">
        {[
          { p: pa, d: a, w: wa },
          { p: pb, d: b, w: wb },
        ].map(({ p, d, w }, i) => (
          <Card key={i} title={formatDateShort(d)} hint={w?.weight ? `${fmt(w.weight, 1)} kg${w.waist ? ` · cintura ${fmt(w.waist, 1)} cm` : ''}` : undefined}>
            {p ? (
              <div className="photo" style={{ aspectRatio: '3/4' }}>
                <PhotoImg file={p.file_name} alt={`${pose} ${d}`} />
              </div>
            ) : (
              <Empty>Sin foto de {pose} en esta fecha.</Empty>
            )}
            <p className="tiny muted mt8">{cond(p)}</p>
          </Card>
        ))}
      </div>
      <p className="small muted">Las imágenes se muestran sin alteraciones. BODY OS no interpreta ni modifica tus fotos.</p>
    </div>
  );
}

function Stats() {
  const { data, state: st, today, calendarTasks } = useApp();
  const first = [...data.bodyLogs].filter((l) => l.weight).sort((a, b) => a.date.localeCompare(b.date))[0];
  const waistLogs = data.bodyLogs.filter((l) => l.waist).sort((a, b) => a.date.localeCompare(b.date));
  const days = Array.from(st.intake.values()).filter(isCompleteDay).map((d) => d!.date);
  // Racha de días con comida registrada (hasta hoy o ayer)
  let streak = 0;
  for (let d = st.intake.has(today) ? today : addDays(today, -1); days.includes(d); d = addDays(d, -1)) streak++;
  let weighStreak = 0;
  for (let d = data.bodyLogs.some((l) => l.date === today && l.weight) ? today : addDays(today, -1); data.bodyLogs.some((l) => l.date === d && l.weight); d = addDays(d, -1)) weighStreak++;
  const sessions = data.sessions.filter((s) => s.completed);
  const ids = [...new Set(sessions.flatMap((s) => s.exercises.map((e) => e.exerciseId)))];
  const strength = ids
    .map((id) => {
      const h = exerciseHistory(sessions, id);
      if (h.length < 2) return null;
      const a = bestE1rm(h[0].log.sets);
      const b = bestE1rm(h[h.length - 1].log.sets);
      return { id, name: getExercise(id)?.name ?? id, a, b, pct: a ? ((b - a) / a) * 100 : 0 };
    })
    .filter(Boolean) as { id: string; name: string; a: number; b: number; pct: number }[];
  const done = calendarTasks.filter((t) => t.done).length;
  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="grid g4">
        <Card tight>
          <Stat label="Peso inicial" value={fmt(first?.weight ?? st.initialWeight, 1)} unit="kg" foot={first ? formatDateShort(first.date) : ''} />
        </Card>
        <Card tight>
          <Stat label="Peso actual" value={fmt(st.currentWeight, 1)} unit="kg" foot={`Tendencia ${fmt(st.trendWeight, 1)} kg`} />
        </Card>
        <Card tight>
          <Stat label="Diferencia" value={`${st.currentWeight - st.initialWeight > 0 ? '+' : ''}${fmt(st.currentWeight - st.initialWeight, 1)}`} unit="kg" />
        </Card>
        <Card tight>
          <Stat label="Cambio de cintura" value={waistLogs.length >= 2 ? `${fmt((waistLogs[waistLogs.length - 1].waist as number) - (waistLogs[0].waist as number), 1)}` : '—'} unit="cm" />
        </Card>
        <Card tight>
          <Stat label="% grasa: inicio → ahora (est.)" value={`${fmt(st.initialComposition.bf.value, 1)} → ${fmt(st.composition.bf.value, 1)}`} unit="%" />
        </Card>
        <Card tight>
          <Stat icon={<Flame size={14} />} label="Racha de registro de comida" value={streak} unit="días" />
        </Card>
        <Card tight>
          <Stat icon={<Flame size={14} />} label="Racha de pesajes" value={weighStreak} unit="días" />
        </Card>
        <Card tight>
          <Stat label="Sesiones completadas" value={sessions.length} foot={`${done} actividades marcadas en el calendario`} />
        </Card>
      </div>
      <Card title="Evolución de fuerza (1RM estimado: primera vs última sesión)">
        {strength.length ? (
          <table className="table">
            <thead>
              <tr>
                <th>Ejercicio</th>
                <th className="right">Inicio</th>
                <th className="right">Actual</th>
                <th className="right">Cambio</th>
              </tr>
            </thead>
            <tbody>
              {strength.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td className="right">{fmt(s.a, 1)} kg</td>
                  <td className="right">{fmt(s.b, 1)} kg</td>
                  <td className="right">
                    <b className={s.pct >= 0 ? 'delta-down' : 'delta-up'}>
                      {s.pct > 0 ? '+' : ''}
                      {fmt(s.pct, 1)} %
                    </b>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty>Se necesitan al menos 2 sesiones por ejercicio.</Empty>
        )}
      </Card>
    </div>
  );
}

function Recovery() {
  const { data } = useApp();
  const [open, setOpen] = useState(false);
  const logs = [...data.recoveryLogs].sort((a, b) => a.date.localeCompare(b.date));
  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="row">
        <button className="btn primary" onClick={() => setOpen(true)}>
          <Moon /> Registrar recuperación de hoy
        </button>
      </div>
      <div className="grid g2">
        <Card title="Horas de sueño">
          <SimpleLine data={logs.map((l) => ({ date: l.date, v: l.sleep_hours }))} dataKey="v" name="Sueño" unit="h" />
        </Card>
        <Card title="Energía (1–5)">
          <SimpleLine data={logs.map((l) => ({ date: l.date, v: l.energy }))} dataKey="v" name="Energía" color="var(--s3)" />
        </Card>
      </div>
      {open && <RecoveryModal onClose={() => setOpen(false)} />}
      <p className="small muted">Dormir 7–9 h es uno de los factores más importantes para conservar músculo en déficit.</p>
    </div>
  );
}

function PhotoImg({ file, alt }: { file: string; alt: string }) {
  const src = usePhotoUrl(file);
  return src ? <img src={src} alt={alt} loading="lazy" /> : <div className="empty" style={{ height: '100%' }}>Cargando…</div>;
}
