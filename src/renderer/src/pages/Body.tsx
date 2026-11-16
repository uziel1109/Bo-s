import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useApp } from '../store';
import { Alert, Card, Claims, fmt, PageHead, Seg, Stat, Tabs } from '../components/ui';
import { ScenarioChart } from '../components/charts';
import { BodyLogModal } from '../components/QuickLogs';
import { METHOD_LABEL, METHOD_ERROR, ACTIVITY_BASE } from '@shared/body/composition';
import { SCENARIOS } from '@shared/body/projection';
import { LIMITATIONS } from '@shared/references';
import type { ScenarioKey } from '@shared/types';
import { addDays, formatDateShort } from '@shared/utils';
import { calculateTargets } from '@shared/nutrition/targets';
import { api } from '../api';

type Tab = 'composicion' | 'medidas' | 'simulador';

export function Body() {
  const [tab, setTab] = useState<Tab>('composicion');
  return (
    <div className="page">
      <PageHead title="Mi cuerpo" sub="Composición corporal, medidas y simulador de transformación." />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'composicion', label: 'Composición' }, { value: 'medidas', label: 'Medidas' }, { value: 'simulador', label: 'Simulador' }]} />
      {tab === 'composicion' && <Composition />}
      {tab === 'medidas' && <Measures />}
      {tab === 'simulador' && <Simulator />}
    </div>
  );
}

function Composition() {
  const { state: st, profile } = useApp();
  const c = st.composition;
  const f = st.tdeeFormula;
  return (
    <div className="col" style={{ gap: 16 }}>
      {!c.bf.isMeasured && (
        <Alert kind="warn">
          Tu % de grasa es una <b>estimación</b> ({c.bf.label}) con un error típico de ±{c.bf.error} puntos. Úsalo para ver tendencias; para un valor más preciso registra una medición (DEXA, BOD POD, plicometría por un profesional).
        </Alert>
      )}
      <div className="grid g4">
        <Card tight>
          <Stat label="IMC" value={fmt(c.bmi, 1)} foot={c.bmiCategory + ' · no distingue grasa de músculo'} />
        </Card>
        <Card tight>
          <Stat label={c.bf.isMeasured ? '% de grasa medido' : '% de grasa estimado'} value={fmt(c.bf.value, 1)} unit="%" foot={`Rango probable: ${fmt(c.bf.value - c.bf.error, 1)}–${fmt(c.bf.value + c.bf.error, 1)} %`} />
        </Card>
        <Card tight>
          <Stat label="Masa grasa (est.)" value={fmt(c.fatMass, 1)} unit="kg" />
        </Card>
        <Card tight>
          <Stat label="Masa libre de grasa (est.)" value={fmt(c.leanMass, 1)} unit="kg" foot="Incluye músculo, hueso, órganos y agua" />
        </Card>
      </div>
      <div className="grid g2">
        <Card title="Comparación de métodos de estimación">
          <table className="table">
            <thead>
              <tr>
                <th>Método</th>
                <th className="right">% grasa</th>
                <th className="right">Error típico</th>
                <th>Tipo</th>
              </tr>
            </thead>
            <tbody>
              {c.bf.isMeasured && (
                <tr>
                  <td>
                    <b>{c.bf.label}</b>
                  </td>
                  <td className="right">{fmt(c.bf.value, 1)} %</td>
                  <td className="right">±{c.bf.error}</td>
                  <td>
                    <span className="badge info">Medición</span>
                  </td>
                </tr>
              )}
              {c.bf.alternatives.map((a) => (
                <tr key={a.method}>
                  <td>
                    {METHOD_LABEL[a.method]} {!c.bf.isMeasured && a.method === c.bf.method && <span className="badge accent">En uso</span>}
                  </td>
                  <td className="right">{fmt(a.value, 1)} %</td>
                  <td className="right">±{METHOD_ERROR[a.method]}</td>
                  <td>
                    <span className="badge warn">Estimación</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="small muted mt8">Se usa la mejor opción disponible: medición registrada → US Navy (cintura y cuello) → RFM (cintura) → CUN-BAE (IMC).</p>
        </Card>
        <Card title="Gasto energético">
          <table className="table">
            <tbody>
              <tr>
                <td>Metabolismo basal ({f.bmrMethod === 'katch' ? 'Katch-McArdle' : 'Mifflin-St Jeor'})</td>
                <td className="right mono">{fmt(f.bmr)} kcal</td>
              </tr>
              <tr>
                <td>Factor de actividad cotidiana ({ACTIVITY_BASE[profile.activityLevel].label})</td>
                <td className="right mono">× {f.baseFactor}</td>
              </tr>
              <tr>
                <td>+ Entrenamiento de fuerza ({st.strengthSessionsPerWeek} sesiones/sem)</td>
                <td className="right mono">+ {f.trainingAdd}</td>
              </tr>
              <tr>
                <td>+ Cardio planificado</td>
                <td className="right mono">+ {f.cardioAdd}</td>
              </tr>
              <tr>
                <td>
                  <b>GET por fórmula</b>
                </td>
                <td className="right mono">
                  <b>{fmt(f.tdee)} kcal</b>
                </td>
              </tr>
              <tr>
                <td>GET observado con tus registros</td>
                <td className="right mono">{st.observed.tdee ? `${fmt(st.observed.tdee)} kcal (confianza ${st.observed.confidence})` : '—'}</td>
              </tr>
              <tr>
                <td>
                  <b>GET utilizado</b>
                </td>
                <td className="right mono">
                  <b>{fmt(st.tdee.tdee)} kcal</b>
                </td>
              </tr>
            </tbody>
          </table>
          <p className="small muted mt8">{st.observed.tdee ? st.tdee.method : st.observed.explanation}</p>
        </Card>
      </div>
      <Card title="Limitaciones de las estimaciones">
        <Claims items={LIMITATIONS.map((t) => ({ kind: 'hipotesis' as const, text: t }))} />
      </Card>
    </div>
  );
}

function Measures() {
  const { data, reload, toast } = useApp();
  const [edit, setEdit] = useState<string | null | 'new'>(null);
  const logs = [...data.bodyLogs].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <Card title="Registros de peso y medidas" actions={<button className="btn primary sm" onClick={() => setEdit('new')}><Plus /> Nuevo registro</button>}>
      <div className="scroll">
        <table className="table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th className="right">Peso</th>
              <th className="right">Cintura</th>
              <th className="right">Abdomen</th>
              <th className="right">Cuello</th>
              <th className="right">Pecho</th>
              <th className="right">Cadera</th>
              <th className="right">Brazo</th>
              <th className="right">Muslo</th>
              <th className="right">Pantorrilla</th>
              <th className="right">% grasa</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td>{formatDateShort(l.date)}</td>
                <td className="right">{fmt(l.weight, 1)}</td>
                <td className="right">{fmt(l.waist, 1)}</td>
                <td className="right">{fmt(l.abdomen, 1)}</td>
                <td className="right">{fmt(l.neck, 1)}</td>
                <td className="right">{fmt(l.chest, 1)}</td>
                <td className="right">{fmt(l.hip, 1)}</td>
                <td className="right">{fmt(l.arm, 1)}</td>
                <td className="right">{fmt(l.thigh, 1)}</td>
                <td className="right">{fmt(l.calf, 1)}</td>
                <td className="right">{l.bf_percent ? `${fmt(l.bf_percent, 1)} (${l.bf_method})` : '—'}</td>
                <td className="right">
                  <button className="btn ghost icon sm" onClick={() => setEdit(l.date)} title="Editar">
                    <Pencil />
                  </button>
                  <button
                    className="btn ghost icon sm"
                    title="Eliminar"
                    onClick={async () => {
                      if (!confirm('¿Eliminar este registro?')) return;
                      await api.remove('body_logs', l.id);
                      await reload();
                      toast('Registro eliminado.');
                    }}
                  >
                    <Trash2 />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {edit && <BodyLogModal date={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} />}
    </Card>
  );
}

function Simulator() {
  const { state: st, profile, data, activatePlan, saveProfile, toast } = useApp();
  const [metric, setMetric] = useState<'bf' | 'weight'>('bf');
  const colors: Record<ScenarioKey, string> = { conservador: 'var(--s1)', moderado: 'var(--s2)', agresivo: 'var(--s3)' };
  const keys = Object.keys(SCENARIOS) as ScenarioKey[];
  const c = st.composition;

  const apply = async (k: ScenarioKey) => {
    const targets = calculateTargets({ profile: { ...profile, scenario: k }, weightKg: st.trendWeight ?? st.currentWeight, bfPct: c.bf.value, tdee: st.tdee.tdee, bmr: st.tdeeFormula.bmr, tdeeMethod: st.tdee.method, scenario: k, flags: st.flags });
    if (!confirm(`¿Cambiar tu plan al escenario ${SCENARIOS[k].label}? Nuevo objetivo: ${targets.kcal} kcal, ${targets.protein} g de proteína.`)) return;
    await saveProfile({ ...profile, scenario: k });
    await activatePlan({ scenario: k, targets, reason: `Cambio manual al escenario ${SCENARIOS[k].label}.` });
    toast('Plan actualizado.');
  };

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="grid g3">
        <Card tight>
          <Stat label="Composición actual" value={`${fmt(c.bf.value, 1)} %`} foot={`${fmt(st.trendWeight ?? st.currentWeight, 1)} kg · ${fmt(c.fatMass, 1)} kg grasa · ${fmt(c.leanMass, 1)} kg magra`} />
        </Card>
        <Card tight>
          <Stat label={`Composición objetivo (${profile.targetBodyFat} %)`} value={`${fmt(c.goalWeight, 1)} kg`} foot={`Conservando ${fmt(c.leanMass, 1)} kg de masa magra`} />
        </Card>
        <Card tight>
          <Stat label="Grasa por perder" value={fmt(c.fatToLose, 1)} unit="kg" foot={`Escenario actual: ${SCENARIOS[profile.scenario].label}`} />
        </Card>
      </div>
      <Card title="Proyección por escenario" actions={<Seg value={metric} onChange={setMetric} options={[{ value: 'bf', label: '% grasa' }, { value: 'weight', label: 'Peso' }]} />}>
        <ScenarioChart metric={metric} target={profile.targetBodyFat} series={keys.map((k) => ({ name: SCENARIOS[k].label, color: colors[k], weeks: st.projections[k].weeks }))} />
        <p className="small muted mt8">
          Modelo no lineal: el gasto se recalcula cada semana con la nueva masa magra, incluye una adaptación metabólica pequeña y recalibra la ingesta cada 4 semanas. La primera semana suele bajar más por agua y glucógeno (no modelado).
        </p>
      </Card>
      <div className="grid g3">
        {keys.map((k) => {
          const pr = st.projections[k];
          const active = profile.scenario === k;
          return (
            <Card key={k} title={<span className="row" style={{ gap: 8 }}><span className="dot" style={{ background: colors[k] }} />{SCENARIOS[k].label}</span>} actions={active ? <span className="badge accent">Activo</span> : st.recommendedScenario === k ? <span className="badge">Recomendado</span> : null}>
              <p className="small muted mb8">{SCENARIOS[k].description}</p>
              <table className="table">
                <tbody>
                  <tr>
                    <td>Calorías iniciales</td>
                    <td className="right">{fmt(pr.initialIntake)} kcal (−{fmt(pr.initialDeficit)})</td>
                  </tr>
                  <tr>
                    <td>Tiempo estimado</td>
                    <td className="right">
                      <b>{pr.reached ? `${pr.weeksToGoal} semanas` : '> 104 semanas'}</b>
                    </td>
                  </tr>
                  <tr>
                    <td>Fecha aproximada</td>
                    <td className="right">{pr.reached ? new Date(addDays(st.today, (pr.weeksToGoal ?? 0) * 7) + 'T12:00:00').toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }) : '—'}</td>
                  </tr>
                  <tr>
                    <td>Peso perdido</td>
                    <td className="right">{fmt(pr.weightLost, 1)} kg</td>
                  </tr>
                  <tr>
                    <td>Grasa perdida</td>
                    <td className="right">{fmt(pr.fatLost, 1)} kg</td>
                  </tr>
                  <tr>
                    <td>Cambio de masa magra (modelo)</td>
                    <td className="right">
                      {pr.leanChange > 0 ? '+' : ''}
                      {fmt(pr.leanChange, 1)} kg
                    </td>
                  </tr>
                  <tr>
                    <td>Músculo ganable (rango)</td>
                    <td className="right">
                      {fmt(pr.muscleGainRange.low, 1)}–{fmt(pr.muscleGainRange.high, 1)} kg
                    </td>
                  </tr>
                </tbody>
              </table>
              {!active && (
                <button className="btn sm mt16" onClick={() => apply(k)} disabled={data.profile.conditions.includes('tca') && k !== 'conservador'}>
                  Usar este escenario
                </button>
              )}
            </Card>
          );
        })}
      </div>
      <Alert kind="info">Las proyecciones son escenarios, no promesas. La fecha real depende de la adherencia, el sueño, el estrés y la variación individual; BODY OS la recalcula con tus datos.</Alert>
    </div>
  );
}
