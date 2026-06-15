import express from 'express';
import { requireVapid } from './vapid.js';
import { sendPushToSubscription } from './delivery.js';

export function createPushAdminRouter({ pool }) {
  const router = express.Router();

  router.get('/stats', async (_req, res) => {
    try {
      const [{ rows: subRows }, { rows: failRows }, { rows: sentRows }] = await Promise.all([
        pool.query(
          `SELECT
             COUNT(*) FILTER (WHERE active) AS active_count,
             COUNT(*) AS total_count
           FROM push_subscriptions`,
        ),
        pool.query(
          `SELECT COUNT(*) AS failure_count
           FROM push_delivery_failures
           WHERE failed_at > NOW() - INTERVAL '24 hours'`,
        ),
        pool.query(
          `SELECT COUNT(*) AS sent_count
           FROM push_sent_log
           WHERE sent_at > NOW() - INTERVAL '24 hours'`,
        ),
      ]);

      res.json({
        success: true,
        data: {
          subscriptions: {
            active: Number(subRows[0]?.active_count || 0),
            total: Number(subRows[0]?.total_count || 0),
          },
          last24h: {
            sent: Number(sentRows[0]?.sent_count || 0),
            failures: Number(failRows[0]?.failure_count || 0),
          },
          configured: true,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to load push stats',
        details: error.message,
      });
    }
  });

  router.get('/deliveries', async (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);

    try {
      const [{ rows: sent }, { rows: failures }] = await Promise.all([
        pool.query(
          `SELECT s.id, s.sub_id, s.dedupe_key, s.sent_at, sub.endpoint
           FROM push_sent_log s
           JOIN push_subscriptions sub ON sub.id = s.sub_id
           ORDER BY s.sent_at DESC
           LIMIT $1`,
          [limit],
        ),
        pool.query(
          `SELECT f.id, f.sub_id, f.dedupe_key, f.error_message, f.failed_at, sub.endpoint
           FROM push_delivery_failures f
           JOIN push_subscriptions sub ON sub.id = f.sub_id
           ORDER BY f.failed_at DESC
           LIMIT $1`,
          [limit],
        ),
      ]);

      res.json({
        success: true,
        data: { sent, failures },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to load deliveries',
        details: error.message,
      });
    }
  });

  router.post('/test', async (req, res) => {
    try {
      requireVapid();
    } catch {
      return res.status(503).json({ success: false, error: 'not_configured' });
    }

    const { subscriptionId, title, body, url } = req.body || {};
    if (!subscriptionId) {
      return res.status(400).json({ success: false, error: 'missing_subscription_id' });
    }

    const { rows } = await pool.query(
      `SELECT id, endpoint, p256dh, auth FROM push_subscriptions
       WHERE id = $1 AND active = true`,
      [subscriptionId],
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'not_found' });
    }

    const result = await sendPushToSubscription(
      pool,
      rows[0],
      { title, body, url },
      `admin-test:${Date.now()}`,
    );

    if (!result.ok) {
      return res.status(502).json({ success: false, error: result.error });
    }

    res.json({ success: true });
  });

  router.post('/broadcast', async (req, res) => {
    try {
      requireVapid();
    } catch {
      return res.status(503).json({ success: false, error: 'not_configured' });
    }

    const { title, body, url, activeOnly = true } = req.body || {};
    if (!title || !body) {
      return res.status(400).json({ success: false, error: 'missing_message' });
    }

    const { rows } = await pool.query(
      `SELECT id, endpoint, p256dh, auth FROM push_subscriptions
       WHERE active = $1 OR $1 = false`,
      [activeOnly !== false],
    );

    const dedupeKey = `broadcast:${Date.now()}`;
    let sent = 0;
    let failed = 0;

    for (const row of rows) {
      const result = await sendPushToSubscription(pool, row, { title, body, url }, dedupeKey);
      if (result.ok) sent += 1;
      else failed += 1;
    }

    res.json({
      success: true,
      data: { targeted: rows.length, sent, failed },
    });
  });

  return router;
}
