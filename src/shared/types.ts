// Tipos de dominio compartidos entre el proceso principal, la interfaz y las pruebas.

export type Sex = 'hombre' | 'mujer';
export type ActivityLevel = 'sedentario' | 'ligero' | 'moderado' | 'alto' | 'muy_alto';
export type Experience = 'principiante' | 'intermedio' | 'avanzado';
export type CardioFitness = 'baja' | 'media' | 'alta';
export type SweatLevel = 'bajo' | 'medio' | 'alto';
export type ScenarioKey = 'conservador' | 'moderado' | 'agresivo';

/** Tipo epistemológico de cada afirmación que muestra el sistema. */
export type ClaimKind = 'dato' | 'estimacion' | 'hipotesis' | 'recomendacion';

export type Equipment =
  | 'barra'
  | 'mancuernas'
  | 'maquinas'
  | 'poleas'
  | 'banco'
  | 'barra_dominadas'
  | 'peso_corporal'
  | 'bandas'
  | 'kettlebell'
  | 'rack';

export type BodyRegion = 'hombro' | 'codo' | 'muneca' | 'lumbar' | 'cadera' | 'rodilla' | 'tobillo' | 'cuello';

export type Muscle =
  | 'pecho'
  | 'dorsales'
  | 'espalda_alta'
  | 'hombro_anterior'
  | 'hombro_lateral'
  | 'hombro_posterior'
  | 'biceps'
  | 'triceps'
  | 'antebrazo'
  | 'cuadriceps'
  | 'isquiotibiales'
  | 'gluteos'
  | 'aductores'
  | 'pantorrillas'
  | 'abdomen'
  | 'lumbares';

export type BodyFatMethod =
  | 'dexa'
  | 'bodpod'
  | 'pesaje_hidrostatico'
  | 'bioimpedancia'
  | 'plicometria'
  | 'navy'
  | 'rfm'
  | 'cun_bae'
  | 'visual';

export interface Profile {
  // Personal
  name: string;
  age: number;
  sex: Sex;
  heightCm: number;
  weightKg: number;
  targetWeightKg?: number | null;
  waistCm?: number | null;
  neckCm?: number | null;
  hipCm?: number | null;
  knownBodyFat?: number | null;
  knownBodyFatMethod?: BodyFatMethod | null;
  targetBodyFat: number; // % (por defecto 20)
  activityLevel: ActivityLevel;
  occupation: string;
  trainingSchedule: string; // texto libre, p.ej. "Lun-Vie 7:00"
  trainingDays: number[]; // 0=Dom .. 6=Sáb
  sessionMinutes: number;
  // Físico
  experience: Experience;
  trainingHistory: string;
  equipment: Equipment[];
  gymAccess: boolean;
  priorityMuscles: Muscle[];
  injuries: BodyRegion[];
  injuryNotes: string;
  cardioFitness: CardioFitness;
  excludedExercises: string[]; // ids
  preferredSplit?: 'auto' | 'full_body' | 'upper_lower' | 'ppl';
  // Nutrición
  preferredFoods: string[]; // ids de alimentos
  excludedFoods: string[]; // ids de alimentos
  allergies: string[]; // etiquetas: lacteos, gluten, huevo, pescado, mariscos, frutos_secos, cacahuate, soya
  budget: 'bajo' | 'medio' | 'alto';
  mealsPerDay: number; // 2..6
  mealTimes: string[]; // "08:00" ...
  country: string;
  currency: string;
  localFoodsNotes: string;
  fishServingsPerWeek: number;
  // Salud
  medications: string;
  conditions: string[]; // claves de condiciones
  conditionsNotes: string;
  systolic?: number | null;
  diastolic?: number | null;
  medicalHistory: string;
  professionalRestrictions: string;
  fluidRestrictionMl?: number | null;
  // Entorno
  ambientTempC: number;
  sweatLevel: SweatLevel;
  // Preferencias de plan
  scenario: ScenarioKey;
  createdAt?: string;
}

export interface BodyLog {
  id: string;
  date: string; // YYYY-MM-DD
  weight?: number | null;
  waist?: number | null;
  abdomen?: number | null;
  neck?: number | null;
  chest?: number | null;
  hip?: number | null;
  arm?: number | null;
  thigh?: number | null;
  calf?: number | null;
  bf_percent?: number | null;
  bf_method?: BodyFatMethod | null;
  notes?: string | null;
}

export interface Food {
  id: string;
  name: string;
  category: FoodCategory;
  kcal: number; // por 100 g
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  unit_name?: string | null; // "pieza", "taza"...
  unit_grams?: number | null;
  source: string;
  verified: number; // 0/1: 1 = verificado por el usuario o con etiqueta
  custom: number; // 0/1
  barcode?: string | null;
  tags?: string | null; // JSON array de etiquetas (alérgenos, economico)
  price_per_kg?: number | null;
}

export type FoodCategory =
  | 'proteina'
  | 'lacteo'
  | 'leguminosa'
  | 'cereal'
  | 'tuberculo'
  | 'fruta'
  | 'verdura'
  | 'grasa'
  | 'otro';

export type MealSlot = 'desayuno' | 'colacion1' | 'comida' | 'colacion2' | 'cena' | 'extra';

export interface FoodLog {
  id: string;
  date: string;
  meal: MealSlot;
  food_id?: string | null;
  name: string;
  grams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  created_at?: string;
}

export interface Macros {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export interface NutritionTargets extends Macros {
  tdee: number;
  bmr: number;
  deficit: number;
  deficitPct: number;
  weeklyRatePct: number;
  proteinPerKg: number;
  rationale: string[];
  floorApplied: boolean;
  method: string;
}

export interface WaterLog {
  id: string;
  date: string;
  time: string;
  ml: number;
  context?: string | null; // 'general' | 'entreno'
}

export interface CardioLog {
  id: string;
  date: string;
  modality: CardioModality;
  minutes: number;
  intensity: 'baja' | 'moderada' | 'alta' | 'intervalos';
  avg_hr?: number | null;
  distance_km?: number | null;
  rpe?: number | null;
  device_kcal?: number | null;
  notes?: string | null;
}

export type CardioModality =
  | 'caminata'
  | 'bicicleta_estatica'
  | 'ciclismo'
  | 'caminadora'
  | 'eliptica'
  | 'remo'
  | 'natacion'
  | 'otro';

export interface StepsLog {
  date: string;
  steps: number;
}

export interface RecoveryLog {
  date: string;
  sleep_hours?: number | null;
  sleep_quality?: number | null; // 1-5
  energy?: number | null; // 1-5
  soreness?: number | null; // 1-5 (5 = mucho dolor muscular)
  stress?: number | null; // 1-5
  notes?: string | null;
}

export interface SetLog {
  weight: number;
  reps: number;
  rir?: number | null;
  rpe?: number | null;
  rest_s?: number | null;
  done: boolean;
  pain?: boolean;
}

export interface ExerciseLog {
  exerciseId: string;
  name: string;
  targetSets: number;
  repMin: number;
  repMax: number;
  targetRir: number;
  sets: SetLog[];
  pain?: string | null;
  notes?: string | null;
}

export interface WorkoutSession {
  id: string;
  date: string;
  routine_id?: string | null;
  day_key?: string | null;
  day_name?: string | null;
  exercises: ExerciseLog[];
  notes?: string | null;
  duration_min?: number | null;
  session_rpe?: number | null;
  completed: number;
}

export interface Adjustment {
  id: string;
  created_at: string;
  kind: 'calorias' | 'macros' | 'rutina' | 'volumen' | 'cardio' | 'actividad' | 'recuperacion';
  title: string;
  justification: string[];
  payload: Record<string, unknown>;
  status: 'pendiente' | 'aceptado' | 'rechazado';
  resolved_at?: string | null;
}

export interface Claim {
  kind: ClaimKind;
  text: string;
}
