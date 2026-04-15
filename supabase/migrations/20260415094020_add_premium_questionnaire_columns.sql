/*
  # Add Premium Questionnaire Columns to Profiles

  1. New Columns on `profiles`
    - `prenom` (text) - First name
    - `nom` (text) - Last name
    - `phone` (text) - Phone number
    - `gender_identity` (text) - Gender identity
    - `pronouns` (text) - Preferred pronouns
    - `attracted_to` (text[]) - Who they're attracted to
    - `orientation` (text) - Sexual orientation
    - `looking_for` (text[]) - What they're looking for
    - `relationship_intensity` (text) - Relationship intensity preference
    - `vibe` (text) - Personal vibe
    - `evening_energy` (text) - Evening energy type
    - `green_flags` (text[]) - Green flags in others
    - `red_flags` (text[]) - Red flags in others
    - `community_involvement` (text) - Community involvement level
    - `community_goals` (text[]) - Community goals
    - `ideal_type` (text) - Ideal type description
    - `deal_breaker` (text) - Deal breaker
    - `what_i_bring` (text) - What they bring to a relationship
    - `if_i_were_vibe` (text) - Fun question: if I were a vibe
    - `if_i_were_music` (text) - Fun question: if I were music
    - `if_i_were_energy` (text) - Fun question: if I were energy
    - `late_truth` (text) - A late truth about them
    - `questionnaire_completed` (boolean) - Whether questionnaire is completed
    - `profile_visibility` (jsonb) - Visibility settings per field

  2. Notes
    - All columns are optional (nullable)
    - Uses IF NOT EXISTS to be safe for re-runs
    - Default visibility settings provided for profile_visibility
*/

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS prenom text,
ADD COLUMN IF NOT EXISTS nom text,
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS gender_identity text,
ADD COLUMN IF NOT EXISTS pronouns text,
ADD COLUMN IF NOT EXISTS attracted_to text[],
ADD COLUMN IF NOT EXISTS orientation text,
ADD COLUMN IF NOT EXISTS looking_for text[],
ADD COLUMN IF NOT EXISTS relationship_intensity text,
ADD COLUMN IF NOT EXISTS vibe text,
ADD COLUMN IF NOT EXISTS evening_energy text,
ADD COLUMN IF NOT EXISTS green_flags text[],
ADD COLUMN IF NOT EXISTS red_flags text[],
ADD COLUMN IF NOT EXISTS community_involvement text,
ADD COLUMN IF NOT EXISTS community_goals text[],
ADD COLUMN IF NOT EXISTS ideal_type text,
ADD COLUMN IF NOT EXISTS deal_breaker text,
ADD COLUMN IF NOT EXISTS what_i_bring text,
ADD COLUMN IF NOT EXISTS if_i_were_vibe text,
ADD COLUMN IF NOT EXISTS if_i_were_music text,
ADD COLUMN IF NOT EXISTS if_i_were_energy text,
ADD COLUMN IF NOT EXISTS late_truth text,
ADD COLUMN IF NOT EXISTS questionnaire_completed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS profile_visibility jsonb DEFAULT '{"gender_identity": true, "pronouns": true, "orientation": false, "looking_for": false, "vibe": true}'::jsonb;
