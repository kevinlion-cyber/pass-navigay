import { useCallback, useEffect, useRef, useState } from 'react';
import { CalendarCheck, Upload, Check, X, Pencil, ExternalLink, Loader2, RefreshCw, MapPin, Ticket, Store } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { geocodeFirst } from '../../lib/geocode';
import { lireFichierImport, normaliser, jourParis, type ResultatLecture } from '../../lib/importEvenements';

/**
 * Événements à valider (décision de Kévin, 26/11/2026).
 *
 * Chaque semaine, une tâche planifiée de Claude recense les événements LGBT et
 * LGBT-friendly de l'Hérault et fournit un fichier. On le dépose ici (« Importer ») :
 * les événements arrivent en attente. Rien n'est publié sans un clic « Publier ».
 * Un événement rejeté n'est plus reproposé (clé anti-doublon conservée en base).
 */

type Statut = 'pending' | 'published' | 'rejected';
interface Brouillon {
  id: string;
  status: Statut;
  title: string;
  description: string;
  event_date: string;
  end_date: string | null;
  venue_name: string | null;
  address: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  theme: string | null;
  is_free: boolean;
  price: number;
  source_url: string | null;
  source_name: string | null;
  ticket_url: string | null;
  lgbt_reason: string | null;
  establishment_id: string | null;
  published_event_id: string | null;
  establishment: { name: string; city: string | null } | null;
}

const ONGLETS: { key: Statut; label: string }[] = [
  { key: 'pending', label: 'En attente' },
  { key: 'published', label: 'Publiés' },
  { key: 'rejected', label: 'Rejetés' },
];

const fmt = (d: string) =>
  new Date(d).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });

/** Valeur d'un champ <input type="datetime-local"> à l'heure de Paris. */
const versChamp = (iso: string | null) => {
  if (!iso) return '';
  const p = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  return p.replace(' ', 'T');
};
const depuisChamp = (v: string) => (v ? new Date(v).toISOString() : null);

export default function AdminEventDrafts() {
  const { user } = useAuth();
  const [onglet, setOnglet] = useState<Statut>('pending');
  const [items, setItems] = useState<Brouillon[]>([]);
  const [enAttente, setEnAttente] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [edition, setEdition] = useState<Record<string, Partial<Brouillon>>>({});
  const [importEnCours, setImportEnCours] = useState(false);
  const [bilan, setBilan] = useState<{ ajoutes: number; dejaConnus: number; ecartes: ResultatLecture['ecartes'] } | null>(null);
  const fichierRef = useRef<HTMLInputElement>(null);

  const charger = useCallback(async () => {
    setLoading(true);
    const [{ data, error }, { count }] = await Promise.all([
      supabase
        .from('event_drafts')
        .select('*, establishment:establishments(name, city)')
        .eq('status', onglet)
        .order('event_date', { ascending: onglet === 'pending' })
        .limit(300),
      supabase.from('event_drafts').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    ]);
    if (error) toast.error('Les événements à valider n’ont pas pu être chargés.');
    setItems((data as Brouillon[]) || []);
    setEnAttente(count || 0);
    setLoading(false);
  }, [onglet]);

  useEffect(() => { charger(); }, [charger]);

  // ── Import du fichier hebdomadaire ───────────────────────────────────────────
  const importer = async (fichier: File) => {
    setImportEnCours(true);
    setBilan(null);
    try {
      if (fichier.size > 2_000_000) throw new Error('Fichier trop lourd (2 Mo maximum).');
      const { valides, ecartes } = lireFichierImport(await fichier.text());

      // Déjà dans l'agenda ? (même titre, même jour) : on ne le repropose pas.
      let dejaConnus = 0;
      let aGarder = valides;
      if (valides.length) {
        const dates = valides.map((v) => v.event_date).sort();
        const debut = new Date(new Date(dates[0]).getTime() - 86_400_000).toISOString();
        const fin = new Date(new Date(dates[dates.length - 1]).getTime() + 86_400_000).toISOString();
        const { data: existants } = await supabase.from('events').select('title, event_date').gte('event_date', debut).lte('event_date', fin);
        const connus = new Set((existants || []).map((e) => `${normaliser(e.title)}|${jourParis(e.event_date)}`));
        aGarder = valides.filter((v) => {
          const deja = connus.has(`${normaliser(v.title)}|${jourParis(v.event_date)}`);
          if (deja) dejaConnus += 1;
          return !deja;
        });
      }

      // Rattachement à un établissement de l'annuaire, seulement s'il n'y a qu'une
      // correspondance possible (sinon l'admin choisira à la main).
      const lignes = [];
      for (const v of aGarder) {
        let establishment_id: string | null = null;
        if (v.etablissement_nom) {
          const { data: cand } = await supabase
            .from('establishments')
            .select('id')
            .ilike('name', v.etablissement_nom.replace(/[%_]/g, ''))
            .ilike('city', `%${v.city.replace(/[%_]/g, '')}%`)
            .limit(2);
          if (cand && cand.length === 1) establishment_id = cand[0].id;
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { etablissement_nom, ...ligne } = v;
        lignes.push({ ...ligne, establishment_id, import_batch: fichier.name.slice(0, 120) });
      }

      let ajoutes = 0;
      if (lignes.length) {
        const { data, error } = await supabase
          .from('event_drafts')
          .upsert(lignes, { onConflict: 'dedupe_key', ignoreDuplicates: true })
          .select('id');
        if (error) throw error;
        ajoutes = data?.length || 0;
        dejaConnus += lignes.length - ajoutes;
      }
      setBilan({ ajoutes, dejaConnus, ecartes });
      toast.success(`${ajoutes} événement${ajoutes > 1 ? 's' : ''} ajouté${ajoutes > 1 ? 's' : ''} à valider`);
      setOnglet('pending');
      await charger();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import impossible.');
    }
    setImportEnCours(false);
    if (fichierRef.current) fichierRef.current.value = '';
  };

  // ── Décisions ────────────────────────────────────────────────────────────────
  const valeur = <K extends keyof Brouillon>(b: Brouillon, k: K): Brouillon[K] =>
    (edition[b.id]?.[k] as Brouillon[K] | undefined) ?? b[k];
  const fermerEdition = (id: string) =>
    setEdition((e) => {
      const reste = { ...e };
      delete reste[id];
      return reste;
    });
  const modifier = (id: string, patch: Partial<Brouillon>) =>
    setEdition((e) => ({ ...e, [id]: { ...e[id], ...patch } }));

  const publier = async (b: Brouillon) => {
    setBusyId(b.id);
    try {
      const d = { ...b, ...edition[b.id] };
      if (!d.title?.trim() || !d.event_date) throw new Error('Titre et date de début obligatoires.');
      const adresse = [d.venue_name, d.address, d.city].filter(Boolean).join(', ');
      let lat = d.latitude;
      let lng = d.longitude;
      if ((lat == null || lng == null) && adresse) {
        const c = await geocodeFirst(adresse);
        if (c) [lng, lat] = c;
      }
      const { data: ev, error } = await supabase
        .from('events')
        .insert({
          title: d.title.trim(),
          description: d.description || '',
          theme: d.theme || '',
          establishment_id: d.establishment_id,
          event_date: d.event_date,
          end_date: d.end_date,
          address: adresse || null,
          custom_city: d.establishment_id ? null : d.city,
          latitude: lat,
          longitude: lng,
          is_free: d.is_free,
          price: d.is_free ? 0 : d.price,
          image_url: null,
          source_url: d.source_url,
          source_name: d.source_name,
          ticket_url: d.ticket_url,
        })
        .select('id')
        .single();
      if (error) throw error;
      const { error: e2 } = await supabase
        .from('event_drafts')
        .update({ ...edition[b.id], status: 'published', published_event_id: ev.id, decided_at: new Date().toISOString(), decided_by: user?.id ?? null })
        .eq('id', b.id);
      if (e2) throw e2;
      toast.success('Événement publié dans l’agenda');
      fermerEdition(b.id);
      await charger();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Publication impossible.');
    }
    setBusyId(null);
  };

  const rejeter = async (b: Brouillon) => {
    setBusyId(b.id);
    const { error } = await supabase
      .from('event_drafts')
      .update({ status: 'rejected', decided_at: new Date().toISOString(), decided_by: user?.id ?? null })
      .eq('id', b.id);
    if (error) toast.error('Impossible de rejeter cet événement.');
    else toast.success('Rejeté : il ne sera plus reproposé');
    await charger();
    setBusyId(null);
  };

  const remettreEnAttente = async (b: Brouillon) => {
    setBusyId(b.id);
    const { error } = await supabase.from('event_drafts').update({ status: 'pending', decided_at: null, decided_by: null }).eq('id', b.id);
    if (error) toast.error('Action impossible.');
    await charger();
    setBusyId(null);
  };

  const champ = 'w-full px-3 py-2 rounded-input bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border text-sm';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarCheck size={20} className="text-primary" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Événements à valider</h1>
          {enAttente > 0 && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/15 text-primary">{enAttente}</span>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={charger} className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-900 dark:hover:text-white px-2">
            <RefreshCw size={15} /> Rafraîchir
          </button>
          <input
            ref={fichierRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) importer(f); }}
          />
          <button onClick={() => fichierRef.current?.click()} disabled={importEnCours} className="btn-primary flex items-center gap-2 text-sm">
            {importEnCours ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            Importer le fichier de la semaine
          </button>
        </div>
      </div>

      <p className="text-sm text-gray-500 -mt-3">
        Chaque semaine, Claude prépare un fichier des événements LGBT et LGBT-friendly de l'Hérault. Déposez-le avec le bouton
        ci-dessus, puis publiez, corrigez ou rejetez chaque événement. Rien n'apparaît dans l'agenda sans votre validation.
      </p>

      {bilan && (
        <div className="rounded-card border border-light-border dark:border-dark-border p-4 text-sm space-y-2">
          <p className="font-medium text-gray-900 dark:text-white">
            Import terminé : {bilan.ajoutes} ajouté{bilan.ajoutes > 1 ? 's' : ''}, {bilan.dejaConnus} déjà connu{bilan.dejaConnus > 1 ? 's' : ''} (agenda, en attente ou rejeté),
            {' '}{bilan.ecartes.length} écarté{bilan.ecartes.length > 1 ? 's' : ''}.
          </p>
          {bilan.ecartes.length > 0 && (
            <ul className="text-gray-500 list-disc pl-5 space-y-0.5 max-h-40 overflow-y-auto">
              {bilan.ecartes.map((e) => <li key={e.ligne}>Ligne {e.ligne} « {e.titre} » : {e.raison}</li>)}
            </ul>
          )}
          <button onClick={() => setBilan(null)} className="text-xs text-gray-400 hover:text-primary">Fermer</button>
        </div>
      )}

      <div className="flex gap-1 border-b border-light-border dark:border-dark-border">
        {ONGLETS.map((o) => (
          <button
            key={o.key}
            onClick={() => setOnglet(o.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${onglet === o.key ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
          >
            {o.label}{o.key === 'pending' && enAttente > 0 ? ` (${enAttente})` : ''}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-32 rounded-card bg-light-surface dark:bg-dark-surface animate-pulse" />)}</div>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500 py-10 text-center">
          {onglet === 'pending' ? 'Aucun événement en attente. Importez le fichier de la semaine pour en ajouter.' : 'Rien ici pour le moment.'}
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((b) => {
            const enEdition = edition[b.id] !== undefined;
            const occupe = busyId === b.id;
            return (
              <div key={b.id} className="rounded-card bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border p-4 space-y-3">
                {enEdition ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="sm:col-span-2 text-xs text-gray-500">Titre
                      <input className={champ} value={valeur(b, 'title')} onChange={(e) => modifier(b.id, { title: e.target.value })} />
                    </label>
                    <label className="text-xs text-gray-500">Début
                      <input type="datetime-local" className={champ} value={versChamp(valeur(b, 'event_date'))} onChange={(e) => modifier(b.id, { event_date: depuisChamp(e.target.value) || b.event_date })} />
                    </label>
                    <label className="text-xs text-gray-500">Fin (facultatif)
                      <input type="datetime-local" className={champ} value={versChamp(valeur(b, 'end_date'))} onChange={(e) => modifier(b.id, { end_date: depuisChamp(e.target.value) })} />
                    </label>
                    <label className="text-xs text-gray-500">Lieu
                      <input className={champ} value={valeur(b, 'venue_name') || ''} onChange={(e) => modifier(b.id, { venue_name: e.target.value, latitude: null, longitude: null })} />
                    </label>
                    <label className="text-xs text-gray-500">Adresse
                      <input className={champ} value={valeur(b, 'address') || ''} onChange={(e) => modifier(b.id, { address: e.target.value, latitude: null, longitude: null })} />
                    </label>
                    <label className="text-xs text-gray-500">Ville
                      <input className={champ} value={valeur(b, 'city') || ''} onChange={(e) => modifier(b.id, { city: e.target.value, latitude: null, longitude: null })} />
                    </label>
                    <label className="text-xs text-gray-500">Thème
                      <input className={champ} value={valeur(b, 'theme') || ''} placeholder="Soirée, Drag, Pride…" onChange={(e) => modifier(b.id, { theme: e.target.value })} />
                    </label>
                    <div className="flex items-end gap-3 text-xs text-gray-500">
                      <label className="flex items-center gap-2 pb-2">
                        <input type="checkbox" checked={valeur(b, 'is_free')} onChange={(e) => modifier(b.id, { is_free: e.target.checked })} /> Gratuit
                      </label>
                      {!valeur(b, 'is_free') && (
                        <label className="flex-1">Prix (€)
                          <input type="number" min={0} step="0.5" className={champ} value={valeur(b, 'price')} onChange={(e) => modifier(b.id, { price: Math.max(0, Number(e.target.value) || 0) })} />
                        </label>
                      )}
                    </div>
                    <label className="sm:col-span-2 text-xs text-gray-500">Description
                      <textarea rows={5} className={champ} value={valeur(b, 'description')} onChange={(e) => modifier(b.id, { description: e.target.value })} />
                    </label>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">{b.title}</h3>
                        <p className="text-sm text-primary mt-0.5">
                          {fmt(b.event_date)}{b.end_date ? ` → ${fmt(b.end_date)}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        {b.theme && <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary">{b.theme}</span>}
                        <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-dark-bg text-gray-600 dark:text-gray-300">
                          {b.is_free ? 'Gratuit' : `${b.price} €`}
                        </span>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                      <p className="flex items-start gap-2"><MapPin size={14} className="mt-0.5 shrink-0" />{[b.venue_name, b.address, b.city].filter(Boolean).join(', ') || 'Lieu non précisé'}</p>
                      {b.establishment && <p className="flex items-center gap-2"><Store size={14} className="shrink-0" />Rattaché à la fiche « {b.establishment.name} »</p>}
                    </div>
                    {b.description && <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line line-clamp-4">{b.description}</p>}
                    {b.lgbt_reason && (
                      <p className="text-xs rounded-input px-3 py-2 bg-primary/5 text-gray-600 dark:text-gray-400">
                        <span className="font-semibold text-primary">Pourquoi LGBT-friendly : </span>{b.lgbt_reason}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-4 text-xs">
                      {b.source_url && (
                        <a href={b.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                          <ExternalLink size={13} /> Vérifier la source{b.source_name ? ` (${b.source_name})` : ''}
                        </a>
                      )}
                      {b.ticket_url && (
                        <a href={b.ticket_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                          <Ticket size={13} /> Billetterie
                        </a>
                      )}
                    </div>
                  </>
                )}

                <div className="flex flex-wrap gap-2 pt-1 border-t border-light-border dark:border-dark-border">
                  {b.status === 'pending' && (
                    <>
                      <button onClick={() => publier(b)} disabled={occupe} className="btn-primary text-sm flex items-center gap-1.5 mt-2">
                        {occupe ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Publier
                      </button>
                      {enEdition ? (
                        <button onClick={() => fermerEdition(b.id)} disabled={occupe} className="text-sm px-3 py-2 mt-2 text-gray-500 hover:text-gray-900 dark:hover:text-white">
                          Annuler les modifications
                        </button>
                      ) : (
                        <button onClick={() => setEdition((e) => ({ ...e, [b.id]: {} }))} disabled={occupe} className="text-sm px-3 py-2 mt-2 flex items-center gap-1.5 text-gray-600 dark:text-gray-300 hover:text-primary">
                          <Pencil size={14} /> Modifier
                        </button>
                      )}
                      <button onClick={() => rejeter(b)} disabled={occupe} className="text-sm px-3 py-2 mt-2 flex items-center gap-1.5 text-gray-500 hover:text-alert ml-auto">
                        <X size={15} /> Rejeter
                      </button>
                    </>
                  )}
                  {b.status === 'published' && b.published_event_id && (
                    <a href={`/agenda/${b.published_event_id}`} target="_blank" rel="noopener noreferrer" className="text-sm mt-2 inline-flex items-center gap-1.5 text-primary hover:underline">
                      <ExternalLink size={14} /> Voir dans l'agenda
                    </a>
                  )}
                  {b.status === 'rejected' && (
                    <button onClick={() => remettreEnAttente(b)} disabled={occupe} className="text-sm mt-2 text-gray-500 hover:text-primary">
                      Remettre en attente
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
