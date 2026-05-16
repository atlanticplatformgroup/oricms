import { describe, expect, it } from 'vitest';
import { applyLocaleToFrontmatterAndBody, applyLocaleToObjectContent } from '../localization';

describe('preview localization helpers', () => {
  it('applies requested locale body and schema values when available', () => {
    const result = applyLocaleToFrontmatterAndBody(
      {
        _schemaValues: { hero_title: 'Default' },
        _localizedContent: {
          en: { body: 'Hello', schemaValues: { hero_title: 'Hello EN' } },
          es: { body: 'Hola', schemaValues: { hero_title: 'Hola ES' } },
        },
      },
      'Default body',
      'es'
    );

    expect(result.body).toBe('Hola');
    expect(result.frontmatter._schemaValues).toEqual({ hero_title: 'Hola ES' });
    expect(result.frontmatter._resolvedLocale).toBe('es');
    expect(result.frontmatter._resolvedLocaleSource).toBe('requested');
  });

  it('falls back to en when requested locale is missing', () => {
    const result = applyLocaleToFrontmatterAndBody(
      {
        _schemaValues: { hero_title: 'Default' },
        _localizedContent: {
          en: { body: 'Hello', schemaValues: { hero_title: 'Hello EN' } },
        },
      },
      'Default body',
      'es'
    );

    expect(result.body).toBe('Hello');
    expect(result.frontmatter._schemaValues).toEqual({ hero_title: 'Hello EN' });
    expect(result.frontmatter._resolvedLocaleSource).toBe('en');
  });

  it('keeps canonical values when no localized entry exists', () => {
    const result = applyLocaleToFrontmatterAndBody(
      {
        _schemaValues: { hero_title: 'Default' },
      },
      'Default body',
      'es'
    );

    expect(result.body).toBe('Default body');
    expect(result.frontmatter._schemaValues).toEqual({ hero_title: 'Default' });
    expect(result.frontmatter._resolvedLocaleSource).toBe('default');
  });

  it('applies locale resolution for object-based content', () => {
    const result = applyLocaleToObjectContent(
      {
        body: 'Default body',
        _schemaValues: { hero_title: 'Default' },
        _localizedContent: {
          es: { body: 'Hola', schemaValues: { hero_title: 'Hola ES' } },
        },
      },
      'es'
    ) as Record<string, unknown>;

    expect(result.body).toBe('Hola');
    expect(result._schemaValues).toEqual({ hero_title: 'Hola ES' });
    expect(result._resolvedLocale).toBe('es');
    expect(result._resolvedLocaleSource).toBe('requested');
  });
});
