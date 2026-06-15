# Push admin API and statistics

Operator guide for the protected `/api/v1/admin/push/*` endpoints shipped in #15. Use this for subscription counts, delivery logs, test sends, and broadcasts until a full admin UI exists (#14 follow-ups).

## Prerequisites

| Variable | Purpose |
| --- | --- |
| `ADMIN_API_TOKEN` | Bearer or `X-Admin-Token` on every admin request |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Required for `/test` and `/broadcast` only |

Generate VAPID keys:

```bash
npx web-push generate-vapid-keys
```

Set keys in Coolify env or local `.env` (see [COOLIFY_DEPLOYMENT.md](../../COOLIFY_DEPLOYMENT.md)).

Interactive reference: Swagger UI at `/api/` → **Admin** tag.

## Authentication

```bash
export ADMIN_TOKEN="your_admin_api_token"
export API_BASE="https://elektra.teletigras.lt/api/v1"
```

Send either header:

- `Authorization: Bearer $ADMIN_TOKEN`
- `X-Admin-Token: $ADMIN_TOKEN`

Optional audit actor: `X-Admin-Actor: ops@example.com`

## Endpoints

### GET `/admin/push/stats`

Aggregates active/total push subscriptions and 24-hour send/failure counts.

```bash
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$API_BASE/admin/push/stats" | jq
```

Example response:

```json
{
  "success": true,
  "data": {
    "subscriptions": { "active": 12, "total": 15 },
    "last24h": { "sent": 48, "failures": 1 },
    "configured": true
  }
}
```

`configured` reflects VAPID presence; stats still return when VAPID is unset.

### GET `/admin/push/deliveries`

Recent sent notifications and failures (newest first). Query: `limit` (1–200, default 50).

```bash
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$API_BASE/admin/push/deliveries?limit=20" | jq
```

Endpoints in the response are push service URLs (not user PII). Retention follows DB tables `push_sent_log` and `push_delivery_failures`.

### POST `/admin/push/test`

Send a test notification to one subscription by database id.

```bash
curl -sS -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"subscriptionId":1,"title":"Test","body":"Hello","url":"/today"}' \
  "$API_BASE/admin/push/test"
```

### POST `/admin/push/broadcast`

Send to all active subscriptions (or all if `activeOnly: false`).

```bash
curl -sS -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Prices updated","body":"Tomorrow prices are available","url":"/upcoming"}' \
  "$API_BASE/admin/push/broadcast"
```

## Export for analysis

Pipe JSON to a file (no built-in CSV yet):

```bash
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$API_BASE/admin/push/stats" > push-stats-$(date -u +%Y%m%d).json

curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$API_BASE/admin/push/deliveries?limit=200" > push-deliveries-$(date -u +%Y%m%d).json
```

## Privacy and scope

- Default views expose subscription ids and push endpoints only; no email or device names.
- **Not in this API (deferred):** PWA install counts, per-country breakdown, time-range filters beyond 24h, silent-push effectiveness metrics. Track in follow-up issues if needed.

## Related issues

- #15 — push admin API (implemented)
- #14 — full statistics dashboard (this doc satisfies minimal wiring; UI/filters deferred)
