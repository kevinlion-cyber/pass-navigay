export interface Profile {
  id: string;
  username: string;
  avatar_url: string | null;
  bio: string;
  is_premium: boolean;
  is_admin: boolean;
  premium_expires_at: string | null;
  stripe_customer_id: string | null;
  theme: 'dark' | 'light';
  show_onboarding: boolean;
  show_disclaimer: boolean;
  favorite_categories: string[];
  last_active_at: string;
  created_at: string;
}

export interface Establishment {
  id: string;
  owner_id: string;
  name: string;
  address: string;
  city: string;
  postal_code: string;
  latitude: number;
  longitude: number;
  category: CategoryKey;
  subcategory: string;
  description: string;
  phone: string;
  website: string;
  is_pro: boolean;
  pro_expires_at: string | null;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  banner_url: string | null;
  logo_url: string | null;
  is_sponsor: boolean;
  is_verified: boolean;
  created_at: string;
  avg_rating?: number;
  review_count?: number;
}

export interface EstablishmentPhoto {
  id: string;
  establishment_id: string;
  url: string;
  caption: string;
  order_index: number;
  created_at: string;
}

export interface Event {
  id: string;
  establishment_id: string;
  title: string;
  description: string;
  event_date: string;
  end_date: string | null;
  address: string;
  latitude: number | null;
  longitude: number | null;
  theme: string;
  price: number;
  is_free: boolean;
  image_url: string | null;
  is_featured: boolean;
  created_at: string;
  establishment?: Establishment;
}

export interface Promotion {
  id: string;
  establishment_id: string;
  title: string;
  description: string;
  promo_type: 'percentage' | 'fixed' | 'offer';
  value: number | null;
  image_url: string | null;
  valid_from: string;
  valid_until: string;
  is_recurring: boolean;
  recurrence_rule: string;
  max_uses: number | null;
  current_uses: number;
  created_at: string;
  establishment?: Establishment;
}

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
  sender?: Profile;
  receiver?: Profile;
}

export interface Favorite {
  id: string;
  user_id: string;
  establishment_id: string;
  created_at: string;
  establishment?: Establishment;
}

export interface Review {
  id: string;
  user_id: string;
  establishment_id: string;
  rating: number;
  comment: string;
  created_at: string;
  user?: Profile;
}

export type CategoryKey = 'se_loger' | 'shopping' | 'manger' | 'soiree' | 'bien_etre' | 'culture';

export interface ConversationPreview {
  userId: string;
  username: string;
  avatar_url: string | null;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}
