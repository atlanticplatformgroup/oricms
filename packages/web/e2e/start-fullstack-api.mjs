import { spawn, spawnSync } from 'node:child_process';

const databaseUrl = process.env.FULLSTACK_DATABASE_URL
  || 'postgresql://postgres:postgres@localhost:5432/oricms_onboarding_e2e';
const apiCwd = new URL('../../api/', import.meta.url);

function withDatabaseName(rawUrl, databaseName) {
  const url = new URL(rawUrl);
  url.pathname = `/${databaseName}`;
  url.search = '';
  return url.toString();
}

function quoteIdentifier(value) {
  return `"${value.replace(/"/g, '""')}"`;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? apiCwd,
    env: options.env ?? process.env,
    input: options.input,
    stdio: options.capture ? ['pipe', 'pipe', 'pipe'] : ['pipe', 'inherit', 'inherit'],
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    if (options.capture) {
      process.stdout.write(result.stdout ?? '');
      process.stderr.write(result.stderr ?? '');
    }
    throw new Error(`${command} ${args.join(' ')} failed`);
  }
}

function executeSql(url, sql) {
  run('npx', ['prisma', 'db', 'execute', '--stdin', '--url', url], { input: sql, capture: true });
}

const target = new URL(databaseUrl);
const databaseName = target.pathname.replace(/^\//, '');
const adminUrl = withDatabaseName(databaseUrl, 'postgres');
const env = {
  ...process.env,
  DATABASE_URL: databaseUrl,
  JWT_SECRET: process.env.JWT_SECRET || 'fullstack-e2e-jwt-secret-change-me',
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  NODE_ENV: 'test',
  RATE_LIMIT_STORE: 'memory',
};

executeSql(adminUrl, `DROP DATABASE IF EXISTS ${quoteIdentifier(databaseName)} WITH (FORCE);`);
executeSql(adminUrl, `CREATE DATABASE ${quoteIdentifier(databaseName)};`);
run('npx', ['prisma', 'migrate', 'deploy', '--schema', 'prisma/schema.prisma'], { cwd: apiCwd, env });

const child = spawn('npm', ['run', 'dev'], {
  cwd: apiCwd,
  env,
  stdio: 'inherit',
});

process.on('SIGTERM', () => child.kill('SIGTERM'));
process.on('SIGINT', () => child.kill('SIGINT'));
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
