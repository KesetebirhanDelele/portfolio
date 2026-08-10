// Shared AES-256-GCM helpers for encrypting sensitive values at rest
// (GitHub OAuth tokens, Colaberry captured sessions). Extracted so there's
// one tested implementation instead of one per caller.
const crypto = require('crypto');

// Returns { payload, iv } — both base64, safe to store as TEXT columns.
function encrypt(plaintext, keyHex) {
  const key = Buffer.from(keyHex, 'hex');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    payload: Buffer.concat([encrypted, authTag]).toString('base64'),
    iv: iv.toString('base64'),
  };
}

// payloadB64/ivB64: the two base64 strings produced by encrypt().
function decrypt(payloadB64, ivB64, keyHex) {
  const key = Buffer.from(keyHex, 'hex');
  const iv = Buffer.from(ivB64, 'base64');
  const combined = Buffer.from(payloadB64, 'base64');
  const authTag = combined.subarray(combined.length - 16);
  const encrypted = combined.subarray(0, combined.length - 16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

module.exports = { encrypt, decrypt };
