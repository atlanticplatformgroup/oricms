import type { ComponentSchema, ContentType, SchemaField } from '@ori/shared';

function normalizeFieldForCompatibility(field: SchemaField): Record<string, unknown> {
  return {
    key: field.key,
    type: field.type,
    required: field.required ?? false,
    unique: field.unique ?? false,
    minLength: field.minLength ?? null,
    maxLength: field.maxLength ?? null,
    min: field.min ?? null,
    max: field.max ?? null,
    multiple: field.multiple ?? false,
    allowedTypes: field.allowedTypes ?? [],
    relation: field.relation
      ? {
          target: field.relation.target,
          type: field.relation.type,
          inverse: field.relation.inverse ?? null,
        }
      : null,
    uidSource: field.uidSource ?? null,
    component: field.component ?? null,
    repeatable: field.repeatable ?? false,
    enumValues: (field.enumValues ?? []).map((option) => option.value),
    fields: (field.fields ?? []).map(normalizeFieldForCompatibility),
    options: field.options
      ? {
          min: field.options.min ?? null,
          max: field.options.max ?? null,
          multiple: field.options.multiple ?? false,
          minLength: field.options.minLength ?? null,
          maxLength: field.options.maxLength ?? null,
          minItems: field.options.minItems ?? null,
          maxItems: field.options.maxItems ?? null,
          pattern: field.options.pattern ?? null,
          accept: field.options.accept ?? [],
          referenceCollection: field.options.referenceCollection ?? null,
          referenceKind: field.options.referenceKind ?? null,
          relationType: field.options.relationType ?? null,
          hierarchyRole: field.options.hierarchyRole ?? null,
          derivedFrom: field.options.derivedFrom ?? null,
          deriveStrategy: field.options.deriveStrategy ?? null,
          deriveWhen: field.options.deriveWhen ?? null,
          allowCustomValue: field.options.allowCustomValue ?? false,
          capabilityPreset: field.options.capabilityPreset ?? null,
          allowedComponents: field.options.allowedComponents ?? [],
          choices: (field.options.choices ?? []).map((choice) => choice.value),
          visibleWhen: field.options.visibleWhen
            ? {
                field: field.options.visibleWhen.field,
                operator: field.options.visibleWhen.operator,
                value: field.options.visibleWhen.value ?? null,
              }
            : null,
        }
      : null,
  };
}

export function normalizeContentTypeForCompatibility(contentType: ContentType): Record<string, unknown> {
  return {
    id: contentType.$id,
    name: contentType.name,
    plural: contentType.plural,
    fields: contentType.fields.map(normalizeFieldForCompatibility),
    listFields: contentType.listFields ?? [],
    searchFields: contentType.searchFields ?? [],
  };
}

export function normalizeComponentSchemaForCompatibility(schema: ComponentSchema): Record<string, unknown> {
  return {
    id: schema.$id,
    name: schema.name,
    fields: schema.fields.map(normalizeFieldForCompatibility),
  };
}

export function collectReferencedComponentIds(fields: SchemaField[]): string[] {
  const componentIds = new Set<string>();

  const visit = (fieldList: SchemaField[]) => {
    fieldList.forEach((field) => {
      if (field.component) {
        componentIds.add(field.component);
      }
      (field.options?.allowedComponents ?? []).forEach((componentId) => componentIds.add(componentId));
      if (field.fields?.length) {
        visit(field.fields);
      }
    });
  };

  visit(fields);
  return [...componentIds].sort((left, right) => left.localeCompare(right));
}
