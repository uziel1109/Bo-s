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

/**
 * Silueta de guía para la primera foto: figura humana de proporciones normales (≈7.5 cabezas), rellena en
 * semitransparente, ocupando ~80 % del alto para dejar margen arriba de la cabeza y abajo de los pies.
 * Las líneas punteadas marcan dónde deben quedar la coronilla y los pies en cada foto.
 */
function Silhouette({ pose, opacity }: { pose: Pose; opacity: number }) {
  const side = pose === 'perfil';
  // Cuerpo de frente/espalda (viewBox 200 × 400; coronilla y = 40, pies y = 360)
  const front = [
    'M100 40 C90 40 84 49 84 61 C84 73 91 82 100 82 C109 82 116 73 116 61 C116 49 110 40 100 40 Z', // cabeza
    'M93 80 L93 96 L107 96 L107 80 Z', // cuello
    // torso: hombros, cintura y cadera
    'M60 108 C66 99 82 96 100 96 C118 96 134 99 140 108 C143 122 141 140 136 158 C133 170 133 182 136 196 C138 204 137 210 134 214 L66 214 C63 210 62 204 64 196 C67 182 67 170 64 158 C59 140 57 122 60 108 Z',
    // brazos (manos a media pierna)
    'M60 110 C53 116 50 130 49 148 C48 168 46 188 45 206 C44 216 45 224 48 230 L57 230 C58 222 58 212 59 200 C61 182 63 164 65 148 Z',
    'M140 110 C147 116 150 130 151 148 C152 168 154 188 155 206 C156 216 155 224 152 230 L143 230 C142 222 142 212 141 200 C139 182 137 164 135 148 Z',
    // piernas
    'M66 212 C68 240 70 270 72 296 C73 318 74 336 74 350 L70 360 L93 360 L94 350 C95 326 96 296 97 266 L99 218 Z',
    'M134 212 C132 240 130 270 128 296 C127 318 126 336 126 350 L130 360 L107 360 L106 350 C105 326 104 296 103 266 L101 218 Z',
  ];
  // Perfil (mirando a la derecha)
  const profile = [
    'M102 40 C92 40 86 49 86 61 C86 73 93 82 102 82 C109 82 114 77 116 70 L119 67 L116 62 C116 49 111 40 102 40 Z', // cabeza
    'M95 80 L95 98 L108 98 L108 80 Z',
    // torso: pecho al frente, espalda atrás
    'M88 100 C98 95 112 96 119 104 C124 114 124 130 121 144 C118 158 117 170 118 182 C119 194 120 204 117 214 L83 214 C79 204 80 194 82 184 C84 172 83 160 82 148 C80 132 81 114 88 100 Z',
    // brazo
    'M96 106 C104 104 109 112 109 124 C109 146 108 168 107 190 C106 206 105 220 103 230 L95 230 C94 218 94 204 94 190 C93 166 92 144 93 124 Z',
    // pierna
    'M84 212 C86 240 88 270 90 298 C91 320 91 338 90 352 L88 360 L118 360 L116 354 L106 350 C107 326 108 296 110 268 L114 214 Z',
  ];
  return (
    <svg className="ghost-media ghost-silhouette" viewBox="0 0 200 400" preserveAspectRatio="xMidYMid meet" style={{ opacity }} aria-hidden data-testid="ghost-silhouette">
      <g fill="rgba(255,255,255,0.16)" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round">
        {(side ? profile : front).map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <g stroke="#c8f53c" strokeWidth="1.2" strokeDasharray="4 4">
        <line x1="20" y1="40" x2="180" y2="40" />
        <line x1="20" y1="360" x2="180" y2="360" />
      </g>
      <g fill="#c8f53c" fontSize="9" fontFamily="system-ui, sans-serif">
        <text x="22" y="35">Cabeza aquí</text>
        <text x="22" y="372">Pies aquí</text>
      </g>
    </svg>
  );
}
