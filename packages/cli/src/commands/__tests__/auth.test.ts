import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Command } from 'commander';
import { authCommand } from '../auth.js';

vi.mock('../lib/config.js', () => ({
  loadConfig: vi.fn(),
  saveConfig: vi.fn(),
  clearConfig: vi.fn(),
}));

describe('authCommand', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    authCommand(program);
  });

  it('registers login command', () => {
    const loginCmd = program.commands.find((c) => c.name() === 'login');
    expect(loginCmd).toBeDefined();
    expect(loginCmd?.description()).toBe('Authenticate with OriCMS instance');
  });

  it('registers logout command', () => {
    const logoutCmd = program.commands.find((c) => c.name() === 'logout');
    expect(logoutCmd).toBeDefined();
    expect(logoutCmd?.description()).toBe('Logout from OriCMS');
  });
});
