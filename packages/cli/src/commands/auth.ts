/**
 * Auth command - Login and logout
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import readline from 'readline';
import { loadConfig, saveConfig, clearConfig } from '../lib/config.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

export function authCommand(program: Command): void {
  const auth = program
    .command('login')
    .description('Authenticate with OriCMS instance')
    .option('-u, --url <url>', 'OriCMS API URL', 'http://localhost:3001')
    .option('-e, --email <email>', 'Email address')
    .option('-p, --password <password>', 'Password')
    .option('--github', 'Use GitHub OAuth (opens browser)')
    .action(async (options) => {
      const spinner = ora().start();

      try {
        // GitHub OAuth flow
        if (options.github) {
          spinner.stop();
          console.log(chalk.blue('\nGitHub OAuth login'));
          console.log(chalk.dim('1. Visit: ' + options.url + '/api/v1/auth/github'));
          console.log(chalk.dim('2. Authorize the application'));
          console.log(chalk.dim('3. Copy the token from the redirect URL\n'));
          
          const token = await question(chalk.dim('Paste your access token: '));
          
          if (!token.trim()) {
            throw new Error('Token is required');
          }

          spinner.start('Validating token...');

          // Validate token by calling /me endpoint
          const meResponse = await fetch(`${options.url}/api/v1/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` },
          });

          if (!meResponse.ok) {
            throw new Error('Invalid token');
          }

          const meData = await meResponse.json() as { data: { id: string; email: string; name: string } };

          // Save config (note: GitHub OAuth doesn't provide refresh token)
          await saveConfig({
            apiUrl: options.url,
            accessToken: token,
            user: meData.data,
          });

          spinner.succeed(chalk.green(`✓ Logged in as ${meData.data.email}`));
          console.log(chalk.dim(`\nAPI URL: ${options.url}`));
          console.log(chalk.dim('Run "oricms project list" to see your projects'));
          return;
        }

        // Email/password flow
        // Prompt for email if not provided
        let email = options.email;
        if (!email) {
          spinner.stop();
          email = await question(chalk.dim('Email: '));
          spinner.start();
        }

        // Prompt for password if not provided
        let password = options.password;
        if (!password) {
          spinner.stop();
          password = await question(chalk.dim('Password: '));
          spinner.start();
        }

        spinner.text = 'Authenticating...';

        // Call login API
        const response = await fetch(`${options.url}/api/v1/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: { message: 'Authentication failed' } })) as { error?: { message?: string } };
          throw new Error(errorData.error?.message || 'Invalid credentials');
        }

        const data = await response.json() as { data: { accessToken: string; refreshToken: string; user: { email: string; name: string; id: string } } };

        // Save config
        await saveConfig({
          apiUrl: options.url,
          accessToken: data.data.accessToken,
          refreshToken: data.data.refreshToken,
          user: data.data.user,
        });

        spinner.succeed(chalk.green(`✓ Logged in as ${data.data.user.email}`));
        console.log(chalk.dim(`\nAPI URL: ${options.url}`));
        console.log(chalk.dim('Run "oricms project list" to see your projects'));
      } catch (error) {
        spinner.fail(error instanceof Error ? error.message : 'Login failed');
        process.exit(1);
      } finally {
        rl.close();
      }
    });

  program
    .command('logout')
    .description('Logout from OriCMS')
    .action(async () => {
      const spinner = ora('Logging out...').start();
      
      try {
        await clearConfig();
        spinner.succeed(chalk.green('✓ Logged out'));
      } catch (error) {
        spinner.fail(error instanceof Error ? error.message : 'Logout failed');
        process.exit(1);
      }
    });

  program
    .command('whoami')
    .description('Show current user')
    .action(async () => {
      const config = await loadConfig();
      
      if (!config.user) {
        console.log(chalk.yellow('Not logged in. Run: oricms login'));
        process.exit(1);
      }

      console.log(chalk.bold('\nLogged in as:'));
      console.log(`  Name:  ${config.user.name}`);
      console.log(`  Email: ${config.user.email}`);
      console.log(`  API:   ${config.apiUrl}`);
      if (config.activeProjectId) {
        console.log(`  Project: ${config.activeProjectId}`);
      }
      console.log();
    });
}
