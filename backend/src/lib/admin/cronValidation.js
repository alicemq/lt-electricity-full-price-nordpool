import moment from 'moment-timezone';
import { validate as validateCronExpression } from 'node-cron';

export function validateCronSchedule(cronExpression, timezone) {
  if (!cronExpression || typeof cronExpression !== 'string') {
    return { valid: false, error: 'cronExpression is required' };
  }
  if (!validateCronExpression(cronExpression)) {
    return { valid: false, error: 'Invalid cron expression' };
  }
  if (!timezone || !moment.tz.zone(timezone)) {
    return { valid: false, error: 'Invalid timezone' };
  }
  return { valid: true };
}
