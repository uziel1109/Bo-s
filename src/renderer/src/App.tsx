import { useEffect, useState } from 'react';
import { Activity, Brain, CalendarDays, Droplets, Dumbbell, HeartPulse, LayoutDashboard, LineChart, Pill, Settings as SettingsIcon, User, UtensilsCrossed } from 'lucide-react';
import { useStore } from './store';
import { Toasts } from './components/ui';
import { AnimDebug } from './components/ExerciseAnimation';
import { IconTile } from './components/visual';
import { MilestoneCelebration } from './components/Milestones';
import { Onboarding } from './pages/Onboarding';
import { Dashboard } from './pages/Dashboard';
import { Body } from './pages/Body';
import { Nutrition } from './pages/Nutrition';
import { Training } from './pages/Training';
import { Cardio } from './pages/Cardio';
import { Supplements } from './pages/Supplements';
import { Hydration } from './pages/Hydration';
import { Progress } from './pages/Progress';
import { AI } from './pages/AI';
import { CalendarPage } from './pages/Calendar';
import { Settings } from './pages/Settings';

export type PageKey = 'dashboard' | 'cuerpo' | 'nutricion' | 'entrenamiento' | 'cardio' | 'suplementos' | 'hidratacion' | 'progreso' | 'ia' | 'calendario' | 'config';

const NAV: { key: PageKey; label: string; icon: typeof LayoutDashboard }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'cuerpo', label: 'Mi cuerpo', icon: User },
  { key: 'nutricion', label: 'Nutrición', icon: UtensilsCrossed },
  { key: 'entrenamiento', label: 'Entrenamiento', icon: Dumbbell },
  { key: 'cardio', label: 'Cardio', icon: HeartPulse },
  { key: 'suplementos', label: 'Suplementación', icon: Pill },
  { key: 'hidratacion', label: 'Hidratación', icon: Droplets },
  { key: 'progreso', label: 'Progreso', icon: LineChart },
  { key: 'ia', label: 'Inteligencia artificial', icon: Brain },
  { key: 'calendario', label: 'Calendario', icon: CalendarDays },
  { key: 'config', label: 'Configuración', icon: SettingsIcon },
];

export function navigate(p: PageKey) {
  window.dispatchEvent(new CustomEvent('bodyos:nav', { detail: p }));
}

export function App() {
  const store = useStore();
  const [page, setPage] = useState<PageKey>('dashboard');

  useEffect(() => {
    const h = (e: Event) => setPage((e as CustomEvent<PageKey>).detail);
    window.addEventListener('bodyos:nav', h);
    return () => window.removeEventListener('bodyos:nav', h);
  }, []);

  if (location.hash.startsWith('#anim-debug')) return <AnimDebug />;
  if (store.loading)
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100%' }}>
        <div className="row muted">
          <Activity /> Cargando BODY OS…
        </div>
      </div>
    );
  if (store.error)
    return (
      <div className="page">
        <div className="card">
          <h2>No se pudo abrir la base de datos local</h2>
          <p className="muted mt8">{store.error}</p>
        </div>
      </div>
    );
  if (!store.profile)
    return (
      <>
        <Onboarding />
        <Toasts items={store.toasts} />
      </>
    );
  if (!store.state)
    return (
      <div className="page">
        <div className="card">No fue posible calcular tu estado. Revisa tu perfil en Configuración.</div>
        <Settings />
      </div>
    );

  const Page = { dashboard: Dashboard, cuerpo: Body, nutricion: Nutrition, entrenamiento: Training, cardio: Cardio, suplementos: Supplements, hidratacion: Hydration, progreso: Progress, ia: AI, calendario: CalendarPage, config: Settings }[page];
  const pending = store.data?.adjustments.filter((a) => a.status === 'pendiente').length ?? 0;

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">OS</div>
          <div className="brand-text">
            <div className="brand-name">BODY OS</div>
            <div className="brand-sub">{store.profile.name ? `Hola, ${store.profile.name}` : 'Transformación corporal'}</div>
          </div>
        </div>
        {NAV.map((n, i) => (
          <div key={n.key}>
            {(i === 8 || i === 10) && <div className="nav-sep" />}
            <button className={`nav-item ${page === n.key ? 'active' : ''}`} onClick={() => setPage(n.key)} data-testid={`nav-${n.key}`} title={n.label}>
              <IconTile module={n.key} />
              <span>{n.label}</span>
              {n.key === 'ia' && pending > 0 && <span className="badge accent" style={{ marginLeft: 'auto' }}>{pending}</span>}
            </button>
          </div>
        ))}
        <div className="sidebar-foot">
          Datos guardados solo en este dispositivo.
          <br />
          No sustituye la valoración médica.
        </div>
      </aside>
      <main className="main">
        <Page key={page} />
      </main>
      <MilestoneCelebration />
      <Toasts items={store.toasts} />
    </div>
  );
}
