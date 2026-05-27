import { describe, expect, it } from 'vitest';
import {
  extractProjectEnvironments,
  isValidRepoUrl,
  sanitizeSettingsForStorage,
} from '../settings-core';

describe('project settings core helpers', () => {
  it('accepts supported repo urls', () => {
    expect(isValidRepoUrl('https://github.com/oricms/repo')).toBe(true);
    expect(isValidRepoUrl('http://localhost/repo')).toBe(true);
    expect(isValidRepoUrl('file:///tmp/repo')).toBe(true);
    expect(isValidRepoUrl('git@github.com:oricms/repo.git')).toBe(false);
  });

  it('extracts project environments from normalized settings', () => {
    expect(
      extractProjectEnvironments({
        environments: [
          {
            id: 'preview',
            name: 'Preview',
            type: 'preview',
            buildWebhook: 'https://example.com/build',
            revalidationUrl: 'https://example.com/revalidate',
          },
        ],
      }),
    ).toEqual([
      {
        id: 'preview',
        name: 'Preview',
        type: 'preview',
        buildWebhook: 'https://example.com/build',
        revalidationUrl: 'https://example.com/revalidate',
      },
    ]);
  });

  it('sanitizes incoming settings and encrypts revalidation secrets', () => {
    const sanitized = sanitizeSettingsForStorage(
      {
        environments: [
          {
            id: 'preview',
            name: 'Preview',
            revalidationSecret: 'top-secret',
          },
        ],
      },
      {},
    );

    expect(sanitized).toMatchObject({
      environments: [
        {
          id: 'preview',
          name: 'Preview',
        },
      ],
    });
    const [environment] = sanitized.environments as Array<Record<string, unknown>>;
    expect(environment.revalidationSecret).toBeUndefined();
    expect(typeof environment.revalidationSecretEncrypted).toBe('string');
    expect(String(environment.revalidationSecretEncrypted).split(':')).toHaveLength(3);
  });

  it('preserves existing encrypted secrets and rejects server-managed input fields', () => {
    const preserved = sanitizeSettingsForStorage(
      {
        environments: [
          {
            id: 'preview',
            name: 'Preview',
          },
        ],
      },
      {
        environments: [
          {
            id: 'preview',
            revalidationSecretEncrypted: 'existing-secret',
          },
        ],
      },
    );

    expect((preserved.environments as Array<Record<string, unknown>>)[0].revalidationSecretEncrypted).toBe(
      'existing-secret',
    );

    expect(() =>
      sanitizeSettingsForStorage(
        {
          environments: [
            {
              id: 'preview',
              revalidationSecretEncrypted: 'not-allowed',
            },
          ],
        },
        {},
      ),
    ).toThrow('revalidationSecretEncrypted is managed by the server');
  });
});
