/**
 * Project command - Manage OriCMS projects
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { getApiClient, loadConfig, saveConfig, loadProjectConfig, saveProjectConfig } from '../lib/config.js';

interface Project {
  id: string;
  name: string;
  description?: string;
  role: string;
  createdAt: string;
}

function slugifyProjectName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .replace(/-{2,}/g, '-');
}

export function projectCommand(program: Command): void {
  const project = program
    .command('project')
    .description('Manage OriCMS projects');

  // List projects
  project
    .command('list')
    .description('List your projects')
    .option('-j, --json', 'Output as JSON')
    .action(async (options) => {
      const spinner = ora('Loading projects...').start();

      try {
        const api = await getApiClient();
        const data = await api.request('/projects') as { data: { projects: Project[] } };
        const projects: Project[] = data.data.projects;

        spinner.stop();

        if (options.json) {
          console.log(JSON.stringify(projects, null, 2));
          return;
        }

        if (projects.length === 0) {
          console.log(chalk.yellow('\nNo projects found.\n'));
          console.log(chalk.dim('Create a project with:'));
          console.log(chalk.dim('  oricms project create\n'));
          return;
        }

        const config = await loadConfig();
        const activeProjectId = config.activeProjectId;

        console.log(chalk.bold(`\n${projects.length} project(s):\n`));
        
        projects.forEach((project, index) => {
          const isActive = project.id === activeProjectId;
          const marker = isActive ? chalk.green('● ') : '  ';
          const name = isActive ? chalk.bold(project.name) : project.name;
          const role = chalk.dim(`(${project.role})`);
          
          console.log(`${marker}${name} ${role}`);
          if (project.description) {
            console.log(`    ${chalk.dim(project.description)}`);
          }
          if (index < projects.length - 1) {
            console.log();
          }
        });
        
        console.log();
        
        if (!activeProjectId) {
          console.log(chalk.dim('Set active project with: oricms project switch <project-id>\n'));
        }
      } catch (error) {
        spinner.fail(error instanceof Error ? error.message : 'Failed to load projects');
        process.exit(1);
      }
    });

  // Create project
  project
    .command('create')
    .description('Create a new project')
    .option('-n, --name <name>', 'Project name')
    .option('-d, --description <description>', 'Project description')
    .option('--default', 'Set as active project after creation')
    .action(async (options) => {
      const spinner = ora().start();

      try {
        // Prompt for name if not provided
        let name = options.name;
        if (!name) {
          spinner.stop();
          process.stdout.write(chalk.dim('Project name: '));
          const readline = await import('readline');
          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
          });
          name = await new Promise<string>((resolve) => {
            rl.question('', (answer) => {
              rl.close();
              resolve(answer);
            });
          });
          spinner.start();
        }

        if (!name.trim()) {
          throw new Error('Project name is required');
        }

        spinner.text = 'Creating project...';

        const api = await getApiClient();
        const trimmedName = name.trim();
        const baseSlug = slugifyProjectName(trimmedName);

        if (!baseSlug) {
          throw new Error('Project name must contain letters or numbers');
        }

        let newProject: Project | null = null;
        let lastError: Error | null = null;

        for (let attempt = 0; attempt < 10; attempt += 1) {
          const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt}`;

          try {
            const data = await api.request('/projects', {
              method: 'POST',
              body: JSON.stringify({
                name: trimmedName,
                slug,
                description: options.description,
              }),
            }) as { data: { project: Project } };

            newProject = data.data.project;
            break;
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to create project';
            if (!message.includes('slug')) {
              throw error;
            }
            lastError = error instanceof Error ? error : new Error(message);
          }
        }

        if (!newProject) {
          throw lastError || new Error('Failed to create project');
        }

        // Set as active if requested or if it's the first project
        if (options.default || !options.name) {
          const config = await loadConfig();
          config.activeProjectId = newProject.id;
          await saveConfig(config);
          
          // Also update project config if exists
          const projectConfig = await loadProjectConfig();
          if (projectConfig) {
            projectConfig.projectId = newProject.id;
            await saveProjectConfig(projectConfig);
          }
        }

        spinner.succeed(chalk.green(`✓ Created project "${newProject.name}"`));
        console.log(chalk.dim(`\nProject ID: ${newProject.id}`));
        console.log(chalk.dim(`Role: ${newProject.role}`));
        
        if (!options.default) {
          console.log(chalk.dim(`\nSet as active: oricms project switch ${newProject.id}`));
        }
        console.log();
      } catch (error) {
        spinner.fail(error instanceof Error ? error.message : 'Failed to create project');
        process.exit(1);
      }
    });

  // Switch project
  project
    .command('switch')
    .description('Switch active project')
    .argument('<project-id>', 'Project ID or name')
    .action(async (projectId) => {
      const spinner = ora('Switching project...').start();

      try {
        const api = await getApiClient();
        
        // Get all projects to find by name or id
        const data = await api.request('/projects') as { data: { projects: Project[] } };
        const projects: Project[] = data.data.projects;
        
        // Find project by ID or name (case-insensitive partial match)
        const projectMatch = projects.find(p => 
          p.id === projectId || 
          p.name.toLowerCase() === projectId.toLowerCase() ||
          p.name.toLowerCase().includes(projectId.toLowerCase())
        );

        if (!projectMatch) {
          throw new Error(`Project not found: ${projectId}`);
        }

        // Update global config
        const config = await loadConfig();
        config.activeProjectId = projectMatch.id;
        await saveConfig(config);

        // Update project config
        const projectConfig = await loadProjectConfig() || {};
        projectConfig.projectId = projectMatch.id;
        await saveProjectConfig(projectConfig);

        spinner.succeed(chalk.green(`✓ Switched to "${projectMatch.name}"`));
        console.log(chalk.dim(`  Project ID: ${projectMatch.id}`));
        console.log(chalk.dim(`  Role: ${projectMatch.role}\n`));
      } catch (error) {
        spinner.fail(error instanceof Error ? error.message : 'Failed to switch project');
        process.exit(1);
      }
    });

  // Show current project
  project
    .command('current')
    .description('Show current active project')
    .action(async () => {
      try {
        const config = await loadConfig();
        const projectConfig = await loadProjectConfig();
        
        if (!config.activeProjectId && !projectConfig?.projectId) {
          console.log(chalk.yellow('\nNo active project set.\n'));
          console.log(chalk.dim('Set active project with:'));
          console.log(chalk.dim('  oricms project switch <project-id>\n'));
          return;
        }

        const projectId = config.activeProjectId || projectConfig?.projectId;

        // Get project details
        const api = await getApiClient();
        
        try {
          const data = await api.request(`/projects/${projectId}`) as { data: { project: Project } };
          const projectData: Project = data.data.project;

          console.log(chalk.bold('\nActive Project:\n'));
          console.log(`  Name:  ${projectData.name}`);
          console.log(`  ID:    ${projectData.id}`);
          console.log(`  Role:  ${projectData.role}`);
          if (projectData.description) {
            console.log(`  Desc:  ${projectData.description}`);
          }
          console.log();
        } catch {
          console.log(chalk.yellow(`\nActive project ID: ${projectId}`));
          console.log(chalk.dim('(Project details unavailable - may have been deleted)\n'));
        }
      } catch (error) {
        console.error(error instanceof Error ? error.message : 'Failed to get current project');
        process.exit(1);
      }
    });
}
