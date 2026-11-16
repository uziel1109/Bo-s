// Cámara con guía para fotos de progreso: muestra tu foto anterior de la misma vista en transparencia
// (o una silueta si es la primera) para repetir pose, encuadre y distancia. Incluye temporizador.
import { useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, SwitchCamera, Timer, X } from 'lucide-react';
import { usePhotoUrl, api } from '../api';
import type { PhotoRow } from '../store';
import { keepScreenOn, restDoneAlert, unlockAudio } from '../lib/gym';
import { formatDateShort } from '@shared/utils';

type Pose = PhotoRow['pose'];

export function GhostCamera({ pose, previous, onClose, onSaved, meta }: { pose: Pose; previous: PhotoRow | null; onClose: () => void; onSaved: () => void; meta: () => object }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const [error, setError] = useState<string | null>(null);
  const [opacity, setOpacity] = useState(0.4);
  const [delay, setDelay] = useState(5);
  const [count, setCount] = useState<number | null>(null);
  const [shot, setShot] = useState<{ blob: Blob; url: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const ghost = usePhotoUrl(previous?.file_name ?? '');
  const mirror = facing === 'user';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Este navegador no permite usar la cámara aquí. Usa "Seleccionar archivo".');
        if (!(await api.cameraAccess())) throw new Error('No hay permiso para usar la cámara. Actívalo en la configuración del sistema.');
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1920 } }, audio: false });
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        stream.current = s;
        if (video.current) {
          video.current.srcObject = s;
          await video.current.play().catch(() => {});
        }
        setError(null);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(/denied|NotAllowed/i.test(msg) ? 'Permiso de cámara denegado. En el iPad: Configuración → Safari (o la app) → Cámara → Permitir.' : msg);
      }
    })();
    return () => {
      cancelled = true;
      stream.current?.getTracks().forEach((t) => t.stop());
      stream.current = null;
    };
  }, [facing]);

  useEffect(() => {
    const k = keepScreenOn();
    return () => k.stop();
  }, []);

  // Cuenta regresiva del temporizador
  useEffect(() => {
    if (count == null) return;
    if (count <= 0) {
      setCount(null);
      capture();
      return;
    }
    const t = setTimeout(() => setCount(count - 1), 1000);
    return () => clearTimeout(t);
  }, [count]);

  const capture = () => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const g = c.getContext('2d')!;
    // La foto se guarda sin espejo (como la vería otra persona), igual que las fotos importadas.
    g.drawImage(v, 0, 0);
    restDoneAlert();
    c.toBlob((b) => b && setShot({ blob: b, url: URL.createObjectURL(b) }), 'image/jpeg', 0.92);
  };

  const save = async () => {
    if (!shot) return;
    setSaving(true);
    try {
      await api.addPhotoBytes(new Uint8Array(await shot.blob.arrayBuffer()), meta());
      URL.revokeObjectURL(shot.url);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ghost-cam" data-testid="ghost-camera">
      <div className="ghost-top">
        <button className="gym-icon" onClick={onClose} aria-label="Cerrar cámara">
          <X />
        </button>
        <div className="grow">
          <div className="small" style={{ fontWeight: 700 }}>
            Foto de {pose}
          </div>
          <div className="tiny muted">{previous ? `Guía: tu foto del ${formatDateShort(previous.date)}` : 'Guía: silueta (es tu primera foto de esta vista)'}</div>
        </div>
        {!shot && (
          <button className="gym-icon" onClick={() => setFacing(facing === 'user' ? 'environment' : 'user')} aria-label="Cambiar cámara">
            <SwitchCamera />
          </button>
        )}
      </div>

      <div className="ghost-stage">
        {error ? (
          <div className="ghost-error">{error}</div>
        ) : shot ? (
          <img src={shot.url} alt="Foto tomada" className="ghost-media" />
        ) : (
          <>
            <video ref={video} className="ghost-media" playsInline muted style={{ transform: mirror ? 'scaleX(-1)' : undefined }} />
            {previous && ghost ? (
              <img src={ghost} alt="" className="ghost-media ghost-overlay" style={{ opacity, transform: mirror ? 'scaleX(-1)' : undefined }} data-testid="ghost-overlay" />
            ) : (
              <Silhouette pose={pose} opacity={Math.max(0.35, opacity)} />
            )}
            {count != null && <div className="ghost-count mono">{count}</div>}
          </>
        )}
      </div>

      <div className="ghost-controls">
        {shot ? (
          <>
            <button
              className="gym-btn"
              onClick={() => {
                URL.revokeObjectURL(shot.url);
                setShot(null);
              }}
            >
              <RefreshCw /> Repetir
            </button>
            <button className="gym-done" style={{ minWidth: 220, height: 60 }} onClick={save} disabled={saving} data-testid="ghost-save">
              {saving ? 'Guardando…' : 'Guardar foto'}
            </button>
          </>
        ) : (
          <>
            <label className="ghost-slider small">
              Guía
              <input type="range" min={0} max={0.8} step={0.05} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} />
            </label>
            <div className="seg">
              {[0, 5, 10].map((d) => (
                <button key={d} className={delay === d ? 'on' : ''} onClick={() => setDelay(d)} type="button">
                  {d ? (
                    <>
                      <Timer size={13} /> {d} s
                    </>
                  ) : (
                    'Ya'
                  )}
                </button>
              ))}
            </div>
            <button
              className="ghost-shutter"
              disabled={!!error || count != null}
              onClick={() => {
                unlockAudio();
                if (delay) setCount(delay);
                else capture();
              }}
              aria-label="Tomar foto"
              data-testid="ghost-shutter"
            >
              <Camera size={28} />
            </button>
          </>
        )}
      </div>
      <p className="tiny muted center" style={{ margin: 0 }}>
        Alinea tu cabeza, hombros y pies con la guía. Misma luz, distancia y ropa que la vez anterior.
      </p>
    </div>
  );
}

/** Silueta genérica de cuerpo completo (frente/espalda o perfil) para la primera foto. */
function Silhouette({ pose, opacity }: { pose: Pose; opacity: number }) {
  const side = pose === 'perfil';
  return (
    <svg className="ghost-media ghost-silhouette" viewBox="0 0 100 200" preserveAspectRatio="xMidYMid meet" style={{ opacity }} aria-hidden data-testid="ghost-silhouette">
      <g fill="none" stroke="#fff" strokeWidth="1.2" strokeDasharray="3 2" strokeLinejoin="round">
        {side ? (
          <path d="M50 14 a9 10 0 1 1 -0.1 0 M47 33 C54 36 58 40 58 50 C59 62 57 72 55 84 C54 96 56 104 55 116 C54 134 56 150 55 166 C55 176 57 182 62 186 L46 186 C46 176 47 166 46 150 C45 134 44 120 44 106 C43 96 41 86 42 74 C42 62 40 50 41 42 C42 36 44 34 47 33 Z M49 44 C47 58 46 72 47 92" />
        ) : (
          <path d="M50 14 a9 10 0 1 1 -0.1 0 M44 33 C36 35 31 38 30 46 L26 78 C25 86 24 94 25 102 M56 33 C64 35 69 38 70 46 L74 78 C75 86 76 94 75 102 M44 33 L56 33 M34 46 C35 62 36 74 38 88 C39 98 37 104 37 112 C36 130 38 150 38 166 C38 176 37 182 33 186 L46 186 C46 172 47 158 48 140 L50 120 L52 140 C53 158 54 172 54 186 L67 186 C63 182 62 176 62 166 C62 150 64 130 63 112 C63 104 61 98 62 88 C64 74 65 62 66 46" />
        )}
        <line x1="0" y1="186" x2="100" y2="186" strokeDasharray="1 3" />
      </g>
    </svg>
  );
}
