import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Command } from 'commander';
import { startCommand } from '../start';

describe('startCommand', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    startCommand(program);
  });

  it('registers start command', () => {
    const startCmd = program.commands.find((c) => c.name() === 'start');
    expect(startCmd).toBeDefined();
    expect(startCmd?.description()).toBe('Start OriCMS services (PostgreSQL, API, Web) with Docker Compose');
  });
});
