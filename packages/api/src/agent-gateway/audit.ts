/**
 * Agent Audit Logging
 * 
 * Every file read by the agent is logged for compliance and transparency.
 * Clients can answer: "What did the support agent see on March 3rd?"
 */

import { prisma } from '../lib/prisma';
import type { AgentAuditEntry, ProjectRole } from '@ori/shared';
import { logger } from '../middleware/logger';

export interface AuditLogOptions {
  projectId: string;
  agentSessionId: string;
  projectRole: ProjectRole;
}

function normalizeProjectRole(role: string | null): ProjectRole | null {
  switch (role) {
    case 'owner':
    case 'admin':
    case 'editor':
    case 'viewer':
      return role;
    default:
      return null;
  }
}

/**
 * Log a file access event
 */
export async function logFileAccess(
  options: AuditLogOptions,
  details: {
    filePath: string;
    branch: string;
    contentRead: boolean;
    wasRedacted: boolean;
    piiPatternsFound: string[];
    queryType?: string;
    diagnosisId?: string;
  }
): Promise<void> {
  const { projectId, agentSessionId, projectRole } = options;
  const {
    filePath,
    branch,
    contentRead,
    wasRedacted,
    piiPatternsFound,
    queryType,
    diagnosisId,
  } = details;
  
  try {
    await prisma.agentAuditLog.create({
      data: {
        projectId,
        agentSessionId,
        projectRole,
        filePath,
        branch,
        contentRead,
        wasRedacted,
        piiPatternsFound,
        queryType,
        diagnosisId,
      },
    });
  } catch (error) {
    logger.error({ msg: 'Failed to write agent audit log', error, projectId, agentSessionId, filePath, branch });
  }
}

/**
 * Get audit logs for a project
 */
export async function getAuditLogs(
  projectId: string,
  options: {
    startDate?: Date;
    endDate?: Date;
    agentSessionId?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<AgentAuditEntry[]> {
  const {
    startDate,
    endDate,
    agentSessionId,
    limit = 100,
    offset = 0,
  } = options;
  
  const logs = await prisma.agentAuditLog.findMany({
    where: {
      projectId,
      ...(startDate && { timestamp: { gte: startDate } }),
      ...(endDate && { timestamp: { lte: endDate } }),
      ...(agentSessionId && { agentSessionId }),
    },
    orderBy: { timestamp: 'desc' },
    take: limit,
    skip: offset,
  });
  
  return logs.map(log => ({
    id: log.id,
    timestamp: log.timestamp.toISOString(),
    agentSessionId: log.agentSessionId,
    projectId: log.projectId,
    filePath: log.filePath,
    branch: log.branch,
    projectRole: normalizeProjectRole(log.projectRole),
    contentRead: log.contentRead,
    wasRedacted: log.wasRedacted,
    piiPatternsFound: log.piiPatternsFound,
    queryType: log.queryType || undefined,
    diagnosisId: log.diagnosisId || undefined,
  }));
}

/**
 * Get summary statistics for audit logs
 */
export async function getAuditSummary(
  projectId: string,
  options: {
    startDate?: Date;
    endDate?: Date;
  } = {}
): Promise<{
  totalAccesses: number;
  uniqueFiles: number;
  uniqueSessions: number;
  redactedAccesses: number;
  piiPatternsFound: Record<string, number>;
}> {
  const { startDate, endDate } = options;
  
  const where = {
    projectId,
    ...(startDate && { timestamp: { gte: startDate } }),
    ...(endDate && { timestamp: { lte: endDate } }),
  };
  
  const [
    totalAccesses,
    uniqueFiles,
    uniqueSessions,
    redactedAccesses,
    allLogs,
  ] = await Promise.all([
    prisma.agentAuditLog.count({ where }),
    (async () => (await prisma.agentAuditLog.groupBy({
      by: ['filePath'],
      where,
      _count: { filePath: true },
    })).length)(),
    (async () => (await prisma.agentAuditLog.groupBy({
      by: ['agentSessionId'],
      where,
      _count: { agentSessionId: true },
    })).length)(),
    prisma.agentAuditLog.count({
      where: { ...where, wasRedacted: true },
    }),
    prisma.agentAuditLog.findMany({
      where,
      select: { piiPatternsFound: true },
    }),
  ]);
  
  // Count PII patterns
  const piiPatternsFound: Record<string, number> = {};
  for (const log of allLogs) {
    for (const pattern of log.piiPatternsFound) {
      piiPatternsFound[pattern] = (piiPatternsFound[pattern] || 0) + 1;
    }
  }
  
  return {
    totalAccesses,
    uniqueFiles,
    uniqueSessions,
    redactedAccesses,
    piiPatternsFound,
  };
}

/**
 * Create a new agent session ID
 */
export function createAgentSessionId(): string {
  return `agent-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Get files accessed in a specific session
 */
export async function getSessionFiles(
  projectId: string,
  agentSessionId: string
): Promise<Array<{
  filePath: string;
  timestamp: string;
  wasRedacted: boolean;
}>> {
  const logs = await prisma.agentAuditLog.findMany({
    where: { projectId, agentSessionId },
    orderBy: { timestamp: 'asc' },
    select: {
      filePath: true,
      timestamp: true,
      wasRedacted: true,
    },
  });
  
  return logs.map(log => ({
    filePath: log.filePath,
    timestamp: log.timestamp.toISOString(),
    wasRedacted: log.wasRedacted,
  }));
}

/**
 * Export audit logs for compliance reporting
 */
export async function exportAuditLogs(
  projectId: string,
  options: {
    startDate: Date;
    endDate: Date;
    format: 'json' | 'csv';
  }
): Promise<string> {
  const { startDate, endDate, format } = options;
  
  const logs = await prisma.agentAuditLog.findMany({
    where: {
      projectId,
      timestamp: { gte: startDate, lte: endDate },
    },
    orderBy: { timestamp: 'asc' },
  });
  
  if (format === 'csv') {
    // CSV format
    const headers = [
      'timestamp',
      'agentSessionId',
      'filePath',
      'branch',
      'projectRole',
      'contentRead',
      'wasRedacted',
      'piiPatternsFound',
      'queryType',
    ];
    
    const rows = logs.map(log => [
      log.timestamp.toISOString(),
      log.agentSessionId,
      log.filePath,
      log.branch,
      log.projectRole || '',
      log.contentRead,
      log.wasRedacted,
      log.piiPatternsFound.join(';'),
      log.queryType || '',
    ]);
    
    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }
  
  // JSON format
  return JSON.stringify(logs, null, 2);
}

/**
 * Clean up old audit logs (GDPR compliance)
 */
export async function cleanupOldAuditLogs(
  retentionDays: number = 90
): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  
  const result = await prisma.agentAuditLog.deleteMany({
    where: {
      timestamp: { lt: cutoffDate },
    },
  });
  
  return result.count;
}
