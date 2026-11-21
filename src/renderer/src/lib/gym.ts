// Utilidades del modo gimnasio: pantalla siempre encendida, aviso sonoro y vibración.

let ctx: AudioContext | null = null;

/** Debe llamarse dentro de un toque del usuario (iPad solo permite audio después de una interacción). */
export function unlockAudio(): void {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx ??= new AC();
    if (ctx.state === 'suspended') void ctx.resume();
    // Un sonido inaudible "desbloquea" la salida en Safari.
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.02);
  } catch {
    /* sin audio */
  }
}

/** Tres pitidos cortos y vibración (donde exista). */
export function restDoneAlert(): void {
  try {
    navigator.vibrate?.([180, 90, 180, 90, 320]);
  } catch {
    /* sin vibración */
  }
  try {
    if (!ctx) unlockAudio();
    if (!ctx) return;
    const t0 = ctx.currentTime + 0.02;
    [0, 0.22, 0.44].forEach((d, i) => {
      const o = ctx!.createOscillator();
      const g = ctx!.createGain();
      o.type = 'sine';
      o.frequency.value = i === 2 ? 1320 : 880;
      g.gain.setValueAtTime(0.0001, t0 + d);
      g.gain.exponentialRampToValueAtTime(0.35, t0 + d + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + (i === 2 ? 0.32 : 0.16));
      o.connect(g).connect(ctx!.destination);
      o.start(t0 + d);
      o.stop(t0 + d + 0.36);
    });
  } catch {
    /* sin audio */
  }
}

type Sentinel = { release: () => Promise<void>; released?: boolean };

/** Mantiene la pantalla encendida mientras `active` sea verdadero. Devuelve si el navegador lo admite. */
export function keepScreenOn(): { stop: () => void; supported: boolean } {
  const wl = (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<Sentinel> } }).wakeLock;
  if (!wl) return { stop: () => {}, supported: false };
  let sentinel: Sentinel | null = null;
  let stopped = false;
  const acquire = async () => {
    try {
      if (!stopped && document.visibilityState === 'visible') sentinel = await wl.request('screen');
    } catch {
      /* el sistema lo negó (batería baja, etc.) */
    }
  };
  // El bloqueo se pierde al cambiar de app: se vuelve a pedir al regresar.
  const onVis = () => {
    if (document.visibilityState === 'visible') void acquire();
  };
  document.addEventListener('visibilitychange', onVis);
  void acquire();
  return {
    supported: true,
    stop: () => {
      stopped = true;
      document.removeEventListener('visibilitychange', onVis);
      void sentinel?.release().catch(() => {});
    },
  };
}

export async function enterFullscreen(el: HTMLElement): Promise<void> {
  try {
    const anyEl = el as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
    if (el.requestFullscreen) await el.requestFullscreen();
    else await anyEl.webkitRequestFullscreen?.();
  } catch {
    /* no disponible: se usa la capa a pantalla completa de la app */
  }
}

export async function exitFullscreen(): Promise<void> {
  try {
    const d = document as Document & { webkitExitFullscreen?: () => Promise<void>; webkitFullscreenElement?: Element };
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (d.webkitFullscreenElement) await d.webkitExitFullscreen?.();
  } catch {
    /* ignorar */
  }
}
