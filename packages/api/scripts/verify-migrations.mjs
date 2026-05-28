import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// Load .env manually since Prisma auto-loads it but this script doesn't.
// We need DATABASE_URL and POSTGRES_ADMIN_URL to be available.
const envPath = '.env';
try {
  const content = readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const match = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2];
    }
  }
} catch {
  // .env doesn't exist — rely on existing env vars
}

const schemaPath = 'prisma/schema.prisma';
const migrationsPath = 'prisma/migrations';

// Prefer explicit admin URL for superuser operations (create/drop temp databases).
// Falls back to deriving from DATABASE_URL, then a hardcoded default.
const baseUrl = process.env.POSTGRES_ADMIN_URL
  || process.env.MIGRATION_DATABASE_URL
  || process.env.TEST_DATABASE_URL
  || (() => {
    // Derive admin URL from DATABASE_URL if available
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl) {
      const url = new URL(dbUrl);
      // Use the same host/port but connect to the 'postgres' database
      // with the same credentials for admin operations
      url.pathname = '/postgres';
      return url.toString();
    }
    return 'postgresql://postgres:***@localhost:5432/postgres';
  })();

const tempDatabaseName = `oricms_migration_check_${process.pid}_${Date.now()}`;

function quoteIdentifier(value) {
  return `"${value.replace(/"/g, '""')}"`;
}

function withDatabaseName(rawUrl, databaseName) {
  const url = new URL(rawUrl);
  url.pathname = `/${databaseName}`;
  url.search = '';
  return url.toString();
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? process.cwd(),
    env: options.env ?? process.env,
    input: options.input,
    encoding: 'utf8',
    stdio: options.capture ? ['pipe', 'pipe', 'pipe'] : ['pipe', 'inherit', 'inherit'],
  });

  if (result.status !== 0) {
    if (options.capture) {
      process.stdout.write(result.stdout ?? '');
      process.stderr.write(result.stderr ?? '');
    }
    throw new Error(`${command} ${args.join(' ')} failed`);
  }

  return result;
}

function executeSql(databaseUrl, sql) {
  run('npx', ['prisma', 'db', 'execute', '--stdin', '--url', databaseUrl], { input: sql, capture: true });
}

const adminUrl = withDatabaseName(baseUrl, 'postgres');
const tempUrl = withDatabaseName(baseUrl, tempDatabaseName);
const tempDatabase = quoteIdentifier(tempDatabaseName);

try {
  executeSql(adminUrl, `DROP DATABASE IF EXISTS ${tempDatabase} WITH (FORCE);`);
  executeSql(adminUrl, `CREATE DATABASE ${tempDatabase};`);

  run('npx', ['prisma', 'migrate', 'deploy', '--schema', schemaPath], {
    env: { ...process.env, DATABASE_URL: tempUrl },
  });

  const diff = run(
    'npx',
    [
      'prisma',
      'migrate',
      'diff',
      '--from-url',
      tempUrl,
      '--to-schema-datamodel',
      schemaPath,
      '--script',
    ],
    { env: { ...process.env, DATABASE_URL: tempUrl }, capture: true },
  );

  const output = `${diff.stdout ?? ''}${diff.stderr ?? ''}`.trim();
  if (!output.includes('This is an empty migration')) {
    process.stdout.write(output);
    process.stdout.write('\n');
    throw new Error('Migration history does not match prisma/schema.prisma');
  }

  console.log('Migration history matches prisma/schema.prisma.');
} finally {
  try {
    executeSql(adminUrl, `DROP DATABASE IF EXISTS ${tempDatabase} WITH (FORCE);`);
  } catch (error) {
    console.warn(`Warning: failed to drop temporary database ${tempDatabaseName}.`);
  }
}
