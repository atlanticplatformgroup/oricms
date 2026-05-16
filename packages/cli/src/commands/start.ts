/**
 * Start command - Start OriCMS services with Docker Compose
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { spawn, exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { promisify } from 'util';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const execAsync = promisify(exec);

/**
 * Check if Docker is installed and running
 */
async function checkDocker(): Promise<{ installed: boolean; running: boolean; message?: string }> {
  try {
    // Check if docker command exists
    await execAsync('docker --version');
  } catch {
    return {
      installed: false,
      running: false,
      message: 'Docker is not installed. Please install Docker: https://docs.docker.com/get-docker/',
    };
  }

  try {
    // Check if docker daemon is running
    await execAsync('docker info');
    return { installed: true, running: true };
  } catch {
    return {
      installed: true,
      running: false,
      message: 'Docker is installed but not running. Please start Docker Desktop or the Docker daemon.',
    };
  }
}

/**
 * Check if Docker Compose is available
 */
async function checkDockerCompose(): Promise<boolean> {
  try {
    await execAsync('docker compose version');
    return true;
  } catch {
    return false;
  }
}

export function startCommand(program: Command): void {
  program
    .command('start')
    .description('Start OriCMS services (PostgreSQL, API, Web) with Docker Compose')
    .option('-d, --detach', 'Run in detached mode (background)')
    .option('--build', 'Build images before starting')
    .action(async (options) => {
      const spinner = ora('Checking prerequisites...').start();

      // Check Docker
      const dockerStatus = await checkDocker();
      if (!dockerStatus.installed) {
        spinner.fail(chalk.red('Docker not found'));
        console.log(chalk.dim(`\n${dockerStatus.message}\n`));
        process.exit(1);
      }

      if (!dockerStatus.running) {
        spinner.fail(chalk.red('Docker is not running'));
        console.log(chalk.dim(`\n${dockerStatus.message}\n`));
        process.exit(1);
      }

      // Check Docker Compose
      const hasCompose = await checkDockerCompose();
      if (!hasCompose) {
        spinner.fail(chalk.red('Docker Compose not found'));
        console.log(chalk.dim('\nPlease install Docker Compose: https://docs.docker.com/compose/install/\n'));
        process.exit(1);
      }

      spinner.text = 'Checking Docker Compose...';

      try {
        // Check if docker-compose.yml exists in current directory or parent directories
        let composeDir = process.cwd();
        let composeFile = path.join(composeDir, 'docker-compose.yml');
        
        while (!(await fileExists(composeFile)) && composeDir !== path.dirname(composeDir)) {
          composeDir = path.dirname(composeDir);
          composeFile = path.join(composeDir, 'docker-compose.yml');
        }

        if (!(await fileExists(composeFile))) {
          spinner.fail(chalk.red('docker-compose.yml not found'));
          console.log(chalk.dim('\nMake sure you are in an OriCMS project directory.'));
          console.log(chalk.dim('Run this command from the root of the oricms repository.'));
          process.exit(1);
        }

        spinner.succeed(chalk.green('Found docker-compose.yml'));

        // Build args
        const args = ['compose', 'up'];
        if (options.detach) {
          args.push('-d');
        }
        if (options.build) {
          args.push('--build');
        }

        console.log(chalk.dim('\nStarting OriCMS services...'));
        console.log(chalk.dim('  - PostgreSQL (port 5432)'));
        console.log(chalk.dim('  - API (port 3001)'));
        console.log(chalk.dim('  - Web (port 5173)\n'));

        // Run docker compose
        const docker = spawn('docker', args, {
          cwd: composeDir,
          stdio: 'inherit',
        });

        docker.on('error', (error) => {
          if (error.message.includes('ENOENT')) {
            console.error(chalk.red('\n✖ Docker not found'));
            console.log(chalk.dim('\nPlease install Docker:'));
            console.log(chalk.dim('  https://docs.docker.com/get-docker/\n'));
            process.exit(1);
          }
          console.error(chalk.red(`\n✖ Error: ${error.message}`));
          process.exit(1);
        });

        docker.on('exit', (code) => {
          if (code === 0) {
            if (options.detach) {
              console.log(chalk.green('\n✓ Services started in background'));
              console.log(chalk.dim('\nView logs: docker compose logs -f'));
              console.log(chalk.dim('Stop: docker compose down\n'));
            }
          } else {
            console.error(chalk.red(`\n✖ Docker Compose exited with code ${code}`));
            process.exit(code || 1);
          }
        });

      } catch (error) {
        spinner.fail(error instanceof Error ? error.message : 'Failed to start services');
        process.exit(1);
      }
    });
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
