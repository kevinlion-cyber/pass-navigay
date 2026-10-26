import { useEffect, useState, useRef, useCallback } from 'react';
import { Trash2, Plus, Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import type { EstablishmentPhoto } from '../../lib/types';
import ConfirmModal from '../../components/admin/ConfirmModal';
import RecadrageModal from '../../components/ui/RecadrageModal';

const MAX_PHOTOS = 20;
// Limite de poids alignée sur le parcours d'inscription (RegisterStep3) : le texte
// annonçait « Max 5 Mo chacune » sans qu'aucune vérification soit faite, donc une
// photo trop lourde partait et échouait avec un message technique en anglais.
const MAX_PHOTO_MB = 5;

interface Props {
  establishmentId: string;
  pendingPhotos: { blob: Blob; preview: string }[];
  onPendingChange: (photos: { blob: Blob; preview: string }[]) => void;
}

export default function EstablishmentGallerySection({ establishmentId, pendingPhotos, onPendingChange }: Props) {
  const [photos, setPhotos] = useState<EstablishmentPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<EstablishmentPhoto | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [captionTimers, setCaptionTimers] = useState<Record<string, ReturnType<typeof setTimeout>>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const [cropQueue, setCropQueue] = useState<string[]>([]);
  const [cropIndex, setCropIndex] = useState(0);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [croppedResults, setCroppedResults] = useState<{ blob: Blob; preview: string }[]>([]);

  const loadPhotos = useCallback(async () => {
    setLoading(true);
    // Le client Supabase ne lève pas d'exception : il renvoie un objet contenant
    // `error`. Sans le lire, le `catch` ne se déclenchait jamais et la galerie
    // s'affichait vide comme si le gérant n'avait aucune photo.
    const { data, error } = await supabase
      .from('establishment_photos')
      .select('*')
      .eq('establishment_id', establishmentId)
      .order('order_index', { ascending: true });
    if (error) {
      toast.error('Vos photos n\'ont pas pu être chargées. Réessayez dans un instant.');
    } else {
      setPhotos((data as EstablishmentPhoto[]) || []);
    }
    setLoading(false);
  }, [establishmentId]);

  useEffect(() => { loadPhotos(); }, [loadPhotos]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('establishment_photos').delete().eq('id', deleteTarget.id);
      if (error) throw new Error('Cette photo n\'a pas pu être supprimée. Réessayez dans un instant.');
      toast.success('Photo supprimée');
      setDeleteTarget(null);
      loadPhotos();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Cette photo n\'a pas pu être supprimée. Réessayez dans un instant.');
    }
    setDeleting(false);
  };

  const handleCaptionChange = (photoId: string, value: string) => {
    setPhotos(prev => prev.map(p => p.id === photoId ? { ...p, caption: value } : p));
    if (captionTimers[photoId]) clearTimeout(captionTimers[photoId]);
    const timer = setTimeout(async () => {
      // Idem : l'erreur arrive dans la réponse, pas via une exception. Le `catch`
      // vide laissait le gérant croire que sa légende était enregistrée.
      const { error } = await supabase.from('establishment_photos').update({ caption: value }).eq('id', photoId);
      if (error) toast.error('Cette légende n\'a pas pu être enregistrée. Réessayez dans un instant.');
    }, 1000);
    setCaptionTimers(prev => ({ ...prev, [photoId]: timer }));
  };

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const totalAfter = photos.length + pendingPhotos.length + files.length;
    if (totalAfter > MAX_PHOTOS) {
      toast.error(`Vous dépassez la limite de ${MAX_PHOTOS} photos.`);
      return;
    }
    if (files.length > 10) {
      toast.error('Maximum 10 photos à la fois.');
      return;
    }
    for (const f of files) {
      if (f.size > MAX_PHOTO_MB * 1024 * 1024) {
        toast.error(`Chaque photo doit faire moins de ${MAX_PHOTO_MB} Mo.`);
        if (fileRef.current) fileRef.current.value = '';
        return;
      }
    }
    const urls = files.map(f => URL.createObjectURL(f));
    setCropQueue(urls);
    setCropIndex(0);
    setCroppedResults([]);
    setCropSrc(urls[0]);
    if (fileRef.current) fileRef.current.value = '';
  };

  /** Une photo recadrée : on enchaîne sur la suivante, ou on rend le lot. */
  const handlePhotoRecadree = (blob: Blob) => {
    const resultats = [...croppedResults, { blob, preview: URL.createObjectURL(blob) }];
    setCroppedResults(resultats);

    const suivante = cropIndex + 1;
    if (suivante < cropQueue.length) {
      setCropIndex(suivante);
      setCropSrc(cropQueue[suivante]);
    } else {
      onPendingChange([...pendingPhotos, ...resultats]);
      setCropSrc(null);
      setCropQueue([]);
      setCroppedResults([]);
    }
  };

  const removePending = (idx: number) => {
    const updated = pendingPhotos.filter((_, i) => i !== idx);
    onPendingChange(updated);
  };

  const totalPhotos = photos.length + pendingPhotos.length;

  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <h2 className="text-base font-bold text-gray-900 dark:text-white">Galerie de photos</h2>
        <span className="text-sm text-gray-500">({totalPhotos}/{MAX_PHOTOS})</span>
      </div>
      <p className="text-[13px] text-gray-500 mb-5">
        Ces photos apparaissent sur votre fiche établissement. Ajoutez des images de l'ambiance, de la déco, de vos espaces.
      </p>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3].map(i => <div key={i} className="skeleton rounded-[8px]" style={{ aspectRatio: '4/3' }} />)}
        </div>
      ) : (
        <>
          {photos.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
              {photos.map(photo => (
                <div key={photo.id} className="relative group rounded-[8px] overflow-hidden" style={{ aspectRatio: '4/3' }}>
                  <img src={photo.url} alt={photo.caption} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100">
                    <button onClick={() => setDeleteTarget(photo)}
                      className="w-9 h-9 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-red-600 transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5">
                    <input
                      value={photo.caption || ''}
                      onChange={e => handleCaptionChange(photo.id, e.target.value)}
                      placeholder="Ajouter une légende..."
                      className="w-full bg-transparent text-xs text-[#a0a0b0] placeholder-[#606070] border-b border-[var(--pn-border2)] focus:outline-none focus:border-[#7B2D8B] py-0.5 px-0"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {pendingPhotos.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-gray-500 mb-2">En attente d'envoi (sera envoyé au clic sur Enregistrer) :</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {pendingPhotos.map((p, i) => (
                  <div key={i} className="relative rounded-[8px] overflow-hidden" style={{ aspectRatio: '4/3' }}>
                    <img src={p.preview} alt="" className="w-full h-full object-cover" />
                    <button onClick={() => removePending(i)}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-red-600 transition-colors">
                      <span className="text-sm font-bold">&times;</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {totalPhotos >= MAX_PHOTOS ? (
            <p className="text-sm text-orange-400 py-4">
              Vous avez atteint la limite de {MAX_PHOTOS} photos. Supprimez-en pour en ajouter de nouvelles.
            </p>
          ) : photos.length === 0 && pendingPhotos.length === 0 ? (
            <button type="button" onClick={() => fileRef.current?.click()}
              className="w-full flex flex-col items-center justify-center gap-3 rounded-xl py-12 px-6 cursor-pointer transition-colors hover:border-[#3a3a4a]"
              style={{ border: '2px dashed var(--pn-border2)' }}>
              <ImageIcon size={32} className="text-gray-600" />
              <span className="text-sm text-gray-400 font-medium">Ajoutez vos premières photos</span>
              <span className="text-xs text-gray-600">JPG, PNG, WEBP - Jusqu'à 10 photos à la fois - Max {MAX_PHOTO_MB} Mo chacune</span>
              <span className="mt-2 text-sm font-semibold text-white px-6 py-2 rounded-[8px]" style={{ background: '#7B2D8B' }}>
                Choisir des photos
              </span>
            </button>
          ) : (
            <button type="button" onClick={() => fileRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 rounded-[10px] py-5 cursor-pointer transition-colors hover:border-[#3a3a4a]"
              style={{ border: '2px dashed var(--pn-border2)' }}>
              <Plus size={16} className="text-gray-500" />
              <span className="text-sm text-gray-500">Ajouter des photos ({totalPhotos}/{MAX_PHOTOS} utilisées)</span>
            </button>
          )}

          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple
            onChange={handleFilesSelected} className="hidden" />
        </>
      )}

      {cropSrc && (
        <RecadrageModal
          source={cropSrc}
          proportion={4 / 3}
          titre={`Recadrez la photo ${cropIndex + 1}/${cropQueue.length}`}
          largeurSortie={1200}
          onValider={handlePhotoRecadree}
          onAnnuler={() => { setCropSrc(null); setCropQueue([]); setCroppedResults([]); }}
        />
      )}

      <ConfirmModal open={!!deleteTarget} title="Supprimer cette photo ?"
        message="Êtes-vous sûr de vouloir supprimer cette photo ? Cette action est irréversible."
        confirmLabel="Supprimer" onCancel={() => setDeleteTarget(null)} onConfirm={handleDelete} loading={deleting} />
    </div>
  );
}
