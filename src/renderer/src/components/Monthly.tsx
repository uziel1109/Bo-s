// Resumen mensual visual: tarjeta en pantalla y exportación como imagen PNG (para guardar o compartir).
import { useMemo, useState } from 'react';
import { Award, CalendarRange, Download, Dumbbell, Flame, Ruler, Scale, Sparkles, UtensilsCrossed } from 'lucide-react';
import { useApp } from '../store';
import { Card, Seg, fmt } from './ui';
import { monthlySummary, monthsWithData, type MonthlySummary } from '@shared/analytics/monthly';
import { api } from '../api';

const sign = (n: number | null, unit: string, d = 1) => (n == null ? '—' : `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toLocaleString('es-MX', { maximumFractionDigits: d })} ${unit}`);

interface Tile {
  label: string;
  value: string;
  sub: string;
  color: string;
  good: boolean | null;
}

export function tilesFor(s: MonthlySummary): Tile[] {
  return [
    { label: 'Peso (tendencia)', value: sign(s.weight.diff, 'kg'), sub: s.weight.end != null ? `${fmt(s.weight.start, 1)} → ${fmt(s.weight.end, 1)} kg` : 'Sin pesajes', color: '#c8f53c', good: s.weight.diff == null ? null : s.weight.diff < 0 },
    { label: 'Cintura', value: sign(s.waist.diff, 'cm'), sub: s.waist.end != null ? `${fmt(s.waist.end, 1)} cm al cierre` : 'Sin medidas', color: '#3fd8e8', good: s.waist.diff == null ? null : s.waist.diff < 0 },
    { label: s.bf.measured ? '% de grasa (medido)' : '% de grasa (estimado)', value: sign(s.bf.diff, 'pts'), sub: s.bf.end != null ? `${fmt(s.bf.end, 1)} % al cierre` : '—', color: '#ff8a4c', good: s.bf.diff == null ? null : s.bf.diff < 0 },
    { label: 'Entrenamientos', value: `${s.training.sessions}${s.training.planned ? ` / ${s.training.planned}` : ''}`, sub: `${Math.round(s.training.volumeKg / 1000).toLocaleString('es-MX')} t de volumen`, color: '#a78bfa', good: s.training.planned ? s.training.sessions >= s.training.planned * 0.8 : null },
    { label: 'Días registrados', value: `${s.nutrition.loggedDays} / ${s.days}`, sub: `${s.nutrition.onTargetDays} en objetivo · ${s.nutrition.proteinDays} con proteína`, color: '#ffc53d', good: s.nutrition.loggedDays >= s.days * 0.7 },
    { label: 'Marcas personales', value: String(s.training.prs.length), sub: s.training.prs[0] ? `${s.training.prs[0].name}: ${s.training.prs[0].to} kg (1RM est.)` : 'Sigue sumando', color: '#ff5fa2', good: s.training.prs.length > 0 },
  ];
}

const ICONS = [Scale, Ruler, Flame, Dumbbell, UtensilsCrossed, Award];

export function MonthlyView() {
  const { data, state: st, today, profile, toast } = useApp();
  const months = useMemo(() => monthsWithData(data, today).slice(0, 12), [data, today]);
  const [month, setMonth] = useState(months[0]);
  const s = useMemo(() => monthlySummary(data, st, month, today), [data, st, month, today]);
  const tiles = tilesFor(s);
  const save = async () => {
    try {
      const png = await renderMonthlyPng(s, profile.name);
      const r = await api.saveFile(`bodyos-resumen-${s.month}.png`, png, 'image/png');
      if (r) toast('Imagen guardada.');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo guardar la imagen.', 'error');
    }
  };
  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="row between" style={{ flexWrap: 'wrap', gap: 10 }}>
        <Seg value={month} onChange={setMonth} options={months.slice(0, 6).map((m) => ({ value: m, label: new Date(`${m}-01T12:00:00`).toLocaleDateString('es-MX', { month: 'short', year: '2-digit' }) }))} />
        <button className="btn primary" onClick={save} data-testid="monthly-save">
          <Download /> Guardar imagen
        </button>
      </div>
      <section className="monthly" data-testid="monthly-card">
        <div className="monthly-head">
          <div className="row" style={{ gap: 10 }}>
            <CalendarRange size={22} />
            <div>
              <div className="tiny" style={{ opacity: 0.75 }}>Resumen {s.complete ? 'del mes' : 'del mes en curso'}</div>
              <h2 className="cap-first" style={{ margin: 0 }}>{s.label}</h2>
            </div>
          </div>
          <div className="brand-mark">OS</div>
        </div>
        <div className="monthly-grid">
          {tiles.map((t, i) => {
            const I = ICONS[i];
            return (
              <div key={t.label} className="monthly-tile" style={{ ['--c' as string]: t.color }}>
                <div className="row" style={{ gap: 6 }}>
                  <I size={16} color={t.color} />
                  <span className="tiny" style={{ opacity: 0.8 }}>{t.label}</span>
                </div>
                <div className="monthly-value mono">{t.value}</div>
                <div className="tiny" style={{ opacity: 0.7 }}>{t.sub}</div>
              </div>
            );
          })}
        </div>
        {s.highlights.length > 0 && (
          <div className="monthly-hl">
            {s.highlights.map((h) => (
              <div key={h} className="row" style={{ gap: 8 }}>
                <Sparkles size={15} color="#c8f53c" /> {h}
              </div>
            ))}
          </div>
        )}
      </section>
      {s.training.prs.length > 0 && (
        <Card title="Marcas personales del mes" hint="1RM estimado (Epley)">
          {s.training.prs.map((p) => (
            <div key={p.name} className="row between small" style={{ padding: '4px 0' }}>
              <span>{p.name}</span>
              <span className="mono">
                {p.from} → <b>{p.to} kg</b> (+{Math.round((p.to / p.from - 1) * 100)} %)
              </span>
            </div>
          ))}
        </Card>
      )}
      <p className="tiny muted">El peso usa la tendencia (media móvil) para restar ruido de agua; el % de grasa es una estimación salvo que registres una medición.</p>
    </div>
  );
}

/** Dibuja la tarjeta en un lienzo de 1080 × 1350 (formato vertical para redes y galería). */
export async function renderMonthlyPng(s: MonthlySummary, name: string): Promise<Uint8Array> {
  const W = 1080;
  const H = 1350;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  if (!g) throw new Error('Este dispositivo no permite generar imágenes.');
  const font = (w: number, px: number) => `${w} ${px}px Inter, -apple-system, "Segoe UI", Roboto, sans-serif`;
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#11161d');
  bg.addColorStop(1, '#0a0c0f');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(W * 0.85, 120, 10, W * 0.85, 120, 520);
  glow.addColorStop(0, 'rgba(200,245,60,0.22)');
  glow.addColorStop(1, 'rgba(200,245,60,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, W, H);

  g.fillStyle = '#c8f53c';
  g.font = font(800, 34);
  g.fillText('BODY OS', 72, 110);
  g.fillStyle = '#93a4b8';
  g.font = font(500, 30);
  g.fillText(s.complete ? 'Resumen del mes' : 'Resumen del mes en curso', 72, 170);
  g.fillStyle = '#eef1f5';
  g.font = font(800, 76);
  const title = s.label.charAt(0).toUpperCase() + s.label.slice(1);
  g.fillText(title, 72, 255);
  if (name) {
    g.fillStyle = '#93a4b8';
    g.font = font(500, 28);
    g.fillText(name, 72, 300);
  }

  const tiles = tilesFor(s);
  const cw = (W - 72 * 2 - 28) / 2;
  const ch = 230;
  tiles.forEach((t, i) => {
    const x = 72 + (i % 2) * (cw + 28);
    const y = 350 + Math.floor(i / 2) * (ch + 26);
    g.fillStyle = 'rgba(255,255,255,0.05)';
    roundRect(g, x, y, cw, ch, 28);
    g.fill();
    g.fillStyle = t.color;
    roundRect(g, x, y, 10, ch, 5);
    g.fill();
    g.fillStyle = '#b4bcc8';
    g.font = font(600, 28);
    g.fillText(t.label, x + 36, y + 58);
    g.fillStyle = t.good === false ? '#eef1f5' : t.color;
    g.font = font(800, 66);
    g.fillText(t.value, x + 36, y + 140);
    g.fillStyle = '#7d8695';
    g.font = font(500, 24);
    g.fillText(clip(g, t.sub, cw - 60), x + 36, y + 190);
  });

  let y = 350 + 3 * (ch + 26) + 30;
  g.font = font(600, 30);
  for (const h of s.highlights.slice(0, 3)) {
    g.fillStyle = '#c8f53c';
    g.fillText('✦', 72, y);
    g.fillStyle = '#eef1f5';
    g.fillText(clip(g, h, W - 72 * 2 - 50), 118, y);
    y += 50;
  }
  g.fillStyle = '#5b6573';
  g.font = font(500, 22);
  g.fillText('Peso por tendencia · % de grasa estimado salvo medición', 72, H - 60);

  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/png'));
  if (!blob) throw new Error('No se pudo generar la imagen.');
  return new Uint8Array(await blob.arrayBuffer());
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function clip(g: CanvasRenderingContext2D, text: string, max: number): string {
  if (g.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 3 && g.measureText(t + '…').width > max) t = t.slice(0, -1);
  return t + '…';
}
