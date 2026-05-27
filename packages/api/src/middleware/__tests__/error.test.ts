import 'express-async-errors';
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { errorHandler } from '../error';

describe('Error Handler Middleware', () => {
  function createTestApp() {
    const app = express();
    app.use(express.json());

    app.get('/sync-error', () => {
      throw new Error('Synchronous error');
    });

    app.get('/async-error', async () => {
      throw new Error('Async error');
    });

    app.get('/custom-error', () => {
      const error = Object.assign(new Error('Custom business error'), {
        statusCode: 422,
        code: 'VALIDATION_FAILED',
        details: { field: ['is required'] },
      });
      throw error;
    });

    app.get('/custom-status', () => {
      const error = new Error('Not found') as Error & { statusCode: number; code: string };
      error.statusCode = 404;
      error.code = 'RESOURCE_NOT_FOUND';
      throw error;
    });

    app.use(errorHandler);
    return app;
  }

  it('should return 500 for unhandled sync errors', async () => {
    const app = createTestApp();
    const response = await request(app).get('/sync-error');

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('INTERNAL_ERROR');
    expect(response.body.error.message).toBe('Synchronous error');
  });

  it('should return 500 for unhandled async errors', async () => {
    const app = createTestApp();
    const response = await request(app).get('/async-error');

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('INTERNAL_ERROR');
    expect(response.body.error.message).toBe('Async error');
  });

  it('should respect custom status codes', async () => {
    const app = createTestApp();
    const response = await request(app).get('/custom-status');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('should serialize custom error codes and details', async () => {
    const app = createTestApp();
    const response = await request(app).get('/custom-error');

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_FAILED');
    expect(response.body.error.message).toBe('Custom business error');
    expect(response.body.error.details).toEqual({ field: ['is required'] });
  });

  it('should use default message when error has no message', async () => {
    const app = express();
    app.use(express.json());
    app.get('/empty-error', () => {
      throw Object.assign(new Error(''), { statusCode: 400, code: 'BAD_REQUEST' });
    });
    app.use(errorHandler);

    const response = await request(app).get('/empty-error');

    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe('An unexpected error occurred');
  });
});
