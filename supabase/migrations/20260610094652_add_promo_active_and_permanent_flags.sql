-- Add is_active flag to promotions for enable/disable toggle
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- Add is_permanent flag for promotions without dates
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS is_permanent boolean DEFAULT false;
