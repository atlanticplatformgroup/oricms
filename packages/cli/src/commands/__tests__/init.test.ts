import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Command } from 'commander';
import { initCommand } from '../init';

describe('initCommand', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    initCommand(program);
  });

  it('registers init command', () => {
    const initCmd = program.commands.find((c) => c.name() === 'init');
    expect(initCmd).toBeDefined();
    expect(initCmd?.description()).toBe('Initialize a new OriCMS project');
  });
});
