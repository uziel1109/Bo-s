// Exportación de recordatorios a calendarios (Apple Calendar, Google, Outlook) en formato iCalendar (RFC 5545).
// Eventos recurrentes con alarma: entrenamientos, pesaje diario, medidas semanales, revisión semanal,
// fotos mensuales y (opcional) comidas. Usa hora local "flotante": se respeta la zona horaria del dispositivo.
import type { Profile } from './types';
import type { Routine } from './training/generator';
import { mealSlots, MEAL_LABEL } from './nutrition/targets';

export interface IcsOptions {
  training: boolean;
  trainingTime: string; // HH:MM
  weighIn: boolean;
  weighInTime: string;
  measures: boolean;
  review: boolean;
  photos: boolean;
  meals: boolean;
  alarmMinutes: number;
}

const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

/** Primera hora "H:MM" o "HH:MM" que aparezca en el texto del horario, o la predeterminada. */
export function parseTime(text: string | undefined, fallback = '07:00'): string {
  const m = (text ?? '').match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : fallback;
}

function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Pliega líneas largas (máx. 75 octetos) como exige el estándar. */
function fold(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out: string[] = [];
  let cur = '';
  for (const ch of line) {
    if (enc.encode(cur + ch).length > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = ch;
    } else cur += ch;
  }
  out.push(cur);
  return out.join('\r\n ');
}

/** Próxima fecha (YYYYMMDD) en o después de `start` que caiga en el día de la semana indicado. */
function nextWeekday(start: Date, dow: number): string {
  const d = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 12);
  while (d.getDay() !== dow) d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

const hm = (t: string) => t.replace(':', '') + '00';
function addMinutes(t: string, min: number): string {
  const [h, m] = t.split(':').map(Number);
  const tot = Math.min(23 * 60 + 59, h * 60 + m + min);
  return `${String(Math.floor(tot / 60)).padStart(2, '0')}${String(tot % 60).padStart(2, '0')}00`;
}

export function buildIcs(p: Profile, routine: Routine | null, o: IcsOptions, now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const events: string[][] = [];
  const ev = (uid: string, date: string, start: string, durMin: number, summary: string, rrule: string, description: string, alarm = o.alarmMinutes) => {
    const lines = [
      'BEGIN:VEVENT',
      `UID:${uid}@bodyos.app`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${date}T${hm(start)}`,
      `DTEND:${date}T${addMinutes(start, durMin)}`,
      `RRULE:${rrule}`,
      `SUMMARY:${esc(summary)}`,
      `DESCRIPTION:${esc(description)}`,
    ];
    if (alarm >= 0) lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(summary)}`, `TRIGGER:-PT${alarm}M`, 'END:VALARM');
    lines.push('END:VEVENT');
    events.push(lines);
  };
  if (o.training && routine)
    for (const d of routine.days)
      ev(`entreno-${d.key}`, nextWeekday(now, d.weekday), o.trainingTime, Math.max(20, Math.min(p.sessionMinutes, d.estMinutes)), `Entrenamiento: ${d.name}`, `FREQ=WEEKLY;BYDAY=${BYDAY[d.weekday]}`, `${d.focus}\n${d.exercises.map((e) => `• ${e.name}: ${e.sets}×${e.repMin}-${e.repMax}`).join('\n')}\nRegistra la sesión en BODY OS.`);
  if (o.weighIn) ev('pesaje', nextWeekday(now, now.getDay()), o.weighInTime, 5, 'Pesarme en ayunas', 'FREQ=DAILY', 'Después de ir al baño y antes de comer o beber. Regístralo en BODY OS.', 0);
  if (o.measures) ev('medidas', nextWeekday(now, 1), o.weighInTime, 10, 'Medir cintura y perímetros', 'FREQ=WEEKLY;BYDAY=MO', 'Mismas condiciones cada semana: en ayunas, cinta a la altura del ombligo.', 0);
  if (o.review) ev('revision', nextWeekday(now, 0), '19:00', 15, 'Revisión semanal de BODY OS', 'FREQ=WEEKLY;BYDAY=SU', 'Revisa tu informe semanal y los ajustes propuestos en Inteligencia artificial.');
  if (o.photos) ev('fotos', nextWeekday(now, 0), o.weighInTime, 10, 'Fotos de progreso', 'FREQ=MONTHLY;BYDAY=1SU', 'Frente, perfil y espalda con la misma luz, hora, ropa y distancia.');
  if (o.meals)
    mealSlots(p.mealsPerDay).forEach((s, i) => {
      const t = p.mealTimes?.[i];
      if (t) ev(`comida-${s}`, nextWeekday(now, now.getDay()), t, 20, `${MEAL_LABEL[s]}`, 'FREQ=DAILY', 'Registra lo que comes en BODY OS.', 0);
    });
  const body = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//BODY OS//Recordatorios//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:BODY OS', ...events.flat(), 'END:VCALENDAR'];
  return body.map(fold).join('\r\n') + '\r\n';
}

export function icsEventCount(ics: string): number {
  return (ics.match(/BEGIN:VEVENT/g) ?? []).length;
}
