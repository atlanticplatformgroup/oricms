#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import fs from 'fs/promises';
import { loadContentFromLocal, loadContentFromRepo } from './lib/loader.js';
import type { ExportOptions } from './lib/adapter.js';
import { AstroAdapter } from './adapters/astro.js';
import { NextjsAdapter } from './adapters/nextjs.js';
import { cdnCommand } from './commands/cdn.js';
import { authCommand } from './commands/auth.js';
import { projectCommand } from './commands/project.js';
import { initCommand } from './commands/init.js';
import { deployCommand } from './commands/deploy.js';
import { startCommand } from './commands/start.js';

const program = new Command();

program
  .name('oricms')
  .description('OriCMS CLI - Manage content and deploy to your frontend')
  .version('1.0.0');

// Add commands
authCommand(program);
projectCommand(program);
initCommand(program);
startCommand(program);
deployCommand(program);
cdnCommand(program);

program
  .command('export')
  .description('Export OriCMS content to framework-native format')
  .argument('<framework>', 'Target framework (astro, nextjs)')
  .option('-s, --source <path>', 'Source directory (local repo)')
  .option('-r, --repo <url>', 'Git repository URL')
  .option('-b, --branch <name>', 'Git branch (default: main)', 'main')
  .option('-t, --token <token>', 'Git authentication token')
  .option('-o, --out <dir>', 'Output directory', './')
  .option('--types', 'Generate TypeScript types', true)
  .option('--assets', 'Copy assets to output', true)
  .option('--format <format>', 'Output format (md, json, yaml)', 'md')
  .action(async (framework: string, options) => {
    const spinner = ora('Exporting content...').start();

    try {
      // Validate inputs
      if (!options.source && !options.repo) {
        spinner.fail('Either --source or --repo is required');
        process.exit(1);
      }

      // Get adapter
      const adapter = getAdapter(framework, { format: options.format });

      const exportOptions: ExportOptions = {
        outputDir: path.resolve(options.out),
        sourceDir: options.source,
        repoUrl: options.repo,
        branch: options.branch,
        token: options.token,
        generateTypes: options.types,
        copyAssets: options.assets,
      };

      // Validate
      spinner.text = 'Validating...';
      await adapter.validate(exportOptions);

      // Load content
      spinner.text = 'Loading content...';
      let content;
      if (options.source) {
        content = await loadContentFromLocal(path.resolve(options.source));
      } else {
        content = await loadContentFromRepo({
          repoUrl: options.repo,
          branch: options.branch,
          token: options.token,
        });
      }

      spinner.text = `Found ${content.pages.length} pages, ${content.schemas.length} schemas, ${content.assets.length} assets`;

      // Generate types
      if (exportOptions.generateTypes && content.schemas.length > 0) {
        spinner.text = 'Generating types...';
        const typesPath = path.join(exportOptions.outputDir, 'src', 'types', 'oricms.ts');
        await adapter.generateTypes(content.schemas, typesPath);
      }

      // Transform pages
      spinner.text = 'Transforming pages...';
      const transformed = await adapter.transformPages(content.pages, exportOptions);

      // Write files
      for (const file of transformed) {
        await fs.mkdir(path.dirname(file.path), { recursive: true });
        await fs.writeFile(file.path, file.content, 'utf-8');
      }

      // Generate config
      spinner.text = 'Generating config...';
      await adapter.generateConfig(exportOptions);

      // Post export
      if (adapter.postExport) {
        spinner.text = 'Running post-export...';
        await adapter.postExport(exportOptions);
      }

      spinner.succeed(chalk.green(`✓ Exported to ${exportOptions.outputDir}`));

      console.log(chalk.dim('\nNext steps:'));
      console.log(chalk.dim('  1. Import types from src/types/oricms.ts'));
      console.log(chalk.dim('  2. Query content using your framework\'s content API'));
      console.log(chalk.dim('  3. Run your build to see the content\n'));

    } catch (error) {
      spinner.fail(error instanceof Error ? error.message : 'Export failed');
      process.exit(1);
    }
  });

function getAdapter(framework: string, config: Record<string, unknown> = {}) {
  switch (framework.toLowerCase()) {
    case 'astro':
      return new AstroAdapter(config);
    case 'nextjs':
      return new NextjsAdapter(config);
    default:
      throw new Error(`Unknown framework: ${framework}. Supported: astro, nextjs`);
  }
}

program.parse();
