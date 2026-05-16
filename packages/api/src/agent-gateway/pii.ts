/**
 * PII (Personally Identifiable Information) Scanner
 * 
 * Detects and redacts sensitive patterns before content reaches the LLM context.
 * Some patterns are configurable, others are hardcoded (always redacted).
 */

import type { PiiPattern, PiiRedactionConfig } from '@ori/shared';

// Regex patterns for PII detection
const PII_PATTERNS: Record<PiiPattern, RegExp> = {
  // Email addresses
  EMAIL: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  
  // Phone numbers (US/international formats)
  PHONE: /\b(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g,
  
  // Social Security Numbers (US)
  SSN: /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g,
  
  // Credit card numbers (major brands)
  CREDIT_CARD: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12}|(?:2131|1800|35\d{3})\d{11})\b/g,
  
  // IP addresses (IPv4 and IPv6)
  IP_ADDRESS: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b|\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/g,
  
  // Street addresses (simplified - matches common patterns)
  ADDRESS: /\d+\s+[A-Za-z]+\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Way|Court|Ct|Circle|Cir|Trail|Trl|Parkway|Pkwy|Highway|Hwy)\b/gi,
};

// Human-readable labels for each pattern
const PII_LABELS: Record<PiiPattern, string> = {
  EMAIL: '[EMAIL]',
  PHONE: '[PHONE]',
  SSN: '[SSN]',
  CREDIT_CARD: '[CREDIT_CARD]',
  IP_ADDRESS: '[IP_ADDRESS]',
  ADDRESS: '[ADDRESS]',
};

export interface PiiScanResult {
  originalText: string;
  redactedText: string;
  patternsFound: PiiPattern[];
  redactionCount: number;
}

/**
 * Scan text for PII patterns and redact them
 */
export function scanAndRedact(
  text: string,
  config?: Partial<PiiRedactionConfig>
): PiiScanResult {
  // Merge with defaults
  const effectiveConfig: PiiRedactionConfig = {
    enabled: true,
    patterns: {
      EMAIL: { enabled: true, required: false },
      PHONE: { enabled: true, required: false },
      IP_ADDRESS: { enabled: true, required: false },
      ADDRESS: { enabled: true, required: false },
      SSN: { enabled: true, required: true },
      CREDIT_CARD: { enabled: true, required: true },
    },
    ...config,
  };
  
  if (!effectiveConfig.enabled) {
    return {
      originalText: text,
      redactedText: text,
      patternsFound: [],
      redactionCount: 0,
    };
  }
  
  const patternsFound: Set<PiiPattern> = new Set();
  let redactedText = text;
  let redactionCount = 0;
  
  // Check each pattern
  for (const [patternName, regex] of Object.entries(PII_PATTERNS)) {
    const piiPattern = patternName as PiiPattern;
    const patternConfig = effectiveConfig.patterns[piiPattern];
    
    // Skip if pattern is disabled (and not required)
    if (!patternConfig?.enabled && !patternConfig?.required) {
      continue;
    }
    
    // Find all matches
    const matches = text.match(regex);
    if (matches && matches.length > 0) {
      patternsFound.add(piiPattern);
      redactionCount += matches.length;
      
      // Replace with redaction label
      redactedText = redactedText.replace(regex, PII_LABELS[piiPattern]);
    }
  }
  
  return {
    originalText: text,
    redactedText,
    patternsFound: Array.from(patternsFound),
    redactionCount,
  };
}

/**
 * Scan an object recursively for PII patterns
 */
export function scanObject(
  obj: unknown,
  config?: Partial<PiiRedactionConfig>,
  path = ''
): { value: unknown; patternsFound: PiiPattern[] } {
  const allPatterns: Set<PiiPattern> = new Set();
  
  if (obj === null || obj === undefined) {
    return { value: obj, patternsFound: [] };
  }
  
  if (typeof obj === 'string') {
    const result = scanAndRedact(obj, config);
    return {
      value: result.redactedText,
      patternsFound: result.patternsFound,
    };
  }
  
  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return { value: obj, patternsFound: [] };
  }
  
  if (Array.isArray(obj)) {
    const newArray: unknown[] = [];
    for (let i = 0; i < obj.length; i++) {
      const result = scanObject(obj[i], config, `${path}[${i}]`);
      newArray.push(result.value);
      result.patternsFound.forEach(p => allPatterns.add(p));
    }
    return { value: newArray, patternsFound: Array.from(allPatterns) };
  }
  
  if (typeof obj === 'object') {
    const newObj: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const result = scanObject(value, config, path ? `${path}.${key}` : key);
      newObj[key] = result.value;
      result.patternsFound.forEach(p => allPatterns.add(p));
    }
    return { value: newObj, patternsFound: Array.from(allPatterns) };
  }
  
  return { value: obj, patternsFound: [] };
}

/**
 * Quick check if text might contain PII (for logging/pre-scanning)
 */
export function mightContainPii(text: string): boolean {
  for (const regex of Object.values(PII_PATTERNS)) {
    if (regex.test(text)) {
      return true;
    }
  }
  return false;
}

/**
 * Get list of patterns that are always redacted (cannot be disabled)
 */
export function getRequiredPatterns(): PiiPattern[] {
  return ['SSN', 'CREDIT_CARD'];
}

/**
 * Get list of patterns that are configurable
 */
export function getConfigurablePatterns(): PiiPattern[] {
  return ['EMAIL', 'PHONE', 'IP_ADDRESS', 'ADDRESS'];
}

/**
 * Validate a custom PII config
 */
export function validatePiiConfig(config: Partial<PiiRedactionConfig>): string[] {
  const errors: string[] = [];
  
  // Check that required patterns are not disabled
  const requiredPatterns = getRequiredPatterns();
  for (const pattern of requiredPatterns) {
    if (config.patterns?.[pattern]?.enabled === false) {
      errors.push(`Pattern "${pattern}" is required and cannot be disabled`);
    }
  }
  
  return errors;
}
