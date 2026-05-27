import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Command } from 'commander';
import { projectCommand } from '../project.js';

describe('projectCommand', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    projectCommand(program);
  });

  it('registers project command', () => {
    const projectCmd = program.commands.find((c) => c.name() === 'project');
    expect(projectCmd).toBeDefined();
    expect(projectCmd?.description()).toBe('Manage OriCMS projects');
  });

  it('registers project list subcommand', () => {
    const projectCmd = program.commands.find((c) => c.name() === 'project');
    const listCmd = projectCmd?.commands.find((c) => c.name() === 'list');
    expect(listCmd).toBeDefined();
    expect(listCmd?.description()).toBe('List your projects');
  });

  it('registers project create subcommand', () => {
    const projectCmd = program.commands.find((c) => c.name() === 'project');
    const createCmd = projectCmd?.commands.find((c) => c.name() === 'create');
    expect(createCmd).toBeDefined();
    expect(createCmd?.description()).toBe('Create a new project');
  });
});
