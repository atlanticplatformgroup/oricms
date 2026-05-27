import { Prisma } from '@prisma/client';
import { getPrismaErrorResponse } from '../../lib/prisma';
import { conflict, notFound, badRequest } from '../../lib/responses';
import type { Response } from 'express';

export function handlePrismaError(res: Response, error: unknown): boolean {
  const prismaError = getPrismaErrorResponse(error);
  if (!prismaError) return false;

  switch (prismaError.statusCode) {
    case 409:
      conflict(res, prismaError.message, prismaError.code);
      return true;
    case 404:
      notFound(res, prismaError.message, prismaError.code);
      return true;
    case 400:
      badRequest(res, prismaError.message, prismaError.code);
      return true;
    default:
      return false;
  }
}

export function isPrismaNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
}

export function isPrismaUniqueConstraint(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
