import { execFileSync } from 'node:child_process';
import path from 'node:path';

/**
 * Global Setup - Runs before all test files are loaded
 * This ensures DATABASE_URL is set before any modules are imported
 */

export default function setup() {
    // Set test database URL before any imports happen
    const testDatabaseUrl = process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/oricms_test';
    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.JWT_SECRET = 'test-secret-key';
    process.env.ENCRYPTION_KEY = 'TEST_ENCRYPTION_KEY_fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';
    process.env.NODE_ENV = 'test';

    execFileSync(
      'npx',
      ['prisma', 'migrate', 'reset', '--force', '--skip-generate', '--skip-seed', '--schema', path.join(process.cwd(), 'prisma/schema.prisma')],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          DATABASE_URL: testDatabaseUrl,
        },
        stdio: 'inherit',
      },
    );

    console.log('Global setup: DATABASE_URL set to', process.env.DATABASE_URL);
}
