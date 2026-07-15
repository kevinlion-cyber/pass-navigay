import { useEffect, useMemo, useState } from 'react';
import {
  Users, Search, X, RefreshCw, MapPin, Crown, BadgeCheck, ShieldCheck, Eye, Heart, Star,
  MessageCircle, FileText, Building2, Zap, Tag, UserPlus, Loader2, Monitor, Globe, Clock, Layers,
  type LucideIcon,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Person {
  key: string; kind: 'member' | 'guest'; name: string | null; email: string | null; city: string | null;
  firstSeen: string | null; lastSeen: string | null; sessions: number;
  pageViews: number; events: number; searches: number; establishmentViews: number;
  favorites: number; reviews: number; messages: number; claims: number;
  isPremium: boolean; isPro: boolean; isVerified: boolean;
}
interface TimelineItem { ts: string; type: string; label: string; detail?: string }
interface Detail extends Person { country: string | null; userAgent: string | null; referrer: string | null; promoUses: number }

type Filter = 'all' | 'member' | 'guest';
const PAGE = 25;

const TYPE_ICON: Record<string, LucideIcon> = {
  page: FileText, establishment: Building2, search: Search, event: Zap, favorite: Heart,
  review: Star, message: MessageCircle, claim: BadgeCheck, promo: Tag, signup: UserPlus,
};

function relTime(iso: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000), h = Math.floor(diff / 3600000), d = Math.floor(diff / 86400000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  if (h < 24) return `il y a ${h} h`;
  if (d < 30) return `il y a ${d} j`;
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fullDate(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function deviceLabel(ua: string | null): string {
  if (!ua) return '—';
  if (/iphone|android.*mobile|mobile/i.test(ua)) return 'Mobile';
  if (/ipad|tablet/i.test(ua)) return 'Tablette';
  return 'Ordinateur';
}

export default function AdminUsers() {
  const [people, setPeople] = useState<Person[]>([]);
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Person | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.functions.invoke('admin-people', { body: { mode: 'list' } });
    if (data && !data.error) { setPeople(data.people || []); setTotals(data.totals || {}); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openPerson = async (p: Person) => {
    setSelected(p); setDetail(null); setTimeline([]); setDetailLoading(true);
    const { data } = await supabase.functions.invoke('admin-people', { body: { mode: 'detail', key: p.key } });
    if (data && !data.error) { setDetail(data.person); setTimeline(data.timeline || []); }
    setDetailLoading(false);
  };

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return people.filter((p) => {
      if (filter !== 'all' && p.kind !== filter) return false;
      if (!needle) return true;
      return [p.name, p.email, p.city].some((f) => f && f.toLowerCase().includes(needle));
    });
  }, [people, q, filter]);

  const pageItems = filtered.slice(page * PAGE, page * PAGE + PAGE);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  useEffect(() => { setPage(0); }, [q, filter]);

  const tabs: { key: Filter; label: string }[] = [
    { key: 'all', label: `Tous${totals.people ? ` (${totals.people})` : ''}` },
    { key: 'member', label: `Membres${totals.members ? ` (${totals.members})` : ''}` },
    { key: 'guest', label: `Visiteurs${totals.guests ? ` (${totals.guests})` : ''}` },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2"><Users size={20} className="text-primary" /><h1 className="text-xl font-bold text-gray-900 dark:text-white">Utilisateurs</h1></div>
        <button onClick={load} className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-900 dark:hover:text-white"><RefreshCw size={15} /> Rafraîchir</button>
      </div>
      <p className="text-sm text-gray-500 -mt-2">Chaque membre et chaque visiteur anonyme, avec le détail de toutes ses actions. Cliquez pour voir le parcours complet.</p>

      <div className="flex flex-wrap gap-3">
        <Chip icon={Users} label="Personnes" value={totals.people ?? 0} />
        <Chip icon={BadgeCheck} label="Membres" value={totals.members ?? 0} />
        <Chip icon={Eye} label="Visiteurs" value={totals.guests ?? 0} />
        <Chip icon={Crown} label="Premium" value={totals.premium ?? 0} />
        <Chip icon={Building2} label="Pros" value={totals.pros ?? 0} />
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-light-surface dark:bg-dark-surface p-1 rounded-input border border-light-border dark:border-dark-border">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setFilter(t.key)} className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${filter === t.key ? 'bg-primary/15 text-primary' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}>{t.label}</button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un nom, e-mail, ville…" className="w-full pl-9 pr-3 py-2 text-sm rounded-input bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border text-gray-900 dark:text-white focus:outline-none focus:border-primary" />
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">{[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-16 rounded-card" />)}</div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-gray-500 py-12">Aucune personne trouvée.</p>
      ) : (
        <>
          <div className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-card overflow-hidden">
            <div className="hidden md:grid grid-cols-[1.6fr_0.8fr_repeat(4,0.55fr)_0.9fr] gap-2 px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide border-b border-light-border dark:border-dark-border">
              <span>Personne</span><span>Ville</span><span className="text-center">Sess.</span><span className="text-center">Pages</span><span className="text-center">Favoris</span><span className="text-center">Avis</span><span className="text-right">Activité</span>
            </div>
            {pageItems.map((p) => (
              <button key={p.key} onClick={() => openPerson(p)} className="w-full text-left grid grid-cols-2 md:grid-cols-[1.6fr_0.8fr_repeat(4,0.55fr)_0.9fr] gap-2 px-4 py-3 items-center border-b border-light-border dark:border-dark-border last:border-0 hover:bg-gray-50 dark:hover:bg-dark-bg/40 transition-colors">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-medium text-gray-900 dark:text-white truncate">{p.name || (p.kind === 'guest' ? 'Visiteur anonyme' : p.email || 'Membre')}</span>
                    {p.isPremium && <Crown size={13} className="text-amber-500 shrink-0" />}
                    {p.isPro && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary shrink-0">Pro</span>}
                    {p.isVerified && <ShieldCheck size={13} className="text-emerald-500 shrink-0" />}
                  </div>
                  <span className="text-xs text-gray-500 truncate block">{p.email || (p.kind === 'guest' ? 'non identifié' : '—')}</span>
                </div>
                <span className="text-sm text-gray-500 truncate hidden md:block">{p.city || '—'}</span>
                <span className="text-sm text-gray-700 dark:text-gray-300 text-center hidden md:block">{p.sessions}</span>
                <span className="text-sm text-gray-700 dark:text-gray-300 text-center hidden md:block">{p.pageViews}</span>
                <span className="text-sm text-gray-700 dark:text-gray-300 text-center hidden md:block">{p.favorites}</span>
                <span className="text-sm text-gray-700 dark:text-gray-300 text-center hidden md:block">{p.reviews}</span>
                <span className="text-xs text-gray-500 text-right">{relTime(p.lastSeen)}</span>
              </button>
            ))}
          </div>
          {pages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">{filtered.length} personne{filtered.length > 1 ? 's' : ''}</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="px-3 py-1.5 rounded-input border border-light-border dark:border-dark-border disabled:opacity-40">Précédent</button>
                <span className="text-gray-500">{page + 1} / {pages}</span>
                <button onClick={() => setPage((p) => Math.min(pages - 1, p + 1))} disabled={page >= pages - 1} className="px-3 py-1.5 rounded-input border border-light-border dark:border-dark-border disabled:opacity-40">Suivant</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Panneau détail */}
      {selected && (
        <div className="fixed inset-0 z-[60] flex justify-end" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setSelected(null)}>
          <div className="w-full max-w-md h-full bg-light-bg dark:bg-dark-bg overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3 bg-light-surface dark:bg-dark-surface border-b border-light-border dark:border-dark-border">
              <span className="text-sm font-semibold text-gray-900 dark:text-white">Parcours utilisateur</span>
              <button onClick={() => setSelected(null)} className="p-1 text-gray-500 hover:text-gray-900 dark:hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-5">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">{selected.name || (selected.kind === 'guest' ? 'Visiteur anonyme' : selected.email || 'Membre')}</h2>
                  {selected.isPremium && <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 flex items-center gap-1"><Crown size={11} /> Premium</span>}
                  {selected.isPro && <span className="text-[11px] px-1.5 py-0.5 rounded bg-primary/15 text-primary">Pro</span>}
                  {selected.isVerified && <span className="text-[11px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 flex items-center gap-1"><ShieldCheck size={11} /> Vérifié</span>}
                </div>
                {selected.email && <p className="text-sm text-gray-500">{selected.email}</p>}
              </div>

              {/* Attributs */}
              <div className="grid grid-cols-2 gap-2 text-sm">
                <Attr icon={MapPin} label="Ville" value={detail?.city || selected.city || '—'} />
                <Attr icon={Monitor} label="Appareil" value={deviceLabel(detail?.userAgent ?? null)} />
                <Attr icon={Globe} label="Source" value={sourceLabel(detail?.referrer ?? null)} />
                <Attr icon={Layers} label="Sessions" value={String(selected.sessions)} />
                <Attr icon={Clock} label="1ʳᵉ visite" value={relTime(selected.firstSeen)} />
                <Attr icon={Clock} label="Dernière" value={relTime(selected.lastSeen)} />
              </div>

              {/* Tuiles d'activité */}
              <div className="grid grid-cols-3 gap-2">
                <Stat icon={FileText} label="Pages" value={selected.pageViews} />
                <Stat icon={Search} label="Recherches" value={selected.searches} />
                <Stat icon={Building2} label="Fiches" value={selected.establishmentViews} />
                <Stat icon={Heart} label="Favoris" value={selected.favorites} />
                <Stat icon={Star} label="Avis" value={selected.reviews} />
                <Stat icon={MessageCircle} label="Messages" value={selected.messages} />
              </div>

              {/* Timeline */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Parcours sur le site</h3>
                {detailLoading ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500 py-6 justify-center"><Loader2 size={16} className="animate-spin" /> Chargement…</div>
                ) : timeline.length === 0 ? (
                  <p className="text-sm text-gray-500 py-4 text-center">Aucune action enregistrée pour le moment.</p>
                ) : (
                  <div className="relative pl-5 space-y-3 before:absolute before:left-1.5 before:top-1 before:bottom-1 before:w-px before:bg-light-border dark:before:bg-dark-border">
                    {timeline.map((t, i) => {
                      const Icon = TYPE_ICON[t.type] || Zap;
                      return (
                        <div key={i} className="relative">
                          <span className="absolute -left-[18px] top-0.5 w-3 h-3 rounded-full bg-primary/20 border-2 border-light-bg dark:border-dark-bg flex items-center justify-center" />
                          <div className="flex items-start gap-2">
                            <Icon size={14} className="text-primary mt-0.5 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm text-gray-900 dark:text-white leading-snug">{t.label}</p>
                              {t.detail && <p className="text-xs text-gray-500 truncate">{t.detail}</p>}
                              <p className="text-[11px] text-gray-400">{fullDate(t.ts)}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function sourceLabel(referrer: string | null): string {
  if (!referrer) return 'Accès direct';
  try { return new URL(referrer).hostname.replace(/^www\./, ''); } catch { return referrer; }
}

function Chip({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-input bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border">
      <Icon size={15} className="text-primary" />
      <span className="text-sm font-bold text-gray-900 dark:text-white">{value}</span>
      <span className="text-xs text-gray-500">{label}</span>
    </div>
  );
}
function Attr({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon size={14} className="text-gray-400 shrink-0" />
      <div className="min-w-0"><span className="text-xs text-gray-500 block">{label}</span><span className="text-gray-900 dark:text-white truncate block">{value}</span></div>
    </div>
  );
}
function Stat({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) {
  return (
    <div className="rounded-input p-2.5 border border-light-border dark:border-dark-border text-center">
      <Icon size={15} className="text-primary mx-auto mb-1" />
      <p className="text-base font-bold text-gray-900 dark:text-white leading-none">{value}</p>
      <p className="text-[11px] text-gray-500 mt-1">{label}</p>
    </div>
  );
}
