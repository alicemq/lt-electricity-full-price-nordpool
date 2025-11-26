-- Electricity Prices Database Schema
-- Initialize tables for storing Elering API data and application settings

-- Price data table
CREATE TABLE IF NOT EXISTS price_data (
    id SERIAL PRIMARY KEY,
    timestamp BIGINT NOT NULL, -- Unix timestamp from Elering API
    price DECIMAL(10,6) NOT NULL, -- Price in EUR/MWh
    country VARCHAR(10) NOT NULL, -- Country code (lt, ee, lv, fi)
    date DATE NOT NULL, -- Date in CET/EET timezone (Europe/Vilnius) for efficient querying
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(timestamp, country) -- Ensure no duplicate timestamps per country
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_price_data_timestamp ON price_data(timestamp);
CREATE INDEX IF NOT EXISTS idx_price_data_country ON price_data(country);
CREATE INDEX IF NOT EXISTS idx_price_data_date ON price_data(date);
-- Note: Do not use to_timestamp in index expressions (not IMMUTABLE in PostgreSQL)

-- Settings table for user configurations
CREATE TABLE IF NOT EXISTS user_settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(100) NOT NULL UNIQUE,
    setting_value TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Data sync log table
CREATE TABLE IF NOT EXISTS sync_log (
    id SERIAL PRIMARY KEY,
    sync_type VARCHAR(50) NOT NULL, -- 'price_data', 'settings', etc.
    status VARCHAR(20) NOT NULL, -- 'success', 'error', 'partial'
    records_processed INTEGER DEFAULT 0,
    records_created INTEGER DEFAULT 0,
    records_updated INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    duration_ms INTEGER
);

-- Country sync status table - tracks per-country sync completion
CREATE TABLE IF NOT EXISTS country_sync_status (
    country VARCHAR(10) PRIMARY KEY,
    last_sync_ok_date DATE NOT NULL, -- Last date that was successfully synced
    last_sync_ok_timestamp BIGINT, -- Last timestamp that was successfully synced
    sync_ok BOOLEAN DEFAULT false, -- Flag indicating if sync is complete
    last_sync_at TIMESTAMP, -- When the last sync completed
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for country sync status
CREATE INDEX IF NOT EXISTS idx_country_sync_status_date ON country_sync_status(last_sync_ok_date);
CREATE INDEX IF NOT EXISTS idx_country_sync_status_ok ON country_sync_status(sync_ok);

-- Historical price configurations (comprehensive from original source)
CREATE TABLE IF NOT EXISTS price_configurations (
    id SERIAL PRIMARY KEY,
    effective_date DATE NOT NULL,
    country VARCHAR(10) NOT NULL DEFAULT 'lt',
    zone_name VARCHAR(50) NOT NULL,
    plan_name VARCHAR(50) NOT NULL,
    time_period VARCHAR(20) NOT NULL, -- 'morning', 'day', 'evening', 'night'
    price DECIMAL(10,6) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(effective_date, country, zone_name, plan_name, time_period)
);

-- System charges table
CREATE TABLE IF NOT EXISTS system_charges (
    id SERIAL PRIMARY KEY,
    effective_date DATE NOT NULL,
    country VARCHAR(10) NOT NULL DEFAULT 'lt',
    charge_type VARCHAR(50) NOT NULL, -- 'VIAP', 'distributionplus', etc.
    amount DECIMAL(10,6) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(effective_date, country, charge_type)
);

-- Plan versions table (from planVersionConfig.js)
CREATE TABLE IF NOT EXISTS plan_versions (
    id SERIAL PRIMARY KEY,
    effective_date DATE NOT NULL,
    country VARCHAR(10) NOT NULL DEFAULT 'lt',
    zone_name VARCHAR(50) NOT NULL,
    plan_name VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(effective_date, country, zone_name, plan_name)
);

-- Plan migrations table (from planVersionConfig.js)
CREATE TABLE IF NOT EXISTS plan_migrations (
    id SERIAL PRIMARY KEY,
    old_plan_name VARCHAR(50) NOT NULL,
    new_plan_name VARCHAR(50) NOT NULL,
    effective_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(old_plan_name, effective_date)
);

-- Time schedules table (from priceConfig.js)
CREATE TABLE IF NOT EXISTS time_schedules (
    id SERIAL PRIMARY KEY,
    country VARCHAR(10) NOT NULL DEFAULT 'lt',
    zone_name VARCHAR(50) NOT NULL,
    schedule_type VARCHAR(20) NOT NULL, -- 'alltime', 'wintertime', 'summertime'
    day_type VARCHAR(20) NOT NULL, -- 'mondayToFriday', 'weekend'
    hour_0 VARCHAR(20) NOT NULL, -- time period for hour 0
    hour_1 VARCHAR(20) NOT NULL,
    hour_2 VARCHAR(20) NOT NULL,
    hour_3 VARCHAR(20) NOT NULL,
    hour_4 VARCHAR(20) NOT NULL,
    hour_5 VARCHAR(20) NOT NULL,
    hour_6 VARCHAR(20) NOT NULL,
    hour_7 VARCHAR(20) NOT NULL,
    hour_8 VARCHAR(20) NOT NULL,
    hour_9 VARCHAR(20) NOT NULL,
    hour_10 VARCHAR(20) NOT NULL,
    hour_11 VARCHAR(20) NOT NULL,
    hour_12 VARCHAR(20) NOT NULL,
    hour_13 VARCHAR(20) NOT NULL,
    hour_14 VARCHAR(20) NOT NULL,
    hour_15 VARCHAR(20) NOT NULL,
    hour_16 VARCHAR(20) NOT NULL,
    hour_17 VARCHAR(20) NOT NULL,
    hour_18 VARCHAR(20) NOT NULL,
    hour_19 VARCHAR(20) NOT NULL,
    hour_20 VARCHAR(20) NOT NULL,
    hour_21 VARCHAR(20) NOT NULL,
    hour_22 VARCHAR(20) NOT NULL,
    hour_23 VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(country, zone_name, schedule_type, day_type)
);

-- Translations table for zones, plans, and other entities
CREATE TABLE IF NOT EXISTS translations (
    id SERIAL PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL, -- 'zone', 'plan', etc.
    entity_key VARCHAR(100) NOT NULL, -- The key/identifier (e.g., 'Four zones', 'Standart')
    locale VARCHAR(10) NOT NULL, -- 'lt', 'en', 'lv', 'ee', 'fi', 'ru', 'ua'
    translated_label VARCHAR(200) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(entity_type, entity_key, locale)
);

-- Create indexes for configuration tables
CREATE INDEX IF NOT EXISTS idx_price_config_date ON price_configurations(effective_date);
CREATE INDEX IF NOT EXISTS idx_price_config_zone ON price_configurations(zone_name);
CREATE INDEX IF NOT EXISTS idx_price_config_country ON price_configurations(country);
CREATE INDEX IF NOT EXISTS idx_system_charges_date ON system_charges(effective_date);
CREATE INDEX IF NOT EXISTS idx_system_charges_country ON system_charges(country);
CREATE INDEX IF NOT EXISTS idx_plan_versions_date ON plan_versions(effective_date);
CREATE INDEX IF NOT EXISTS idx_plan_versions_zone ON plan_versions(zone_name);
CREATE INDEX IF NOT EXISTS idx_plan_versions_country ON plan_versions(country);
CREATE INDEX IF NOT EXISTS idx_plan_migrations_date ON plan_migrations(effective_date);
CREATE INDEX IF NOT EXISTS idx_time_schedules_zone ON time_schedules(zone_name);
CREATE INDEX IF NOT EXISTS idx_time_schedules_country ON time_schedules(country);
CREATE INDEX IF NOT EXISTS idx_translations_entity ON translations(entity_type, entity_key);
CREATE INDEX IF NOT EXISTS idx_translations_locale ON translations(locale);

-- Insert default settings
INSERT INTO user_settings (setting_key, setting_value, description) VALUES
('default_zone', 'Four zones', 'Default time zone configuration'),
('default_plan', 'Standart', 'Default electricity plan'),
('default_vendor_margin', '0.02003', 'Default vendor margin in EUR'),
('default_vat_included', 'true', 'Whether VAT is included by default'),
('cheap_threshold', '20', 'Cheap price threshold in ct/kWh'),
('expensive_threshold', '50', 'Expensive price threshold in ct/kWh'),
('cheap_range_percent', '15', 'Cheap range percentage from average'),
('expensive_range_percent', '15', 'Expensive range percentage from average')
ON CONFLICT (setting_key) DO NOTHING;

-- Insert comprehensive price configurations from original source (2023-01-01)
INSERT INTO price_configurations (effective_date, country, zone_name, plan_name, time_period, price) VALUES
-- Four zones - Smart
('2023-01-01', 'lt', 'Four zones', 'Smart', 'morning', 0.06534),
('2023-01-01', 'lt', 'Four zones', 'Smart', 'day', 0.07986),
('2023-01-01', 'lt', 'Four zones', 'Smart', 'evening', 0.10648),
('2023-01-01', 'lt', 'Four zones', 'Smart', 'night', 0.05203),
-- Two zones - Standart
('2023-01-01', 'lt', 'Two zones', 'Standart', 'day', 0.09680),
('2023-01-01', 'lt', 'Two zones', 'Standart', 'night', 0.05687),
-- Two zones - Home
('2023-01-01', 'lt', 'Two zones', 'Home', 'day', 0.07865),
('2023-01-01', 'lt', 'Two zones', 'Home', 'night', 0.04719),
-- Two zones - Home plus
('2023-01-01', 'lt', 'Two zones', 'Home plus', 'day', 0.07381),
('2023-01-01', 'lt', 'Two zones', 'Home plus', 'night', 0.04477),
-- Single zone - Standart
('2023-01-01', 'lt', 'Single zone', 'Standart', 'day', 0.08470),
-- Single zone - Home
('2023-01-01', 'lt', 'Single zone', 'Home', 'day', 0.06897),
-- Single zone - Home plus
('2023-01-01', 'lt', 'Single zone', 'Home plus', 'day', 0.06534)
ON CONFLICT (effective_date, country, zone_name, plan_name, time_period) DO NOTHING;

-- Insert comprehensive price configurations from original source (2024-01-01)
INSERT INTO price_configurations (effective_date, country, zone_name, plan_name, time_period, price) VALUES
-- Four zones - Smart
('2024-01-01', 'lt', 'Four zones', 'Smart', 'morning', 0.07502),
('2024-01-01', 'lt', 'Four zones', 'Smart', 'day', 0.09438),
('2024-01-01', 'lt', 'Four zones', 'Smart', 'evening', 0.12826),
('2024-01-01', 'lt', 'Four zones', 'Smart', 'night', 0.05929),
-- Two zones - Standart
('2024-01-01', 'lt', 'Two zones', 'Standart', 'day', 0.11616),
('2024-01-01', 'lt', 'Two zones', 'Standart', 'night', 0.06534),
-- Two zones - Home
('2024-01-01', 'lt', 'Two zones', 'Home', 'day', 0.09801),
('2024-01-01', 'lt', 'Two zones', 'Home', 'night', 0.05566),
-- Two zones - Home plus
('2024-01-01', 'lt', 'Two zones', 'Home plus', 'day', 0.09317),
('2024-01-01', 'lt', 'Two zones', 'Home plus', 'night', 0.05324),
-- Single zone - Standart
('2024-01-01', 'lt', 'Single zone', 'Standart', 'day', 0.10043),
-- Single zone - Home
('2024-01-01', 'lt', 'Single zone', 'Home', 'day', 0.08470),
-- Single zone - Home plus
('2024-01-01', 'lt', 'Single zone', 'Home plus', 'day', 0.08107)
ON CONFLICT (effective_date, country, zone_name, plan_name, time_period) DO NOTHING;

-- Insert comprehensive price configurations from original source (2025-01-01)
INSERT INTO price_configurations (effective_date, country, zone_name, plan_name, time_period, price) VALUES
-- Four zones - Smart
('2025-01-01', 'lt', 'Four zones', 'Smart', 'morning', 0.07381),
('2025-01-01', 'lt', 'Four zones', 'Smart', 'day', 0.09317),
('2025-01-01', 'lt', 'Four zones', 'Smart', 'evening', 0.12947),
('2025-01-01', 'lt', 'Four zones', 'Smart', 'night', 0.05566),
-- Two zones - Standart
('2025-01-01', 'lt', 'Two zones', 'Standart', 'day', 0.11616),
('2025-01-01', 'lt', 'Two zones', 'Standart', 'night', 0.06292),
-- Two zones - Home
('2025-01-01', 'lt', 'Two zones', 'Home', 'day', 0.09801),
('2025-01-01', 'lt', 'Two zones', 'Home', 'night', 0.05324),
-- Two zones - Home plus
('2025-01-01', 'lt', 'Two zones', 'Home plus', 'day', 0.09317),
('2025-01-01', 'lt', 'Two zones', 'Home plus', 'night', 0.05082),
-- Single zone - Standart
('2025-01-01', 'lt', 'Single zone', 'Standart', 'day', 0.10043),
-- Single zone - Home
('2025-01-01', 'lt', 'Single zone', 'Home', 'day', 0.08470),
-- Single zone - Home plus
('2025-01-01', 'lt', 'Single zone', 'Home plus', 'day', 0.08107)
ON CONFLICT (effective_date, country, zone_name, plan_name, time_period) DO NOTHING;

-- Insert comprehensive price configurations from original source (2025-07-01)
INSERT INTO price_configurations (effective_date, country, zone_name, plan_name, time_period, price) VALUES
-- Four zones - Standart
('2025-07-01', 'lt', 'Four zones', 'Standart', 'morning', 0.07381),
('2025-07-01', 'lt', 'Four zones', 'Standart', 'day', 0.09317),
('2025-07-01', 'lt', 'Four zones', 'Standart', 'evening', 0.12947),
('2025-07-01', 'lt', 'Four zones', 'Standart', 'night', 0.05566),
-- Four zones - Effective
('2025-07-01', 'lt', 'Four zones', 'Effective', 'morning', 0.05687),
('2025-07-01', 'lt', 'Four zones', 'Effective', 'day', 0.07139),
('2025-07-01', 'lt', 'Four zones', 'Effective', 'evening', 0.10043),
('2025-07-01', 'lt', 'Four zones', 'Effective', 'night', 0.04356),
-- Two zones - Standart
('2025-07-01', 'lt', 'Two zones', 'Standart', 'day', 0.11616),
('2025-07-01', 'lt', 'Two zones', 'Standart', 'night', 0.06292),
-- Two zones - Home
('2025-07-01', 'lt', 'Two zones', 'Home', 'day', 0.09801),
('2025-07-01', 'lt', 'Two zones', 'Home', 'night', 0.05324),
-- Two zones - Effective
('2025-07-01', 'lt', 'Two zones', 'Effective', 'day', 0.08954),
('2025-07-01', 'lt', 'Two zones', 'Effective', 'night', 0.04840),
-- Single zone - Standart
('2025-07-01', 'lt', 'Single zone', 'Standart', 'day', 0.10043),
-- Single zone - Home
('2025-07-01', 'lt', 'Single zone', 'Home', 'day', 0.08470),
-- Single zone - Effective
('2025-07-01', 'lt', 'Single zone', 'Effective', 'day', 0.07744)
ON CONFLICT (effective_date, country, zone_name, plan_name, time_period) DO NOTHING;

-- Insert price configurations effective from 2026-01-01
INSERT INTO price_configurations (effective_date, country, zone_name, plan_name, time_period, price) VALUES
-- Four zones - Standart
('2026-01-01', 'lt', 'Four zones', 'Standart', 'morning', 0.08349),
('2026-01-01', 'lt', 'Four zones', 'Standart', 'day', 0.10406),
('2026-01-01', 'lt', 'Four zones', 'Standart', 'evening', 0.14641),
('2026-01-01', 'lt', 'Four zones', 'Standart', 'night', 0.06292),
-- Four zones - Effective
('2026-01-01', 'lt', 'Four zones', 'Effective', 'morning', 0.06534),
('2026-01-01', 'lt', 'Four zones', 'Effective', 'day', 0.08228),
('2026-01-01', 'lt', 'Four zones', 'Effective', 'evening', 0.11374),
('2026-01-01', 'lt', 'Four zones', 'Effective', 'night', 0.05082),
-- Two zones - Standart
('2026-01-01', 'lt', 'Two zones', 'Standart', 'day', 0.12947),
('2026-01-01', 'lt', 'Two zones', 'Standart', 'night', 0.07139),
-- Two zones - Effective
('2026-01-01', 'lt', 'Two zones', 'Effective', 'day', 0.10164),
('2026-01-01', 'lt', 'Two zones', 'Effective', 'night', 0.05687),
-- Two zones - Home
('2026-01-01', 'lt', 'Two zones', 'Home', 'day', 0.11011),
('2026-01-01', 'lt', 'Two zones', 'Home', 'night', 0.06171),
-- Single zone - Standart
('2026-01-01', 'lt', 'Single zone', 'Standart', 'day', 0.11132),
-- Single zone - Effective
('2026-01-01', 'lt', 'Single zone', 'Effective', 'day', 0.08833),
-- Single zone - Home
('2026-01-01', 'lt', 'Single zone', 'Home', 'day', 0.09559)
ON CONFLICT (effective_date, country, zone_name, plan_name, time_period) DO UPDATE
SET price = EXCLUDED.price;

-- Insert initial system charges
INSERT INTO system_charges (effective_date, country, charge_type, amount) VALUES
('2024-01-01', 'lt', 'VIAP', 0.00),
('2024-01-01', 'lt', 'distributionplus', 0.00045),
('2025-01-01', 'lt', 'VIAP', -0.00039),
('2025-01-01', 'lt', 'distributionplus', 0.000893)
ON CONFLICT (effective_date, country, charge_type) DO NOTHING; 

-- Insert plan versions (from planVersionConfig.js)
INSERT INTO plan_versions (effective_date, country, zone_name, plan_name) VALUES
-- 2023-01-01
('2023-01-01', 'lt', 'Four zones', 'Smart'),
('2023-01-01', 'lt', 'Two zones', 'Standart'),
('2023-01-01', 'lt', 'Two zones', 'Home'),
('2023-01-01', 'lt', 'Two zones', 'Home plus'),
('2023-01-01', 'lt', 'Single zone', 'Standart'),
('2023-01-01', 'lt', 'Single zone', 'Home'),
('2023-01-01', 'lt', 'Single zone', 'Home plus'),
-- 2025-01-01
('2025-01-01', 'lt', 'Four zones', 'Smart'),
('2025-01-01', 'lt', 'Two zones', 'Standart'),
('2025-01-01', 'lt', 'Two zones', 'Home'),
('2025-01-01', 'lt', 'Two zones', 'Home plus'),
('2025-01-01', 'lt', 'Single zone', 'Standart'),
('2025-01-01', 'lt', 'Single zone', 'Home'),
('2025-01-01', 'lt', 'Single zone', 'Home plus'),
-- 2025-07-01
('2025-07-01', 'lt', 'Four zones', 'Standart'),
('2025-07-01', 'lt', 'Four zones', 'Effective'),
('2025-07-01', 'lt', 'Two zones', 'Standart'),
('2025-07-01', 'lt', 'Two zones', 'Home'),
('2025-07-01', 'lt', 'Two zones', 'Effective'),
('2025-07-01', 'lt', 'Single zone', 'Standart'),
('2025-07-01', 'lt', 'Single zone', 'Home'),
('2025-07-01', 'lt', 'Single zone', 'Effective'),
-- 2026-01-01
('2026-01-01', 'lt', 'Four zones', 'Standart'),
('2026-01-01', 'lt', 'Four zones', 'Effective'),
('2026-01-01', 'lt', 'Two zones', 'Standart'),
('2026-01-01', 'lt', 'Two zones', 'Effective'),
('2026-01-01', 'lt', 'Two zones', 'Home'),
('2026-01-01', 'lt', 'Single zone', 'Standart'),
('2026-01-01', 'lt', 'Single zone', 'Effective'),
('2026-01-01', 'lt', 'Single zone', 'Home')
ON CONFLICT (effective_date, country, zone_name, plan_name) DO NOTHING;

-- Insert plan migrations (from planVersionConfig.js)
INSERT INTO plan_migrations (old_plan_name, new_plan_name, effective_date) VALUES
('Smart', 'Standart', '2025-07-01'),
('Home plus', 'Home', '2025-07-01')
ON CONFLICT (old_plan_name, effective_date) DO NOTHING;

-- Insert time schedules (from priceConfig.js)
INSERT INTO time_schedules (country, zone_name, schedule_type, day_type, hour_0, hour_1, hour_2, hour_3, hour_4, hour_5, hour_6, hour_7, hour_8, hour_9, hour_10, hour_11, hour_12, hour_13, hour_14, hour_15, hour_16, hour_17, hour_18, hour_19, hour_20, hour_21, hour_22, hour_23) VALUES
-- Four zones - alltime - mondayToFriday
('lt', 'Four zones', 'alltime', 'mondayToFriday', 'night', 'night', 'night', 'night', 'night', 'morning', 'morning', 'day', 'day', 'day', 'day', 'day', 'day', 'day', 'day', 'day', 'day', 'evening', 'evening', 'evening', 'evening', 'evening', 'night', 'night'),
-- Four zones - alltime - weekend
('lt', 'Four zones', 'alltime', 'weekend', 'night', 'night', 'night', 'night', 'night', 'night', 'night', 'day', 'day', 'day', 'day', 'day', 'day', 'day', 'day', 'day', 'day', 'day', 'day', 'day', 'day', 'day', 'night', 'night'),
-- Two zones - wintertime - mondayToFriday
('lt', 'Two zones', 'wintertime', 'mondayToFriday', 'night', 'night', 'night', 'night', 'night', 'night', 'night', 'day', 'day', 'day', 'day', 'day', 'day', 'day', 'day', 'day', 'day', 'day', 'day', 'day', 'day', 'day', 'night'),
-- Two zones - wintertime - weekend
('lt', 'Two zones', 'wintertime', 'weekend', 'night', 'night', 'night', 'night', 'night', 'night', 'night', 'night', 'night', 'night', 'night', 'night', 'night', 'night', 'night', 'night', 'night', 'night', 'night', 'night', 'night', 'night', 'night'),
-- Two zones - summertime - mondayToFriday
('lt', 'Two zones', 'summertime', 'mondayToFriday', 'night', 'night', 'night', 'night', 'night', 'night', 'night', 'night', 'day', 'day', 'day', 'day', 'day', 'day', 'day', 'day', 'day', 'day', 'day', 'day', 'day', 'day', 'day', 'day'),
-- Two zones - summertime - weekend
('lt', 'Two zones', 'summertime', 'weekend', 'night', 'night', 'night', 'night', 'night', 'night', 'night', 'night', 'night', 'night', 'night', 'night', 'night', 'night', 'night', 'night', 'night', 'night', 'night', 'night', 'night', 'night', 'night'),
-- Single zone - alltime - mondayToFriday
('lt', 'Single zone', 'alltime', 'mondayToFriday', 'day', 'day', 'day', 'day', 'day', 'day', 'day', 'day', 'day', 'day', 'day', 'day', 'day', 'day', 'day', 'day', 'day', 'day', 'day', 'day', 'day', 'day', 'day', 'day'),
-- Single zone - alltime - weekend
('lt', 'Single zone', 'alltime', 'weekend', 'day', 'day', 'day', 'day', 'day', 'day', 'day', 'day', 'day', 'day', 'day', 'day', 'day', 'day', 'day', 'day', 'day', 'day', 'day', 'day', 'day', 'day', 'day', 'day')
ON CONFLICT (country, zone_name, schedule_type, day_type) DO NOTHING;

-- Insert zone translations
INSERT INTO translations (entity_type, entity_key, locale, translated_label) VALUES
-- Zones
('zone', 'Four zones', 'en', 'Four zones'),
('zone', 'Four zones', 'lt', 'Keturių zonų'),
('zone', 'Two zones', 'en', 'Two zones'),
('zone', 'Two zones', 'lt', 'Dviejų zonų'),
('zone', 'Single zone', 'en', 'Single zone'),
('zone', 'Single zone', 'lt', 'Vienos zonos'),
-- Plans
('plan', 'Standart', 'en', 'Standard'),
('plan', 'Standart', 'lt', 'Standartinis'),
('plan', 'Smart', 'en', 'Smart'),
('plan', 'Smart', 'lt', 'Protingas'),
('plan', 'Home', 'en', 'Home'),
('plan', 'Home', 'lt', 'Namų'),
('plan', 'Home plus', 'en', 'Home Plus'),
('plan', 'Home plus', 'lt', 'Namų plius'),
('plan', 'Effective', 'en', 'Effective'),
('plan', 'Effective', 'lt', 'Efektyvus')
ON CONFLICT (entity_type, entity_key, locale) DO UPDATE
SET translated_label = EXCLUDED.translated_label,
    updated_at = CURRENT_TIMESTAMP;
