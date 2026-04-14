import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MessageCircle, Crown, Clock, Heart, Calendar, MapPin, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { CATEGORIES } from '../lib/constants';
import type { Profile, Establishment, Event, CategoryKey } from '../lib/types';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import AuthGateModal from '../components/ui/AuthGateModal';

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

export default function ProfilePublic() {
  const { userId } = useParams<{ userId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [favoriteEstablishments, setFavoriteEstablishments] = useState<Establishment[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [commonFavorites, setCommonFavorites] = useState<Establishment[]>([]);
  const [loading, setLoading] = useState(true);
  const [authGateOpen, setAuthGateOpen] = useState(false);

  useEffect(() => {
    if (!userId) return;
    loadData();
  }, [userId, user]);

  const loadData = async () => {
    setLoading(true);

    const profileRes = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId!)
      .maybeSingle();

    if (profileRes.data) setProfile(profileRes.data as Profile);

    const favsRes = await supabase
      .from('favorites')
      .select('establishment_id, establishment:establishments(*)')
      .eq('user_id', userId!);

    const favEstablishments = (favsRes.data ?? [])
      .map((f: any) => f.establishment)
      .filter(Boolean) as Establishment[];
    setFavoriteEstablishments(favEstablishments);

    const favEstIds = favEstablishments.map((e) => e.id);
    if (favEstIds.length > 0) {
      const eventsRes = await supabase
        .from('events')
        .select('*, establishment:establishments(name, logo_url, city)')
        .in('establishment_id', favEstIds)
        .gte('event_date', new Date().toISOString())
        .order('event_date')
        .limit(6);
      if (eventsRes.data) setUpcomingEvents(eventsRes.data as Event[]);
    } else {
      setUpcomingEvents([]);
    }

    if (user && user.id !== userId) {
      const myFavsRes = await supabase
        .from('favorites')
        .select('establishment_id')
        .eq('user_id', user.id);
      const myFavIds = new Set((myFavsRes.data ?? []).map((f: any) => f.establishment_id));
      setCommonFavorites(favEstablishments.filter((e) => myFavIds.has(e.id)));
    } else {
      setCommonFavorites([]);
    }

    setLoading(false);
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

  const formatEventDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
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

  const firstName = profile.username;

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
              navigate(`/messages/${userId}`);
            }}
            className="w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold rounded-xl shadow-lg text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: 'rgb(124, 58, 237)' }}
          >
            <MessageCircle size={18} />
            Envoyer un message a {firstName}
          </button>
        )}

        <div className="border-t border-light-border dark:border-dark-border" />

        <section>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
            <Heart size={16} className="text-primary" />
            Ses lieux favoris
          </h2>
          {favoriteEstablishments.length === 0 ? (
            <div className="rounded-xl bg-primary/5 dark:bg-primary/10 p-5 text-center">
              <Heart size={24} className="mx-auto text-primary/40 mb-2" />
              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                {firstName} n'a pas encore partage ses lieux favoris.
                <br />
                <span className="text-gray-400 dark:text-gray-500">
                  Envoie-lui un message pour lui demander ses bons plans !
                </span>
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              {favoriteEstablishments.map((est) => {
                const catLabel = CATEGORIES[est.category as CategoryKey]?.label ?? est.category;
                return (
                  <button
                    key={est.id}
                    onClick={() => navigate(`/establishment/${est.id}`)}
                    className="rounded-xl border border-light-border dark:border-dark-border
                               bg-light-surface dark:bg-dark-surface overflow-hidden
                               hover:border-primary/40 hover:shadow-md transition-all text-left"
                  >
                    <div className="w-full h-24 bg-gray-100 dark:bg-dark-border">
                      {est.banner_url || est.logo_url ? (
                        <img
                          src={est.banner_url ?? est.logo_url!}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <MapPin size={24} className="text-gray-300 dark:text-gray-600" />
                        </div>
                      )}
                    </div>
                    <div className="p-2.5">
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {est.name}
                      </h3>
                      <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                        {catLabel}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <div className="border-t border-light-border dark:border-dark-border" />

        <section>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
            <Calendar size={16} className="text-primary" />
            Ses evenements a venir
          </h2>
          {upcomingEvents.length === 0 ? (
            <div className="rounded-xl bg-primary/5 dark:bg-primary/10 p-5 text-center">
              <Calendar size={24} className="mx-auto text-primary/40 mb-2" />
              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                Aucun evenement prevu pour le moment.
                <br />
                <span className="text-gray-400 dark:text-gray-500">
                  Peut-etre que {firstName} aura bientot quelque chose a partager !
                </span>
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingEvents.map((evt) => {
                const est = evt.establishment as any;
                return (
                  <button
                    key={evt.id}
                    onClick={() => navigate(`/establishment/${evt.establishment_id}`)}
                    className="w-full rounded-xl border border-light-border dark:border-dark-border
                               bg-light-surface dark:bg-dark-surface p-3
                               hover:border-primary/40 hover:shadow-md transition-all
                               flex items-center gap-3 text-left"
                  >
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
                      {evt.image_url ? (
                        <img src={evt.image_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Calendar size={18} className="text-primary/50" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {evt.title}
                      </h3>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        {formatEventDate(evt.event_date)}
                        {est?.name ? ` · ${est.name}` : ''}
                      </p>
                    </div>
                    {evt.is_free ? (
                      <span className="text-[10px] font-semibold text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full shrink-0">
                        Gratuit
                      </span>
                    ) : evt.price > 0 ? (
                      <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 shrink-0">
                        {evt.price} EUR
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {user && user.id !== userId && (
          <>
            <div className="border-t border-light-border dark:border-dark-border" />
            <section>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
                <Users size={16} className="text-primary" />
                En commun avec toi
              </h2>
              {commonFavorites.length === 0 ? (
                <div className="rounded-xl bg-primary/5 dark:bg-primary/10 p-5 text-center">
                  <Users size={24} className="mx-auto text-primary/40 mb-2" />
                  <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                    Pas encore de lieux en commun avec {firstName}.
                    <br />
                    <span className="text-gray-400 dark:text-gray-500">
                      Explorez la ville et vos gouts se croiseront peut-etre !
                    </span>
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  {commonFavorites.map((est) => {
                    const catLabel = CATEGORIES[est.category as CategoryKey]?.label ?? est.category;
                    return (
                      <button
                        key={est.id}
                        onClick={() => navigate(`/establishment/${est.id}`)}
                        className="rounded-xl border border-primary/20 dark:border-primary/30
                                   bg-primary/5 dark:bg-primary/10 overflow-hidden
                                   hover:border-primary/50 hover:shadow-md transition-all text-left"
                      >
                        <div className="w-full h-24 bg-gray-100 dark:bg-dark-border">
                          {est.banner_url || est.logo_url ? (
                            <img
                              src={est.banner_url ?? est.logo_url!}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Heart size={24} className="text-primary/30" />
                            </div>
                          )}
                        </div>
                        <div className="p-2.5">
                          <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {est.name}
                          </h3>
                          <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                            {catLabel}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      <AuthGateModal
        open={authGateOpen}
        onClose={() => setAuthGateOpen(false)}
        message="Cree ton compte pour envoyer un message."
      />

      {(!user || user.id !== userId) && (
        <div className="fixed bottom-16 md:bottom-0 left-0 right-0 z-40 p-4 bg-gradient-to-t from-light-bg dark:from-dark-bg via-light-bg/95 dark:via-dark-bg/95 to-transparent">
          <div className="max-w-2xl mx-auto">
            <button
              onClick={() => {
                if (!user) { setAuthGateOpen(true); return; }
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
