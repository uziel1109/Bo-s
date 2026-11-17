// Fila deslizable estilo iOS: deslizar a la izquierda muestra "Quitar"; deslizar hasta el fondo la elimina.
// Funciona con dedo y con mouse (eventos de puntero). El desplazamiento vertical de la página se respeta.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Trash2 } from 'lucide-react';

const REVEAL = 92; // ancho del botón visible
const FULL = 0.55; // fracción del ancho que elimina directamente

export function SwipeRow({ children, onDelete, label = 'Quitar', testId }: { children: ReactNode; onDelete: () => void; label?: string; testId?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number; base: number; dir: 'h' | 'v' | null; id: number } | null>(null);
  const [dx, setDx] = useState(0);
  const [anim, setAnim] = useState(true);
  const [gone, setGone] = useState(false);

  // Cerrar si se toca fuera de la fila abierta.
  useEffect(() => {
    if (dx === 0) return;
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) {
        setAnim(true);
        setDx(0);
      }
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [dx === 0]);

  const remove = () => {
    setAnim(true);
    setDx(-(ref.current?.offsetWidth ?? 400));
    setGone(true);
    setTimeout(onDelete, 220);
  };

  return (
    <div className={`swipe-row ${gone ? 'gone' : ''}`} ref={ref} data-testid={testId}>
      <button type="button" className="swipe-action" onClick={remove} style={{ width: Math.max(REVEAL, -dx) }} tabIndex={dx ? 0 : -1} aria-label={label}>
        <Trash2 size={17} />
        <span>{label}</span>
      </button>
      <div
        className="swipe-content"
        style={{ transform: `translateX(${dx}px)`, transition: anim ? 'transform 0.22s ease' : 'none' }}
        onPointerDown={(e) => {
          if (e.pointerType === 'mouse' && e.button !== 0) return;
          start.current = { x: e.clientX, y: e.clientY, base: dx, dir: null, id: e.pointerId };
        }}
        onPointerMove={(e) => {
          const s = start.current;
          if (!s) return;
          const mx = e.clientX - s.x;
          const my = e.clientY - s.y;
          if (!s.dir) {
            if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
            s.dir = Math.abs(mx) > Math.abs(my) ? 'h' : 'v';
            if (s.dir === 'h') {
              (e.currentTarget as HTMLElement).setPointerCapture(s.id);
              setAnim(false);
            }
          }
          if (s.dir !== 'h') return;
          setDx(Math.min(0, s.base + mx));
        }}
        onPointerUp={() => {
          const s = start.current;
          start.current = null;
          if (!s || s.dir !== 'h') return;
          setAnim(true);
          const w = ref.current?.offsetWidth ?? 400;
          if (-dx > w * FULL) remove();
          else if (-dx > REVEAL / 2) setDx(-REVEAL);
          else setDx(0);
        }}
        onPointerCancel={() => {
          start.current = null;
          setAnim(true);
          setDx(0);
        }}
      >
        {children}
      </div>
    </div>
  );
}
