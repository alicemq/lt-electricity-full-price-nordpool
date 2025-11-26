# API Documentation

## Overview

The Electricity Prices NordPool API provides access to electricity price data for Baltic countries (Lithuania, Estonia, Latvia, Finland) with comprehensive sync management capabilities.

## Base URL

### Production
```
http://localhost/api/v1/
```

### Development
```
http://localhost:3000/api/v1/
```

## Authentication

Currently, the API does not require authentication for public endpoints.

## Data Sync Management

### Sync Status
Get the current status of the sync worker and last run times.

```http
GET /api/sync/status
```

**Response:**
```json
{
  "status": "running",
  "lastRun": "2024-12-19T10:30:00Z",
  "nextRun": "2024-12-19T11:00:00Z",
  "countries": ["lt", "ee", "lv", "fi"],
  "scheduledJobs": [
    {
      "name": "daily-sync",
      "schedule": "0 6 * * *",
      "lastRun": "2024-12-19T06:00:00Z",
      "nextRun": "2024-12-20T06:00:00Z"
    }
  ]
}
```

### Manual Sync Trigger
Trigger a manual sync for specified countries and days.

```http
POST /api/sync/trigger
Content-Type: application/json

{
  "country": "lt",
  "days": 1
}
```

**Parameters:**
- `country` (string, optional): Country code (`lt`, `ee`, `lv`, `fi`). If omitted, returns data for all countries (where supported).
- `days` (number, required): Number of days to sync (1-30)

**Response:**
```json
{
  "success": true,
  "message": "Sync triggered successfully",
  "recordsProcessed": 672,
  "processingTime": 478,
  "countries": ["lt", "ee", "lv", "fi"]
}
```

### Historical Data Sync
Sync historical data for a specific date range.

```http
POST /api/sync/historical
Content-Type: application/json

{
  "country": "lt",
  "startDate": "2024-01-01",
  "endDate": "2024-12-31"
}
```

**Parameters:**
- `country` (string, required): Country code (`lt`, `ee`, `lv`, `fi`, `all`)
- `startDate` (string, required): Start date in YYYY-MM-DD format
- `endDate` (string, required): End date in YYYY-MM-DD format

**Response:**
```json
{
  "success": true,
  "message": "Historical sync completed",
  "recordsProcessed": 8760,
  "processingTime": 5240,
  "dateRange": "2024-01-01 to 2024-12-31"
}
```

### Year Data Sync
Sync all data for a specific year.

```http
POST /api/sync/year
Content-Type: application/json

{
  "country": "lt",
  "year": 2024
}
```

**Parameters:**
- `country` (string, required): Country code (`lt`, `ee`, `lv`, `fi`, `all`)
- `year` (number, required): Year to sync (2012-present)

**Response:**
```json
{
  "success": true,
  "message": "Year sync completed",
  "recordsProcessed": 8760,
  "processingTime": 5240,
  "year": 2024
}
```

### All Historical Data Sync
Sync all available historical data for a country.

```http
POST /api/sync/all-historical
Content-Type: application/json

{
  "country": "lt"
}
```

**Parameters:**
- `country` (string, required): Country code (`lt`, `ee`, `lv`, `fi`, `all`)

**Response:**
```json
{
  "success": true,
  "message": "All historical sync completed",
  "recordsProcessed": 87600,
  "processingTime": 52400,
  "dateRange": "2012-07-01 to 2024-12-19"
}
```

## Price Data Endpoints

### Get Prices for Single Date
Retrieve electricity prices for a specific date.
Returns one record per market time unit (MTU), which MAY be either 60-minute (legacy data) or 15-minute (new MTU) depending on the source data for that day.

```http
GET /api/v1/nps/prices/{date}
```

**Parameters:**
- `date` (string, required): Date in YYYY-MM-DD format

**Response:**
```json
{
  "date": "2024-12-19",
  "prices": [
    {
      "hour": 0,
      "lt": 45.23,
      "ee": 42.15,
      "lv": 44.78,
      "fi": 41.92
    },
    {
      "hour": 1,
      "lt": 43.87,
      "ee": 41.23,
      "lv": 43.45,
      "fi": 40.78
    }
  ]
}
```

### Get Prices for Date Range
Retrieve electricity prices for a date range.
Each date in the range returns one record per MTU (hourly or 15-minute), rather than assuming a fixed 24 records per day.

```http
GET /api/v1/nps/prices/{startDate}/{endDate}
```

**Parameters:**
- `startDate` (string, required): Start date in YYYY-MM-DD format
- `endDate` (string, required): End date in YYYY-MM-DD format

**Response:**
```json
{
  "startDate": "2024-12-19",
  "endDate": "2024-12-20",
  "prices": [
    {
      "date": "2024-12-19",
      "prices": [
        {
          "hour": 0,
          "lt": 45.23,
          "ee": 42.15,
          "lv": 44.78,
          "fi": 41.92
        }
      ]
    }
  ]
}
```

### Get Latest Price for Country
Get the latest available price for a specific country (latest MTU up to now, independent of whether the underlying data is hourly or 15-minute).

```http
GET /api/v1/nps/price/{country}/latest
```

**Parameters:**
- `country` (string, required): Country code (`lt`, `ee`, `lv`, `fi`)

**Response:**
```json
{
  "country": "lt",
  "price": 45.23,
  "timestamp": "2024-12-19T10:00:00Z",
  "hour": 10
}
```

### Get Current Interval Price
Get the price for the **current MTU interval** (for example, the current 15‑minute slot once Nord Pool 15-minute MTU is in effect).

### Get Upcoming Prices
Retrieve upcoming electricity prices from the current MTU to the end of today and tomorrow (Europe/Vilnius timezone).

```http
GET /api/v1/nps/prices/upcoming?country={country}
```

**Parameters:**
- `country` (string, optional): Country code (`lt`, `ee`, `lv`, `fi`), defaults to `lt`.

**Response:**
```json
{
  "success": true,
  "data": {
    "lt": [
      { "timestamp": 1750932000, "price": 75.0 },
      { "timestamp": 1750932900, "price": 68.5 }
    ]
  },
  "meta": {
    "country": "lt",
    "count": 2,
    "timezone": "Europe/Vilnius",
    "intervalSeconds": 900,
    "current_time_local": "2025-06-26 12:07:00",
    "date_range": {
      "start": "2025-06-26",
      "end": "2025-06-27"
    }
  }
}
```

```http
GET /api/v1/nps/price/{country}/current
```

**Parameters:**
- `country` (string, required): Country code (`lt`, `ee`, `lv`, `fi`)

**Response:**
```json
{
  "country": "lt",
  "price": 45.23,
  "timestamp": "2024-12-19T10:00:00Z",
  "hour": 10,
  "isCurrent": true
}
```

### Get Latest Prices for All Countries
Get the latest prices for all countries.

```http
GET /api/v1/nps/price/ALL/latest
```

**Response:**
```json
{
  "timestamp": "2024-12-19T10:00:00Z",
  "prices": {
    "lt": 45.23,
    "ee": 42.15,
    "lv": 44.78,
    "fi": 41.92
  }
}
```

### Get Current Hour Prices for All Countries
Get the current hour prices for all countries.

```http
GET /api/v1/nps/price/ALL/current
```

**Response:**
```json
{
  "timestamp": "2024-12-19T10:00:00Z",
  "prices": {
    "lt": 45.23,
    "ee": 42.15,
    "lv": 44.78,
    "fi": 41.92
  },
  "isCurrent": true
}
```

## System Endpoints

### Health Check
Check the health status of the API.

```http
GET /api/v1/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-12-19T10:30:00Z",
  "version": "2.0.0",
  "services": {
    "database": "connected",
    "sync": "running"
  }
}
```

### Get Available Countries
Get list of available countries.

```http
GET /api/v1/countries
```

**Response:**
```json
{
  "countries": [
    {
      "code": "lt",
      "name": "Lithuania"
    },
    {
      "code": "ee",
      "name": "Estonia"
    },
    {
      "code": "lv",
      "name": "Latvia"
    },
    {
      "code": "fi",
      "name": "Finland"
    }
  ]
}
```

### Get Latest Available Prices
Get the latest available prices for all countries.

```http
GET /api/v1/latest
```

**Response:**
```json
{
  "timestamp": "2024-12-19T10:00:00Z",
  "prices": {
    "lt": 45.23,
    "ee": 42.15,
    "lv": 44.78,
    "fi": 41.92
  }
}
```

## CLI Commands

The system includes comprehensive CLI commands for sync management. These can be run inside the backend container:

### Sync All Countries
```bash
npm run cli all <days>
```

**Example:**
```bash
npm run cli all 7
```

### Historical Sync
```bash
npm run cli historical <country> <startDate> <endDate>
```

**Example:**
```bash
npm run cli historical lt 2024-01-01 2024-12-31
```

### Year Sync
```bash
npm run cli year <year> <country>
```

**Example:**
```bash
npm run cli year 2024 lt
```

### All Historical Sync
```bash
npm run cli all-historical <country>
```

**Example:**
```bash
npm run cli all-historical lt
```

### Test Sync Functionality
```bash
npm run cli test
```

### Check Sync Status
```bash
npm run cli status
```

## Error Handling

All endpoints return appropriate HTTP status codes and error messages:

### Error Response Format
```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "timestamp": "2024-12-19T10:30:00Z"
}
```

### Common Error Codes
- `400` - Bad Request (invalid parameters)
- `404` - Not Found (data not available)
- `500` - Internal Server Error (server error)
- `503` - Service Unavailable (sync in progress)

## Rate Limiting

Currently, no rate limiting is implemented. Consider implementing rate limiting for production use.

## CORS

CORS is properly configured for cross-origin requests in production mode.

## Data Format

### Timestamps
All timestamps are in ISO 8601 format with UTC timezone.

### Prices
Prices are in EUR/MWh and represent the electricity price for each hour.

### Country Codes
- `lt` - Lithuania
- `ee` - Estonia
- `lv` - Latvia
- `fi` - Finland
- `all` - All countries (for sync operations)

## Interactive Documentation

For interactive API documentation and testing, visit:
- **Production**: http://localhost/api/
- **Development**: http://localhost:5173/api/

The Swagger UI provides a complete interactive interface for testing all endpoints.

## Technology Stack

### Backend
- **Node.js**: 20 (LTS)
- **Express**: 4.18.2
- **PostgreSQL**: 17 (Database)
- **node-cron**: 3.0.3 (Scheduling)
- **axios**: 1.6.0 (HTTP client)
- **pg**: 8.11.3 (PostgreSQL client)

### Frontend
- **Vue.js**: 3.5.17
- **Vite**: 7.0.0 (Build tool)
- **Nginx**: stable-alpine (Production proxy)

### Infrastructure
- **Docker**: Containerized deployment
- **Swagger UI**: Interactive API documentation

---

**API Version**: 2.0.0  
**Last Updated**: December 19, 2024 