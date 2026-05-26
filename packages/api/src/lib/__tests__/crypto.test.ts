import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';

// We need to test the lazy key loading, so we'll manipulate process.env
// and use dynamic imports to get fresh module state

describe('crypto', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('encrypt / decrypt roundtrip', () => {
    it('encrypts and decrypts a simple string', async () => {
      const { encrypt, decrypt } = await import('../crypto');
      const plaintext = 'hello world';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('encrypts and decrypts unicode characters', async () => {
      const { encrypt, decrypt } = await import('../crypto');
      const plaintext = 'Hello 世界 🌍 ñoño';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('encrypts and decrypts empty string', async () => {
      const { encrypt, decrypt } = await import('../crypto');
      const plaintext = '';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('encrypts and decrypts a long string', async () => {
      const { encrypt, decrypt } = await import('../crypto');
      const plaintext = 'a'.repeat(10000);
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('produces different ciphertexts for same plaintext (IV randomness)', async () => {
      const { encrypt } = await import('../crypto');
      const plaintext = 'same text';
      const encrypted1 = encrypt(plaintext);
      const encrypted2 = encrypt(plaintext);
      expect(encrypted1).not.toBe(encrypted2);
    });

    it('produces ciphertext in expected format (iv:authTag:encrypted)', async () => {
      const { encrypt } = await import('../crypto');
      const encrypted = encrypt('test');
      const parts = encrypted.split(':');
      expect(parts).toHaveLength(3);
      expect(parts[0]).toHaveLength(32); // IV = 16 bytes = 32 hex chars
      expect(parts[1]).toHaveLength(32); // Auth tag = 16 bytes = 32 hex chars
      expect(parts[2].length).toBeGreaterThan(0);
    });

    it('throws on invalid format (missing parts)', async () => {
      const { decrypt } = await import('../crypto');
      expect(() => decrypt('invalid')).toThrow('Invalid encrypted data format');
      expect(() => decrypt('one:two')).toThrow('Invalid encrypted data format');
    });

    it('throws on tampered ciphertext', async () => {
      const { encrypt, decrypt } = await import('../crypto');
      const plaintext = 'secret data';
      const encrypted = encrypt(plaintext);
      const parts = encrypted.split(':');
      parts[2] = parts[2].slice(0, -2) + '00';
      const tampered = parts.join(':');
      expect(() => decrypt(tampered)).toThrow();
    });

    it('throws on tampered auth tag', async () => {
      const { encrypt, decrypt } = await import('../crypto');
      const plaintext = 'secret data';
      const encrypted = encrypt(plaintext);
      const parts = encrypted.split(':');
      parts[1] = parts[1].slice(0, -2) + '00';
      const tampered = parts.join(':');
      expect(() => decrypt(tampered)).toThrow();
    });
  });

  describe('hash', () => {
    it('produces consistent hashes for same input', async () => {
      const { hash } = await import('../crypto');
      const input = 'test@example.com';
      const hash1 = hash(input);
      const hash2 = hash(input);
      expect(hash1).toBe(hash2);
    });

    it('produces different hashes for different inputs', async () => {
      const { hash } = await import('../crypto');
      const hash1 = hash('input1');
      const hash2 = hash('input2');
      expect(hash1).not.toBe(hash2);
    });

    it('produces a 64-character hex string', async () => {
      const { hash } = await import('../crypto');
      const result = hash('anything');
      expect(result).toHaveLength(64);
      expect(result).toMatch(/^[a-f0-9]{64}$/);
    });

    it('handles empty string', async () => {
      const { hash } = await import('../crypto');
      const result = hash('');
      expect(result).toHaveLength(64);
      expect(result).toMatch(/^[a-f0-9]{64}$/);
    });

    it('handles unicode characters', async () => {
      const { hash } = await import('../crypto');
      const result = hash('Hello 世界 🌍');
      expect(result).toHaveLength(64);
    });
  });

  describe('generateToken', () => {
    it('generates a token of default length', async () => {
      const { generateToken } = await import('../crypto');
      const token = generateToken();
      expect(token.length).toBeGreaterThan(40);
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('generates a token of specified length', async () => {
      const { generateToken } = await import('../crypto');
      const token = generateToken(64);
      expect(token.length).toBeGreaterThan(80);
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('generates unique tokens', async () => {
      const { generateToken } = await import('../crypto');
      const tokens = new Set();
      for (let i = 0; i < 100; i++) {
        tokens.add(generateToken());
      }
      expect(tokens.size).toBe(100);
    });

    it('generates tokens with only base64url characters', async () => {
      const { generateToken } = await import('../crypto');
      const token = generateToken();
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    });
  });

  describe('ENCRYPTION_KEY validation', () => {
    it('throws when ENCRYPTION_KEY is missing', async () => {
      delete process.env.ENCRYPTION_KEY;
      vi.resetModules();
      const { encrypt: encryptFresh } = await import('../crypto');
      expect(() => encryptFresh('test')).toThrow('ENCRYPTION_KEY environment variable is required');
    });

    it('throws when ENCRYPTION_KEY is wrong length', async () => {
      process.env.ENCRYPTION_KEY = 'tooshort';
      vi.resetModules();
      const { encrypt: encryptFresh } = await import('../crypto');
      expect(() => encryptFresh('test')).toThrow('ENCRYPTION_KEY must be 64 hex characters');
    });
  });
});
