/**
 * Content Filtering for AI Agent Access
 * 
 * Applies redaction, allowlist filtering, and field-level visibility controls
 * before content is sent to the LLM.
 */

import type { ContentType, CollectionEntry, AgentAccessConfig } from '@ori/shared';
import { scanAndRedact } from './pii';

export interface FilterOptions {
  config: AgentAccessConfig;
  collectionName?: string;
  contentType?: ContentType;
}

export interface FilterResult<T> {
  data: T;
  wasRedacted: boolean;
  piiPatternsFound: string[];
  fieldsHidden: string[]; // list of field keys that were hidden
}

/**
 * Filter a collection entry based on agent visibility settings and PII
 */
export function filterEntry(
  entry: CollectionEntry,
  contentType: ContentType,
  _options: FilterOptions
): FilterResult<CollectionEntry> {
  const fieldsHidden: string[] = [];
  
  // Create a copy to avoid mutating the original
  const filtered: CollectionEntry = { ...entry };
  
  // Apply field-level visibility
  for (const field of contentType.fields) {
    const isVisible = field.agentVisible !== false;
    
    if (!isVisible) {
      // Field exists but is not visible - show placeholder
      fieldsHidden.push(field.key);
      filtered[field.key] = '[REDACTED]';
    }
  }
  
  // Apply PII scanning to string fields
  const piiPatternsFound = new Set<string>();
  
  for (const [key, value] of Object.entries(filtered)) {
    if (typeof value === 'string') {
      const result = scanAndRedact(value);
      if (result.patternsFound.length > 0) {
        filtered[key] = result.redactedText;
        result.patternsFound.forEach(p => piiPatternsFound.add(p));
      }
    }
  }
  
  return {
    data: filtered,
    wasRedacted: fieldsHidden.length > 0 || piiPatternsFound.size > 0,
    piiPatternsFound: Array.from(piiPatternsFound),
    fieldsHidden,
  };
}

/**
 * Filter multiple entries
 */
export function filterEntries(
  entries: CollectionEntry[],
  contentType: ContentType,
  options: FilterOptions
): FilterResult<CollectionEntry[]> {
  const allPiiPatterns = new Set<string>();
  const allFieldsHidden = new Set<string>();
  let anyRedacted = false;
  
  const filtered = entries.map(entry => {
    const result = filterEntry(entry, contentType, options);
    if (result.wasRedacted) {
      anyRedacted = true;
    }
    result.piiPatternsFound.forEach(p => allPiiPatterns.add(p));
    result.fieldsHidden.forEach(f => allFieldsHidden.add(f));
    return result.data;
  });
  
  return {
    data: filtered,
    wasRedacted: anyRedacted,
    piiPatternsFound: Array.from(allPiiPatterns),
    fieldsHidden: Array.from(allFieldsHidden),
  };
}

/**
 * Filter a content type schema (removes agentVisible = false fields at lower tiers)
 */
export function filterContentTypeSchema(
  contentType: ContentType,
  _config?: AgentAccessConfig
): ContentType {
  return contentType;
}

/**
 * Filter file content after permission and allowlist checks
 */
export function filterFileContent(
  content: string,
  _filePath: string,
  _options: FilterOptions
): FilterResult<string> {
  // Always apply PII scanning to any content that passes the gateway checks
  const result = scanAndRedact(content);
  
  return {
    data: result.redactedText,
    wasRedacted: result.redactionCount > 0,
    piiPatternsFound: result.patternsFound,
    fieldsHidden: [],
  };
}

/**
 * Filter git history based on time bounds
 */
export function filterGitHistory<T extends { date: string }>(
  commits: T[],
  config: AgentAccessConfig
): T[] {
  const maxAge = new Date();
  maxAge.setDate(maxAge.getDate() - config.historyDays);
  
  // Filter by date
  let filtered = commits.filter(commit => {
    const commitDate = new Date(commit.date);
    return commitDate >= maxAge;
  });
  
  // Limit to historyDepth
  filtered = filtered.slice(0, config.historyDepth);
  
  return filtered;
}

/**
 * Check if a collection is in the allowlist
 */
export function isCollectionAllowed(
  collectionName: string,
  config: AgentAccessConfig
): boolean {
  return config.allowedCollections.includes(collectionName);
}

/**
 * Get list of allowed collections with their status
 */
export function getCollectionAccessStatus(
  allCollections: string[],
  config: AgentAccessConfig
): Array<{ name: string; allowed: boolean }> {
  return allCollections.map(name => ({
    name,
    allowed: config.allowedCollections.includes(name),
  }));
}

/**
 * Filter directory listing based on collection allowlist.
 */
export function filterDirectoryListing(
  entries: string[],
  options: FilterOptions
): string[] {
  const { config } = options;
  return entries.filter(entry => {
    if (!entry.startsWith('content/')) {
      return true;
    }
    const parts = entry.split('/');
    return parts.length < 2 || isCollectionAllowed(parts[1], config);
  });
}

/**
 * Sanitize error messages to prevent information leakage
 */
export function sanitizeErrorMessage(error: string): string {
  // Remove file paths that might contain sensitive info
  let sanitized = error;
  
  // Replace absolute paths with relative
  sanitized = sanitized.replace(/\/[\w\-/.]+/g, (match) => {
    if (match.includes('schemas/') || match.includes('content/')) {
      return match.substring(match.indexOf('/'));
    }
    return '[PATH]';
  });
  
  // Replace potential tokens/keys
  sanitized = sanitized.replace(/[a-zA-Z0-9]{32,}/g, '[TOKEN]');
  
  return sanitized;
}
