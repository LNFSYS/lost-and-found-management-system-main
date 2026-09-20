export function unexpectedPort<T extends object>(label: string): T {
  return new Proxy({} as T, {
    get(target, key, receiver) {
      if (Reflect.has(target, key)) return Reflect.get(target, key, receiver);
      return () => { throw new Error(`Unexpected call to ${label}.${String(key)}; provide a test fake`); };
    }
  });
}
