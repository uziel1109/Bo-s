export {};
declare global {
  interface Window {
    bodyos: {
      platform: 'desktop' | 'web';
      invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
      pathForFile: (f: File) => string;
    };
  }
  const __APP_VERSION__: string;
}
