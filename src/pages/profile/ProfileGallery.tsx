import { useRef, useState } from 'react';
import { ImagePlus, X, Loader2, Images } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Profile } from '../../lib/types';

const MAX_PHOTOS = 8;

// Galerie photos réservée aux membres Premium (comme les pros).
export default function ProfileGallery({ profile }: { profile: Profile }) {
  const { user, refreshProfile } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const gallery = profile.gallery_urls ?? [];

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!user || files.length === 0) return;
    const room = MAX_PHOTOS - gallery.length;
    if (room <= 0) { toast.error(`Maximum ${MAX_PHOTOS} photos.`); return; }

    setUploading(true);
    const added: string[] = [];
    const stamp = Date.now();
    for (let i = 0; i < Math.min(files.length, room); i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;
      const path = `${user.id}/gallery/${stamp}_${i}.jpg`;
      const { error } = await supabase.storage.from('avatars').upload(path, file, {
        contentType: file.type || 'image/jpeg',
        upsert: true,
      });
      if (error) { toast.error('Erreur lors de l’envoi d’une photo'); continue; }
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      added.push(data.publicUrl);
    }

    if (added.length) {
      const next = [...gallery, ...added];
      const { error } = await supabase.from('profiles').update({ gallery_urls: next }).eq('id', user.id);
      if (error) { toast.error(error.message); } else { await refreshProfile(); toast.success('Galerie mise à jour'); }
    }
    setUploading(false);
  };

  const removePhoto = async (url: string) => {
    if (!user) return;
    const marker = '/avatars/';
    const idx = url.indexOf(marker);
    if (idx >= 0) {
      const path = url.slice(idx + marker.length).split('?')[0];
      await supabase.storage.from('avatars').remove([path]);
    }
    const next = gallery.filter((u) => u !== url);
    const { error } = await supabase.from('profiles').update({ gallery_urls: next }).eq('id', user.id);
    if (error) { toast.error(error.message); } else { await refreshProfile(); }
  };

  return (
    <div className="card p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Images size={16} className="text-primary" />
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Ma galerie photos</h3>
        <span className="text-xs text-gray-400">{gallery.length}/{MAX_PHOTOS}</span>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {gallery.map((url) => (
          <div key={url} className="relative aspect-square rounded-lg overflow-hidden group">
            <img src={url} alt="" className="w-full h-full object-cover" />
            <button
              onClick={() => removePhoto(url)}
              className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Supprimer la photo"
            >
              <X size={14} />
            </button>
          </div>
        ))}

        {gallery.length < MAX_PHOTOS && (
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="aspect-square rounded-lg border-2 border-dashed border-light-border dark:border-dark-border flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-primary hover:text-primary transition-colors"
          >
            {uploading ? <Loader2 size={20} className="animate-spin" /> : <ImagePlus size={20} />}
            <span className="text-[10px]">Ajouter</span>
          </button>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp"
        multiple
        className="hidden"
        onChange={handleFiles}
        disabled={uploading}
      />
    </div>
  );
}
