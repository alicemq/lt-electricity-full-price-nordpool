import express from 'express';
import crypto from 'node:crypto';
import { requireVapid, isPushConfigured } from './vapid.js';
import { createManageToken, hashManageToken } from './tokens.js';
import { sendPushToSubscription } from './delivery.js';

export function createPushRouter({ pool }) {
  const router = express.Router();

  router.get('/vapid-public', (_req, res) => {
    try {
      const { publicKey } = requireVapid();
      res.json({ success: true, publicKey });
    } catch {
      res.status(503).json({ success: false, error: 'not_configured' });
    }
  });

  router.get('/status', (_req, res) => {
    res.json({
      success: true,
      configured: isPushConfigured(),
    });
  });

  router.post('/subscribe', async (req, res) => {
    try {
      requireVapid();
    } catch {
      return res.status(503).json({ success: false, error: 'not_configured' });
    }

    const sub = req.body?.pushSubscription;
    if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
      return res.status(400).json({ success: false, error: 'invalid_subscription' });
    }

    const id = crypto.randomUUID();
    const manageToken = createManageToken();
    const payloadJson = JSON.stringify(req.body?.productPayload || {});

    await pool.query(
      `INSERT INTO push_subscriptions
         (id, endpoint, p256dh, auth, payload_json, manage_token_hash, created_at, updated_at, active)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, NOW(), NOW(), true)
       ON CONFLICT (endpoint) DO UPDATE SET
         p256dh = EXCLUDED.p256dh,
         auth = EXCLUDED.auth,
         payload_json = EXCLUDED.payload_json,
         manage_token_hash = EXCLUDED.manage_token_hash,
         updated_at = NOW(),
         active = true
       RETURNING id`,
      [id, sub.endpoint, sub.keys.p256dh, sub.keys.auth, payloadJson, hashManageToken(manageToken)],
    );

    res.status(201).json({ success: true, id, manageToken });
  });

  router.delete('/subscribe', async (req, res) => {
    const { id, manageToken } = req.body || {};
    if (!id || !manageToken) {
      return res.status(400).json({ success: false, error: 'missing_credentials' });
    }

    const { rowCount } = await pool.query(
      `UPDATE push_subscriptions SET active = false, updated_at = NOW()
       WHERE id = $1 AND manage_token_hash = $2`,
      [id, hashManageToken(manageToken)],
    );

    if (!rowCount) {
      return res.status(404).json({ success: false, error: 'not_found' });
    }

    res.json({ success: true, ok: true });
  });

  router.post('/test', async (req, res) => {
    try {
      requireVapid();
    } catch {
      return res.status(503).json({ success: false, error: 'not_configured' });
    }

    const { id, manageToken } = req.body || {};
    const { rows } = await pool.query(
      `SELECT id, endpoint, p256dh, auth FROM push_subscriptions
       WHERE id = $1 AND manage_token_hash = $2 AND active = true`,
      [id, hashManageToken(manageToken)],
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'not_found' });
    }

    const result = await sendPushToSubscription(
      pool,
      rows[0],
      { title: 'Elektros kaina LT', body: 'Push test OK', url: '/' },
      `test:${Date.now()}`,
    );

    if (!result.ok) {
      return res.status(502).json({ success: false, error: result.error });
    }

    res.json({ success: true, ok: true });
  });

  return router;
}
