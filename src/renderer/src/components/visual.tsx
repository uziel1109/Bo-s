// Componentes visuales: identidad de color por módulo, anillos de actividad, barra del recorrido
// hacia el objetivo, silueta de progreso y accesos rápidos.
import type { ReactNode } from 'react';
import { Brain, CalendarDays, Droplets, Dumbbell, HeartPulse, LayoutDashboard, LineChart, Pill, Settings, User, UtensilsCrossed, type LucideIcon } from 'lucide-react';

export type ModuleKey = 'dashboard' | 'cuerpo' | 'nutricion' | 'entrenamiento' | 'cardio' | 'suplementos' | 'hidratacion' | 'progreso' | 'ia' | 'calendario' | 'config';

export const MODULES: Record<ModuleKey, { color: string; color2: string; icon: LucideIcon; label: string }> = {
  dashboard: { color: 'var(--m-lime)', color2: 'var(--m-cyan)', icon: LayoutDashboard, label: 'Dashboard' },
  cuerpo: { color: 'var(--m-cyan)', color2: 'var(--m-blue)', icon: User, label: 'Mi cuerpo' },
  nutricion: { color: 'var(--m-orange)', color2: 'var(--m-amber)', icon: UtensilsCrossed, label: 'Nutrición' },
  entrenamiento: { color: 'var(--m-lime)', color2: 'var(--m-green)', icon: Dumbbell, label: 'Entrenamiento' },
  cardio: { color: 'var(--m-pink)', color2: 'var(--m-red)', icon: HeartPulse, label: 'Cardio' },
  suplementos: { color: 'var(--m-violet)', color2: 'var(--m-pink)', icon: Pill, label: 'Suplementación' },
  hidratacion: { color: 'var(--m-blue)', color2: 'var(--m-cyan)', icon: Droplets, label: 'Hidratación' },
  progreso: { color: 'var(--m-cyan)', color2: 'var(--m-lime)', icon: LineChart, label: 'Progreso' },
  ia: { color: 'var(--m-violet)', color2: 'var(--m-cyan)', icon: Brain, label: 'Inteligencia artificial' },
  calendario: { color: 'var(--m-amber)', color2: 'var(--m-orange)', icon: CalendarDays, label: 'Calendario' },
  config: { color: 'var(--m-slate)', color2: 'var(--m-blue)', icon: Settings, label: 'Configuración' },
};

/** Ícono sobre un fondo de color del módulo. */
export function IconTile({ module, icon: Icon, color, size = 36 }: { module?: ModuleKey; icon?: LucideIcon; color?: string; size?: number }) {
  const m = module ? MODULES[module] : null;
  const I = Icon ?? m?.icon ?? LayoutDashboard;
  const c = color ?? m?.color ?? 'var(--accent)';
  return (
    <span className="icon-tile" style={{ width: size, height: size, background: `color-mix(in srgb, ${c} 18%, transparent)`, color: c }}>
      <I size={size * 0.5} />
    </span>
  );
}

/** Encabezado de sección con banner de color. */
export function Hero({ module, title, sub, actions, children }: { module: ModuleKey; title: ReactNode; sub?: ReactNode; actions?: ReactNode; children?: ReactNode }) {
  const m = MODULES[module];
  const Icon = m.icon;
  return (
    <section className="hero" style={{ ['--h1' as string]: m.color, ['--h2' as string]: m.color2 }}>
      <Icon className="hero-bg-icon" aria-hidden />
      <div className="hero-row">
        <div className="row nowrap" style={{ gap: 16, alignItems: 'center' }}>
          <span className="hero-icon">
            <Icon size={26} />
          </span>
          <div>
            <h1>{title}</h1>
            {sub && <div className="hero-sub">{sub}</div>}
          </div>
        </div>
        {actions && <div className="row">{actions}</div>}
      </div>
      {children && <div className="hero-body">{children}</div>}
    </section>
  );
}

export interface RingSpec {
  label: string;
  value: number;
  max: number;
  color: string;
  display: string;
  unit?: string;
  testId?: string;
}

/** Anillos de actividad concéntricos (estilo app de fitness). */
export function ActivityRings({ rings, size = 200, testId }: { rings: RingSpec[]; size?: number; testId?: string }) {
  const stroke = Math.max(10, size / 13);
  const gap = stroke * 0.32;
  return (
    <div className="rings" data-testid={testId}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Progreso del día">
        {rings.map((r, i) => {
          const rad = size / 2 - stroke / 2 - i * (stroke + gap);
          const c = 2 * Math.PI * rad;
          const pct = r.max > 0 ? Math.min(1, r.value / r.max) : 0;
          return (
            <g key={r.label} transform={`rotate(-90 ${size / 2} ${size / 2})`}>
              <circle cx={size / 2} cy={size / 2} r={rad} fill="none" stroke={r.color} strokeOpacity={0.16} strokeWidth={stroke} />
              <circle
                cx={size / 2}
                cy={size / 2}
                r={rad}
                fill="none"
                stroke={r.color}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={c}
                strokeDashoffset={c * (1 - pct)}
                style={{ transition: 'stroke-dashoffset 1s cubic-bezier(.2,.8,.2,1)' }}
              />
            </g>
          );
        })}
      </svg>
      <div className="rings-legend">
        {rings.map((r) => (
          <div key={r.label} className="rings-item">
            <span className="dot" style={{ background: r.color, width: 10, height: 10 }} />
            <div>
              <div className="tiny muted">{r.label}</div>
              <div className="mono rings-val">
                <span data-testid={r.testId}>{r.display}</span>
                <span className="muted small"> {r.unit}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Recorrido: % de grasa inicial → actual → objetivo. */
export function JourneyBar({ start, current, goal }: { start: number; current: number; goal: number }) {
  const span = Math.max(0.1, start - goal);
  const pct = Math.max(0, Math.min(100, ((start - current) / span) * 100));
  return (
    <div className="journey">
      <div className="journey-track">
        <div className="journey-fill" style={{ width: `${Math.max(pct, 2)}%` }} />
        <div className="journey-dot" style={{ left: `${pct}%` }}>
          <span>{current.toFixed(1)}%</span>
        </div>
      </div>
      <div className="row between tiny" style={{ marginTop: 8 }}>
        <span className="muted">Inicio · {start.toFixed(1)}%</span>
        <span className="muted">Meta · {goal}%</span>
      </div>
    </div>
  );
}

/** Silueta que se llena conforme avanzas hacia tu objetivo. */
export function BodyProgress({ pct, size = 150 }: { pct: number; size?: number }) {
  const h = size * 1.7;
  const fillY = 230 - (Math.max(0, Math.min(100, pct)) / 100) * 220;
  return (
    <svg width={size} height={h} viewBox="0 0 120 240" role="img" aria-label={`Avance ${pct}%`} className="body-progress">
      <defs>
        <clipPath id="bodyClip">
          <circle cx="60" cy="24" r="14" />
          <path d="M44 42 Q60 36 76 42 L88 50 Q96 54 98 64 L102 112 Q103 118 97 119 Q92 119 91 113 L86 72 L84 112 L86 132 L80 228 Q79 234 72 234 Q66 234 66 228 L62 140 L58 140 L54 228 Q54 234 48 234 Q41 234 40 228 L34 132 L36 112 L34 72 L29 113 Q28 119 23 119 Q17 118 18 112 L22 64 Q24 54 32 50 Z" />
        </clipPath>
        <linearGradient id="bodyFill" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="var(--m-lime)" />
          <stop offset="1" stopColor="var(--m-cyan)" />
        </linearGradient>
      </defs>
      <g clipPath="url(#bodyClip)">
        <rect x="0" y="0" width="120" height="240" fill="var(--surface-3)" />
        <rect x="0" y={fillY} width="120" height={240 - fillY} fill="url(#bodyFill)" style={{ transition: 'y 1s ease' }} />
      </g>
    </svg>
  );
}

/** Acceso rápido grande y táctil. */
export function QuickTile({ icon: Icon, label, sub, color, onClick, testId }: { icon: LucideIcon; label: string; sub?: string; color: string; onClick: () => void; testId?: string }) {
  return (
    <button className="quick-tile" onClick={onClick} data-testid={testId} style={{ ['--qc' as string]: color }}>
      <span className="quick-icon">
        <Icon size={22} />
      </span>
      <span className="quick-label">{label}</span>
      {sub && <span className="quick-sub">{sub}</span>}
    </button>
  );
}

/** Tarjeta de métrica con acento de color. */
export function MetricTile({ icon: Icon, color, label, value, unit, foot, testId }: { icon: LucideIcon; color: string; label: string; value: ReactNode; unit?: string; foot?: ReactNode; testId?: string }) {
  return (
    <div className="metric-tile" style={{ ['--mc' as string]: color }} data-testid={testId}>
      <div className="row between nowrap">
        <span className="metric-label">{label}</span>
        <span className="metric-icon">
          <Icon size={16} />
        </span>
      </div>
      <div className="metric-value mono">
        {value}
        {unit && <span className="unit">{unit}</span>}
      </div>
      {foot && <div className="metric-foot">{foot}</div>}
    </div>
  );
}
