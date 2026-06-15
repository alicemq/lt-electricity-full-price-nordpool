import pool from '../../database.js';
import { validateCronSchedule } from './cronValidation.js';

export { validateCronSchedule };

export async function listCronSchedules() {
  const result = await pool.query(
    `SELECT job_key, name, cron_expression, timezone, description, enabled, editable, updated_at
     FROM cron_schedules
     ORDER BY job_key`,
  );
  return result.rows;
}

export async function getCronSchedule(jobKey) {
  const result = await pool.query(
    `SELECT job_key, name, cron_expression, timezone, description, enabled, editable, updated_at
     FROM cron_schedules
     WHERE job_key = $1`,
    [jobKey],
  );
  return result.rows[0] || null;
}

export async function updateCronSchedule(jobKey, { cronExpression, timezone, enabled }, changedBy) {
  const existing = await getCronSchedule(jobKey);
  if (!existing) {
    return { ok: false, status: 404, error: 'Cron job not found' };
  }
  if (!existing.editable) {
    return { ok: false, status: 400, error: 'Cron job is read-only' };
  }

  const nextExpression = cronExpression ?? existing.cron_expression;
  const nextTimezone = timezone ?? existing.timezone;
  const nextEnabled = enabled ?? existing.enabled;

  const validation = validateCronSchedule(nextExpression, nextTimezone);
  if (!validation.valid) {
    return { ok: false, status: 400, error: validation.error };
  }

  await pool.query(
    `UPDATE cron_schedules
     SET cron_expression = $2,
         timezone = $3,
         enabled = $4,
         updated_at = CURRENT_TIMESTAMP
     WHERE job_key = $1`,
    [jobKey, nextExpression, nextTimezone, nextEnabled],
  );

  await pool.query(
    `INSERT INTO cron_schedule_audit
       (job_key, old_cron_expression, new_cron_expression, old_timezone, new_timezone, changed_by)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      jobKey,
      existing.cron_expression,
      nextExpression,
      existing.timezone,
      nextTimezone,
      changedBy || 'admin-api',
    ],
  );

  return { ok: true, schedule: await getCronSchedule(jobKey) };
}

export async function listCronScheduleAudit(jobKey, limit = 20) {
  const result = await pool.query(
    `SELECT id, job_key, old_cron_expression, new_cron_expression, old_timezone, new_timezone, changed_by, changed_at
     FROM cron_schedule_audit
     WHERE ($1::varchar IS NULL OR job_key = $1)
     ORDER BY changed_at DESC
     LIMIT $2`,
    [jobKey || null, limit],
  );
  return result.rows;
}
