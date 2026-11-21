// Detección de situaciones que requieren valoración médica antes de aplicar dietas, ejercicios o suplementos.
// Basado en los principios del cuestionario PAR-Q+ y en guías clínicas generales. NO es un diagnóstico.
import type { Profile } from '../types';
import { bmi } from '../body/composition';

export type FlagLevel = 'urgente' | 'medico' | 'precaucion' | 'info';

export interface SafetyFlag {
  id: string;
  level: FlagLevel;
  title: string;
  detail: string;
  affects: ('deficit' | 'agresivo' | 'hiit' | 'fuerza' | 'suplementos' | 'proteina' | 'hidratacion' | 'cafeina')[];
}

export interface Condition {
  key: string;
  label: string;
}

export const CONDITIONS: Condition[] = [
  { key: 'hipertension', label: 'Hipertensión arterial' },
  { key: 'cardiopatia', label: 'Enfermedad cardiaca / arritmia' },
  { key: 'dolor_pecho', label: 'Dolor de pecho, mareo o desmayo con el esfuerzo' },
  { key: 'diabetes_t1', label: 'Diabetes tipo 1' },
  { key: 'diabetes_t2', label: 'Diabetes tipo 2' },
  { key: 'renal', label: 'Enfermedad renal' },
  { key: 'hepatica', label: 'Enfermedad hepática' },
  { key: 'tiroides', label: 'Trastorno tiroideo' },
  { key: 'tca', label: 'Antecedente de trastorno de la conducta alimentaria' },
  { key: 'embarazo', label: 'Embarazo o lactancia' },
  { key: 'gota', label: 'Gota / ácido úrico elevado' },
  { key: 'asma', label: 'Asma' },
  { key: 'epilepsia', label: 'Epilepsia' },
  { key: 'ansiedad', label: 'Ansiedad / trastorno del sueño' },
  { key: 'anticoagulacion', label: 'Tratamiento anticoagulante' },
  { key: 'insuficiencia_cardiaca', label: 'Insuficiencia cardiaca (restricción de líquidos)' },
  { key: 'osteoporosis', label: 'Osteoporosis' },
  { key: 'hernia', label: 'Hernia (abdominal/inguinal/discal)' },
];

const MED_KEYWORDS: { re: RegExp; flag: Omit<SafetyFlag, 'id'> }[] = [
  {
    re: /insulina|glibenclamida|glimepirida|gliclazida|sulfonilurea/i,
    flag: {
      level: 'medico',
      title: 'Medicamento con riesgo de hipoglucemia',
      detail: 'Un déficit calórico o más ejercicio pueden bajar tu glucosa. Ajusta dosis solo con tu médico antes de iniciar el déficit.',
      affects: ['deficit', 'agresivo'],
    },
  },
  {
    re: /warfarina|acenocumarol|rivaroxab|apixab|dabigatr|clopidogrel|anticoag/i,
    flag: {
      level: 'medico',
      title: 'Anticoagulante / antiagregante',
      detail: 'Omega 3 a dosis altas y otros suplementos pueden interactuar. Consulta antes de suplementar.',
      affects: ['suplementos'],
    },
  },
  {
    re: /losart|enalapril|captopril|amlodip|metoprolol|propranolol|hidroclorot|diur[eé]tic|furosemida|espironolact/i,
    flag: {
      level: 'precaucion',
      title: 'Antihipertensivos / diuréticos',
      detail: 'Pueden alterar frecuencia cardiaca, electrolitos e hidratación. Los betabloqueadores invalidan las zonas de frecuencia cardiaca; usa la escala de esfuerzo (RPE).',
      affects: ['hidratacion', 'suplementos', 'cafeina'],
    },
  },
  {
    re: /litio|levotirox|tetraciclin|doxicicl|ciproflox|levoflox|bifosfonat|alendron/i,
    flag: {
      level: 'precaucion',
      title: 'Medicamentos con interacciones con minerales o cafeína',
      detail: 'El magnesio y otros minerales reducen la absorción de varios fármacos; la cafeína interactúa con el litio. Separa las tomas y consulta con tu médico o farmacéutico.',
      affects: ['suplementos', 'cafeina'],
    },
  },
  {
    re: /isotretino|corticoid|prednison|dexametas/i,
    flag: {
      level: 'precaucion',
      title: 'Medicamento con efectos metabólicos',
      detail: 'Puede afectar peso, retención de líquidos, glucosa o tendones. Coméntalo con tu médico.',
      affects: ['deficit', 'suplementos'],
    },
  },
];

export function screenProfile(p: Profile): SafetyFlag[] {
  const flags: SafetyFlag[] = [];
  const add = (id: string, f: Omit<SafetyFlag, 'id'>) => flags.push({ id, ...f });
  const c = new Set(p.conditions ?? []);

  if (p.age < 18)
    add('menor', {
      level: 'medico',
      title: 'Menor de 18 años',
      detail: 'BODY OS no calcula déficits calóricos para menores. Requiere seguimiento de un profesional de la salud.',
      affects: ['deficit', 'agresivo', 'suplementos'],
    });
  if (c.has('embarazo'))
    add('embarazo', {
      level: 'medico',
      title: 'Embarazo o lactancia',
      detail: 'No se recomiendan déficits calóricos ni suplementos sin indicación médica. El plan se mantiene en calorías de mantenimiento.',
      affects: ['deficit', 'agresivo', 'suplementos', 'hiit'],
    });
  if (c.has('tca'))
    add('tca', {
      level: 'medico',
      title: 'Antecedente de trastorno alimentario',
      detail: 'Contar calorías puede ser contraproducente. Se limita al escenario conservador y se recomienda acompañamiento profesional.',
      affects: ['agresivo'],
    });
  const b = bmi(p.weightKg, p.heightCm);
  if (b < 18.5)
    add('bajo_peso', {
      level: 'medico',
      title: 'IMC bajo (< 18.5)',
      detail: 'No se recomienda déficit calórico. Prioriza mantenimiento o superávit con valoración profesional.',
      affects: ['deficit', 'agresivo'],
    });

  const sys = p.systolic ?? 0;
  const dia = p.diastolic ?? 0;
  if (sys >= 180 || dia >= 120)
    add('pa_crisis', {
      level: 'urgente',
      title: `Presión arterial muy elevada (${sys}/${dia} mmHg)`,
      detail: 'Cifras compatibles con crisis hipertensiva. No hagas ejercicio y busca atención médica inmediata, especialmente si tienes síntomas.',
      affects: ['deficit', 'agresivo', 'hiit', 'fuerza', 'cafeina', 'suplementos'],
    });
  else if (sys >= 140 || dia >= 90)
    add('pa_alta', {
      level: 'medico',
      title: `Presión arterial elevada (${sys}/${dia} mmHg)`,
      detail: 'Requiere valoración médica antes de entrenamiento de alta intensidad (HIIT, cargas máximas) y antes de usar cafeína como suplemento.',
      affects: ['hiit', 'cafeina'],
    });
  else if (sys >= 130 || dia >= 80)
    add('pa_limite', {
      level: 'precaucion',
      title: `Presión arterial en rango elevado (${sys}/${dia} mmHg)`,
      detail: 'Vigila tus cifras; el ejercicio regular y la pérdida de grasa suelen ayudar a reducirla.',
      affects: ['cafeina'],
    });
  if (c.has('hipertension') && !(sys >= 140 || dia >= 90))
    add('hta_dx', {
      level: 'precaucion',
      title: 'Hipertensión diagnosticada',
      detail: 'Evita maniobras de Valsalva prolongadas, limita la cafeína y sigue el control de tu médico.',
      affects: ['cafeina', 'hiit'],
    });
  if (c.has('cardiopatia') || c.has('dolor_pecho') || c.has('insuficiencia_cardiaca'))
    add('cardio', {
      level: 'medico',
      title: 'Condición cardiaca o síntomas con el esfuerzo',
      detail: 'Necesitas autorización médica (idealmente prueba de esfuerzo) antes de iniciar o intensificar el ejercicio. HIIT deshabilitado.',
      affects: ['hiit', 'fuerza', 'agresivo', 'cafeina', 'suplementos'],
    });
  if (c.has('diabetes_t1') || c.has('diabetes_t2'))
    add('diabetes', {
      level: c.has('diabetes_t1') ? 'medico' : 'precaucion',
      title: 'Diabetes',
      detail: 'El déficit y el ejercicio modifican la glucosa. Monitorea tu glucemia y coordina cambios de medicación con tu médico.',
      affects: ['deficit', 'agresivo'],
    });
  if (c.has('renal'))
    add('renal', {
      level: 'medico',
      title: 'Enfermedad renal',
      detail: 'La proteína alta, la creatina, el magnesio, los electrolitos y la cantidad de líquidos deben definirse con tu nefrólogo.',
      affects: ['proteina', 'suplementos', 'hidratacion'],
    });
  if (c.has('hepatica'))
    add('hepatica', {
      level: 'medico',
      title: 'Enfermedad hepática',
      detail: 'Consulta antes de cualquier suplemento y de cambios importantes en la dieta.',
      affects: ['suplementos', 'proteina'],
    });
  if (c.has('insuficiencia_cardiaca') || p.fluidRestrictionMl)
    add('liquidos', {
      level: 'medico',
      title: 'Restricción de líquidos',
      detail: 'La meta de hidratación se limita a lo que indique tu médico.',
      affects: ['hidratacion'],
    });
  if (c.has('gota'))
    add('gota', {
      level: 'precaucion',
      title: 'Gota / ácido úrico',
      detail: 'Una pérdida de peso muy rápida puede desencadenar crisis. Se evita el escenario agresivo.',
      affects: ['agresivo'],
    });
  if (c.has('epilepsia') || c.has('ansiedad'))
    add('cafeina_neuro', {
      level: 'precaucion',
      title: 'Sensibilidad a estimulantes',
      detail: 'La cafeína puede empeorar ansiedad, sueño o umbral convulsivo.',
      affects: ['cafeina'],
    });
  if (c.has('hernia') || c.has('osteoporosis'))
    add('carga', {
      level: 'precaucion',
      title: 'Precaución con cargas axiales',
      detail: 'Se priorizan ejercicios con soporte y máquinas. Consulta con tu médico o fisioterapeuta qué cargas son seguras.',
      affects: ['fuerza'],
    });
  for (const m of MED_KEYWORDS) {
    if (p.medications && m.re.test(p.medications)) add(`med_${m.flag.title}`, m.flag);
  }
  if (p.professionalRestrictions?.trim())
    add('restricciones', {
      level: 'info',
      title: 'Restricciones indicadas por profesionales',
      detail: `Prevalecen sobre cualquier recomendación de BODY OS: "${p.professionalRestrictions.trim()}"`,
      affects: [],
    });
  return flags;
}

export function isBlocked(flags: SafetyFlag[], what: SafetyFlag['affects'][number]): boolean {
  return flags.some((f) => (f.level === 'urgente' || f.level === 'medico') && f.affects.includes(what));
}

export function affected(flags: SafetyFlag[], what: SafetyFlag['affects'][number]): SafetyFlag[] {
  return flags.filter((f) => f.affects.includes(what));
}

/** Calorías mínimas sin supervisión profesional. */
export function calorieFloor(sex: Profile['sex']): number {
  return sex === 'hombre' ? 1500 : 1200;
}
