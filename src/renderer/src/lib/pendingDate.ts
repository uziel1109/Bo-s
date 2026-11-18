// Fecha elegida en "Registrar un día anterior" que la siguiente pantalla abre ya seleccionada (una sola vez).
type Target = 'comida' | 'entreno' | 'cardio' | 'agua' | 'suplementos';
const pending: Partial<Record<Target, string>> = {};

export function setPendingDate(t: Target, date: string): void {
  pending[t] = date;
}

export function takePendingDate(t: Target): string | undefined {
  const d = pending[t];
  delete pending[t];
  return d;
}
