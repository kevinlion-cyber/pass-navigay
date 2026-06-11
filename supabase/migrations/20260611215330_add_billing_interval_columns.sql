-- Add billing interval tracking for premium users and pro establishments
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS premium_billing_interval text DEFAULT 'yearly';
ALTER TABLE establishments ADD COLUMN IF NOT EXISTS pro_billing_interval text DEFAULT 'yearly';