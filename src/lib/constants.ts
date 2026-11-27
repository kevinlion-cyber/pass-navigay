import type { CategoryKey } from './types';

// Catégories et sous-catégories (refonte du 27/11/2026, validée par Kévin) : noms à touche
// LGBT pour les catégories, noms clairs pour les sous-catégories (filtres et Google).
// Ces valeurs servent de secours : la liste en ligne est celle d'Admin → Catégories
// (app_settings.categories_config), initialisée avec celle-ci par la migration 79.
// Les clés (se_loger, manger…) ne changent jamais : adresses des pages et icônes en dépendent.
export const CATEGORIES: Record<CategoryKey, { label: string; subcategories: string[] }> = {
  se_loger: {
    label: "Dormir safe",
    subcategories: ["Maison d'hôtes", "Hôtel", "Location entre particuliers", "Gîte", "Camping", "Auberge de jeunesse"],
  },
  manger: {
    label: "Se régaler",
    subcategories: ["Restaurant", "Brunch", "Café", "Salon de thé", "Fast-food", "Boulangerie & pâtisserie", "Traiteur"],
  },
  soiree: {
    label: "Sortir & faire la fête",
    subcategories: ["Bar gay", "Bar lesbien", "Bar queer & inclusif", "Bar chill", "Bar musical", "Bar à cocktails", "Bar à vins", "Club & boîte de nuit", "Cabaret & drag", "Karaoké"],
  },
  shopping: {
    label: "Shopping & pépites",
    subcategories: ["Mode & vêtements", "Friperie & seconde main", "Chaussures", "Bijoux & accessoires", "Déco & maison", "Art & créateurs", "Librairie", "Fleuriste", "Jeux"],
  },
  bien_etre: {
    label: "Prendre soin de soi",
    subcategories: ["Spa & hammam", "Sauna", "Massage", "Esthétique", "Coiffure & barbier"],
  },
  culture: {
    label: "Culture & spectacles",
    subcategories: ["Musée", "Galerie d'art", "Théâtre", "Cinéma", "Concert & spectacle", "Visite guidée", "Festival", "Autres"],
  },
  communaute: {
    label: "Communauté & santé",
    subcategories: ["Centre LGBT", "Association", "Santé sexuelle & dépistage", "Écoute & soutien"],
  },
  services: {
    label: "Pros safe",
    subcategories: ["Tatouage & piercing", "Photographe", "Avocat & juriste", "Psy & thérapeute", "Agence voyage & mariage", "Autres services"],
  },
  sport: {
    label: "Sport & plein air",
    subcategories: ["Club sportif LGBT", "Salle de sport", "Danse", "Yoga", "Escalade", "Plage", "Plage naturiste", "Rando & nature"],
  },
  adulte: {
    label: "Coquin 18+",
    subcategories: ["Sauna gay", "Sex-shop & lingerie", "Bar cruising & fetish", "Club sexe & backroom", "Club libertin", "Cinéma adulte"],
  },
};

export const CATEGORY_KEYS = Object.keys(CATEGORIES) as CategoryKey[];

export const DEFAULT_CENTER = { lat: 43.6119, lng: 3.8767 };

export const PAGE_SIZE = 20;
