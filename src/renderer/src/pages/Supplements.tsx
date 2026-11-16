import { useMemo, useState } from 'react';
import { Ban, Check, Plus, Trash2 } from 'lucide-react';
import { Hero } from '../components/visual';
import { useApp } from '../store';
import { Alert, Card, Field, Tabs, Empty } from '../components/ui';
import { assessSupplements, CLASS_LABEL, NOT_RECOMMENDED, SUPPLEMENTS, type SuppAssessment, type SuppClass } from '@shared/supplements/supplements';
import { REFERENCES } from '@shared/references';
import { isCompleteDay } from '@shared/analytics/trend';
import { addDays, dateRange, formatDateShort, mean, uid } from '@shared/utils';
import { api } from '../api';

const CLS: Record<SuppClass, string> = { util: 'ok', opcional: 'info', no_necesario: '', valoracion: 'warn' };

const GROUPS: { cls: SuppClass; title: string; sub?: string; color: string; showDose: boolean; showReason: boolean; collapsed?: boolean }[] = [
  { cls: 'util', title: 'Te pueden servir', color: 'var(--m-green)', showDose: true, showReason: true },
  { cls: 'valoracion', title: 'Consulta antes a tu médico', color: 'var(--m-amber)', showDose: false, showReason: true },
  { cls: 'opcional', title: 'Opcionales', sub: 'Pueden ayudar algo, pero no son necesarios.', color: 'var(--m-cyan)', showDose: true, showReason: false },
  { cls: 'no_necesario', title: 'No los necesitas ahora', color: 'var(--m-slate)', showDose: false, showReason: true, collapsed: true },
];

export function Supplements() {
  const { data, state: st, profile, today, stack, supplementLogs, reload, toast } = useApp();
  const [tab, setTab] = useState<'analisis' | 'mis' | 'evitar'>('analisis');
  const days = dateRange(addDays(today, -6), today).map((d) => st.intake.get(d)).filter(isCompleteDay);
  const routineDay = data.routine?.days[0];
  const assessments = useMemo(
    () => assessSupplements(profile, st.flags, { proteinTarget: st.targets.protein, avgProteinIntake: days.length ? mean(days.map((d) => d!.protein)) : null, loggedDays: days.length, trainingMinutes: routineDay?.estMinutes ?? profile.sessionMinutes, weightKg: st.currentWeight }),
    [profile, st, days.length, routineDay],
  );
  const [open, setOpen] = useState<SuppAssessment | null>(null);
  const [custom, setCustom] = useState({ name: '', dose: '', timing: '' });

  const addToStack = async (key: string, name: string, dose: string, timing: string) => {
    await api.upsert('supplement_stack', { id: uid('st_'), supplement_key: key, name, dose, timing, started_at: today, active: 1 });
    await reload();
    toast(`${name} agregado a tus suplementos.`);
  };
  const takenToday = (key: string) => supplementLogs.some((l) => l.date === today && l.supplement_key === key);

  return (
    <div className="page">
      <Hero module="suplementos" title="Suplementación" sub="Lo que te puede servir según tus datos. Primero van comida, entrenamiento y sueño." />
      <p className="small muted mb12 tech">Las dosis mostradas son las habitualmente estudiadas, no prescripciones; con cualquier condición médica o medicamento consulta a tu médico.</p>
      <div>
        <Tabs value={tab} onChange={setTab} tabs={[{ value: 'analisis', label: 'Análisis para ti' }, { value: 'mis', label: 'Lo que tomo' }, { value: 'evitar', label: 'No recomendados' }]} />
      </div>
      {tab === 'analisis' && (
        <div className="col" style={{ gap: 16 }}>
          {GROUPS.map((g) => {
            const list = assessments.filter((a) => a.cls === g.cls);
            if (!list.length) return null;
            const rows = list.map((a) => {
              const inStack = stack.some((s) => s.supplement_key === a.supplement.key);
              return (
                <div key={a.supplement.key} className="supp-row" data-testid={`supp-${a.supplement.key}`}>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="row" style={{ gap: 8 }}>
                      <b>{a.supplement.name}</b>
                      {g.showDose && (a.personalDose ?? a.supplement.dose) && <span className="supp-dose">{a.personalDose ?? a.supplement.dose}</span>}
                    </div>
                    {g.showReason && a.reasons[0] && <div className="small muted supp-reason">{a.reasons[0]}</div>}
                  </div>
                  {g.showDose && !inStack && (
                    <button className="btn sm" onClick={() => addToStack(a.supplement.key, a.supplement.name, a.personalDose ?? a.supplement.dose, a.supplement.timing)}>
                      <Plus /> Lo tomo
                    </button>
                  )}
                  {inStack && <span className="badge ok">En tu lista</span>}
                  <button className="btn sm ghost" onClick={() => setOpen(a)}>
                    Detalle
                  </button>
                </div>
              );
            });
            return g.collapsed ? (
              <details key={g.cls} className="card supp-group">
                <summary className="supp-head">
                  <span className="dot" style={{ background: g.color }} /> {g.title} <span className="muted small">({list.length})</span>
                </summary>
                <div className="mt8">{rows}</div>
              </details>
            ) : (
              <section key={g.cls} className="card supp-group">
                <div className="supp-head">
                  <span className="dot" style={{ background: g.color }} /> {g.title}
                </div>
                {g.sub && <p className="tiny muted mb8">{g.sub}</p>}
                {rows}
              </section>
            );
          })}
        </div>
      )}
      {tab === 'mis' && (
        <div className="grid g2">
          <Card title="Mis suplementos">
            {stack.length === 0 && <Empty>No registras suplementos.</Empty>}
            <div className="col">
              {stack.map((s) => (
                <div className="list-item" key={s.id}>
                  <div className="grow">
                    <b>{s.name}</b>
                    <div className="tiny muted">
                      {s.dose} · {s.timing}
                    </div>
                  </div>
                  <button
                    className={`btn sm ${takenToday(s.supplement_key) ? 'primary' : ''}`}
                    onClick={async () => {
                      if (takenToday(s.supplement_key)) {
                        const l = supplementLogs.find((x) => x.date === today && x.supplement_key === s.supplement_key)!;
                        await api.remove('supplement_logs', l.id);
                      } else await api.upsert('supplement_logs', { id: uid('sl_'), date: today, supplement_key: s.supplement_key, name: s.name, dose: s.dose });
                      await reload();
                    }}
                  >
                    <Check /> {takenToday(s.supplement_key) ? 'Tomado hoy' : 'Marcar tomado'}
                  </button>
                  <button
                    className="btn ghost icon sm"
                    onClick={async () => {
                      await api.remove('supplement_stack', s.id);
                      await reload();
                    }}
                  >
                    <Trash2 />
                  </button>
                </div>
              ))}
            </div>
            <div className="mt16 field-label">Agregar otro suplemento que ya tomas</div>
            <div className="grid g3 mt8">
              <Field label="Nombre">
                <input className="input" value={custom.name} onChange={(e) => setCustom({ ...custom, name: e.target.value })} />
              </Field>
              <Field label="Dosis">
                <input className="input" value={custom.dose} onChange={(e) => setCustom({ ...custom, dose: e.target.value })} />
              </Field>
              <Field label="Momento">
                <input className="input" value={custom.timing} onChange={(e) => setCustom({ ...custom, timing: e.target.value })} />
              </Field>
            </div>
            <button
              className="btn mt8"
              disabled={!custom.name.trim()}
              onClick={async () => {
                await addToStack(`custom_${uid()}`, custom.name.trim(), custom.dose, custom.timing);
                setCustom({ name: '', dose: '', timing: '' });
              }}
            >
              <Plus /> Agregar
            </button>
            {profile.medications && <p className="tiny muted mt8">Registraste medicamentos: comenta con tu médico o farmacéutico cualquier suplemento adicional.</p>}
          </Card>
          <Card title="Registro reciente">
            <table className="table">
              <tbody>
                {supplementLogs.slice(0, 30).map((l) => (
                  <tr key={l.id}>
                    <td>{formatDateShort(l.date)}</td>
                    <td>{l.name}</td>
                    <td className="right small muted">{l.dose}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!supplementLogs.length && <p className="muted small">Sin registros.</p>}
          </Card>
        </div>
      )}
      {tab === 'evitar' && (
        <Card title="Productos que BODY OS no recomienda">
          <div className="col">
            {NOT_RECOMMENDED.map((n) => (
              <div className="list-item" key={n.name}>
                <Ban color="var(--danger)" size={18} />
                <div>
                  <b>{n.name}</b>
                  <div className="small muted supp-reason">{n.why}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
      {open && (
        <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && setOpen(null)}>
          <div className="modal wide">
            <div className="modal-head">
              <h2>{open.supplement.name}</h2>
              <button className="btn ghost" onClick={() => setOpen(null)}>
                Cerrar
              </button>
            </div>
            <div className="modal-body col" style={{ gap: 14 }}>
              <div>
                <span className={`badge ${CLS[open.cls]}`}>{CLASS_LABEL[open.cls]}</span>
              </div>
              <Detail t="Beneficio potencial" v={open.supplement.benefit} />
              <DetailList t="¿Lo necesitas?" v={open.reasons} />
              <Detail t="Evidencia científica" v={`${open.supplement.evidence} (nivel: ${open.supplement.evidenceLevel})`} />
              <Detail t="Dosis habitual estudiada" v={open.supplement.dose} />
              <Detail t="Momento de consumo" v={open.supplement.timing} />
              <DetailList t="Posibles efectos secundarios" v={open.supplement.sideEffects} />
              <DetailList t="Contraindicaciones" v={open.supplement.contraindications.length ? open.supplement.contraindications : ['Ninguna relevante conocida en adultos sanos.']} />
              <DetailList t="Interacciones con medicamentos" v={open.supplement.interactions} />
              <div className="tech">
                <h3 className="mb8">Referencias</h3>
                {open.supplement.refs.map((k) => {
                  const r = REFERENCES.find((x) => x.key === k);
                  return r ? (
                    <p key={k} className="small muted">
                      {r.citation}
                    </p>
                  ) : null;
                })}
              </div>
            </div>
          </div>
        </div>
      )}
      <p className="tiny muted mt16 tech">{SUPPLEMENTS.length} suplementos evaluados.</p>
    </div>
  );
}

function Detail({ t, v }: { t: string; v: string }) {
  return (
    <div>
      <h3 className="mb8">{t}</h3>
      <p className="small">{v}</p>
    </div>
  );
}
function DetailList({ t, v }: { t: string; v: string[] }) {
  return (
    <div>
      <h3 className="mb8">{t}</h3>
      <ul className="small" style={{ paddingLeft: 18, margin: 0 }}>
        {v.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
    </div>
  );
}
