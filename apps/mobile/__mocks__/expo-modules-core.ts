// Minimal stub so packages that import expo-modules-core can be loaded in Jest.
export const requireNativeModule = jest.fn(() => ({}));
export class EventEmitter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(_module: any) {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addListener(_event: string, _listener: (...args: any[]) => void) {
    return { remove: jest.fn() };
  }
}
