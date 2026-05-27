import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Command } from 'commander';
import { cdnCommand } from '../cdn.js';

describe('cdnCommand', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    cdnCommand(program);
  });

  it('registers cdn command', () => {
    const cdnCmd = program.commands.find((c) => c.name() === 'cdn');
    expect(cdnCmd).toBeDefined();
    expect(cdnCmd?.description()).toBe('CDN export and management');
  });

  it('registers cdn export subcommand', () => {
    const cdnCmd = program.commands.find((c) => c.name() === 'cdn');
    const exportCmd = cdnCmd?.commands.find((c) => c.name() === 'export');
    expect(exportCmd).toBeDefined();
    expect(exportCmd?.description()).toBe('Export build output to CDN');
  });
});
