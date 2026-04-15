import { useState, useRef } from 'react';
import { Camera, Check, X, Crown, Save, Loader2, Pencil } from 'lucide-react';
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
  const [username, setUsername] = useState(profile.username || '');
  const [prenom, setPrenom] = useState(profile.prenom || '');
  const [nom, setNom] = useState(profile.nom || '');
  const [phone, setPhone] = useState(profile.phone || '');
  const [uploading, setUploading] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingUsername, setEditingUsername] = useState(false);
  const [savingUsername, setSavingUsername] = useState(false);

  const initials = profile.prenom
    ? profile.prenom.charAt(0).toUpperCase()
    : profile.username
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

    await supabase.storage.from('avatars').remove([path]);

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

  const saveUsername = async () => {
    if (!user || !username.trim()) return;
    setSavingUsername(true);
    const trimmed = username.trim().toLowerCase();
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', trimmed)
      .neq('id', user.id)
      .maybeSingle();
    if (existing) {
      toast.error('Ce pseudo est deja pris.');
      setSavingUsername(false);
      return;
    }
    const { error } = await supabase.from('profiles').update({ username: trimmed }).eq('id', user.id);
    setSavingUsername(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await refreshProfile();
    setEditingUsername(false);
    toast.success('Pseudo mis a jour');
  };

  const saveInfos = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ prenom: prenom || null, nom: nom || null, phone: phone || null })
      .eq('id', user.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await refreshProfile();
    toast.success('Informations mises a jour');
  };

  const hasInfoChanges =
    (prenom || '') !== (profile.prenom || '') ||
    (nom || '') !== (profile.nom || '') ||
    (phone || '') !== (profile.phone || '');

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

        {editingUsername ? (
          <div className="flex items-center gap-2 mb-1">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/\s/g, '').slice(0, 30))}
              className="input-field text-center text-lg font-bold w-48"
              autoFocus
            />
            <button
              onClick={saveUsername}
              disabled={savingUsername || !username.trim()}
              className="text-success hover:opacity-80 p-1"
            >
              {savingUsername ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            </button>
            <button
              onClick={() => { setEditingUsername(false); setUsername(profile.username || ''); }}
              className="text-gray-400 hover:text-gray-600 p-1"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-[22px] font-bold text-gray-900 dark:text-white leading-tight">
              {profile.prenom || profile.username}
            </h1>
            {profile.is_premium && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-pill text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                <Crown size={12} />
                Premium
              </span>
            )}
            <button
              onClick={() => setEditingUsername(true)}
              className="text-gray-400 hover:text-primary transition-colors p-1"
              title="Modifier le pseudo"
            >
              <Pencil size={13} />
            </button>
          </div>
        )}

        {editingBio ? (
          <div className="w-full max-w-sm mt-1 space-y-2">
            <div className="relative">
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value.slice(0, 150))}
                rows={2}
                maxLength={150}
                className="input-field text-sm resize-none text-center"
                placeholder="Ajoute une bio..."
                autoFocus
              />
              <span className="absolute bottom-2 right-3 text-[10px] text-gray-400">{bio.length}/150</span>
            </div>
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

      <div className="card p-4 space-y-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Mes informations</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Prenom</label>
            <input
              type="text"
              value={prenom}
              onChange={(e) => setPrenom(e.target.value)}
              placeholder="Ton prenom"
              className="input-field text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Nom</label>
            <input
              type="text"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Ton nom"
              className="input-field text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Email</label>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="input-field text-sm opacity-60 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Telephone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="06 12 34 56 78"
              className="input-field text-sm"
            />
          </div>
        </div>
        <div
          className={`transition-all overflow-hidden ${hasInfoChanges ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0'}`}
        >
          <button
            onClick={saveInfos}
            disabled={saving}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all hover:opacity-90"
            style={{ background: '#7B2D8B' }}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Enregistrer les modifications
          </button>
        </div>
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
