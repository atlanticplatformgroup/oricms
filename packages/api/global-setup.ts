export default function setup() {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:***@localhost:5432/oricms_test';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
  process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899';
  process.env.NODE_ENV = 'test';
}
