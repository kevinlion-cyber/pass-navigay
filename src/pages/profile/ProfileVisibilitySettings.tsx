import { useState } from 'react';
import { Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Profile, ProfileVisibility } from '../../lib/types';

interface Props {
  profile: Profile;
}

const VISIBILITY_FIELDS: { key: keyof ProfileVisibility; label: string }[] = [
  { key: 'gender_identity', label: 'Identite de genre' },
  { key: 'pronouns', label: 'Pronoms' },
  { key: 'orientation', label: 'Orientation' },
  { key: 'looking_for', label: 'Ce que je cherche' },
  { key: 'vibe', label: 'Ma vibe' },
  { key: 'evening_energy', label: 'Energie en soiree' },
  { key: 'green_flags', label: 'Green flags' },
  { key: 'what_i_bring', label: 'Ce que j\'apporte' },
  { key: 'if_i_were_vibe', label: 'Si j\'etais une vibe' },
  { key: 'if_i_were_music', label: 'Si j\'etais une musique' },
  { key: 'late_truth', label: 'Verite tardive' },
];

export default function ProfileVisibilitySettings({ profile }: Props) {
  const { refreshProfile } = useAuth();
  const [visibility, setVisibility] = useState<ProfileVisibility>(
    (profile.profile_visibility || {}) as ProfileVisibility
  );
  const [saving, setSaving] = useState(false);

  const toggle = (key: keyof ProfileVisibility) => {
    setVisibility((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ profile_visibility: visibility })
      .eq('id', profile.id);

    if (error) {
      toast.error('Erreur lors de la sauvegarde');
    } else {
      toast.success('Preferences de visibilite mises a jour');
      refreshProfile();
    }
    setSaving(false);
  };

  if (!profile.is_premium || !profile.questionnaire_completed) return null;

  return (
    <section>
      <h2 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
        <Eye size={18} className="text-primary" />
        Visibilite du profil
      </h2>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        Choisis ce que les autres membres voient sur ton profil public.
      </p>

      <div className="card p-4 space-y-3">
        {VISIBILITY_FIELDS.map(({ key, label }) => (
          <label key={key} className="flex items-center justify-between cursor-pointer group">
            <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
              {label}
            </span>
            <div
              onClick={() => toggle(key)}
              className={`w-10 h-6 rounded-full relative transition-colors cursor-pointer ${
                visibility[key] ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <div
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  visibility[key] ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </div>
          </label>
        ))}

        <div className="pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary text-sm py-2 px-6"
          >
            {saving ? 'Sauvegarde...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </section>
  );
}
