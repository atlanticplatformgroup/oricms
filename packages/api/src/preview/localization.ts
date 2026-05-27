export const SUPPORTED_PREVIEW_LOCALES = ['en', 'es'] as const;
type PreviewLocale = (typeof SUPPORTED_PREVIEW_LOCALES)[number];

interface LocalizedContentEntry {
  body?: unknown;
  schemaValues?: unknown;
}

function toRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function readLocalizedMap(frontmatter: Record<string, unknown>): Record<string, LocalizedContentEntry> {
  const raw = frontmatter._localizedContent;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return raw as Record<string, LocalizedContentEntry>;
}

export function applyLocaleToFrontmatterAndBody(
  frontmatter: unknown,
  body: string,
  locale?: string
): { frontmatter: Record<string, unknown>; body: string; resolvedFrom?: 'requested' | 'en' | 'default' } {
  const frontmatterRecord = toRecord(frontmatter);
  if (!locale) {
    return {
      frontmatter: frontmatterRecord,
      body,
    };
  }

  const localizedMap = readLocalizedMap(frontmatterRecord);
  const requested = toRecord(localizedMap[locale]);
  const fallbackEn = toRecord(localizedMap.en);

  const requestedBody = typeof requested.body === 'string' ? requested.body : undefined;
  const fallbackBody = typeof fallbackEn.body === 'string' ? fallbackEn.body : undefined;
  const resolvedBody = requestedBody ?? fallbackBody ?? body;

  const requestedSchemaValues = toRecord(requested.schemaValues);
  const fallbackSchemaValues = toRecord(fallbackEn.schemaValues);
  const currentSchemaValues = toRecord(frontmatterRecord._schemaValues);
  const resolvedSchemaValues = Object.keys(requestedSchemaValues).length > 0
    ? requestedSchemaValues
    : Object.keys(fallbackSchemaValues).length > 0
      ? fallbackSchemaValues
      : currentSchemaValues;

  const resolvedFrom: 'requested' | 'en' | 'default' = requestedBody
    ? 'requested'
    : fallbackBody
      ? 'en'
      : 'default';

  return {
    frontmatter: {
      ...frontmatterRecord,
      _schemaValues: resolvedSchemaValues,
      _resolvedLocale: locale,
      _resolvedLocaleSource: resolvedFrom,
    },
    body: resolvedBody,
    resolvedFrom,
  };
}

export function applyLocaleToObjectContent(content: unknown, locale?: string): unknown {
  if (!locale) return content;

  if (!content || typeof content !== 'object' || Array.isArray(content)) {
    return content;
  }

  const pageLike = content as Record<string, unknown>;
  const hasFrontmatterAndBody = 'frontmatter' in pageLike && 'body' in pageLike;
  if (hasFrontmatterAndBody && typeof pageLike.body === 'string') {
    const resolved = applyLocaleToFrontmatterAndBody(pageLike.frontmatter, pageLike.body, locale);
    return {
      ...pageLike,
      frontmatter: resolved.frontmatter,
      body: resolved.body,
    };
  }

  const localizedMap = toRecord(pageLike._localizedContent);
  if (Object.keys(localizedMap).length === 0) {
    return content;
  }

  const requested = toRecord(localizedMap[locale]);
  const fallbackEn = toRecord(localizedMap.en);
  const requestedBody = typeof requested.body === 'string' ? requested.body : undefined;
  const fallbackBody = typeof fallbackEn.body === 'string' ? fallbackEn.body : undefined;

  const requestedSchemaValues = toRecord(requested.schemaValues);
  const fallbackSchemaValues = toRecord(fallbackEn.schemaValues);
  const currentSchemaValues = toRecord(pageLike._schemaValues);

  return {
    ...pageLike,
    ...(requestedBody || fallbackBody ? { body: requestedBody ?? fallbackBody } : {}),
    _schemaValues: Object.keys(requestedSchemaValues).length > 0
      ? requestedSchemaValues
      : Object.keys(fallbackSchemaValues).length > 0
        ? fallbackSchemaValues
        : currentSchemaValues,
    _resolvedLocale: locale,
    _resolvedLocaleSource: requestedBody ? 'requested' : fallbackBody ? 'en' : 'default',
  };
}
