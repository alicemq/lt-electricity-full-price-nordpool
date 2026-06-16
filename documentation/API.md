# API Documentation

## Overview

The Electricity Prices NordPool API provides access to electricity price data for Baltic countries (Lithuania, Estonia, Latvia, Finland) with comprehensive sync management capabilities.

**OpenAPI source of truth:** `swagger-ui/openapi.yaml` (JSON generated in CI). Interactive docs: `/api/` via the frontend proxy (`/docs` redirects to `/api/` in nginx and Vite dev).

**Contract lint:** CI runs Spectral `spectral:oas` against `swagger-ui/openapi.yaml` (see `.spectral.yaml`). Structure samples: `tests/contract/openapi-samples.test.js` (every public path in `tests/contract/public-paths.js`); live response shapes: `tests/contract/live-api-samples.test.js` (integration CI with `CONTRACT_FIXTURE=1`).

**Contract PR gate:** Every PR runs OpenAPI structure samples, JSON sync, route parity, and Spectral in `.github/workflows/ci.yml` (`lint-and-unit`). Live contract samples run in `.github/workflows/ci-integration.yml` when backend or contract tests change. See [docs/checklists/ua-testing.md](../docs/checklists/ua-testing.md#contract-pr-gate-ua3).

**Legacy compatibility:** Unversioned `/api/*` paths forward to `/api/v1/*` with deprecation headers. See [legacy-api.md](./legacy-api.md).

## Base URL

### Production
```
https://your-host/api/v1/
```

### Development
```
http://localhost:3000/api/v1/
```

## Authentication

Currently, the API does not require authentication for public endpoints.

## Data Sync Management

All sync endpoints are mounted at `/api/v1/sync/*`. Legacy `/api/sync/*` URLs still work via the deprecation shim.

### Sync Status
Get the current status of the sync worker and scheduled jobs.

```http
GET /api/v1/sync/status
```

**Response:**
```json
{
  "success": true,
  "data": {
    "isRunning": false,
    "scheduledJobs": [],
    "syncInProgress": false
  }
}
```

### Manual Sync Trigger
Trigger a manual sync for one country or a catch-up sync for all countries.

```http
POST /api/v1/sync/trigger
Content-Type: application/json

{
  "country": "lt",
  "daysBack": 1
}
```

**Parameters:**
- `country` (string, optional): Country code (`lt`, `ee`, `lv`, `fi`). Omit for catch-up sync.
- `daysBack` (number, optional): Days to sync when `country` is set (default: 1)

### Historical Data Sync
```http
POST /api/v1/sync/historical
Content-Type: application/json

{
  "country": "lt",
  "startDate": "2024-01-01",
  "endDate": "2024-12-31"
}
```

### Year Data Sync
```http
POST /api/v1/sync/year
Content-Type: application/json

{
  "country": "lt",
  "year": 2024
}
```

### All Historical Data Sync
```http
POST /api/v1/sync/all-historical
Content-Type: application/json

{
  "country": "lt"
}
```

## Price Data Endpoints

Price queries use **query parameters**, not path segments. Primary data comes from the background sync worker; when the database is empty or incomplete for a requested date, `GET /nps/prices` may perform a one-time backup fetch from the Elering API before responding.

### Get Prices for Single Date
```http
GET /api/v1/nps/prices?date=2024-12-19&country=lt
```

**Parameters:**
- `date` (string): Date in `YYYY-MM-DD` format (use with single-day queries)
- `start` / `end` (string): Date range (both required together)
- `country` (string, optional): `lt`, `ee`, `lv`, or `fi`. Omit for all countries.

**Response:**
```json
{
  "success": true,
  "data": {
    "lt": [
      { "timestamp": 1750885200, "price": 75.0 }
    ]
  },
  "meta": {
    "date": "2024-12-19",
    "country": "lt",
    "count": 24,
    "timezone": "Europe/Vilnius",
    "intervalSeconds": 3600
  }
}
```

### Get Prices for Date Range
```http
GET /api/v1/nps/prices?start=2024-12-01&end=2024-12-31&country=ee
```

### Get Latest Price for Country
```http
GET /api/v1/nps/price/lt/latest
```

**Parameters:**
- `country` (path): `lt`, `ee`, `lv`, `fi`, or `all`

### Get Current Interval Price
```http
GET /api/v1/nps/price/lt/current
```

Returns the latest available market time unit (MTU) up to "now" in Europe/Vilnius.

### Get Upcoming Prices
```http
GET /api/v1/nps/prices/upcoming?country=lt
```

Returns slots from the current MTU through end of today and tomorrow.

### Get Latest Prices for All Countries
```http
GET /api/v1/nps/price/all/latest
```

### Get Current Interval Prices for All Countries
```http
GET /api/v1/nps/price/all/current
```

## System Endpoints

### Health Check
```http
GET /api/v1/health
```

Also available at root `GET /health` for container liveness (slimmer payload).

### Get Available Countries
```http
GET /api/v1/countries
```

**Response:**
```json
{
  "success": true,
  "data": [
    { "code": "lt", "name": "Lithuania" },
    { "code": "ee", "name": "Estonia" },
    { "code": "lv", "name": "Latvia" },
    { "code": "fi", "name": "Finland" }
  ]
}
```

### Get Latest Available Prices (legacy)
```http
GET /api/v1/latest?country=lt
```

Deprecated; prefer `/api/v1/nps/price/{country}/latest`.

## CLI Commands

Sync management CLI commands run inside the backend container. See `backend/package.json` scripts and OpenAPI `/sync/*` POST endpoints for HTTP equivalents.

## Error Handling

```json
{
  "success": false,
  "error": "Human-readable message",
  "code": "NO_DATA_FOUND"
}
```

Common HTTP status codes: `400`, `404`, `409` (sync already running), `500`.

## Interactive Documentation

- **Production**: `https://your-host/api/`
- **Development**: `http://localhost:5173/api/`

Swagger UI loads `openapi.yaml` through the frontend proxy at `/api/v1` server URL.

---

**Contract version:** OpenAPI `info.version` in `swagger-ui/openapi.yaml`
