import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Command } from 'commander';
import { deployCommand } from '../deploy.js';

describe('deployCommand', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    deployCommand(program);
  });

  it('registers deploy command', () => {
    const deployCmd = program.commands.find((c) => c.name() === 'deploy');
    expect(deployCmd).toBeDefined();
    expect(deployCmd?.description()).toBe('Deploy project to configured CDN');
  });
});
