import { beforeEach, describe, expect, it } from 'vitest';
import { bootstrapPluginRuntime, resetPluginRuntimeForTests } from '../runtime';

describe('plugin runtime bootstrap', () => {
  beforeEach(() => {
    resetPluginRuntimeForTests();
  });

  it('is idempotent', () => {
    expect(() => {
      bootstrapPluginRuntime();
      bootstrapPluginRuntime();
    }).not.toThrow();
  });
});
