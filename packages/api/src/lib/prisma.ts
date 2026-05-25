/**
 * Shared Prisma client instance
 * Extracted into its own module to avoid circular dependency issues
 * when route files import prisma from index.ts.
 */

import { PrismaClient, Prisma } from '@prisma/client';

export const prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['error'],
});

export function getPrismaErrorResponse(error: unknown): { statusCode: number; code: string; message: string } | null {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return null;
  }

  switch (error.code) {
    case 'P2002':
      return {
        statusCode: 409,
        code: 'UNIQUE_CONSTRAINT_VIOLATION',
        message: `Unique constraint failed on ${String(error.meta?.target ?? 'field')}`,
      };
    case 'P2025':
      return {
        statusCode: 404,
        code: 'RECORD_NOT_FOUND',
        message: 'Record not found',
      };
    case 'P2003':
      return {
        statusCode: 400,
        code: 'FOREIGN_KEY_CONSTRAINT_VIOLATION',
        message: `Foreign key constraint failed on ${String(error.meta?.field_name ?? 'field')}`,
      };
    case 'P2014':
      return {
        statusCode: 400,
        code: 'RELATION_VIOLATION',
        message: 'Relation violation',
      };
    default:
      return null;
  }
}
