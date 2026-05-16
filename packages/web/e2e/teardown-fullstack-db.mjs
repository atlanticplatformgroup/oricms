import { spawnSync } from 'node:child_process';

const databaseUrl = process.env.FULLSTACK_DATABASE_URL
  || 'postgresql://postgres:postgres@localhost:5432/oricms_onboarding_e2e';

function withDatabaseName(rawUrl, databaseName) {
  const url = new URL(rawUrl);
  url.pathname = `/${databaseName}`;
  url.search = '';
  return url.toString();
}

function quoteIdentifier(value) {
  return `"${value.replace(/"/g, '""')}"`;
}

export default async function globalTeardown() {
  const target = new URL(databaseUrl);
  const databaseName = target.pathname.replace(/^\//, '');
  const adminUrl = withDatabaseName(databaseUrl, 'postgres');

  spawnSync(
    'npx',
    ['prisma', 'db', 'execute', '--stdin', '--url', adminUrl],
    {
      input: `DROP DATABASE IF EXISTS ${quoteIdentifier(databaseName)} WITH (FORCE);`,
      stdio: ['pipe', 'ignore', 'ignore'],
      encoding: 'utf8',
    },
  );
}
