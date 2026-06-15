import webpush from 'web-push';
import { requireVapid } from './vapid.js';

const DEFAULT_TITLE = 'Elektros kaina LT';

/**
 * @param {import('pg').Pool} pool
 * @param {{ id: string, endpoint: string, p256dh: string, auth: string }} subscription
 * @param {{ title?: string, body?: string, url?: string }} message
 * @param {string} [dedupeKey]
 */
export async function sendPushToSubscription(pool, subscription, message, dedupeKey = null) {
  requireVapid();

  const payload = JSON.stringify({
    title: message.title || DEFAULT_TITLE,
    body: message.body || '',
    url: message.url || '/',
  });

  const pushSubscription = {
    endpoint: subscription.endpoint,
    keys: { p256dh: subscription.p256dh, auth: subscription.auth },
  };

  try {
    await webpush.sendNotification(pushSubscription, payload);

    if (dedupeKey) {
      await pool.query(
        `INSERT INTO push_sent_log (sub_id, dedupe_key)
         VALUES ($1, $2)
         ON CONFLICT (sub_id, dedupe_key) DO NOTHING`,
        [subscription.id, dedupeKey],
      );
    }

    await pool.query(
      `UPDATE push_subscriptions SET last_error = NULL, updated_at = NOW() WHERE id = $1`,
      [subscription.id],
    );

    return { ok: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    await pool.query(
      `UPDATE push_subscriptions SET last_error = $2, updated_at = NOW() WHERE id = $1`,
      [subscription.id, errorMessage],
    );

    await pool.query(
      `INSERT INTO push_delivery_failures (sub_id, dedupe_key, error_message, payload_json)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [subscription.id, dedupeKey, errorMessage, payload],
    );

    return { ok: false, error: errorMessage };
  }
}
