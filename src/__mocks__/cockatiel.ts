// Manual mock for cockatiel (ESM-only package — not compatible with Jest's CommonJS transform)
export const circuitBreaker = jest.fn(() => ({
  execute: jest.fn((fn: () => Promise<unknown>) => fn()),
  onBreak: jest.fn(),
  onReset: jest.fn(),
  onHalfOpen: jest.fn(),
}));

export const handleAll = {};

export class SamplingBreaker {
  constructor(_opts: unknown) {}
}

export class ConsecutiveBreaker {
  constructor(_count: number) {}
}

export type CircuitBreakerPolicy = ReturnType<typeof circuitBreaker>;
