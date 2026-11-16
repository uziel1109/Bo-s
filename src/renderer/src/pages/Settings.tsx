import { useEffect, useState } from 'react';
import { Download, FolderOpen, HardDriveDownload, HardDriveUpload, Moon, Save, Sun, Trash2, Upload } from 'lucide-react';
import { useStore } from '../store';
import { Alert, Card, Claims, Field, PageHead, Seg, Tabs } from '../components/ui';
import { HealthSection, MeasuresSection, NutritionSection, PersonalSection, TrainingSection } from '../components/ProfileSections';
import { validateProfile } from '@shared/profileDefaults';
import type { Profile } from '@shared/types';
import { REFERENCES, LIMITATIONS } from '@shared/references';
import { api } from '../api';

type Tab = 'perfil' | 'apariencia' | 'datos' | 'privacidad' | 'referencias';

export function Settings() {
  const [tab, setTab] = useState<Tab>('perfil');
  return (
    <div className="page">
      <PageHead title="Configuración" />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'perfil', label: 'Perfil' },
          { value: 'apariencia', label: 'Apariencia' },
          { value: 'datos', label: 'Datos y respaldos' },
          { value: 'privacidad', label: 'Privacidad' },
          { value: 'referencias', label: 'Fuentes científicas' },
        ]}
      />
      {tab === 'perfil' && <ProfileEditor />}
      {tab === 'apariencia' && <Appearance />}
      {tab === 'datos' && <DataTools />}
      {tab === 'privacidad' && <Privacy />}
      {tab === 'referencias' && <References />}
    </div>
  );
}

function ProfileEditor() {
  const { profile, saveProfile, toast } = useStore();
  const [p, setP] = useState<Profile | null>(profile);
  const [sec, setSec] = useState<'personal' | 'medidas' | 'entreno' | 'nutricion' | 'salud'>('personal');
  if (!p) return null;
  const set = (patch: Partial<Profile>) => setP({ ...p, ...patch });
  const errs = validateProfile(p);
  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="row between">
        <Seg
          value={sec}
          onChange={setSec}
          options={[
            { value: 'personal', label: 'Personal' },
            { value: 'medidas', label: 'Medidas iniciales' },
            { value: 'entreno', label: 'Entrenamiento' },
            { value: 'nutricion', label: 'Nutrición' },
            { value: 'salud', label: 'Salud' },
          ]}
        />
        <button
          className="btn primary"
          disabled={errs.length > 0}
          data-testid="profile-save"
          onClick={async () => {
            await saveProfile(p);
            toast('Perfil actualizado. Los cálculos se recalcularon; tu plan principal solo cambia si lo confirmas.');
          }}
        >
          <Save /> Guardar cambios
        </button>
      </div>
      {errs.length > 0 && <Alert kind="danger">{errs.join(' ')}</Alert>}
      <Card>
        {sec === 'personal' && <PersonalSection p={p} set={set} />}
        {sec === 'medidas' && <MeasuresSection p={p} set={set} />}
        {sec === 'entreno' && <TrainingSection p={p} set={set} />}
        {sec === 'nutricion' && <NutritionSection p={p} set={set} />}
        {sec === 'salud' && <HealthSection p={p} set={set} />}
      </Card>
      <p className="small muted">Tras cambiar días, equipo o lesiones, regenera la rutina en Entrenamiento → Mi rutina. Tras cambiar tu escenario o datos corporales, revisa Nutrición → Objetivos.</p>
    </div>
  );
}

function Appearance() {
  const { settings, setSetting } = useStore();
  const theme = (settings.theme as string) ?? 'dark';
  return (
    <Card title="Tema">
      <Seg
        value={theme}
        onChange={(v) => setSetting('theme', v)}
        options={[
          { value: 'dark', label: <><Moon size={14} /> Oscuro</> },
          { value: 'light', label: <><Sun size={14} /> Claro</> },
          { value: 'system', label: 'Según el sistema' },
        ]}
      />
    </Card>
  );
}

function DataTools() {
  const { toast, reload } = useStore();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [rpw, setRpw] = useState('');
  const [info, setInfo] = useState<{ version: string; dataDir: string; photoEncryption: string } | null>(null);
  useEffect(() => {
    api.info().then(setInfo).catch(() => null);
  }, []);
  const run = async (fn: () => Promise<unknown>, ok: (r: unknown) => string) => {
    try {
      const r = await fn();
      if (r != null) toast(ok(r));
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'error');
    }
  };
  return (
    <div className="grid g2">
      <Card title="Copia de seguridad completa" icon={<HardDriveDownload />}>
        <p className="small muted mb16">Incluye la base de datos y todas tus fotos. Con contraseña, el archivo se cifra (AES-256-GCM); sin ella, cualquiera con el archivo podría leerlo.</p>
        <div className="grid g2">
          <Field label="Contraseña (recomendada)">
            <input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
          </Field>
          <Field label="Repetir contraseña">
            <input className="input" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
          </Field>
        </div>
        <button
          className="btn primary mt16"
          disabled={pw !== pw2 || (pw.length > 0 && pw.length < 8)}
          onClick={() => run(() => api.backupCreate(pw || null), (r) => `Respaldo guardado en ${r}`)}
        >
          <HardDriveDownload /> Crear respaldo
        </button>
        {pw.length > 0 && pw.length < 8 && <p className="tiny muted mt8">Usa al menos 8 caracteres.</p>}
      </Card>
      <Card title="Restaurar respaldo" icon={<HardDriveUpload />}>
        <Alert kind="warn">Restaurar reemplaza TODOS tus datos actuales por los del respaldo.</Alert>
        <Field label="Contraseña del respaldo (si tiene)">
          <input className="input" type="password" value={rpw} onChange={(e) => setRpw(e.target.value)} />
        </Field>
        <button
          className="btn mt16"
          onClick={() => {
            if (!confirm('¿Reemplazar todos tus datos por los del respaldo?')) return;
            run(async () => {
              const r = await api.backupRestore(rpw || null);
              if (r) await reload();
              return r;
            }, (r) => `Respaldo del ${new Date(String(r)).toLocaleString('es-MX')} restaurado.`);
          }}
        >
          <HardDriveUpload /> Restaurar
        </button>
      </Card>
      <Card title="Exportar información" icon={<Download />}>
        <p className="small muted mb16">Exporta todos tus registros para analizarlos en otra herramienta (las fotos solo se incluyen en los respaldos).</p>
        <div className="row">
          <button className="btn" onClick={() => run(api.exportJson, (r) => `Exportado: ${r}`)}>
            <Download /> JSON
          </button>
          <button className="btn" onClick={() => run(api.exportCsv, (r) => `Archivos CSV en: ${r}`)}>
            <Download /> CSV (Excel)
          </button>
        </div>
      </Card>
      <Card title="Importar registros" icon={<Upload />}>
        <p className="small muted mb8">CSV con encabezados. Fechas en formato AAAA-MM-DD.</p>
        <ul className="tiny muted" style={{ paddingLeft: 18 }}>
          <li>Peso y medidas: date, weight, waist, neck, hip, chest, arm, thigh, calf, abdomen</li>
          <li>Pasos: date, steps</li>
          <li>Comidas: date, meal, name, grams, kcal, protein, carbs, fat, fiber</li>
        </ul>
        <div className="row mt8">
          {(
            [
              ['body_logs', 'Peso y medidas'],
              ['steps_logs', 'Pasos'],
              ['food_logs', 'Comidas'],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              className="btn"
              onClick={() =>
                run(async () => {
                  const r = await api.importCsv(k);
                  if (r) await reload();
                  return r;
                }, (r) => {
                  const x = r as { imported: number; errors: string[] };
                  return `${x.imported} filas importadas${x.errors.length ? `; ${x.errors.length} con errores: ${x.errors.slice(0, 3).join(' ')}` : '.'}`;
                })
              }
            >
              <Upload /> {l}
            </button>
          ))}
          <button
            className="btn"
            onClick={() =>
              run(async () => {
                const r = await api.importJson();
                if (r != null) await reload();
                return r;
              }, (r) => `${r} registros importados desde JSON.`)
            }
          >
            <Upload /> Exportación JSON
          </button>
        </div>
      </Card>
      <Card title="Ubicación de los datos" icon={<FolderOpen />}>
        <p className="small mono" style={{ wordBreak: 'break-all' }}>
          {info?.dataDir}
        </p>
        <p className="tiny muted mt8">Fotos: cifradas · {info?.photoEncryption}. Versión {info?.version}.</p>
        <button className="btn mt8" onClick={() => api.openDataFolder()}>
          <FolderOpen /> Abrir carpeta
        </button>
      </Card>
      <Card title="Eliminar todos los datos" icon={<Trash2 />}>
        <p className="small muted mb16">Borra perfil, registros, fotos, planes y ajustes de este equipo. No se puede deshacer (los respaldos que hayas creado no se ven afectados).</p>
        <button
          className="btn danger"
          onClick={async () => {
            if (!confirm('¿Eliminar TODOS tus datos de BODY OS de forma permanente?')) return;
            if (prompt('Escribe ELIMINAR para confirmar') !== 'ELIMINAR') return;
            await run(api.deleteAll, () => 'Todos los datos fueron eliminados.');
            await reload();
          }}
        >
          <Trash2 /> Eliminar todo
        </button>
      </Card>
    </div>
  );
}

function Privacy() {
  return (
    <Card title="Privacidad y seguridad">
      <Claims
        items={[
          { kind: 'dato', text: 'Toda tu información (perfil, registros, fotos) se guarda localmente en este equipo, en una base de datos SQLite en la carpeta de datos de la aplicación.' },
          { kind: 'dato', text: 'Las fotografías se guardan cifradas (AES-256-GCM) y sin modificaciones; la clave se protege con el llavero del sistema cuando está disponible.' },
          { kind: 'dato', text: 'BODY OS no comparte información con terceros ni tiene analíticas o telemetría.' },
          { kind: 'dato', text: 'Solo hay dos funciones que usan internet, y ambas son opcionales: la búsqueda por código de barras (envía únicamente el número del código a Open Food Facts) y la IA externa (envía el resumen que puedes revisar en Inteligencia artificial → Configuración de IA, y solo si la activas).' },
          { kind: 'recomendacion', text: 'Protege tus respaldos con contraseña y guárdalos en un lugar seguro.' },
          { kind: 'recomendacion', text: 'Puedes eliminar todos tus datos desde Datos y respaldos.' },
        ]}
      />
    </Card>
  );
}

function References() {
  const topics = [...new Set(REFERENCES.map((r) => r.topic))];
  return (
    <div className="col" style={{ gap: 16 }}>
      <Card title="Limitaciones de las fórmulas y estimaciones">
        <ul className="small" style={{ paddingLeft: 18, margin: 0 }}>
          {LIMITATIONS.map((l) => (
            <li key={l} style={{ marginBottom: 4 }}>
              {l}
            </li>
          ))}
        </ul>
      </Card>
      {topics.map((t) => (
        <Card key={t} title={t}>
          <div className="col">
            {REFERENCES.filter((r) => r.topic === t).map((r) => (
              <div key={r.key}>
                <p className="small">{r.citation}</p>
                <p className="tiny muted">
                  Uso en BODY OS: {r.usedFor}{' '}
                  {r.url && (
                    <a href={r.url} target="_blank" rel="noreferrer">
                      {r.url}
                    </a>
                  )}
                </p>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
