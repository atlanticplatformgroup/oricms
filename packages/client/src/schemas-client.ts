import { OriCmsClientError } from './errors.js';
import type { ApiEnvelope, ContentTypeSchemaStub } from './client-types.js';

interface SchemasClientContext {
  normalizedApiUrl: string;
  projectId: string;
  token?: string;
  headers?: Record<string, string>;
}

function getSchemaHeaders(context: SchemasClientContext): Record<string, string> {
  if (!context.token) {
    throw new OriCmsClientError('Schema listing requires a management token', 'UNAUTHORIZED', 401);
  }

  return {
    ...(context.headers || {}),
    Authorization: `Bearer ${context.token}`,
  };
}

export function createSchemasClient(context: SchemasClientContext) {
  return {
    async list(): Promise<ContentTypeSchemaStub[]> {
      const response = await fetch(`${context.normalizedApiUrl}/api/v1/projects/${context.projectId}/content-types`, {
        headers: getSchemaHeaders(context),
      });

      const json = await response.json() as ApiEnvelope<{ contentTypes: ContentTypeSchemaStub[] }>;
      if (!response.ok || !json.success || !json.data) {
        throw new OriCmsClientError(
          json.error?.message || 'Failed to list content types',
          json.error?.code || 'REQUEST_FAILED',
          response.status,
        );
      }

      return json.data.contentTypes;
    },

    async generateTypeStubs(): Promise<string> {
      const types = await this.list();
      return generateSchemaTypeStubs(types);
    },
  };
}

function mapFieldTypeToTs(type: string): string {
  switch (type) {
    case 'string':
    case 'text':
    case 'richtext':
    case 'uid':
    case 'email':
    case 'url':
    case 'password':
    case 'date':
    case 'datetime':
      return 'string';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'json':
      return 'Record<string, unknown>';
    case 'relation':
    case 'media':
      return 'string';
    case 'enum':
      return 'string';
    default:
      return 'unknown';
  }
}

function pascalCase(input: string): string {
  return input
    .split(/[^a-zA-Z0-9]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

export function generateSchemaTypeStubs(types: ContentTypeSchemaStub[]): string {
  const lines: string[] = [];
  lines.push('// Auto-generated schema type stubs');
  lines.push('// Refine these interfaces with stricter field rules as needed.');
  lines.push('');

  for (const contentType of types) {
    const interfaceName = `${pascalCase(contentType.name)}Record`;
    lines.push(`export interface ${interfaceName} {`);
    lines.push('  $id: string;');
    lines.push(`  $type: '${contentType.name}';`);
    lines.push('  $createdAt: string;');
    lines.push('  $updatedAt: string;');

    for (const field of contentType.fields) {
      const tsType = mapFieldTypeToTs(field.type);
      lines.push(`  ${field.key}?: ${tsType};`);
    }

    lines.push('}');
    lines.push('');
  }

  return lines.join('\n');
}
