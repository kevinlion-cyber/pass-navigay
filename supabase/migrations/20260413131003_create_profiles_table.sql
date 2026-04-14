/*
  # Create profiles table

  1. New Tables
    - `profiles` - User profiles extending auth.users
      - `id` (uuid, primary key, references auth.users)
      - `username` (text, unique)
      - `avatar_url` (text)
      - `bio` (text)
      - `is_premium` (boolean, default false)
      - `is_admin` (boolean, default false)
      - `premium_expires_at` (timestamptz)
      - `stripe_customer_id` (text)
      - `theme` (text, default 'dark')
      - `show_onboarding` (boolean, default true)
      - `show_disclaimer` (boolean, default true)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `profiles`
    - Public read access for authenticated users
    - Users can only update their own profile
    - Users can insert their own profile
*/

CREATE TABLE IF NOT EXISTS profiles (
  id uuid REFERENCES auth.users PRIMARY KEY,
  username text UNIQUE NOT NULL,
  avatar_url text,
  bio text DEFAULT '',
  is_premium boolean DEFAULT false,
  is_admin boolean DEFAULT false,
  premium_expires_at timestamptz,
  stripe_customer_id text,
  theme text DEFAULT 'dark',
  show_onboarding boolean DEFAULT true,
  show_disclaimer boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can delete their own profile"
  ON profiles FOR DELETE
  TO authenticated
  USING (auth.uid() = id);
