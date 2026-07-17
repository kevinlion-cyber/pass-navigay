export interface ProfileVisibility {
  gender_identity?: boolean;
  pronouns?: boolean;
  orientation?: boolean;
  looking_for?: boolean;
  vibe?: boolean;
  evening_energy?: boolean;
  green_flags?: boolean;
  what_i_bring?: boolean;
  if_i_were_vibe?: boolean;
  if_i_were_music?: boolean;
  late_truth?: boolean;
}

export interface OpeningHours {
  [day: string]: { open: string; close: string } | null;
}

export interface Profile {
  id: string;
  username: string;
  email: string | null;
  is_verified: boolean;
  premium_billing_interval: string | null;
  avatar_url: string | null;
  gallery_urls?: string[];
  bio: string;
  notify_messages?: boolean;
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
  prenom: string | null;
  nom: string | null;
  phone: string | null;
  gender_identity: string | null;
  pronouns: string | null;
  attracted_to: string[] | null;
  orientation: string | null;
  looking_for: string[] | null;
  relationship_intensity: string | null;
  vibe: string | null;
  evening_energy: string | null;
  green_flags: string[] | null;
  red_flags: string[] | null;
  community_involvement: string | null;
  community_goals: string[] | null;
  ideal_type: string | null;
  deal_breaker: string | null;
  what_i_bring: string | null;
  if_i_were_vibe: string | null;
  if_i_were_music: string | null;
  if_i_were_energy: string | null;
  late_truth: string | null;
  questionnaire_completed: boolean;
  profile_visibility: ProfileVisibility;
  city: string | null;
  account_type: string;
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
  opening_hours: OpeningHours | null;
  price_level?: number | null;
  amenities?: string[] | null;
  avg_rating?: number;
  review_count?: number;
  avg_safety_rating?: number;
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
  max_capacity: number | null;
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
  is_active: boolean;
  is_permanent: boolean;
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
  safety_rating: number | null;
  comment: string;
  created_at: string;
  reply: string | null;
  reply_at: string | null;
  user?: { username: string; avatar_url: string | null };
}

// Cles « historiques » conservees pour l'autocompletion ; (string & {}) autorise
// les categories ajoutees dynamiquement par l'admin (A1).
export type CategoryKey = 'se_loger' | 'shopping' | 'manger' | 'soiree' | 'bien_etre' | 'culture' | (string & {});

export interface ConversationPreview {
  userId: string;
  username: string;
  avatar_url: string | null;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}
