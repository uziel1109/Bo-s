// Estado global de la interfaz: carga los registros desde la base local y calcula el estado del motor.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api } from './api';
import { computeState, noTrainingActive, type ActivePlan, type AppData, type EngineState, type NoTrainingMode } from '@shared/engine';
import type { Adjustment, BodyLog, CardioLog, Food, FoodLog, Profile, RecoveryLog, StepsLog, WaterLog, WorkoutSession } from '@shared/types';
import type { Routine } from '@shared/training/generator';
import type { MealPlan } from '@shared/nutrition/mealPlanner';
import type { StackItem } from '@shared/calendar';
import type { PhaseSettings } from '@shared/nutrition/phases';
import type { MealRating } from '@shared/analytics/satiety';
import type { MuscleFeedback } from '@shared/training/hypertrophy';
import { today as todayFn, uid } from '@shared/utils';

export interface PhotoRow {
  id: string;
  date: string;
  pose: 'frente' | 'perfil' | 'espalda';
  file_name: string;
  conditions: { light?: string; time?: string; clothing?: string; distance?: string; fasted?: boolean } | null;
  notes: string | null;
}

export interface Store {
  loading: boolean;
  error: string | null;
  today: string;
  profile: Profile | null;
  foods: Food[];
  data: AppData | null;
  state: EngineState | null;
  mealPlan: (MealPlan & { id: string }) | null;
  routineId: string | null;
  pausedRoutine: Routine | null;
  stack: (StackItem & { id: string })[];
  supplementLogs: { id: string; date: string; supplement_key: string; name: string; dose: string }[];
  photos: PhotoRow[];
  recipes: { id: string; name: string; items: { foodId: string; grams: number }[]; servings: number; notes: string | null }[];
  favorites: { id: string; name: string; items: { foodId: string | null; name: string; grams: number; kcal: number; protein: number; carbs: number; fat: number; fiber: number }[] }[];
  mealRatings: MealRating[];
  muscleFeedback: MuscleFeedback[];
  calendarTasks: { id: string; date: string; task_key: string; title: string; type: string; done: number; custom: number }[];
  settings: Record<string, unknown>;
  reload: () => Promise<void>;
  saveProfile: (p: Profile) => Promise<void>;
  setSetting: (k: string, v: unknown) => Promise<void>;
  activatePlan: (plan: Omit<ActivePlan, 'id' | 'created_at'>) => Promise<void>;
  toast: (msg: string, kind?: 'ok' | 'error') => void;
  toasts: { id: string; msg: string; kind: 'ok' | 'error' }[];
}

const Ctx = createContext<Store | null>(null);

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('Store no disponible');
  return s;
}

/** Atajo: datos ya cargados (solo usar dentro de la app con perfil configurado). */
export function useApp() {
  const s = useStore();
  return { ...s, data: s.data!, state: s.state!, profile: s.profile! };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [today, setToday] = useState(todayFn());
  const [raw, setRaw] = useState<Omit<Store, 'loading' | 'error' | 'today' | 'state' | 'reload' | 'saveProfile' | 'setSetting' | 'activatePlan' | 'toast' | 'toasts'> | null>(null);
  const [toasts, setToasts] = useState<Store['toasts']>([]);
  const setSettingRef = useRef<((k: string, v: unknown) => Promise<void>) | null>(null);

  const toast = useCallback((msg: string, kind: 'ok' | 'error' = 'ok') => {
    const id = uid();
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 6000 : 3200);
  }, []);

  const reload = useCallback(async () => {
    try {
      const [profileRow, foods, bodyLogs, foodLogs, waterLogs, cardioLogs, stepsLogs, recoveryLogs, sessions, routines, plans, adjustments, mealPlans, stack, supplementLogs, photos, recipes, favorites, calendarTasks, settingsRows, mealRatings, muscleFeedback] = await Promise.all([
        api.get<{ data: Profile }>('profile', 1),
        api.list<Food>('foods', { orderBy: { column: 'name' } }),
        api.list<BodyLog>('body_logs', { orderBy: { column: 'date' } }),
        api.list<FoodLog>('food_logs', { orderBy: { column: 'created_at' } }),
        api.list<WaterLog>('water_logs', { orderBy: { column: 'time' } }),
        api.list<CardioLog>('cardio_logs', { orderBy: { column: 'date' } }),
        api.list<StepsLog>('steps_logs', { orderBy: { column: 'date' } }),
        api.list<RecoveryLog>('recovery_logs', { orderBy: { column: 'date' } }),
        api.list<WorkoutSession>('workout_sessions', { orderBy: { column: 'date' } }),
        api.list<{ id: string; active: number; data: Routine }>('routines', { where: { active: 1 } }),
        api.list<{ id: string; created_at: string; active: number; scenario: string; targets: ActivePlan['targets']; reason: string }>('nutrition_plans', { where: { active: 1 } }),
        api.list<Adjustment>('adjustments', { orderBy: { column: 'created_at', dir: 'DESC' } }),
        api.list<{ id: string; data: MealPlan }>('meal_plans', { where: { active: 1 } }),
        api.list<StackItem & { id: string }>('supplement_stack'),
        api.list<Store['supplementLogs'][number]>('supplement_logs', { orderBy: { column: 'date', dir: 'DESC' } }),
        api.list<PhotoRow>('photos', { orderBy: { column: 'date' } }),
        api.list<Store['recipes'][number]>('recipes', { orderBy: { column: 'name' } }),
        api.list<Store['favorites'][number]>('favorites', { orderBy: { column: 'name' } }),
        api.list<Store['calendarTasks'][number]>('calendar_tasks'),
        api.list<{ key: string; value: unknown }>('settings'),
        api.list<MealRating>('meal_ratings', { orderBy: { column: 'date' } }),
        api.list<MuscleFeedback>('muscle_feedback', { orderBy: { column: 'date' } }),
      ]);
      const profile = profileRow?.data ?? null;
      const routine = routines[0] ? { ...routines[0].data, id: routines[0].id } : null;
      const plan = plans[0] ? { id: plans[0].id, created_at: plans[0].created_at, targets: plans[0].targets, scenario: plans[0].scenario as ActivePlan['scenario'], reason: plans[0].reason } : null;
      const settingsMap = Object.fromEntries(settingsRows.map((r) => [r.key, r.value]));
      const noTraining = (settingsMap.no_training as NoTrainingMode | undefined) ?? null;
      // En modo sin entrenamiento la rutina queda en pausa: ni el motor ni el calendario la programan.
      const paused = noTrainingActive(noTraining, todayFn());
      const data: AppData | null = profile
        ? { profile, bodyLogs, foodLogs, waterLogs, cardioLogs, stepsLogs, recoveryLogs, sessions: sessions.map((s) => ({ ...s, exercises: s.exercises ?? [] })), routine: paused ? null : routine, plan, adjustments, phases: (settingsMap.phases as PhaseSettings | undefined) ?? null, noTraining }
        : null;
      setRaw({
        profile,
        foods,
        data,
        mealPlan: mealPlans[0] ? { ...mealPlans[0].data, id: mealPlans[0].id } : null,
        routineId: routine?.id ?? null,
        pausedRoutine: paused ? routine : null,
        stack,
        supplementLogs,
        photos,
        recipes,
        favorites,
        calendarTasks,
        mealRatings,
        muscleFeedback,
        settings: settingsMap,
      });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
    const t = setInterval(() => {
      const d = todayFn();
      setToday((cur) => (cur !== d ? d : cur));
    }, 60_000);
    return () => clearInterval(t);
  }, [reload]);

  // Tema
  useEffect(() => {
    const theme = (raw?.settings.theme as string) ?? 'dark';
    const apply = () => {
      const t = theme === 'system' ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : theme;
      document.documentElement.dataset.theme = t;
    };
    apply();
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [raw?.settings.theme]);

  // Nivel de detalle: los elementos con clase "tech" solo se muestran con detalles técnicos.
  useEffect(() => {
    const h = (e: Event) => void setSettingRef.current?.('details', (e as CustomEvent<string>).detail);
    window.addEventListener('bodyos:details', h);
    return () => window.removeEventListener('bodyos:details', h);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.details = raw?.settings.details === 'on' ? 'on' : 'off';
  }, [raw?.settings.details]);

  const state = useMemo(() => {
    if (!raw?.data) return null;
    try {
      return computeState(raw.data, today);
    } catch (e) {
      console.error(e);
      return null;
    }
  }, [raw?.data, today]);

  const saveProfile = useCallback(
    async (p: Profile) => {
      const existing = await api.get<{ created_at: string }>('profile', 1);
      const now = new Date().toISOString();
      await api.upsert('profile', { id: 1, data: { ...p, createdAt: p.createdAt ?? now }, created_at: existing?.created_at ?? now, updated_at: now });
      await reload();
    },
    [reload],
  );

  const setSetting = useCallback(
    async (k: string, v: unknown) => {
      await api.upsert('settings', { key: k, value: v });
      await reload();
    },
    [reload],
  );
  setSettingRef.current = setSetting;

  const activatePlan = useCallback(
    async (plan: Omit<ActivePlan, 'id' | 'created_at'>) => {
      const id = uid('plan_');
      await api.upsert('nutrition_plans', { id, created_at: new Date().toISOString(), active: 1, scenario: plan.scenario, targets: plan.targets, reason: plan.reason });
      await api.setActive('nutrition_plans', id);
      await reload();
    },
    [reload],
  );

  const value: Store = {
    loading,
    error,
    today,
    profile: raw?.profile ?? null,
    foods: raw?.foods ?? [],
    data: raw?.data ?? null,
    state,
    mealPlan: raw?.mealPlan ?? null,
    routineId: raw?.routineId ?? null,
    pausedRoutine: raw?.pausedRoutine ?? null,
    stack: raw?.stack ?? [],
    supplementLogs: raw?.supplementLogs ?? [],
    photos: raw?.photos ?? [],
    recipes: raw?.recipes ?? [],
    favorites: raw?.favorites ?? [],
    calendarTasks: raw?.calendarTasks ?? [],
    mealRatings: raw?.mealRatings ?? [],
    muscleFeedback: raw?.muscleFeedback ?? [],
    settings: raw?.settings ?? {},
    reload,
    saveProfile,
    setSetting,
    activatePlan,
    toast,
    toasts,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Meta de pasos con el aumento aceptado en Ajustes propuestos. */
export function withBonus<T extends { target: number; reason: string }>(t: T, bonus: unknown): T {
  const b = Number(bonus ?? 0);
  if (!b) return t;
  return { ...t, target: t.target + b, reason: `${t.reason} Incluye +${b.toLocaleString('es-MX')} pasos de un ajuste aceptado.` };
}
