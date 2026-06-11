import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MessageCircle, Crown, Clock, Calendar, Sparkles, Heart, Star, MapPin } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Profile, ProfileVisibility, Establishment } from '../lib/types';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import AuthGateModal from '../components/ui/AuthGateModal';
import PremiumUpgradeModal from '../components/ui/PremiumUpgradeModal';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'En ligne';
  if (minutes < 60) return `Actif il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Actif il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Actif il y a ${days}j`;
  const weeks = Math.floor(days / 7);
  return `Actif il y a ${weeks} sem`;
}

function Pill({ children, color = '#7B2D8B' }: { children: React.ReactNode; color?: string }) {
  return (
    <span
      className="inline-block px-2.5 py-0.5 rounded-full text-[12px] font-medium"
      style={{ background: `${color}20`, color }}
    >
      {children}
    </span>
  );
}

export default function ProfilePublic() {
  const { userId } = useParams<{ userId: string }>();
  const { user, profile: myProfile } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [favorites, setFavorites] = useState<Establishment[]>([]);
  const [reviews, setReviews] = useState<{ rating: number; comment: string; created_at: string; establishment: { id: string; name: string } }[]>([]);
  const [loading, setLoading] = useState(true);
  const [authGateOpen, setAuthGateOpen] = useState(false);
  const [premiumGateOpen, setPremiumGateOpen] = useState(false);

  useEffect(() => {
    if (!userId) return;
    loadData();
  }, [userId, user]);

  const loadData = async () => {
    setLoading(true);
    const [profileRes, favRes, reviewsRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId!).maybeSingle(),
      supabase
        .from('favorites')
        .select('establishment:establishments(id, name, city, category, logo_url)')
        .eq('user_id', userId!)
        .limit(6),
      supabase
        .from('reviews')
        .select('rating, comment, created_at, establishment:establishments(id, name)')
        .eq('user_id', userId!)
        .order('created_at', { ascending: false })
        .limit(5),
    ]);

    if (profileRes.data) setProfile(profileRes.data as Profile);
    if (favRes.data) {
      const establishments = favRes.data
        .map((f: any) => f.establishment)
        .filter(Boolean);
      setFavorites(establishments);
    }
    if (reviewsRes.data) {
      setReviews(reviewsRes.data as any);
    }
    setLoading(false);
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner size={32} />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-20 text-gray-500">Profil introuvable.</div>
    );
  }

  const firstName = profile.prenom || profile.username;
  const vis = (profile.profile_visibility || {}) as ProfileVisibility;
  const isPremiumProfile = profile.is_premium && profile.questionnaire_completed;
  const hasPremiumContent = isPremiumProfile && (
    (vis.gender_identity && profile.gender_identity) ||
    (vis.orientation && profile.orientation) ||
    (vis.looking_for && profile.looking_for && profile.looking_for.length > 0) ||
    (vis.vibe && profile.vibe) ||
    (vis.green_flags && profile.green_flags?.length) ||
    (vis.evening_energy && profile.evening_energy) ||
    (vis.what_i_bring && profile.what_i_bring) ||
    (vis.if_i_were_vibe && profile.if_i_were_vibe) ||
    (vis.if_i_were_music && profile.if_i_were_music) ||
    (vis.late_truth && profile.late_truth)
  );

  return (
    <div className="max-w-2xl mx-auto pb-24">
      <div className="px-4 pt-6 pb-4 space-y-6">
        <div className="flex items-start gap-4">
          <div
            className={`w-[88px] h-[88px] rounded-full flex items-center justify-center overflow-hidden shrink-0
                        ${profile.is_premium
                          ? 'ring-[3px] ring-amber-400 dark:ring-amber-500'
                          : 'ring-2 ring-gray-200 dark:ring-dark-border'
                        }
                        ${!profile.avatar_url ? 'bg-primary/10' : ''}`}
          >
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-primary text-3xl font-semibold">
                {firstName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0 pt-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-[22px] font-bold text-gray-900 dark:text-white leading-tight">
                {firstName}
              </h1>
              {profile.is_premium && (
                <span className="flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                  <Crown size={12} />
                  Premium
                </span>
              )}
            </div>

            {vis.pronouns && profile.pronouns && (
              <div className="mt-1.5">
                <Pill>{profile.pronouns}</Pill>
              </div>
            )}

            {profile.bio && (
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 leading-relaxed">
                {profile.bio}
              </p>
            )}

            <div className="flex items-center flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-gray-400 dark:text-gray-500">
              <span className="flex items-center gap-1">
                <Calendar size={12} />
                Membre depuis {formatDate(profile.created_at)}
              </span>
              {profile.last_active_at && (
                <span className="flex items-center gap-1">
                  <Clock size={12} />
                  {timeAgo(profile.last_active_at)}
                </span>
              )}
            </div>

            {profile.favorite_categories?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {profile.favorite_categories.map((cat) => (
                  <span
                    key={cat}
                    className="px-2.5 py-0.5 rounded-full text-xs font-medium"
                    style={{
                      backgroundColor: 'rgba(139, 92, 246, 0.12)',
                      color: 'rgb(124, 58, 237)',
                    }}
                  >
                    {cat}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {(!user || user.id !== userId) && (
          <button
            onClick={() => {
              if (!user) { setAuthGateOpen(true); return; }
              if (!myProfile?.is_premium) { setPremiumGateOpen(true); return; }
              navigate(`/messages/${userId}`);
            }}
            className="w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold rounded-xl shadow-lg text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: 'rgb(124, 58, 237)' }}
          >
            <MessageCircle size={18} />
            Envoyer un message a {firstName}
          </button>
        )}

        {favorites.length > 0 && (
          <>
            <div className="border-t border-light-border dark:border-dark-border" />
            <section className="space-y-3">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Heart size={16} className="text-rose-500" />
                Lieux favoris
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {favorites.map((est) => (
                  <button
                    key={est.id}
                    onClick={() => navigate(`/establishment/${est.id}`)}
                    className="flex items-center gap-2.5 p-2.5 rounded-xl bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border hover:border-primary/40 transition-colors text-left"
                  >
                    {est.logo_url ? (
                      <img src={est.logo_url} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <MapPin size={14} className="text-primary" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{est.name}</p>
                      <p className="text-[11px] text-gray-400 truncate">{est.city}</p>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          </>
        )}

        {reviews.length > 0 && (
          <>
            <div className="border-t border-light-border dark:border-dark-border" />
            <section className="space-y-3">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Star size={16} className="text-amber-500" />
                Derniers avis
              </h2>
              <div className="space-y-2.5">
                {reviews.map((review, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-xl bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <button
                        onClick={() => review.establishment && navigate(`/establishment/${review.establishment.id}`)}
                        className="text-xs font-medium text-primary hover:underline truncate"
                      >
                        {review.establishment?.name}
                      </button>
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }, (_, idx) => (
                          <Star
                            key={idx}
                            size={11}
                            className={idx < review.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-300 dark:text-gray-600'}
                          />
                        ))}
                      </div>
                    </div>
                    {review.comment && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{review.comment}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {favorites.length === 0 && reviews.length === 0 && !hasPremiumContent && (
          <div className="text-center py-8">
            <p className="text-sm text-gray-400 dark:text-gray-500">
              {user?.id === userId ? 'Ton profil est encore vide. Ajoute des lieux en favoris et laisse des avis !' : 'Ce membre n\'a pas encore d\'activite publique.'}
            </p>
          </div>
        )}

        {hasPremiumContent && (
          <>
            <div className="border-t border-light-border dark:border-dark-border" />

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Sparkles size={16} style={{ color: '#7B2D8B' }} />
                Qui je suis
              </h2>

              <div className="flex flex-wrap gap-2">
                {vis.gender_identity && profile.gender_identity && (
                  <Pill>{profile.gender_identity}</Pill>
                )}
                {vis.orientation && profile.orientation && (
                  <Pill color="#c084f5">{profile.orientation}</Pill>
                )}
              </div>

              {vis.looking_for && profile.looking_for && profile.looking_for.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">Ce que je cherche</p>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.looking_for.map((item) => (
                      <Pill key={item} color="#c084f5">{item}</Pill>
                    ))}
                  </div>
                </div>
              )}

              {vis.vibe && profile.vibe && (
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Mon vibe : <span className="font-medium text-gray-900 dark:text-white">{profile.vibe}</span>
                </p>
              )}
            </section>

            {((vis.green_flags && profile.green_flags?.length) || (vis.evening_energy && profile.evening_energy) || (vis.what_i_bring && profile.what_i_bring)) && (
              <>
                <div className="border-t border-light-border dark:border-dark-border" />
                <section className="space-y-3">
                  <h2 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <Sparkles size={16} style={{ color: '#22c55e' }} />
                    Mon energie
                  </h2>

                  {vis.green_flags && profile.green_flags && profile.green_flags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {profile.green_flags.map((flag) => (
                        <Pill key={flag} color="#22c55e">{flag}</Pill>
                      ))}
                    </div>
                  )}

                  {vis.evening_energy && profile.evening_energy && (
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      En soiree : <span className="font-medium text-gray-900 dark:text-white">{profile.evening_energy}</span>
                    </p>
                  )}

                  {vis.what_i_bring && profile.what_i_bring && (
                    <p className="text-sm italic text-gray-500 dark:text-gray-400">
                      "{profile.what_i_bring}"
                    </p>
                  )}
                </section>
              </>
            )}

            {((vis.if_i_were_vibe && profile.if_i_were_vibe) || (vis.if_i_were_music && profile.if_i_were_music) || (vis.late_truth && profile.late_truth)) && (
              <>
                <div className="border-t border-light-border dark:border-dark-border" />
                <section className="space-y-3">
                  <h2 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <Sparkles size={16} style={{ color: '#f59e0b' }} />
                    Fun facts
                  </h2>

                  {vis.if_i_were_vibe && profile.if_i_were_vibe && (
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Si j'etais une vibe : <span className="font-medium text-gray-900 dark:text-white">{profile.if_i_were_vibe}</span>
                    </p>
                  )}

                  {vis.if_i_were_music && profile.if_i_were_music && (
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Si j'etais une musique : <span className="font-medium text-gray-900 dark:text-white">{profile.if_i_were_music}</span>
                    </p>
                  )}

                  {vis.late_truth && profile.late_truth && (
                    <p className="text-sm italic text-gray-500 dark:text-gray-400">
                      "{profile.late_truth}"
                    </p>
                  )}
                </section>
              </>
            )}
          </>
        )}
      </div>

      <AuthGateModal
        open={authGateOpen}
        onClose={() => setAuthGateOpen(false)}
        message="Cree ton compte pour envoyer un message."
      />

      <PremiumUpgradeModal open={premiumGateOpen} onClose={() => setPremiumGateOpen(false)} />

      {(!user || user.id !== userId) && (
        <div className="fixed bottom-16 md:bottom-0 left-0 right-0 z-40 p-4 bg-gradient-to-t from-light-bg dark:from-dark-bg via-light-bg/95 dark:via-dark-bg/95 to-transparent">
          <div className="max-w-2xl mx-auto">
            <button
              onClick={() => {
                if (!user) { setAuthGateOpen(true); return; }
                if (!myProfile?.is_premium) { setPremiumGateOpen(true); return; }
                navigate(`/messages/${userId}`);
              }}
              className="w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold rounded-xl shadow-lg text-white"
              style={{ backgroundColor: 'rgb(124, 58, 237)' }}
            >
              <MessageCircle size={18} />
              Envoyer un message
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
