import { useState, useRef } from 'react';
import { Camera, Check, X, Crown } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Profile } from '../../lib/types';
import AvatarCropModal from '../../components/ui/AvatarCropModal';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

interface ProfileHeaderProps {
  profile: Profile;
}

export default function ProfileHeader({ profile }: ProfileHeaderProps) {
  const { user, refreshProfile } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [editingBio, setEditingBio] = useState(false);
  const [bio, setBio] = useState(profile.bio || '');
  const [uploading, setUploading] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  const initials = profile.username
    ? profile.username.charAt(0).toUpperCase()
    : '?';

  const memberSince = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    : '';

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCropConfirm = async (blob: Blob) => {
    if (!user) return;
    setUploading(true);
    setCropSrc(null);
    const path = `${user.id}/avatar.jpg`;

    const { error: removeErr } = await supabase.storage.from('avatars').remove([path]);
    if (removeErr) { /* ignore, file may not exist */ }

    const { error } = await supabase.storage.from('avatars').upload(path, blob, {
      contentType: 'image/jpeg',
      upsert: true,
    });

    if (error) {
      toast.error('Erreur upload avatar');
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
    const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;
    await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);
    await refreshProfile();
    toast.success('Photo mise a jour !');
    setUploading(false);
  };

  const saveBio = async () => {
    if (!user) return;
    const { error } = await supabase.from('profiles').update({ bio }).eq('id', user.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await refreshProfile();
    setEditingBio(false);
    toast.success('Bio mise a jour');
  };

  return (
    <>
      <div className="flex flex-col items-center text-center">
        <div className="relative group mb-4">
          <button
            onClick={() => fileRef.current?.click()}
            className="w-[88px] h-[88px] rounded-full bg-primary/10 flex items-center justify-center overflow-hidden ring-3 ring-primary/20 transition-transform hover:scale-105 focus:outline-none"
          >
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-primary text-4xl font-semibold">{initials}</span>
            )}
          </button>
          <div
            onClick={() => fileRef.current?.click()}
            className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
          >
            {uploading ? (
              <LoadingSpinner size={20} />
            ) : (
              <Camera size={22} className="text-white" />
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp"
            className="hidden"
            onChange={handleFileSelect}
            disabled={uploading}
          />
        </div>

        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-[22px] font-bold text-gray-900 dark:text-white leading-tight">
            {profile.username}
          </h1>
          {profile.is_premium && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-pill text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              <Crown size={12} />
              Premium
            </span>
          )}
        </div>

        {editingBio ? (
          <div className="w-full max-w-sm mt-1 space-y-2">
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={2}
              className="input-field text-sm resize-none text-center"
              placeholder="Ajoute une bio..."
              autoFocus
            />
            <div className="flex justify-center gap-2">
              <button onClick={saveBio} className="text-success hover:opacity-80 p-1">
                <Check size={18} />
              </button>
              <button onClick={() => { setEditingBio(false); setBio(profile.bio || ''); }} className="text-gray-400 hover:text-gray-600 p-1">
                <X size={18} />
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setEditingBio(true)}
            className="mt-1 text-sm text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-primary transition-colors"
          >
            {profile.bio || 'Ajoute une bio...'}
          </button>
        )}

        {memberSince && (
          <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
            Membre depuis {memberSince}
          </p>
        )}
      </div>

      {cropSrc && (
        <AvatarCropModal
          imageSrc={cropSrc}
          onCancel={() => setCropSrc(null)}
          onConfirm={handleCropConfirm}
        />
      )}
    </>
  );
}
