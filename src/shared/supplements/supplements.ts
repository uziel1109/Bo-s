// Suplementación basada en evidencia. Ningún suplemento se recomienda por defecto: cada uno se clasifica
// según tu perfil, tu alimentación registrada y tus banderas de salud.
import type { Profile } from '../types';
import { affected, isBlocked, type SafetyFlag } from '../safety/screening';

export type SuppClass = 'util' | 'opcional' | 'no_necesario' | 'valoracion';

export const CLASS_LABEL: Record<SuppClass, string> = {
  util: 'Útil según tu situación',
  opcional: 'Opcional',
  no_necesario: 'No necesario',
  valoracion: 'Requiere valoración profesional',
};

export interface Supplement {
  key: string;
  name: string;
  benefit: string;
  evidence: string;
  evidenceLevel: 'alta' | 'moderada' | 'baja';
  dose: string;
  timing: string;
  sideEffects: string[];
  contraindications: string[];
  interactions: string[];
  refs: string[];
}

export const SUPPLEMENTS: Supplement[] = [
  {
    key: 'creatina',
    name: 'Creatina monohidratada',
    benefit: 'Aumenta la fuerza y el rendimiento en esfuerzos repetidos de alta intensidad; potencia las ganancias de masa magra con el entrenamiento de fuerza y ayuda a conservarla en déficit.',
    evidence: 'Es el suplemento ergogénico con mayor respaldo: decenas de ensayos y metaanálisis; perfil de seguridad favorable en personas sanas.',
    evidenceLevel: 'alta',
    dose: '3–5 g al día (la fase de carga no es necesaria).',
    timing: 'Cualquier momento del día; lo importante es la constancia.',
    sideEffects: ['Aumento de 0.5–2 kg de peso por agua intramuscular (no es grasa).', 'Molestias digestivas ocasionales con dosis grandes.'],
    contraindications: ['Enfermedad renal o función renal disminuida (requiere valoración).'],
    interactions: ['Fármacos nefrotóxicos (p. ej., AINE en uso crónico): consultar.', 'La creatinina sérica puede elevarse en análisis sin indicar daño renal: avisa a tu médico que la tomas.'],
    refs: ['kreider2017'],
  },
  {
    key: 'proteina',
    name: 'Proteína en polvo (suero, caseína o vegetal)',
    benefit: 'Solo es un alimento práctico para alcanzar tu meta de proteína. No tiene efecto adicional si ya la cubres con comida.',
    evidence: 'Útil cuando la ingesta dietética de proteína es insuficiente; el beneficio proviene de la proteína total diaria.',
    evidenceLevel: 'alta',
    dose: 'Lo necesario para completar tu meta diaria (habitualmente 20–40 g por porción).',
    timing: 'Cuando sea práctico; repartir la proteína en 3–5 tomas es razonable.',
    sideEffects: ['Molestias digestivas con proteína de suero concentrada si hay intolerancia a la lactosa (el aislado suele tolerarse mejor).'],
    contraindications: ['Enfermedad renal con restricción proteica.', 'Alergia a la leche (usar proteína vegetal).'],
    interactions: ['Sin interacciones relevantes conocidas; elegir productos con certificación de terceros reduce el riesgo de contaminación.'],
    refs: ['jager2017', 'morton2018'],
  },
  {
    key: 'vitamina_d',
    name: 'Vitamina D',
    benefit: 'Corrige una deficiencia si existe. En personas sin deficiencia no mejora la composición corporal ni el rendimiento.',
    evidence: 'La guía de la Endocrine Society (2024) no recomienda análisis ni suplementación rutinaria en adultos sanos < 75 años más allá de la ingesta recomendada.',
    evidenceLevel: 'moderada',
    dose: 'Ingesta recomendada: 600 UI/día (19–70 años), 800 UI (> 70). Dosis mayores solo con análisis y prescripción.',
    timing: 'Con una comida que contenga grasa.',
    sideEffects: ['A dosis altas sostenidas: hipercalcemia, náusea, daño renal.'],
    contraindications: ['Hipercalcemia, sarcoidosis, enfermedad renal: solo con indicación médica.'],
    interactions: ['Diuréticos tiazídicos (riesgo de hipercalcemia).', 'Corticoides, orlistat y algunos antiepilépticos reducen su absorción o metabolismo.'],
    refs: ['iom2011', 'demay2024', 'ods'],
  },
  {
    key: 'omega3',
    name: 'Omega 3 (EPA/DHA)',
    benefit: 'Puede ser útil si consumes muy poco pescado graso. No acelera la pérdida de grasa ni la ganancia muscular de forma relevante.',
    evidence: 'La evidencia de beneficio cardiovascular en población general sin enfermedad es limitada (AHA 2017). Se prefiere comer pescado 2 veces por semana.',
    evidenceLevel: 'moderada',
    dose: '250–500 mg/día de EPA+DHA como referencia general; dosis de gramos solo con indicación médica.',
    timing: 'Con comidas para reducir molestias digestivas.',
    sideEffects: ['Eructos con sabor a pescado, molestias digestivas.', 'A dosis altas, mayor riesgo de sangrado y de fibrilación auricular.'],
    contraindications: ['Trastornos de coagulación o cirugía próxima.'],
    interactions: ['Anticoagulantes y antiagregantes (warfarina, clopidogrel, etc.).', 'Antihipertensivos (efecto aditivo leve).'],
    refs: ['siscovick2017', 'ods'],
  },
  {
    key: 'magnesio',
    name: 'Magnesio',
    benefit: 'Solo corrige una ingesta insuficiente. No mejora el sueño, la fuerza ni la composición corporal en personas con ingesta adecuada.',
    evidence: 'Sin evidencia sólida de beneficio ergogénico en personas sin deficiencia.',
    evidenceLevel: 'baja',
    dose: 'Prioriza alimentos (leguminosas, semillas, verduras de hoja, cereales integrales). Si se suplementa, no superar 350 mg/día de magnesio de suplementos sin indicación.',
    timing: 'Separado al menos 2 h de antibióticos, levotiroxina y bifosfonatos.',
    sideEffects: ['Diarrea y molestias digestivas (sobre todo óxido y citrato).'],
    contraindications: ['Enfermedad renal: riesgo de acumulación.'],
    interactions: ['Antibióticos (tetraciclinas, quinolonas), bifosfonatos, levotiroxina: reduce su absorción.', 'Diuréticos e inhibidores de bomba de protones alteran sus niveles.'],
    refs: ['iom1997', 'ods'],
  },
  {
    key: 'cafeina',
    name: 'Cafeína',
    benefit: 'Mejora el rendimiento y reduce la percepción de esfuerzo; puede ayudar a sostener la intensidad del entrenamiento en déficit.',
    evidence: 'Respaldo sólido (posición de la ISSN 2021); la respuesta individual es variable.',
    evidenceLevel: 'alta',
    dose: '3–6 mg/kg ~60 min antes del ejercicio; empezar con la dosis baja. No superar ~400 mg/día en total (incluye café).',
    timing: 'Evitar en las 6–8 h previas a dormir.',
    sideEffects: ['Insomnio, ansiedad, taquicardia, molestias digestivas, aumento transitorio de la presión arterial.'],
    contraindications: ['Hipertensión no controlada, arritmias, embarazo, ansiedad o insomnio importantes.'],
    interactions: ['Litio, algunos antidepresivos (fluvoxamina), ciprofloxacino, teofilina, estimulantes.'],
    refs: ['guest2021', 'efsa2015caf'],
  },
  {
    key: 'electrolitos',
    name: 'Electrolitos (sodio, potasio)',
    benefit: 'Útiles en sesiones largas o calurosas con sudoración abundante. En entrenamientos de fuerza habituales no aportan beneficio.',
    evidence: 'Recomendados por el ACSM cuando hay grandes pérdidas por sudor (> 60–90 min).',
    evidenceLevel: 'moderada',
    dose: '≈300–600 mg de sodio por hora de ejercicio prolongado, o una comida salada después.',
    timing: 'Durante o después de la sesión prolongada.',
    sideEffects: ['Exceso de sodio en personas con hipertensión.'],
    contraindications: ['Hipertensión, enfermedad renal o cardiaca: solo con indicación médica.'],
    interactions: ['Diuréticos, antihipertensivos (IECA/ARA-II con potasio).'],
    refs: ['sawka2007'],
  },
  {
    key: 'beta_alanina',
    name: 'Beta-alanina',
    benefit: 'Mejora esfuerzos de alta intensidad de 1 a 4 minutos. Poco relevante para hipertrofia o pérdida de grasa.',
    evidence: 'Evidencia moderada para esfuerzos de esa duración; efecto pequeño en series típicas de fuerza.',
    evidenceLevel: 'moderada',
    dose: '3.2–6.4 g/día repartidos, durante ≥ 4 semanas.',
    timing: 'Indiferente; repartir reduce el hormigueo.',
    sideEffects: ['Parestesias (hormigueo) transitorias.'],
    contraindications: [],
    interactions: ['Sin interacciones relevantes conocidas.'],
    refs: ['trexler2015'],
  },
];

/** Sustancias que BODY OS nunca recomienda. */
export const NOT_RECOMMENDED: { name: string; why: string }[] = [
  { name: '"Quemadores de grasa" comerciales', why: 'Sin evidencia de pérdida de grasa relevante; con frecuencia contienen estimulantes en dosis no declaradas.' },
  { name: 'Esteroides anabólicos, prohormonas y SARMs', why: 'Riesgos cardiovasculares, hepáticos, hormonales y psiquiátricos; ilegales sin prescripción.' },
  { name: 'Clenbuterol, efedrina, DNP, sinefrina a dosis altas, yohimbina', why: 'Riesgo de arritmias, hipertermia y muerte. Algunos están prohibidos.' },
  { name: 'Diuréticos o laxantes para "bajar de peso"', why: 'Solo eliminan agua; causan deshidratación y alteraciones de electrolitos.' },
  { name: 'Productos "detox"', why: 'No tienen respaldo científico; el hígado y los riñones cumplen esa función.' },
];

export interface SuppContext {
  proteinTarget: number;
  avgProteinIntake: number | null; // promedio 7 días de lo registrado
  loggedDays: number;
  trainingMinutes: number;
  weightKg: number;
}

export interface SuppAssessment {
  supplement: Supplement;
  cls: SuppClass;
  reasons: string[];
  personalDose?: string;
}

export function assessSupplements(p: Profile, flags: SafetyFlag[], ctx: SuppContext): SuppAssessment[] {
  const suppBlocked = isBlocked(flags, 'suplementos');
  const renal = (p.conditions ?? []).includes('renal');
  const pregnant = (p.conditions ?? []).includes('embarazo');
  const meds = (p.medications ?? '').trim().length > 0;
  const res: SuppAssessment[] = [];
  const out = (s: Supplement, cls: SuppClass, reasons: string[], personalDose?: string) => res.push({ supplement: s, cls, reasons, personalDose });
  const get = (k: string) => SUPPLEMENTS.find((s) => s.key === k)!;

  // Creatina
  {
    const s = get('creatina');
    if (renal || pregnant || p.age < 18) out(s, 'valoracion', ['Tu condición (renal, embarazo o edad) requiere valoración antes de usarla.']);
    else if (suppBlocked) out(s, 'valoracion', ['Tienes hallazgos de salud que requieren consultar cualquier suplemento.']);
    else out(s, 'util', ['Entrenas fuerza y buscas conservar músculo en déficit: es el suplemento con mejor evidencia para ese objetivo.', meds ? 'Comenta con tu médico que tomas creatina por tus medicamentos actuales.' : 'Sin contraindicaciones registradas.'], '3–5 g/día');
  }
  // Proteína
  {
    const s = get('proteina');
    if (renal) out(s, 'valoracion', ['Con enfermedad renal la proteína total debe definirla tu nefrólogo.']);
    else if (ctx.avgProteinIntake == null || ctx.loggedDays < 3) out(s, 'opcional', ['Aún no hay suficientes registros de comida para saber si cubres tu meta de proteína. Primero intenta cubrirla con alimentos.']);
    else if (ctx.avgProteinIntake < ctx.proteinTarget * 0.85) {
      const gap = Math.round(ctx.proteinTarget - ctx.avgProteinIntake);
      out(s, 'util', [`Tu promedio registrado es ${Math.round(ctx.avgProteinIntake)} g/día frente a una meta de ${ctx.proteinTarget} g (faltan ~${gap} g).`, 'Puedes cubrirlo con comida o con una porción de proteína en polvo si es más práctico.'], `≈${Math.max(20, Math.min(50, gap))} g de proteína al día`);
    } else out(s, 'no_necesario', [`Ya cubres tu meta de proteína con alimentos (${Math.round(ctx.avgProteinIntake)} g/día).`]);
  }
  // Vitamina D
  out(get('vitamina_d'), 'valoracion', ['Solo tiene sentido si existe deficiencia o un factor de riesgo (poca exposición solar, piel oscura, obesidad, malabsorción). Decide con tu médico si conviene un análisis de 25(OH)D.']);
  // Omega 3
  {
    const s = get('omega3');
    const anticoag = /warfarina|acenocumarol|rivaroxab|apixab|dabigatr|clopidogrel|anticoag/i.test(p.medications ?? '') || (p.conditions ?? []).includes('anticoagulacion');
    if (anticoag) out(s, 'valoracion', ['Tomas anticoagulantes/antiagregantes: el omega 3 puede aumentar el riesgo de sangrado.']);
    else if ((p.fishServingsPerWeek ?? 0) >= 2) out(s, 'no_necesario', [`Consumes pescado ${p.fishServingsPerWeek} veces por semana: cubre la recomendación general.`]);
    else out(s, 'opcional', ['Consumes poco pescado. Lo preferible es incluir pescado (sardina, salmón, atún) 2 veces por semana; un suplemento es una alternativa razonable.'], '250–500 mg EPA+DHA');
  }
  // Magnesio
  {
    const s = get('magnesio');
    if (renal) out(s, 'valoracion', ['Con enfermedad renal el magnesio puede acumularse.']);
    else if (/tetraciclin|doxicicl|ciproflox|levoflox|levotirox|bifosfonat|alendron/i.test(p.medications ?? '')) out(s, 'valoracion', ['Interactúa con medicamentos que registraste: consulta a tu médico o farmacéutico.']);
    else out(s, 'no_necesario', ['Sin indicios de deficiencia. Prioriza frijoles, semillas, verduras de hoja y avena, que ya están en tu plan.']);
  }
  // Cafeína
  {
    const s = get('cafeina');
    const cafFlags = affected(flags, 'cafeina');
    if (pregnant || cafFlags.some((f) => f.level === 'urgente' || f.level === 'medico')) out(s, 'valoracion', ['Tus datos de presión arterial, condiciones o medicamentos requieren valoración antes de usar cafeína como suplemento.']);
    else if (cafFlags.length) out(s, 'opcional', ['Opcional con precaución: ' + cafFlags.map((f) => f.title).join('; ') + '. Usa la dosis baja y vigila tu respuesta.'], `${Math.round(ctx.weightKg * 3)} mg máx. antes de entrenar`);
    else out(s, 'opcional', ['Puede ayudarte a mantener la intensidad. No es necesaria: el café habitual también sirve.'], `${Math.round(ctx.weightKg * 3)}–${Math.min(400, Math.round(ctx.weightKg * 6))} mg ~60 min antes`);
  }
  // Electrolitos
  {
    const s = get('electrolitos');
    if (renal || (p.conditions ?? []).includes('hipertension') || (p.conditions ?? []).includes('insuficiencia_cardiaca')) out(s, 'valoracion', ['Tu condición requiere que el sodio y el potasio los indique tu médico.']);
    else if (ctx.trainingMinutes >= 75 || (p.ambientTempC >= 28 && p.sweatLevel === 'alto')) out(s, 'opcional', ['Tus sesiones son largas o calurosas con sudoración alta: pueden ayudar en esos días.']);
    else out(s, 'no_necesario', ['Tus sesiones duran menos de 75 min: la alimentación cubre las pérdidas.']);
  }
  out(get('beta_alanina'), 'no_necesario', ['Su beneficio es para esfuerzos de 1–4 minutos; no aporta de forma relevante a tu objetivo de hipertrofia y pérdida de grasa.']);
  return res;
}
