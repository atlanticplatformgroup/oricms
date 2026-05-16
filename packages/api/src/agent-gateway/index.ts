/**
 * Agent Gateway Module
 * 
 * AI Agent Support with Enterprise Security
 * - Role-backed service account access
 * - PII scanning and redaction
 * - Audit logging
 * - Content filtering
 */

// Export types
export * from './pii';
export * from './filter';
export * from './audit';
export * from './service';
export * from './roles';

// Export routes
export { default as agentGatewayRoutes } from './routes';
