import { describe, it, expect, beforeAll } from 'vitest';
import crypto from 'crypto';
import { encrypt, decrypt, hash, generateToken } from '../crypto';

describe('Crypto utilities', () => {
  beforeAll(() => {
    if (!process.env.ENCRYPTION_KEY) {
      process.env.ENCRYPTION_KEY = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
    }
  });

  describe('encrypt / decrypt', () => {
    it('round-trips plain text', () => {
      const original = 'hello world';
      const encrypted = encrypt(original);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(original);
    });

    it('round-trips unicode text', () => {
      const original = 'Hello 🌍 世界 émojis! ñoño';
      const encrypted = encrypt(original);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(original);
    });

    it('round-trips empty string', () => {
      const original = '';
      const encrypted = encrypt(original);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(original);
    });

    it('produces different ciphertexts for same plaintext', () => {
      const original = 'same text';
      const encrypted1 = encrypt(original);
      const encrypted2 = encrypt(original);
      expect(encrypted1).not.toBe(encrypted2);
      expect(decrypt(encrypted1)).toBe(original);
      expect(decrypt(encrypted2)).toBe(original);
    });

    it('throws on invalid encrypted data format', () => {
      expect(() => decrypt('not-enough-parts')).toThrow('Invalid encrypted data format');
    });

    it('throws on tampered ciphertext', () => {
      const encrypted = encrypt('secret');
      const parts = encrypted.split(':');
      parts[2] = parts[2].slice(0, -2) + 'ff';
      expect(() => decrypt(parts.join(':'))).toThrow();
    });
  });

  describe('hash', () => {
    it('produces deterministic SHA-256 hex', () => {
      const value = 'test-value';
      const h1 = hash(value);
      const h2 = hash(value);
      expect(h1).toBe(h2);
      expect(h1).toMatch(/^[a-f0-9]{64}$/);
    });

    it('produces different hashes for different inputs', () => {
      expect(hash('a')).not.toBe(hash('b'));
    });
  });

  describe('generateToken', () => {
    it('generates unique tokens', () => {
      const tokens = new Set<string>();
      for (let i = 0; i < 100; i++) {
        tokens.add(generateToken());
      }
      expect(tokens.size).toBe(100);
    });

    it('respects custom length', () => {
      const token = generateToken(16);
      expect(token.length).toBeGreaterThanOrEqual(20);
    });
  });
});
