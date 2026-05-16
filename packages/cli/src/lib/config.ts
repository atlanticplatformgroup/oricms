/**
 * Config utilities for storing CLI configuration
 * Stores auth tokens, active project, and project settings
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const CONFIG_DIR = path.join(os.homedir(), '.oricms');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const PROJECT_CONFIG_FILE = '.oricms.json';

export interface CLIConfig {
  apiUrl?: string;
  accessToken?: string;
  refreshToken?: string;
  activeProjectId?: string;
  user?: {
    id: string;
    email: string;
    name: string;
  };
}

export interface ProjectConfig {
  projectId?: string;
  apiUrl?: string;
  sourceDir?: string;
  buildDir?: string;
  deployConfig?: {
    provider: 's3' | 'r2' | 'minio';
    bucket: string;
    region?: string;
    endpoint?: string;
    baseUrl?: string;
  };
}

/**
 * Load global CLI config
 */
export async function loadConfig(): Promise<CLIConfig> {
  try {
    const data = await fs.readFile(CONFIG_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

/**
 * Save global CLI config
 */
export async function saveConfig(config: CLIConfig): Promise<void> {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * Clear global CLI config (logout)
 */
export async function clearConfig(): Promise<void> {
  try {
    await fs.unlink(CONFIG_FILE);
  } catch {
    // File doesn't exist, that's fine
  }
}

/**
 * Load project-specific config
 */
export async function loadProjectConfig(cwd: string = process.cwd()): Promise<ProjectConfig | null> {
  try {
    const configPath = path.join(cwd, PROJECT_CONFIG_FILE);
    const data = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * Save project-specific config
 */
export async function saveProjectConfig(config: ProjectConfig, cwd: string = process.cwd()): Promise<void> {
  const configPath = path.join(cwd, PROJECT_CONFIG_FILE);
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * Check if user is logged in
 */
export async function isLoggedIn(): Promise<boolean> {
  const config = await loadConfig();
  return !!(config.accessToken && config.apiUrl);
}

/**
 * Get API client with auth header
 */
export async function getApiClient() {
  const config = await loadConfig();

  if (!config.accessToken || !config.apiUrl) {
    throw new Error('Not logged in. Run: oricms login');
  }

  return {
    apiUrl: config.apiUrl,
    accessToken: config.accessToken,
    async request(endpoint: string, options: RequestInit = {}) {
      const baseUrl = config.apiUrl!.endsWith('/') ? config.apiUrl!.slice(0, -1) : config.apiUrl!;
      const url = `${baseUrl}/api/v1${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
      const response = await fetch(url, {
        ...options,
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } })) as { error?: { message?: string } };
        throw new Error(errorData.error?.message || `HTTP ${response.status}`);
      }

      return response.json();
    },
  };
}
