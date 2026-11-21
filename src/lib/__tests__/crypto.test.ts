import { describe, it, expect } from 'vitest';
import {
  deriveKey,
  encryptText,
  decryptText,
  generateSalt,
  generateMasterKey,
  hashForValidation,
} from '../utils/crypto';

function bytesEqual(a: ArrayBuffer | Uint8Array, b: ArrayBuffer | Uint8Array): boolean {
  const viewA = a instanceof Uint8Array ? a : new Uint8Array(a);
  const viewB = b instanceof Uint8Array ? b : new Uint8Array(b);
  if (viewA.byteLength !== viewB.byteLength) return false;
  return viewA.every((byte, idx) => byte === viewB[idx]);
}

describe('crypto utilities (PBKDF2 + AES-256-GCM)', () => {
  it('generates 16-byte cryptographically random salts', () => {
    const saltA = generateSalt();
    const saltB = generateSalt();

    expect(saltA).toBeInstanceOf(Uint8Array);
    expect(saltA.byteLength).toBe(16);
    expect(bytesEqual(saltA, saltB)).toBe(false);
  });

  it('generates 64-char hex master keys (256 bits)', () => {
    const keyA = generateMasterKey();
    const keyB = generateMasterKey();

    expect(keyA).toMatch(/^[0-9a-f]{64}$/);
    expect(keyA).not.toBe(keyB);
  });

  it('round-trips plaintext, Unicode, emoji, and empty strings accurately', async () => {
    const salt = generateSalt();
    const key = await deriveKey('correct-horse-battery-staple', salt);

    const samples = [
      '',
      'Simple ASCII developer note with API notes',
      'Unicode & emoji: سلام دنیا 🚀 🔒 — café naïve',
      'Line 1\nLine 2\r\n\tIndented JSON: {"ok": true}\n'.repeat(200),
    ];

    for (const plaintext of samples) {
      const { ciphertext, iv } = await encryptText(plaintext, key);
      expect(iv.byteLength).toBe(12);
      const decrypted = await decryptText(ciphertext, key, iv);
      expect(decrypted).toBe(plaintext);
    }
  });

  it('uses a fresh IV per encryption so identical plaintexts produce different ciphertexts', async () => {
    const salt = generateSalt();
    const key = await deriveKey('same-password', salt);

    const first = await encryptText('identical secret', key);
    const second = await encryptText('identical secret', key);

    expect(bytesEqual(first.iv, second.iv)).toBe(false);
    expect(bytesEqual(first.ciphertext, second.ciphertext)).toBe(false);
  });

  it('rejects decryption with the wrong password', async () => {
    const salt = generateSalt();
    const rightKey = await deriveKey('right-password', salt);
    const wrongKey = await deriveKey('wrong-password', salt);

    const { ciphertext, iv } = await encryptText('confidential note', rightKey);

    await expect(decryptText(ciphertext, wrongKey, iv)).rejects.toThrow();
  });

  it('rejects decryption if ciphertext or IV is tampered with (GCM integrity)', async () => {
    const salt = generateSalt();
    const key = await deriveKey('integrity-password', salt);
    const { ciphertext, iv } = await encryptText('tamper-proof payload', key);

    const tamperedCiphertext = new Uint8Array(ciphertext.slice(0));
    tamperedCiphertext[0] ^= 0xff;
    await expect(decryptText(tamperedCiphertext.buffer, key, iv)).rejects.toThrow();

    const tamperedIv = new Uint8Array(iv);
    tamperedIv[0] ^= 0xff;
    await expect(decryptText(ciphertext, key, tamperedIv)).rejects.toThrow();
  });

  it('produces deterministic salted SHA-256 validation hashes', async () => {
    const saltA = generateSalt();
    const saltB = generateSalt();

    const hash1 = await hashForValidation('my-passphrase', saltA);
    const hash2 = await hashForValidation('my-passphrase', saltA);
    const hashDifferentSalt = await hashForValidation('my-passphrase', saltB);
    const hashDifferentInput = await hashForValidation('other-passphrase', saltA);

    expect(hash1).toMatch(/^[0-9a-f]{64}$/);
    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hashDifferentSalt);
    expect(hash1).not.toBe(hashDifferentInput);
  });
});
