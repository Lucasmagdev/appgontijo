ALTER TABLE computers
  ADD COLUMN imei VARCHAR(30) NULL AFTER name;

CREATE INDEX idx_computers_imei ON computers (imei);
