// Componentes base de la interfaz.
import { useEffect, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import type { Claim, ClaimKind } from '@shared/types';

export function Card({ title, icon, hint, actions, children, className = '', tight }: { title?: ReactNode; icon?: ReactNode; hint?: ReactNode; actions?: ReactNode; children?: ReactNode; className?: string; tight?: boolean }) {
  return (
    <section className={`card ${tight ? 'tight' : ''} ${className}`}>
      {(title || actions) && (
        <div className="card-head">
          <div className="title">
            {icon}
            {title}
          </div>
          <div className="row">
            {hint && <span className="hint">{hint}</span>}
            {actions}
          </div>
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, unit, foot, icon, testId }: { label: ReactNode; value: ReactNode; unit?: string; foot?: ReactNode; icon?: ReactNode; testId?: string }) {
  return (
    <div className="stat" data-testid={testId}>
      <div className="label">
        {icon}
        {label}
      </div>
      <div className="value">
        {value}
        {unit && <span className="unit">{unit}</span>}
      </div>
      {foot && <div className="foot">{foot}</div>}
    </div>
  );
}

export function Bar({ value, max, color = 'var(--accent)', over = 'var(--warn)' }: { value: number; max: number; color?: string; over?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const isOver = max > 0 && value > max * 1.05;
  return (
    <div className="bar">
      <div style={{ width: `${pct}%`, background: isOver ? over : color }} />
    </div>
  );
}

export function Ring({ value, max, size = 120, stroke = 10, color = 'var(--accent)', children }: { value: number; max: number; size?: number; stroke?: number; color?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <div className="ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--surface-3)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(.2,.8,.2,1)' }}
        />
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  );
}

const KIND: Record<ClaimKind, { label: string; cls: string }> = {
  dato: { label: 'Dato', cls: 'info' },
  estimacion: { label: 'Estimación', cls: 'warn' },
  hipotesis: { label: 'Hipótesis', cls: '' },
  recomendacion: { label: 'Recomendación', cls: 'accent' },
};

export function KindBadge({ kind }: { kind: ClaimKind }) {
  return <span className={`badge ${KIND[kind].cls}`}>{KIND[kind].label}</span>;
}

export function Claims({ items }: { items: Claim[] }) {
  if (!items.length) return <p className="muted">Sin información todavía.</p>;
  return (
    <div className="claims">
      {items.map((c, i) => (
        <div className="claim" key={i}>
          <KindBadge kind={c.kind} />
          <div>{c.text}</div>
        </div>
      ))}
    </div>
  );
}

export function Alert({ kind = 'info', children }: { kind?: 'info' | 'warn' | 'danger' | 'ok'; children: ReactNode }) {
  const Icon = kind === 'danger' ? XCircle : kind === 'warn' ? AlertTriangle : kind === 'ok' ? CheckCircle2 : Info;
  return (
    <div className={`alert ${kind}`}>
      <Icon />
      <div>{children}</div>
    </div>
  );
}

export function Modal({ title, onClose, children, footer, wide }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog">
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="btn ghost icon" onClick={onClose} aria-label="Cerrar">
            <X />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, help, children }: { label: ReactNode; help?: ReactNode; children: ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {help && <span className="help">{help}</span>}
    </div>
  );
}

export function NumInput({ value, onChange, suffix, step = 'any', min, max, placeholder, testId, disabled }: { value: number | null | undefined; onChange: (v: number | null) => void; suffix?: string; step?: string | number; min?: number; max?: number; placeholder?: string; testId?: string; disabled?: boolean }) {
  return (
    <div className="input-wrap">
      <input
        className="input mono"
        type="number"
        inputMode="decimal"
        step={step}
        min={min}
        max={max}
        placeholder={placeholder}
        disabled={disabled}
        data-testid={testId}
        value={value ?? ''}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === '' ? null : Number(v));
        }}
      />
      {suffix && <span className="suffix">{suffix}</span>}
    </div>
  );
}

export function Seg<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={o.value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)} type="button">
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Tabs<T extends string>({ value, tabs, onChange }: { value: T; tabs: { value: T; label: ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div className="tabs">
      {tabs.map((t) => (
        <button key={t.value} className={t.value === value ? 'on' : ''} onClick={() => onChange(t.value)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Chips<T extends string | number>({ value, options, onChange, multi = true }: { value: T[]; options: { value: T; label: ReactNode }[]; onChange: (v: T[]) => void; multi?: boolean }) {
  return (
    <div className="chips">
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <button
            type="button"
            key={String(o.value)}
            className={`chip ${on ? 'on' : ''}`}
            onClick={() => onChange(multi ? (on ? value.filter((v) => v !== o.value) : [...value, o.value]) : [o.value])}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function PageHead({ title, sub, actions }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <div className="sub">{sub}</div>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </div>
  );
}

export function MacroBar({ label, color, value, target, unit = 'g', overOk = false }: { label: string; color: string; value: number; target: number; unit?: string; overOk?: boolean }) {
  return (
    <div className="macro-row">
      <div className="row nowrap" style={{ gap: 8 }}>
        <span className="dot" style={{ background: color }} />
        {label}
      </div>
      <Bar value={value} max={target} color={color} over={overOk ? color : undefined} />
      <div className="right mono">
        <b>{Math.round(value)}</b>
        <span className="muted">
          {' '}
          / {Math.round(target)} {unit}
        </span>
      </div>
    </div>
  );
}

export function fmt(n: number | null | undefined, d = 0, fallback = '—'): string {
  if (n == null || Number.isNaN(n)) return fallback;
  return n.toLocaleString('es-MX', { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function Toasts({ items }: { items: { id: string; msg: string; kind: 'ok' | 'error' }[] }) {
  return (
    <div className="toasts">
      {items.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`} role="status">
          {t.kind === 'error' ? <XCircle color="var(--danger)" /> : <CheckCircle2 color="var(--ok)" />}
          <div>{t.msg}</div>
        </div>
      ))}
    </div>
  );
}

export function ConfirmButton({ onConfirm, children, confirmText = '¿Confirmar?', className = 'btn', testId }: { onConfirm: () => void; children: ReactNode; confirmText?: string; className?: string; testId?: string }) {
  return (
    <button
      className={className}
      data-testid={testId}
      onClick={() => {
        if (window.confirm(confirmText)) onConfirm();
      }}
    >
      {children}
    </button>
  );
}
