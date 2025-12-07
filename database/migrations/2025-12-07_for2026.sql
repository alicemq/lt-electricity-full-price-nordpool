INSERT INTO system_charges (effective_date, country, charge_type, amount) VALUES
('2026-01-01', 'lt', 'VIAP', -0.00044) 
ON CONFLICT (effective_date, country, charge_type) 
DO UPDATE SET amount = EXCLUDED.amount;

-- Insert new distributionplus rate
INSERT INTO system_charges (effective_date, country, charge_type, amount) VALUES
('2026-01-01', 'lt', 'distributionplus', 0.0002226) 
ON CONFLICT (effective_date, country, charge_type) 
DO UPDATE SET amount = EXCLUDED.amount;
