# CLI Commands for Adding System Charges

## Quick One-Liners

### Using Docker Compose (Local Development)

**Add a single charge:**
```bash
docker-compose exec db psql -U electricity_user -d electricity_prices -c "INSERT INTO system_charges (effective_date, country, charge_type, amount) VALUES ('2026-01-01', 'lt', 'VIAP', -0.00044) ON CONFLICT (effective_date, country, charge_type) DO UPDATE SET amount = EXCLUDED.amount;"
```

**Add multiple charges at once:**
```bash
docker-compose exec db psql -U electricity_user -d electricity_prices -c "INSERT INTO system_charges (effective_date, country, charge_type, amount) VALUES ('2026-01-01', 'lt', 'VIAP', -0.00044), ('2026-01-01', 'lt', 'distributionplus', 0.0002226) ON CONFLICT (effective_date, country, charge_type) DO UPDATE SET amount = EXCLUDED.amount;"
```

**Run your migration file:**
```bash
docker-compose exec -T db psql -U electricity_user -d electricity_prices < database/migrations/2026-07-01_example_new_charges.sql
```

### Using Direct psql Connection

If you have `psql` installed locally and database is exposed:

```bash
# Connect first
psql -h localhost -U electricity_user -d electricity_prices

# Then run SQL:
INSERT INTO system_charges (effective_date, country, charge_type, amount) VALUES
('2026-01-01', 'lt', 'VIAP', -0.00044),
('2026-01-01', 'lt', 'distributionplus', 0.0002226)
ON CONFLICT (effective_date, country, charge_type) 
DO UPDATE SET amount = EXCLUDED.amount;
```

### Using Docker Exec (If container name is different)

```bash
# Find container name
docker ps | grep postgres

# Execute SQL
docker exec -i electricity_db psql -U electricity_user -d electricity_prices -c "INSERT INTO system_charges (effective_date, country, charge_type, amount) VALUES ('2026-01-01', 'lt', 'VIAP', -0.00044) ON CONFLICT (effective_date, country, charge_type) DO UPDATE SET amount = EXCLUDED.amount;"
```

## Interactive psql Session

**Start interactive session:**
```bash
docker-compose exec db psql -U electricity_user -d electricity_prices
```

**Then run SQL commands:**
```sql
-- Add VIAP
INSERT INTO system_charges (effective_date, country, charge_type, amount) VALUES
('2026-01-01', 'lt', 'VIAP', -0.00044)
ON CONFLICT (effective_date, country, charge_type) 
DO UPDATE SET amount = EXCLUDED.amount;

-- Add distributionplus
INSERT INTO system_charges (effective_date, country, charge_type, amount) VALUES
('2026-01-01', 'lt', 'distributionplus', 0.0002226)
ON CONFLICT (effective_date, country, charge_type) 
DO UPDATE SET amount = EXCLUDED.amount;

-- Verify
SELECT effective_date, charge_type, amount 
FROM system_charges 
WHERE country = 'lt' 
ORDER BY effective_date DESC, charge_type;

-- Exit
\q
```

## For Production (Coolify)

If your database is on Coolify, you'll need to:

1. **Connect via Coolify's database management** (if available)
2. **Or use SSH tunnel:**
   ```bash
   # SSH into your server
   ssh user@your-server
   
   # Connect to database (adjust connection details)
   psql -h localhost -U electricity_user -d electricity_prices
   ```

3. **Or use environment variables:**
   ```bash
   # If DATABASE_URL is set in your environment
   psql $DATABASE_URL -c "INSERT INTO system_charges (effective_date, country, charge_type, amount) VALUES ('2026-01-01', 'lt', 'VIAP', -0.00044) ON CONFLICT (effective_date, country, charge_type) DO UPDATE SET amount = EXCLUDED.amount;"
   ```

## Verification Commands

**Check all charges (most reliable):**
```bash
docker-compose exec db psql -U electricity_user -d electricity_prices -c "SELECT effective_date, charge_type, amount FROM system_charges WHERE country = 'lt' ORDER BY effective_date DESC, charge_type;"
```

**Check charges for a specific effective date (exact match):**
```bash
docker-compose exec db psql -U electricity_user -d electricity_prices -c "SELECT effective_date::text, charge_type, amount FROM system_charges WHERE country = 'lt' AND effective_date = '2026-01-01'::date ORDER BY charge_type;"
```

**Check what charges apply for a specific target date (how API works):**
```bash
docker-compose exec db psql -U electricity_user -d electricity_prices -c "SELECT charge_type, amount, effective_date FROM system_charges WHERE country = 'lt' AND effective_date <= '2026-01-15'::date ORDER BY effective_date DESC;"
```

**Check latest charges (one per type):**
```bash
docker-compose exec db psql -U electricity_user -d electricity_prices -c "SELECT DISTINCT ON (charge_type) charge_type, amount, effective_date FROM system_charges WHERE country = 'lt' ORDER BY charge_type, effective_date DESC;"
```

**Check if specific charge exists:**
```bash
docker-compose exec db psql -U electricity_user -d electricity_prices -c "SELECT * FROM system_charges WHERE country = 'lt' AND charge_type = 'VIAP' ORDER BY effective_date DESC;"
```

**Count charges by date:**
```bash
docker-compose exec db psql -U electricity_user -d electricity_prices -c "SELECT effective_date, COUNT(*) as charge_count FROM system_charges WHERE country = 'lt' GROUP BY effective_date ORDER BY effective_date DESC;"
```

