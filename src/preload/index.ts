// Puente seguro entre la interfaz y el proceso principal (contextIsolation activado).
import { contextBridge, ipcRenderer, webUtils } from 'electron';

const invoke = async (channel: string, ...args: unknown[]) => {
  const r = (await ipcRenderer.invoke(channel, ...args)) as { ok: boolean; data?: unknown; error?: string };
  if (!r.ok) throw new Error(r.error ?? 'Error desconocido');
  return r.data;
};

const api = {
  invoke,
  pathForFile: (f: File) => webUtils.getPathForFile(f),
};

contextBridge.exposeInMainWorld('bodyos', api);
