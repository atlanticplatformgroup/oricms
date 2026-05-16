import type { FieldCapabilityContext, FieldCapabilityFieldType, FieldCapabilityResult, SchemaField } from '@ori/shared';
import { resolveFieldCapability } from '@ori/shared';
import { fieldRegistry } from '../../components/fields/registry';

interface ResolveRegisteredFieldCapabilityInput {
  field?: SchemaField;
  fieldType: FieldCapabilityFieldType;
  value: unknown;
  context?: FieldCapabilityContext;
}

export function resolveRegisteredFieldCapability(input: ResolveRegisteredFieldCapabilityInput): FieldCapabilityResult {
  const registryType = input.field?.type || input.fieldType;
  return fieldRegistry.resolveCapabilities(String(registryType), {
    field: input.field,
    fieldType: input.fieldType,
    value: input.value,
    context: input.context,
  });
}

export function resolveFallbackFieldCapability(input: ResolveRegisteredFieldCapabilityInput): FieldCapabilityResult {
  return resolveFieldCapability({
    field: input.field,
    fieldType: input.fieldType,
    value: input.value,
    context: input.context,
  });
}
