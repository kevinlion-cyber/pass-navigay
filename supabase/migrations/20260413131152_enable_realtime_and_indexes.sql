/*
  # Enable Realtime on messages and add indexes

  1. Changes
    - Enable Realtime on messages table for live DMs
    - Add indexes for frequently queried columns
    - Add index on establishments for geo/category filtering
    - Add index on messages for conversation queries
    - Add index on events for date queries
*/

ALTER PUBLICATION supabase_realtime ADD TABLE messages;

CREATE INDEX IF NOT EXISTS idx_establishments_category ON establishments(category);
CREATE INDEX IF NOT EXISTS idx_establishments_city ON establishments(city);
CREATE INDEX IF NOT EXISTS idx_establishments_owner ON establishments(owner_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_establishment ON events(establishment_id);
CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_establishment ON reviews(establishment_id);
CREATE INDEX IF NOT EXISTS idx_promotions_establishment ON promotions(establishment_id);
