const ALGO = 'AES-GCM';
const KEY_LEN = 256;
const PBKDF2_ITERATIONS = 100000;

/**
 * Derives a cryptographic key from a password and salt using PBKDF2.
 */
export async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const passwordKey = await globalThis.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  return globalThis.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as any,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    } as any,
    passwordKey,
    { name: ALGO, length: KEY_LEN } as any,
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a string using a key.
 */
export async function encryptText(text: string, key: CryptoKey): Promise<{ ciphertext: ArrayBuffer; iv: Uint8Array }> {
  const enc = new TextEncoder();
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await globalThis.crypto.subtle.encrypt(
    { name: ALGO, iv: iv as any } as any,
    key,
    enc.encode(text)
  );

  return { ciphertext, iv };
}

/**
 * Decrypts an ArrayBuffer using a key and IV.
 */
export async function decryptText(ciphertext: ArrayBuffer, key: CryptoKey, iv: Uint8Array): Promise<string> {
  const decrypted = await globalThis.crypto.subtle.decrypt(
    { name: ALGO, iv: iv as any } as any,
    key,
    ciphertext
  );

  const dec = new TextDecoder();
  return dec.decode(decrypted);
}

/**
 * Generates a random salt.
 */
export function generateSalt(): Uint8Array {
  return globalThis.crypto.getRandomValues(new Uint8Array(16));
}

/**
 * Generates a Master Key (long random hex string).
 */
export function generateMasterKey(): string {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Hashes a key or password for storage-side validation (not for verification of decryption).
 */
export async function hashForValidation(text: string, salt: Uint8Array): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(text);
  const combined = new Uint8Array(salt.length + data.length);
  combined.set(salt);
  combined.set(data, salt.length);

  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', combined);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
