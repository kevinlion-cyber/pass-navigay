import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapPin, Phone, Globe, Heart, Share2, Calendar, Tag, CreditCard as Edit, ChevronLeft, X, Clock, Map,
  Sun, Coffee, Leaf, Beer, Wine, Music, Baby, Users, Dog, CalendarCheck, Truck, ShoppingBag, Utensils, Accessibility, Car, Wallet, Martini, Check, type LucideIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useCategories } from '../contexts/CategoriesContext';
import type { Establishment, EstablishmentPhoto, Event, Promotion, Review, CategoryKey, OpeningHours } from '../lib/types';
import StarRating from '../components/ui/StarRating';
import ShieldRating from '../components/ui/ShieldRating';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import AuthGateModal from '../components/ui/AuthGateModal';

const DAYS_ORDER = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

const AMENITY_ICONS: Record<string, LucideIcon> = {
  'Terrasse': Sun, 'Petit-déjeuner': Coffee, 'Brunch': Coffee, 'Café': Coffee,
  'Options végé': Leaf, 'Cocktails': Martini, 'Bière': Beer, 'Vin': Wine, 'Musique live': Music,
  'Adapté enfants': Baby, 'Groupes': Users, 'Animaux acceptés': Dog, 'Réservation': CalendarCheck,
  'Livraison': Truck, 'À emporter': ShoppingBag, 'Sur place': Utensils, 'Accessible PMR': Accessibility,
  'Parking': Car, 'CB acceptée': Wallet,
};

function OpeningHoursDisplay({ hours }: { hours: OpeningHours }) {
  const today = DAYS_ORDER[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];
  const hasHours = DAYS_ORDER.some((d) => hours[d] !== undefined);
  if (!hasHours) return null;

  return (
    <div className="space-y-1.5">
      {DAYS_ORDER.map((day) => {
        const slot = hours[day];
        const isToday = day === today;
        return (
          <div
            key={day}
            className={`flex items-center justify-between text-sm px-3 py-1.5 rounded-lg ${
              isToday ? 'bg-primary/5 dark:bg-primary/10 font-medium' : ''
            }`}
          >
            <span className={`capitalize ${isToday ? 'text-primary' : 'text-gray-700 dark:text-gray-300'}`}>
              {day}
            </span>
            <span className={isToday ? 'text-primary' : 'text-gray-500 dark:text-gray-400'}>
              {slot ? `${slot.open} - ${slot.close}` : 'Ferme'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function EstablishmentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { categories } = useCategories();
  const isPremium = profile?.is_premium === true;

  const [establishment, setEstablishment] = useState<Establishment | null>(null);
  const [photos, setPhotos] = useState<EstablishmentPhoto[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [authGateOpen, setAuthGateOpen] = useState(false);
  const [authGateMessage, setAuthGateMessage] = useState('');

  const [newRating, setNewRating] = useState(0);
  const [newSafetyRating, setNewSafetyRating] = useState(0);
  const [newComment, setNewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    if (!id) return;
    loadAll();
  }, [id, user, isPremium]);

  const loadAll = async () => {
    setLoading(true);
    const [estRes, photosRes, eventsRes, promosRes, reviewsRes] = await Promise.all([
      supabase.from('establishments').select('*').eq('id', id!).maybeSingle(),
      supabase.from('establishment_photos').select('*').eq('establishment_id', id!).order('order_index'),
      supabase.from('events').select('*').eq('establishment_id', id!).or(`event_date.gte.${new Date().toISOString()},end_date.gte.${new Date().toISOString()}`).order('event_date'),
      supabase.from(isPremium ? 'promotions' : 'public_promotions').select('*').eq('establishment_id', id!).gte('valid_until', new Date().toISOString()),
      supabase.from('reviews').select('*').eq('establishment_id', id!).order('created_at', { ascending: false }),
    ]);

    if (estRes.data) setEstablishment(estRes.data as Establishment);
    if (photosRes.data) setPhotos(photosRes.data as EstablishmentPhoto[]);
    if (eventsRes.data) setEvents(eventsRes.data as Event[]);
    if (promosRes.data) setPromotions(promosRes.data as Promotion[]);
    if (reviewsRes.data) {
      const reviewsData = reviewsRes.data as unknown as Review[];
      // Auteurs récupérés via la vue publique (la table profiles n'est plus lisible en direct).
      const authorIds = [...new Set(reviewsData.map((r) => r.user_id).filter(Boolean))];
      let authorsMap: Record<string, any> = {};
      if (authorIds.length) {
        const { data: authors } = await supabase
          .from('public_profiles')
          .select('id, username, avatar_url')
          .in('id', authorIds);
        authorsMap = Object.fromEntries((authors || []).map((a: any) => [a.id, { username: a.username, avatar_url: a.avatar_url }]));
      }
      setReviews(reviewsData.map((r) => ({ ...r, user: authorsMap[r.user_id] })));
    }

    if (user) {
      const { data: fav } = await supabase
        .from('favorites')
        .select('id')
        .eq('user_id', user.id)
        .eq('establishment_id', id!)
        .maybeSingle();
      setIsFavorite(!!fav);
    }

    setLoading(false);
  };

  const showAuthGate = (message: string) => {
    setAuthGateMessage(message);
    setAuthGateOpen(true);
  };

  const toggleFavorite = async () => {
    if (!user) {
      showAuthGate('Cree ton compte pour sauvegarder tes lieux favoris.');
      return;
    }
    if (isFavorite) {
      await supabase.from('favorites').delete().eq('user_id', user.id).eq('establishment_id', id!);
      setIsFavorite(false);
      toast.success('Retire des favoris');
    } else {
      await supabase.from('favorites').insert({ user_id: user.id, establishment_id: id });
      setIsFavorite(true);
      toast.success('Ajoute aux favoris');
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: establishment?.name, url });
    } else {
      await navigator.clipboard.writeText(url);
      toast.success('Lien copie !');
    }
  };

  const openMap = () => {
    if (!establishment) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${establishment.latitude},${establishment.longitude}`;
    window.open(url, '_blank');
  };

  const submitReview = async () => {
    if (!user) {
      showAuthGate('Crée ton compte pour laisser un avis.');
      return;
    }
    if (!isPremium) {
      toast.error('Les avis sont reserves aux membres Premium.');
      navigate('/pricing');
      return;
    }
    if (newRating === 0) { toast.error('Choisis une note qualité.'); return; }
    setSubmittingReview(true);

    const { error } = await supabase.from('reviews').upsert({
      user_id: user.id,
      establishment_id: id,
      rating: newRating,
      safety_rating: newSafetyRating > 0 ? newSafetyRating : null,
      comment: newComment,
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Avis envoyé !');
      setNewRating(0);
      setNewSafetyRating(0);
      setNewComment('');
      loadAll();
    }
    setSubmittingReview(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner size={40} />
      </div>
    );
  }

  if (!establishment) {
    return (
      <div className="text-center py-20 text-gray-500">
        <p>Établissement non trouvé.</p>
        <button onClick={() => navigate('/explore')} className="btn-primary mt-4">
          Retour
        </button>
      </div>
    );
  }

  const avgRating = reviews.length > 0
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : 0;
  const safetyReviews = reviews.filter((r) => r.safety_rating && r.safety_rating > 0);
  const avgSafety = safetyReviews.length > 0
    ? safetyReviews.reduce((s, r) => s + (r.safety_rating || 0), 0) / safetyReviews.length
    : 0;
  const categoryLabel = categories[establishment.category as CategoryKey]?.label || establishment.category;
  const isOwner = user?.id === establishment.owner_id;
  const openingHours = establishment.opening_hours as OpeningHours | null;

  return (
    <div className="max-w-3xl mx-auto pb-8">
      <AuthGateModal open={authGateOpen} onClose={() => setAuthGateOpen(false)} message={authGateMessage} />

      {lightboxUrl && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4" onClick={() => setLightboxUrl(null)}>
          <button onClick={() => setLightboxUrl(null)} aria-label="Fermer" className="absolute top-4 right-4 text-white">
            <X size={28} />
          </button>
          <img src={lightboxUrl} alt="" className="max-w-full max-h-full object-contain" />
        </div>
      )}

      {/* Hero immersif : pour un lieu, la photo EST le héros */}
      <div className="relative w-full h-64 md:h-80 overflow-hidden bg-gradient-to-br from-gray-200 to-gray-300 dark:from-dark-border dark:to-dark-bg">
        {establishment.banner_url ? (
          <img src={establishment.banner_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <MapPin size={44} className="text-gray-300 dark:text-gray-600" />
          </div>
        )}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(12,9,16,0.85) 0%, rgba(12,9,16,0.35) 40%, rgba(12,9,16,0) 65%)' }} />

        <button onClick={() => navigate(-1)} aria-label="Retour" className="absolute top-3 left-3 w-9 h-9 rounded-full flex items-center justify-center bg-black/35 backdrop-blur-sm text-white hover:bg-black/55 transition-colors">
          <ChevronLeft size={20} />
        </button>

        <div className="absolute top-3 right-3 flex items-center gap-2">
          {isOwner && (
            <button onClick={() => navigate(`/establishment/${id}/edit`)} aria-label="Modifier" className="w-9 h-9 rounded-full flex items-center justify-center bg-black/35 backdrop-blur-sm text-white hover:bg-black/55 transition-colors">
              <Edit size={17} />
            </button>
          )}
          <button onClick={toggleFavorite} aria-label="Favoris" className="w-9 h-9 rounded-full flex items-center justify-center bg-black/35 backdrop-blur-sm text-white hover:bg-black/55 transition-colors">
            <Heart size={17} className={isFavorite ? 'fill-alert text-alert' : ''} />
          </button>
          <button onClick={handleShare} aria-label="Partager" className="w-9 h-9 rounded-full flex items-center justify-center bg-black/35 backdrop-blur-sm text-white hover:bg-black/55 transition-colors">
            <Share2 size={17} />
          </button>
        </div>

        <div className="absolute inset-x-0 bottom-0 p-4 md:p-6">
          <div className="flex items-end gap-3">
            <div className="w-14 h-14 rounded-2xl bg-white/95 dark:bg-dark-surface shadow-lg flex items-center justify-center shrink-0 overflow-hidden ring-1 ring-white/25">
              {establishment.logo_url ? (
                <img src={establishment.logo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-primary text-2xl font-bold">{establishment.name.charAt(0)}</span>
              )}
            </div>
            <div className="min-w-0 pb-0.5">
              {establishment.is_pro && <span className="badge-pro mb-1 inline-block">PARTENAIRE OFFICIEL</span>}
              <h1 className="text-2xl md:text-3xl font-bold text-white leading-tight" style={{ textShadow: '0 2px 14px rgba(0,0,0,0.55)' }}>{establishment.name}</h1>
              <p className="text-sm text-white/85 mt-0.5">
                {categoryLabel} &middot; {establishment.subcategory}
                {typeof establishment.price_level === 'number' && establishment.price_level > 0 && (
                  <span className="ml-1.5 font-semibold">{'€'.repeat(establishment.price_level)}</span>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {(avgRating > 0 || avgSafety > 0) && (
          <div className="flex items-center gap-4">
            {avgRating > 0 && (
              <div className="flex items-center gap-1.5">
                <StarRating rating={Math.round(avgRating)} size={16} />
                <span className="text-xs text-gray-500">({reviews.length} avis)</span>
              </div>
            )}
            {avgSafety > 0 && (
              <div className="flex items-center gap-1.5">
                <ShieldRating rating={Math.round(avgSafety)} size={16} />
                <span className="text-xs text-gray-500">({safetyReviews.length})</span>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-3">
          <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400 flex-1">
            <MapPin size={16} className="shrink-0 mt-0.5" />
            <span>{establishment.address}, {establishment.postal_code} {establishment.city}</span>
          </div>
          <button
            onClick={openMap}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors"
          >
            <Map size={14} />
            Itineraire
          </button>
        </div>

        {establishment.is_pro && establishment.description && (
          <div className="space-y-3">
            {establishment.description.split(/\n{2,}|\n/).map((para) => para.trim()).filter(Boolean).map((para, i) => (
              <p key={i} className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{para}</p>
            ))}
          </div>
        )}

        {establishment.is_pro && (establishment.phone || establishment.website) && (
          <div className="flex flex-wrap gap-4 text-sm">
            {establishment.phone && (
              <a href={`tel:${establishment.phone}`} className="flex items-center gap-2 text-primary hover:underline">
                <Phone size={14} /> {establishment.phone}
              </a>
            )}
            {establishment.website && (
              <a href={establishment.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary hover:underline">
                <Globe size={14} /> Site web
              </a>
            )}
          </div>
        )}

        {establishment.is_pro && establishment.amenities && establishment.amenities.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Bon à savoir</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {establishment.amenities.map((a) => {
                const Icon = AMENITY_ICONS[a] || Check;
                return (
                  <div key={a} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-input px-3 py-2">
                    <Icon size={16} className="text-primary shrink-0" />
                    <span className="truncate">{a}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {establishment.is_pro && photos.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Galerie</h2>
            <div className="grid grid-cols-3 gap-2">
              {photos.map((photo) => (
                <img
                  key={photo.id}
                  src={photo.url}
                  alt={photo.caption}
                  onClick={() => setLightboxUrl(photo.url)}
                  className="w-full h-24 md:h-32 object-cover rounded-input cursor-pointer hover:opacity-80 transition-opacity"
                />
              ))}
            </div>
          </div>
        )}

        {events.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Événements à venir</h2>
            <div className="space-y-3">
              {events.map((event) => (
                <div
                  key={event.id}
                  onClick={() => navigate(`/events/${event.id}`)}
                  className="card p-4 flex gap-3 cursor-pointer hover:ring-1 hover:ring-primary/30 transition-shadow"
                >
                  <div className="w-10 h-10 rounded-input bg-primary/10 flex items-center justify-center shrink-0">
                    <Calendar size={18} className="text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900 dark:text-white">{event.title}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(event.event_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                    {event.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">{event.description}</p>
                    )}
                    {event.is_free ? (
                      <span className="badge-free mt-2">Gratuit</span>
                    ) : (
                      <span className="text-sm text-gray-500 mt-2 block">{event.price} EUR</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {promotions.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Promotions</h2>
            <div className="space-y-3">
              {promotions.map((promo) => (
                <div
                  key={promo.id}
                  onClick={() => navigate(`/promos/${promo.id}`)}
                  className="card p-4 flex gap-3 cursor-pointer hover:ring-1 hover:ring-success/30 transition-shadow"
                >
                  <div className="w-10 h-10 rounded-input bg-success/10 flex items-center justify-center shrink-0">
                    <Tag size={18} className="text-success" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">{promo.title}</h3>
                    {promo.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">{promo.description}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      Jusqu'au {new Date(promo.valid_until).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {openingHours && Object.keys(openingHours).length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Clock size={18} className="text-primary" />
              Horaires d'ouverture
            </h2>
            <div className="card p-4">
              <OpeningHoursDisplay hours={openingHours} />
            </div>
          </div>
        )}

        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Avis ({reviews.length})</h2>

          {!user ? (
            <div className="card p-4 mb-4 text-center space-y-2">
              <p className="text-sm text-gray-600 dark:text-gray-300">Crée ton compte pour laisser un avis.</p>
              <button onClick={() => showAuthGate('Crée ton compte pour laisser un avis.')} className="btn-primary text-sm">
                Creer un compte
              </button>
            </div>
          ) : !isPremium ? (
            <div className="card p-5 mb-4 text-center space-y-2">
              <p className="text-sm text-gray-700 dark:text-gray-200">
                Les avis sont reserves aux membres <span className="text-primary font-semibold">Premium</span>.
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Passe Premium pour noter la qualite et le cote « Safe place » des etablissements.
              </p>
              <button onClick={() => navigate('/pricing')} className="btn-primary text-sm">
                Passer Premium
              </button>
            </div>
          ) : (
            <div className="card p-4 space-y-4 mb-4">
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Qualité</p>
                  <StarRating rating={newRating} interactive onChange={(r) => setNewRating(r)} />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Safe place (optionnel)</p>
                  <ShieldRating rating={newSafetyRating} interactive onChange={(r) => setNewSafetyRating(r)} />
                </div>
              </div>
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Ton avis..."
                rows={3}
                className="input-field resize-none"
              />
              <button onClick={submitReview} disabled={submittingReview} className="btn-primary text-sm flex items-center gap-2">
                {submittingReview && <LoadingSpinner size={16} />}
                Envoyer
              </button>
            </div>
          )}

          <div className="space-y-3">
            {reviews.map((review) => {
              const u = review.user as unknown as { username: string; avatar_url: string | null } | undefined;
              return (
                <div key={review.id} className="card p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary overflow-hidden">
                      {u?.avatar_url ? (
                        <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        u?.username?.charAt(0).toUpperCase() || '?'
                      )}
                    </div>
                    <div className="flex-1">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {u?.username || 'Anonyme'}
                      </span>
                      <div className="flex items-center gap-3 mt-0.5">
                        <StarRating rating={review.rating} size={12} />
                        {review.safety_rating && review.safety_rating > 0 && (
                          <ShieldRating rating={review.safety_rating} size={12} />
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 ml-auto">
                      {new Date(review.created_at).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                  {review.comment && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">{review.comment}</p>
                  )}
                  {review.reply && (
                    <div className="mt-3 ml-4 pl-3 border-l-2 border-primary/40">
                      <p className="text-xs font-semibold text-primary mb-0.5">Réponse de {establishment.name}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{review.reply}</p>
                    </div>
                  )}
                </div>
              );
            })}

            {reviews.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                Aucun avis pour le moment.
              </p>
            )}
          </div>
        </div>

        <button onClick={() => navigate(-1)} className="btn-ghost flex items-center gap-2">
          <ChevronLeft size={16} />
          Retour
        </button>
      </div>
    </div>
  );
}
