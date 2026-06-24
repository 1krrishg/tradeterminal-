-- Add origin_country to tariff_rates for origin-specific duties (Section 301, anti-dumping)
-- NULL origin_country = applies to ALL origins (Section 232, MFN retaliations)
-- Non-null origin_country = applies only when shipment comes from that country

ALTER TABLE tariff_rates ADD COLUMN IF NOT EXISTS origin_country TEXT DEFAULT NULL;
ALTER TABLE tariff_rates ADD COLUMN IF NOT EXISTS origin_code TEXT DEFAULT NULL;

-- Drop old unique constraint and create new one that includes origin_country
-- NULL = all origins, so (hs_code, destination_country, NULL) is one row
ALTER TABLE tariff_rates DROP CONSTRAINT IF EXISTS tariff_rates_hs_code_destination_country_key;
ALTER TABLE tariff_rates DROP CONSTRAINT IF EXISTS tariff_rates_pkey;

-- New unique index: (hs_code, destination_country, origin_country) with NULLS NOT DISTINCT
-- so two NULLs in origin_country are treated as equal (one global row per hs+dest)
CREATE UNIQUE INDEX IF NOT EXISTS tariff_rates_corridor_key
  ON tariff_rates (hs_code, destination_country, origin_country)
  NULLS NOT DISTINCT;
