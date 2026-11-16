import { useEffect, useMemo, useState } from 'react';
import { Brain, Check, KeyRound, MessageSquare, Send, ShieldCheck, Sparkles, X } from 'lucide-react';
import { Hero } from '../components/visual';
import { useApp } from '../store';
import { Alert, Card, Claims, DetailsHint, Empty, Field, fmt, Stat, Tabs } from '../components/ui';
import { answer, aiContextSummary, matchQuestion, QUESTIONS } from '@shared/assistant/assistant';
import { analyzeAdaptation } from '@shared/analytics/adaptation';
import { buildWeeklyReport } from '@shared/analytics/weeklyReport';
import { adjustTargetsKcal } from '@shared/nutrition/targets';
import { MUSCLE_LABEL, getExercise } from '@shared/training/exercises';
import type { Adjustment, Claim, Muscle } from '@shared/types';
import { addDays, formatDateShort, uid, weekStart } from '@shared/utils';
import { api, isWeb } from '../api';

type Tab = 'asistente' | 'semanal' | 'ajustes' | 'config';

export function AI() {
  const { data } = useApp();
  const pending = data.adjustments.filter((a) => a.status === 'pendiente').length;
  const [tab, setTab] = useState<Tab>(pending ? 'ajustes' : 'asistente');
  return (
    <div className="page">
      <Hero module="ia" title="Inteligencia artificial" sub="Pregúntale a tus datos y revisa cómo te fue en la semana." />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'asistente', label: 'Asistente' },
          { value: 'semanal', label: 'Revisión semanal' },
          { value: 'ajustes', label: `Ajustes propuestos${pending ? ` (${pending})` : ''}` },
          { value: 'config', label: 'Configuración de IA' },
        ]}
      />
      {tab === 'asistente' && <Assistant />}
      {tab === 'semanal' && <Weekly />}
      {tab === 'ajustes' && <Adjustments />}
      {tab === 'config' && <AIConfig />}
    </div>
  );
}

function Assistant() {
  const { data, state: st, toast } = useApp();
  const [q, setQ] = useState<string | null>(null);
  const [free, setFree] = useState('');
  const [cfg, setCfg] = useState<{ enabled: boolean; hasKey: boolean } | null>(null);
  const [chat, setChat] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.aiConfig().then(setCfg).catch(() => setCfg(null));
  }, []);
  const local: Claim[] | null = useMemo(() => (q ? answer(q, data, st) : null), [q, data, st]);
  const llm = cfg?.enabled && cfg.hasKey;

  const ask = async () => {
    const text = free.trim();
    if (!text) return;
    const k = matchQuestion(text);
    if (k) setQ(k);
    if (!llm) {
      if (!k) toast('El asistente local responde las preguntas sugeridas. Activa la IA externa para preguntas libres.', 'error');
      setFree('');
      return;
    }
    setBusy(true);
    const next = [...chat, { role: 'user' as const, content: text }];
    setChat(next);
    setFree('');
    try {
      const r = await api.aiChat(text, aiContextSummary(data, st), chat);
      setChat([...next, { role: 'assistant', content: r }]);
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid g2">
      <Card title="Pregúntale a tus datos" icon={<Brain />}>
        <div className="col">
          {QUESTIONS.map((x) => (
            <button key={x.key} className="list-item" style={{ cursor: 'pointer', textAlign: 'left', color: 'inherit', font: 'inherit', borderColor: q === x.key ? 'var(--accent)' : undefined }} onClick={() => setQ(x.key)} data-testid={`q-${x.key}`}>
              <MessageSquare size={16} />
              {x.question}
            </button>
          ))}
        </div>
        <div className="row nowrap mt16">
          <input className="input" placeholder={llm ? 'Escribe cualquier pregunta…' : 'Escribe tu pregunta (p. ej., ¿por qué no bajo?)'} value={free} onChange={(e) => setFree(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ask()} />
          <button className="btn primary" onClick={ask} disabled={busy}>
            <Send />
          </button>
        </div>
        <p className="tiny muted mt8">{llm ? 'IA externa activada: las preguntas libres se envían junto con el resumen de datos que puedes ver en Configuración de IA.' : 'Modo local: respuestas calculadas en tu equipo, sin conexión.'}</p>
      </Card>
      <div className="col" style={{ gap: 16 }}>
        <Card title={q ? QUESTIONS.find((x) => x.key === q)?.question : 'Respuesta'} icon={<Sparkles />} hint="Asistente local">
          {local ? <Claims items={local} /> : <Empty>Elige una pregunta.</Empty>}
        </Card>
        {chat.length > 0 && (
          <Card title="Conversación con la IA externa" hint="Puede equivocarse: verifica con tus datos">
            <div className="chat">
              {chat.map((m, i) => (
                <div key={i} className={`bubble ${m.role === 'user' ? 'me' : 'bot'}`}>
                  {m.content}
                </div>
              ))}
              {busy && <div className="bubble bot muted">Pensando…</div>}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function Weekly() {
  const { data, state: st, today, reload, toast } = useApp();
  const [ws, setWs] = useState(weekStart(addDays(today, -7)));
  const r = useMemo(() => buildWeeklyReport(data, st, ws), [data, st, ws]);
  const sign = (n: number | null, d = 1) => (n == null ? '—' : `${n > 0 ? '+' : ''}${fmt(n, d)}`);
  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="row between">
        <div className="row">
          <button className="btn sm" onClick={() => setWs(addDays(ws, -7))}>
            ←
          </button>
          <b>
            Semana del {formatDateShort(r.weekStart)} al {formatDateShort(r.weekEnd)}
          </b>
          <button className="btn sm" onClick={() => setWs(addDays(ws, 7))} disabled={addDays(ws, 7) > today}>
            →
          </button>
        </div>
        <button
          className="btn sm ghost"
          onClick={async () => {
            await api.upsert('weekly_reports', { id: `wr_${r.weekStart}`, week_start: r.weekStart, created_at: new Date().toISOString(), data: r });
            await reload();
            toast('Informe guardado en tu historial.');
          }}
        >
          Guardar informe
        </button>
      </div>
      {(() => {
        const logged = r.calories.loggedDays;
        const ratio = (a: number, b: number) => (b > 0 ? a / b : null);
        const tone = (x: number | null, good = 0.8, ok = 0.5) => (x == null ? 'none' : x >= good ? 'good' : x >= ok ? 'ok' : 'bad');
        const tiles: { label: string; value: string; foot: string; tone: string }[] = [
          { label: 'Peso', value: r.weightDiff == null ? '—' : `${sign(r.weightDiff, 1)} kg`, foot: r.avgWeight ? `Promedio ${fmt(r.avgWeight, 1)} kg` : 'Sin pesajes', tone: r.weightDiff == null ? 'none' : r.weightDiff < 0 ? 'good' : r.weightDiff <= 0.2 ? 'ok' : 'bad' },
          { label: 'Cintura', value: r.waistDiff == null ? '—' : `${sign(r.waistDiff)} cm`, foot: r.waistAvg ? `${fmt(r.waistAvg, 1)} cm` : 'Sin medición', tone: r.waistDiff == null ? 'none' : r.waistDiff <= 0 ? 'good' : 'bad' },
          { label: 'Calorías en objetivo', value: `${r.calories.daysWithin10pct} de 7`, foot: logged ? `${logged} días registrados` : 'Sin registros', tone: tone(ratio(r.calories.daysWithin10pct, 7), 0.7, 0.4) },
          { label: 'Proteína cumplida', value: `${r.macros.proteinDaysOk} de 7`, foot: r.macros.proteinAvg != null ? `Promedio ${fmt(r.macros.proteinAvg)} g` : '—', tone: tone(ratio(r.macros.proteinDaysOk, 7), 0.7, 0.4) },
          { label: 'Entrenamientos', value: `${r.strength.sessionsDone} de ${r.strength.sessionsPlanned}`, foot: r.strength.prs.length ? `${r.strength.prs.length} récord${r.strength.prs.length > 1 ? 's' : ''}` : 'Sin récords nuevos', tone: tone(ratio(r.strength.sessionsDone, r.strength.sessionsPlanned), 0.99, 0.6) },
          { label: 'Pasos', value: fmt(r.activity.stepsAvg), foot: 'promedio por día', tone: r.activity.stepsAvg == null ? 'none' : r.activity.stepsAvg >= 8000 ? 'good' : r.activity.stepsAvg >= 6000 ? 'ok' : 'bad' },
        ];
        const recs = [...r.proposals.map((p) => `${p.title} (confírmalo en Ajustes propuestos)`), ...r.claims.filter((c) => c.kind === 'recomendacion').map((c) => c.text)];
        const good = tiles.filter((t) => t.tone === 'good').length;
        const headline = r.weightDiff == null ? 'Registra tu peso para ver cómo vas.' : `${r.weightDiff < 0 ? `Bajaste ${fmt(Math.abs(r.weightDiff), 1)} kg` : r.weightDiff > 0 ? `Subiste ${fmt(r.weightDiff, 1)} kg` : 'Peso estable'} y ${good} de ${tiles.length} hábitos van bien.`;
        return (
          <>
            <div className="week-verdict" data-testid="weekly-verdict">
              <Sparkles size={18} /> {headline}
            </div>
            <div className="score-grid">
              {tiles.map((t) => (
                <div key={t.label} className={`score-tile ${t.tone}`}>
                  <div className="tiny muted">{t.label}</div>
                  <div className="score-value mono">{t.value}</div>
                  <div className="tiny muted">{t.foot}</div>
                </div>
              ))}
            </div>
            <Card title="Para la próxima semana">
              {recs.length === 0 ? (
                <p className="small muted">Sigue igual: no hay cambios que recomendar.</p>
              ) : (
                <ol className="small rec-list">
                  {recs.slice(0, 3).map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ol>
              )}
              <p className="small muted mt8">
                Recuperación: <b>{r.recovery.label}</b>
                {r.recovery.sleepAvg != null && <> · {fmt(r.recovery.sleepAvg, 1)} h de sueño</>}
              </p>
              <DetailsHint what="análisis completo, hidratación y recuperación" />
            </Card>
            <Card title="Análisis completo" className="tech">
              <p className="small muted mb8">
                Hidratación {fmt(r.hydration.avgMl)} ml/día ({r.hydration.daysOk} días ≥80 % de {fmt(r.hydration.target)} ml) · Cardio {r.activity.cardioMin} min en {r.activity.cardioSessions} sesiones · Calorías promedio {fmt(r.calories.avg)} / {fmt(r.calories.target)} kcal · C {fmt(r.macros.carbsAvg)} g · G {fmt(r.macros.fatAvg)} g · Sueño {fmt(r.recovery.sleepAvg, 1)} h, calidad {fmt(r.recovery.sleepQuality, 1)}/5, energía {fmt(r.recovery.energy, 1)}/5, dolor {fmt(r.recovery.soreness, 1)}/5
              </p>
              <Claims items={r.claims} />
            </Card>
          </>
        );
      })()}
    </div>
  );
}

function Adjustments() {
  const { data, state: st, today, reload, toast, routineId, activatePlan, settings, setSetting } = useApp();
  const analysis = useMemo(() => analyzeAdaptation(data, st, today), [data, st, today]);
  const pending = data.adjustments.filter((a) => a.status === 'pendiente');
  const history = data.adjustments.filter((a) => a.status !== 'pendiente');
  const fresh = analysis.proposals.filter((p) => !pending.some((x) => x.kind === p.kind));

  // Las propuestas nuevas se guardan como pendientes (nunca se aplican solas).
  useEffect(() => {
    if (!fresh.length) return;
    (async () => {
      for (const p of fresh) await api.upsert('adjustments', { ...p, id: uid('adj_'), created_at: new Date().toISOString(), status: 'pendiente', resolved_at: null });
      await reload();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fresh.length]);

  const resolve = async (a: Adjustment, accept: boolean) => {
    if (accept) {
      const pl = a.payload as Record<string, unknown>;
      if (a.kind === 'calorias' && typeof pl.newKcal === 'number') {
        await activatePlan({ scenario: data.profile.scenario, targets: adjustTargetsKcal(st.targets, pl.newKcal, a.title), reason: a.title });
      } else if (a.kind === 'actividad' && typeof pl.stepsDelta === 'number') {
        await setSetting('steps_bonus', Number(settings.steps_bonus ?? 0) + pl.stepsDelta);
      } else if (a.kind === 'volumen' && data.routine && routineId) {
        const r = structuredClone(data.routine);
        let left = Number(pl.addSets ?? 2);
        for (const d of r.days)
          for (const e of d.exercises)
            if (left > 0 && getExercise(e.exerciseId)?.primary === (pl.muscle as Muscle)) {
              e.sets += 1;
              left--;
            }
        r.weeklySets[pl.muscle as Muscle] = (r.weeklySets[pl.muscle as Muscle] ?? 0) + Number(pl.addSets ?? 2) - left;
        await api.upsert('routines', { id: routineId, created_at: new Date().toISOString(), active: 1, data: { ...r, id: undefined } });
      }
    }
    await api.upsert('adjustments', { ...a, status: accept ? 'aceptado' : 'rechazado', resolved_at: new Date().toISOString() });
    await reload();
    toast(accept ? 'Ajuste aplicado a tu plan.' : 'Propuesta rechazada. No se modificó nada.');
  };

  return (
    <div className="col" style={{ gap: 16 }}>
      <Alert kind="info">
        BODY OS analiza al menos 3 semanas de peso promedio, cintura, registro de comida, actividad y fuerza antes de sugerir cambios. Nunca modifica tu plan sin tu confirmación ni reacciona a fluctuaciones de 1–2 días.
      </Alert>
      <div className="grid g4">
        <Card tight>
          <Stat label="Ritmo (3 semanas)" value={analysis.metrics.ratePctPerWeek != null ? `${analysis.metrics.ratePctPerWeek}` : '—'} unit="%/sem" />
        </Card>
        <Card tight>
          <Stat label="Cintura (~3 semanas)" value={analysis.metrics.waistChange3w != null ? fmt(analysis.metrics.waistChange3w, 1) : '—'} unit="cm" />
        </Card>
        <Card tight>
          <Stat label="Días con registro completo" value={`${Math.round(analysis.metrics.logCoverage * 100)}`} unit="%" />
        </Card>
        <Card tight>
          <Stat label="Días con el plan actual" value={analysis.metrics.daysOnPlan} />
        </Card>
      </div>
      <h2>Pendientes de tu decisión</h2>
      {!pending.length && <Empty>No hay ajustes pendientes. Tu plan actual sigue siendo adecuado con los datos disponibles.</Empty>}
      {pending.map((a) => (
        <Card key={a.id} title={a.title} hint={`Propuesto el ${formatDateShort(a.created_at.slice(0, 10))}`} actions={<span className="badge accent">{a.kind}</span>}>
          <h4 className="mb8">Justificación</h4>
          <Claims items={a.justification.map((j) => ({ kind: 'dato' as const, text: j }))} />
          {a.kind === 'calorias' && typeof (a.payload as { newKcal?: number }).newKcal === 'number' && (
            <p className="small mt8">
              Nuevo objetivo: <b>{fmt((a.payload as { newKcal: number }).newKcal)} kcal</b> (actual {fmt(st.targets.kcal)} kcal). La proteína no cambia.
            </p>
          )}
          <div className="row mt16">
            <button className="btn primary" onClick={() => resolve(a, true)} data-testid="adj-accept">
              <Check /> Aceptar y aplicar
            </button>
            <button className="btn" onClick={() => resolve(a, false)}>
              <X /> Rechazar
            </button>
          </div>
        </Card>
      ))}
      <Card title="Análisis actual">
        <Claims items={analysis.claims} />
      </Card>
      {history.length > 0 && (
        <Card title="Historial de decisiones">
          <table className="table">
            <tbody>
              {history.map((a) => (
                <tr key={a.id}>
                  <td>{formatDateShort((a.resolved_at ?? a.created_at).slice(0, 10))}</td>
                  <td>{a.title}</td>
                  <td>
                    <span className={`badge ${a.status === 'aceptado' ? 'ok' : ''}`}>{a.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function AIConfig() {
  const { data, state: st, toast } = useApp();
  const [cfg, setCfg] = useState<{ enabled: boolean; model: string; hasKey: boolean; secureStorage: boolean } | null>(null);
  const [key, setKey] = useState('');
  const [model, setModel] = useState('');
  const load = () =>
    api.aiConfig().then((c) => {
      setCfg(c);
      setModel(c.model);
    });
  useEffect(() => {
    load();
  }, []);
  if (!cfg) return null;
  return (
    <div className="grid g2">
      <Card title="Integración opcional con Claude (Anthropic)" icon={<KeyRound />}>
        <div className="col" style={{ gap: 14 }}>
          <p className="small">
            Todas las funciones esenciales funcionan sin conexión con el asistente local. Si lo deseas, puedes activar un modelo de lenguaje externo para preguntas libres y para estimar alimentos a partir de una foto.
          </p>
          {!cfg.secureStorage && <Alert kind="warn">El llavero del sistema no está disponible en este equipo, por lo que no es posible guardar una clave API de forma segura.</Alert>}
          <Field label="Clave API" help={isWeb() ? 'En la versión web la clave se guarda en el almacenamiento de este navegador (no hay llavero del sistema disponible) y las consultas salen directamente de este dispositivo a Anthropic. Úsala solo en un dispositivo personal.' : cfg.hasKey ? 'Hay una clave guardada (cifrada con el llavero del sistema). Nunca se muestra ni se incluye en el código.' : 'Se guarda cifrada en este equipo.'}>
            <div className="row nowrap">
              <input className="input" type="password" placeholder={cfg.hasKey ? '••••••••••••' : 'sk-ant-…'} value={key} onChange={(e) => setKey(e.target.value)} />
              <button
                className="btn"
                disabled={!key || !cfg.secureStorage}
                onClick={async () => {
                  try {
                    await api.aiSetKey(key);
                    setKey('');
                    await load();
                    toast('Clave guardada de forma cifrada.');
                  } catch (e) {
                    toast(e instanceof Error ? e.message : String(e), 'error');
                  }
                }}
              >
                Guardar
              </button>
              {cfg.hasKey && (
                <button
                  className="btn danger"
                  onClick={async () => {
                    await api.aiClearKey();
                    await load();
                  }}
                >
                  Borrar
                </button>
              )}
            </div>
          </Field>
          <Field label="Modelo" help="Identificador del modelo de Claude a utilizar.">
            <div className="row nowrap">
              <input className="input" value={model} onChange={(e) => setModel(e.target.value)} />
              <button
                className="btn"
                onClick={async () => {
                  await api.aiSetConfig({ model });
                  await load();
                  toast('Modelo actualizado.');
                }}
              >
                Guardar
              </button>
            </div>
          </Field>
          <label className="row">
            <input
              type="checkbox"
              checked={cfg.enabled}
              disabled={!cfg.hasKey}
              onChange={async (e) => {
                await api.aiSetConfig({ enabled: e.target.checked });
                await load();
              }}
            />
            Activar la IA externa (acepto que se envíe el resumen mostrado a la derecha a Anthropic al hacer una pregunta)
          </label>
        </div>
      </Card>
      <Card title="Qué información se envía" icon={<ShieldCheck />}>
        <ul className="small" style={{ paddingLeft: 18 }}>
          <li>Solo cuando haces una pregunta libre: el texto de tu pregunta y este resumen numérico.</li>
          <li>Nunca se envían tus fotos de progreso, tu nombre, tus medicamentos en texto libre ni tu historial completo.</li>
          <li>Las fotos de comida solo se envían cuando eliges “Foto (IA)” y seleccionas una imagen.</li>
          <li>El proveedor procesa los datos según sus propias políticas; puedes desactivar la integración en cualquier momento.</li>
        </ul>
        <pre className="small" style={{ whiteSpace: 'pre-wrap', background: 'var(--bg-2)', padding: 12, borderRadius: 10, border: '1px solid var(--border)' }}>
          {aiContextSummary(data, st)}
        </pre>
      </Card>
    </div>
  );
}
