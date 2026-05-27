/**
 * Init command - Initialize a new OriCMS project
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs/promises';
import path from 'path';
import { loadConfig, saveConfig, saveProjectConfig, loadProjectConfig, isLoggedIn, getApiClient } from '../lib/config.js';

export function initCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize a new OriCMS project')
    .option('-n, --name <name>', 'Project name')
    .option('-p, --project <project>', 'Project ID to use (creates new if not specified)')
    .option('-r, --repo <repo>', 'Git repository URL (creates new project if provided)')
    .option('--slug <slug>', 'Project slug (auto-generated from name if not provided)')
    .option('-t, --template <template>', 'Project template', 'astro')
    .option('--skip-install', 'Skip npm install')
    .argument('[directory]', 'Project directory', '.')
    .action(async (directory, options) => {
      const spinner = ora().start();
      const targetDir = path.resolve(directory);

      try {
        // Check if logged in
        if (!(await isLoggedIn())) {
          spinner.stop();
          console.log(chalk.yellow('\nNot logged in. Please run:'));
          console.log(chalk.dim('  oricms login\n'));
          process.exit(1);
        }

        // Check if directory already has a project
        const existingConfig = await loadProjectConfig(targetDir);
        if (existingConfig) {
          spinner.stop();
          console.log(chalk.yellow('\nDirectory already initialized:'));
          console.log(chalk.dim(`  Project ID: ${existingConfig.projectId}\n`));

          const readline = await import('readline');
          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
          });

          const answer = await new Promise<string>((resolve) => {
            rl.question(chalk.dim('Reinitialize? (y/N): '), (ans) => {
              rl.close();
              resolve(ans);
            });
          });

          if (answer.toLowerCase() !== 'y') {
            console.log(chalk.dim('Cancelled\n'));
            return;
          }

          spinner.start();
        }

        spinner.text = 'Setting up project...';

        // Create directory if needed
        await fs.mkdir(targetDir, { recursive: true });

        // Get or create project
        let projectId = options.project;
        let projectNameResult: string | undefined;

        if (!projectId) {
          let repoUrl: string | undefined = options.repo;
          
          // Prompt for Git repository URL if not provided via --repo
          if (!repoUrl) {
            spinner.stop();
            
            // Prompt for Git repository URL
            console.log(chalk.dim('\nGit Repository Setup:'));
            console.log(chalk.dim('OriCMS stores content in Git. Enter your repository URL.'));
            console.log(chalk.dim('Example: https://github.com/username/repo\n'));
            
            const readline = await import('readline');
            const rl = readline.createInterface({
              input: process.stdin,
              output: process.stdout,
            });
            
            repoUrl = await new Promise<string>((resolve) => {
              rl.question(chalk.dim('Repository URL: '), (answer) => {
                rl.close();
                resolve(answer.trim());
              });
            });
          }

          if (!repoUrl) {
            console.log(chalk.red('\nRepository URL is required'));
            process.exit(1);
          }

          // Basic URL validation
          if (!repoUrl.match(/^https?:\/\//)) {
            console.log(chalk.red('\nInvalid repository URL. Must start with http:// or https://'));
            process.exit(1);
          }

          if (!options.repo) {
            spinner.start('Creating project...');
          } else {
            spinner.text = 'Creating project...';
          }
          
          const api = await getApiClient();

          const projectName = options.name || path.basename(targetDir);
          let slug = options.slug || projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
          
          // Try to create project with slug, retry with suffix if taken
          let attempt = 0;
          let projectCreated = false;
          let response: { data: { project: { id: string; name: string } } };
          
          while (!projectCreated && attempt < 10) {
            try {
              response = await api.request('/projects', {
                method: 'POST',
                body: JSON.stringify({
                  name: projectName,
                  slug: attempt === 0 ? slug : `${slug}-${attempt}`,
                  description: `Created via CLI init`,
                  repoUrl: repoUrl,
                }),
              }) as { data: { project: { id: string; name: string } } };
              projectCreated = true;
            } catch (error) {
              if (error instanceof Error && error.message.includes('already taken')) {
                attempt++;
                if (attempt >= 10) {
                  throw new Error(`Could not create project: slug "${slug}" and variants are all taken`);
                }
              } else {
                throw error;
              }
            }
          }

          projectId = response!.data.project.id;
          projectNameResult = response!.data.project.name;

          // Set as active project
          const config = await loadConfig();
          config.activeProjectId = projectId;
          await saveConfig(config);
        }

        // Create project config
        spinner.text = 'Creating project files...';

        const projectConfig = {
          projectId,
          apiUrl: (await loadConfig()).apiUrl,
          sourceDir: './content',
          buildDir: './dist',
        };

        await saveProjectConfig(projectConfig, targetDir);

        // Create .gitignore
        const gitignorePath = path.join(targetDir, '.gitignore');
        const gitignoreContent = `# OriCMS
.oricms.json
content/
dist/
.env
`;
        try {
          await fs.writeFile(gitignorePath, gitignoreContent, 'utf-8');
        } catch {
          // File might exist, that's fine
        }

        // Create README
        const readmePath = path.join(targetDir, 'README.md');
        const readmeContent = `# ${projectNameResult || options.name || path.basename(targetDir)}

OriCMS project initialized with the CLI.

## Getting Started

\`\`\`bash
# Export content for local development
oricms export astro --source ./content --out ./site

# Or export to other frameworks
oricms export nextjs --source ./content --out ./site
\`\`\`

## Commands

- \`oricms project list\` - List your projects
- \`oricms project switch <id>\` - Switch active project
- \`oricms export <framework>\` - Export content to framework
- \`oricms cdn export\` - Deploy to CDN

## Project Structure

\`\`\`
.
├── .oricms.json          # Project configuration
├── content/              # Exported content (gitignored)
└── dist/                 # Build output (gitignored)
\`\`\`
`;

        try {
          await fs.writeFile(readmePath, readmeContent, 'utf-8');
        } catch {
          // File might exist
        }

        spinner.succeed(chalk.green(`✓ Initialized project`));

        console.log();
        console.log(chalk.bold('Project created:'));
        console.log(chalk.dim(`  Directory:  ${targetDir}`));
        console.log(chalk.dim(`  Project ID: ${projectId}`));
        if (projectNameResult) {
          console.log(chalk.dim(`  Project Name: ${projectNameResult}`));
        }
        console.log();

        console.log(chalk.bold('Next steps:'));
        if (directory !== '.') {
          console.log(chalk.dim(`  cd ${directory}`));
        }
        console.log(chalk.dim('  oricms project list     # View your projects'));
        console.log(chalk.dim('  oricms export astro     # Export content to Astro'));
        console.log();

      } catch (error) {
        spinner.fail(error instanceof Error ? error.message : 'Initialization failed');
        process.exit(1);
      }
    });
}
