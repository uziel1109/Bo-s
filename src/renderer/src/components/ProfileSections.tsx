// Secciones del perfil: se usan en el asistente inicial y en Configuración.
import type { ActivityLevel, BodyFatMethod, BodyRegion, Equipment, Muscle, Profile } from '@shared/types';
import { Chips, Field, NumInput, Seg } from './ui';
import { ACTIVITY_BASE, METHOD_LABEL } from '@shared/body/composition';
import { EQUIPMENT_LABEL, MUSCLE_LABEL, REGION_LABEL, EXERCISES } from '@shared/training/exercises';
import { CONDITIONS } from '@shared/safety/screening';
import { ALLERGEN_TAGS } from '@shared/nutrition/foodsSeed';
import { DAY_SHORT } from '@shared/utils';
import { useStore } from '../store';

export type SetP = (patch: Partial<Profile>) => void;

export function PersonalSection({ p, set }: { p: Profile; set: SetP }) {
  return (
    <div className="grid g3">
      <Field label="Nombre (opcional)">
        <input className="input" value={p.name} onChange={(e) => set({ name: e.target.value })} data-testid="pf-name" />
      </Field>
      <Field label="Edad">
        <NumInput value={p.age} onChange={(v) => set({ age: v ?? 0 })} suffix="años" testId="pf-age" />
      </Field>
      <Field label="Sexo" help="Se usa en las ecuaciones metabólicas y de composición corporal.">
        <Seg value={p.sex} onChange={(v) => set({ sex: v })} options={[{ value: 'hombre', label: 'Hombre' }, { value: 'mujer', label: 'Mujer' }]} />
      </Field>
      <Field label="Estatura">
        <NumInput value={p.heightCm} onChange={(v) => set({ heightCm: v ?? 0 })} suffix="cm" testId="pf-height" />
      </Field>
      <Field label="Peso actual">
        <NumInput value={p.weightKg} onChange={(v) => set({ weightKg: v ?? 0 })} suffix="kg" step={0.1} testId="pf-weight" />
      </Field>
      <Field label="Peso objetivo (opcional)" help="El sistema calcula uno a partir de tu % de grasa objetivo.">
        <NumInput value={p.targetWeightKg} onChange={(v) => set({ targetWeightKg: v })} suffix="kg" step={0.1} />
      </Field>
      <Field label="% de grasa objetivo">
        <NumInput value={p.targetBodyFat} onChange={(v) => set({ targetBodyFat: v ?? 20 })} suffix="%" testId="pf-target-bf" />
      </Field>
      <Field label="Ocupación">
        <input className="input" value={p.occupation} onChange={(e) => set({ occupation: e.target.value })} placeholder="p. ej., oficina, enfermería, construcción" />
      </Field>
      <Field label="País / moneda">
        <div className="row nowrap">
          <input className="input" value={p.country} onChange={(e) => set({ country: e.target.value })} />
          <input className="input" style={{ width: 90 }} value={p.currency} onChange={(e) => set({ currency: e.target.value })} />
        </div>
      </Field>
      <div className="span3">
        <Field label="Nivel de actividad cotidiana (sin contar el entrenamiento)">
          <Chips<ActivityLevel>
            multi={false}
            value={[p.activityLevel]}
            onChange={(v) => set({ activityLevel: v[0] })}
            options={(Object.keys(ACTIVITY_BASE) as ActivityLevel[]).map((k) => ({ value: k, label: `${ACTIVITY_BASE[k].label} · ${ACTIVITY_BASE[k].desc}` }))}
          />
        </Field>
      </div>
    </div>
  );
}

export function MeasuresSection({ p, set }: { p: Profile; set: SetP }) {
  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="grid g3">
        <Field label="Cintura" help="A la altura del ombligo, relajado, al final de una exhalación.">
          <NumInput value={p.waistCm} onChange={(v) => set({ waistCm: v })} suffix="cm" step={0.1} testId="pf-waist" />
        </Field>
        <Field label="Cuello" help="Justo debajo de la laringe, cinta ligeramente inclinada hacia abajo.">
          <NumInput value={p.neckCm} onChange={(v) => set({ neckCm: v })} suffix="cm" step={0.1} testId="pf-neck" />
        </Field>
        <Field label="Cadera" help={p.sex === 'mujer' ? 'Necesaria para la fórmula US Navy en mujeres.' : 'Opcional en hombres.'}>
          <NumInput value={p.hipCm} onChange={(v) => set({ hipCm: v })} suffix="cm" step={0.1} />
        </Field>
      </div>
      <div className="grid g3">
        <Field label="% de grasa conocido (opcional)" help="Solo si proviene de una medición. Si no lo sabes, se estimará.">
          <NumInput value={p.knownBodyFat} onChange={(v) => set({ knownBodyFat: v })} suffix="%" step={0.1} />
        </Field>
        <Field label="Método de esa medición">
          <select className="input" value={p.knownBodyFatMethod ?? ''} onChange={(e) => set({ knownBodyFatMethod: (e.target.value || null) as BodyFatMethod | null })}>
            <option value="">—</option>
            {(['dexa', 'bodpod', 'pesaje_hidrostatico', 'bioimpedancia', 'plicometria', 'visual'] as BodyFatMethod[]).map((m) => (
              <option key={m} value={m}>
                {METHOD_LABEL[m]}
              </option>
            ))}
          </select>
        </Field>
      </div>
    </div>
  );
}

export function TrainingSection({ p, set }: { p: Profile; set: SetP }) {
  return (
    <div className="col" style={{ gap: 18 }}>
      <div className="grid g3">
        <Field label="Experiencia entrenando">
          <Seg value={p.experience} onChange={(v) => set({ experience: v })} options={[{ value: 'principiante', label: '< 1 año' }, { value: 'intermedio', label: '1–3 años' }, { value: 'avanzado', label: '> 3 años' }]} />
        </Field>
        <Field label="Minutos por sesión">
          <NumInput value={p.sessionMinutes} onChange={(v) => set({ sessionMinutes: v ?? 60 })} suffix="min" />
        </Field>
        <Field label="Capacidad cardiovascular">
          <Seg value={p.cardioFitness} onChange={(v) => set({ cardioFitness: v })} options={[{ value: 'baja', label: 'Baja' }, { value: 'media', label: 'Media' }, { value: 'alta', label: 'Alta' }]} />
        </Field>
      </div>
      <Field label="Días disponibles para entrenar fuerza" help={`${p.trainingDays.length} días seleccionados`}>
        <Chips<number> value={p.trainingDays} onChange={(v) => set({ trainingDays: v.sort() })} options={[1, 2, 3, 4, 5, 6, 0].map((d) => ({ value: d, label: DAY_SHORT[d] }))} />
      </Field>
      <div className="grid g2">
        <Field label="Horario habitual de entrenamiento">
          <input className="input" value={p.trainingSchedule} onChange={(e) => set({ trainingSchedule: e.target.value })} placeholder="p. ej., 7:00 a 8:00" />
        </Field>
        <Field label="División preferida">
          <select className="input" value={p.preferredSplit ?? 'auto'} onChange={(e) => set({ preferredSplit: e.target.value as Profile['preferredSplit'] })}>
            <option value="auto">Automática (recomendada)</option>
            <option value="full_body">Full Body</option>
            <option value="upper_lower">Upper / Lower</option>
            <option value="ppl">Push / Pull / Legs</option>
          </select>
        </Field>
      </div>
      <Field label="Acceso a gimnasio">
        <Seg
          value={p.gymAccess ? 'si' : 'no'}
          onChange={(v) => set({ gymAccess: v === 'si', equipment: v === 'si' ? ['barra', 'mancuernas', 'maquinas', 'poleas', 'banco', 'barra_dominadas', 'rack'] : ['mancuernas', 'bandas', 'peso_corporal'] })}
          options={[{ value: 'si', label: 'Sí, gimnasio completo' }, { value: 'no', label: 'No, entreno en casa' }]}
        />
      </Field>
      <Field label="Equipamiento disponible">
        <Chips<Equipment> value={p.equipment} onChange={(v) => set({ equipment: v })} options={(Object.keys(EQUIPMENT_LABEL) as Equipment[]).map((k) => ({ value: k, label: EQUIPMENT_LABEL[k] }))} />
      </Field>
      <Field label="Grupos musculares que quieres desarrollar más">
        <Chips<Muscle> value={p.priorityMuscles} onChange={(v) => set({ priorityMuscles: v })} options={(Object.keys(MUSCLE_LABEL) as Muscle[]).map((k) => ({ value: k, label: MUSCLE_LABEL[k] }))} />
      </Field>
      <Field label="Lesiones o limitaciones (zonas)" help="Se excluyen los ejercicios que cargan estas zonas.">
        <Chips<BodyRegion> value={p.injuries} onChange={(v) => set({ injuries: v })} options={(Object.keys(REGION_LABEL) as BodyRegion[]).map((k) => ({ value: k, label: REGION_LABEL[k] }))} />
      </Field>
      <div className="grid g2">
        <Field label="Detalle de lesiones / historial de entrenamiento">
          <textarea className="input" value={p.injuryNotes} onChange={(e) => set({ injuryNotes: e.target.value })} />
        </Field>
        <Field label="Historial de entrenamiento">
          <textarea className="input" value={p.trainingHistory} onChange={(e) => set({ trainingHistory: e.target.value })} />
        </Field>
      </div>
      <Field label="Ejercicios que NO puedes o no quieres realizar">
        <select
          className="input"
          value=""
          onChange={(e) => {
            if (e.target.value && !p.excludedExercises.includes(e.target.value)) set({ excludedExercises: [...p.excludedExercises, e.target.value] });
          }}
        >
          <option value="">Agregar ejercicio a excluir…</option>
          {EXERCISES.filter((x) => !p.excludedExercises.includes(x.id)).map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
        <div className="chips mt8">
          {p.excludedExercises.map((id) => (
            <button key={id} className="chip on" onClick={() => set({ excludedExercises: p.excludedExercises.filter((x) => x !== id) })}>
              {EXERCISES.find((x) => x.id === id)?.name ?? id} ✕
            </button>
          ))}
        </div>
      </Field>
    </div>
  );
}

export function NutritionSection({ p, set }: { p: Profile; set: SetP }) {
  const { foods } = useStore();
  const base = foods.filter((f) => !f.custom);
  return (
    <div className="col" style={{ gap: 18 }}>
      <div className="grid g3">
        <Field label="Comidas por día">
          <Seg
            value={String(p.mealsPerDay) as '2' | '3' | '4' | '5'}
            onChange={(v) => {
              const n = Number(v);
              const times = { 2: ['14:00', '20:30'], 3: ['08:00', '14:30', '20:30'], 4: ['08:00', '14:00', '17:30', '20:30'], 5: ['08:00', '11:00', '14:30', '17:30', '20:30'] }[n]!;
              set({ mealsPerDay: n, mealTimes: times });
            }}
            options={['2', '3', '4', '5'].map((v) => ({ value: v as '2' | '3' | '4' | '5', label: v }))}
          />
        </Field>
        <Field label="Presupuesto de alimentación">
          <Seg value={p.budget} onChange={(v) => set({ budget: v })} options={[{ value: 'bajo', label: 'Ajustado' }, { value: 'medio', label: 'Medio' }, { value: 'alto', label: 'Amplio' }]} />
        </Field>
        <Field label="Porciones de pescado por semana">
          <NumInput value={p.fishServingsPerWeek} onChange={(v) => set({ fishServingsPerWeek: v ?? 0 })} />
        </Field>
      </div>
      <Field label="Horarios de comida">
        <div className="row">
          {p.mealTimes.map((t, i) => (
            <input key={i} type="time" className="input" style={{ width: 120 }} value={t} onChange={(e) => set({ mealTimes: p.mealTimes.map((x, j) => (j === i ? e.target.value : x)) })} />
          ))}
        </div>
      </Field>
      <Field label="Alergias e intolerancias">
        <Chips<string> value={p.allergies} onChange={(v) => set({ allergies: v })} options={ALLERGEN_TAGS.map((a) => ({ value: a.key, label: a.label }))} />
      </Field>
      <div className="grid g2">
        <Field label="Alimentos preferidos" help="Se priorizan en los planes de comida.">
          <FoodPicker selected={p.preferredFoods} onChange={(v) => set({ preferredFoods: v })} foods={base} />
        </Field>
        <Field label="Alimentos que no consumes" help="Nunca aparecerán en tus planes.">
          <FoodPicker selected={p.excludedFoods} onChange={(v) => set({ excludedFoods: v })} foods={base} />
        </Field>
      </div>
      <Field label="Alimentos y productos disponibles localmente (notas)">
        <textarea className="input" value={p.localFoodsNotes} onChange={(e) => set({ localFoodsNotes: e.target.value })} placeholder="p. ej., mercado con pollo y verduras, sin pescado fresco" />
      </Field>
    </div>
  );
}

function FoodPicker({ selected, onChange, foods }: { selected: string[]; onChange: (v: string[]) => void; foods: { id: string; name: string }[] }) {
  return (
    <div>
      <select className="input" value="" onChange={(e) => e.target.value && !selected.includes(e.target.value) && onChange([...selected, e.target.value])}>
        <option value="">Agregar alimento…</option>
        {foods
          .filter((f) => !selected.includes(f.id))
          .map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
      </select>
      <div className="chips mt8">
        {selected.map((id) => (
          <button key={id} className="chip on" onClick={() => onChange(selected.filter((x) => x !== id))}>
            {foods.find((f) => f.id === id)?.name ?? id} ✕
          </button>
        ))}
      </div>
    </div>
  );
}

export function HealthSection({ p, set }: { p: Profile; set: SetP }) {
  return (
    <div className="col" style={{ gap: 18 }}>
      <Field label="Enfermedades diagnosticadas o situaciones relevantes" help="Determinan qué recomendaciones requieren valoración médica.">
        <Chips<string> value={p.conditions} onChange={(v) => set({ conditions: v })} options={CONDITIONS.map((c) => ({ value: c.key, label: c.label }))} />
      </Field>
      <div className="grid g3">
        <Field label="Presión arterial sistólica (si la conoces)">
          <NumInput value={p.systolic} onChange={(v) => set({ systolic: v })} suffix="mmHg" />
        </Field>
        <Field label="Presión arterial diastólica">
          <NumInput value={p.diastolic} onChange={(v) => set({ diastolic: v })} suffix="mmHg" />
        </Field>
        <Field label="Límite de líquidos indicado por tu médico" help="Solo si te lo indicaron.">
          <NumInput value={p.fluidRestrictionMl} onChange={(v) => set({ fluidRestrictionMl: v })} suffix="ml/día" />
        </Field>
      </div>
      <div className="grid g2">
        <Field label="Medicamentos actuales" help="Nombre y dosis. Se revisan interacciones con suplementos.">
          <textarea className="input" value={p.medications} onChange={(e) => set({ medications: e.target.value })} />
        </Field>
        <Field label="Antecedentes médicos relevantes">
          <textarea className="input" value={p.medicalHistory} onChange={(e) => set({ medicalHistory: e.target.value })} />
        </Field>
        <Field label="Restricciones indicadas por profesionales de la salud" help="Siempre prevalecen sobre las recomendaciones de BODY OS.">
          <textarea className="input" value={p.professionalRestrictions} onChange={(e) => set({ professionalRestrictions: e.target.value })} />
        </Field>
        <Field label="Notas sobre condiciones">
          <textarea className="input" value={p.conditionsNotes} onChange={(e) => set({ conditionsNotes: e.target.value })} />
        </Field>
      </div>
      <div className="grid g2">
        <Field label="Temperatura ambiental habitual">
          <NumInput value={p.ambientTempC} onChange={(v) => set({ ambientTempC: v ?? 24 })} suffix="°C" />
        </Field>
        <Field label="Sudoración al entrenar">
          <Seg value={p.sweatLevel} onChange={(v) => set({ sweatLevel: v })} options={[{ value: 'bajo', label: 'Poca' }, { value: 'medio', label: 'Media' }, { value: 'alto', label: 'Mucha' }]} />
        </Field>
      </div>
    </div>
  );
}
