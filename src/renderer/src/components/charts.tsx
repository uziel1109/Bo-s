// Gráficas (Recharts). Reglas: un solo eje Y, líneas de 2 px, cuadrícula discreta, tooltip en cada gráfica,
// leyenda cuando hay ≥ 2 series y etiquetas en texto neutro (nunca en el color de la serie).
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Scatter, ComposedChart, Tooltip, XAxis, YAxis } from 'recharts';
import { formatDateShort } from '@shared/utils';

interface TipProps {
  active?: boolean;
  payload?: { name?: string; value?: number | null; color?: string; dataKey?: string; payload?: Record<string, unknown> }[];
  label?: string | number;
  unit?: string;
  labelFmt?: (l: string | number) => string;
}

function Tip({ active, payload, label, unit = '', labelFmt }: TipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tip">
      <div className="muted" style={{ marginBottom: 4 }}>
        {labelFmt ? labelFmt(label as string) : label}
      </div>
      {payload
        .filter((p) => p.value != null)
        .map((p) => (
          <div key={p.dataKey} className="row nowrap" style={{ gap: 6 }}>
            <span className="dot" style={{ background: p.color }} />
            <span>{p.name}:</span>
            <b className="mono">
              {typeof p.value === 'number' ? p.value.toLocaleString('es-MX', { maximumFractionDigits: 1 }) : p.value} {unit}
            </b>
          </div>
        ))}
    </div>
  );
}

const axis = { stroke: 'var(--border-strong)', tickLine: false, axisLine: false, fontSize: 11 } as const;
const dateFmt = (d: string | number) => (typeof d === 'string' && /^\d{4}-/.test(d) ? formatDateShort(d) : String(d));

/** Peso diario (puntos) + tendencia (línea). */
export function WeightTrendChart({ data, height = 240, goal }: { data: { date: string; weight: number | null; trend: number }[]; height?: number; goal?: number }) {
  if (data.length < 2) return <div className="empty">Registra al menos 2 pesajes para ver la gráfica.</div>;
  const vals = data.flatMap((d) => [d.weight ?? d.trend, d.trend]);
  const min = Math.floor(Math.min(...vals, goal ?? Infinity) - 1);
  const max = Math.ceil(Math.max(...vals) + 1);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="date" tickFormatter={dateFmt} {...axis} minTickGap={28} />
        <YAxis domain={[min, max]} {...axis} width={44} />
        <Tooltip content={<Tip unit="kg" labelFmt={dateFmt} />} cursor={{ stroke: 'var(--border-strong)' }} />
        <Legend iconType="plainline" wrapperStyle={{ fontSize: 12, color: 'var(--text-2)' }} />
        {goal && <ReferenceLine y={goal} stroke="var(--muted)" strokeDasharray="4 4" label={{ value: `Meta ≈ ${goal} kg`, position: 'insideTopRight', fill: 'var(--muted)', fontSize: 11 }} />}
        <Scatter name="Peso registrado" dataKey="weight" fill="var(--s1)" shape={(p: { cx?: number; cy?: number }) => (p.cy == null ? <g /> : <circle cx={p.cx} cy={p.cy} r={3.5} fill="var(--s1)" stroke="var(--surface)" strokeWidth={2} />)} isAnimationActive={false} />
        <Line name="Tendencia" type="monotone" dataKey="trend" stroke="var(--s2)" strokeWidth={2} dot={false} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Serie simple a lo largo del tiempo. */
export function SimpleLine({ data, dataKey, name, unit, height = 200, color = 'var(--s1)' }: { data: Record<string, unknown>[]; dataKey: string; name: string; unit?: string; height?: number; color?: string }) {
  const pts = data.filter((d) => d[dataKey] != null);
  if (pts.length < 2) return <div className="empty">Se necesitan al menos 2 registros.</div>;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={pts} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="date" tickFormatter={dateFmt} {...axis} minTickGap={28} />
        <YAxis domain={['auto', 'auto']} {...axis} width={44} />
        <Tooltip content={<Tip unit={unit} labelFmt={dateFmt} />} cursor={{ stroke: 'var(--border-strong)' }} />
        <Line name={name} type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={{ r: 3, strokeWidth: 2, stroke: 'var(--surface)', fill: color }} activeDot={{ r: 5 }} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Proyección de % de grasa para los 3 escenarios. */
export function ScenarioChart({ series, target, height = 280, metric = 'bf' }: { series: { name: string; color: string; weeks: { week: number; bf: number; weight: number }[] }[]; target: number; height?: number; metric?: 'bf' | 'weight' }) {
  const maxW = Math.max(...series.map((s) => s.weeks.length));
  const rows = Array.from({ length: maxW }, (_, i) => {
    const r: Record<string, number | null> = { week: i };
    for (const s of series) r[s.name] = s.weeks[i]?.[metric] ?? null;
    return r;
  });
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={rows} margin={{ top: 8, right: 16, left: -12, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="week" {...axis} tickFormatter={(w) => `S${w}`} minTickGap={20} />
        <YAxis domain={['auto', 'auto']} {...axis} width={44} unit={metric === 'bf' ? '%' : ''} />
        <Tooltip content={<Tip unit={metric === 'bf' ? '%' : 'kg'} labelFmt={(l) => `Semana ${l}`} />} cursor={{ stroke: 'var(--border-strong)' }} />
        <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
        {metric === 'bf' && <ReferenceLine y={target} stroke="var(--muted)" strokeDasharray="4 4" label={{ value: `Objetivo ${target} %`, position: 'insideBottomLeft', fill: 'var(--muted)', fontSize: 11 }} />}
        {series.map((s) => (
          <Line key={s.name} name={s.name} type="monotone" dataKey={s.name} stroke={s.color} strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Barras simples (p. ej., agua por hora, volumen por músculo). */
export function SimpleBars({ data, x, y, name, unit, height = 200, color = 'var(--s1)', xFmt, layout = 'horizontal' }: { data: Record<string, unknown>[]; x: string; y: string; name: string; unit?: string; height?: number; color?: string; xFmt?: (v: string | number) => string; layout?: 'horizontal' | 'vertical' }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={layout} margin={{ top: 8, right: 12, left: layout === 'vertical' ? 30 : -12, bottom: 0 }}>
        <CartesianGrid vertical={layout === 'vertical'} horizontal={layout === 'horizontal'} />
        {layout === 'horizontal' ? (
          <>
            <XAxis dataKey={x} {...axis} tickFormatter={xFmt} minTickGap={6} />
            <YAxis {...axis} width={44} />
          </>
        ) : (
          <>
            <XAxis type="number" {...axis} />
            <YAxis type="category" dataKey={x} {...axis} width={120} />
          </>
        )}
        <Tooltip content={<Tip unit={unit} labelFmt={xFmt} />} cursor={{ fill: 'var(--surface-2)' }} />
        <Bar name={name} dataKey={y} fill={color} radius={layout === 'horizontal' ? [4, 4, 0, 0] : [0, 4, 4, 0]} maxBarSize={28} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Ingesta diaria vs objetivo (área). */
export function IntakeArea({ data, target, height = 200 }: { data: { date: string; kcal: number | null }[]; target: number; height?: number }) {
  if (data.filter((d) => d.kcal).length < 2) return <div className="empty">Registra comida al menos 2 días para ver la gráfica.</div>;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id="kcalFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--s1)" stopOpacity={0.25} />
            <stop offset="100%" stopColor="var(--s1)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="date" tickFormatter={dateFmt} {...axis} minTickGap={28} />
        <YAxis {...axis} width={48} />
        <Tooltip content={<Tip unit="kcal" labelFmt={dateFmt} />} cursor={{ stroke: 'var(--border-strong)' }} />
        <ReferenceLine y={target} stroke="var(--muted)" strokeDasharray="4 4" label={{ value: `Objetivo ${target}`, position: 'insideTopRight', fill: 'var(--muted)', fontSize: 11 }} />
        <Area name="Calorías" type="monotone" dataKey="kcal" stroke="var(--s1)" strokeWidth={2} fill="url(#kcalFill)" connectNulls isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
