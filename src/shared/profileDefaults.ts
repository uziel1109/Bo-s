import type { Profile } from './types';

/** Valores PROVISIONALES para el asistente de configuración. El usuario los reemplaza con sus datos. */
export function defaultProfile(): Profile {
  return {
    name: '',
    age: 30,
    sex: 'hombre',
    heightCm: 175,
    weightKg: 85,
    targetWeightKg: null,
    waistCm: null,
    neckCm: null,
    hipCm: null,
    knownBodyFat: null,
    knownBodyFatMethod: null,
    targetBodyFat: 20,
    activityLevel: 'ligero',
    occupation: '',
    trainingSchedule: '',
    trainingDays: [1, 2, 4, 5],
    sessionMinutes: 60,
    experience: 'principiante',
    trainingHistory: '',
    equipment: ['barra', 'mancuernas', 'maquinas', 'poleas', 'banco', 'barra_dominadas', 'rack'],
    gymAccess: true,
    priorityMuscles: [],
    injuries: [],
    injuryNotes: '',
    cardioFitness: 'media',
    excludedExercises: [],
    preferredSplit: 'auto',
    preferredFoods: [],
    excludedFoods: [],
    allergies: [],
    budget: 'medio',
    mealsPerDay: 4,
    mealTimes: ['08:00', '14:00', '17:30', '20:30'],
    country: 'México',
    currency: 'MXN',
    localFoodsNotes: '',
    fishServingsPerWeek: 1,
    medications: '',
    conditions: [],
    conditionsNotes: '',
    systolic: null,
    diastolic: null,
    medicalHistory: '',
    professionalRestrictions: '',
    fluidRestrictionMl: null,
    ambientTempC: 24,
    sweatLevel: 'medio',
    scenario: 'moderado',
  };
}

export function validateProfile(p: Profile): string[] {
  const e: string[] = [];
  if (!(p.age >= 14 && p.age <= 100)) e.push('Edad entre 14 y 100 años.');
  if (!(p.heightCm >= 120 && p.heightCm <= 230)) e.push('Estatura entre 120 y 230 cm.');
  if (!(p.weightKg >= 35 && p.weightKg <= 300)) e.push('Peso entre 35 y 300 kg.');
  if (p.waistCm != null && !(p.waistCm >= 40 && p.waistCm <= 250)) e.push('Cintura entre 40 y 250 cm.');
  if (p.neckCm != null && !(p.neckCm >= 20 && p.neckCm <= 70)) e.push('Cuello entre 20 y 70 cm.');
  if (p.hipCm != null && !(p.hipCm >= 50 && p.hipCm <= 250)) e.push('Cadera entre 50 y 250 cm.');
  if (p.knownBodyFat != null && !(p.knownBodyFat >= 3 && p.knownBodyFat <= 65)) e.push('% de grasa entre 3 y 65.');
  if (!(p.targetBodyFat >= 8 && p.targetBodyFat <= 40)) e.push('El % de grasa objetivo debe estar entre 8 y 40.');
  if (p.sex === 'hombre' && p.targetBodyFat < 8) e.push('Un objetivo menor a 8 % no es saludable a largo plazo.');
  if (p.sex === 'mujer' && p.targetBodyFat < 15) e.push('Para mujeres, un objetivo menor a 15 % puede comprometer la salud hormonal; consulta a un profesional.');
  if (!(p.mealsPerDay >= 2 && p.mealsPerDay <= 6)) e.push('Comidas por día entre 2 y 6.');
  if (!(p.sessionMinutes >= 20 && p.sessionMinutes <= 180)) e.push('Duración de sesión entre 20 y 180 minutos.');
  if (p.systolic != null && !(p.systolic >= 70 && p.systolic <= 260)) e.push('Presión sistólica fuera de rango.');
  if (p.diastolic != null && !(p.diastolic >= 40 && p.diastolic <= 160)) e.push('Presión diastólica fuera de rango.');
  return e;
}
