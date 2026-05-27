import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import {
  loadConfig,
  saveConfig,
  clearConfig,
  loadProjectConfig,
  saveProjectConfig,
  isLoggedIn,
} from '../config.js';

const TEST_CONFIG_DIR = path.join(os.tmpdir(), 'oricms-test-' + Date.now());
const TEST_CONFIG_FILE = path.join(TEST_CONFIG_DIR, 'config.json');
const TEST_PROJECT_CONFIG = path.join(TEST_CONFIG_DIR, '.oricms.json');

describe('Config utilities', () => {
  beforeEach(async () => {
    await fs.mkdir(TEST_CONFIG_DIR, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(TEST_CONFIG_DIR, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('loadConfig', () => {
    it('should return empty object when config does not exist', async () => {
      const config = await loadConfig(TEST_CONFIG_DIR);
      expect(config).toEqual({});
    });

    it('should load existing config', async () => {
      const testConfig = {
        apiUrl: 'http://localhost:3001',
        accessToken: 'test-token',
        user: { id: '1', email: 'test@example.com', name: 'Test' },
      };
      await fs.writeFile(TEST_CONFIG_FILE, JSON.stringify(testConfig), 'utf-8');

      const config = await loadConfig(TEST_CONFIG_DIR);
      expect(config).toEqual(testConfig);
    });

    it('should handle invalid JSON gracefully', async () => {
      await fs.writeFile(TEST_CONFIG_FILE, 'invalid json', 'utf-8');

      const config = await loadConfig(TEST_CONFIG_DIR);
      expect(config).toEqual({});
    });
  });

  describe('saveConfig', () => {
    it('should save config to file', async () => {
      const config = {
        apiUrl: 'http://localhost:3001',
        accessToken: 'test-token',
      };
      await saveConfig(config, TEST_CONFIG_DIR);

      const saved = await fs.readFile(TEST_CONFIG_FILE, 'utf-8');
      expect(JSON.parse(saved)).toEqual(config);
    });

    it('should create config directory if it does not exist', async () => {
      const nestedDir = path.join(os.tmpdir(), 'oricms-nested-' + Date.now());
      const nestedFile = path.join(nestedDir, 'config.json');
      
      await saveConfig({ apiUrl: 'test' }, nestedDir);

      const saved = await fs.readFile(nestedFile, 'utf-8');
      expect(JSON.parse(saved).apiUrl).toBe('test');
    });
  });

  describe('clearConfig', () => {
    it('should remove config file', async () => {
      await fs.writeFile(TEST_CONFIG_FILE, JSON.stringify({ apiUrl: 'test' }), 'utf-8');
      
      await clearConfig(TEST_CONFIG_DIR);

      await expect(fs.access(TEST_CONFIG_FILE)).rejects.toThrow();
    });

    it('should not throw when config does not exist', async () => {
      await expect(clearConfig(TEST_CONFIG_DIR)).resolves.not.toThrow();
    });
  });

  describe('loadProjectConfig', () => {
    it('should return null when project config does not exist', async () => {
      const config = await loadProjectConfig(TEST_CONFIG_DIR);
      expect(config).toBeNull();
    });

    it('should load existing project config', async () => {
      const testConfig = {
        projectId: 'proj-1',
        apiUrl: 'http://localhost:3001',
      };
      await fs.writeFile(TEST_PROJECT_CONFIG, JSON.stringify(testConfig), 'utf-8');

      const config = await loadProjectConfig(TEST_CONFIG_DIR);
      expect(config).toEqual(testConfig);
    });

    it('should handle invalid JSON gracefully', async () => {
      await fs.writeFile(TEST_PROJECT_CONFIG, 'invalid json', 'utf-8');

      const config = await loadProjectConfig(TEST_CONFIG_DIR);
      expect(config).toBeNull();
    });
  });

  describe('saveProjectConfig', () => {
    it('should save project config to file', async () => {
      const config = {
        projectId: 'proj-1',
        sourceDir: './src',
      };
      await saveProjectConfig(config, TEST_CONFIG_DIR);

      const saved = await fs.readFile(TEST_PROJECT_CONFIG, 'utf-8');
      expect(JSON.parse(saved)).toEqual(config);
    });
  });

  describe('isLoggedIn', () => {
    it('should return true when accessToken and apiUrl exist', async () => {
      await saveConfig({
        apiUrl: 'http://localhost:3001',
        accessToken: 'test-token',
      }, TEST_CONFIG_DIR);

      const result = await isLoggedIn(TEST_CONFIG_DIR);
      expect(result).toBe(true);
    });

    it('should return false when accessToken is missing', async () => {
      await saveConfig({ apiUrl: 'http://localhost:3001' }, TEST_CONFIG_DIR);

      const result = await isLoggedIn(TEST_CONFIG_DIR);
      expect(result).toBe(false);
    });

    it('should return false when apiUrl is missing', async () => {
      await saveConfig({ accessToken: 'test-token' }, TEST_CONFIG_DIR);

      const result = await isLoggedIn(TEST_CONFIG_DIR);
      expect(result).toBe(false);
    });

    it('should return false when config is empty', async () => {
      const result = await isLoggedIn(TEST_CONFIG_DIR);
      expect(result).toBe(false);
    });
  });
});
