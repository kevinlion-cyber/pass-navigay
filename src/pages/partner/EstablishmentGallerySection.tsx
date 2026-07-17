import { useEffect, useState, useRef, useCallback } from 'react';
import { Trash2, Plus, Image as ImageIcon } from 'lucide-react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import type { EstablishmentPhoto } from '../../lib/types';
import ConfirmModal from '../../components/admin/ConfirmModal';

const MAX_PHOTOS = 20;

async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  const image = await createImageBitmap(await fetch(imageSrc).then((r) => r.blob()));
  const canvas = document.createElement('canvas');
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'))), 'image/jpeg', 0.9);
  });
}

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
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [croppedResults, setCroppedResults] = useState<{ blob: Blob; preview: string }[]>([]);

  const loadPhotos = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('establishment_photos')
        .select('*')
        .eq('establishment_id', establishmentId)
        .order('order_index', { ascending: true });
      setPhotos((data as EstablishmentPhoto[]) || []);
    } catch {
      toast.error('Erreur lors du chargement de la galerie');
    }
    setLoading(false);
  }, [establishmentId]);

  useEffect(() => { loadPhotos(); }, [loadPhotos]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('establishment_photos').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      toast.success('Photo supprimée');
      setDeleteTarget(null);
      loadPhotos();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la suppression');
    }
    setDeleting(false);
  };

  const handleCaptionChange = (photoId: string, value: string) => {
    setPhotos(prev => prev.map(p => p.id === photoId ? { ...p, caption: value } : p));
    if (captionTimers[photoId]) clearTimeout(captionTimers[photoId]);
    const timer = setTimeout(async () => {
      try {
        await supabase.from('establishment_photos').update({ caption: value }).eq('id', photoId);
      } catch {
        toast.error('Erreur de sauvegarde de la légende');
      }
    }, 1000);
    setCaptionTimers(prev => ({ ...prev, [photoId]: timer }));
  };

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

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
    const urls = files.map(f => URL.createObjectURL(f));
    setCropQueue(urls);
    setCropIndex(0);
    setCroppedResults([]);
    setCropSrc(urls[0]);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleCropValidate = async () => {
    if (!cropSrc || !croppedAreaPixels) return;
    try {
      const blob = await getCroppedImg(cropSrc, croppedAreaPixels);
      const preview = URL.createObjectURL(blob);
      const newResults = [...croppedResults, { blob, preview }];
      setCroppedResults(newResults);

      const nextIdx = cropIndex + 1;
      if (nextIdx < cropQueue.length) {
        setCropIndex(nextIdx);
        setCropSrc(cropQueue[nextIdx]);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        setCroppedAreaPixels(null);
      } else {
        onPendingChange([...pendingPhotos, ...newResults]);
        setCropSrc(null);
        setCropQueue([]);
        setCroppedResults([]);
      }
    } catch {
      toast.error('Erreur lors du recadrage');
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
                      className="w-9 h-9 rounded-full bg-black/60 text-gray-900 dark:text-white flex items-center justify-center hover:bg-red-600 transition-colors">
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
              <p className="text-xs text-gray-500 mb-2">En attente d'upload (sera envoyé au clic sur Enregistrer) :</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {pendingPhotos.map((p, i) => (
                  <div key={i} className="relative rounded-[8px] overflow-hidden" style={{ aspectRatio: '4/3' }}>
                    <img src={p.preview} alt="" className="w-full h-full object-cover" />
                    <button onClick={() => removePending(i)}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-gray-900 dark:text-white flex items-center justify-center hover:bg-red-600 transition-colors">
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
              <span className="text-xs text-gray-600">JPG, PNG, WEBP - Jusqu'à 10 photos à la fois - Max 5MB chacune</span>
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
        <div className="fixed inset-0 z-[2000] flex flex-col" style={{ background: 'var(--pn-bg2)' }}>
          <div className="shrink-0 flex items-center justify-between px-5 py-4"
            style={{ background: 'var(--pn-surface2)', borderBottom: '1px solid var(--pn-border)' }}>
            <span className="text-[15px] font-semibold text-gray-900 dark:text-white">
              Recadrez la photo {cropIndex + 1}/{cropQueue.length}
            </span>
            <button onClick={() => { setCropSrc(null); setCropQueue([]); setCroppedResults([]); }}
              className="text-[#606070] hover:text-gray-900 dark:text-white transition-colors text-sm">
              Annuler tout
            </button>
          </div>
          <div className="flex-1 relative" style={{ minHeight: 300, background: '#000' }}>
            <Cropper image={cropSrc} crop={crop} zoom={zoom} aspect={4 / 3}
              onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={onCropComplete}
              cropShape="rect" showGrid={false} />
          </div>
          <div className="shrink-0 px-5 py-4 space-y-4" style={{ background: 'var(--pn-surface2)', borderTop: '1px solid var(--pn-border)' }}>
            <div className="flex items-center gap-3">
              <span className="text-[13px] text-[#a0a0b0] shrink-0">Zoom</span>
              <input type="range" min={1} max={3} step={0.01} value={zoom}
                onChange={e => setZoom(Number(e.target.value))} className="flex-1" style={{ accentColor: '#7B2D8B' }} />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setCropSrc(null); setCropQueue([]); setCroppedResults([]); }}
                className="flex-1 py-2.5 rounded-lg text-[14px] transition-colors hover:opacity-90"
                style={{ background: 'transparent', border: '1px solid var(--pn-border2)', color: '#a0a0b0' }}>
                Annuler
              </button>
              <button onClick={handleCropValidate}
                className="flex-[2] py-2.5 rounded-lg text-[14px] font-semibold text-gray-900 dark:text-white transition-colors hover:opacity-90"
                style={{ background: '#7B2D8B' }}>
                Valider
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal open={!!deleteTarget} title="Supprimer cette photo ?"
        message="Êtes-vous sûr de vouloir supprimer cette photo ? Cette action est irréversible."
        confirmLabel="Supprimer" onCancel={() => setDeleteTarget(null)} onConfirm={handleDelete} loading={deleting} />
    </div>
  );
}
