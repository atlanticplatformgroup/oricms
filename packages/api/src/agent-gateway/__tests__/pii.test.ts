/**
 * Tests for PII Scanner
 * 
 * The PII scanner is security-critical — these tests verify that
 * sensitive patterns are correctly detected and redacted before
 * content reaches any LLM context.
 */

import { describe, it, expect } from 'vitest';
import {
    scanAndRedact,
    scanObject,
    mightContainPii,
    getRequiredPatterns,
    getConfigurablePatterns,
    validatePiiConfig,
} from '../pii';

describe('scanAndRedact', () => {
    it('should redact email addresses', () => {
        const result = scanAndRedact('Contact john@example.com for info');
        expect(result.redactedText).toBe('Contact [EMAIL] for info');
        expect(result.patternsFound).toContain('EMAIL');
        expect(result.redactionCount).toBe(1);
    });

    it('should redact multiple emails', () => {
        const result = scanAndRedact('john@example.com and jane@test.org');
        expect(result.redactedText).toBe('[EMAIL] and [EMAIL]');
        expect(result.redactionCount).toBe(2);
    });

    it('should redact US phone numbers', () => {
        const result = scanAndRedact('Call (555) 123-4567');
        // The phone regex captures the digits portion; the leading ( isn't part of the match
        expect(result.patternsFound).toContain('PHONE');
        expect(result.redactedText).not.toContain('123-4567');
    });

    it('should redact phone numbers with different formats', () => {
        const tests = [
            '555-123-4567',
            '555.123.4567',
            '+1 555 123 4567',
            '(555)123-4567',
        ];
        for (const phone of tests) {
            const result = scanAndRedact(phone);
            expect(result.patternsFound).toContain('PHONE');
        }
    });

    it('should redact SSNs', () => {
        const result = scanAndRedact('SSN: 123-45-6789');
        expect(result.redactedText).toContain('[SSN]');
        expect(result.patternsFound).toContain('SSN');
    });

    it('should redact SSNs without dashes', () => {
        const result = scanAndRedact('SSN: 123 45 6789');
        expect(result.patternsFound).toContain('SSN');
    });

    it('should redact credit card numbers (Visa)', () => {
        const result = scanAndRedact('Card: 4111111111111111');
        expect(result.redactedText).toContain('[CREDIT_CARD]');
        expect(result.patternsFound).toContain('CREDIT_CARD');
    });

    it('should redact credit card numbers (Mastercard)', () => {
        const result = scanAndRedact('Card: 5500000000000004');
        expect(result.patternsFound).toContain('CREDIT_CARD');
    });

    it('should redact credit card numbers (Amex)', () => {
        const result = scanAndRedact('Card: 340000000000009');
        expect(result.patternsFound).toContain('CREDIT_CARD');
    });

    it('should redact IPv4 addresses', () => {
        const result = scanAndRedact('Server at 192.168.1.100');
        expect(result.redactedText).toBe('Server at [IP_ADDRESS]');
        expect(result.patternsFound).toContain('IP_ADDRESS');
    });

    it('should redact street addresses', () => {
        const result = scanAndRedact('Located at 123 Main Street');
        expect(result.redactedText).toContain('[ADDRESS]');
        expect(result.patternsFound).toContain('ADDRESS');
    });

    it('should handle text with no PII', () => {
        const result = scanAndRedact('This is a normal product description');
        expect(result.redactedText).toBe('This is a normal product description');
        expect(result.patternsFound).toHaveLength(0);
        expect(result.redactionCount).toBe(0);
    });

    it('should redact multiple PII types in one string', () => {
        const result = scanAndRedact(
            'John (john@test.com) at 123 Oak Drive, SSN 123-45-6789'
        );
        expect(result.patternsFound).toContain('EMAIL');
        expect(result.patternsFound).toContain('ADDRESS');
        expect(result.patternsFound).toContain('SSN');
        expect(result.redactedText).not.toContain('john@test.com');
        expect(result.redactedText).not.toContain('123-45-6789');
    });

    it('should preserve original text in result', () => {
        const original = 'john@example.com';
        const result = scanAndRedact(original);
        expect(result.originalText).toBe(original);
    });

    it('should not redact when disabled', () => {
        const result = scanAndRedact('john@example.com', { enabled: false });
        expect(result.redactedText).toBe('john@example.com');
        expect(result.patternsFound).toHaveLength(0);
    });
});

describe('scanObject', () => {
    it('should scan string values recursively', () => {
        const obj = {
            name: 'John',
            email: 'john@example.com',
            nested: {
                phone: '555-123-4567',
            },
        };
        const result = scanObject(obj);
        const scanned = result.value as Record<string, unknown>;
        expect(scanned.email).toBe('[EMAIL]');
        expect((scanned.nested as Record<string, unknown>).phone).toBe('[PHONE]');
    });

    it('should scan arrays', () => {
        const obj = {
            contacts: ['john@test.com', 'jane@test.com'],
        };
        const result = scanObject(obj);
        const scanned = result.value as Record<string, unknown>;
        expect((scanned.contacts as string[])[0]).toBe('[EMAIL]');
        expect((scanned.contacts as string[])[1]).toBe('[EMAIL]');
    });

    it('should handle null and undefined', () => {
        expect(scanObject(null).value).toBeNull();
        expect(scanObject(undefined).value).toBeUndefined();
    });

    it('should pass through numbers and booleans', () => {
        expect(scanObject(42).value).toBe(42);
        expect(scanObject(true).value).toBe(true);
    });
});

describe('mightContainPii', () => {
    it('should return true for text with email', () => {
        expect(mightContainPii('john@example.com')).toBe(true);
    });

    it('should return false for clean text', () => {
        expect(mightContainPii('Just a normal sentence')).toBe(false);
    });
});

describe('getRequiredPatterns', () => {
    it('should always include SSN and CREDIT_CARD', () => {
        const required = getRequiredPatterns();
        expect(required).toContain('SSN');
        expect(required).toContain('CREDIT_CARD');
    });

    it('should not include configurable patterns', () => {
        const required = getRequiredPatterns();
        expect(required).not.toContain('EMAIL');
        expect(required).not.toContain('PHONE');
    });
});

describe('getConfigurablePatterns', () => {
    it('should include EMAIL, PHONE, IP_ADDRESS, ADDRESS', () => {
        const patterns = getConfigurablePatterns();
        expect(patterns).toContain('EMAIL');
        expect(patterns).toContain('PHONE');
        expect(patterns).toContain('IP_ADDRESS');
        expect(patterns).toContain('ADDRESS');
    });
});

describe('validatePiiConfig', () => {
    it('should reject disabling SSN', () => {
        const errors = validatePiiConfig({
            patterns: {
                SSN: { enabled: false, required: true },
                CREDIT_CARD: { enabled: true, required: true },
                EMAIL: { enabled: true, required: false },
                PHONE: { enabled: true, required: false },
                IP_ADDRESS: { enabled: true, required: false },
                ADDRESS: { enabled: true, required: false },
            },
        });
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0]).toContain('SSN');
    });

    it('should reject disabling CREDIT_CARD', () => {
        const errors = validatePiiConfig({
            patterns: {
                CREDIT_CARD: { enabled: false, required: true },
                SSN: { enabled: true, required: true },
                EMAIL: { enabled: true, required: false },
                PHONE: { enabled: true, required: false },
                IP_ADDRESS: { enabled: true, required: false },
                ADDRESS: { enabled: true, required: false },
            },
        });
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0]).toContain('CREDIT_CARD');
    });

    it('should accept valid config', () => {
        const errors = validatePiiConfig({
            patterns: {
                SSN: { enabled: true, required: true },
                CREDIT_CARD: { enabled: true, required: true },
                EMAIL: { enabled: false, required: false },
                PHONE: { enabled: false, required: false },
                IP_ADDRESS: { enabled: true, required: false },
                ADDRESS: { enabled: true, required: false },
            },
        });
        expect(errors).toHaveLength(0);
    });
});
