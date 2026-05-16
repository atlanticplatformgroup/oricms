import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import fs from 'fs/promises';
import { CDNExportService } from '../lib/cdn/service.js';
import type { StorageConfig } from '../lib/cdn/providers.js';

export function cdnCommand(program: Command): void {
  const cdn = program
    .command('cdn')
    .description('CDN export and management');

  // Export command
  cdn
    .command('export')
    .description('Export build output to CDN')
    .requiredOption('-s, --source <path>', 'Source directory to export')
    .requiredOption('-p, --provider <provider>', 'Storage provider (s3, r2, minio)')
    .requiredOption('-b, --bucket <bucket>', 'S3/R2 bucket name')
    .option('-r, --region <region>', 'AWS region (default: auto)')
    .option('-e, --endpoint <url>', 'Custom endpoint (for R2/MinIO)')
    .option('--access-key <key>', 'Access key ID (or set AWS_ACCESS_KEY_ID)')
    .option('--secret-key <key>', 'Secret access key (or set AWS_SECRET_ACCESS_KEY)')
    .option('--prefix <prefix>', 'Destination prefix/folder', '')
    .option('--base-url <url>', 'CDN base URL for output URLs')
    .option('--sync', 'Sync mode: delete files not in source', false)
    .action(async (options) => {
      const spinner = ora('Preparing export...').start();

      try {
        // Validate source
        const sourcePath = path.resolve(options.source);
        try {
          const stat = await fs.stat(sourcePath);
          if (!stat.isDirectory()) {
            spinner.fail('Source path is not a directory');
            process.exit(1);
          }
        } catch {
          spinner.fail(`Source path does not exist: ${sourcePath}`);
          process.exit(1);
        }

        // Get credentials from env or options
        const accessKeyId = options.accessKey || process.env.AWS_ACCESS_KEY_ID;
        const secretAccessKey = options.secretKey || process.env.AWS_SECRET_ACCESS_KEY;

        if (!accessKeyId || !secretAccessKey) {
          spinner.fail('Access key and secret key required. Use --access-key/--secret-key or set AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY');
          process.exit(1);
        }

        const config: StorageConfig = {
          provider: options.provider,
          bucket: options.bucket,
          region: options.region,
          endpoint: options.endpoint,
          accessKeyId,
          secretAccessKey,
          baseUrl: options.baseUrl,
        };

        spinner.text = 'Connecting to storage...';
        const service = new CDNExportService(config);

        spinner.text = options.sync ? 'Syncing files...' : 'Uploading files...';

        let lastProgress = 0;
        const exportOptions = {
          sourcePath,
          destinationPrefix: options.prefix,
          onProgress: (progress: { percentComplete: number; currentFile?: string }) => {
            if (progress.percentComplete !== lastProgress) {
              lastProgress = progress.percentComplete;
              spinner.text = `${options.sync ? 'Syncing' : 'Uploading'}... ${progress.percentComplete}% (${progress.currentFile || ''})`;
            }
          },
        };

        const result = options.sync
          ? await service.sync(exportOptions)
          : await service.export(exportOptions);

        if (result.success) {
          spinner.succeed(chalk.green(`✓ Exported ${result.uploaded} files successfully`));
          
          if (result.urls.length > 0) {
            console.log(chalk.dim('\nUploaded files:'));
            result.urls.slice(0, 5).forEach((url: string) => {
              console.log(chalk.dim(`  • ${url}`));
            });
            if (result.urls.length > 5) {
              console.log(chalk.dim(`  ... and ${result.urls.length - 5} more`));
            }
          }
        } else {
          spinner.warn(chalk.yellow(`Exported with warnings: ${result.uploaded} uploaded, ${result.failed} failed`));
          
          if (result.errors.length > 0) {
            console.log(chalk.red('\nErrors:'));
            result.errors.slice(0, 5).forEach((err: string) => {
              console.log(chalk.red(`  • ${err}`));
            });
          }
        }

        process.exit(result.success ? 0 : 1);
      } catch (error) {
        spinner.fail(error instanceof Error ? error.message : 'Export failed');
        process.exit(1);
      }
    });

  // List command
  cdn
    .command('list')
    .description('List files in CDN bucket')
    .requiredOption('-p, --provider <provider>', 'Storage provider')
    .requiredOption('-b, --bucket <bucket>', 'Bucket name')
    .option('-r, --region <region>', 'AWS region')
    .option('-e, --endpoint <url>', 'Custom endpoint')
    .option('--access-key <key>', 'Access key ID')
    .option('--secret-key <key>', 'Secret access key')
    .option('--prefix <prefix>', 'List prefix', '')
    .action(async (options) => {
      const spinner = ora('Listing files...').start();

      try {
        const accessKeyId = options.accessKey || process.env.AWS_ACCESS_KEY_ID;
        const secretAccessKey = options.secretKey || process.env.AWS_SECRET_ACCESS_KEY;

        if (!accessKeyId || !secretAccessKey) {
          spinner.fail('Access key and secret key required');
          process.exit(1);
        }

        const config: StorageConfig = {
          provider: options.provider,
          bucket: options.bucket,
          region: options.region,
          endpoint: options.endpoint,
          accessKeyId,
          secretAccessKey,
        };

        const service = new CDNExportService(config);
        const files = await service.listFiles(options.prefix);

        spinner.stop();

        if (files.length === 0) {
          console.log(chalk.yellow('No files found'));
          return;
        }

        console.log(chalk.bold(`\n${files.length} files:\n`));
        
        files.slice(0, 50).forEach(file => {
          console.log(`  ${chalk.dim('•')} ${file}`);
        });

        if (files.length > 50) {
          console.log(chalk.dim(`\n... and ${files.length - 50} more`));
        }
      } catch (error) {
        spinner.fail(error instanceof Error ? error.message : 'Failed to list files');
        process.exit(1);
      }
    });

  // Delete command
  cdn
    .command('delete')
    .description('Delete files from CDN')
    .requiredOption('-p, --provider <provider>', 'Storage provider')
    .requiredOption('-b, --bucket <bucket>', 'Bucket name')
    .requiredOption('-k, --keys <keys...>', 'Keys to delete')
    .option('-r, --region <region>', 'AWS region')
    .option('-e, --endpoint <url>', 'Custom endpoint')
    .option('--access-key <key>', 'Access key ID')
    .option('--secret-key <key>', 'Secret access key')
    .action(async (options) => {
      const spinner = ora('Deleting files...').start();

      try {
        const accessKeyId = options.accessKey || process.env.AWS_ACCESS_KEY_ID;
        const secretAccessKey = options.secretKey || process.env.AWS_SECRET_ACCESS_KEY;

        if (!accessKeyId || !secretAccessKey) {
          spinner.fail('Access key and secret key required');
          process.exit(1);
        }

        const config: StorageConfig = {
          provider: options.provider,
          bucket: options.bucket,
          region: options.region,
          endpoint: options.endpoint,
          accessKeyId,
          secretAccessKey,
        };

        const service = new CDNExportService(config);
        await service.deleteFiles(options.keys);

        spinner.succeed(chalk.green(`✓ Deleted ${options.keys.length} files`));
      } catch (error) {
        spinner.fail(error instanceof Error ? error.message : 'Failed to delete files');
        process.exit(1);
      }
    });

  // Cleanup command
  cdn
    .command('cleanup')
    .description('Clean up old deployments (keep last N)')
    .requiredOption('-p, --provider <provider>', 'Storage provider')
    .requiredOption('-b, --bucket <bucket>', 'Bucket name')
    .requiredOption('--prefix <prefix>', 'Deployment prefix (e.g., deploys/)')
    .option('-n, --keep <count>', 'Number of deployments to keep', '5')
    .option('-r, --region <region>', 'AWS region')
    .option('-e, --endpoint <url>', 'Custom endpoint')
    .option('--access-key <key>', 'Access key ID')
    .option('--secret-key <key>', 'Secret access key')
    .action(async (options) => {
      const spinner = ora('Cleaning up old deployments...').start();

      try {
        const accessKeyId = options.accessKey || process.env.AWS_ACCESS_KEY_ID;
        const secretAccessKey = options.secretKey || process.env.AWS_SECRET_ACCESS_KEY;

        if (!accessKeyId || !secretAccessKey) {
          spinner.fail('Access key and secret key required');
          process.exit(1);
        }

        const config: StorageConfig = {
          provider: options.provider,
          bucket: options.bucket,
          region: options.region,
          endpoint: options.endpoint,
          accessKeyId,
          secretAccessKey,
        };

        const service = new CDNExportService(config);
        const deleted = await service.cleanupDeployments(options.prefix, parseInt(options.keep));

        spinner.succeed(chalk.green(`✓ Cleaned up ${deleted} old deployments`));
      } catch (error) {
        spinner.fail(error instanceof Error ? error.message : 'Cleanup failed');
        process.exit(1);
      }
    });
}
