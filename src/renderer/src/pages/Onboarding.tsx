// Asistente de configuración inicial.
import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ShieldCheck } from 'lucide-react';
import { defaultProfile, validateProfile } from '@shared/profileDefaults';
import type { Profile, ScenarioKey } from '@shared/types';
import { computeState } from '@shared/engine';
import { SCENARIOS } from '@shared/body/projection';
import { generateRoutine } from '@shared/training/generator';
import { today, uid, addDays } from '@shared/utils';
import { HealthSection, MeasuresSection, NutritionSection, PersonalSection, TrainingSection } from '../components/ProfileSections';
import { Alert, Claims, fmt, Stat } from '../components/ui';
import { api } from '../api';
import { useStore } from '../store';

const STEPS = ['Información personal', 'Medidas corporales', 'Entrenamiento', 'Nutrición', 'Salud y seguridad', 'Tu plan'];

export function Onboarding() {
  const store = useStore();
  const [step, setStep] = useState(0);
  const [p, setP] = useState<Profile>(defaultProfile());
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<Profile>) => setP((x) => ({ ...x, ...patch }));
  const errors = validateProfile(p);

  const preview = useMemo(() => {
    if (step < 5 || errors.length) return null;
    try {
      return computeState({ profile: p, bodyLogs: [], foodLogs: [], waterLogs: [], cardioLogs: [], stepsLogs: [], recoveryLogs: [], sessions: [], routine: null, plan: null, adjustments: [] }, today());
    } catch {
      return null;
    }
  }, [p, step, errors.length]);

  const finish = async () => {
    if (!preview) return;
    setBusy(true);
    try {
      const prof = { ...p, createdAt: new Date().toISOString() };
      const d = today();
      await api.upsert('body_logs', { id: uid('b_'), date: d, weight: p.weightKg, waist: p.waistCm, neck: p.neckCm, hip: p.hipCm, bf_percent: p.knownBodyFat, bf_method: p.knownBodyFat ? p.knownBodyFatMethod : null });
      const routine = generateRoutine(prof);
      const rid = uid('r_');
      await api.upsert('routines', { id: rid, created_at: new Date().toISOString(), active: 1, data: routine });
      await api.upsert('nutrition_plans', { id: uid('plan_'), created_at: new Date().toISOString(), active: 1, scenario: p.scenario, targets: preview.recommendedTargets, reason: 'Plan inicial generado en la configuración.' });
      await api.upsert('adjustments', { id: uid('adj_'), created_at: addDays(d, 0) + 'T00:00:00.000Z', kind: 'calorias', title: 'Plan inicial', justification: preview.recommendedTargets.rationale, payload: { initial: true }, status: 'aceptado', resolved_at: new Date().toISOString() });
      await store.saveProfile(prof);
      store.toast('¡Perfil creado! Tu plan está listo.');
    } catch (e) {
      store.toast(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="onb">
      <aside className="onb-side">
        <div className="brand" style={{ padding: 0 }}>
          <div className="brand-mark">OS</div>
          <div>
            <div className="brand-name">BODY OS</div>
            <div className="brand-sub">Configuración inicial</div>
          </div>
        </div>
        <div className="onb-steps">
          {STEPS.map((s, i) => (
            <div key={s} className={`onb-step ${i === step ? 'on' : ''} ${i < step ? 'done' : ''}`}>
              <div className="n">{i < step ? <Check size={14} /> : i + 1}</div>
              {s}
            </div>
          ))}
        </div>
        <div className="small muted" style={{ marginTop: 'auto', display: 'flex', gap: 8 }}>
          <ShieldCheck size={16} style={{ flex: 'none' }} />
          Tus datos se guardan únicamente en este equipo. Puedes modificarlos en cualquier momento desde Configuración.
        </div>
      </aside>
      <main className="onb-main">
        <div className="mb16">
          <div className="muted small">
            Paso {step + 1} de {STEPS.length}
          </div>
          <h1 style={{ marginTop: 4 }}>{STEPS[step]}</h1>
        </div>
        {step === 0 && (
          <>
            <Alert kind="info">Los valores que ves son provisionales: reemplázalos con tus datos reales.</Alert>
            <div className="mt16">
              <PersonalSection p={p} set={set} />
            </div>
          </>
        )}
        {step === 1 && (
          <>
            <p className="muted mb16">Con cintura y cuello (y cadera en mujeres) se estima tu % de grasa con la fórmula US Navy. Sin ellas se usa una estimación menos precisa basada en IMC.</p>
            <MeasuresSection p={p} set={set} />
          </>
        )}
        {step === 2 && <TrainingSection p={p} set={set} />}
        {step === 3 && <NutritionSection p={p} set={set} />}
        {step === 4 && <HealthSection p={p} set={set} />}
        {step === 5 && (
          <div className="col" style={{ gap: 16 }}>
            {errors.length > 0 && (
              <Alert kind="danger">
                Revisa estos datos: <br />
                {errors.join(' ')}
              </Alert>
            )}
            {preview && (
              <>
                {preview.flags
                  .filter((f) => f.level !== 'info')
                  .map((f) => (
                    <Alert key={f.id} kind={f.level === 'precaucion' ? 'warn' : 'danger'}>
                      <b>{f.title}.</b> {f.detail}
                    </Alert>
                  ))}
                <div className="grid g4">
                  <div className="card tight">
                    <Stat label="% de grasa estimado" value={fmt(preview.composition.bf.value, 1)} unit="%" foot={`±${preview.composition.bf.error} · ${preview.composition.bf.label}`} />
                  </div>
                  <div className="card tight">
                    <Stat label="Masa libre de grasa (est.)" value={fmt(preview.composition.leanMass, 1)} unit="kg" />
                  </div>
                  <div className="card tight">
                    <Stat label="Gasto diario estimado" value={fmt(preview.tdee.tdee)} unit="kcal" foot={`TMB ${fmt(preview.tdeeFormula.bmr)} × ${preview.tdeeFormula.pal}`} />
                  </div>
                  <div className="card tight">
                    <Stat label={`Peso aprox. a ${p.targetBodyFat} %`} value={fmt(preview.composition.goalWeight, 1)} unit="kg" foot={`≈ ${fmt(preview.composition.fatToLose, 1)} kg de grasa por perder`} />
                  </div>
                </div>
                <div className="card">
                  <div className="card-head">
                    <div className="title">Elige tu escenario</div>
                    <span className="hint">Recomendado para ti: {SCENARIOS[preview.recommendedScenario].label}</span>
                  </div>
                  <div className="grid g3">
                    {(Object.keys(SCENARIOS) as ScenarioKey[]).map((k) => {
                      const pr = preview.projections[k];
                      return (
                        <button
                          key={k}
                          type="button"
                          className="card flat"
                          data-testid={`scenario-${k}`}
                          style={{ textAlign: 'left', cursor: 'pointer', borderColor: p.scenario === k ? 'var(--accent)' : undefined, background: p.scenario === k ? 'var(--accent-soft)' : undefined, color: 'inherit', font: 'inherit' }}
                          onClick={() => set({ scenario: k })}
                        >
                          <div className="row between">
                            <b>{SCENARIOS[k].label}</b>
                            {preview.recommendedScenario === k && <span className="badge accent">Recomendado</span>}
                          </div>
                          <p className="small muted mt8">{SCENARIOS[k].description}</p>
                          <div className="mt8 small">
                            Inicio ≈ <b>{fmt(pr.initialIntake)} kcal</b> · {pr.reached ? <>≈ <b>{pr.weeksToGoal} semanas</b></> : 'más de 2 años'}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="card">
                  <div className="card-head">
                    <div className="title">Tu objetivo nutricional inicial</div>
                  </div>
                  <div className="grid g5">
                    <Stat label="Calorías" value={fmt(preview.recommendedTargets.kcal)} unit="kcal" />
                    <Stat label="Proteína" value={fmt(preview.recommendedTargets.protein)} unit="g" />
                    <Stat label="Carbohidratos" value={fmt(preview.recommendedTargets.carbs)} unit="g" />
                    <Stat label="Grasas" value={fmt(preview.recommendedTargets.fat)} unit="g" />
                    <Stat label="Fibra" value={fmt(preview.recommendedTargets.fiber)} unit="g" />
                  </div>
                  <div className="mt16">
                    <Claims items={preview.recommendedTargets.rationale.map((t) => ({ kind: 'recomendacion' as const, text: t }))} />
                  </div>
                </div>
                <Alert kind="info">BODY OS es una herramienta de apoyo y no sustituye la valoración de un médico, nutriólogo o entrenador certificado. Todas las estimaciones se recalculan con tus registros reales.</Alert>
              </>
            )}
          </div>
        )}
        <div className="row between" style={{ marginTop: 28 }}>
          <button className="btn" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
            <ArrowLeft /> Anterior
          </button>
          {step < STEPS.length - 1 ? (
            <button className="btn primary" onClick={() => setStep((s) => s + 1)} data-testid="onb-next">
              Siguiente <ArrowRight />
            </button>
          ) : (
            <button className="btn primary" disabled={!!errors.length || busy || !preview} onClick={finish} data-testid="onb-finish">
              <Check /> Crear mi plan
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
