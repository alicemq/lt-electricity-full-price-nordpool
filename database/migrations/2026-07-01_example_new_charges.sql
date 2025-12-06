-- Migration: Example - New VIAP and tax rates
-- Date: 2026-07-01
-- Description: Template for adding new system charges
-- 
-- INSTRUCTIONS:
-- 1. Update the effective_date to your target date
-- 2. Update the charge amounts with actual values
-- 3. Add or remove charge types as needed
-- 4. Run this script against your database

-- Insert new VIAP rate
INSERT INTO system_charges (effective_date, country, charge_type, amount) VALUES
('2026-01-01', 'lt', 'VIAP', -0.00044) 
ON CONFLICT (effective_date, country, charge_type) 
DO UPDATE SET amount = EXCLUDED.amount;

-- Insert new distributionplus rate
INSERT INTO system_charges (effective_date, country, charge_type, amount) VALUES
('2026-01-01', 'lt', 'distributionplus', 0.0002226)
ON CONFLICT (effective_date, country, charge_type) 
DO UPDATE SET amount = EXCLUDED.amount;

-- Add other charge types as needed (uncomment and update):
-- INSERT INTO system_charges (effective_date, country, charge_type, amount) VALUES
-- ('2026-07-01', 'lt', 'new_charge_type', 0.00050)
-- ON CONFLICT (effective_date, country, charge_type) 
-- DO UPDATE SET amount = EXCLUDED.amount;

-- For other countries (uncomment and update as needed):
-- INSERT INTO system_charges (effective_date, country, charge_type, amount) VALUES
-- ('2026-07-01', 'ee', 'VIAP', 0.00100),
-- ('2026-07-01', 'ee', 'distributionplus', 0.00120),
-- ('2026-07-01', 'lv', 'VIAP', 0.00110),
-- ('2026-07-01', 'lv', 'distributionplus', 0.00130)
-- ON CONFLICT (effective_date, country, charge_type) 
-- DO UPDATE SET amount = EXCLUDED.amount;

