// Planificación diaria: genera las actividades de cada día a partir del plan del usuario.
// Las actividades no completadas no generan penalizaciones ni cambios automáticos.
import type { Profile } from './types';
import type { Routine } from './training/generator';
import { mealSlots, MEAL_LABEL } from './nutrition/targets';
import { parseISODate } from './utils';

export type TaskType = 'entreno' | 'comida' | 'suplemento' | 'hidratacion' | 'cardio' | 'descanso' | 'medicion' | 'revision' | 'personal';

export interface DayTask {
  key: string; // estable para guardar el estado
  type: TaskType;
  title: string;
  detail?: string;
  time?: string;
}

export interface StackItem {
  supplement_key: string;
  name: string;
  dose: string;
  timing: string;
  active: number;
}

export function generateDayTasks(date: string, p: Profile, routine: Routine | null, stack: StackItem[], deloadWeekStart?: string | null): DayTask[] {
  const d = parseISODate(date);
  const dow = d.getDay();
  const tasks: DayTask[] = [];
  tasks.push({ key: 'peso', type: 'medicion', title: 'Pesarme en ayunas', time: '07:00' });
  if (dow === 1) tasks.push({ key: 'cintura', type: 'medicion', title: 'Medir cintura y perímetros', detail: 'Mismas condiciones cada semana: en ayunas, cinta a la altura del ombligo.' });
  if (dow === 0 && d.getDate() <= 7) tasks.push({ key: 'fotos', type: 'medicion', title: 'Fotos de progreso (frente, perfil, espalda)', detail: 'Misma luz, hora, distancia y ropa.' });
  const slots = mealSlots(p.mealsPerDay);
  slots.forEach((s, i) => tasks.push({ key: `comida_${s}`, type: 'comida', title: `${MEAL_LABEL[s]} registrado`, time: p.mealTimes?.[i] }));
  const day = routine?.days.find((x) => x.weekday === dow);
  if (day) {
    const deload = deloadWeekStart && date >= deloadWeekStart && date <= addDaysStr(deloadWeekStart, 6);
    tasks.push({ key: 'entreno', type: 'entreno', title: `Entrenamiento: ${day.name}${deload ? ' (descarga: 50 % de las series)' : ''}`, detail: day.focus });
  } else {
    tasks.push({ key: 'descanso', type: 'descanso', title: 'Descanso de pesas', detail: 'Movilidad o caminata ligera opcional.' });
  }
  if (!day || dow === 6 || dow === 0) tasks.push({ key: 'cardio', type: 'cardio', title: 'Cardio de baja intensidad (20–40 min, zona 2)' });
  tasks.push({ key: 'pasos', type: 'cardio', title: 'Alcanzar la meta de pasos' });
  tasks.push({ key: 'agua', type: 'hidratacion', title: 'Hidratación orientativa del día' });
  for (const s of stack.filter((x) => x.active)) tasks.push({ key: `sup_${s.supplement_key}`, type: 'suplemento', title: `${s.name} — ${s.dose}`, detail: s.timing });
  if (dow === 0) tasks.push({ key: 'revision', type: 'revision', title: 'Revisión semanal en Inteligencia artificial' });
  tasks.push({ key: 'sueno', type: 'descanso', title: 'Dormir 7–9 horas' });
  return tasks;
}

function addDaysStr(date: string, n: number): string {
  const d = parseISODate(date);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
