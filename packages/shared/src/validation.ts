import { z } from 'zod';
import type { Environment, ProjectSettings } from './types';

export const LEGACY_PREVIEW_ENVIRONMENT_ID = 'legacy-preview';

export const optionalUrlSchema = z.string().url().or(z.literal('')).optional();

export const environmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string().url().or(z.literal('')),
  type: z.enum(['preview', 'live']).optional(),
  buildWebhook: optionalUrlSchema,
  revalidationUrl: optionalUrlSchema,
  revalidationSecret: z.string().optional(),
  revalidationSecretEncrypted: z.string().optional(),
  autoPublish: z.boolean().optional(),
  order: z.number().optional(),
});

export const branchMappingSchema = z.object({
  branchPattern: z.string().trim().min(1).max(100),
  environmentId: z.string().nullable().optional(),
  autoDeploy: z.boolean().optional(),
  deployOnMerge: z.boolean().optional(),
});

export const uiGroupSchema = z.object({
  id: z.string().trim().min(1),
  slug: z.string().trim().min(1).max(100),
  label: z.string().trim().min(1).max(100),
  description: z.string().optional(),
  icon: z.string().optional(),
  order: z.number().int().min(0).optional(),
  visible: z.boolean().optional(),
  locked: z.boolean().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
}).passthrough();

export const pageContentSchema = z.object({
  content: z.string().min(1, 'Content cannot be empty').max(10 * 1024 * 1024, 'Content must be less than 10MB'),
  message: z.string().max(500, 'Commit message must be less than 500 characters').optional(),
});

export const filePathSchema = z.string()
  .min(1, 'Path is required')
  .max(500, 'Path must be less than 500 characters')
  .regex(/^[a-zA-Z0-9_\-/.]+$/, 'Path contains invalid characters')
  .refine((path) => !path.includes('..'), 'Path cannot contain parent directory references');

export const commitMessageSchema = z.string()
  .min(1, 'Commit message is required')
  .max(500, 'Commit message must be less than 500 characters');

export const branchNameSchema = z.string()
  .min(1, 'Branch name is required')
  .max(255, 'Branch name must be less than 255 characters')
  .regex(/^[a-zA-Z0-9_\-/.]+$/, 'Invalid branch name');

export const projectSettingsSchema = z.object({
  contentRoot: z.string().optional(),
  previewUrl: optionalUrlSchema,
  deploymentWebhook: optionalUrlSchema,
  allowedOrigins: z.array(z.string()).optional(),
  webhookSecret: z.string().optional(),
  environments: z.array(environmentSchema).optional(),
  defaultEnvironmentId: z.string().optional(),
  uiGroups: z.array(uiGroupSchema).optional(),
  deliveryApiKeyHash: z.string().optional(),
  deliveryApiKeyPrefix: z.string().optional(),
  requireDeliveryApiKey: z.boolean().optional(),
  graphql: z.object({
    deliveryPersistedQueries: z.object({
      enabled: z.boolean().optional(),
      requirePersistedOnly: z.boolean().optional(),
      queries: z.array(z.object({
        id: z.string(),
        query: z.string(),
        sha256: z.string(),
        operationName: z.string().optional(),
        createdAt: z.string().optional(),
      })).optional(),
    }).optional(),
    schemaRegistry: z.object({
      latestVersion: z.number().int().min(0).optional(),
      latestHash: z.string().optional(),
      snapshots: z.array(z.object({
        version: z.number().int().min(1),
        hash: z.string(),
        sdl: z.string(),
        createdAt: z.string(),
      })).optional(),
    }).optional(),
  }).optional(),
  plugins: z.object({
    enabled: z.array(z.string()).optional(),
    hookEndpoints: z.record(z.record(z.string().url().or(z.literal('')))).optional(),
    executionPolicy: z.object({
      mode: z.enum(['disabled', 'webhook-only']).optional(),
      enforceManifestCapabilities: z.boolean().optional(),
      allowlistedHooks: z.array(z.string()).optional(),
      blockedPlugins: z.array(z.string()).optional(),
    }).optional(),
    secrets: z.record(z.object({
      encryptedSecret: z.string(),
      secretPrefix: z.string(),
      rotatedAt: z.string(),
    })).optional(),
    retry: z.object({
      maxAttempts: z.number().int().min(1).max(10).optional(),
      baseDelayMs: z.number().int().min(1).max(60000).optional(),
      timeoutMs: z.number().int().min(100).max(60000).optional(),
    }).optional(),
  }).optional(),
  features: z.object({
    scheduling: z.boolean().optional(),
    staging: z.boolean().optional(),
    i18n: z.boolean().optional(),
  }).optional(),
}).passthrough();

function toLegacyPreviewEnvironment(previewUrl: string): Environment {
  return {
    id: LEGACY_PREVIEW_ENVIRONMENT_ID,
    name: 'Preview',
    url: previewUrl,
    type: 'preview',
    order: 0,
  };
}

export function withLegacyPreviewEnvironment<T extends Pick<ProjectSettings, 'previewUrl' | 'environments' | 'defaultEnvironmentId'>>(
  settings?: T | null,
): T {
  const next = { ...(settings || {}) } as T;
  const previewUrl = typeof next.previewUrl === 'string' ? next.previewUrl.trim() : '';
  const environments = Array.isArray(next.environments) ? next.environments : [];

  if (environments.length === 0 && previewUrl) {
    next.environments = [toLegacyPreviewEnvironment(previewUrl)] as T['environments'];
    if (!next.defaultEnvironmentId) {
      next.defaultEnvironmentId = LEGACY_PREVIEW_ENVIRONMENT_ID as T['defaultEnvironmentId'];
    }
  }

  return next;
}

export function normalizeProjectSettingsForStorage<T extends Pick<ProjectSettings, 'previewUrl' | 'environments' | 'defaultEnvironmentId'>>(
  settings?: T | null,
): T {
  const next = withLegacyPreviewEnvironment(settings);
  delete next.previewUrl;
  return next;
}

export const assetUploadSchema = z.object({
  filename: z.string().min(1).max(255).regex(/^[a-zA-Z0-9_\-.]+$/, 'Filename contains invalid characters'),
  contentType: z.enum([
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'application/pdf',
    'text/plain',
  ]),
  size: z.number().max(50 * 1024 * 1024, 'File size must be less than 50MB'),
});

export type EnvironmentValidationMap = Record<string, {
  name?: string;
  url?: string;
  buildWebhook?: string;
  revalidationUrl?: string;
}>;

function isValidUrl(value: string): boolean {
  if (!value.trim()) return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export function validateEnvironments(
  environments: Array<z.infer<typeof environmentSchema>>,
): EnvironmentValidationMap {
  return environments.reduce<EnvironmentValidationMap>((accumulator, environment) => {
    const next: EnvironmentValidationMap[string] = {};

    if (!environment.name.trim()) next.name = 'Environment name is required';
    if (environment.url !== '' && !isValidUrl(environment.url)) next.url = 'Environment URL must be a valid absolute URL';
    if (environment.buildWebhook && !isValidUrl(environment.buildWebhook)) next.buildWebhook = 'Build webhook must be a valid absolute URL';
    if (environment.revalidationUrl && !isValidUrl(environment.revalidationUrl)) next.revalidationUrl = 'Revalidation URL must be a valid absolute URL';

    if (Object.keys(next).length > 0) accumulator[environment.id] = next;
    return accumulator;
  }, {});
}

export function canCreateBranchMapping(branchPattern: string): boolean {
  return branchMappingSchema.safeParse({ branchPattern }).success;
}

export type PageContentInput = z.infer<typeof pageContentSchema>;
export type ProjectSettingsInput = z.infer<typeof projectSettingsSchema>;
export type AssetUploadInput = z.infer<typeof assetUploadSchema>;
export type EnvironmentInput = z.infer<typeof environmentSchema>;
export type BranchMappingInput = z.infer<typeof branchMappingSchema>;
