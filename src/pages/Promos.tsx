import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tag, Clock, Search, X, Lock, Crown, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useCategories } from '../contexts/CategoriesContext';
import { useCoveredCities } from '../lib/cities';
import type { Promotion, CategoryKey } from '../lib/types';
import FilterDropdown from '../components/ui/FilterDropdown';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import PremiumUpgradeModal from '../components/ui/PremiumUpgradeModal';
import { usePopupText } from '../lib/popups';

type PromoTypeFilter = 'all' | 'percentage' | 'fixed' | 'offer' | 'recurring';

const PROMO_FILTERS: { value: PromoTypeFilter; label: string }[] = [
  { value: 'all', label: 'Toutes' },
  { value: 'percentage', label: 'Reduction %' },
  { value: 'fixed', label: 'Montant fixe' },
  { value: 'offer', label: 'Offre speciale' },
  { value: 'recurring', label: 'Recurrente' },
];

export default function Promos() {
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<PromoTypeFilter>('all');
  const [cityFilter, setCityFilter] = useState('all');
  const [catFilter, setCatFilter] = useState('all');
  const [subcatFilter, setSubcatFilter] = useState('all');
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [usedPromoIds, setUsedPromoIds] = useState<Set<string>>(new Set());
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { categories, categoryKeys } = useCategories();
  const coveredCities = useCoveredCities();
  const premiumText = usePopupText('promos_premium');

  const isPremium = profile?.is_premium === true;

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from(isPremium ? 'promotions' : 'public_promotions')
        .select('*, establishment:establishments(name, logo_url, city, city_slug, category, subcategory)')
        .gte('valid_until', new Date().toISOString())
        .order('valid_until');
      if (data) setPromos(data as unknown as Promotion[]);
      setLoading(false);
    };
    load();
  }, [isPremium]);

  useEffect(() => {
    if (!user || !isPremium || promos.length === 0) return;
    const loadUses = async () => {
      const promoIds = promos.map((p) => p.id);
      const { data } = await supabase
        .from('promotion_uses')
        .select('promotion_id')
        .eq('user_id', user.id)
        .in('promotion_id', promoIds);
      if (data) {
        setUsedPromoIds(new Set(data.map((d) => d.promotion_id)));
      }
    };
    loadUses();
  }, [user, isPremium, promos]);

  // Filtres Ville (par rattachement) et Catégorie alignés sur l'annuaire : les
  // villes viennent de public_city_list, les catégories du catalogue. Ils
  // s'affichent donc toujours, même sans promo, comme sur la page Explorer.
  const subcats = catFilter === 'all' ? [] : (categories[catFilter as CategoryKey]?.subcategories || []);

  const filtered = promos.filter((p) => {
    if (typeFilter !== 'all' && p.promo_type !== typeFilter) return false;
    if (cityFilter !== 'all' && p.establishment?.city_slug !== cityFilter) return false;
    if (catFilter !== 'all' && p.establishment?.category !== catFilter) return false;
    if (subcatFilter !== 'all' && p.establishment?.subcategory !== subcatFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const matchTitle = p.title.toLowerCase().includes(q);
      const matchDesc = p.description?.toLowerCase().includes(q);
      const matchEst = p.establishment?.name?.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchEst) return false;
    }
    return true;
  });

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

  const daysLeft = (dateStr: string) => {
    const diff = new Date(dateStr).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const promoLabel = (p: Promotion) => {
    if (p.promo_type === 'percentage' && p.value) return `-${p.value}%`;
    if (p.promo_type === 'fixed' && p.value) return `-${p.value} EUR`;
    return 'Offre speciale';
  };

  const promoTypeLabel = (type: string) => {
    if (type === 'percentage') return 'Reduction %';
    if (type === 'fixed') return 'Montant fixe';
    if (type === 'recurring') return 'Recurrente';
    return 'Offre';
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
      <PremiumUpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />

      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Promotions</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {filtered.length} promo{filtered.length !== 1 ? 's' : ''} en cours
        </p>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une promotion..."
            className="input-field pl-9 text-xs w-full"
            style={{ height: 36, paddingTop: 6, paddingBottom: 6 }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <FilterDropdown
          label="Type de promo"
          value={typeFilter}
          options={PROMO_FILTERS}
          onChange={setTypeFilter}
        />
        {coveredCities.length > 0 && (
          <FilterDropdown
            label="Ville"
            value={cityFilter}
            options={[{ value: 'all', label: 'Toutes les villes' }, ...coveredCities.map((c) => ({ value: c.slug, label: c.name }))]}
            onChange={setCityFilter}
          />
        )}
        {categoryKeys.length > 0 && (
          <FilterDropdown
            label="Catégorie"
            value={catFilter}
            options={[{ value: 'all', label: 'Toutes les catégories' }, ...categoryKeys.map((c) => ({ value: c, label: categories[c as CategoryKey]?.label || c }))]}
            onChange={(v) => { setCatFilter(v); setSubcatFilter('all'); }}
          />
        )}
        {subcats.length > 0 && (
          <FilterDropdown
            label="Sous-catégorie"
            value={subcatFilter}
            options={[{ value: 'all', label: 'Toutes les sous-catégories' }, ...subcats.map((s) => ({ value: s, label: s }))]}
            onChange={setSubcatFilter}
          />
        )}
      </div>

      {/* Les promotions sont une VITRINE : tout le monde voit ce qu'il y a à gagner
          (le lieu, la réduction, la validité). C'est pour en profiter qu'il faut un
          compte, et ce verrou est sur la page de détail. Avant, la liste était
          floutée en entier : personne ne pouvait avoir envie de ce qu'il ne voyait
          pas, donc rien ne poussait à s'inscrire. */}
      {!isPremium && filtered.length > 0 && (
        <div
          className="flex items-start gap-3 rounded-card p-4"
          style={{ background: 'rgba(123,45,139,0.08)', border: '1px solid rgba(123,45,139,0.25)' }}
        >
          <Lock size={18} className="mt-0.5 shrink-0" style={{ color: '#7B2D8B' }} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{premiumText.title}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{premiumText.body}</p>
          </div>
          <button
            onClick={() => setUpgradeOpen(true)}
            className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-[10px] text-[13px] font-semibold text-white transition-all hover:opacity-90"
            style={{ background: '#7B2D8B' }}
          >
            <Crown size={15} />
            {premiumText.cta}
          </button>
        </div>
      )}

      {/* Rien à afficher : on le dit, et on s'arrête là. Vanter le pass Premium
          juste sous « aucune promotion » n'a aucun sens : on proposerait de payer
          pour utiliser des offres qui n'existent pas. L'invitation au pass n'a lieu
          d'être que lorsqu'il y a réellement des offres à convoiter (bandeau au-dessus
          de la liste). */}
      {filtered.length === 0 && (
        <div className="text-center py-16 space-y-3">
          <Tag size={48} className="mx-auto text-gray-300 dark:text-gray-600" />
          <p className="text-gray-500 dark:text-gray-400">
            {promos.length === 0
              ? 'Aucune promotion en cours pour le moment.'
              : 'Aucune promotion ne correspond à votre recherche.'}
          </p>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((promo) => {
            const est = promo.establishment;
            const remaining = daysLeft(promo.valid_until);
            const urgent = remaining <= 3;
            const isUsed = usedPromoIds.has(promo.id);

            return (
              <div
                key={promo.id}
                onClick={() => navigate(`/promotions/${promo.id}`)}
                className="card-hover p-4"
              >
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    {est?.logo_url ? (
                      <img src={est.logo_url} alt="" className="w-full h-full object-cover rounded-lg" />
                    ) : (
                      <Tag size={24} className="text-primary/50" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                          {promo.title}
                        </h3>
                        {est?.name && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {est.name}{est.city ? ` — ${est.city}` : ''}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 badge bg-primary/10 text-primary font-bold text-sm">
                        {promoLabel(promo)}
                      </span>
                    </div>

                    {promo.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
                        {promo.description}
                      </p>
                    )}

                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="badge bg-gray-100 dark:bg-dark-border text-gray-500 dark:text-gray-400 text-xs">
                        {promoTypeLabel(promo.promo_type)}
                      </span>
                      <span
                        className={`flex items-center gap-1 text-xs ${
                          urgent
                            ? 'text-alert font-medium'
                            : 'text-gray-500 dark:text-gray-400'
                        }`}
                      >
                        <Clock size={12} />
                        {urgent
                          ? `Plus que ${remaining}j !`
                          : `Jusqu'au ${formatDate(promo.valid_until)}`}
                      </span>
                      {promo.is_recurring && promo.recurrence_rule && (
                        <span className="flex items-center gap-1 text-xs font-medium" style={{ color: '#7B2D8B' }}>
                          🔁 {promo.recurrence_rule === 'monthly' ? 'Chaque mois' : 'Chaque semaine'}
                        </span>
                      )}
                      {isUsed && (
                        <span className="flex items-center gap-1 text-xs font-medium" style={{ color: '#27ae60' }}>
                          <Check size={12} />
                          Utilisee
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
