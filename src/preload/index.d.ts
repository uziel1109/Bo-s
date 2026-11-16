export {};
declare global {
  interface Window {
    bodyos: {
      invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
      pathForFile: (f: File) => string;
    };
  }
}
