import crypto from 'node:crypto';

export function hashManageToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function createManageToken() {
  return crypto.randomBytes(24).toString('hex');
}
