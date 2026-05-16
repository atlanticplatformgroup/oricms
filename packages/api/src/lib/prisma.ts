/**
 * Shared Prisma client instance
 * Extracted into its own module to avoid circular dependency issues
 * when route files import prisma from index.ts.
 */

import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['error'],
});
