/**
 * Readiness SLO (UA1 default until PO chooses otherwise):
 * - postgres: database accepts queries
 * - price_data_fresh: at least one country has price data within 24 hours
 *
 * See docs/ops/ready-slo.md
 */
export function isReady(checks) {
  return Object.values(checks).every(Boolean);
}

export async function runReadyChecks() {
  const { testConnection, getSystemHealth } = await import('../database.js');
  const checks = {
    postgres: false,
    price_data_fresh: false,
  };

  checks.postgres = await testConnection();
  if (!checks.postgres) {
    return checks;
  }

  const health = await getSystemHealth();
  if (typeof health?.error === 'string') {
    return checks;
  }

  const freshness = Array.isArray(health.sync?.dataFreshness) ? health.sync.dataFreshness : [];
  checks.price_data_fresh = freshness.some((entry) => entry.isRecent === true);

  return checks;
}

export async function buildReadyResponse() {
  const checks = await runReadyChecks();
  const ready = isReady(checks);
  return {
    status: ready ? 'ready' : 'not_ready',
    checks,
  };
}
