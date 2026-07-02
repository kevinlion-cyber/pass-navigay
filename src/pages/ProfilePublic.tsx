import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MessageCircle, Crown, Clock, Calendar, Sparkles, Heart, Star, MapPin, Zap, Music, Quote, ShieldCheck, Images } from 'lucide-react';
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
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}j`;
  const weeks = Math.floor(days / 7);
  return `${weeks} sem`;
}

function Tag({ children, variant = 'default' }: { children: React.ReactNode; variant?: 'default' | 'green' | 'amber' | 'rose' }) {
  const styles = {
    default: 'bg-[#7B2D8B]/10 text-[#a855f7] border-[#7B2D8B]/20',
    green: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    rose: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  };
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-[12px] font-medium border ${styles[variant]}`}>
      {children}
    </span>
  );
}

function SectionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border p-5 ${className}`} style={{ background: 'var(--pp-card)', borderColor: 'var(--pp-card-border)' }}>
      {children}
    </div>
  );
}

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2.5 text-[15px] font-semibold text-white mb-4">
      {icon}
      {children}
    </h2>
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
      supabase.from('public_profiles').select('*').eq('id', userId!).maybeSingle(),
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

  const handleMessage = () => {
    if (!user) { setAuthGateOpen(true); return; }
    if (!myProfile?.is_premium) { setPremiumGateOpen(true); return; }
    navigate(`/messages/${userId}`);
  };

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

  const showIdentity = isPremiumProfile && ((vis.gender_identity && profile.gender_identity) || (vis.orientation && profile.orientation) || (vis.looking_for && profile.looking_for?.length) || (vis.vibe && profile.vibe));
  const showEnergy = isPremiumProfile && ((vis.green_flags && profile.green_flags?.length) || (vis.evening_energy && profile.evening_energy) || (vis.what_i_bring && profile.what_i_bring));
  const showFunFacts = isPremiumProfile && ((vis.if_i_were_vibe && profile.if_i_were_vibe) || (vis.if_i_were_music && profile.if_i_were_music) || (vis.late_truth && profile.late_truth));

  return (
    <div className="profile-public min-h-screen">
    <div className="max-w-xl mx-auto pb-28">
      {/* Hero header */}
      <div className="relative px-4 pt-8 pb-6">
        <div className="flex flex-col items-center text-center">
          <div className="relative">
            <div
              className={`w-24 h-24 rounded-full flex items-center justify-center overflow-hidden
                ${profile.is_premium ? 'ring-[3px] ring-amber-400/80' : 'ring-2 ring-white/10'}
                ${!profile.avatar_url ? 'bg-[#7B2D8B]/20' : ''}`}
            >
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-[#a855f7] text-3xl font-bold">
                  {firstName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            {profile.last_active_at && (
              <div className="absolute -bottom-1 -right-1 flex items-center gap-1 px-2 py-0.5 rounded-full bg-white dark:bg-[#1a1a24] border border-black/10 dark:border-white/10 text-[10px] text-gray-400">
                <Clock size={9} />
                {timeAgo(profile.last_active_at)}
              </div>
            )}
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-center gap-2">
              <h1 className="text-2xl font-bold text-white">{firstName}</h1>
              {(profile as any).is_verified && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-[11px] font-semibold text-emerald-400 border border-emerald-500/20">
                  <ShieldCheck size={11} />
                  Verifie
                </span>
              )}
              {profile.is_premium && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-[11px] font-semibold text-amber-400 border border-amber-500/20">
                  <Crown size={11} />
                  Premium
                </span>
              )}
            </div>

            {vis.pronouns && profile.pronouns && (
              <p className="text-[13px] text-gray-400 mt-1">{profile.pronouns}</p>
            )}

            {profile.bio && (
              <p className="text-sm text-gray-300 mt-2.5 max-w-sm mx-auto leading-relaxed">{profile.bio}</p>
            )}
          </div>

          <div className="flex items-center gap-3 mt-4 text-[11px] text-gray-500">
            <span className="flex items-center gap-1">
              <Calendar size={11} />
              Membre depuis {formatDate(profile.created_at)}
            </span>
          </div>

          {profile.favorite_categories?.length > 0 && (
            <div className="flex flex-wrap justify-center gap-1.5 mt-4">
              {profile.favorite_categories.map((cat) => (
                <Tag key={cat}>{cat}</Tag>
              ))}
            </div>
          )}

          {(!user || user.id !== userId) && (
            <button
              onClick={handleMessage}
              className="mt-5 flex items-center gap-2 px-6 py-2.5 text-[13px] font-semibold rounded-full text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, #7B2D8B, #a855f7)', color: '#fff' }}
            >
              <MessageCircle size={15} />
              Envoyer un message
            </button>
          )}
        </div>
      </div>

      {/* Content sections */}
      <div className="px-4 space-y-4">
        {/* Galerie photos (Premium) */}
        {profile.gallery_urls && profile.gallery_urls.length > 0 && (
          <SectionCard>
            <SectionTitle icon={<Images size={16} className="text-[#a855f7]" />}>
              Galerie
            </SectionTitle>
            <div className="grid grid-cols-3 gap-2">
              {profile.gallery_urls.map((url) => (
                <a key={url} href={url} target="_blank" rel="noreferrer" className="block aspect-square rounded-lg overflow-hidden">
                  <img src={url} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform" />
                </a>
              ))}
            </div>
          </SectionCard>
        )}

        {/* Qui je suis */}
        {showIdentity && (
          <SectionCard>
            <SectionTitle icon={<Sparkles size={16} className="text-[#a855f7]" />}>
              Qui je suis
            </SectionTitle>

            <div className="space-y-4">
              {(vis.gender_identity && profile.gender_identity || vis.orientation && profile.orientation) && (
                <div className="flex flex-wrap gap-2">
                  {vis.gender_identity && profile.gender_identity && (
                    <Tag>{profile.gender_identity}</Tag>
                  )}
                  {vis.orientation && profile.orientation && (
                    <Tag>{profile.orientation}</Tag>
                  )}
                </div>
              )}

              {vis.looking_for && profile.looking_for && profile.looking_for.length > 0 && (
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-gray-500 mb-2">Ce que je cherche</p>
                  <div className="flex flex-wrap gap-2">
                    {profile.looking_for.map((item) => (
                      <Tag key={item} variant="rose">{item}</Tag>
                    ))}
                  </div>
                </div>
              )}

              {vis.vibe && profile.vibe && (
                <div className="flex items-start gap-2.5 pt-1">
                  <Zap size={14} className="text-amber-400 mt-0.5 shrink-0" />
                  <p className="text-sm text-gray-300">
                    Ma vibe : <span className="font-medium text-white">{profile.vibe}</span>
                  </p>
                </div>
              )}
            </div>
          </SectionCard>
        )}

        {/* Mon energie */}
        {showEnergy && (
          <SectionCard>
            <SectionTitle icon={<Zap size={16} className="text-emerald-400" />}>
              Mon energie
            </SectionTitle>

            <div className="space-y-4">
              {vis.green_flags && profile.green_flags && profile.green_flags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {profile.green_flags.map((flag) => (
                    <Tag key={flag} variant="green">{flag}</Tag>
                  ))}
                </div>
              )}

              {vis.evening_energy && profile.evening_energy && (
                <div className="flex items-start gap-2.5">
                  <Sparkles size={14} className="text-amber-400 mt-0.5 shrink-0" />
                  <p className="text-sm text-gray-300">
                    En soiree : <span className="font-medium text-white">{profile.evening_energy}</span>
                  </p>
                </div>
              )}

              {vis.what_i_bring && profile.what_i_bring && (
                <div className="flex items-start gap-2.5 pl-1">
                  <Quote size={12} className="text-gray-500 mt-0.5 shrink-0" />
                  <p className="text-sm italic text-gray-400">{profile.what_i_bring}</p>
                </div>
              )}
            </div>
          </SectionCard>
        )}

        {/* Fun facts */}
        {showFunFacts && (
          <SectionCard>
            <SectionTitle icon={<Music size={16} className="text-amber-400" />}>
              Fun facts
            </SectionTitle>

            <div className="space-y-3">
              {vis.if_i_were_vibe && profile.if_i_were_vibe && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.04]">
                  <span className="text-[11px] uppercase tracking-wider text-gray-500 shrink-0 w-28">Si j'etais une vibe</span>
                  <span className="text-sm font-medium text-white">{profile.if_i_were_vibe}</span>
                </div>
              )}

              {vis.if_i_were_music && profile.if_i_were_music && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.04]">
                  <span className="text-[11px] uppercase tracking-wider text-gray-500 shrink-0 w-28">Si j'etais une musique</span>
                  <span className="text-sm font-medium text-white">{profile.if_i_were_music}</span>
                </div>
              )}

              {vis.late_truth && profile.late_truth && (
                <div className="flex items-start gap-2.5 pt-1 pl-1">
                  <Quote size={12} className="text-gray-500 mt-0.5 shrink-0" />
                  <p className="text-sm italic text-gray-400">{profile.late_truth}</p>
                </div>
              )}
            </div>
          </SectionCard>
        )}

        {/* Lieux favoris */}
        {favorites.length > 0 && (
          <SectionCard>
            <SectionTitle icon={<Heart size={16} className="text-rose-400" />}>
              Lieux favoris
            </SectionTitle>

            <div className="grid grid-cols-2 gap-2.5">
              {favorites.map((est) => (
                <button
                  key={est.id}
                  onClick={() => navigate(`/establishment/${est.id}`)}
                  className="flex items-center gap-2.5 p-3 rounded-xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.05] hover:border-[#7B2D8B]/40 transition-all text-left group"
                >
                  {est.logo_url ? (
                    <img src={est.logo_url} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-lg bg-[#7B2D8B]/15 flex items-center justify-center shrink-0">
                      <MapPin size={14} className="text-[#a855f7]" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-[12px] font-medium text-white truncate group-hover:text-[#a855f7] transition-colors">{est.name}</p>
                    <p className="text-[11px] text-gray-500 truncate">{est.city}</p>
                  </div>
                </button>
              ))}
            </div>
          </SectionCard>
        )}

        {/* Derniers avis */}
        {reviews.length > 0 && (
          <SectionCard>
            <SectionTitle icon={<Star size={16} className="text-amber-400" />}>
              Derniers avis
            </SectionTitle>

            <div className="space-y-2.5">
              {reviews.map((review, i) => (
                <div
                  key={i}
                  className="p-3 rounded-xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.04]"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <button
                      onClick={() => review.establishment && navigate(`/establishment/${review.establishment.id}`)}
                      className="text-[12px] font-medium text-[#a855f7] hover:underline truncate"
                    >
                      {review.establishment?.name}
                    </button>
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }, (_, idx) => (
                        <Star
                          key={idx}
                          size={11}
                          className={idx < review.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-600'}
                        />
                      ))}
                    </div>
                  </div>
                  {review.comment && (
                    <p className="text-[12px] text-gray-400 line-clamp-2 leading-relaxed">{review.comment}</p>
                  )}
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* Empty state */}
        {favorites.length === 0 && reviews.length === 0 && !hasPremiumContent && (
          <div className="text-center py-12">
            <p className="text-sm text-gray-500">
              {user?.id === userId ? 'Ton profil est encore vide. Ajoute des lieux en favoris et laisse des avis !' : "Ce membre n'a pas encore d'activite publique."}
            </p>
          </div>
        )}
      </div>

      {/* Fixed bottom CTA */}
      {(!user || user.id !== userId) && (
        <div className="fixed bottom-16 md:bottom-0 left-0 right-0 z-40 p-4" style={{ background: 'linear-gradient(to top, var(--pp-fade), transparent)' }}>
          <div className="max-w-xl mx-auto">
            <button
              onClick={handleMessage}
              className="w-full flex items-center justify-center gap-2 py-3 text-[13px] font-semibold rounded-xl text-white shadow-lg shadow-[#7B2D8B]/20 transition-all hover:shadow-[#7B2D8B]/30"
              style={{ background: 'linear-gradient(135deg, #7B2D8B, #a855f7)', color: '#fff' }}
            >
              <MessageCircle size={16} />
              Envoyer un message a {firstName}
            </button>
          </div>
        </div>
      )}

      <AuthGateModal
        open={authGateOpen}
        onClose={() => setAuthGateOpen(false)}
        message="Cree ton compte pour envoyer un message."
      />

      <PremiumUpgradeModal open={premiumGateOpen} onClose={() => setPremiumGateOpen(false)} />
    </div>
    </div>
  );
}
