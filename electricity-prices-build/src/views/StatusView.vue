<template>
  <div class="status-view">
    <div class="status-header">
      <h1>System Status</h1>
      <div class="timezone-toggle">
        <label class="form-check form-switch">
          <input 
            class="form-check-input" 
            type="checkbox" 
            v-model="useLocalTimezone"
            @change="saveTimezonePreference"
          >
          <span class="form-check-label">Show times in {{ useLocalTimezone ? 'EET' : 'CET' }} ({{ currentTimezoneAbbr }})</span>
        </label>
      </div>
    </div>
    <div v-if="loading" class="status-loading">Loading status...</div>
    <div v-else-if="error" class="status-error">Error: {{ error }}</div>
    <div v-else>
      <section class="status-section">
        <h2>System</h2>
        <ul>
          <li><b>Node Version:</b> {{ status.system.nodeVersion }}</li>
          <li><b>Platform:</b> {{ status.system.platform }}</li>
          <li><b>Uptime:</b> {{ status.system.uptime }}</li>
        </ul>
      </section>
      <section class="status-section">
        <h2>Database</h2>
        <ul>
          <li><b>Connected:</b> {{ status.database.connected ? 'Yes' : 'No' }}</li>
          <li><b>Uptime:</b> {{ status.database.uptime && status.database.uptime.minutes !== undefined ? status.database.uptime.minutes + ' min' : status.database.uptime }}</li>
          <li><b>Active Connections:</b> {{ status.database.activeConnections }}</li>
          <li><b>Total Records:</b> {{ status.database.stats.totalRecords }}</li>
          <li><b>Database Size:</b> {{ status.database.stats.databaseSize.size }}</li>
        </ul>
        <h3>Records by Country</h3>
        <table class="status-table">
          <thead>
            <tr><th>Country</th><th>Total Records</th><th>Earliest</th><th>Latest</th></tr>
          </thead>
          <tbody>
            <tr v-for="c in status.database.stats.countries" :key="c.country">
              <td>{{ c.country.toUpperCase() }}</td>
              <td>{{ c.total_records }}</td>
              <td>{{ formatTimestamp(c.earliest_timestamp) }}</td>
              <td>{{ formatTimestamp(c.latest_timestamp) }}</td>
            </tr>
          </tbody>
        </table>
      </section>
      <section class="status-section">
        <h2>Sync</h2>
        <ul>
          <li><b>System Time:</b> {{ formatTimestamp(new Date().toISOString()) }}</li>
          <li><b>Initial Sync Complete:</b> {{ status.sync.initialSync.isComplete ? 'Yes' : 'No' }}</li>
          <li><b>Initial Sync Date:</b> {{ formatDate(status.sync.initialSync.completedDate) }}</li>
          <li><b>Initial Sync Records:</b> {{ status.sync.initialSync.recordsCount }}</li>
          <li><b>Last Sync Type:</b> {{ status.sync.lastSync.sync_type }}</li>
          <li><b>Last Sync Status:</b> {{ status.sync.lastSync.status }}</li>
          <li><b>Last Sync Completed At:</b> {{ formatTimestamp(status.sync.lastSync.completed_at) }}</li>
        </ul>
        <h3>Country Sync Status</h3>
        <table class="status-table">
          <thead>
            <tr><th>Country</th><th>Latest Full Day</th><th>Sync OK</th><th>Last Sync At</th></tr>
          </thead>
          <tbody>
            <tr v-for="c in (status.sync.countrySyncStatus || [])" :key="c.country">
              <td>{{ c.country.toUpperCase() }}</td>
              <td>{{ formatDate(c.last_sync_ok_date) }}</td>
              <td>{{ c.sync_ok ? '✅ Yes' : '❌ No' }}</td>
              <td>{{ formatTimestamp(c.last_sync_at) }}</td>
            </tr>
          </tbody>
        </table>
      </section>
      <section class="status-section">
        <h2>Scheduled Jobs</h2>
        <div v-if="!status.scheduledJobs || status.scheduledJobs.length === 0" class="text-muted">
          No scheduled jobs available
        </div>
        <table v-else class="status-table">
          <thead>
            <tr><th>Name</th><th>Schedule</th><th>Description</th><th>Next Run</th><th>Is Running</th></tr>
          </thead>
          <tbody>
            <tr v-for="job in status.scheduledJobs" :key="job.name">
              <td>{{ job.name }}</td>
              <td>{{ job.cron || job.schedule || '-' }}</td>
              <td>{{ job.description || '-' }}</td>
              <td>{{ formatTimestamp(job.nextRun) }}</td>
              <td>{{ (job.running !== undefined ? job.running : job.isRunning) ? 'Yes' : 'No' }}</td>
            </tr>
          </tbody>
        </table>
        <div v-if="status.scheduledJobs && status.scheduledJobs.length > 0" class="job-details">
          <div v-for="job in status.scheduledJobs" :key="job.name" class="job-detail-item">
            <h3 v-if="job.name === 'Daily Sync'">{{ job.name }} - Safeguards</h3>
            <ul v-if="job.name === 'Daily Sync'">
              <li><b>Last Check:</b> {{ formatTimestamp(job.lastCheck) || 'Never' }}</li>
              <li><b>Watchdog Active:</b> {{ job.watchdogActive ? '✅ Yes' : '❌ No' }}</li>
              <li><b>Fallback Cron Active:</b> {{ job.fallbackActive ? '✅ Yes' : '❌ No' }}</li>
            </ul>
          </div>
        </div>
      </section>
      <section class="status-section" v-if="status.issues && status.issues.length">
        <h2>Issues</h2>
        <ul>
          <li v-for="issue in status.issues" :key="issue">⚠️ {{ issue }}</li>
        </ul>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import moment from 'moment-timezone'

const status = ref(null)
const loading = ref(true)
const error = ref(null)

// Timezone preference - default to EET (Europe/Vilnius), toggle to CET (Europe/Paris)
const useLocalTimezone = ref(true)
const TIMEZONE_PREF_KEY = 'statusView_useLocalTimezone'
const EET_TIMEZONE = 'Europe/Vilnius' // EET/EEST timezone
const CET_TIMEZONE = 'Europe/Paris' // CET/CEST timezone

// Load timezone preference from localStorage
const savedPreference = localStorage.getItem(TIMEZONE_PREF_KEY)
if (savedPreference !== null) {
  useLocalTimezone.value = savedPreference === 'true'
}

// Get current timezone abbreviation
const currentTimezoneAbbr = computed(() => {
  if (useLocalTimezone.value) {
    return moment.tz(EET_TIMEZONE).format('z') // EET or EEST
  }
  return moment.tz(CET_TIMEZONE).format('z') // CET or CEST
})

function saveTimezonePreference() {
  localStorage.setItem(TIMEZONE_PREF_KEY, useLocalTimezone.value.toString())
}

function formatTimestamp(ts) {
  if (!ts && ts !== 0) return '-';
  
  let date = null;
  
  // If it's a number (unix timestamp in seconds)
  if (typeof ts === 'number' || (typeof ts === 'string' && /^\d+$/.test(ts))) {
    const numTs = typeof ts === 'number' ? ts : Number(ts);
    // Check if it's a reasonable Unix timestamp (between 2000 and 2100)
    if (numTs > 946684800 && numTs < 4102444800) {
      date = new Date(numTs * 1000);
      if (isNaN(date.getTime())) date = null;
    }
  }
  
  // If it's an ISO string (from backend)
  if (!date && typeof ts === 'string' && ts.includes('T')) {
    try {
      date = new Date(ts);
      if (isNaN(date.getTime())) date = null;
    } catch (e) {
      // Fall through
    }
  }
  
  if (date) {
    if (useLocalTimezone.value) {
      // Format in EET timezone (Europe/Vilnius)
      const m = moment(date).tz(EET_TIMEZONE);
      return `${m.format('YYYY-MM-DD HH:mm:ss')} ${m.format('z')}`;
    } else {
      // Format in CET timezone (Europe/Paris)
      const m = moment(date).tz(CET_TIMEZONE);
      return `${m.format('YYYY-MM-DD HH:mm:ss')} ${m.format('z')}`;
    }
  }
  
  return ts;
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  
  // Extract just the date part if it includes time (e.g., "2025-11-28T00:00:00.000Z" -> "2025-11-28")
  let dateOnly = dateStr;
  if (typeof dateStr === 'string') {
    // Handle ISO date strings with time
    if (dateStr.includes('T')) {
      dateOnly = dateStr.split('T')[0];
    }
    // Handle date strings with time but no T (e.g., "2025-11-28 00:00:00")
    else if (dateStr.includes(' ')) {
      dateOnly = dateStr.split(' ')[0];
    }
  }
  
  // If it's in YYYY-MM-DD format, format it
  if (typeof dateOnly === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
    if (useLocalTimezone.value) {
      // Parse as date in EET timezone (Europe/Vilnius) at midnight
      const m = moment.tz(dateOnly, 'YYYY-MM-DD', EET_TIMEZONE).startOf('day');
      return `${m.format('YYYY-MM-DD HH:mm:ss')} ${m.format('z')}`;
    } else {
      // Parse as date in CET timezone (Europe/Paris) at midnight
      const m = moment.tz(dateOnly, 'YYYY-MM-DD', CET_TIMEZONE).startOf('day');
      return `${m.format('YYYY-MM-DD HH:mm:ss')} ${m.format('z')}`;
    }
  }
  
  // Otherwise, try to format as timestamp
  return formatTimestamp(dateStr);
}

async function fetchStatus() {
  loading.value = true
  error.value = null
  try {
    const res = await fetch('/api/v1/health')
    if (!res.ok) throw new Error('Failed to fetch status')
    const data = await res.json()
    status.value = data
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

onMounted(fetchStatus)
</script>

<style scoped>
.status-view {
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem;
}
.status-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
}
.status-header h1 {
  margin: 0;
}
.timezone-toggle {
  display: flex;
  align-items: center;
}
.form-check {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.form-check-input {
  margin: 0;
  cursor: pointer;
}
.form-check-label {
  cursor: pointer;
  user-select: none;
}
.status-section {
  margin-bottom: 2rem;
  background: #f9f9f9;
  border-radius: 8px;
  padding: 1rem 1.5rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.03);
}
.status-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 0.5rem;
}
.status-table th, .status-table td {
  border: 1px solid #ddd;
  padding: 0.5rem 0.75rem;
  text-align: left;
}
.status-table td small {
  color: #666;
  font-size: 0.85em;
}
.status-table th {
  background: #f0f0f0;
}
.status-loading, .status-error {
  font-size: 1.2rem;
  color: #888;
  margin: 2rem 0;
}
.status-error {
  color: #c00;
}
.job-details {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #ddd;
}
.job-detail-item {
  margin-bottom: 1rem;
}
.job-detail-item h3 {
  margin: 0.5rem 0;
  font-size: 1.1rem;
  color: #333;
}
.job-detail-item ul {
  margin: 0.5rem 0;
  padding-left: 1.5rem;
}
.job-detail-item li {
  margin: 0.25rem 0;
}
</style> 