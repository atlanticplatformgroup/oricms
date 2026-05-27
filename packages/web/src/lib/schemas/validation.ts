import type { ComponentSchema, ContentType } from '@ori/shared';

interface SchemaValidationResult {
  schemaIssues: string[];
  fieldIssuesByKey: Record<string, string[]>;
  issueCount: number;
}

const FIELD_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*$/;

function trimOrEmpty(value: string | undefined): string {
  return value?.trim() || '';
}

export function getSchemaValidation(schema: ContentType | ComponentSchema | null): SchemaValidationResult {
  if (!schema) {
    return { schemaIssues: [], fieldIssuesByKey: {}, issueCount: 0 };
  }

  const schemaIssues: string[] = [];
  const fieldIssuesByKey: Record<string, string[]> = {};
  const seenKeys = new Map<string, number>();

  if (!trimOrEmpty(schema.label)) {
    schemaIssues.push('Schema label is required.');
  }

  schema.fields.forEach((field) => {
    seenKeys.set(field.key, (seenKeys.get(field.key) || 0) + 1);
  });

  schema.fields.forEach((field) => {
    const issues: string[] = [];
    const key = trimOrEmpty(field.key);

    if (!key) {
      issues.push('Field key is required.');
    } else if (!FIELD_KEY_PATTERN.test(key)) {
      issues.push('Field key must start with a letter and contain only letters, numbers, underscores, or hyphens.');
    }

    if ((seenKeys.get(field.key) || 0) > 1) {
      issues.push('Field key must be unique within this schema.');
    }

    if (!trimOrEmpty(field.label)) {
      issues.push('Field label is required.');
    }

    if (field.type === 'uid' && !trimOrEmpty(field.uidSource)) {
      issues.push('UID / slug fields need a source field.');
    }

    if ((field.type === 'enum' || field.type === 'select') && !(field.enumValues?.length || 0)) {
      issues.push('Select and enum fields need at least one choice.');
    }

    if (field.type === 'component' && !trimOrEmpty(field.component)) {
      issues.push('Component fields need a target component.');
    }

    if (field.type === 'blocks' && !(field.options?.allowedComponents?.length || 0)) {
      issues.push('Blocks fields need at least one allowed component.');
    }

    if (field.type === 'relation' && !trimOrEmpty(field.relation?.target)) {
      issues.push('Relation fields need a target collection.');
    }

    if (field.type === 'reference' && !trimOrEmpty(field.options?.referenceCollection)) {
      issues.push('Reference fields need a target collection.');
    }

    if (issues.length > 0) {
      fieldIssuesByKey[field.key] = issues;
    }
  });

  const issueCount =
    schemaIssues.length +
    Object.values(fieldIssuesByKey).reduce((total, issues) => total + issues.length, 0);

  return { schemaIssues, fieldIssuesByKey, issueCount };
}
