/*
  # Create messages, favorites, and reviews tables

  1. New Tables
    - `messages` - Direct messages between users
      - `id` (uuid, primary key)
      - `sender_id`, `receiver_id` (uuid, references profiles)
      - `content` (text)
      - `is_read` (boolean)
      - `created_at` (timestamptz)

    - `favorites` - User establishment favorites
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `establishment_id` (uuid, references establishments)
      - Unique constraint on (user_id, establishment_id)

    - `reviews` - User reviews for establishments
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `establishment_id` (uuid, references establishments)
      - `rating` (int, 1-5)
      - `comment` (text)
      - Unique constraint on (user_id, establishment_id)

  2. Security
    - Enable RLS on all tables
    - Messages: only sender and receiver can read
    - Favorites: users manage their own
    - Reviews: public read, users manage their own
*/

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid REFERENCES profiles(id),
  receiver_id uuid REFERENCES profiles(id),
  content text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own messages"
  ON messages FOR SELECT
  TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can send messages"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Receivers can mark messages as read"
  ON messages FOR UPDATE
  TO authenticated
  USING (auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = receiver_id);

CREATE TABLE IF NOT EXISTS favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id),
  establishment_id uuid REFERENCES establishments(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, establishment_id)
);

ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own favorites"
  ON favorites FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can add favorites"
  ON favorites FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove favorites"
  ON favorites FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id),
  establishment_id uuid REFERENCES establishments(id),
  rating int CHECK (rating BETWEEN 1 AND 5),
  comment text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, establishment_id)
);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view reviews"
  ON reviews FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anon can view reviews"
  ON reviews FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Users can insert their own reviews"
  ON reviews FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reviews"
  ON reviews FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reviews"
  ON reviews FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
