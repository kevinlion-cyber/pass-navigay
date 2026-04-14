import type { CategoryKey } from './types';

export const CATEGORIES: Record<CategoryKey, { label: string; subcategories: string[] }> = {
  se_loger: {
    label: 'Se loger',
    subcategories: ["Maison d'hotes", 'Hotel', 'Location particuliere'],
  },
  shopping: {
    label: 'Shopping',
    subcategories: ['Vetements', 'Deco', 'Art', 'Chaussures', 'Sex-shop', 'Jeux'],
  },
  manger: {
    label: 'Manger',
    subcategories: ['Restaurant', 'Fast-food', 'Brunch', 'Salon de the', 'Bar a vins'],
  },
  soiree: {
    label: 'Soiree',
    subcategories: ['Bar tranquille', 'Bar musical', 'Boite de nuit'],
  },
  bien_etre: {
    label: 'Bien-etre',
    subcategories: ['Sauna', 'Massage', 'Esthetique'],
  },
  culture: {
    label: 'Culture',
    subcategories: ['Musee', 'Visite guidee', 'Concert', 'Cinema', 'Autres'],
  },
};

export const CATEGORY_KEYS = Object.keys(CATEGORIES) as CategoryKey[];

export const DEFAULT_CENTER = { lat: 43.6119, lng: 3.8767 };

export const PAGE_SIZE = 20;
