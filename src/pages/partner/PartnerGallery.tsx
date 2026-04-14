import { useEffect, useState, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { X, Upload, GripVertical } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import type { Establishment, EstablishmentPhoto } from '../../lib/types';
import ProGate from '../../components/partner/ProGate';
import ConfirmModal from '../../components/admin/ConfirmModal';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

interface PartnerContext {
  establishment: Establishment;
}

const MAX_PHOTOS = 20;

export default function PartnerGallery() {
  const { establishment } = useOutletContext<PartnerContext>();
  const [photos, setPhotos] = useState<EstablishmentPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EstablishmentPhoto | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editingCaption, setEditingCaption] = useState<string | null>(null);
  const [captionValue, setCaptionValue] = useState('');
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!establishment.is_pro) return <ProGate feature="gerer ta galerie photos" />;

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('establishment_photos').select('*').eq('establishment_id', establishment.id).order('order_index');
      setPhotos((data as EstablishmentPhoto[]) || []);
    } catch { /* handled */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, [establishment.id]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (photos.length + files.length > MAX_PHOTOS) {
      toast.error(`Tu as atteint la limite de ${MAX_PHOTOS} photos.`);
      return;
    }
    if (files.length > 10) {
      toast.error('Maximum 10 photos a la fois.');
      return;
    }

    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const ext = file.name.split('.').pop();
        const path = `${establishment.id}/${Date.now()}_${i}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('establishment-photos').upload(path, file);
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from('establishment-photos').getPublicUrl(path);
        const { error: insertError } = await supabase.from('establishment_photos').insert({
          establishment_id: establishment.id,
          url: urlData.publicUrl,
          caption: '',
          order_index: photos.length + i,
        });
        if (insertError) throw insertError;
      }
      toast.success(`${files.length} photo${files.length > 1 ? 's' : ''} ajoutee${files.length > 1 ? 's' : ''}`);
      load();
    } catch (err: any) {
      toast.error(err.message || 'Erreur upload');
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('establishment_photos').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      toast.success('Photo supprimee');
      setDeleteTarget(null);
      load();
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    }
    setDeleting(false);
  };

  const saveCaption = async (id: string) => {
    try {
      const { error } = await supabase.from('establishment_photos').update({ caption: captionValue }).eq('id', id);
      if (error) throw error;
      toast.success('Legende mise a jour');
      setEditingCaption(null);
      load();
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    }
  };

  const handleDragStart = (idx: number) => {
    setDragIdx(idx);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    const reordered = [...photos];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(idx, 0, moved);
    setPhotos(reordered);
    setDragIdx(idx);
  };

  const handleDragEnd = async () => {
    setDragIdx(null);
    try {
      for (let i = 0; i < photos.length; i++) {
        if (photos[i].order_index !== i) {
          await supabase.from('establishment_photos').update({ order_index: i }).eq('id', photos[i].id);
        }
      }
    } catch { /* handled */ }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Galerie ({photos.length}/{MAX_PHOTOS})</h1>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">{[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="skeleton aspect-square rounded-card" />)}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {photos.map((photo, idx) => (
              <div
                key={photo.id}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDragEnd={handleDragEnd}
                className={`relative group rounded-card overflow-hidden bg-dark-border aspect-square ${dragIdx === idx ? 'opacity-50' : ''}`}
              >
                <img src={photo.url} alt={photo.caption} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors" />
                <button
                  onClick={() => setDeleteTarget(photo)}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-alert"
                >
                  <X size={14} />
                </button>
                <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity text-white cursor-grab">
                  <GripVertical size={16} />
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 to-transparent">
                  {editingCaption === photo.id ? (
                    <div className="flex gap-1">
                      <input
                        value={captionValue}
                        onChange={(e) => setCaptionValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') saveCaption(photo.id); if (e.key === 'Escape') setEditingCaption(null); }}
                        className="flex-1 bg-transparent text-white text-xs border-b border-white/50 focus:outline-none px-0 py-0.5"
                        autoFocus
                      />
                    </div>
                  ) : (
                    <button
                      onClick={() => { setEditingCaption(photo.id); setCaptionValue(photo.caption || ''); }}
                      className="text-xs text-white/80 hover:text-white truncate block w-full text-left"
                    >
                      {photo.caption || 'Ajouter une legende...'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-dark-border rounded-card p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
          >
            {uploading ? (
              <LoadingSpinner size={24} />
            ) : (
              <>
                <Upload size={32} className="mx-auto text-gray-500 mb-2" />
                <p className="text-sm text-gray-400">Clique ou depose tes photos ici</p>
                <p className="text-xs text-gray-600 mt-1">JPG, PNG, WebP — Max 10 a la fois</p>
              </>
            )}
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handleUpload} className="hidden" />
          </div>
        </>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Supprimer la photo"
        message="Es-tu sur de vouloir supprimer cette photo ?"
        confirmLabel="Supprimer"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  );
}
