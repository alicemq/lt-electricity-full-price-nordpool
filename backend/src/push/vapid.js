import webpush from 'web-push';

let vapidConfigured = false;

export function getVapidConfig() {
  const publicKey = process.env.VAPID_PUBLIC_KEY || '';
  const privateKey = process.env.VAPID_PRIVATE_KEY || '';
  const subject = process.env.VAPID_SUBJECT || 'mailto:ops@example.com';
  return { publicKey, privateKey, subject };
}

export function isPushConfigured() {
  const { publicKey, privateKey } = getVapidConfig();
  return Boolean(publicKey && privateKey);
}

export function requireVapid() {
  const config = getVapidConfig();
  if (!config.publicKey || !config.privateKey) {
    throw new Error('VAPID keys not configured');
  }
  if (!vapidConfigured) {
    webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
    vapidConfigured = true;
  }
  return config;
}
