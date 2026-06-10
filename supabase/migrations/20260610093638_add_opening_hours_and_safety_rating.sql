-- Opening hours JSON column for establishments
ALTER TABLE establishments ADD COLUMN IF NOT EXISTS opening_hours jsonb DEFAULT '{}';

-- Safety rating (shield) on reviews, alongside existing quality rating
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS safety_rating integer DEFAULT NULL;

-- Profile visibility preferences: extend from limited fields to all questionnaire fields
-- The existing profile_visibility column already exists as jsonb, we just need more fields
-- No schema change needed since it's already a flexible jsonb column

-- Add a comment for clarity
COMMENT ON COLUMN establishments.opening_hours IS 'JSON object with days as keys (lundi, mardi, ...) and {open, close} or null for closed';
COMMENT ON COLUMN reviews.safety_rating IS 'Safety/safe-place rating from 1 to 5 (shield icon)';
