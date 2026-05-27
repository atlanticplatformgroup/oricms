import type { ContentCollection, Schema, Page } from './types.js';

export interface ExportOptions {
  /** Output directory for generated files */
  outputDir: string;
  /** Source directory (for local mode) */
  sourceDir?: string;
  /** Repository URL (for remote mode) */
  repoUrl?: string;
  /** Branch to fetch (default: main) */
  branch?: string;
  /** Git token for private repos */
  token?: string;
  /** Generate TypeScript types */
  generateTypes?: boolean;
  /** Copy assets to output */
  copyAssets?: boolean;
  /** Custom adapter config */
  config?: Record<string, unknown>;
}

export interface Adapter {
  name: string;
  version: string;
  description: string;
  
  /**
   * Validate adapter options
   */
  validate(options: ExportOptions): Promise<boolean>;
  
  /**
   * Generate types from schemas
   */
  generateTypes(schemas: Schema[], outputPath: string): Promise<void>;
  
  /**
   * Transform pages to framework format
   */
  transformPages(pages: Page[], options: ExportOptions): Promise<TransformedPage[]>;
  
  /**
   * Generate config/integration file
   */
  generateConfig(options: ExportOptions): Promise<void>;
  
  /**
   * Run post-export setup (install deps, etc)
   */
  postExport?(options: ExportOptions): Promise<void>;
}

export interface TransformedPage {
  /** Output file path */
  path: string;
  /** File content */
  content: string;
  /** Content type */
  type: 'json' | 'markdown' | 'typescript' | 'javascript';
}

export abstract class BaseAdapter implements Adapter {
  abstract name: string;
  abstract version: string;
  abstract description: string;
  
  async validate(options: ExportOptions): Promise<boolean> {
    if (!options.outputDir) {
      throw new Error('outputDir is required');
    }
    return true;
  }
  
  abstract generateTypes(schemas: Schema[], outputPath: string): Promise<void>;
  abstract transformPages(pages: Page[], options: ExportOptions): Promise<TransformedPage[]>;
  abstract generateConfig(options: ExportOptions): Promise<void>;
  
  async postExport?(options: ExportOptions): Promise<void> {
    // Optional override
  }
}
