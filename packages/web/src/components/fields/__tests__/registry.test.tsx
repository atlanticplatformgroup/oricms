import { describe, expect, it, vi } from 'vitest';
import { createFieldRegistry, extendFieldRegistry, fieldRegistry } from '../registry';

function makeRenderer(_name: string) {
  return (() => null) as any;
}

describe('field registry', () => {
  it('registers builtin renderers', () => {
    expect(fieldRegistry.has('string')).toBe(true);
    expect(fieldRegistry.has('blocks')).toBe(true);
    expect(fieldRegistry.get('richtext')).not.toBeNull();
  });

  it('prefers higher priority registrations', () => {
    const registry = createFieldRegistry();
    registry.initBuiltins();
    const lower = makeRenderer('lower');
    const higher = makeRenderer('higher');
    registry.register({ type: 'string', id: 'plugin:lower', component: lower, priority: 1 });
    registry.register({ type: 'string', id: 'plugin:higher', component: higher, priority: 10 });
    expect(registry.get('string')).toBe(higher);
  });

  it('uses last registration when priorities are equal', () => {
    const registry = createFieldRegistry();
    const first = makeRenderer('first');
    const second = makeRenderer('second');
    registry.register({ type: 'custom', id: 'plugin:first', component: first, priority: 5 });
    registry.register({ type: 'custom', id: 'plugin:second', component: second, priority: 5 });
    expect(registry.get('custom')).toBe(second);
  });

  it('does not replace higher priority with lower priority', () => {
    const registry = createFieldRegistry();
    const higher = makeRenderer('higher');
    const lower = makeRenderer('lower');
    registry.register({ type: 'custom', id: 'plugin:higher', component: higher, priority: 10 });
    registry.register({ type: 'custom', id: 'plugin:lower', component: lower, priority: 1 });
    expect(registry.get('custom')).toBe(higher);
  });

  it('replaces same source instead of accumulating', () => {
    const registry = createFieldRegistry();
    const first = makeRenderer('first');
    const second = makeRenderer('second');
    registry.register({ type: 'custom', id: 'plugin:source', component: first, priority: 5 });
    registry.register({ type: 'custom', id: 'plugin:source', component: second, priority: 5 });
    expect(registry.getAll().filter((item) => item.type === 'custom')).toHaveLength(1);
    expect(registry.get('custom')).toBe(second);
  });

  it('returns fallback for unknown field types', () => {
    const registry = createFieldRegistry();
    const resolved = registry.resolve('unknown-type');
    expect(resolved.isFallback).toBe(true);
    expect(resolved.component).toBeTruthy();
  });

  it('is idempotent when builtins are initialized repeatedly', () => {
    const registry = createFieldRegistry();
    registry.initBuiltins();
    const count = registry.getAll().length;
    registry.initBuiltins();
    expect(registry.getAll()).toHaveLength(count);
  });

  it('extends a registry deterministically', () => {
    const registry = createFieldRegistry();
    const component = makeRenderer('plugin');
    extendFieldRegistry(registry, [{ type: 'plugin-field', id: 'plugin:test', component, priority: 10 }]);
    expect(registry.get('plugin-field')).toBe(component);
  });

  it('warns when replacing a renderer with a new source', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const registry = createFieldRegistry();
    registry.register({ type: 'custom', id: 'plugin:a', component: makeRenderer('a'), priority: 5 });
    registry.register({ type: 'custom', id: 'plugin:b', component: makeRenderer('b'), priority: 5 });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
