/**
 * Deploy command - Deploy site to configured CDN
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import fs from 'fs/promises';
import { loadProjectConfig, getApiClient } from '../lib/config.js';
import { CDNExportService } from '../lib/cdn/service.js';
import type { StorageConfig } from '../lib/cdn/providers.js';

export function deployCommand(program: Command): void {
  program
    .command('deploy')
    .description('Deploy project to configured CDN')
    .option('-b, --build <path>', 'Build directory to deploy', './dist')
    .option('-e, --env <environment>', 'Deployment environment', 'production')
    .option('--preview', 'Create a preview deployment')
    .option('--sync', 'Sync mode: delete files not in source', false)
    .action(async (options) => {
      const spinner = ora().start();

      try {
        // Load project config
        const projectConfig = await loadProjectConfig();
        
        if (!projectConfig) {
          spinner.stop();
          console.log(chalk.yellow('\nNo project configuration found.\n'));
          console.log(chalk.dim('Initialize a project first:'));
          console.log(chalk.dim('  oricms init\n'));
          process.exit(1);
        }

        if (!projectConfig.projectId) {
          spinner.stop();
          console.log(chalk.yellow('\nNo project configured for this directory.\n'));
          console.log(chalk.dim('Set a project:'));
          console.log(chalk.dim('  oricms project switch <project-id>\n'));
          process.exit(1);
        }

        // Check deploy config
        const deployConfig = projectConfig.deployConfig;
        
        if (!deployConfig) {
          spinner.stop();
          console.log(chalk.yellow('\nNo deployment configuration found.\n'));
          console.log(chalk.dim('Configure deployment in .oricms.json:'));
          console.log(chalk.dim(`
{
  "deployConfig": {
    "provider": "s3",
    "bucket": "my-bucket",
    "region": "us-east-1"
  }
}
`));
          console.log(chalk.dim('Or use environment variables:'));
          console.log(chalk.dim('  AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY\n'));
          process.exit(1);
        }

        const buildDir = path.resolve(options.build);

        // Verify build directory exists
        try {
          const stat = await fs.stat(buildDir);
          if (!stat.isDirectory()) {
            throw new Error('Build path is not a directory');
          }
        } catch {
          spinner.stop();
          console.log(chalk.yellow(`\nBuild directory not found: ${buildDir}\n`));
          console.log(chalk.dim('Build your project first, then run:\n'));
          console.log(chalk.dim('  oricms deploy\n'));
          process.exit(1);
        }

        // Get credentials from environment
        const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
        const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

        if (!accessKeyId || !secretAccessKey) {
          spinner.stop();
          console.log(chalk.yellow('\nAWS credentials not found.\n'));
          console.log(chalk.dim('Set environment variables:'));
          console.log(chalk.dim('  export AWS_ACCESS_KEY_ID=your_key'));
          console.log(chalk.dim('  export AWS_SECRET_ACCESS_KEY=your_secret\n'));
          process.exit(1);
        }

        spinner.text = 'Connecting to storage...';

        const storageConfig: StorageConfig = {
          provider: deployConfig.provider,
          bucket: deployConfig.bucket,
          region: deployConfig.region,
          endpoint: deployConfig.endpoint,
          accessKeyId,
          secretAccessKey,
          baseUrl: deployConfig.baseUrl,
        };

        const service = new CDNExportService(storageConfig);

        // Create deployment prefix
        const timestamp = Date.now();
        const prefix = options.preview 
          ? `previews/${projectConfig.projectId}/${timestamp}`
          : `deploys/${projectConfig.projectId}/${timestamp}`;

        spinner.text = options.sync ? 'Syncing files...' : 'Uploading files...';

        // Track progress
        let lastProgress = 0;
        const exportOptions = {
          sourcePath: buildDir,
          destinationPrefix: prefix,
          onProgress: (progress: { percentComplete: number; currentFile?: string }) => {
            if (progress.percentComplete !== lastProgress) {
              lastProgress = progress.percentComplete;
              spinner.text = `${options.sync ? 'Syncing' : 'Uploading'}... ${progress.percentComplete}%`;
            }
          },
        };

        const result = options.sync
          ? await service.sync(exportOptions)
          : await service.export(exportOptions);

        if (result.success) {
          spinner.succeed(chalk.green(`✓ Deployed ${result.uploaded} files`));
          
          // Get project info for deployment URL
          try {
            const api = await getApiClient();
            const projectData = await api.request(`/projects/${projectConfig.projectId}`) as { data: { project: { name: string } } };
            const projectName = projectData.data.project.name;
            
            console.log();
            console.log(chalk.bold('Deployment:'));
            console.log(chalk.dim(`  Project: ${projectName}`));
            console.log(chalk.dim(`  Files:   ${result.uploaded}`));
            if (result.failed > 0) {
              console.log(chalk.yellow(`  Failed:  ${result.failed}`));
            }
            console.log(chalk.dim(`  Prefix:  ${prefix}`));
            
            if (deployConfig.baseUrl) {
              const deployUrl = `${deployConfig.baseUrl}/${prefix}`;
              console.log(chalk.dim(`  URL:     ${deployUrl}`));
            }
            console.log();

            // Create build record in API
            try {
              await api.request(`/projects/${projectConfig.projectId}/builds`, {
                method: 'POST',
                body: JSON.stringify({
                  status: 'completed',
                  url: deployConfig.baseUrl ? `${deployConfig.baseUrl}/${prefix}` : undefined,
                  metadata: {
                    files: result.uploaded,
                    prefix,
                    environment: options.env,
                  },
                }),
              });
            } catch {
              // Ignore API errors for build recording
            }

          } catch {
            console.log();
            console.log(chalk.bold('Deployment:'));
            console.log(chalk.dim(`  Files:   ${result.uploaded}`));
            console.log(chalk.dim(`  Prefix:  ${prefix}`));
            console.log();
          }
        } else {
          spinner.warn(chalk.yellow(`Deployed with warnings: ${result.uploaded} uploaded, ${result.failed} failed`));
          
          if (result.errors.length > 0) {
            console.log(chalk.red('\nErrors:'));
            result.errors.slice(0, 5).forEach((err: string) => {
              console.log(chalk.red(`  • ${err}`));
            });
          }
          process.exit(1);
        }
      } catch (error) {
        spinner.fail(error instanceof Error ? error.message : 'Deployment failed');
        process.exit(1);
      }
    });
}
