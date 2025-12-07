# Database Migrations

This directory contains SQL migration scripts for updating the database with new tax rates, charges, and price configurations.

## Automatic Migration Execution

**Migrations are automatically executed on application startup.** The backend service runs all pending migration files from this directory in alphabetical order (by filename). Executed migrations are tracked in a `migrations` table to prevent re-execution.

### How It Works

1. On backend startup, the migration runner:
   - Creates a `migrations` table if it doesn't exist
   - Scans `database/migrations/` for `.sql` files
   - Compares against executed migrations
   - Executes pending migrations in alphabetical order (use date prefixes: `YYYY-MM-DD_description.sql`)
   - Records each executed migration

2. **Migration files are mounted as a volume** in `docker-compose.yml`, so you can add new migration files without rebuilding the container.

3. **To add a new migration:**
   - Create a new `.sql` file in this directory with a date prefix (e.g., `2026-01-15_new_viap_rate.sql`)
   - Restart the backend service: `docker-compose restart backend`
   - The migration will run automatically on startup

### Manual Execution (Optional)

If you prefer to run migrations manually, see the sections below.

## How to Add New VIAP and Other Tax Changes

### Understanding Effective Dates

The system uses `effective_date` to determine which charges apply. When calculating prices for a specific date, it selects the **latest** charge where `effective_date <= target_date`.

**Example:**
- If you have charges for `2024-01-01` and `2025-01-01`
- For date `2024-06-15`: Uses `2024-01-01` charges
- For date `2025-06-15`: Uses `2025-01-01` charges

### Adding New System Charges

Create a new migration file following this pattern: `YYYY-MM-DD_description.sql`

**Example: `2026-07-01_new_viap_rates.sql`**

```sql
-- Migration: Update VIAP and distributionplus rates effective 2026-07-01
-- Date: 2026-07-01
-- Description: New VIAP rate and updated distributionplus charge

-- Insert new VIAP rate
INSERT INTO system_charges (effective_date, country, charge_type, amount) VALUES
('2026-07-01', 'lt', 'VIAP', 0.00123)  -- Example: new VIAP rate
ON CONFLICT (effective_date, country, charge_type) 
DO UPDATE SET amount = EXCLUDED.amount;

-- Insert new distributionplus rate
INSERT INTO system_charges (effective_date, country, charge_type, amount) VALUES
('2026-07-01', 'lt', 'distributionplus', 0.00150)  -- Example: new distributionplus rate
ON CONFLICT (effective_date, country, charge_type) 
DO UPDATE SET amount = EXCLUDED.amount;

-- Add other charge types as needed
-- INSERT INTO system_charges (effective_date, country, charge_type, amount) VALUES
-- ('2026-07-01', 'lt', 'new_charge_type', 0.00050)
-- ON CONFLICT (effective_date, country, charge_type) 
-- DO UPDATE SET amount = EXCLUDED.amount;
```

### Adding New Price Configurations

If you also need to update tariff prices:

```sql
-- Example: Update price configurations for 2026-07-01
INSERT INTO price_configurations (effective_date, country, zone_name, plan_name, time_period, price) VALUES
('2026-07-01', 'lt', 'Four zones', 'Standart', 'morning', 0.08500),
('2026-07-01', 'lt', 'Four zones', 'Standart', 'day', 0.10500),
('2026-07-01', 'lt', 'Four zones', 'Standart', 'evening', 0.15000),
('2026-07-01', 'lt', 'Four zones', 'Standart', 'night', 0.06500)
ON CONFLICT (effective_date, country, zone_name, plan_name, time_period) 
DO UPDATE SET price = EXCLUDED.price;
```

## How to Apply Migrations

### Option 1: Direct SQL Execution (Recommended for Production)

1. **Connect to your database:**
   ```bash
   # Using docker-compose
   docker-compose exec db psql -U electricity_user -d electricity_prices
   
   # Or using connection string
   psql $DATABASE_URL
   ```

2. **Run the migration:**
   ```sql
   \i database/migrations/2026-07-01_new_viap_rates.sql
   ```

### Option 2: Using Docker Exec

```bash
# Copy migration file into container
docker cp database/migrations/2026-07-01_new_viap_rates.sql <container_id>:/tmp/migration.sql

# Execute migration
docker-compose exec db psql -U electricity_user -d electricity_prices -f /tmp/migration.sql
```

### Option 3: Update Schema File (For New Deployments)

If you want new charges to be included in fresh database setups, add them to `database/init/01_schema.sql`:

```sql
-- In database/init/01_schema.sql, add to the system_charges INSERT section:
INSERT INTO system_charges (effective_date, country, charge_type, amount) VALUES
-- ... existing charges ...
('2026-07-01', 'lt', 'VIAP', 0.00123),
('2026-07-01', 'lt', 'distributionplus', 0.00150)
ON CONFLICT (effective_date, country, charge_type) DO UPDATE
SET amount = EXCLUDED.amount;
```

**Note:** The schema file uses `DO NOTHING` to prevent overwriting existing data. Use `DO UPDATE` if you want to allow updates.

## Verification

After applying a migration, verify the data:

```sql
-- Check all system charges for Lithuania
SELECT effective_date, charge_type, amount 
FROM system_charges 
WHERE country = 'lt' 
ORDER BY effective_date DESC, charge_type;

-- Check charges for a specific date
SELECT charge_type, amount 
FROM system_charges 
WHERE country = 'lt' 
  AND effective_date <= '2026-07-15'
ORDER BY effective_date DESC;
```

## Important Notes

1. **Effective Date Format:** Always use `YYYY-MM-DD` format
2. **Charge Types:** Use consistent naming (e.g., `VIAP`, `distributionplus` - case-sensitive)
3. **Amounts:** Stored as `DECIMAL(10,6)` - supports values like `0.00123`
4. **Conflict Handling:** Use `DO UPDATE` if you want to allow updating existing records
5. **Multiple Countries:** Add charges for other countries (EE, LV, FI) as needed:
   ```sql
   INSERT INTO system_charges (effective_date, country, charge_type, amount) VALUES
   ('2026-07-01', 'ee', 'VIAP', 0.00100),
   ('2026-07-01', 'lv', 'VIAP', 0.00120);
   ```

