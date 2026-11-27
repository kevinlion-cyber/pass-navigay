import { useState } from 'react';
import { X, Upload, Loader2, FileJson, ImageIcon, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { geocodeFirst } from '../../lib/geocode';
import { useCategories } from '../../contexts/CategoriesContext';
import { lireFiche, slugVille, type FicheLue } from '../../lib/importFiche';

/**
 * Import d'une fiche préparée avec l'assistant « Créateur de fiches » pendant un
 * rendez-vous avec le gérant (décision de Kévin, 27/11/2026). On sélectionne d'un coup
 * fiche.json et ses images ; la fiche arrive dans « Fiches auto », prête à publier.
 * Rien n'est public tant qu'elle n'est pas publiée.
 */
interface Props {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}

const MAX_IMAGE = 8 * 1024 * 1024;

export default function ImportFicheModal({ open, onClose, onDone }: Props) {
  const { categoryKeys } = useCategories();
  const [fiche, setFiche] = useState<FicheLue | null>(null);
  const [images, setImages] = useState<Map<string, File>>(new Map());
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  if (!open) return null;

  const fermer = () => {
    setFiche(null);
    setImages(new Map());
    setErreur(null);
    onClose();
  };

  const choisir = async (liste: FileList | null) => {
    setErreur(null);
    setFiche(null);
    if (!liste?.length) return;
    const fichiers = Array.from(liste);
    const json = fichiers.find((f) => f.name.toLowerCase().endsWith('.json'));
    const imgs = new Map<string, File>();
    for (const f of fichiers) {
      if (/\.(jpe?g|png|webp)$/i.test(f.name)) imgs.set(f.name.toLowerCase(), f);
    }
    setImages(imgs);
    if (!json) {
      setErreur('Sélectionnez aussi le fichier fiche.json (en même temps que les images).');
      return;
    }
    try {
      const lue = lireFiche(await json.text(), categoryKeys);
      const manquantes = [lue.bandeau, lue.logo, ...lue.galerie].filter((n): n is string => !!n && !imgs.has(n.toLowerCase()));
      if (manquantes.length) throw new Error(`Image(s) annoncée(s) dans la fiche mais non sélectionnée(s) : ${manquantes.join(', ')}`);
      const tropLourdes = [...imgs.values()].filter((f) => f.size > MAX_IMAGE).map((f) => f.name);
      if (tropLourdes.length) throw new Error(`Image(s) de plus de 8 Mo : ${tropLourdes.join(', ')}`);
      setFiche(lue);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Fiche illisible.');
    }
  };

  const importer = async () => {
    if (!fiche) return;
    setEnvoi(true);
    try {
      const id = crypto.randomUUID();
      const dossier = `fiches-entretien/${id}`;
      const envoyer = async (nom: string) => {
        const f = images.get(nom.toLowerCase())!;
        const chemin = `${dossier}/${nom.replace(/[^\w.-]+/g, '-')}`;
        const { error } = await supabase.storage.from('site-assets').upload(chemin, f, { contentType: f.type || 'image/jpeg', upsert: false });
        if (error) throw new Error(`Envoi de ${nom} impossible : ${error.message}`);
        return supabase.storage.from('site-assets').getPublicUrl(chemin).data.publicUrl;
      };
      const bandeau = await envoyer(fiche.bandeau);
      const galerie: string[] = [];
      for (const g of fiche.galerie) galerie.push(await envoyer(g));
      const logo = fiche.logo ? await envoyer(fiche.logo) : null;

      let { latitude, longitude } = fiche;
      if (latitude == null || longitude == null) {
        const c = await geocodeFirst(`${fiche.adresse}, ${fiche.code_postal} ${fiche.ville}`.trim());
        if (c) [longitude, latitude] = c;
      }

      // Ville de rattachement : celle de l'annuaire si elle existe déjà, sinon une nouvelle.
      const { data: villes } = await supabase.from('public_city_list').select('city_slug, city');
      const cible = slugVille(fiche.ville);
      const connue = (villes || []).find((v: { city_slug: string; city: string }) => v.city_slug === cible || slugVille(v.city || '') === cible);

      const { error } = await supabase.from('establishment_drafts').insert({
        place_id: `entretien:${id}`,
        name: fiche.nom,
        address: fiche.adresse,
        city: fiche.ville,
        postal_code: fiche.code_postal,
        latitude,
        longitude,
        phone: fiche.telephone,
        website: fiche.site_web,
        category: fiche.categorie,
        city_slug: connue?.city_slug ?? cible,
        discovery_query: 'entretien avec le gérant',
        ai_description: fiche.description,
        ai_subcategory: fiche.sous_categorie,
        ai_tags: fiche.mots_cles,
        ai_model: 'entretien',
        ai_generated_at: new Date().toISOString(),
        amenities: fiche.equipements,
        opening_hours: fiche.horaires,
        price_level: fiche.niveau_prix,
        thumb_url: bandeau,
        photo_urls: [bandeau, ...galerie],
        logo_url: logo,
        raw: fiche.infos,
        status: 'enriched',
      });
      if (error) throw error;
      toast.success('Fiche importée : elle attend votre publication');
      onDone();
      fermer();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Import impossible.');
    }
    setEnvoi(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60" onClick={fermer}>
      <div
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-card bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={fermer} aria-label="Fermer" className="absolute right-3 top-3 p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white">
          <X size={18} />
        </button>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Importer une fiche (entretien)</h2>
        <p className="text-sm text-gray-500">
          Sélectionnez <strong>en une fois</strong> le fichier <code>fiche.json</code> et toutes ses images (bandeau, logo,
          galerie) préparés par l'assistant « Créateur de fiches ».
        </p>

        <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-light-border dark:border-dark-border rounded-card py-6 cursor-pointer hover:border-primary transition-colors">
          <Upload size={22} className="text-primary" />
          <span className="text-sm text-gray-600 dark:text-gray-300">Choisir la fiche et les images</span>
          <input type="file" multiple accept=".json,application/json,image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => choisir(e.target.files)} />
        </label>

        {erreur && (
          <p className="flex items-start gap-2 text-sm text-alert"><AlertTriangle size={16} className="shrink-0 mt-0.5" />{erreur}</p>
        )}

        {fiche && (
          <div className="rounded-card border border-light-border dark:border-dark-border p-4 space-y-2 text-sm">
            <p className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white"><FileJson size={16} className="text-primary" />{fiche.nom}</p>
            <p className="text-gray-500">{fiche.adresse}, {fiche.code_postal} {fiche.ville}</p>
            <p className="text-gray-500">{fiche.categorie}{fiche.sous_categorie ? ` · ${fiche.sous_categorie}` : ''}</p>
            <p className="flex items-center gap-2 text-gray-500">
              <ImageIcon size={14} /> Bandeau{fiche.logo ? ' + logo' : ''} + {fiche.galerie.length} photo(s) de galerie
            </p>
            {fiche.avertissements.map((a) => <p key={a} className="text-xs text-amber-600">{a}</p>)}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={fermer} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-900 dark:hover:text-white">Annuler</button>
          <button onClick={importer} disabled={!fiche || envoi} className="btn-primary text-sm flex items-center gap-2 disabled:opacity-50">
            {envoi ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} Importer la fiche
          </button>
        </div>
      </div>
    </div>
  );
}
