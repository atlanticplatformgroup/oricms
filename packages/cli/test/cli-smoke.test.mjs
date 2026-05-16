import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';

const cliPath = path.resolve(process.cwd(), 'dist/index.js');

function runCli(args, options = {}) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    encoding: 'utf8',
    ...options,
  });
}

test('prints CLI help', () => {
  const output = execFileSync(process.execPath, [cliPath, '--help'], { encoding: 'utf8' });

  assert.match(output, /OriCMS CLI/);
  assert.match(output, /Usage:/);
  assert.match(output, /Commands:/);
});

test('prints version', () => {
  const output = execFileSync(process.execPath, [cliPath, '--version'], { encoding: 'utf8' }).trim();

  assert.match(output, /^\d+\.\d+\.\d+$/);
});

test('project command help exposes subcommands', () => {
  const output = execFileSync(process.execPath, [cliPath, 'project', '--help'], { encoding: 'utf8' });

  assert.match(output, /list/);
  assert.match(output, /create/);
  assert.match(output, /switch/);
});

test('export requires a source or repo input', () => {
  const result = runCli(['export', 'astro']);

  assert.equal(result.status, 1);
  assert.match(result.stderr + result.stdout, /--source or --repo is required/);
});
